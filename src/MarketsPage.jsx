import { useState, useEffect } from 'react'

function MarketsPage() {
  // Market Selection
  const [selectedPair, setSelectedPair] = useState('BTCUSDT')
  const [marketPrice, setMarketPrice] = useState(0)
  const [priceChange, setPriceChange] = useState(0)
  const [high24h, setHigh24h] = useState(0)
  const [low24h, setLow24h] = useState(0)
  const [volume24h, setVolume24h] = useState(0)
  
  // Order Entry
  const [orderTab, setOrderTab] = useState('LONG') // LONG or SHORT
  const [orderType, setOrderType] = useState('Market') // Market, Limit, Stop-Limit
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [stopPrice, setStopPrice] = useState('')
  const [leverage, setLeverage] = useState(1)
  const [tpslEnabled, setTpslEnabled] = useState(false)
  const [takeProfit, setTakeProfit] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  
  // Positions & Orders
  const [activeTab, setActiveTab] = useState('positions') // positions, openOrders, orderHistory
  const [positions, setPositions] = useState([])
  const [openOrders, setOpenOrders] = useState([])
  const [orderHistory, setOrderHistory] = useState([])
  
  // Account Info
  const [accountBalance] = useState(10000) // Demo balance
  const [availableMargin, setAvailableMargin] = useState(10000)
  const [unrealizedPnL, setUnrealizedPnL] = useState(0)
  
  // Loading states
  const [isLoadingPrice, setIsLoadingPrice] = useState(true)
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  
  // Popular trading pairs
  const tradingPairs = [
    { symbol: 'BTCUSDT', name: 'Bitcoin', maxLeverage: 8 },
    { symbol: 'ETHUSDT', name: 'Ethereum', maxLeverage: 8 },
    { symbol: 'SOLUSDT', name: 'Solana', maxLeverage: 5 },
    { symbol: 'BNBUSDT', name: 'BNB', maxLeverage: 5 },
    { symbol: 'XRPUSDT', name: 'XRP', maxLeverage: 5 },
    { symbol: 'ADAUSDT', name: 'Cardano', maxLeverage: 5 },
    { symbol: 'DOGEUSDT', name: 'Dogecoin', maxLeverage: 5 },
    { symbol: 'AVAXUSDT', name: 'Avalanche', maxLeverage: 5 },
  ]

  // Fetch real-time price from CoinGecko
  useEffect(() => {
    const fetchPrice = async () => {
      const coinGeckoMap = {
        'BTCUSDT': 'bitcoin',
        'ETHUSDT': 'ethereum',
        'SOLUSDT': 'solana',
        'BNBUSDT': 'binancecoin',
        'XRPUSDT': 'ripple',
        'ADAUSDT': 'cardano',
        'DOGEUSDT': 'dogecoin',
        'AVAXUSDT': 'avalanche-2',
      }

      try {
        setIsLoadingPrice(true)
        const coinId = coinGeckoMap[selectedPair]
        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`
        )
        const data = await response.json()

        setMarketPrice(data.market_data.current_price.usd)
        setPriceChange(data.market_data.price_change_percentage_24h || 0)
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
    const interval = setInterval(fetchPrice, 10000) // Update every 10 seconds
    return () => clearInterval(interval)
  }, [selectedPair])

  // Auto-fill price for Limit orders
  useEffect(() => {
    if (orderType === 'Limit' && marketPrice > 0) {
      setPrice(marketPrice.toString())
    }
  }, [orderType, marketPrice])

  // Calculate order value
  const calculateOrderValue = () => {
    if (!quantity) return 0
    const qty = parseFloat(quantity)
    const priceToUse = orderType === 'Market' ? marketPrice : parseFloat(price || 0)
    return qty * priceToUse
  }

  // Calculate required margin
  const calculateMargin = () => {
    const orderValue = calculateOrderValue()
    return orderValue / leverage
  }

  // Handle order placement
  const handlePlaceOrder = async () => {
    if (!quantity || parseFloat(quantity) <= 0) {
      alert('Please enter a valid quantity')
      return
    }

    if (orderType === 'Limit' && (!price || parseFloat(price) <= 0)) {
      alert('Please enter a valid price')
      return
    }

    if (orderType === 'Stop-Limit' && (!price || !stopPrice)) {
      alert('Please enter valid price and stop price')
      return
    }

    const requiredMargin = calculateMargin()
    if (requiredMargin > availableMargin) {
      alert('Insufficient margin')
      return
    }

    setIsPlacingOrder(true)

    // Simulate order placement (will be replaced with actual Binance API call)
    setTimeout(() => {
      const newOrder = {
        id: Date.now(),
        pair: selectedPair,
        side: orderTab,
        type: orderType,
        quantity: parseFloat(quantity),
        price: orderType === 'Market' ? marketPrice : parseFloat(price),
        stopPrice: stopPrice ? parseFloat(stopPrice) : null,
        leverage: leverage,
        takeProfit: takeProfit ? parseFloat(takeProfit) : null,
        stopLoss: stopLoss ? parseFloat(stopLoss) : null,
        status: orderType === 'Market' ? 'Filled' : 'Open',
        timestamp: new Date().toISOString()
      }

      if (orderType === 'Market') {
        // Add to positions
        setPositions(prev => [...prev, {
          ...newOrder,
          entryPrice: marketPrice,
          currentPrice: marketPrice,
          pnl: 0,
          pnlPercent: 0
        }])
        
        // Add to order history
        setOrderHistory(prev => [newOrder, ...prev])
      } else {
        // Add to open orders
        setOpenOrders(prev => [...prev, newOrder])
      }

      // Update available margin
      setAvailableMargin(prev => prev - requiredMargin)

      // Reset form
      setQuantity('')
      setPrice('')
      setStopPrice('')
      setTakeProfit('')
      setStopLoss('')
      setTpslEnabled(false)

      alert(`${orderType} ${orderTab} order placed successfully!`)
      setIsPlacingOrder(false)
    }, 1000)
  }

  // Close position
  const closePosition = (positionId) => {
    const position = positions.find(p => p.id === positionId)
    if (!position) return

    // Return margin
    const margin = (position.entryPrice * position.quantity) / position.leverage
    setAvailableMargin(prev => prev + margin)

    // Update unrealized PnL
    setUnrealizedPnL(prev => prev - position.pnl)

    // Remove from positions
    setPositions(prev => prev.filter(p => p.id !== positionId))

    // Add to order history as closed
    setOrderHistory(prev => [{
      ...position,
      status: 'Closed',
      closePrice: position.currentPrice,
      timestamp: new Date().toISOString()
    }, ...prev])

    alert(`Position closed with P/L: $${position.pnl.toFixed(2)}`)
  }

  // Cancel order
  const cancelOrder = (orderId) => {
    const order = openOrders.find(o => o.id === orderId)
    if (!order) return

    // Return margin
    const margin = (order.price * order.quantity) / order.leverage
    setAvailableMargin(prev => prev + margin)

    // Remove from open orders
    setOpenOrders(prev => prev.filter(o => o.id !== orderId))

    // Add to order history as cancelled
    setOrderHistory(prev => [{
      ...order,
      status: 'Cancelled',
      timestamp: new Date().toISOString()
    }, ...prev])

    alert('Order cancelled')
  }

  // Format number helpers
  const formatPrice = (num) => {
    if (num === 0) return '0.00'
    if (num < 1) return num.toFixed(4)
    if (num < 100) return num.toFixed(2)
    return num.toFixed(0)
  }

  const formatVolume = (num) => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`
    return `$${num.toFixed(2)}`
  }

  return (
    <div className="markets-page">
      {/* Top Bar - Market Info */}
      <div className="market-top-bar">
        <div className="market-selector">
          <select 
            className="pair-select"
            value={selectedPair}
            onChange={(e) => setSelectedPair(e.target.value)}
          >
            {tradingPairs.map(pair => (
              <option key={pair.symbol} value={pair.symbol}>
                {pair.symbol}
              </option>
            ))}
          </select>
          <div className="market-info">
            <div className="market-price">
              {isLoadingPrice ? (
                <span className="loading-price">Loading...</span>
              ) : (
                <>
                  <span className="price-value">${formatPrice(marketPrice)}</span>
                  <span className={`price-change ${priceChange >= 0 ? 'positive' : 'negative'}`}>
                    {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                  </span>
                </>
              )}
            </div>
            <div className="market-stats">
              <div className="stat-item">
                <span className="stat-label">24h High</span>
                <span className="stat-value">${formatPrice(high24h)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">24h Low</span>
                <span className="stat-value">${formatPrice(low24h)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">24h Volume</span>
                <span className="stat-value">{formatVolume(volume24h)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Account Summary */}
        <div className="account-summary">
          <div className="account-item">
            <span className="account-label">Balance</span>
            <span className="account-value">${accountBalance.toFixed(2)}</span>
          </div>
          <div className="account-item">
            <span className="account-label">Available Margin</span>
            <span className="account-value">${availableMargin.toFixed(2)}</span>
          </div>
          <div className="account-item">
            <span className="account-label">Unrealized P/L</span>
            <span className={`account-value ${unrealizedPnL >= 0 ? 'positive' : 'negative'}`}>
              {unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Trading Area */}
      <div className="trading-area">
        {/* Left Side - Chart Area */}
        <div className="chart-section">
          <div className="chart-placeholder">
            <div className="chart-coming-soon">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              <h3>TradingView Chart</h3>
              <p>Interactive chart will be integrated here</p>
              <span className="chart-note">Shows real-time price action for {selectedPair}</span>
            </div>
          </div>
        </div>

        {/* Right Side - Order Entry */}
        <div className="order-panel">
          {/* LONG/SHORT Tabs */}
          <div className="order-tabs">
            <button 
              className={`order-tab long ${orderTab === 'LONG' ? 'active' : ''}`}
              onClick={() => setOrderTab('LONG')}
            >
              LONG
            </button>
            <button 
              className={`order-tab short ${orderTab === 'SHORT' ? 'active' : ''}`}
              onClick={() => setOrderTab('SHORT')}
            >
              SHORT
            </button>
          </div>

          {/* Order Type Selector */}
          <div className="order-type-selector">
            <button 
              className={`type-btn ${orderType === 'Market' ? 'active' : ''}`}
              onClick={() => setOrderType('Market')}
            >
              Market
            </button>
            <button 
              className={`type-btn ${orderType === 'Limit' ? 'active' : ''}`}
              onClick={() => setOrderType('Limit')}
            >
              Limit
            </button>
            <button 
              className={`type-btn ${orderType === 'Stop-Limit' ? 'active' : ''}`}
              onClick={() => setOrderType('Stop-Limit')}
            >
              Stop-Limit
            </button>
          </div>

          {/* Leverage Slider */}
          <div className="leverage-section">
            <div className="leverage-header">
              <label>Leverage</label>
              <span className="leverage-value">{leverage}x</span>
            </div>
            <input
              type="range"
              min="1"
              max={tradingPairs.find(p => p.symbol === selectedPair)?.maxLeverage || 8}
              value={leverage}
              onChange={(e) => setLeverage(parseInt(e.target.value))}
              className="leverage-slider"
            />
            <div className="leverage-info">
              <span>1x</span>
              <span>{tradingPairs.find(p => p.symbol === selectedPair)?.maxLeverage || 8}x</span>
            </div>
          </div>

          {/* Order Inputs */}
          <div className="order-inputs">
            {orderType === 'Stop-Limit' && (
              <div className="input-group">
                <label>Stop Price</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={stopPrice}
                  onChange={(e) => setStopPrice(e.target.value)}
                  className="order-input"
                />
              </div>
            )}

            {orderType !== 'Market' && (
              <div className="input-group">
                <label>Price</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="order-input"
                />
              </div>
            )}

            <div className="input-group">
              <label>Quantity</label>
              <input
                type="number"
                placeholder="0.00"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="order-input"
              />
            </div>

            {/* TP/SL Toggle */}
            <div className="tpsl-toggle">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={tpslEnabled}
                  onChange={(e) => setTpslEnabled(e.target.checked)}
                />
                <span>Take Profit / Stop Loss</span>
              </label>
            </div>

            {tpslEnabled && (
              <>
                <div className="input-group">
                  <label>Take Profit</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    className="order-input"
                  />
                </div>
                <div className="input-group">
                  <label>Stop Loss</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    className="order-input"
                  />
                </div>
              </>
            )}
          </div>

          {/* Order Summary */}
          <div className="order-summary">
            <div className="summary-row">
              <span>Order Value</span>
              <span>${calculateOrderValue().toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>Required Margin</span>
              <span>${calculateMargin().toFixed(2)}</span>
            </div>
          </div>

          {/* Place Order Button */}
          <button 
            className={`place-order-btn ${orderTab.toLowerCase()}`}
            onClick={handlePlaceOrder}
            disabled={isPlacingOrder || isLoadingPrice}
          >
            {isPlacingOrder ? 'Placing Order...' : `${orderTab} ${selectedPair.replace('USDT', '')}`}
          </button>

          {/* Risk Warning */}
          <div className="risk-warning">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>Demo trading - No real funds at risk</span>
          </div>
        </div>
      </div>

      {/* Bottom Section - Positions & Orders */}
      <div className="positions-section">
        <div className="positions-tabs">
          <button 
            className={`pos-tab ${activeTab === 'positions' ? 'active' : ''}`}
            onClick={() => setActiveTab('positions')}
          >
            Positions ({positions.length})
          </button>
          <button 
            className={`pos-tab ${activeTab === 'openOrders' ? 'active' : ''}`}
            onClick={() => setActiveTab('openOrders')}
          >
            Open Orders ({openOrders.length})
          </button>
          <button 
            className={`pos-tab ${activeTab === 'orderHistory' ? 'active' : ''}`}
            onClick={() => setActiveTab('orderHistory')}
          >
            Order History ({orderHistory.length})
          </button>
        </div>

        <div className="positions-content">
          {activeTab === 'positions' && (
            <>
              {positions.length === 0 ? (
                <div className="empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <line x1="9" y1="9" x2="15" y2="9"/>
                    <line x1="9" y1="15" x2="15" y2="15"/>
                  </svg>
                  <p>No open positions</p>
                  <span>Your active positions will appear here</span>
                </div>
              ) : (
                <table className="positions-table">
                  <thead>
                    <tr>
                      <th>Pair</th>
                      <th>Side</th>
                      <th>Quantity</th>
                      <th>Entry Price</th>
                      <th>Current Price</th>
                      <th>Leverage</th>
                      <th>P/L</th>
                      <th>P/L %</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map(position => (
                      <tr key={position.id}>
                        <td className="pair-cell">{position.pair}</td>
                        <td>
                          <span className={`side-badge ${position.side.toLowerCase()}`}>
                            {position.side}
                          </span>
                        </td>
                        <td>{position.quantity}</td>
                        <td>${formatPrice(position.entryPrice)}</td>
                        <td>${formatPrice(position.currentPrice)}</td>
                        <td>{position.leverage}x</td>
                        <td className={position.pnl >= 0 ? 'positive' : 'negative'}>
                          {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
                        </td>
                        <td className={position.pnlPercent >= 0 ? 'positive' : 'negative'}>
                          {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                        </td>
                        <td>
                          <button 
                            className="close-btn"
                            onClick={() => closePosition(position.id)}
                          >
                            Close
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {activeTab === 'openOrders' && (
            <>
              {openOrders.length === 0 ? (
                <div className="empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <p>No open orders</p>
                  <span>Your pending orders will appear here</span>
                </div>
              ) : (
                <table className="positions-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Pair</th>
                      <th>Type</th>
                      <th>Side</th>
                      <th>Price</th>
                      <th>Quantity</th>
                      <th>Leverage</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openOrders.map(order => (
                      <tr key={order.id}>
                        <td>{new Date(order.timestamp).toLocaleTimeString()}</td>
                        <td className="pair-cell">{order.pair}</td>
                        <td>{order.type}</td>
                        <td>
                          <span className={`side-badge ${order.side.toLowerCase()}`}>
                            {order.side}
                          </span>
                        </td>
                        <td>${formatPrice(order.price)}</td>
                        <td>{order.quantity}</td>
                        <td>{order.leverage}x</td>
                        <td>
                          <button 
                            className="cancel-btn"
                            onClick={() => cancelOrder(order.id)}
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {activeTab === 'orderHistory' && (
            <>
              {orderHistory.length === 0 ? (
                <div className="empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 3h18v18H3z"/>
                    <path d="M3 9h18"/>
                    <path d="M9 3v18"/>
                  </svg>
                  <p>No order history</p>
                  <span>Your completed orders will appear here</span>
                </div>
              ) : (
                <table className="positions-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Pair</th>
                      <th>Type</th>
                      <th>Side</th>
                      <th>Price</th>
                      <th>Quantity</th>
                      <th>Status</th>
                      <th>P/L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderHistory.map(order => (
                      <tr key={order.id}>
                        <td>{new Date(order.timestamp).toLocaleTimeString()}</td>
                        <td className="pair-cell">{order.pair}</td>
                        <td>{order.type}</td>
                        <td>
                          <span className={`side-badge ${order.side.toLowerCase()}`}>
                            {order.side}
                          </span>
                        </td>
                        <td>${formatPrice(order.price)}</td>
                        <td>{order.quantity}</td>
                        <td>
                          <span className={`status-badge ${order.status.toLowerCase()}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className={order.pnl >= 0 ? 'positive' : 'negative'}>
                          {order.pnl ? `${order.pnl >= 0 ? '+' : ''}$${order.pnl.toFixed(2)}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default MarketsPage