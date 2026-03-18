/**
 * OnboardingModal.jsx
 *
 * Shown to new users immediately after completing profile setup.
 * Four steps:
 *   1. accountMode     — Demo / Live selection (Live disabled)
 *   2. challengeSelect — Challenge type toggle + account size grid
 *   3. mode            — IJGF Market or Bybit API
 *   4. bybit           — Bybit API key entry (only if Bybit chosen in step 3)
 *
 * On completion calls onComplete(challengeTypeKey, mode) where
 * challengeTypeKey is the compound key: '10k' (1-step) or '10k_2step' (2-step).
 *
 * The modal cannot be dismissed without completing the flow.
 */

import { useState } from 'react'
import { Rocket, Link2 } from 'lucide-react'
import { supabase } from './supabase'
import { getOrCreateDemoAccount, CHALLENGE_PRICING, CHALLENGE_CONFIGS_2STEP } from './tradingService'
import { ChallengeAndTierSelector, AccountModeSelector } from './ChallengeSelectSteps'

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
      throw new Error('Invalid API credentials. Create the key inside Demo Trading mode on bybit.com (not testnet).')
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
  const wallet = await proxyCall(apiKey, apiSecret, 'GET', '/v5/account/wallet-balance', { accountType: 'UNIFIED' })
  const coins = wallet?.list?.[0]?.coin ?? []

  for (const coinEntry of coins) {
    const bal = parseFloat(coinEntry.walletBalance ?? 0)
    if (bal <= 0) continue
    await proxyCall(apiKey, apiSecret, 'POST', '/v5/account/demo-apply-money', {
      adjustType: 1,
      utaDemoApplyMoney: [{ coin: coinEntry.coin, amountStr: String(bal) }],
    }).catch(() => {})
  }

  const usdtNow = await getUsdtBalance(apiKey, apiSecret)

  if (usdtNow < challengeUsdt - 1) {
    const toAdd = Math.ceil(challengeUsdt - usdtNow)
    await proxyCall(apiKey, apiSecret, 'POST', '/v5/account/demo-apply-money', {
      adjustType: 0,
      utaDemoApplyMoney: [{ coin: 'USDT', amountStr: String(toAdd) }],
    })
  } else if (usdtNow > challengeUsdt + 1) {
    const excess = Math.floor(usdtNow - challengeUsdt)
    await proxyCall(apiKey, apiSecret, 'POST', '/v5/account/demo-apply-money', {
      adjustType: 1,
      utaDemoApplyMoney: [{ coin: 'USDT', amountStr: String(excess) }],
    }).catch(() => {})
  }

  return challengeUsdt
}

// Step order for progress dots (bybit is a sub-step of mode)
const MAIN_STEPS = ['accountMode', 'challengeSelect', 'mode', 'bybit']

export default function OnboardingModal({ userId, onComplete }) {
  // step: 'accountMode' | 'challengeSelect' | 'mode' | 'bybit'
  const [step,             setStep]             = useState('accountMode')
  const [accountMode,      setAccountMode]      = useState('demo')
  const [challengeVariant, setChallengeVariant] = useState('1step')
  const [tier,             setTier]             = useState('10k')
  const [apiKey,           setApiKey]           = useState('')
  const [apiSecret,        setApiSecret]        = useState('')
  const [apiError,         setApiError]         = useState('')
  const [saving,           setSaving]           = useState(false)

  // Compound key: '10k' for 1-step, '10k_2step' for 2-step
  const challengeTypeKey = tier + (challengeVariant === '2step' ? '_2step' : '')

  // ── Step handlers ─────────────────────────────────────────────────────────
  const handleAccountModeContinue    = () => setStep('challengeSelect')
  const handleChallengeSelectContinue = () => setStep('mode')

  // ── IJGF Market selected ──────────────────────────────────────────────────
  const handleSelectIJGF = async () => {
    setSaving(true)
    try {
      await getOrCreateDemoAccount(userId, challengeTypeKey)
      onComplete(challengeTypeKey, 'ijgf')
    } catch (err) {
      setApiError(err.message || 'Failed to create challenge. Please try again.')
      setSaving(false)
    }
  }

  // ── Bybit selected → go to API entry step ─────────────────────────────────
  const handleSelectBybit = () => {
    setApiError('')
    setStep('bybit')
  }

  // ── Bybit: reset balance + save credentials + create challenge ────────────
  const handleBybitConnect = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) {
      setApiError('Both API Key and API Secret are required')
      return
    }
    setSaving(true)
    setApiError('')
    try {
      const challengeUsdt = parseInt(tier.replace('k', ''), 10) * 1000
      const finalEquity   = await resetBybitDemoBalance(apiKey.trim(), apiSecret.trim(), challengeUsdt)
      const account       = await getOrCreateDemoAccount(userId, challengeTypeKey)

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
      onComplete(challengeTypeKey, 'bybit')
    } catch (err) {
      setApiError(err.message || 'Failed to connect Bybit. Please try again.')
      setSaving(false)
    }
  }

  // For display labels in mode/bybit steps
  const tierLabel = `$${parseInt(tier.replace('k', ''), 10).toLocaleString()},000`

  // Progress dot helpers
  const stepIndex = MAIN_STEPS.indexOf(step)
  const isDone    = (i) => i < stepIndex
  const isActive  = (i) => i === stepIndex

  return (
    <div className="onb-overlay">
      <div className="onb-card">

        {/* ── Progress dots ─────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 28 }}>
          {MAIN_STEPS.map((s, i) => (
            <div key={s} className={`onb-dot${isDone(i) ? ' onb-dot--done' : isActive(i) ? ' onb-dot--active' : ''}`} />
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════
            STEP 1 — ACCOUNT MODE
        ═══════════════════════════════════════════════════ */}
        {step === 'accountMode' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div className="onb-step-icon onb-step-icon--purple">
                <Rocket size={28} strokeWidth={1.75} />
              </div>
              <h2 className="onb-title">Welcome to IJGF!</h2>
              <p className="onb-subtitle">Select your account mode to get started.</p>
            </div>

            <AccountModeSelector value={accountMode} onChange={setAccountMode} />

            <button className="onb-btn-primary" onClick={handleAccountModeContinue}>
              Continue →
            </button>
          </>
        )}

        {/* ═══════════════════════════════════════════════════
            STEP 2 — CHALLENGE TYPE + TIER (combined)
        ═══════════════════════════════════════════════════ */}
        {step === 'challengeSelect' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <h2 className="onb-title">Choose Your Challenge</h2>
              <p className="onb-subtitle">Select challenge type and account size.</p>
            </div>

            <ChallengeAndTierSelector
              selectedChallengeType={challengeVariant}
              setSelectedChallengeType={setChallengeVariant}
              selectedTier={tier}
              setSelectedTier={setTier}
            />

            <button className="onb-btn-primary" style={{ marginTop: 18 }} onClick={handleChallengeSelectContinue}>
              Continue with {tier.toUpperCase()} {challengeVariant === '2step' ? '2-Step' : '1-Step'} →
            </button>

            <button className="onb-btn-back" onClick={() => setStep('accountMode')}>
              ← Back
            </button>
          </>
        )}

        {/* ═══════════════════════════════════════════════════
            STEP 3 — MODE SELECTION
        ═══════════════════════════════════════════════════ */}
        {step === 'mode' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <h2 className="onb-title">How would you like to trade?</h2>
              <p className="onb-subtitle">
                Your <strong style={{ color: 'var(--accent-light, #a855f7)' }}>{tierLabel} challenge</strong> will run on whichever platform you choose.
              </p>
            </div>

            {apiError && <div className="onb-error">{apiError}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {/* IJGF Market option */}
              <button
                className="onb-mode-btn"
                onClick={handleSelectIJGF}
                disabled={saving}
                style={{ opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                <div className="onb-mode-icon onb-mode-icon--purple">
                  <Rocket size={20} strokeWidth={1.75} />
                </div>
                <div>
                  <div className="onb-mode-name">IJGF Market</div>
                  <div className="onb-mode-desc">
                    Trade Binance-listed tokens directly inside this platform. No external account needed.
                  </div>
                </div>
                <svg className="onb-mode-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>

              {/* Bybit option */}
              <button
                className="onb-mode-btn"
                onClick={handleSelectBybit}
                disabled={saving}
                style={{ opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                <div className="onb-mode-icon onb-mode-icon--amber">
                  <Link2 size={20} strokeWidth={1.75} />
                </div>
                <div>
                  <div className="onb-mode-name">Connect Bybit</div>
                  <div className="onb-mode-desc">
                    Connect your Bybit demo futures account via API. Trade on your own Bybit terminal.
                  </div>
                </div>
                <svg className="onb-mode-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            </div>

            <button className="onb-btn-back" onClick={() => { setStep('challengeSelect'); setApiError('') }}>
              ← Back
            </button>
          </>
        )}

        {/* ═══════════════════════════════════════════════════
            STEP 4 — BYBIT API ENTRY
        ═══════════════════════════════════════════════════ */}
        {step === 'bybit' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div className="onb-step-icon onb-step-icon--amber">
                <Link2 size={22} strokeWidth={1.75} />
              </div>
              <h2 className="onb-title">Connect Bybit Account</h2>
              <p className="onb-subtitle">
                Your {tierLabel} challenge will be mirrored on your Bybit demo futures terminal.
              </p>
            </div>

            <div className="onb-bybit-info">
              <strong className="onb-bybit-info-heading">How to get your API key:</strong>
              <ol style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                <li>Go to <strong className="onb-bybit-em">bybit.com</strong> → click <strong className="onb-bybit-em">Demo Trading</strong> at the top</li>
                <li>Avatar → <strong className="onb-bybit-em">API Management → Create New Key</strong></li>
                <li>Enable: <strong className="onb-bybit-em">Read-Write + Unified Trading + Assets (Account Transfer)</strong></li>
                <li>No IP restriction → paste both keys below</li>
              </ol>
            </div>

            {apiError && <div className="onb-error">{apiError}</div>}

            <div style={{ marginBottom: 12 }}>
              <label className="onb-input-label">API Key</label>
              <input
                className="onb-input"
                type="password"
                placeholder="Paste your Bybit API key"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label className="onb-input-label">API Secret</label>
              <input
                className="onb-input"
                type="password"
                placeholder="Paste your Bybit API secret"
                value={apiSecret}
                onChange={e => setApiSecret(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="onb-btn-back onb-btn-back--inline" onClick={() => { setStep('mode'); setApiError('') }}>
                ← Back
              </button>
              <button
                className="onb-btn-primary onb-btn-primary--flex"
                onClick={handleBybitConnect}
                disabled={saving}
                style={saving ? { background: 'var(--bg-card-hover, rgba(255,255,255,0.08))', color: 'var(--text-muted)', cursor: 'not-allowed' } : undefined}
              >
                {saving ? '⏳ Resetting balance… (20–30s)' : 'Connect & Start Challenge'}
              </button>
            </div>
          </>
        )}

      </div>

      <style>{`
        /* ── Overlay ─────────────────────────────────────────── */
        .onb-overlay {
          position: fixed;
          inset: 0;
          z-index: 9000;
          background: rgba(0,0,0,0.65);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        /* ── Card ────────────────────────────────────────────── */
        .onb-card {
          background: var(--bg-card-solid);
          border: 1px solid var(--border-accent);
          border-radius: 20px;
          padding: 32px 28px 28px;
          max-width: 520px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 24px 64px rgba(0,0,0,0.35);
          scrollbar-width: thin;
          scrollbar-color: var(--border-color) transparent;
        }

        /* ── Progress dots ───────────────────────────────────── */
        .onb-dot {
          width: 8px;
          height: 8px;
          border-radius: 4px;
          background: var(--border-color);
          transition: all 0.3s;
        }
        .onb-dot--done   { background: var(--accent-primary); }
        .onb-dot--active { width: 24px; background: var(--accent-light, #a855f7); }

        /* ── Step icon ───────────────────────────────────────── */
        .onb-step-icon {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
        }
        .onb-step-icon--purple {
          background: rgba(124,58,237,0.15);
          border: 1px solid rgba(124,58,237,0.4);
          color: var(--accent-light, #a855f7);
        }
        .onb-step-icon--amber {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: rgba(245,158,11,0.12);
          border: 1px solid rgba(245,158,11,0.3);
          color: #f59e0b;
        }

        /* ── Typography ──────────────────────────────────────── */
        .onb-title {
          margin: 0 0 8px;
          font-size: 1.3rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .onb-subtitle {
          margin: 0;
          font-size: 0.88rem;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        /* ── Buttons ─────────────────────────────────────────── */
        .onb-btn-primary {
          width: 100%;
          padding: 13px;
          margin-top: 20px;
          background: linear-gradient(135deg, #7c3aed, #a855f7);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 0.97rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }
        .onb-btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(124,58,237,0.45);
        }
        .onb-btn-primary--flex { flex: 2; margin-top: 0; width: auto; }

        .onb-btn-back {
          width: 100%;
          padding: 10px;
          margin-top: 10px;
          background: transparent;
          color: var(--text-muted);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.15s;
        }
        .onb-btn-back:hover { border-color: var(--border-accent); color: var(--text-secondary); }
        .onb-btn-back--inline { flex: 1; margin-top: 0; width: auto; padding: 11px; }

        /* ── Error box ───────────────────────────────────────── */
        .onb-error {
          background: rgba(246,70,93,0.1);
          border: 1px solid rgba(246,70,93,0.3);
          color: #f6465d;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 0.84rem;
          margin-bottom: 16px;
        }

        /* ── Mode buttons ────────────────────────────────────── */
        .onb-mode-btn {
          display: flex;
          align-items: center;
          gap: 16px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 14px;
          padding: 18px 20px;
          transition: all 0.15s;
          text-align: left;
          width: 100%;
          color: var(--text-primary);
        }
        .onb-mode-btn:hover:not(:disabled) {
          background: rgba(124,58,237,0.1);
          border-color: rgba(124,58,237,0.45);
          transform: translateY(-1px);
        }

        .onb-mode-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .onb-mode-icon--purple {
          background: rgba(124,58,237,0.15);
          border: 1px solid rgba(124,58,237,0.3);
          color: var(--accent-light, #a855f7);
        }
        .onb-mode-icon--amber {
          background: rgba(245,158,11,0.12);
          border: 1px solid rgba(245,158,11,0.25);
          color: #f59e0b;
        }

        .onb-mode-name {
          font-size: 1rem;
          font-weight: 700;
          margin-bottom: 3px;
          color: var(--text-primary);
        }
        .onb-mode-desc {
          font-size: 0.78rem;
          color: var(--text-muted);
          line-height: 1.5;
        }
        .onb-mode-chevron {
          margin-left: auto;
          flex-shrink: 0;
          opacity: 0.35;
          color: var(--text-secondary);
        }

        /* ── Bybit info box ──────────────────────────────────── */
        .onb-bybit-info {
          background: rgba(245,158,11,0.07);
          border: 1px solid rgba(245,158,11,0.2);
          border-radius: 10px;
          padding: 12px 14px;
          margin-bottom: 18px;
          font-size: 0.79rem;
          color: var(--text-secondary);
          line-height: 1.7;
        }
        .onb-bybit-info-heading {
          color: #f59e0b;
        }
        .onb-bybit-em {
          color: var(--text-primary);
        }

        /* ── API inputs ──────────────────────────────────────── */
        .onb-input-label {
          display: block;
          font-size: 0.79rem;
          color: var(--text-muted);
          margin-bottom: 6px;
        }
        .onb-input {
          width: 100%;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 10px 14px;
          color: var(--text-primary);
          font-size: 0.9rem;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s;
          font-family: inherit;
        }
        .onb-input:focus {
          border-color: var(--border-accent);
        }
        .onb-input::placeholder {
          color: var(--text-muted);
        }
      `}</style>
    </div>
  )
}
