import { useState } from 'react'

function DashboardOverview() {
  const [timeRange, setTimeRange] = useState('1H')
  const [stats] = useState({
    activeChallenges: 2,
    totalPNL: 2980.00,
    winRate: 85,
    currentEquity: 12980.00
  })

  const [markets] = useState([
    { symbol: 'BTCUSDT', name: 'Bitcoin', price: 23495, change: 23.4 },
    { symbol: 'AXSUSDT', name: 'Axie Infinity', price: 15.9, change: -7.8 },
    { symbol: 'ETHUSDT', name: 'Ethereum', price: 15978, change: -0.3 },
    { symbol: 'SOLUSDT', name: 'Solana', price: 495, change: 11.1 },
    { symbol: 'BNBUSDT', name: 'Binance', price: 267, change: 6.7 },
    { symbol: 'ADAUSDT', name: 'Cardano', price: 0.49, change: -1.4 }
  ])

  const [recentTrades] = useState([
    { id: 'TRD-10482', date: '08/12/25 2:41pm', symbol: 'BTC/USDT', side: 'Long', leverage: '5x', pnl: 553.50, change: 2.01 },
    { id: 'TRD-10482', date: '08/12/25 2:41pm', symbol: 'BTC/USDT', side: 'Long', leverage: '5x', pnl: 553.50, change: 2.01 },
    { id: 'TRD-10482', date: '08/12/25 2:41pm', symbol: 'BTC/USDT', side: 'Long', leverage: '5x', pnl: 553.50, change: 2.01 }
  ])

  const formatPrice = (value) => {
    if (value < 1) return `$${value}`
    return `$${value.toLocaleString()}`
  }

  const formatPercent = (value) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  return (
    <div className="do-page">
      {/* ── Stats Cards Row ── */}
      <div className="do-stats">
        {/* Active Challenges — GREEN icon */}
        <div className="do-card">
          <div className="do-card-top">
            <div className="do-icon green">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </div>
            <span className="do-card-label">Active Challenges</span>
          </div>
          <div className="do-card-val">{stats.activeChallenges}</div>
          <div className="do-card-sub">Currently in progress</div>
        </div>

        {/* Total PNL — GOLD icon */}
        <div className="do-card">
          <div className="do-card-top">
            <div className="do-icon gold">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <span className="do-card-label">Total PNL</span>
          </div>
          <div className="do-card-val">$2,980.00</div>
          <div className="do-card-sub">All time performance</div>
        </div>

        {/* Win Rate — PURPLE icon */}
        <div className="do-card">
          <div className="do-card-top">
            <div className="do-icon purple">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <span className="do-card-label">Win Rate</span>
          </div>
          <div className="do-card-val">{stats.winRate}%</div>
          <div className="do-card-sub">Success rate</div>
        </div>

        {/* Current Equity — RED icon */}
        <div className="do-card">
          <div className="do-card-top">
            <div className="do-icon red">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                <line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
            </div>
            <span className="do-card-label">Current Equity</span>
          </div>
          <div className="do-card-val">$12,980.00</div>
          <div className="do-card-sub">All time performance</div>
        </div>
      </div>

      {/* ── Middle Row: Equity Chart + Markets ── */}
      <div className="do-mid">
        {/* Equity Chart Widget */}
        <div className="do-equity">
          {/* Header row: title left, value + pills right */}
          <div className="do-eq-header">
            <div className="do-eq-left">
              <h3>Equity Chart</h3>
              <span className="do-muted-sm">All time performance</span>
            </div>
            <div className="do-eq-center">
              <span className="do-eq-val">$12,980</span>
              <span className="do-eq-pct">+23.6%</span>
            </div>
            <div className="do-eq-pills">
              {['1H', '3H', '5H', '1D', '1W', '1M'].map((r) => (
                <button
                  key={r}
                  className={`do-pill ${timeRange === r ? 'active' : ''}`}
                  onClick={() => setTimeRange(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Chart with Y-axis */}
          <div className="do-chart-area">
            <div className="do-chart-y">
              <span>$25,000</span>
              <span>$20,000</span>
              <span>$15,000</span>
              <span>$10,000</span>
              <span>$5,000</span>
            </div>
            <div className="do-chart-svg">
              <svg width="100%" height="100%" viewBox="0 0 600 180" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="eqFill" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgba(124, 58, 237, 0.25)" />
                    <stop offset="100%" stopColor="rgba(124, 58, 237, 0)" />
                  </linearGradient>
                </defs>
                {/* Grid lines */}
                {[0, 45, 90, 135, 180].map(y => (
                  <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
                ))}
                {/* Fill area */}
                <path
                  d="M 0 110 C 30 118, 60 140, 100 150 C 130 158, 155 128, 200 100 C 220 85, 245 78, 275 88 C 305 98, 315 82, 350 78 C 375 74, 400 108, 430 120 C 460 132, 470 108, 495 92 C 515 78, 540 62, 565 52 C 580 46, 590 42, 600 38 L 600 180 L 0 180 Z"
                  fill="url(#eqFill)"
                />
                {/* Line */}
                <path
                  d="M 0 110 C 30 118, 60 140, 100 150 C 130 158, 155 128, 200 100 C 220 85, 245 78, 275 88 C 305 98, 315 82, 350 78 C 375 74, 400 108, 430 120 C 460 132, 470 108, 495 92 C 515 78, 540 62, 565 52 C 580 46, 590 42, 600 38"
                  fill="none"
                  stroke="#7c3aed"
                  strokeWidth="2.5"
                />
                {/* Endpoint dot */}
                <circle cx="565" cy="52" r="5" fill="#7c3aed" stroke="#1a1a2e" strokeWidth="2.5"/>
              </svg>
              {/* Tooltip bubble */}
              <div className="do-tooltip">
                <div className="do-tooltip-val">$12,980</div>
                <div className="do-tooltip-pct">+23.6%</div>
              </div>
            </div>
          </div>

          {/* X-axis dates */}
          <div className="do-chart-x">
            <span>Dec 17</span>
            <span>Dec 18</span>
            <span>Dec 18</span>
            <span>Dec 19</span>
            <span>Dec 19</span>
          </div>
        </div>

        {/* Markets Widget */}
        <div className="do-markets">
          <h3 className="do-markets-title">Markets</h3>
          <div className="do-markets-rows">
            {markets.map((m) => (
              <div key={m.symbol} className="do-mkt">
                <span className="do-mkt-sym">{m.symbol}</span>
                <span className="do-mkt-name">{m.name}</span>
                <span className="do-mkt-price">{formatPrice(m.price)}</span>
                <span className={`do-mkt-badge ${m.change > 0 ? 'up' : 'down'}`}>
                  {formatPercent(m.change)}
                </span>
              </div>
            ))}
          </div>
          <div className="do-markets-footer">
            <button className="do-viewall-btn">View All</button>
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Active Challenges + History ── */}
      <div className="do-bot">
        {/* Active Challenges */}
        <div className="do-chal">
          <h3 className="do-chal-title">Active Challenges</h3>
          <div className="do-chal-body">
            <div className="do-chal-name">$25,000 Challenge</div>
            <div className="do-chal-track">
              <div className="do-chal-fill" style={{ width: '64%' }}></div>
            </div>
            <div className="do-chal-labels">
              <span>$0</span>
              <span>$25,000</span>
            </div>
          </div>
          <button className="do-chal-btn">Start New Challenge</button>
        </div>

        {/* History */}
        <div className="do-hist">
          <div className="do-hist-top">
            <h3>History</h3>
            <button className="do-viewall-btn">View All</button>
          </div>
          <div className="do-hist-table">
            <div className="do-hist-head">
              <span>Trade ID</span>
              <span>Date &amp; Time</span>
              <span>Symbol</span>
              <span>Side</span>
              <span>Leverage</span>
              <span>PNL</span>
            </div>
            {recentTrades.map((t, i) => (
              <div key={i} className="do-hist-row">
                <span>{t.id}</span>
                <span>{t.date}</span>
                <span>{t.symbol}</span>
                <span className="do-long">{t.side}</span>
                <span>{t.leverage}</span>
                <span className="do-pnl-green">+${t.pnl.toFixed(2)} (+{t.change.toFixed(2)}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardOverview
