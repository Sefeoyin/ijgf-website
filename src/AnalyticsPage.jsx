import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase'
import { getAccountState } from './tradingService'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'

// ─── helpers ────────────────────────────────────────────────────────────────
function fmt(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
function fmtPct(n) {
  if (n == null || isNaN(n)) return '—'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${fmt(n)}%`
}
function fmtUsd(n) {
  if (n == null || isNaN(n)) return '—'
  const sign = n >= 0 ? '+$' : '-$'
  return `${sign}${fmt(Math.abs(n))}`
}

// ─── Custom tooltip ──────────────────────────────────────────────────────────
const EquityTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value
  return (
    <div style={{
      background: '#1a1a2e', border: '1px solid rgba(139,92,246,0.3)',
      borderRadius: 8, padding: '10px 14px', fontSize: 13,
    }}>
      <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{label}</div>
      <div style={{ color: val >= 0 ? '#4ade80' : '#f87171', fontWeight: 600 }}>
        ${fmt(val)}
      </div>
    </div>
  )
}

const PnlTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value
  return (
    <div style={{
      background: '#1a1a2e', border: '1px solid rgba(139,92,246,0.3)',
      borderRadius: 8, padding: '10px 14px', fontSize: 13,
    }}>
      <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{label}</div>
      <div style={{ color: val >= 0 ? '#4ade80' : '#f87171', fontWeight: 600 }}>
        {fmtUsd(val)}
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AnalyticsPage({ userId }) {
  const [trades, setTrades]     = useState([])
  const [account, setAccount]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [equityRange, setEquityRange] = useState('1M')

  useEffect(() => {
    if (!userId) return
    loadData()
  }, [userId])

  const loadData = async () => {
    setLoading(true)
    try {
      const state = await getAccountState(userId)
      setAccount(state.account)

      // fetch ALL closed trades for analytics (not just last 50)
      const { data } = await supabase
        .from('demo_trades')
        .select('*')
        .eq('demo_account_id', state.account.id)
        .order('executed_at', { ascending: true })
      setTrades(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // ── Computed stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!trades.length) return {}

    const closedTrades = trades.filter(t => t.realized_pnl != null)
    const totalPnl     = closedTrades.reduce((s, t) => s + (t.realized_pnl || 0), 0)
    const initialBal   = account?.initial_balance || 10000
    const totalPnlPct  = (totalPnl / initialBal) * 100

    const winners      = closedTrades.filter(t => t.realized_pnl > 0)
    const losers       = closedTrades.filter(t => t.realized_pnl < 0)
    const winRate      = closedTrades.length ? (winners.length / closedTrades.length) * 100 : 0

    const avgWin  = winners.length ? winners.reduce((s, t) => s + t.realized_pnl, 0) / winners.length : 0
    const avgLoss = losers.length  ? Math.abs(losers.reduce((s, t) => s + t.realized_pnl, 0) / losers.length) : 0

    const rr = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '∞'

    const grossProfit = winners.reduce((s, t) => s + t.realized_pnl, 0)
    const grossLoss   = Math.abs(losers.reduce((s, t) => s + t.realized_pnl, 0))
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : '∞'

    return {
      totalPnl, totalPnlPct, winRate,
      avgWin, avgLoss, rr, profitFactor,
      totalTrades: closedTrades.length, grossProfit, grossLoss,
    }
  }, [trades, account])

  // ── Equity curve data ────────────────────────────────────────────────────────
  const equityData = useMemo(() => {
    if (!account) return []
    const initial = account.initial_balance
    let running = initial
    const points = [{ date: 'Start', value: initial }]

    // Filter by range
    const now = Date.now()
    const rangeMs = { '1D': 86400000, '1W': 604800000, '1M': 2592000000, '3M': 7776000000, '6M': 15552000000, '1Y': 31536000000 }
    const cutoff = now - (rangeMs[equityRange] || rangeMs['1M'])

    const filtered = trades.filter(t => new Date(t.executed_at).getTime() >= cutoff)

    filtered.forEach(t => {
      running += (t.realized_pnl || 0)
      const d = new Date(t.executed_at)
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      points.push({ date: label, value: parseFloat(running.toFixed(2)) })
    })

    return points
  }, [trades, account, equityRange])

  // ── Daily PNL bar chart ──────────────────────────────────────────────────────
  const dailyPnl = useMemo(() => {
    const byDay = {}
    trades.forEach(t => {
      const day = new Date(t.executed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      byDay[day] = (byDay[day] || 0) + (t.realized_pnl || 0)
    })
    return Object.entries(byDay).slice(-14).map(([date, pnl]) => ({
      date, pnl: parseFloat(pnl.toFixed(2))
    }))
  }, [trades])

  const currentEquity = equityData.length ? equityData[equityData.length - 1].value : (account?.initial_balance || 0)
  const equityChange  = stats.totalPnlPct

  const statCards = [
    {
      label: 'Total PNL',
      sub: 'Net performance',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      ),
      value: stats.totalPnl != null ? fmtPct(stats.totalPnlPct) : '—',
      color: stats.totalPnl >= 0 ? '#4ade80' : '#f87171',
      accent: 'rgba(74,222,128,0.15)',
    },
    {
      label: 'Win Rate',
      sub: 'Winning trades vs total',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
        </svg>
      ),
      value: stats.winRate != null ? `${fmt(stats.winRate, 1)}%` : '—',
      color: '#e2e8f0',
      accent: 'rgba(139,92,246,0.15)',
    },
    {
      label: 'Avg Win / Avg Loss',
      sub: 'Average profit vs loss',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      ),
      value: stats.avgWin != null ? `$${fmt(stats.avgWin, 0)} / $${fmt(stats.avgLoss, 0)}` : '—',
      color: '#e2e8f0',
      accent: 'rgba(139,92,246,0.15)',
    },
    {
      label: 'Risk / Reward',
      sub: 'Average risk per trade',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      ),
      value: stats.rr != null ? `1 : ${stats.rr}` : '—',
      color: '#e2e8f0',
      accent: 'rgba(139,92,246,0.15)',
    },
    {
      label: 'Profit Factor',
      sub: 'Gross profit ÷ gross loss',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
        </svg>
      ),
      value: stats.profitFactor != null ? `${stats.profitFactor}` : '—',
      color: '#e2e8f0',
      accent: 'rgba(139,92,246,0.15)',
    },
  ]

  if (loading) return (
    <div className="analytics-loading">
      <div className="analytics-spinner" />
      <span>Loading analytics…</span>
    </div>
  )

  if (!trades.length) return (
    <div className="analytics-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(139,92,246,0.4)" strokeWidth="1.5">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
      </svg>
      <h3>No trade data yet</h3>
      <p>Complete some trades to see your analytics.</p>
    </div>
  )

  return (
    <div className="analytics-page">

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <div className="analytics-stat-grid">
        {statCards.map((card, i) => (
          <div key={i} className="analytics-stat-card" style={{ '--card-accent': card.accent }}>
            <div className="analytics-stat-header">
              <span className="analytics-stat-icon" style={{ color: '#8b5cf6' }}>{card.icon}</span>
              <span className="analytics-stat-label">{card.label}</span>
            </div>
            <div className="analytics-stat-value" style={{ color: card.color }}>{card.value}</div>
            <div className="analytics-stat-sub">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Charts row ─────────────────────────────────────────────────── */}
      <div className="analytics-charts-row">

        {/* Equity chart */}
        <div className="analytics-chart-card analytics-equity-card">
          <div className="analytics-chart-header">
            <div>
              <div className="analytics-chart-title">Equity Chart</div>
              <div className="analytics-chart-sub">All time performance</div>
            </div>
            <div className="analytics-equity-meta">
              <div className="analytics-equity-val">${fmt(currentEquity)}</div>
              <div className={`analytics-equity-badge ${equityChange >= 0 ? 'green' : 'red'}`}>
                {fmtPct(equityChange)}
              </div>
            </div>
            <div className="analytics-range-btns">
              {['1D','1W','1M','3M','6M','1Y'].map(r => (
                <button
                  key={r}
                  className={`time-range-btn ${equityRange === r ? 'active' : ''}`}
                  onClick={() => setEquityRange(r)}
                >{r}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={equityData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => `$${(v/1000).toFixed(0)}k`}/>
              <Tooltip content={<EquityTooltip />}/>
              <ReferenceLine y={account?.initial_balance} stroke="rgba(139,92,246,0.3)" strokeDasharray="4 4"/>
              <Area type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2}
                fill="url(#equityGrad)" dot={false} activeDot={{ r: 4, fill: '#8b5cf6' }}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Daily PNL */}
        <div className="analytics-chart-card analytics-daily-card">
          <div className="analytics-chart-header">
            <div>
              <div className="analytics-chart-title">Daily PNL</div>
              <div className="analytics-chart-sub">Last 14 trading days</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dailyPnl} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => `$${v}`}/>
              <Tooltip content={<PnlTooltip />}/>
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)"/>
              <Bar dataKey="pnl" radius={[3,3,0,0]}
                fill="#4ade80"
                className="pnl-bar"
                label={false}
                isAnimationActive={true}
              >
                {dailyPnl.map((entry, index) => (
                  <rect key={index} fill={entry.pnl >= 0 ? '#4ade80' : '#f87171'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="analytics-legend">
            <span className="analytics-legend-dot" style={{ background: '#4ade80' }} /> Profit
            <span className="analytics-legend-dot" style={{ background: '#f87171', marginLeft: 12 }} /> Loss
          </div>
        </div>
      </div>

      {/* ── Summary row ─────────────────────────────────────────────────── */}
      <div className="analytics-summary-row">
        <div className="analytics-summary-card">
          <div className="analytics-summary-label">Total Trades</div>
          <div className="analytics-summary-val">{stats.totalTrades ?? 0}</div>
        </div>
        <div className="analytics-summary-card">
          <div className="analytics-summary-label">Winning Trades</div>
          <div className="analytics-summary-val" style={{ color: '#4ade80' }}>
            {trades.filter(t => t.realized_pnl > 0).length}
          </div>
        </div>
        <div className="analytics-summary-card">
          <div className="analytics-summary-label">Losing Trades</div>
          <div className="analytics-summary-val" style={{ color: '#f87171' }}>
            {trades.filter(t => t.realized_pnl < 0).length}
          </div>
        </div>
        <div className="analytics-summary-card">
          <div className="analytics-summary-label">Gross Profit</div>
          <div className="analytics-summary-val" style={{ color: '#4ade80' }}>
            ${fmt(stats.grossProfit)}
          </div>
        </div>
        <div className="analytics-summary-card">
          <div className="analytics-summary-label">Gross Loss</div>
          <div className="analytics-summary-val" style={{ color: '#f87171' }}>
            -${fmt(stats.grossLoss)}
          </div>
        </div>
        <div className="analytics-summary-card">
          <div className="analytics-summary-label">Net PNL</div>
          <div className="analytics-summary-val" style={{ color: stats.totalPnl >= 0 ? '#4ade80' : '#f87171' }}>
            {fmtUsd(stats.totalPnl)}
          </div>
        </div>
      </div>

    </div>
  )
}
