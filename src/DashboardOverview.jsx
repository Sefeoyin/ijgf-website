import { useState, useEffect } from 'react'

function DashboardOverview() {
  const [timeRange, setTimeRange] = useState('1H')
  const [selectedMarket, setSelectedMarket] = useState(null)
  const [stats, setStats] = useState({
    activeChallenges: 2,
    totalPNL: 2980.00,
    winRate: 85,
    currentEquity: 12980.00,
    daysActive: 7
  })

  const [markets, setMarkets] = useState([
    { symbol: 'SOLUSDT', name: 'Solana', price: 495, change: 11.1, favorite: false },
    { symbol: 'BNBUSDT', name: 'Binance', price: 267, change: 6.7, favorite: false },
    { symbol: 'ADAUSDT', name: 'Cardano', price: 0.49, change: -1.4, favorite: false },
    { symbol: 'BTCUSDT', name: 'Bitcoin', price: 23495, change: 23.4, favorite: true },
    { symbol: 'ETHUSDT', name: 'Ethereum', price: 15978, change: -0.3, favorite: true },
    { symbol: 'AXSUSDT', name: 'Axie Infinity', price: 15.9, change: -7.8, favorite: false }
  ])

  const [recentTrades] = useState([
    { id: 'TRD-10482', date: '08/12/25 2:41pm', symbol: 'BTC/USDT', side: 'Long', leverage: '5x', pnl: 553.50, change: 2.01 },
    { id: 'TRD-10481', date: '08/12/25 2:38pm', symbol: 'ETH/USDT', side: 'Short', leverage: '3x', pnl: -124.30, change: -0.8 },
    { id: 'TRD-10480', date: '08/12/25 2:35pm', symbol: 'SOL/USDT', side: 'Long', leverage: '5x', pnl: 287.90, change: 1.5 }
  ])

  // Chart data based on time range
  const chartData = {
    '1H': {
      path: 'M 50 90 Q 150 120 200 50 T 400 75 T 600 105 T 750 155',
      fillPath: 'M 50 90 Q 150 120 200 50 T 400 75 T 600 105 T 750 155 L 750 170 L 50 170 Z',
      dates: ['12:00', '12:15', '12:30', '12:45', '1:00'],
      equity: 12980,
      change: 2.3
    },
    '3H': {
      path: 'M 50 110 Q 150 95 200 70 T 400 85 T 600 95 T 750 140',
      fillPath: 'M 50 110 Q 150 95 200 70 T 400 85 T 600 95 T 750 140 L 750 170 L 50 170 Z',
      dates: ['10:00', '11:00', '12:00', '1:00', '2:00'],
      equity: 12845,
      change: 1.8
    },
    '5H': {
      path: 'M 50 125 Q 150 110 200 85 T 400 100 T 600 110 T 750 135',
      fillPath: 'M 50 125 Q 150 110 200 85 T 400 100 T 600 110 T 750 135 L 750 170 L 50 170 Z',
      dates: ['9:00', '10:30', '12:00', '1:30', '3:00'],
      equity: 12720,
      change: 1.2
    },
    '1D': {
      path: 'M 50 135 Q 150 125 200 95 T 400 110 T 600 120 T 750 145',
      fillPath: 'M 50 135 Q 150 125 200 95 T 400 110 T 600 120 T 750 145 L 750 170 L 50 170 Z',
      dates: ['9am', '12pm', '3pm', '6pm', '9pm'],
      equity: 12580,
      change: 0.8
    },
    '1W': {
      path: 'M 50 145 Q 150 135 200 105 T 400 120 T 600 130 T 750 150',
      fillPath: 'M 50 145 Q 150 135 200 105 T 400 120 T 600 130 T 750 150 L 750 170 L 50 170 Z',
      dates: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      equity: 12350,
      change: -0.5
    },
    '1M': {
      path: 'M 50 150 Q 150 140 200 115 T 400 125 T 600 135 T 750 155',
      fillPath: 'M 50 150 Q 150 140 200 115 T 400 125 T 600 135 T 750 155 L 750 170 L 50 170 Z',
      dates: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'],
      equity: 11980,
      change: -7.7
    }
  }

  // Simulate real-time price updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMarkets(prevMarkets => 
        prevMarkets.map(market => ({
          ...market,
          price: market.price * (1 + (Math.random() - 0.5) * 0.002), // ±0.1% change
          change: market.change + (Math.random() - 0.5) * 0.2
        }))
      )
    }, 3000) // Update every 3 seconds

    return () => clearInterval(interval)
  }, [])

  // Simulate equity updates
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prevStats => ({
        ...prevStats,
        currentEquity: prevStats.currentEquity * (1 + (Math.random() - 0.5) * 0.001),
        totalPNL: prevStats.totalPNL * (1 + (Math.random() - 0.5) * 0.001)
      }))
    }, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [])

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatPrice = (value, decimals = 0) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value)
  }

  const formatPercent = (value) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  const toggleFavorite = (symbol) => {
    setMarkets(prevMarkets =>
      prevMarkets.map(market =>
        market.symbol === symbol
          ? { ...market, favorite: !market.favorite }
          : market
      )
    )
  }

  const handleMarketClick = (market) => {
    setSelectedMarket(market)
    console.log('Market selected:', market)
    // TODO: Navigate to detailed trading view or show modal
  }

  const currentChart = chartData[timeRange]

  return (
    <div className="dashboard-overview">
      {/* Top Stats Cards - 4 cards in one row */}
      <div className="stats-cards-row">
        <div className="stats-card">
          <div className="stats-card-header">
            <div className="stats-icon blue">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

      {/* Main Widgets - 2x2 Grid */}
      <div className="dashboard-widgets-grid">
        {/* Equity Chart - Top Left */}
        <div className="equity-chart-widget">
          <div className="widget-header">
            <div>
              <h3>Equity Chart</h3>
              <p className="widget-subtitle">All time performance</p>
            </div>
            <div className="equity-stats">
              <div className="equity-value">{formatCurrency(currentChart.equity)}</div>
              <div className={`equity-change ${currentChart.change >= 0 ? 'positive' : 'negative'}`}>
                {formatPercent(currentChart.change)}
              </div>
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

          {/* Chart with Y-axis and X-axis labels */}
          <div className="chart-container">
            {/* Y-axis labels */}
            <div className="chart-y-axis">
              <span>$25,000</span>
              <span>$20,000</span>
              <span>$15,000</span>
              <span>$10,000</span>
              <span>$5,000</span>
            </div>
            
            {/* Chart SVG */}
            <div className="chart-svg-wrapper">
              <svg width="100%" height="100%" viewBox="0 0 800 200" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style={{ stopColor: 'rgba(124, 58, 237, 0.3)', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: 'rgba(124, 58, 237, 0)', stopOpacity: 1 }} />
                  </linearGradient>
                </defs>
                
                {/* Chart path - animates when time range changes */}
                <path
                  d={currentChart.path}
                  fill="none"
                  stroke="#7c3aed"
                  strokeWidth="2.5"
                  style={{ transition: 'd 0.5s ease' }}
                />
                
                <path
                  d={currentChart.fillPath}
                  fill="url(#chartGradient)"
                  style={{ transition: 'd 0.5s ease' }}
                />
                
                {/* X-axis date labels */}
                {currentChart.dates.map((date, index) => (
                  <text 
                    key={index}
                    x={100 + (index * 160)} 
                    y="195" 
                    fill="rgba(255, 255, 255, 0.45)" 
                    fontSize="11" 
                    textAnchor="middle"
                  >
                    {date}
                  </text>
                ))}
              </svg>
            </div>
          </div>
        </div>

        {/* Markets Widget - Top Right */}
        <div className="markets-widget">
          <div className="widget-header">
            <h3>Markets</h3>
            <span className="live-indicator">
              <span className="live-dot"></span>
              Live
            </span>
          </div>
          <div className="markets-list">
            {markets
              .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0))
              .map((market) => (
                <div 
                  key={market.symbol} 
                  className={`market-item ${selectedMarket?.symbol === market.symbol ? 'selected' : ''}`}
                  onClick={() => handleMarketClick(market)}
                >
                  <div className="market-info">
                    <div className="market-symbol-row">
                      <div className="market-symbol">{market.symbol}</div>
                      <button 
                        className={`favorite-btn ${market.favorite ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleFavorite(market.symbol)
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={market.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                      </button>
                    </div>
                    <div className="market-name">{market.name}</div>
                  </div>
                  <div className="market-stats">
                    <div className="market-price">
                      {market.price < 1 
                        ? formatPrice(market.price, 2)
                        : market.price < 100
                        ? formatPrice(market.price, 1)
                        : formatPrice(market.price, 0)
                      }
                    </div>
                    <div className={`market-change ${market.change > 0 ? 'positive' : 'negative'}`}>
                      {formatPercent(market.change)}
                    </div>
                  </div>
                </div>
              ))}
          </div>
          <button className="btn-view-all">View All Markets</button>
        </div>

        {/* Active Challenges - Bottom Left */}
        <div className="active-challenges-widget">
          <h3>Active Challenges</h3>
          <div className="challenge-card">
            <div className="challenge-title">$25,000 Challenge</div>
            <div className="challenge-progress-bar">
              <div className="progress-fill" style={{ width: '64%' }}></div>
            </div>
            <div className="challenge-labels">
              <span>$0</span>
              <span>$16,000 / $25,000</span>
            </div>
            <div className="challenge-stats">
              <div className="challenge-stat">
                <span className="stat-label">Daily Limit</span>
                <span className="stat-value">4%</span>
              </div>
              <div className="challenge-stat">
                <span className="stat-label">Max Drawdown</span>
                <span className="stat-value">6%</span>
              </div>
            </div>
          </div>
          <button className="btn-start-challenge">Start New Challenge</button>
        </div>

        {/* History Widget - Bottom Right */}
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
                <div className={`trade-side ${trade.side.toLowerCase()}`}>{trade.side}</div>
                <div>{trade.leverage}</div>
                <div className={trade.pnl >= 0 ? 'positive' : 'negative'}>
                  {trade.pnl >= 0 ? '+' : ''}${Math.abs(trade.pnl).toFixed(2)} ({formatPercent(trade.change)})
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
