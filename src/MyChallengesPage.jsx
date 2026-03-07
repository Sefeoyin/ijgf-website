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
function ChallengeCard({ account, tradingDaysMap, bybitEquity }) {
  const t = useTokens()

  const isPassed = account.status === 'passed'
  const isFailed = account.status === 'failed'
  const isBybit  = account.trading_mode === 'bybit'

  // ── Correct DB field names ──────────────────────────────────────────────
  const initialBalance   = account.initial_balance   ?? 10000
  // For Bybit accounts, bybitEquity is the live value from the sync hook;
  // fall back to current_balance stored in DB (refreshed every 30s)
  const currentBalance   = isBybit
    ? (bybitEquity ?? account.current_balance ?? initialBalance)
    : (account.current_balance ?? initialBalance)
  const profitAbs        = currentBalance - initialBalance
  const profitPct        = (profitAbs / initialBalance) * 100
  const profitTarget     = account.profit_target     ?? initialBalance * 0.10
  const maxDrawdownLimit = account.max_total_drawdown ?? initialBalance * 0.08
  const minTradingDays   = account.min_trading_days  ?? 5
  const drawdownUsed     = Math.max(0, initialBalance - currentBalance)
  // Bybit trading days are stored in the account row; IJGF days come from demo_trades map
  const tradingDays      = isBybit
    ? (account.bybit_trading_days ?? 0)
    : (tradingDaysMap[account.id] ?? 0)

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
              {isBybit && (
                <span style={{
                  marginLeft: 7, fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px',
                  borderRadius: 20, background: 'rgba(245,158,11,0.12)',
                  color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)',
                  verticalAlign: 'middle',
                }}>BYBIT</span>
              )}
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

      {/* CTA — demo mode: no funded account setup yet */}
      {isPassed && (
        <div style={{
          textAlign: 'center', fontSize: '0.82rem', color: '#22c55e',
          padding: '10px 0', borderRadius: 8,
          background: 'rgba(34,197,94,0.07)',
          border: '1px solid rgba(34,197,94,0.2)',
        }}>
          🎉 Challenge complete — funded account setup coming soon
        </div>
      )}
      {isFailed && (
        <div style={{ textAlign: 'center', fontSize: '0.82rem', color: t.textFaint, padding: '8px 0' }}>
          Challenge ended · Start a new one from the Market tab
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function MyChallengesPage({ userId, bybitData }) {
  const t = useTokens()
  const [challenges, setChallenges] = useState([])
  const [tradingDaysMap, setTradingDaysMap] = useState({}) // { [accountId]: number }
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState('active')

  // Load distinct trading days per account from demo_trades.
  // COLUMN FIX: demo_trades uses demo_account_id (not account_id)
  //             and executed_at (not created_at).
  // Only closing trades (is_close = true) count as a trading day —
  // matches the same logic in tradingService.js checkChallengeRules().
  const loadTradingDays = useCallback(async (accountIds) => {
    if (!accountIds?.length) return
    const { data, error } = await supabase
      .from('demo_trades')
      .select('demo_account_id, executed_at')
      .in('demo_account_id', accountIds)
      .eq('is_close', true)         // only closing trades count
    if (error) { console.error('[MyChallenges] tradingDays error:', error); return }
    // Count distinct calendar days per demo_account_id
    const map = {}
    for (const row of (data ?? [])) {
      const day = row.executed_at?.slice(0, 10) // 'YYYY-MM-DD'
      if (!day) continue
      if (!map[row.demo_account_id]) map[row.demo_account_id] = new Set()
      map[row.demo_account_id].add(day)
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
            <ChallengeCard
              key={acc.id}
              account={acc}
              tradingDaysMap={tradingDaysMap}
              bybitEquity={acc.trading_mode === 'bybit' ? bybitData?.equity : undefined}
            />
          ))}
        </div>
      )}

    </div>
  )
}
