import { useState, useEffect, useCallback } from 'react'

function DashboardOverview() {
  const [timeRange, setTimeRange] = useState('1H')
  const [selectedMarket, setSelectedMarket] = useState(null)
  const [isLoadingPrices, setIsLoadingPrices] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [sortBy, setSortBy] = useState('default') // default, price-high, price-low, change-high, change-low, name
  const [priceAlerts, setPriceAlerts] = useState([]) // { symbol, targetPrice, condition: 'above' | 'below', triggered: false }
  const [showAlertModal, setShowAlertModal] = useState(false)
  const [alertModalMarket, setAlertModalMarket] = useState(null)
  const [notifications, setNotifications] = useState([]) // { id, message, type: 'success' | 'info' }
  const [showMarketsModal, setShowMarketsModal] = useState(false)
  
  // Stats reset to zero for new users
  const [stats] = useState({
    activeChallenges: 0,
    totalPNL: 0,
    winRate: 0,
    currentEquity: 0,
    daysActive: 0
  })

  // Real-time market data from CoinGecko - Expanded list
  const [markets, setMarkets] = useState([
    // Top favorites
    { symbol: 'BTCUSDT', name: 'Bitcoin', price: 0, change: 0, favorite: true },
    { symbol: 'ETHUSDT', name: 'Ethereum', price: 0, change: 0, favorite: true },
    
    // Popular coins
    { symbol: 'SOLUSDT', name: 'Solana', price: 0, change: 0, favorite: false },
    { symbol: 'BNBUSDT', name: 'Binance Coin', price: 0, change: 0, favorite: false },
    { symbol: 'XRPUSDT', name: 'XRP', price: 0, change: 0, favorite: false },
    { symbol: 'ADAUSDT', name: 'Cardano', price: 0, change: 0, favorite: false },
    { symbol: 'DOGEUSDT', name: 'Dogecoin', price: 0, change: 0, favorite: false },
    { symbol: 'AVAXUSDT', name: 'Avalanche', price: 0, change: 0, favorite: false },
    { symbol: 'DOTUSDT', name: 'Polkadot', price: 0, change: 0, favorite: false },
    { symbol: 'MATICUSDT', name: 'Polygon', price: 0, change: 0, favorite: false },
    { symbol: 'LINKUSDT', name: 'Chainlink', price: 0, change: 0, favorite: false },
    { symbol: 'UNIUSDT', name: 'Uniswap', price: 0, change: 0, favorite: false },
    { symbol: 'ATOMUSDT', name: 'Cosmos', price: 0, change: 0, favorite: false },
    { symbol: 'LTCUSDT', name: 'Litecoin', price: 0, change: 0, favorite: false },
    { symbol: 'NEARUSDT', name: 'NEAR Protocol', price: 0, change: 0, favorite: false },
    { symbol: 'APTUSDT', name: 'Aptos', price: 0, change: 0, favorite: false },
    { symbol: 'ARBUSDT', name: 'Arbitrum', price: 0, change: 0, favorite: false },
    { symbol: 'OPUSDT', name: 'Optimism', price: 0, change: 0, favorite: false }
  ])

  // No trades for new users
  const [recentTrades] = useState([])

  // Filter markets based on search query and favorites filter
  const filteredMarkets = markets.filter(market => {
    // Search filter
    const matchesSearch = !searchQuery || 
      market.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      market.name.toLowerCase().includes(searchQuery.toLowerCase())
    
    // Favorites filter
    const matchesFavorites = !showFavoritesOnly || market.favorite
    
    return matchesSearch && matchesFavorites
  })

  // Sort filtered markets
  const sortedMarkets = [...filteredMarkets].sort((a, b) => {
    // If default sorting, favorites first
    if (sortBy === 'default') {
      if (a.favorite && !b.favorite) return -1
      if (!a.favorite && b.favorite) return 1
      return 0
    }
    
    // Price sorting
    if (sortBy === 'price-high') return b.price - a.price
    if (sortBy === 'price-low') return a.price - b.price
    
    // Change % sorting
    if (sortBy === 'change-high') return b.change - a.change
    if (sortBy === 'change-low') return a.change - b.change
    
    // Alphabetical sorting
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    
    return 0
  })

  // Add notification - wrapped in useCallback to prevent dependency issues
  const addNotification = useCallback((message, type = 'info') => {
    const id = Date.now()
    setNotifications(prev => [...prev, { id, message, type }])
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 5000)
    
    // Note: Audio notification removed as it requires user interaction in most browsers
  }, [])

  // Remove price alert - wrapped in useCallback
  const removePriceAlert = useCallback((alertId) => {
    setPriceAlerts(prev => {
      const updated = prev.filter(alert => alert.id !== alertId)
      localStorage.setItem('priceAlerts', JSON.stringify(updated))
      return updated
    })
  }, [])

  // Set price alert
  const setPriceAlert = useCallback((symbol, targetPrice, condition) => {
    const newAlert = {
      id: Date.now(),
      symbol,
      targetPrice,
      condition,
      triggered: false
    }
    setPriceAlerts(prev => {
      const updated = [...prev, newAlert]
      localStorage.setItem('priceAlerts', JSON.stringify(updated))
      return updated
    })
    addNotification(`Alert set for ${symbol} ${condition} $${targetPrice}`, 'info')
    setShowAlertModal(false)
  }, [addNotification])

  // Load alerts from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('priceAlerts')
      if (saved) {
        const alerts = JSON.parse(saved)
        setPriceAlerts(alerts)
      }
    } catch (error) {
      console.error('Error loading price alerts:', error)
    }
  }, [])

  // Check price alerts whenever markets update
  useEffect(() => {
    if (markets.length === 0 || priceAlerts.length === 0) return
    
    priceAlerts.forEach(alert => {
      if (alert.triggered) return // Already triggered
      
      const market = markets.find(m => m.symbol === alert.symbol)
      if (!market || market.price === 0) return
      
      let shouldTrigger = false
      if (alert.condition === 'above' && market.price >= alert.targetPrice) {
        shouldTrigger = true
      } else if (alert.condition === 'below' && market.price <= alert.targetPrice) {
        shouldTrigger = true
      }
      
      if (shouldTrigger) {
        // Mark as triggered
        setPriceAlerts(prev => prev.map(a => 
          a.id === alert.id ? { ...a, triggered: true } : a
        ))
        
        // Show notification
        addNotification(
          `🚨 ${market.name} is now ${alert.condition} $${alert.targetPrice}! Current: $${market.price.toFixed(2)}`,
          'success'
        )
        
        // Auto-remove after triggering
        setTimeout(() => removePriceAlert(alert.id), 10000)
      }
    })
  }, [markets, priceAlerts, addNotification, removePriceAlert])

  // Fetch real prices from CoinGecko API (better CORS support than Binance)
  useEffect(() => {
    const fetchPrices = async () => {
      // Map Binance symbols to CoinGecko IDs - Expanded list
      const coinGeckoMap = {
        'BTCUSDT': { id: 'bitcoin', symbol: 'BTC' },
        'ETHUSDT': { id: 'ethereum', symbol: 'ETH' },
        'SOLUSDT': { id: 'solana', symbol: 'SOL' },
        'BNBUSDT': { id: 'binancecoin', symbol: 'BNB' },
        'XRPUSDT': { id: 'ripple', symbol: 'XRP' },
        'ADAUSDT': { id: 'cardano', symbol: 'ADA' },
        'DOGEUSDT': { id: 'dogecoin', symbol: 'DOGE' },
        'AVAXUSDT': { id: 'avalanche-2', symbol: 'AVAX' },
        'DOTUSDT': { id: 'polkadot', symbol: 'DOT' },
        'MATICUSDT': { id: 'polygon-ecosystem-token', symbol: 'MATIC' },
        'LINKUSDT': { id: 'chainlink', symbol: 'LINK' },
        'UNIUSDT': { id: 'uniswap', symbol: 'UNI' },
        'ATOMUSDT': { id: 'cosmos', symbol: 'ATOM' },
        'LTCUSDT': { id: 'litecoin', symbol: 'LTC' },
        'NEARUSDT': { id: 'near', symbol: 'NEAR' },
        'APTUSDT': { id: 'aptos', symbol: 'APT' },
        'ARBUSDT': { id: 'arbitrum', symbol: 'ARB' },
        'OPUSDT': { id: 'optimism', symbol: 'OP' }
      }
      
      console.log('🔄 Fetching prices from CoinGecko...')
      
      try {
        // CoinGecko API - fetch all coins at once
        const ids = Object.values(coinGeckoMap).map(coin => coin.id).join(',')
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
        )
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }
        
        const data = await response.json()
        console.log('📊 CoinGecko response:', data)
        
        setMarkets(prevMarkets =>
          prevMarkets.map(market => {
            const coinInfo = coinGeckoMap[market.symbol]
            const coinData = coinInfo && data[coinInfo.id]
            
            if (coinData) {
              console.log(`✅ Updating ${market.symbol}: $${coinData.usd}`)
              return {
                ...market,
                price: coinData.usd,
                change: coinData.usd_24h_change || 0
              }
            }
            console.log(`⚠️ No data for ${market.symbol}`)
            return market
          })
        )
        
        setIsLoadingPrices(false)
        console.log('✅ Price update complete')
      } catch (error) {
        console.error('❌ Error fetching CoinGecko prices:', error)
        setIsLoadingPrices(false)
      }
    }

    // Fetch immediately
    fetchPrices()

    // Then update every 30 seconds (CoinGecko rate limit is generous)
    const interval = setInterval(fetchPrices, 30000)

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
          
          {/* Search Input */}
          <div className="market-search">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search BTC, ETH, SOL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button 
                className="clear-search"
                onClick={() => setSearchQuery('')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>

          {/* Filter and Sort Controls */}
          <div className="market-controls">
            {/* Favorites Filter Toggle */}
            <button 
              className={`filter-toggle ${showFavoritesOnly ? 'active' : ''}`}
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              title={showFavoritesOnly ? 'Show all markets' : 'Show favorites only'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={showFavoritesOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span>{showFavoritesOnly ? 'Favorites' : 'All'}</span>
            </button>

            {/* Sort Dropdown */}
            <select 
              className="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="default">Default</option>
              <option value="price-high">Price: High to Low</option>
              <option value="price-low">Price: Low to High</option>
              <option value="change-high">Gainers</option>
              <option value="change-low">Losers</option>
              <option value="name">A-Z</option>
            </select>
          </div>

          <div className="markets-list">
            {sortedMarkets.length === 0 ? (
              <div className="no-results">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>
                <p>No markets found</p>
                <span>
                  {showFavoritesOnly 
                    ? 'No favorite markets. Star some coins to see them here!'
                    : 'Try searching for BTC, ETH, or SOL'
                  }
                </span>
              </div>
            ) : (
              sortedMarkets.map((market) => (
                <div 
                  key={market.symbol} 
                  className={`market-item ${selectedMarket?.symbol === market.symbol ? 'selected' : ''}`}
                  onClick={() => handleMarketClick(market)}
                >
                  <div className="market-info">
                    <div className="market-symbol-row">
                      <div className="market-symbol">{market.symbol}</div>
                      <div className="market-actions">
                        <button 
                          className={`favorite-btn ${market.favorite ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleFavorite(market.symbol)
                          }}
                          title="Add to favorites"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill={market.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                        </button>
                        <button 
                          className="alert-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            setAlertModalMarket(market)
                            setShowAlertModal(true)
                          }}
                          title="Set price alert"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                          </svg>
                        </button>
                      </div>
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
              ))
            )}
          </div>
          <button className="btn-view-all" onClick={() => setShowMarketsModal(true)}>
            View All Markets
          </button>
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

      {/* Price Alert Modal */}
      {showAlertModal && alertModalMarket && (
        <div className="modal-overlay" onClick={() => setShowAlertModal(false)}>
          <div className="alert-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Set Price Alert</h3>
              <button className="modal-close" onClick={() => setShowAlertModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="alert-market-info">
                <div className="alert-market-name">{alertModalMarket.name}</div>
                <div className="alert-current-price">
                  Current: {formatPrice(alertModalMarket.price, alertModalMarket.price < 1 ? 4 : 2)}
                </div>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.target)
                const targetPrice = parseFloat(formData.get('targetPrice'))
                const condition = formData.get('condition')
                if (targetPrice && condition) {
                  setPriceAlert(alertModalMarket.symbol, targetPrice, condition)
                }
              }}>
                <div className="form-group">
                  <label>Notify me when price goes</label>
                  <select name="condition" className="alert-select" required>
                    <option value="above">Above</option>
                    <option value="below">Below</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Target Price ($)</label>
                  <input 
                    type="number" 
                    name="targetPrice"
                    step="any"
                    placeholder="Enter price..."
                    className="alert-input"
                    required
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-cancel" onClick={() => setShowAlertModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-set-alert">
                    Set Alert
                  </button>
                </div>
              </form>
              
              {/* Active alerts for this market */}
              {priceAlerts.filter(a => a.symbol === alertModalMarket.symbol && !a.triggered).length > 0 && (
                <div className="active-alerts">
                  <h4>Active Alerts</h4>
                  {priceAlerts
                    .filter(a => a.symbol === alertModalMarket.symbol && !a.triggered)
                    .map(alert => (
                      <div key={alert.id} className="alert-item">
                        <span>{alert.condition} ${alert.targetPrice}</span>
                        <button onClick={() => removePriceAlert(alert.id)} className="btn-remove-alert">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full Markets Modal */}
      {showMarketsModal && (
        <div className="modal-overlay" onClick={() => setShowMarketsModal(false)}>
          <div className="markets-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>All Markets</h3>
              <button className="modal-close" onClick={() => setShowMarketsModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="markets-modal-body">
              {/* Search and Controls */}
              <div className="market-search">
                <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search BTC, ETH, SOL..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                {searchQuery && (
                  <button 
                    className="clear-search"
                    onClick={() => setSearchQuery('')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                )}
              </div>

              <div className="market-controls">
                <button 
                  className={`filter-toggle ${showFavoritesOnly ? 'active' : ''}`}
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={showFavoritesOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  <span>{showFavoritesOnly ? 'Favorites' : 'All'}</span>
                </button>

                <select 
                  className="sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="default">Default</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="change-high">Gainers</option>
                  <option value="change-low">Losers</option>
                  <option value="name">A-Z</option>
                </select>
              </div>

              {/* Markets Table - Binance Style */}
              <div className="markets-table-container">
                {sortedMarkets.length === 0 ? (
                  <div className="no-results">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="11" cy="11" r="8"/>
                      <path d="m21 21-4.35-4.35"/>
                    </svg>
                    <p>No markets found</p>
                    <span>
                      {showFavoritesOnly 
                        ? 'No favorite markets. Star some coins!'
                        : 'Try searching for BTC, ETH, or SOL'
                      }
                    </span>
                  </div>
                ) : (
                  <table className="markets-table">
                    <thead>
                      <tr>
                        <th className="text-left">Name</th>
                        <th className="text-right">Last Price / 24h Change</th>
                        <th className="text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedMarkets.map((market) => (
                        <tr 
                          key={market.symbol} 
                          className="market-table-row"
                          onClick={() => handleMarketClick(market)}
                        >
                          <td className="market-name-cell">
                            <button 
                              className={`favorite-btn-table ${market.favorite ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleFavorite(market.symbol)
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill={market.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                              </svg>
                            </button>
                            <div className="market-name-info">
                              <div className="market-symbol-table">{market.symbol}</div>
                              <div className="market-name-table">{market.name}</div>
                            </div>
                          </td>
                          <td className="text-right market-price-cell">
                            <div className="price-and-change">
                              <div className="market-price-value">
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
                              <span className={`change-badge ${market.change > 0 ? 'positive' : market.change < 0 ? 'negative' : ''}`}>
                                {market.price === 0 ? (
                                  isLoadingPrices ? '...' : 'N/A'
                                ) : formatPercent(market.change)}
                              </span>
                            </div>
                          </td>
                          <td className="text-center">
                            <button 
                              className="alert-btn-table"
                              onClick={(e) => {
                                e.stopPropagation()
                                setAlertModalMarket(market)
                                setShowAlertModal(true)
                              }}
                              title="Set price alert"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notifications */}
      <div className="notifications-container">
        {notifications.map(notification => (
          <div key={notification.id} className={`notification ${notification.type}`}>
            <div className="notification-icon">
              {notification.type === 'success' ? '🚨' : 'ℹ️'}
            </div>
            <div className="notification-message">{notification.message}</div>
            <button 
              className="notification-close"
              onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default DashboardOverview
