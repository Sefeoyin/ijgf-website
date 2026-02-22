import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase'
import { getAccountState } from './tradingService'

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

// ─── SVG Area Chart ──────────────────────────────────────────────────────────
function EquityChart({ data, initialBalance }) {
  const W = 700, H = 200
  const PAD = { top: 10, right: 10, bottom: 28, left: 52 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const [hoverIdx, setHoverIdx] = useState(null)

  if (!data || data.length < 2) return (
    <div className="chart-empty">Not enough data yet</div>
  )

  const values = data.map(d => d.value)
  const minV   = Math.min(...values) * 0.998
  const maxV   = Math.max(...values) * 1.002
  const range  = maxV - minV || 1

  const xScale = i => PAD.left + (i / (data.length - 1)) * innerW
  const yScale = v => PAD.top + innerH - ((v - minV) / range) * innerH

  const pts = data.map((d, i) => `${xScale(i)},${yScale(d.value)}`).join(' ')
  const areaPath =
    `M${xScale(0)},${yScale(data[0].value)} ` +
    data.slice(1).map((d, i) => `L${xScale(i + 1)},${yScale(d.value)}`).join(' ') +
    ` L${xScale(data.length - 1)},${PAD.top + innerH} L${xScale(0)},${PAD.top + innerH} Z`

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => minV + range * t)

  const xLabelIdxs = data.length <= 5
    ? data.map((_, i) => i)
    : [0, Math.floor(data.length * 0.25), Math.floor(data.length * 0.5),
       Math.floor(data.length * 0.75), data.length - 1]

  const hovered = hoverIdx != null ? data[hoverIdx] : null

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', overflow: 'visible' }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#8b5cf6" stopOpacity="0.35"/>
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0"/>
          </linearGradient>
          <clipPath id="eqClip">
            <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH}/>
          </clipPath>
        </defs>

        {yTicks.map((v, i) => (
          <line key={i}
            x1={PAD.left} x2={PAD.left + innerW}
            y1={yScale(v)} y2={yScale(v)}
            stroke="rgba(255,255,255,0.05)" strokeWidth="1"
          />
        ))}

        {initialBalance != null && initialBalance >= minV && initialBalance <= maxV && (
          <line
            x1={PAD.left} x2={PAD.left + innerW}
            y1={yScale(initialBalance)} y2={yScale(initialBalance)}
            stroke="rgba(139,92,246,0.35)" strokeWidth="1" strokeDasharray="5 4"
          />
        )}

        <path d={areaPath} fill="url(#eqGrad)" clipPath="url(#eqClip)"/>
        <polyline points={pts} fill="none" stroke="#8b5cf6" strokeWidth="2" clipPath="url(#eqClip)"/>

        {yTicks.map((v, i) => (
          <text key={i} x={PAD.left - 6} y={yScale(v) + 4}
            className="chart-axis-text" fontSize="10" textAnchor="end">
            {v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`}
          </text>
        ))}

        {xLabelIdxs.map(i => (
          <text key={i} x={xScale(i)} y={H - 4}
            className="chart-axis-text" fontSize="10" textAnchor="middle">
            {data[i].date}
          </text>
        ))}

        {/* invisible hover zone */}
        <rect
          x={PAD.left} y={PAD.top} width={innerW} height={innerH}
          fill="transparent"
          onMouseMove={e => {
            const svgEl  = e.currentTarget.closest('svg')
            const rect   = svgEl.getBoundingClientRect()
            const svgX   = (e.clientX - rect.left) / rect.width * W
            const idx    = Math.round(((svgX - PAD.left) / innerW) * (data.length - 1))
            setHoverIdx(Math.max(0, Math.min(data.length - 1, idx)))
          }}
        />

        {hoverIdx != null && (
          <>
            <line
              x1={xScale(hoverIdx)} x2={xScale(hoverIdx)}
              y1={PAD.top} y2={PAD.top + innerH}
              stroke="rgba(139,92,246,0.45)" strokeWidth="1" strokeDasharray="4 3"
            />
            <circle
              cx={xScale(hoverIdx)} cy={yScale(data[hoverIdx].value)}
              r="4" fill="#8b5cf6" stroke="#0f0f1a" strokeWidth="2"
            />
          </>
        )}
      </svg>

      {hovered && (
        <div className="chart-tooltip" style={{
          left: `${(hoverIdx / (data.length - 1)) * 100}%`,
        }}>
          <div className="chart-tooltip-date">{hovered.date}</div>
          <div className="chart-tooltip-val"
            style={{ color: hovered.value >= (initialBalance || 0) ? '#4ade80' : '#f87171' }}>
            ${fmt(hovered.value)}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SVG Bar Chart (Daily PNL) ───────────────────────────────────────────────
function DailyPnlChart({ data }) {
  const W = 340, H = 200
  const PAD = { top: 10, right: 10, bottom: 28, left: 50 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  if (!data || data.length === 0) return (
    <div className="chart-empty">No daily data yet</div>
  )

  const maxAbs = Math.max(...data.map(d => Math.abs(d.pnl)), 1)
  const zeroY  = PAD.top + innerH / 2
  const barW   = Math.max(4, (innerW / data.length) - 4)
  const xScale = i => PAD.left + (i + 0.5) * (innerW / data.length)

  const labelIdxs = [0, Math.floor(data.length * 0.33), Math.floor(data.length * 0.66), data.length - 1]
    .filter((v, i, a) => a.indexOf(v) === i)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      <line x1={PAD.left} x2={PAD.left + innerW} y1={zeroY} y2={zeroY}
        stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>

      {data.map((d, i) => {
        const barH = (Math.abs(d.pnl) / maxAbs) * (innerH / 2 - 4)
        const x    = xScale(i) - barW / 2
        const y    = d.pnl >= 0 ? zeroY - barH : zeroY
        return (
          <rect key={i}
            x={x} y={y} width={barW} height={Math.max(2, barH)}
            fill={d.pnl >= 0 ? '#4ade80' : '#f87171'} opacity="0.85" rx="2"
          />
        )
      })}

      {labelIdxs.map(i => (
        <text key={i} x={xScale(i)} y={H - 4}
          fill="rgba(255,255,255,0.35)" fontSize="9" textAnchor="middle">
          {data[i].date}
        </text>
      ))}
    </svg>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function AnalyticsPage({ userId }) {
  const [trades, setTrades]   = useState([])
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [equityRange, setEquityRange] = useState('1M')

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const state = await getAccountState(userId)
        if (cancelled) return
        setAccount(state.account)
        const { data } = await supabase
          .from('demo_trades')
          .select('*')
          .eq('demo_account_id', state.account.id)
          .order('executed_at', { ascending: true })
        if (!cancelled) setTrades(data || [])
      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [userId])

  const stats = useMemo(() => {
    if (!trades.length) return {}
    const closed       = trades.filter(t => t.realized_pnl != null)
    const totalPnl     = closed.reduce((s, t) => s + (t.realized_pnl || 0), 0)
    const initial      = account?.initial_balance || 10000
    const totalPnlPct  = (totalPnl / initial) * 100
    const winners      = closed.filter(t => t.realized_pnl > 0)
    const losers       = closed.filter(t => t.realized_pnl < 0)
    const winRate      = closed.length ? (winners.length / closed.length) * 100 : 0
    const avgWin       = winners.length ? winners.reduce((s, t) => s + t.realized_pnl, 0) / winners.length : 0
    const avgLoss      = losers.length  ? Math.abs(losers.reduce((s, t) => s + t.realized_pnl, 0) / losers.length) : 0
    const rr           = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '∞'
    const grossProfit  = winners.reduce((s, t) => s + t.realized_pnl, 0)
    const grossLoss    = Math.abs(losers.reduce((s, t) => s + t.realized_pnl, 0))
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : '∞'
    return { totalPnl, totalPnlPct, winRate, avgWin, avgLoss, rr,
      profitFactor, totalTrades: closed.length, grossProfit, grossLoss }
  }, [trades, account])

  const equityData = useMemo(() => {
    if (!account) return []
    const initial  = account.initial_balance
    const rangeMs  = { '1D': 86400000, '1W': 604800000, '1M': 2592000000,
      '3M': 7776000000, '6M': 15552000000, '1Y': 31536000000 }
    const cutoff   = Date.now() - (rangeMs[equityRange] || rangeMs['1M'])
    const filtered = trades.filter(t => new Date(t.executed_at).getTime() >= cutoff)
    let running    = initial
    const points   = [{ date: 'Start', value: initial }]
    filtered.forEach(t => {
      running += (t.realized_pnl || 0)
      const label = new Date(t.executed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      points.push({ date: label, value: parseFloat(running.toFixed(2)) })
    })
    return points
  }, [trades, account, equityRange])

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

  const currentEquity = equityData.length
    ? equityData[equityData.length - 1].value
    : (account?.initial_balance || 0)

  if (loading) return (
    <div className="analytics-loading">
      <div className="analytics-spinner" />
      <span>Loading analytics…</span>
    </div>
  )

  if (!trades.length) return (
    <div className="analytics-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
        stroke="rgba(139,92,246,0.4)" strokeWidth="1.5">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
        <polyline points="17 6 23 6 23 12"/>
      </svg>
      <h3>No trade data yet</h3>
      <p>Complete some trades to see your analytics.</p>
    </div>
  )

  const statCards = [
    { label: 'Total PNL',          sub: 'Net performance',
      value: fmtPct(stats.totalPnlPct),
      colorClass: (stats.totalPnl ?? 0) > 0 ? 'stat-green' : (stats.totalPnl ?? 0) < 0 ? 'stat-red' : 'stat-default' },
    { label: 'Win Rate',           sub: 'Winning trades vs total',
      value: `${fmt(stats.winRate, 1)}%`,         colorClass: 'stat-default' },
    { label: 'Avg Win / Avg Loss', sub: 'Average profit vs loss',
      value: `$${fmt(stats.avgWin, 0)} / $${fmt(stats.avgLoss, 0)}`, colorClass: 'stat-default' },
    { label: 'Risk / Reward',      sub: 'Average risk per trade',
      value: `1 : ${stats.rr}`,                   colorClass: 'stat-default' },
    { label: 'Profit Factor',      sub: 'Gross profit ÷ gross loss',
      value: `${stats.profitFactor}`,              colorClass: 'stat-default' },
  ]

  return (
    <div className="analytics-page">

      <div className="analytics-stat-grid">
        {statCards.map((card, i) => (
          <div key={i} className="analytics-stat-card">
            <div className="analytics-stat-header">
              <span className="analytics-stat-label">{card.label}</span>
            </div>
            <div className={`analytics-stat-value ${card.colorClass}`}>{card.value}</div>
            <div className="analytics-stat-sub">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="analytics-charts-row">
        <div className="analytics-chart-card analytics-equity-card">
          <div className="analytics-chart-header">
            <div>
              <div className="analytics-chart-title">Equity Chart</div>
              <div className="analytics-chart-sub">All time performance</div>
            </div>
            <div className="analytics-equity-meta">
              <div className="analytics-equity-val">${fmt(currentEquity)}</div>
              <div className={`analytics-equity-badge ${(stats.totalPnlPct ?? 0) >= 0 ? 'green' : 'red'}`}>
                {fmtPct(stats.totalPnlPct)}
              </div>
            </div>
            <div className="analytics-range-btns">
              {['1D','1W','1M','3M','6M','1Y'].map(r => (
                <button key={r}
                  className={`time-range-btn ${equityRange === r ? 'active' : ''}`}
                  onClick={() => setEquityRange(r)}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <EquityChart data={equityData} initialBalance={account?.initial_balance} />
        </div>

        <div className="analytics-chart-card analytics-daily-card">
          <div className="analytics-chart-header">
            <div>
              <div className="analytics-chart-title">Daily PNL</div>
              <div className="analytics-chart-sub">Last 14 trading days</div>
            </div>
          </div>
          <DailyPnlChart data={dailyPnl} />
          <div className="analytics-legend">
            <span className="analytics-legend-dot" style={{ background: '#4ade80' }} /> Profit
            <span className="analytics-legend-dot" style={{ background: '#f87171', marginLeft: 12 }} /> Loss
          </div>
        </div>
      </div>

      <div className="analytics-summary-row">
        {[
          { label: 'Total Trades',   val: stats.totalTrades ?? 0,                          color: undefined },
          { label: 'Winning Trades', val: trades.filter(t => t.realized_pnl > 0).length,   color: '#4ade80' },
          { label: 'Losing Trades',  val: trades.filter(t => t.realized_pnl < 0).length,   color: '#f87171' },
          { label: 'Gross Profit',   val: `$${fmt(stats.grossProfit)}`,                     color: '#4ade80' },
          { label: 'Gross Loss',     val: `-$${fmt(stats.grossLoss)}`,                      color: '#f87171' },
          { label: 'Net PNL',        val: fmtUsd(stats.totalPnl),
            color: (stats.totalPnl ?? 0) >= 0 ? '#4ade80' : '#f87171' },
        ].map((item, i) => (
          <div key={i} className="analytics-summary-card">
            <div className="analytics-summary-label">{item.label}</div>
            <div className="analytics-summary-val" style={{ color: item.color }}>{item.val}</div>
          </div>
        ))}
      </div>

    </div>
  )
}
