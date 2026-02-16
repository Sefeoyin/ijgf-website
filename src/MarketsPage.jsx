import { useState, useEffect } from 'react'

function MarketsPage() {
  // Market Selection
  const [selectedPair, setSelectedPair] = useState('BTCUSDT')
  const [marketPrice, setMarketPrice] = useState(0)
  const [priceChange, setPriceChange] = useState(0)
  const [priceChangePercent, setPriceChangePercent] = useState(0)
  const [high24h, setHigh24h] = useState(0)
  const [low24h, setLow24h] = useState(0)
  const [volume24h, setVolume24h] = useState(0)
  
  // Order Entry
  const [orderType, setOrderType] = useState('Limit') // Limit, Market, Stop-Limit
  const [price, setPrice] = useState('')
  const [amount, setAmount] = useState('')
  const [total, setTotal] = useState('')
  const [leverage] = useState(15)
  
  // Tabs
  const [activePositionsTab, setActivePositionsTab] = useState('positions')
  
  // Account
  const [accountBalance] = useState(0.1857) // USDT
  const [marginBalance] = useState(0.1857)
  const [unrealizedPNL] = useState(0)
  
  // Positions & Orders
  const [positions] = useState([])
  
  // Loading
  const [isLoadingPrice, setIsLoadingPrice] = useState(true)
  
  // Popular pairs for quick switch
  const popularPairs = [
    { symbol: 'BTCUSDT', name: 'Bitcoin' },
    { symbol: 'ETHUSDT', name: 'Ethereum' },
    { symbol: 'SOLUSDT', name: 'Solana' },
    { symbol: 'BNBUSDT', name: 'BNB' },
  ]

  // Fetch real-time price
  useEffect(() => {
    const fetchPrice = async () => {
      const coinGeckoMap = {
        'BTCUSDT': 'bitcoin',
        'ETHUSDT': 'ethereum',
        'SOLUSDT': 'solana',
        'BNBUSDT': 'binancecoin',
      }

      try {
        setIsLoadingPrice(true)
        const coinId = coinGeckoMap[selectedPair]
        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`
        )
        const data = await response.json()

        setMarketPrice(data.market_data.current_price.usd)
        const change = data.market_data.price_change_24h || 0
        const changePercent = data.market_data.price_change_percentage_24h || 0
        setPriceChange(change)
        setPriceChangePercent(changePercent)
        setHigh24h(data.market_data.high_24h.usd || 0)
        setLow24h(data.market_data.low_24h.usd || 0)
        setVolume24h(data.market_data.total_volume.usd || 0)
      } catch (error) {
        console.error('Error fetching price:', error)
      } finally {
        setIsLoadingPrice(false)
      }
    }

    fetchPrice()
    const interval = setInterval(fetchPrice, 10000)
    return () => clearInterval(interval)
  }, [selectedPair])

  // Auto-calculate total
  useEffect(() => {
    if (price && amount) {
      const calculatedTotal = (parseFloat(price) * parseFloat(amount)).toFixed(4)
      setTotal(calculatedTotal)
    }
  }, [price, amount])

  // Format helpers
  const formatPrice = (num) => {
    if (num === 0) return '0.00'
    if (num < 1) return num.toFixed(6)
    if (num < 100) return num.toFixed(2)
    return num.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  }

  const formatVolume = (num) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`
    return num.toFixed(2)
  }

  return (
    <div className="binance-markets-page">
      {/* Top Ticker Bar */}
      <div className="binance-ticker-bar">
        {popularPairs.map(pair => (
          <button
            key={pair.symbol}
            className={`ticker-item ${selectedPair === pair.symbol ? 'active' : ''}`}
            onClick={() => setSelectedPair(pair.symbol)}
          >
            <span className="ticker-symbol">{pair.symbol}</span>
            <span className={`ticker-change ${priceChangePercent >= 0 ? 'positive' : 'negative'}`}>
              {pair.symbol === selectedPair ? `${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%` : '...'}
            </span>
          </button>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="binance-main-grid">
        {/* Left: Chart + Ticker Info */}
        <div className="binance-chart-section">
          {/* Pair Info Header */}
          <div className="binance-pair-header">
            <div className="pair-info-left">
              <div className="pair-name">
                <span className="pair-symbol">{selectedPair}</span>
                <span className="pair-type">Perp</span>
              </div>
              <div className="pair-price-info">
                <div className="current-price">
                  <span className={`price-value ${priceChangePercent >= 0 ? 'positive' : 'negative'}`}>
                    {isLoadingPrice ? 'Loading...' : formatPrice(marketPrice)}
                  </span>
                  <span className={`price-change ${priceChangePercent >= 0 ? 'positive' : 'negative'}`}>
                    {priceChange >= 0 ? '+' : ''}{formatPrice(priceChange)} {priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
            <div className="pair-stats">
              <div className="stat">
                <span className="stat-label">24h High</span>
                <span className="stat-value">{formatPrice(high24h)}</span>
              </div>
              <div className="stat">
                <span className="stat-label">24h Low</span>
                <span className="stat-value">{formatPrice(low24h)}</span>
              </div>
              <div className="stat">
                <span className="stat-label">24h Volume(USDT)</span>
                <span className="stat-value">{formatVolume(volume24h)}</span>
              </div>
            </div>
          </div>

          {/* Chart Tabs */}
          <div className="binance-chart-tabs">
            <button className="chart-tab active">Chart</button>
            <button className="chart-tab">Info</button>
            <button className="chart-tab">Trading Data</button>
          </div>

          {/* Chart Placeholder */}
          <div className="binance-chart-container">
            <div className="chart-placeholder">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              <h3>TradingView Chart</h3>
              <p>Real-time chart integration coming soon</p>
            </div>
          </div>
        </div>

        {/* Right: Order Book + Order Entry */}
        <div className="binance-right-panel">
          {/* Order Book Header */}
          <div className="orderbook-header">
            <h3>Order Book</h3>
            <div className="orderbook-controls">
              <button className="orderbook-view-btn active" title="Buy & Sell">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="3" y="3" width="8" height="18"/>
                  <rect x="13" y="3" width="8" height="18"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Order Book */}
          <div className="binance-orderbook">
            <div className="orderbook-headers">
              <span>Price (USDT)</span>
              <span className="text-right">Size (USDT)</span>
              <span className="text-right">Sum (USDT)</span>
            </div>
            
            {/* Sell Orders (Red) */}
            <div className="orderbook-sells">
              {[...Array(8)].map((_, i) => (
                <div key={`sell-${i}`} className="orderbook-row sell">
                  <span className="ob-price">{formatPrice(marketPrice + (i + 1) * 10)}</span>
                  <span className="ob-size text-right">{(Math.random() * 100).toFixed(2)}</span>
                  <span className="ob-sum text-right">{(Math.random() * 1000).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Current Price */}
            <div className="orderbook-current-price">
              <span className={`current-price-value ${priceChangePercent >= 0 ? 'positive' : 'negative'}`}>
                {formatPrice(marketPrice)}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '4px' }}>
                  {priceChangePercent >= 0 ? (
                    <path d="M12 4l8 8H4z"/>
                  ) : (
                    <path d="M12 20l8-8H4z"/>
                  )}
                </svg>
              </span>
              <span className="current-price-usd">{formatPrice(marketPrice)}</span>
            </div>

            {/* Buy Orders (Green) */}
            <div className="orderbook-buys">
              {[...Array(8)].map((_, i) => (
                <div key={`buy-${i}`} className="orderbook-row buy">
                  <span className="ob-price">{formatPrice(marketPrice - (i + 1) * 10)}</span>
                  <span className="ob-size text-right">{(Math.random() * 100).toFixed(2)}</span>
                  <span className="ob-sum text-right">{(Math.random() * 1000).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Order Entry Panel */}
          <div className="binance-order-panel">
            {/* Isolated / Leverage */}
            <div className="order-panel-header">
              <button className="isolated-btn">Isolated</button>
              <button className="leverage-btn">{leverage}x</button>
            </div>

            {/* Order Type Tabs */}
            <div className="order-type-tabs">
              <button 
                className={`order-type-tab ${orderType === 'Limit' ? 'active' : ''}`}
                onClick={() => setOrderType('Limit')}
              >
                Limit
              </button>
              <button 
                className={`order-type-tab ${orderType === 'Market' ? 'active' : ''}`}
                onClick={() => setOrderType('Market')}
              >
                Market
              </button>
              <button 
                className={`order-type-tab ${orderType === 'Stop-Limit' ? 'active' : ''}`}
                onClick={() => setOrderType('Stop-Limit')}
              >
                Stop Limit
              </button>
            </div>

            {/* Buy/Sell Panels */}
            <div className="buy-sell-panels">
              {/* Buy Panel */}
              <div className="order-side-panel buy-panel">
                <div className="avbl-balance">
                  <span>Avbl</span>
                  <span>{accountBalance.toFixed(4)} USDT</span>
                </div>

                {orderType === 'Limit' && (
                  <div className="input-group">
                    <label>Price</label>
                    <div className="input-wrapper">
                      <input
                        type="number"
                        placeholder="0"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                      />
                      <span className="input-suffix">USDT</span>
                    </div>
                  </div>
                )}

                <div className="input-group">
                  <label>Size</label>
                  <div className="input-wrapper">
                    <input
                      type="number"
                      placeholder="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    <span className="input-suffix">USDT</span>
                  </div>
                </div>

                {/* Percentage Buttons */}
                <div className="percentage-btns">
                  <button onClick={() => setAmount((accountBalance * 0.25).toFixed(4))}>25%</button>
                  <button onClick={() => setAmount((accountBalance * 0.50).toFixed(4))}>50%</button>
                  <button onClick={() => setAmount((accountBalance * 0.75).toFixed(4))}>75%</button>
                  <button onClick={() => setAmount(accountBalance.toFixed(4))}>100%</button>
                </div>

                <div className="total-display">
                  <span>Total</span>
                  <span>{total || '0'} USDT</span>
                </div>

                <button className="order-submit-btn buy-btn">
                  Buy/Long
                </button>
              </div>

              {/* Sell Panel */}
              <div className="order-side-panel sell-panel">
                <div className="avbl-balance">
                  <span>Avbl</span>
                  <span>{accountBalance.toFixed(4)} USDT</span>
                </div>

                {orderType === 'Limit' && (
                  <div className="input-group">
                    <label>Price</label>
                    <div className="input-wrapper">
                      <input
                        type="number"
                        placeholder="0"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                      />
                      <span className="input-suffix">USDT</span>
                    </div>
                  </div>
                )}

                <div className="input-group">
                  <label>Size</label>
                  <div className="input-wrapper">
                    <input
                      type="number"
                      placeholder="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    <span className="input-suffix">USDT</span>
                  </div>
                </div>

                {/* Percentage Buttons */}
                <div className="percentage-btns">
                  <button onClick={() => setAmount((accountBalance * 0.25).toFixed(4))}>25%</button>
                  <button onClick={() => setAmount((accountBalance * 0.50).toFixed(4))}>50%</button>
                  <button onClick={() => setAmount((accountBalance * 0.75).toFixed(4))}>75%</button>
                  <button onClick={() => setAmount(accountBalance.toFixed(4))}>100%</button>
                </div>

                <div className="total-display">
                  <span>Total</span>
                  <span>{total || '0'} USDT</span>
                </div>

                <button className="order-submit-btn sell-btn">
                  Sell/Short
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Positions & Orders */}
      <div className="binance-positions-section">
        {/* Tabs */}
        <div className="positions-tabs">
          <button 
            className={`pos-tab ${activePositionsTab === 'positions' ? 'active' : ''}`}
            onClick={() => setActivePositionsTab('positions')}
          >
            Positions(0)
          </button>
          <button 
            className={`pos-tab ${activePositionsTab === 'openOrders' ? 'active' : ''}`}
            onClick={() => setActivePositionsTab('openOrders')}
          >
            Open Orders(0)
          </button>
          <button 
            className={`pos-tab ${activePositionsTab === 'orderHistory' ? 'active' : ''}`}
            onClick={() => setActivePositionsTab('orderHistory')}
          >
            Order History
          </button>
          <button className="pos-tab">Trade History</button>
          <button className="pos-tab">Transaction History</button>
          <button className="pos-tab">Assets</button>

          {/* Account Info - Right Side */}
          <div className="account-info-tabs">
            <div className="account-stat">
              <span className="account-label">Margin Ratio</span>
              <span className="account-value positive">0.00%</span>
            </div>
            <div className="account-stat">
              <span className="account-label">Margin Balance</span>
              <span className="account-value">{marginBalance.toFixed(4)} USDT</span>
            </div>
            <div className="account-stat">
              <span className="account-label">Unrealized PNL</span>
              <span className={`account-value ${unrealizedPNL >= 0 ? 'positive' : 'negative'}`}>
                {unrealizedPNL.toFixed(4)} USDT
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="positions-content">
          {activePositionsTab === 'positions' && positions.length === 0 && (
            <div className="empty-positions">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
              <p>You have no position.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MarketsPage