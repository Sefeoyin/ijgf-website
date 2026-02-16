import { useState, useEffect } from 'react'

function MarketsPage() {
  // Market selection
  const [selectedPair, setSelectedPair] = useState('BTCUSDT')
  const [marketPrice, setMarketPrice] = useState(0)
  const [priceChange24h, setPriceChange24h] = useState(0)
  const [high24h, setHigh24h] = useState(0)
  const [low24h, setLow24h] = useState(0)
  const [volume24h, setVolume24h] = useState(0)

  // Trading state
  const [orderType, setOrderType] = useState('limit') // limit, market, stop-limit
  const [side, setSide] = useState('buy') // buy, sell
  const [price, setPrice] = useState('')
  const [amount, setAmount] = useState('')
  const [total, setTotal] = useState('')
  const [leverage, setLeverage] = useState(1)

  // Account balance (demo)
  const [balance] = useState({
    USDT: 10000,
    BTC: 0,
    ETH: 0
  })

  // Open positions (demo data)
  const [positions, setPositions] = useState([
    {
      id: 1,
      symbol: 'BTCUSDT',
      side: 'LONG',
      size: 0.5,
      entryPrice: 96420.00,
      markPrice: 96850.00,
      leverage: 5,
      pnl: 215.00,
      pnlPercent: 2.23,
      liquidationPrice: 92150.00,
      margin: 9642.00
    }
  ])

  // Open orders (demo data)
  const [orders, setOrders] = useState([
    {
      id: 1,
      symbol: 'ETHUSDT',
      side: 'BUY',
      type: 'LIMIT',
      price: 3500.00,
      amount: 2.5,
      filled: 0,
      total: 8750.00,
      status: 'OPEN',
      time: new Date().toISOString()
    }
  ])

  // Trade history (demo data)
  const [tradeHistory] = useState([
    {
      id: 1,
      symbol: 'BTCUSDT',
      side: 'BUY',
      price: 96420.00,
      amount: 0.5,
      total: 48210.00,
      fee: 48.21,
      time: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 2,
      symbol: 'ETHUSDT',
      side: 'SELL',
      price: 3520.00,
      amount: 1.5,
      total: 5280.00,
      fee: 5.28,
      time: new Date(Date.now() - 7200000).toISOString()
    }
  ])

  // Popular trading pairs
  const [tradingPairs] = useState([
    { symbol: 'BTCUSDT', name: 'BTC/USDT', price: 0, change: 0 },
    { symbol: 'ETHUSDT', name: 'ETH/USDT', price: 0, change: 0 },
    { symbol: 'SOLUSDT', name: 'SOL/USDT', price: 0, change: 0 },
    { symbol: 'BNBUSDT', name: 'BNB/USDT', price: 0, change: 0 },
    { symbol: 'XRPUSDT', name: 'XRP/USDT', price: 0, change: 0 },
    { symbol: 'ADAUSDT', name: 'ADA/USDT', price: 0, change: 0 },
    { symbol: 'DOGEUSDT', name: 'DOGE/USDT', price: 0, change: 0 },
    { symbol: 'AVAXUSDT', name: 'AVAX/USDT', price: 0, change: 0 }
  ])

  // Fetch real-time prices from CoinGecko
  useEffect(() => {
    const fetchPrices = async () => {
      const coinGeckoMap = {
        'BTCUSDT': 'bitcoin',
        'ETHUSDT': 'ethereum',
        'SOLUSDT': 'solana',
        'BNBUSDT': 'binancecoin',
        'XRPUSDT': 'ripple',
        'ADAUSDT': 'cardano',
        'DOGEUSDT': 'dogecoin',
        'AVAXUSDT': 'avalanche-2'
      }

      const ids = Object.values(coinGeckoMap).join(',')

      try {
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_24hr_high_low=true`
        )
        const data = await response.json()

        // Update selected pair details
        const selectedCoinId = coinGeckoMap[selectedPair]
        if (data[selectedCoinId]) {
          setMarketPrice(data[selectedCoinId].usd)
          setPriceChange24h(data[selectedCoinId].usd_24h_change || 0)
          setHigh24h(data[selectedCoinId].usd_24h_high || 0)
          setLow24h(data[selectedCoinId].usd_24h_low || 0)
          setVolume24h(data[selectedCoinId].usd_24h_vol || 0)
        }
      } catch (error) {
        console.error('Error fetching prices:', error)
      }
    }

    fetchPrices()
    const interval = setInterval(fetchPrices, 10000) // Update every 10 seconds
    return () => clearInterval(interval)
  }, [selectedPair])

  // Calculate total when price or amount changes
  useEffect(() => {
    if (price && amount) {
      const calculatedTotal = (parseFloat(price) * parseFloat(amount)).toFixed(2)
      setTotal(calculatedTotal)
    }
  }, [price, amount])

  // Use market price for market orders
  useEffect(() => {
    if (orderType === 'market' && marketPrice > 0) {
      setPrice(marketPrice.toFixed(2))
    }
  }, [orderType, marketPrice])

  const handlePlaceOrder = () => {
    if (!price || !amount) {
      alert('Please enter price and amount')
      return
    }

    const newOrder = {
      id: Date.now(),
      symbol: selectedPair,
      side: side.toUpperCase(),
      type: orderType.toUpperCase(),
      price: parseFloat(price),
      amount: parseFloat(amount),
      filled: 0,
      total: parseFloat(total),
      status: 'OPEN',
      time: new Date().toISOString()
    }

    setOrders([...orders, newOrder])
    
    // Reset form
    setPrice('')
    setAmount('')
    setTotal('')
    
    alert(`${side.toUpperCase()} order placed successfully!`)
  }

  const handleCancelOrder = (orderId) => {
    setOrders(orders.filter(order => order.id !== orderId))
    alert('Order cancelled')
  }

  const handleClosePosition = (positionId) => {
    setPositions(positions.filter(pos => pos.id !== positionId))
    alert('Position closed')
  }

  const formatPrice = (price, decimals = 2) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(price)
  }

  const formatPercent = (percent) => {
    const sign = percent > 0 ? '+' : ''
    return `${sign}${percent.toFixed(2)}%`
  }

  const formatTime = (isoString) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    })
  }

  return (
    <div className="markets-page">
      {/* Top Bar - Pair Info */}
      <div className="markets-header">
        <div className="pair-selector">
          <select 
            value={selectedPair} 
            onChange={(e) => setSelectedPair(e.target.value)}
            className="pair-select"
          >
            {tradingPairs.map(pair => (
              <option key={pair.symbol} value={pair.symbol}>{pair.name}</option>
            ))}
          </select>
        </div>

        <div className="pair-stats">
          <div className="stat-item">
            <span className="stat-label">Last Price</span>
            <span className={`stat-value ${priceChange24h >= 0 ? 'positive' : 'negative'}`}>
              ${formatPrice(marketPrice, marketPrice < 1 ? 4 : 2)}
            </span>
          </div>

          <div className="stat-item">
            <span className="stat-label">24h Change</span>
            <span className={`stat-value ${priceChange24h >= 0 ? 'positive' : 'negative'}`}>
              {formatPercent(priceChange24h)}
            </span>
          </div>

          <div className="stat-item">
            <span className="stat-label">24h High</span>
            <span className="stat-value">${formatPrice(high24h, high24h < 1 ? 4 : 2)}</span>
          </div>

          <div className="stat-item">
            <span className="stat-label">24h Low</span>
            <span className="stat-value">${formatPrice(low24h, low24h < 1 ? 4 : 2)}</span>
          </div>

          <div className="stat-item">
            <span className="stat-label">24h Volume</span>
            <span className="stat-value">${formatPrice(volume24h, 0)}</span>
          </div>
        </div>
      </div>

      {/* Main Trading Area */}
      <div className="markets-content">
        {/* Left: Chart Area */}
        <div className="chart-section">
          <div className="chart-placeholder">
            <div className="chart-header">
              <div className="chart-title">{selectedPair} Chart</div>
              <div className="chart-timeframes">
                <button className="timeframe-btn">1m</button>
                <button className="timeframe-btn">5m</button>
                <button className="timeframe-btn active">15m</button>
                <button className="timeframe-btn">1h</button>
                <button className="timeframe-btn">4h</button>
                <button className="timeframe-btn">1D</button>
              </div>
            </div>
            <div className="chart-body">
              {/* TradingView chart will go here */}
              <div className="chart-coming-soon">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
                <h3>Chart Integration Coming Soon</h3>
                <p>TradingView chart will be integrated here</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Order Entry Panel */}
        <div className="order-panel">
          {/* Balance Info */}
          <div className="balance-section">
            <div className="balance-row">
              <span className="balance-label">Available</span>
              <span className="balance-value">{formatPrice(balance.USDT)} USDT</span>
            </div>
          </div>

          {/* Buy/Sell Tabs */}
          <div className="order-tabs">
            <button 
              className={`order-tab buy-tab ${side === 'buy' ? 'active' : ''}`}
              onClick={() => setSide('buy')}
            >
              Buy / Long
            </button>
            <button 
              className={`order-tab sell-tab ${side === 'sell' ? 'active' : ''}`}
              onClick={() => setSide('sell')}
            >
              Sell / Short
            </button>
          </div>

          {/* Order Type Selection */}
          <div className="order-type-tabs">
            <button 
              className={`type-tab ${orderType === 'limit' ? 'active' : ''}`}
              onClick={() => setOrderType('limit')}
            >
              Limit
            </button>
            <button 
              className={`type-tab ${orderType === 'market' ? 'active' : ''}`}
              onClick={() => setOrderType('market')}
            >
              Market
            </button>
            <button 
              className={`type-tab ${orderType === 'stop-limit' ? 'active' : ''}`}
              onClick={() => setOrderType('stop-limit')}
            >
              Stop-Limit
            </button>
          </div>

          {/* Leverage Selector */}
          <div className="leverage-section">
            <label className="input-label">
              Leverage: {leverage}x
            </label>
            <input 
              type="range" 
              min="1" 
              max="10" 
              value={leverage}
              onChange={(e) => setLeverage(parseInt(e.target.value))}
              className="leverage-slider"
            />
            <div className="leverage-marks">
              <span>1x</span>
              <span>5x</span>
              <span>10x</span>
            </div>
          </div>

          {/* Order Inputs */}
          <div className="order-inputs">
            {orderType !== 'market' && (
              <div className="input-group">
                <label className="input-label">Price (USDT)</label>
                <input 
                  type="number" 
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="order-input"
                  disabled={orderType === 'market'}
                />
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Amount ({selectedPair.replace('USDT', '')})</label>
              <input 
                type="number" 
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="order-input"
              />
              <div className="amount-shortcuts">
                <button onClick={() => setAmount((balance.USDT * 0.25 / marketPrice).toFixed(6))}>25%</button>
                <button onClick={() => setAmount((balance.USDT * 0.50 / marketPrice).toFixed(6))}>50%</button>
                <button onClick={() => setAmount((balance.USDT * 0.75 / marketPrice).toFixed(6))}>75%</button>
                <button onClick={() => setAmount((balance.USDT / marketPrice).toFixed(6))}>100%</button>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Total (USDT)</label>
              <input 
                type="number" 
                placeholder="0.00"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                className="order-input"
                readOnly
              />
            </div>
          </div>

          {/* Place Order Button */}
          <button 
            className={`place-order-btn ${side === 'buy' ? 'buy' : 'sell'}`}
            onClick={handlePlaceOrder}
          >
            {side === 'buy' ? 'Buy / Long' : 'Sell / Short'}
          </button>

          {/* Risk Warning */}
          <div className="risk-warning">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>Demo trading account. No real money at risk.</span>
          </div>
        </div>
      </div>

      {/* Bottom Section - Positions, Orders, History */}
      <div className="trading-tables">
        <div className="table-tabs">
          <button className="table-tab active">Positions ({positions.length})</button>
          <button className="table-tab">Open Orders ({orders.length})</button>
          <button className="table-tab">Trade History</button>
        </div>

        {/* Positions Table */}
        <div className="table-section positions-table">
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
            <table className="data-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Size</th>
                  <th>Entry Price</th>
                  <th>Mark Price</th>
                  <th>Liq. Price</th>
                  <th>Margin</th>
                  <th>PNL (ROE%)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {positions.map(position => (
                  <tr key={position.id}>
                    <td className="symbol-cell">{position.symbol}</td>
                    <td>
                      <span className={`side-badge ${position.side.toLowerCase()}`}>
                        {position.side}
                      </span>
                    </td>
                    <td>{position.size} {position.symbol.replace('USDT', '')}</td>
                    <td>${formatPrice(position.entryPrice)}</td>
                    <td>${formatPrice(position.markPrice)}</td>
                    <td className="liq-price">${formatPrice(position.liquidationPrice)}</td>
                    <td>${formatPrice(position.margin)}</td>
                    <td className={position.pnl >= 0 ? 'positive' : 'negative'}>
                      ${formatPrice(position.pnl)} ({formatPercent(position.pnlPercent)})
                    </td>
                    <td>
                      <button 
                        className="action-btn close-btn"
                        onClick={() => handleClosePosition(position.id)}
                      >
                        Close
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Open Orders Table */}
        <div className="table-section orders-table" style={{ display: 'none' }}>
          {orders.length === 0 ? (
            <div className="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <p>No open orders</p>
              <span>Your pending orders will appear here</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Symbol</th>
                  <th>Type</th>
                  <th>Side</th>
                  <th>Price</th>
                  <th>Amount</th>
                  <th>Filled</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id}>
                    <td>{formatTime(order.time)}</td>
                    <td className="symbol-cell">{order.symbol}</td>
                    <td>{order.type}</td>
                    <td>
                      <span className={`side-badge ${order.side.toLowerCase()}`}>
                        {order.side}
                      </span>
                    </td>
                    <td>${formatPrice(order.price)}</td>
                    <td>{order.amount}</td>
                    <td>{order.filled}</td>
                    <td>${formatPrice(order.total)}</td>
                    <td>
                      <span className="status-badge">{order.status}</span>
                    </td>
                    <td>
                      <button 
                        className="action-btn cancel-btn"
                        onClick={() => handleCancelOrder(order.id)}
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Trade History Table */}
        <div className="table-section history-table" style={{ display: 'none' }}>
          {tradeHistory.length === 0 ? (
            <div className="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2v20M2 12h20"/>
              </svg>
              <p>No trade history</p>
              <span>Your completed trades will appear here</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Price</th>
                  <th>Amount</th>
                  <th>Total</th>
                  <th>Fee</th>
                </tr>
              </thead>
              <tbody>
                {tradeHistory.map(trade => (
                  <tr key={trade.id}>
                    <td>{formatTime(trade.time)}</td>
                    <td className="symbol-cell">{trade.symbol}</td>
                    <td>
                      <span className={`side-badge ${trade.side.toLowerCase()}`}>
                        {trade.side}
                      </span>
                    </td>
                    <td>${formatPrice(trade.price)}</td>
                    <td>{trade.amount}</td>
                    <td>${formatPrice(trade.total)}</td>
                    <td>${formatPrice(trade.fee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default MarketsPage
