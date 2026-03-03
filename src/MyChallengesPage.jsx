/**
 * MyChallengesPage.jsx
 *
 * Shows all challenges for the current user: active, passed, and failed.
 * Each card has circular progress gauges for the key metrics.
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// ── Circular gauge ─────────────────────────────────────────────────────────
function CircularGauge({ value, max, label, color = '#7C3AED', size = 72, strokeWidth = 6, invert = false }) {
  const radius  = (size - strokeWidth) / 2
  const circum  = 2 * Math.PI * radius
  const pct     = max > 0 ? Math.min(Math.abs(value) / Math.abs(max), 1) : 0
  // For drawdown: fill is red when any value used, normal fill otherwise
  const fillPct = invert ? pct : pct
  const dash    = fillPct * circum
  const gap     = circum - dash

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={strokeWidth}
        />
        {/* Fill */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${gap}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      {/* Centre label */}
      <div style={{
        position: 'absolute',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        lineHeight: 1.2,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#eaecef' }}>
          {typeof value === 'number' ? (value % 1 === 0 ? value : value.toFixed(1)) : value}
        </span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{label}</span>
      </div>
    </div>
  )
}

// ── Gauge wrapper with centred overlay ────────────────────────────────────
function Gauge({ value, max, label, color, size = 72, invert }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularGauge value={value} max={max} label={label} color={color} size={size} invert={invert} />
    </div>
  )
}

// ── Challenge card ─────────────────────────────────────────────────────────
function ChallengeCard({ account, onConnect }) {
  const isPassed  = account.status === 'passed'
  const isFailed  = account.status === 'failed'
  const isActive  = account.status === 'active'

  const initialBalance  = account.initial_balance  ?? 10000
  const currentBalance  = account.balance          ?? initialBalance
  const profitAbs       = currentBalance - initialBalance
  const profitPct       = (profitAbs / initialBalance) * 100
  const dailyLoss       = account.daily_loss        ?? 0
  const maxDrawdownUsed = account.max_drawdown_used ?? 0
  const tradingDays     = account.trading_days      ?? 0

  // Challenge params (from spec: 1-step challenge)
  const profitTarget    = initialBalance * 0.10          // 10%
  const dailyLossLimit  = initialBalance * 0.04          // 4%
  const maxDrawdown     = initialBalance * 0.06          // 6%

  const challengeLabel  = account.challenge_type?.replace('k', 'K') ?? '10K'
  const createdAt       = account.created_at ? new Date(account.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

  const statusColor = isPassed ? '#22c55e' : isFailed ? '#f6465d' : '#f59e0b'
  const statusLabel = isPassed ? 'Passed' : isFailed ? 'Failed' : 'Active'

  const profitColor = profitAbs >= 0 ? '#22c55e' : '#f6465d'
  const drawdownColor = maxDrawdownUsed > maxDrawdown * 0.75 ? '#f6465d' : maxDrawdownUsed > maxDrawdown * 0.5 ? '#f59e0b' : '#7C3AED'

  return (
    <div style={{
      background: 'rgba(13,15,20,0.8)',
      border: `1px solid ${isPassed ? 'rgba(34,197,94,0.25)' : isFailed ? 'rgba(246,70,93,0.2)' : 'rgba(124,58,237,0.2)'}`,
      borderRadius: 16,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
    }}>
      {/* Card header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#eaecef' }}>
              ${(initialBalance / 1000).toFixed(0)}K Challenge
            </span>
            <span style={{
              fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px',
              borderRadius: 20, letterSpacing: 0.5,
              background: isPassed ? 'rgba(34,197,94,0.12)' : isFailed ? 'rgba(246,70,93,0.12)' : 'rgba(245,158,11,0.12)',
              color: statusColor,
              border: `1px solid ${isPassed ? 'rgba(34,197,94,0.3)' : isFailed ? 'rgba(246,70,93,0.3)' : 'rgba(245,158,11,0.3)'}`,
            }}>
              {statusLabel}
            </span>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>
            Started {createdAt}
          </span>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: profitColor }}>
            {profitAbs >= 0 ? '+' : ''}${profitAbs.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
            {profitAbs >= 0 ? '+' : ''}{profitPct.toFixed(2)}% P&L
          </div>
        </div>
      </div>

      {/* Gauges row */}
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Gauge value={tradingDays} max={30} label="days" color="#7C3AED" size={72} />
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}>Trading Days</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Gauge value={Math.abs(dailyLoss)} max={dailyLossLimit} label="daily" color={dailyLoss > dailyLossLimit * 0.75 ? '#f6465d' : '#f59e0b'} size={72} invert />
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}>Daily Loss</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Gauge value={Math.abs(maxDrawdownUsed)} max={maxDrawdown} label="drawdown" color={drawdownColor} size={72} invert />
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}>Max DD Used</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Gauge value={Math.max(0, profitAbs)} max={profitTarget} label="profit" color={profitColor} size={72} />
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}>Profit Target</span>
        </div>
      </div>

      {/* Specs chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {[
          { label: 'Account Size', value: `$${(initialBalance).toLocaleString()}` },
          { label: 'Profit Target', value: '10%' },
          { label: 'Max Drawdown', value: '6%' },
          { label: 'Daily Limit', value: '4%' },
          { label: 'Leverage', value: '8x BTC/ETH · 5x Alts' },
          { label: 'Profit Split', value: '80%' },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 8, padding: '4px 10px',
            fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)',
          }}>
            <span style={{ color: 'rgba(255,255,255,0.35)', marginRight: 4 }}>{label}:</span>
            <span style={{ color: '#eaecef', fontWeight: 600 }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Balance row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        padding: '12px 0',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {[
          { label: 'Current Balance', value: `$${currentBalance.toFixed(2)}`, color: '#eaecef' },
          { label: 'Initial Balance', value: `$${initialBalance.toLocaleString()}`, color: 'rgba(255,255,255,0.5)' },
          { label: 'Profit Target', value: `$${(profitTarget).toFixed(0)}`, color: '#7C3AED' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}>{label}</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Action */}
      {isPassed && (
        <button
          onClick={() => onConnect(account)}
          style={{
            width: '100%', padding: '11px',
            background: 'linear-gradient(135deg, #7C3AED, #a855f7)',
            color: 'white', border: 'none', borderRadius: 10,
            fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(124,58,237,0.4)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
        >
          Set Up Funded Account
        </button>
      )}
      {isFailed && (
        <div style={{
          textAlign: 'center', fontSize: '0.82rem',
          color: 'rgba(255,255,255,0.35)', padding: '8px 0',
        }}>
          Challenge ended · Start a new one from the Market tab
        </div>
      )}
    </div>
  )
}

// ── Exchange connection modal ──────────────────────────────────────────────
const EXCHANGES = [
  { id: 'bybit',   name: 'Bybit',   pairs: 300 },
  { id: 'binance', name: 'Binance', pairs: 400 },
  { id: 'bitget',  name: 'Bitget',  pairs: 200 },
]

function ConnectExchangeModal({ account, onClose }) {
  const [step, setStep] = useState(1) // 1 = select exchange, 2 = enter keys
  const [selectedExchange, setSelectedExchange] = useState(null)
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleConfirmExchange = () => {
    if (!selectedExchange) return
    setStep(2)
  }

  const handleConnect = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) {
      setError('Both API Key and API Secret are required')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const { error: dbErr } = await supabase
        .from('demo_accounts')
        .update({
          connected_exchange: selectedExchange.id,
          exchange_api_key:    apiKey.trim(),
          // Never log the secret client-side — send to edge function in production
          // For now we store a placeholder so the UI shows "connected"
          exchange_connected_at: new Date().toISOString(),
        })
        .eq('id', account.id)
      if (dbErr) throw dbErr
      onClose(true)
    } catch (err) {
      setError(err.message || 'Failed to save exchange connection')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(false) }}
    >
      <div style={{
        background: '#0d0f14', border: '1px solid rgba(124,58,237,0.25)',
        borderRadius: 18, padding: '28px 28px 24px', maxWidth: 480, width: '100%',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#eaecef' }}>
              {step === 1 ? 'Select Your Exchange' : `Connect ${selectedExchange?.name}`}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
              {step === 1
                ? 'Your funded account will be allocated on this exchange.'
                : 'Enter read-only API credentials. Trade permissions required.'}
            </p>
          </div>
          <button
            onClick={() => onClose(false)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {error && (
          <div style={{
            background: 'rgba(246,70,93,0.1)', border: '1px solid rgba(246,70,93,0.3)',
            color: '#f6465d', borderRadius: 8, padding: '10px 14px',
            fontSize: '0.85rem', marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {step === 1 && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {EXCHANGES.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => setSelectedExchange(ex)}
                  style={{
                    background: selectedExchange?.id === ex.id ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selectedExchange?.id === ex.id ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 12, padding: '14px 16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                    color: 'white',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 2 }}>{ex.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>{ex.pairs}+ pairs</div>
                  </div>
                  {selectedExchange?.id === ex.id && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.5">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>

            <div style={{
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: 8, padding: '10px 14px', fontSize: '0.78rem',
              color: 'rgba(255,255,255,0.55)', marginBottom: 20, lineHeight: 1.5,
            }}>
              ⚠ Your exchange selection is locked for this funding phase. You cannot change exchanges until this funding phase ends.
            </div>

            <button
              onClick={handleConfirmExchange}
              disabled={!selectedExchange}
              style={{
                width: '100%', padding: '12px',
                background: selectedExchange ? '#7C3AED' : 'rgba(255,255,255,0.06)',
                color: selectedExchange ? 'white' : 'rgba(255,255,255,0.3)',
                border: 'none', borderRadius: 10,
                fontSize: '0.95rem', fontWeight: 600,
                cursor: selectedExchange ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
              }}
            >
              Confirm Selection
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ marginBottom: 14, padding: '12px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              Create a <strong style={{ color: '#eaecef' }}>read-only + trade permissions</strong> API key on {selectedExchange?.name}.
              Do not enable withdrawal permissions.
            </div>

            {[
              { label: 'API Key', value: apiKey, set: setApiKey, placeholder: 'Paste your API key here' },
              { label: 'API Secret', value: apiSecret, set: setApiSecret, placeholder: 'Paste your API secret here' },
            ].map(({ label, value, set, placeholder }) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                  {label}
                </label>
                <input
                  type="password"
                  value={value}
                  onChange={e => set(e.target.value)}
                  placeholder={placeholder}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                    padding: '10px 14px', color: 'white', fontSize: '0.9rem',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1, padding: '11px',
                  background: 'transparent', color: 'rgba(255,255,255,0.5)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                  fontSize: '0.9rem', cursor: 'pointer',
                }}
              >
                Back
              </button>
              <button
                onClick={handleConnect}
                disabled={submitting}
                style={{
                  flex: 2, padding: '11px',
                  background: '#7C3AED', color: 'white',
                  border: 'none', borderRadius: 10,
                  fontSize: '0.9rem', fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Connecting...' : 'Connect Exchange'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function MyChallengesPage({ userId }) {
  const [challenges, setChallenges] = useState([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState('active') // 'active' | 'passed' | 'failed'
  const [connectingAccount, setConnectingAccount] = useState(null)

  const loadChallenges = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('demo_accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[MyChallenges] load error:', error)
      setChallenges([])
    } else {
      setChallenges(data ?? [])
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { loadChallenges() }, [loadChallenges])

  const filtered = challenges.filter(c => {
    if (tab === 'active') return c.status === 'active'
    if (tab === 'passed') return c.status === 'passed'
    if (tab === 'failed') return c.status === 'failed'
    return true
  })

  const counts = {
    active: challenges.filter(c => c.status === 'active').length,
    passed: challenges.filter(c => c.status === 'passed').length,
    failed: challenges.filter(c => c.status === 'failed').length,
  }

  return (
    <div style={{ padding: '24px 24px 40px', maxWidth: 900, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#eaecef' }}>My Challenges</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>
            Track your evaluation progress and funded accounts
          </p>
        </div>
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 0 }}>
        {[
          { id: 'active', label: 'Active',  color: '#f59e0b' },
          { id: 'passed', label: 'Passed',  color: '#22c55e' },
          { id: 'failed', label: 'Failed',  color: '#f6465d' },
        ].map(({ id, label, color }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 16px', borderRadius: '8px 8px 0 0',
              fontSize: '0.875rem', fontWeight: tab === id ? 600 : 400,
              color: tab === id ? color : 'rgba(255,255,255,0.45)',
              borderBottom: tab === id ? `2px solid ${color}` : '2px solid transparent',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {label}
            {counts[id] > 0 && (
              <span style={{
                background: tab === id ? `${color}22` : 'rgba(255,255,255,0.07)',
                color: tab === id ? color : 'rgba(255,255,255,0.4)',
                fontSize: '0.7rem', fontWeight: 700, padding: '1px 7px',
                borderRadius: 20,
              }}>
                {counts[id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'rgba(255,255,255,0.35)', fontSize: '0.9rem' }}>
          Loading challenges...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)',
          borderRadius: 16, padding: '48px 24px', textAlign: 'center',
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" style={{ marginBottom: 16 }}>
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
            <path d="M4 22h16"/>
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
          </svg>
          <p style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>
            No {tab} challenges
          </p>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.3)' }}>
            {tab === 'active' ? 'Start a challenge from the Market tab to begin your evaluation.' : `You have no ${tab} challenges yet.`}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {filtered.map(acc => (
            <ChallengeCard
              key={acc.id}
              account={acc}
              onConnect={setConnectingAccount}
            />
          ))}
        </div>
      )}

      {/* Exchange connection modal */}
      {connectingAccount && (
        <ConnectExchangeModal
          account={connectingAccount}
          onClose={(saved) => {
            setConnectingAccount(null)
            if (saved) loadChallenges()
          }}
        />
      )}
    </div>
  )
}
