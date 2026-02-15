import { useState } from 'react'

function DashboardOverview() {
  const [timeRange, setTimeRange] = useState('1H')
  const [stats] = useState({
    activeChallenges: 2,
    totalPNL: 2980.00,
    winRate: 85,
    currentEquity: 12980.00,
    daysActive: 7
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

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatPercent = (value) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  return (
    <div className="dashboard-overview">
      {/* Top Stats Cards - 4 cards in one row */}
      <div className="stats-cards-row">
        <div className="stats-card">
          <div className="stats-card-header">
            <div className="stats-icon blue">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <span className="stats-label">Active Challenges</span>
          </div>
          <div className="stats-value">{stats.activeChallenges}</div>
          <div className="stats-subtitle">Currently in progress</div>
        </div>

        <div className="stats-card">
          <div className="stats-card-header">
            <div className="stats-icon gold">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <span className="stats-label">Total PNL</span>
          </div>
          <div className="stats-value">{formatCurrency(stats.totalPNL)}</div>
          <div className="stats-subtitle">All time performance</div>
        </div>

        <div className="stats-card">
          <div className="stats-card-header">
            <div className="stats-icon purple">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <span className="stats-label">Win Rate</span>
          </div>
          <div className="stats-value">{stats.winRate}%</div>
          <div className="stats-subtitle">Success rate</div>
        </div>

        <div className="stats-card">
          <div className="stats-card-header">
            <div className="stats-icon red">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                <line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
            </div>
            <span className="stats-label">Current Equity</span>
          </div>
          <div className="stats-value">{formatCurrency(stats.currentEquity)}</div>
          <div className="stats-subtitle">All time performance</div>
        </div>
      </div>

      {/* Middle Row - Equity Chart + Markets Side by Side */}
      <div className="dashboard-middle-row">
        {/* Equity Chart - Takes 2/3 width */}
        <div className="equity-chart-widget">
          <div className="widget-header">
            <div>
              <h3>Equity Chart</h3>
              <p className="widget-subtitle">All time performance</p>
            </div>
            <div className="equity-stats">
              <div className="equity-value">{formatCurrency(stats.currentEquity)}</div>
              <div className="equity-change positive">+23.6%</div>
            </div>
          </div>

          <div className="time-range-selector">
            {['1H', '3H', '5H', '1D', '1W', '1M'].map((range) => (
              <button
                key={range}
                className={`time-range-btn ${timeRange === range ? 'active' : ''}`}
                onClick={() => setTimeRange(range)}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Compact SVG Chart */}
          <div className="chart-container">
            <svg width="100%" height="220" viewBox="0 0 800 220" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style={{ stopColor: 'rgba(124, 58, 237, 0.3)', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: 'rgba(124, 58, 237, 0)', stopOpacity: 1 }} />
                </linearGradient>
              </defs>
              
              <path
                d="M 50 110 Q 150 160 200 60 T 400 90 T 600 140 T 750 200"
                fill="none"
                stroke="#7c3aed"
                strokeWidth="2.5"
              />
              
              <path
                d="M 50 110 Q 150 160 200 60 T 400 90 T 600 140 T 750 200 L 750 220 L 50 220 Z"
                fill="url(#chartGradient)"
              />
            </svg>
            
            <div className="chart-dates">
              <span>Dec 17</span>
              <span>Dec 18</span>
              <span>Dec 18</span>
              <span>Dec 19</span>
              <span>Dec 19</span>
            </div>
          </div>
        </div>

        {/* Markets Widget - Takes 1/3 width */}
        <div className="markets-widget">
          <div className="widget-header">
            <h3>Markets</h3>
          </div>
          <div className="markets-list">
            {markets.map((market) => (
              <div key={market.symbol} className="market-item">
                <div className="market-info">
                  <div className="market-symbol">{market.symbol}</div>
                  <div className="market-name">{market.name}</div>
                </div>
                <div className="market-stats">
                  <div className="market-price">${market.price.toLocaleString()}</div>
                  <div className={`market-change ${market.change > 0 ? 'positive' : 'negative'}`}>
                    {formatPercent(market.change)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="btn-view-all">View All</button>
        </div>
      </div>

      {/* Bottom Row - Active Challenges + History Side by Side */}
      <div className="dashboard-bottom-row">
        {/* Active Challenges - Takes 1/3 width */}
        <div className="active-challenges-widget">
          <h3>Active Challenges</h3>
          <div className="challenge-card">
            <div className="challenge-title">$25,000 Challenge</div>
            <div className="challenge-progress-bar">
              <div className="progress-fill" style={{ width: '64%' }}></div>
            </div>
            <div className="challenge-labels">
              <span>$0</span>
              <span>$25,000</span>
            </div>
          </div>
          <button className="btn-start-challenge">Start New Challenge</button>
        </div>

        {/* History Widget - Takes 2/3 width */}
        <div className="history-widget">
          <div className="widget-header">
            <h3>History</h3>
            <button className="btn-view-all-link">View All</button>
          </div>
          <div className="history-table">
            <div className="table-header">
              <div>Trade ID</div>
              <div>Date & Time</div>
              <div>Symbol</div>
              <div>Side</div>
              <div>Leverage</div>
              <div>PNL</div>
            </div>
            {recentTrades.map((trade, index) => (
              <div key={index} className="table-row">
                <div>{trade.id}</div>
                <div>{trade.date}</div>
                <div>{trade.symbol}</div>
                <div className={trade.side.toLowerCase()}>{trade.side}</div>
                <div>{trade.leverage}</div>
                <div className="positive">
                  +${trade.pnl.toFixed(2)} ({formatPercent(trade.change)})
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardOverview