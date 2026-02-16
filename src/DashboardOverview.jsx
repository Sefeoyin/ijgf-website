import { useState, useEffect } from 'react'

function DashboardOverview() {
  const [timeRange, setTimeRange] = useState('1H')
  const [selectedMarket, setSelectedMarket] = useState(null)
  const [isLoadingPrices, setIsLoadingPrices] = useState(true)
  
  // Stats reset to zero for new users
  const [stats] = useState({
    activeChallenges: 0,
    totalPNL: 0,
    winRate: 0,
    currentEquity: 0,
    daysActive: 0
  })

  // Real-time market data from Binance
  const [markets, setMarkets] = useState([
    { symbol: 'BTCUSDT', name: 'Bitcoin', price: 0, change: 0, favorite: true },
    { symbol: 'ETHUSDT', name: 'Ethereum', price: 0, change: 0, favorite: true },
    { symbol: 'SOLUSDT', name: 'Solana', price: 0, change: 0, favorite: false },
    { symbol: 'BNBUSDT', name: 'Binance', price: 0, change: 0, favorite: false },
    { symbol: 'ADAUSDT', name: 'Cardano', price: 0, change: 0, favorite: false },
    { symbol: 'XRPUSDT', name: 'XRP', price: 0, change: 0, favorite: false }
  ])

  // No trades for new users
  const [recentTrades] = useState([])

  // Fetch real prices from Binance API
  useEffect(() => {
    const fetchPrices = async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT']
      
      console.log('🔄 Fetching prices from Binance...')
      
      try {
        // Fetch prices and 24h changes in parallel for all symbols
        const pricePromises = symbols.map(symbol =>
          fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`)
            .then(res => {
              console.log(`✅ Price response for ${symbol}:`, res.status)
              return res.json()
            })
            .catch(err => {
              console.error(`❌ Price fetch failed for ${symbol}:`, err)
              return null
            })
        )
        
        const changePromises = symbols.map(symbol =>
          fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
            .then(res => {
              console.log(`✅ 24hr response for ${symbol}:`, res.status)
              return res.json()
            })
            .catch(err => {
              console.error(`❌ 24hr fetch failed for ${symbol}:`, err)
              return null
            })
        )
        
        const [priceResults, changeResults] = await Promise.all([
          Promise.all(pricePromises),
          Promise.all(changePromises)
        ])
        
        console.log('📊 Price results:', priceResults)
        console.log('📈 Change results:', changeResults)
        
        setMarkets(prevMarkets =>
          prevMarkets.map((market, index) => {
            const priceData = priceResults[index]
            const changeData = changeResults[index]
            
            if (priceData && priceData.price) {
              console.log(`✅ Updating ${market.symbol}: $${priceData.price}`)
              return {
                ...market,
                price: parseFloat(priceData.price),
                change: changeData && changeData.priceChangePercent 
                  ? parseFloat(changeData.priceChangePercent) 
                  : market.change
              }
            }
            console.log(`⚠️ No data for ${market.symbol}`)
            return market
          })
        )
        
        setIsLoadingPrices(false)
        console.log('✅ Price update complete')
      } catch (error) {
        console.error('❌ Error fetching Binance prices:', error)
        setIsLoadingPrices(false)
      }
    }

    // Fetch immediately
    fetchPrices()

    // Then update every 10 seconds
    const interval = setInterval(fetchPrices, 10000)

    return () => clearInterval(interval)
  }, []) // Empty dependency array is intentional - we only want to set up the interval once

  // Chart data based on time range - empty for new users
  const chartData = {
    '1H': {
      path: 'M 50 170 L 750 170', // Flat line at zero
      fillPath: 'M 50 170 L 750 170 L 750 170 L 50 170 Z',
      dates: ['12:00', '12:15', '12:30', '12:45', '1:00'],
      equity: 0,
      change: 0
    },
    '3H': {
      path: 'M 50 170 L 750 170',
      fillPath: 'M 50 170 L 750 170 L 750 170 L 50 170 Z',
      dates: ['10:00', '11:00', '12:00', '1:00', '2:00'],
      equity: 0,
      change: 0
    },
    '5H': {
      path: 'M 50 170 L 750 170',
      fillPath: 'M 50 170 L 750 170 L 750 170 L 50 170 Z',
      dates: ['9:00', '10:30', '12:00', '1:30', '3:00'],
      equity: 0,
      change: 0
    },
    '1D': {
      path: 'M 50 170 L 750 170',
      fillPath: 'M 50 170 L 750 170 L 750 170 L 50 170 Z',
      dates: ['9am', '12pm', '3pm', '6pm', '9pm'],
      equity: 0,
      change: 0
    },
    '1W': {
      path: 'M 50 170 L 750 170',
      fillPath: 'M 50 170 L 750 170 L 750 170 L 50 170 Z',
      dates: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      equity: 0,
      change: 0
    },
    '1M': {
      path: 'M 50 170 L 750 170',
      fillPath: 'M 50 170 L 750 170 L 750 170 L 50 170 Z',
      dates: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'],
      equity: 0,
      change: 0
    }
  }

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
                
                {/* Chart path - flat line for zero equity */}
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
                      {market.price === 0 ? (
                        isLoadingPrices ? 'Loading...' : 'N/A'
                      ) : (
                        market.price < 1 
                          ? formatPrice(market.price, 4)
                          : market.price < 100
                          ? formatPrice(market.price, 2)
                          : formatPrice(market.price, 0)
                      )}
                    </div>
                    <div className={`market-change ${market.change > 0 ? 'positive' : market.change < 0 ? 'negative' : ''}`}>
                      {market.price === 0 ? (
                        isLoadingPrices ? '...' : 'N/A'
                      ) : formatPercent(market.change)}
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
          <div className="challenge-card empty-state">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <p className="empty-text">No active challenges</p>
            <p className="empty-subtext">Start a challenge to begin trading</p>
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
            {recentTrades.length === 0 ? (
              <div className="empty-history">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
                <p>No trading history yet</p>
                <span>Your trades will appear here</span>
              </div>
            ) : (
              recentTrades.map((trade, index) => (
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
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardOverview
