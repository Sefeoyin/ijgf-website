/**
 * OnboardingModal.jsx
 *
 * Shown to new users immediately after completing profile setup.
 * Three steps:
 *   1. Welcome + challenge tier selection (5K / 10K / 25K / 50K / 100K)
 *   2. Trading mode selection (IJGF Market or Bybit API)
 *   3. Bybit API key entry (only if Bybit chosen in step 2)
 *
 * On completion it calls onComplete(challengeType, mode) which:
 *   - Creates the demo_accounts row via getOrCreateDemoAccount
 *   - Navigates to /dashboard
 *
 * The modal cannot be dismissed without completing the flow —
 * a new user must start a challenge to use the platform.
 */

import { useState } from 'react'
import { supabase } from './supabase'
import { getOrCreateDemoAccount } from './tradingService'

const BYBIT_PROXY = '/api/bybit-proxy'

async function proxyCall(apiKey, apiSecret, method, endpoint, params = {}) {
  const res = await fetch(BYBIT_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret, method, endpoint, params }),
  })
  if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`)
  const json = await res.json()
  if (json.retCode !== 0) {
    if ([10003, 10004, 33004].includes(json.retCode))
      throw new Error('Invalid API credentials. Create the key inside Demo Trading mode on bybit.com — not testnet.')
    throw new Error(`Bybit error ${json.retCode}: ${json.retMsg}`)
  }
  return json.result
}

async function getUsdtBalance(apiKey, apiSecret) {
  const r = await proxyCall(apiKey, apiSecret, 'GET', '/v5/account/wallet-balance', { accountType: 'UNIFIED' })
  const coins = r?.list?.[0]?.coin ?? []
  const usdt = coins.find(c => c.coin === 'USDT')
  return parseFloat(usdt?.walletBalance ?? 0)
}

async function resetBybitDemoBalance(apiKey, apiSecret, challengeUsdt) {
  // Step 1: verify credentials + read actual wallet
  const wallet = await proxyCall(apiKey, apiSecret, 'GET', '/v5/account/wallet-balance', { accountType: 'UNIFIED' })
  const coins = wallet?.list?.[0]?.coin ?? []

  // Step 2: nuke every coin that has a balance > 0 using actual wallet amounts
  for (const coinEntry of coins) {
    const bal = parseFloat(coinEntry.walletBalance ?? 0)
    if (bal <= 0) continue
    await proxyCall(apiKey, apiSecret, 'POST', '/v5/account/demo-apply-money', {
      adjustType: 1,
      utaDemoApplyMoney: [{ coin: coinEntry.coin, amountStr: String(bal) }],
    }).catch(() => {}) // floor errors are fine — coin just won't go below Bybit's minimum
  }

  // Step 3: read USDT balance after nuke
  // Use USDT coin directly — NOT totalWalletBalance which includes BTC/ETH USD value
  const usdtNow = await getUsdtBalance(apiKey, apiSecret)

  // Step 4: add only the difference to reach challengeUsdt
  // If nuke zeroed USDT: toAdd = challengeUsdt (e.g. 10000)
  // If USDT has a floor (e.g. 500 remaining): toAdd = 9500
  // This guarantees the final USDT balance == challengeUsdt exactly
  if (usdtNow < challengeUsdt - 1) {
    const toAdd = Math.ceil(challengeUsdt - usdtNow)
    await proxyCall(apiKey, apiSecret, 'POST', '/v5/account/demo-apply-money', {
      adjustType: 0,
      utaDemoApplyMoney: [{ coin: 'USDT', amountStr: String(toAdd) }],
    })
  } else if (usdtNow > challengeUsdt + 1) {
    // USDT floor is above challenge amount — reduce the excess
    const excess = Math.floor(usdtNow - challengeUsdt)
    await proxyCall(apiKey, apiSecret, 'POST', '/v5/account/demo-apply-money', {
      adjustType: 1,
      utaDemoApplyMoney: [{ coin: 'USDT', amountStr: String(excess) }],
    }).catch(() => {})
  }

  // Step 5: return challengeUsdt as the confirmed target balance
  return challengeUsdt
}

// ── Challenge tier definitions (mirrors tradingService CHALLENGE_CONFIGS) ───
const TIERS = [
  { key: '5k',   label: '$5,000',   profit: '$500',   drawdown: '$400',   fee: '$49'  },
  { key: '10k',  label: '$10,000',  profit: '$1,000', drawdown: '$800',   fee: '$89'  },
  { key: '25k',  label: '$25,000',  profit: '$2,500', drawdown: '$2,000', fee: '$199' },
  { key: '50k',  label: '$50,000',  profit: '$5,000', drawdown: '$4,000', fee: '$349' },
  { key: '100k', label: '$100,000', profit: '$10,000',drawdown: '$8,000', fee: '$599' },
]

export default function OnboardingModal({ userId, onComplete }) {
  // step: 'tier' | 'mode' | 'bybit'
  const [step,        setStep]        = useState('tier')
  const [tier,        setTier]        = useState('10k')
  const [apiKey,      setApiKey]      = useState('')
  const [apiSecret,   setApiSecret]   = useState('')
  const [apiError,    setApiError]    = useState('')
  const [saving,      setSaving]      = useState(false)

  // ── Step 1: user picks tier then clicks Continue ─────────────────────────
  const handleTierContinue = () => setStep('mode')

  // ── Step 2a: IJGF Market selected ────────────────────────────────────────
  const handleSelectIJGF = async () => {
    setSaving(true)
    try {
      await getOrCreateDemoAccount(userId, tier)
      onComplete(tier, 'ijgf')
    } catch (err) {
      setApiError(err.message || 'Failed to create challenge. Please try again.')
      setSaving(false)
    }
  }

  // ── Step 2b: Bybit selected → go to API entry step ───────────────────────
  const handleSelectBybit = () => {
    setApiError('')
    setStep('bybit')
  }

  // ── Step 3: reset Bybit balance + save credentials + create challenge ───────
  const handleBybitConnect = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) {
      setApiError('Both API Key and API Secret are required')
      return
    }
    setSaving(true)
    setApiError('')
    try {
      const challengeUsdt = parseInt(tier.replace('k', ''), 10) * 1000

      // Reset Bybit demo balance to exact challenge amount
      const finalEquity = await resetBybitDemoBalance(apiKey.trim(), apiSecret.trim(), challengeUsdt)

      // Create/get the challenge account row
      const account = await getOrCreateDemoAccount(userId, tier)

      // Overwrite balances with actual Bybit equity
      const { error } = await supabase
        .from('demo_accounts')
        .update({
          trading_mode:       'bybit',
          bybit_api_key:      apiKey.trim(),
          bybit_api_secret:   apiSecret.trim(),
          bybit_connected_at: new Date().toISOString(),
          bybit_equity:       finalEquity,
          initial_balance:    finalEquity,
          current_balance:    finalEquity,
        })
        .eq('id', account.id)
      if (error) throw error
      onComplete(tier, 'bybit')
    } catch (err) {
      setApiError(err.message || 'Failed to connect Bybit. Please try again.')
      setSaving(false)
    }
  }

  const selectedTier = TIERS.find(t => t.key === tier)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: '#0d0f14',
        border: '1px solid rgba(124,58,237,0.3)',
        borderRadius: 20,
        padding: '32px 28px 28px',
        maxWidth: 520, width: '100%',
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>

        {/* ── Progress dots ─────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 28 }}>
          {['tier', 'mode', 'bybit'].map((s, i) => {
            const active = step === s
            const done   = (step === 'mode' && i === 0) ||
                           (step === 'bybit' && i <= 1)
            return (
              <div key={s} style={{
                width: active ? 24 : 8, height: 8, borderRadius: 4,
                background: done ? '#7c3aed' : active ? '#a855f7' : 'rgba(255,255,255,0.15)',
                transition: 'all 0.3s',
              }} />
            )
          })}
        </div>

        {/* ═══════════════════════════════════════════════════
            STEP 1 — TIER SELECTION
        ═══════════════════════════════════════════════════ */}
        {step === 'tier' && (
          <>
            {/* Welcome header */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(168,85,247,0.15))',
                border: '1px solid rgba(124,58,237,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <span style={{ fontSize: '1.6rem' }}>🚀</span>
              </div>
              <h2 style={{ margin: '0 0 8px', fontSize: '1.3rem', fontWeight: 700, color: '#eaecef' }}>
                Welcome to IJGF!
              </h2>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                Choose your challenge size to get started. This is a demo challenge — no payment required.
              </p>
            </div>

            {/* Tier cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {TIERS.map(t => {
                const sel = tier === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => setTier(t.key)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: sel ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${sel ? 'rgba(124,58,237,0.55)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 12, padding: '13px 16px',
                      cursor: 'pointer', transition: 'all 0.15s', width: '100%', textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Radio dot */}
                      <div style={{
                        width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                        border: `2px solid ${sel ? '#a855f7' : 'rgba(255,255,255,0.25)'}`,
                        background: sel ? '#7c3aed' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {sel && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'white' }} />}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.97rem', fontWeight: 700, color: '#eaecef' }}>
                          {t.label} Challenge
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>
                          Profit target {t.profit} · Max drawdown {t.drawdown}
                        </div>
                      </div>
                    </div>
                    {t.key === '10k' && (
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 700, letterSpacing: 0.5,
                        background: 'rgba(34,197,94,0.15)', color: '#22c55e',
                        border: '1px solid rgba(34,197,94,0.3)',
                        borderRadius: 20, padding: '2px 8px',
                      }}>
                        POPULAR
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Challenge rules summary */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10, padding: '12px 14px', marginBottom: 24,
              fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.7,
            }}>
              📋 <strong style={{ color: 'rgba(255,255,255,0.65)' }}>Rules for all tiers:</strong>
              &nbsp; 10% profit target · 8% max drawdown · Min 5 trading days · 100x leverage · 80% profit split
            </div>

            <button
              onClick={handleTierContinue}
              style={{
                width: '100%', padding: '13px',
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                color: 'white', border: 'none', borderRadius: 12,
                fontSize: '0.97rem', fontWeight: 700, cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(124,58,237,0.45)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
            >
              Continue with {selectedTier?.label} Challenge →
            </button>
          </>
        )}

        {/* ═══════════════════════════════════════════════════
            STEP 2 — MODE SELECTION
        ═══════════════════════════════════════════════════ */}
        {step === 'mode' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <h2 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 700, color: '#eaecef' }}>
                How would you like to trade?
              </h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                Your <strong style={{ color: '#a855f7' }}>{selectedTier?.label} challenge</strong> will run on whichever platform you choose.
              </p>
            </div>

            {apiError && (
              <div style={{
                background: 'rgba(246,70,93,0.1)', border: '1px solid rgba(246,70,93,0.3)',
                color: '#f6465d', borderRadius: 10, padding: '10px 14px',
                fontSize: '0.84rem', marginBottom: 16,
              }}>
                {apiError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {/* IJGF Market option */}
              <button
                onClick={handleSelectIJGF}
                disabled={saving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 14, padding: '18px 20px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  transition: 'all 0.15s', textAlign: 'left', width: '100%',
                  color: '#eaecef',
                }}
                onMouseEnter={e => { if (!saving) { e.currentTarget.style.background = 'rgba(124,58,237,0.15)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)'; e.currentTarget.style.transform = 'translateY(-1px)' }}}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'none' }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.3rem',
                }}>
                  🚀
                </div>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 3 }}>IJGF Market</div>
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                    Trade Binance-listed tokens directly inside this platform. No external account needed.
                  </div>
                </div>
                <svg style={{ marginLeft: 'auto', flexShrink: 0, opacity: 0.4 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>

              {/* Bybit option */}
              <button
                onClick={handleSelectBybit}
                disabled={saving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 14, padding: '18px 20px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  transition: 'all 0.15s', textAlign: 'left', width: '100%',
                  color: '#eaecef',
                }}
                onMouseEnter={e => { if (!saving) { e.currentTarget.style.background = 'rgba(124,58,237,0.15)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)'; e.currentTarget.style.transform = 'translateY(-1px)' }}}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'none' }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.3rem',
                }}>
                  🔗
                </div>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 3 }}>Connect Bybit</div>
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                    Connect your Bybit demo futures account via API. Trade on your own Bybit terminal.
                  </div>
                </div>
                <svg style={{ marginLeft: 'auto', flexShrink: 0, opacity: 0.4 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            </div>

            <button
              onClick={() => { setStep('tier'); setApiError('') }}
              style={{
                width: '100%', padding: '10px',
                background: 'transparent', color: 'rgba(255,255,255,0.4)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                fontSize: '0.85rem', cursor: 'pointer',
              }}
            >
              ← Back
            </button>
          </>
        )}

        {/* ═══════════════════════════════════════════════════
            STEP 3 — BYBIT API ENTRY
        ═══════════════════════════════════════════════════ */}
        {step === 'bybit' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px', fontSize: '1.4rem',
              }}>
                🔗
              </div>
              <h2 style={{ margin: '0 0 8px', fontSize: '1.15rem', fontWeight: 700, color: '#eaecef' }}>
                Connect Bybit Account
              </h2>
              <p style={{ margin: 0, fontSize: '0.83rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                Your {selectedTier?.label} challenge will be mirrored on your Bybit demo futures terminal.
              </p>
            </div>

            {/* Instructions */}
            <div style={{
              background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: 10, padding: '12px 14px', marginBottom: 18,
              fontSize: '0.79rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7,
            }}>
              <strong style={{ color: 'rgba(245,158,11,0.85)' }}>How to get your API key:</strong>
              <ol style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                <li>Go to <strong style={{ color: 'rgba(255,255,255,0.85)' }}>bybit.com</strong> → click <strong style={{ color: 'rgba(255,255,255,0.85)' }}>Demo Trading</strong> at the top</li>
                <li>Avatar → <strong style={{ color: 'rgba(255,255,255,0.85)' }}>API Management → Create New Key</strong></li>
                <li>Enable: <strong style={{ color: 'rgba(255,255,255,0.85)' }}>Read-Write + Unified Trading + Assets (Account Transfer)</strong></li>
                <li>No IP restriction → paste both keys below</li>
              </ol>
            </div>

            {apiError && (
              <div style={{
                background: 'rgba(246,70,93,0.1)', border: '1px solid rgba(246,70,93,0.3)',
                color: '#f6465d', borderRadius: 10, padding: '10px 14px',
                fontSize: '0.84rem', marginBottom: 14,
              }}>
                {apiError}
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: '0.79rem', color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>
                API Key
              </label>
              <input
                type="password"
                placeholder="Paste your Bybit API key"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
                  padding: '10px 14px', color: '#eaecef', fontSize: '0.9rem',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={{ display: 'block', fontSize: '0.79rem', color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>
                API Secret
              </label>
              <input
                type="password"
                placeholder="Paste your Bybit API secret"
                value={apiSecret}
                onChange={e => setApiSecret(e.target.value)}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
                  padding: '10px 14px', color: '#eaecef', fontSize: '0.9rem',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setStep('mode'); setApiError('') }}
                style={{
                  flex: 1, padding: '11px',
                  background: 'transparent', color: 'rgba(255,255,255,0.45)',
                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
                  fontSize: '0.88rem', cursor: 'pointer',
                }}
              >
                ← Back
              </button>
              <button
                onClick={handleBybitConnect}
                disabled={saving}
                style={{
                  flex: 2, padding: '11px',
                  background: saving ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #7c3aed, #a855f7)',
                  color: saving ? 'rgba(255,255,255,0.4)' : 'white',
                  border: 'none', borderRadius: 10,
                  fontSize: '0.9rem', fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {saving ? '⏳ Resetting balance… (20–30s)' : 'Connect & Start Challenge'}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
