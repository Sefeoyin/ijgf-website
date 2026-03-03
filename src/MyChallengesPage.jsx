/**
 * MyChallengesPage.jsx
 *
 * Shows all challenges for the current user: active, passed, and failed.
 * Each card has circular progress gauges for the key metrics.
 *
 * Fully themed: all inline styles use the `t` token object derived from
 * ThemeContext so the page renders correctly in both night and light modes.
 */

import { useState, useEffect, useCallback, useContext } from 'react'
import { supabase } from './supabase'
import { ThemeContext } from './ThemeContext'

// ── Theme token factory ────────────────────────────────────────────────────
// Every color used in this file is derived from here.
// No hardcoded rgba(255,255,255,...) or dark hex values appear outside this function.
function useTokens() {
  const { theme } = useContext(ThemeContext)
  const dark = theme === 'night'
  return {
    // Backgrounds
    cardBg:        dark ? 'rgba(13,15,20,0.85)'    : '#ffffff',
    modalBg:       dark ? '#0d0f14'                 : '#ffffff',
    chipBg:        dark ? 'rgba(255,255,255,0.04)'  : 'rgba(0,0,0,0.04)',
    inputBg:       dark ? 'rgba(255,255,255,0.05)'  : 'rgba(0,0,0,0.04)',
    emptyBg:       dark ? 'rgba(255,255,255,0.02)'  : 'rgba(0,0,0,0.02)',
    infoBg:        'rgba(245,158,11,0.08)',
    hintBg:        dark ? 'rgba(255,255,255,0.04)'  : 'rgba(0,0,0,0.04)',
    exBtnBg:       dark ? 'rgba(255,255,255,0.03)'  : 'rgba(0,0,0,0.03)',
    exBtnBgActive: 'rgba(124,58,237,0.15)',
    disabledBtnBg: dark ? 'rgba(255,255,255,0.06)'  : 'rgba(0,0,0,0.07)',
    // Borders
    border:        dark ? 'rgba(255,255,255,0.07)'  : 'rgba(0,0,0,0.1)',
    borderLg:      dark ? 'rgba(255,255,255,0.1)'   : 'rgba(0,0,0,0.15)',
    divider:       dark ? 'rgba(255,255,255,0.06)'  : 'rgba(0,0,0,0.08)',
    emptyBorder:   dark ? 'rgba(255,255,255,0.08)'  : 'rgba(0,0,0,0.12)',
    exBtnBorder:   dark ? 'rgba(255,255,255,0.08)'  : 'rgba(0,0,0,0.12)',
    tabBorder:     dark ? 'rgba(255,255,255,0.06)'  : 'rgba(0,0,0,0.1)',
    infoBorder:    'rgba(245,158,11,0.2)',
    // Text
    textPrimary:   dark ? '#eaecef'                 : '#0f172a',
    textSecondary: dark ? 'rgba(255,255,255,0.55)'  : 'rgba(0,0,0,0.6)',
    textMuted:     dark ? 'rgba(255,255,255,0.4)'   : 'rgba(0,0,0,0.45)',
    textFaint:     dark ? 'rgba(255,255,255,0.35)'  : 'rgba(0,0,0,0.38)',
    textVeryFaint: dark ? 'rgba(255,255,255,0.3)'   : 'rgba(0,0,0,0.32)',
    textGaugeLabel:dark ? 'rgba(255,255,255,0.45)'  : 'rgba(0,0,0,0.5)',
    textInactive:  dark ? 'rgba(255,255,255,0.45)'  : 'rgba(0,0,0,0.45)',
    textDisabled:  dark ? 'rgba(255,255,255,0.3)'   : 'rgba(0,0,0,0.3)',
    textInput:     dark ? '#ffffff'                 : '#0f172a',
    textExBtn:     dark ? '#ffffff'                 : '#0f172a',
    textInfo:      dark ? 'rgba(255,255,255,0.55)'  : 'rgba(0,0,0,0.6)',
    // Gauge SVG track
    gaugeTrack:    dark ? 'rgba(255,255,255,0.07)'  : 'rgba(0,0,0,0.1)',
    // Misc
    iconMuted:     dark ? 'rgba(255,255,255,0.2)'   : 'rgba(0,0,0,0.2)',
    closeBtnColor: dark ? 'rgba(255,255,255,0.4)'   : 'rgba(0,0,0,0.45)',
    badgeBg:       dark ? 'rgba(255,255,255,0.07)'  : 'rgba(0,0,0,0.08)',
    badgeText:     dark ? 'rgba(255,255,255,0.4)'   : 'rgba(0,0,0,0.4)',
  }
}

// ── Circular gauge SVG ─────────────────────────────────────────────────────
function CircularGauge({ value, max, color = '#7C3AED', size = 72, strokeWidth = 6, trackColor }) {
  const radius = (size - strokeWidth) / 2
  const circum = 2 * Math.PI * radius
  const pct    = max > 0 ? Math.min(Math.abs(value) / Math.abs(max), 1) : 0
  const dash   = pct * circum
  const gap    = circum - dash
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={radius}
        fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
      <circle cx={size/2} cy={size/2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${gap}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.5s ease' }} />
    </svg>
  )
}

// ── Gauge with centred label ───────────────────────────────────────────────
function Gauge({ value, max, label, color, size = 72, trackColor, textPrimary, textGaugeLabel }) {
  const displayVal = typeof value === 'number'
    ? (value % 1 === 0 ? value : value.toFixed(1))
    : value
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularGauge value={value} max={max} color={color} size={size} trackColor={trackColor} />
      <div style={{
        position: 'absolute', display: 'flex', flexDirection: 'column',
        alignItems: 'center', lineHeight: 1.2, pointerEvents: 'none',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>{displayVal}</span>
        <span style={{ fontSize: 9, color: textGaugeLabel, marginTop: 1 }}>{label}</span>
      </div>
    </div>
  )
}

// ── Challenge card ─────────────────────────────────────────────────────────
function ChallengeCard({ account, tradingDaysMap, onConnect }) {
  const t = useTokens()

  const isPassed = account.status === 'passed'
  const isFailed = account.status === 'failed'

  // ── Correct DB field names ──────────────────────────────────────────────
  // current_balance: live balance stored after each trade
  // profit_target:   stored on account row (e.g. 1000 for a $10K account)
  // max_total_drawdown: stored on account row (e.g. 800 for 8% of $10K)
  // min_trading_days:   stored on account row (default 5)
  // trading_days:    NOT a column — counted from demo_trades by distinct day
  const initialBalance   = account.initial_balance   ?? 10000
  const currentBalance   = account.current_balance   ?? initialBalance  // fixed: was account.balance
  const profitAbs        = currentBalance - initialBalance
  const profitPct        = (profitAbs / initialBalance) * 100
  const profitTarget     = account.profit_target     ?? initialBalance * 0.10
  const maxDrawdownLimit = account.max_total_drawdown ?? initialBalance * 0.08  // 8% rule
  const minTradingDays   = account.min_trading_days  ?? 5
  // drawdownUsed = how much equity has dropped below initial (same formula as useDemoTrading)
  const drawdownUsed     = Math.max(0, initialBalance - currentBalance)
  // trading_days from the preloaded map (queried from demo_trades by the parent)
  const tradingDays      = tradingDaysMap[account.id] ?? 0

  const createdAt   = account.created_at
    ? new Date(account.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''
  const statusColor = isPassed ? '#22c55e' : isFailed ? '#f6465d' : '#f59e0b'
  const statusLabel = isPassed ? 'Passed'  : isFailed ? 'Failed'  : 'Active'
  const profitColor = profitAbs >= 0 ? '#22c55e' : '#f6465d'
  const ddColor     = drawdownUsed > maxDrawdownLimit * 0.75 ? '#f6465d'
                    : drawdownUsed > maxDrawdownLimit * 0.5  ? '#f59e0b' : '#7C3AED'
  const cardBorder  = isPassed ? 'rgba(34,197,94,0.25)'
                    : isFailed ? 'rgba(246,70,93,0.2)' : 'rgba(124,58,237,0.2)'

  // No daily drawdown rule — 3 gauges only
  const gauges = [
    { v: tradingDays,              mx: minTradingDays,    lbl: 'days',    clr: '#7C3AED',   head: 'Trading Days'   },
    { v: drawdownUsed,             mx: maxDrawdownLimit,  lbl: 'dd used', clr: ddColor,     head: 'Max Drawdown'   },
    { v: Math.max(0, profitAbs),   mx: profitTarget,      lbl: 'profit',  clr: profitColor, head: 'Profit Target'  },
  ]

  return (
    <div style={{
      background: t.cardBg, border: `1px solid ${cardBorder}`,
      borderRadius: 16, padding: '20px 22px',
      display: 'flex', flexDirection: 'column', gap: 18,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: '1.05rem', fontWeight: 700, color: t.textPrimary }}>
              ${(initialBalance / 1000).toFixed(0)}K Challenge
            </span>
            <span style={{
              fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20, letterSpacing: 0.5,
              background: isPassed ? 'rgba(34,197,94,0.12)' : isFailed ? 'rgba(246,70,93,0.12)' : 'rgba(245,158,11,0.12)',
              color: statusColor,
              border: `1px solid ${isPassed ? 'rgba(34,197,94,0.3)' : isFailed ? 'rgba(246,70,93,0.3)' : 'rgba(245,158,11,0.3)'}`,
            }}>
              {statusLabel}
            </span>
          </div>
          <span style={{ fontSize: '0.78rem', color: t.textFaint }}>Started {createdAt}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: profitColor }}>
            {profitAbs >= 0 ? '+' : ''}${profitAbs.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: t.textMuted }}>
            {profitAbs >= 0 ? '+' : ''}{profitPct.toFixed(2)}% P&L
          </div>
        </div>
      </div>

      {/* Gauges row */}
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
        {gauges.map(({ v, mx, lbl, clr, head }) => (
          <div key={head} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Gauge
              value={v} max={mx} label={lbl} color={clr} size={72}
              trackColor={t.gaugeTrack}
              textPrimary={t.textPrimary}
              textGaugeLabel={t.textGaugeLabel}
            />
            <span style={{ fontSize: '0.72rem', color: t.textGaugeLabel }}>{head}</span>
          </div>
        ))}
      </div>

      {/* Spec chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {[
          ['Account Size',  `$${initialBalance.toLocaleString()}`],
          ['Profit Target', `${((profitTarget / initialBalance) * 100).toFixed(0)}%`],
          ['Max Drawdown',  `${((maxDrawdownLimit / initialBalance) * 100).toFixed(0)}%`],
          ['Min Days',      `${minTradingDays} days`],
          ['Leverage',      '100x'],
          ['Profit Split',  '80%'],
        ].map(([label, value]) => (
          <div key={label} style={{
            background: t.chipBg, border: `1px solid ${t.border}`,
            borderRadius: 8, padding: '4px 10px', fontSize: '0.75rem',
          }}>
            <span style={{ color: t.textFaint, marginRight: 4 }}>{label}:</span>
            <span style={{ color: t.textPrimary, fontWeight: 600 }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Balance row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        padding: '12px 0',
        borderTop: `1px solid ${t.divider}`,
        borderBottom: `1px solid ${t.divider}`,
      }}>
        {[
          { label: 'Current Balance', value: `$${currentBalance.toFixed(2)}`,     color: t.textPrimary },
          { label: 'Profit Target',   value: `+$${profitTarget.toFixed(0)}`,       color: '#22c55e'     },
          { label: 'Max Drawdown',    value: `-$${maxDrawdownLimit.toFixed(0)}`,    color: '#f6465d'     },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: '0.7rem', color: t.textFaint }}>{label}</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color }}>{value}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      {isPassed && (
        <button
          onClick={() => onConnect(account)}
          style={{
            width: '100%', padding: '11px',
            background: 'linear-gradient(135deg, #7C3AED, #a855f7)',
            color: 'white', border: 'none', borderRadius: 10,
            fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(124,58,237,0.4)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
        >
          Set Up Funded Account
        </button>
      )}
      {isFailed && (
        <div style={{ textAlign: 'center', fontSize: '0.82rem', color: t.textFaint, padding: '8px 0' }}>
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
  const t = useTokens()
  const [step, setStep]                         = useState(1)
  const [selectedExchange, setSelectedExchange] = useState(null)
  const [apiKey, setApiKey]                     = useState('')
  const [apiSecret, setApiSecret]               = useState('')
  const [submitting, setSubmitting]             = useState(false)
  const [error, setError]                       = useState('')

  const handleConfirmExchange = () => { if (selectedExchange) setStep(2) }

  const handleConnect = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) { setError('Both API Key and API Secret are required'); return }
    setSubmitting(true); setError('')
    try {
      const { error: dbErr } = await supabase
        .from('demo_accounts')
        .update({
          connected_exchange:    selectedExchange.id,
          exchange_api_key:      apiKey.trim(),
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
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(false) }}
    >
      <div style={{
        background: t.modalBg, border: '1px solid rgba(124,58,237,0.25)',
        borderRadius: 18, padding: '28px 28px 24px', maxWidth: 480, width: '100%',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: t.textPrimary }}>
              {step === 1 ? 'Select Your Exchange' : `Connect ${selectedExchange?.name}`}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: t.textMuted }}>
              {step === 1
                ? 'Your funded account will be allocated on this exchange.'
                : 'Enter API credentials with trade permissions.'}
            </p>
          </div>
          <button
            onClick={() => onClose(false)}
            style={{ background: 'none', border: 'none', color: t.closeBtnColor, cursor: 'pointer', padding: 4 }}
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
              {EXCHANGES.map(ex => {
                const isSel = selectedExchange?.id === ex.id
                return (
                  <button
                    key={ex.id}
                    onClick={() => setSelectedExchange(ex)}
                    style={{
                      background: isSel ? t.exBtnBgActive : t.exBtnBg,
                      border: `1px solid ${isSel ? 'rgba(124,58,237,0.5)' : t.exBtnBorder}`,
                      borderRadius: 12, padding: '14px 16px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                      color: t.textExBtn,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 2 }}>{ex.name}</div>
                      <div style={{ fontSize: '0.75rem', color: t.textMuted }}>{ex.pairs}+ pairs</div>
                    </div>
                    {isSel && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.5">
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>

            <div style={{
              background: t.infoBg, border: `1px solid ${t.infoBorder}`,
              borderRadius: 8, padding: '10px 14px', fontSize: '0.78rem',
              color: t.textInfo, marginBottom: 20, lineHeight: 1.5,
            }}>
              ⚠ Your exchange selection is locked for this funding phase. You cannot change exchanges until this funding phase ends.
            </div>

            <button
              onClick={handleConfirmExchange}
              disabled={!selectedExchange}
              style={{
                width: '100%', padding: '12px',
                background: selectedExchange ? '#7C3AED' : t.disabledBtnBg,
                color: selectedExchange ? 'white' : t.textDisabled,
                border: 'none', borderRadius: 10,
                fontSize: '0.95rem', fontWeight: 600,
                cursor: selectedExchange ? 'pointer' : 'not-allowed', transition: 'all 0.2s',
              }}
            >
              Confirm Selection
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{
              marginBottom: 14, padding: '12px 14px',
              background: t.hintBg, borderRadius: 8,
              fontSize: '0.82rem', color: t.textSecondary, lineHeight: 1.6,
            }}>
              Create a <strong style={{ color: t.textPrimary }}>read-only + trade permissions</strong> API key on {selectedExchange?.name}. Do not enable withdrawal permissions.
            </div>

            {[
              { label: 'API Key',    value: apiKey,    set: setApiKey,    ph: 'Paste your API key here' },
              { label: 'API Secret', value: apiSecret, set: setApiSecret, ph: 'Paste your API secret here' },
            ].map(({ label, value, set, ph }) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: t.textSecondary, marginBottom: 6 }}>
                  {label}
                </label>
                <input
                  type="password"
                  value={value}
                  onChange={e => set(e.target.value)}
                  placeholder={ph}
                  style={{
                    width: '100%', background: t.inputBg,
                    border: `1px solid ${t.borderLg}`, borderRadius: 8,
                    padding: '10px 14px', color: t.textInput,
                    fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1, padding: '11px',
                  background: 'transparent', color: t.textSecondary,
                  border: `1px solid ${t.borderLg}`, borderRadius: 10,
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
  const t = useTokens()
  const [challenges, setChallenges] = useState([])
  const [tradingDaysMap, setTradingDaysMap] = useState({}) // { [accountId]: number }
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState('active')
  const [connectingAccount, setConnectingAccount] = useState(null)

  // kept for post-modal refresh
  const loadChallenges = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('demo_accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) console.error('[MyChallenges] load error:', error)
    const accounts = data ?? []
    setChallenges(accounts)
    setLoading(false)
    // Load trading days for each account from demo_trades
    if (accounts.length > 0) {
      loadTradingDays(accounts.map(a => a.id))
    }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load distinct trading days per account from demo_trades
  const loadTradingDays = useCallback(async (accountIds) => {
    if (!accountIds.length) return
    const { data, error } = await supabase
      .from('demo_trades')
      .select('account_id, created_at')
      .in('account_id', accountIds)
    if (error) { console.error('[MyChallenges] tradingDays error:', error); return }
    // Count distinct calendar days per account_id
    const map = {}
    for (const row of (data ?? [])) {
      const day = row.created_at?.slice(0, 10) // 'YYYY-MM-DD'
      if (!day) continue
      if (!map[row.account_id]) map[row.account_id] = new Set()
      map[row.account_id].add(day)
    }
    const counts = {}
    for (const [id, days] of Object.entries(map)) counts[id] = days.size
    setTradingDaysMap(counts)
  }, [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase
      .from('demo_accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('[MyChallenges] load error:', error)
        const accounts = data ?? []
        setChallenges(accounts)
        setLoading(false)
        if (accounts.length > 0) {
          loadTradingDays(accounts.map(a => a.id))
        }
      })
    return () => { cancelled = true }
  }, [userId, loadTradingDays])

  const filtered = challenges.filter(c => c.status === tab)
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
          <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: t.textPrimary }}>My Challenges</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: t.textMuted }}>
            Track your evaluation progress and funded accounts
          </p>
        </div>
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, borderBottom: `1px solid ${t.tabBorder}` }}>
        {[
          { id: 'active', label: 'Active', color: '#f59e0b' },
          { id: 'passed', label: 'Passed', color: '#22c55e' },
          { id: 'failed', label: 'Failed', color: '#f6465d' },
        ].map(({ id, label, color }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 16px', borderRadius: '8px 8px 0 0',
              fontSize: '0.875rem', fontWeight: tab === id ? 600 : 400,
              color: tab === id ? color : t.textInactive,
              borderBottom: tab === id ? `2px solid ${color}` : '2px solid transparent',
              transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {label}
            {counts[id] > 0 && (
              <span style={{
                background: tab === id ? `${color}22` : t.badgeBg,
                color: tab === id ? color : t.badgeText,
                fontSize: '0.7rem', fontWeight: 700, padding: '1px 7px', borderRadius: 20,
              }}>
                {counts[id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: t.textFaint, fontSize: '0.9rem' }}>
          Loading challenges...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: t.emptyBg, border: `1px dashed ${t.emptyBorder}`, borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={t.iconMuted} strokeWidth="1.2" style={{ marginBottom: 16 }}>
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
            <path d="M4 22h16"/>
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
          </svg>
          <p style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 600, color: t.textSecondary }}>
            No {tab} challenges
          </p>
          <p style={{ margin: 0, fontSize: '0.85rem', color: t.textVeryFaint }}>
            {tab === 'active'
              ? 'Start a challenge from the Market tab to begin your evaluation.'
              : `You have no ${tab} challenges yet.`}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {filtered.map(acc => (
            <ChallengeCard key={acc.id} account={acc} tradingDaysMap={tradingDaysMap} onConnect={setConnectingAccount} />
          ))}
        </div>
      )}

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
