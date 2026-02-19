import { useState, useEffect } from 'react'

function MarketsPage() {
  // Market Selection
  const [selectedPair, setSelectedPair] = useState('BTCUSDT')
  const [marketPrice, setMarketPrice] = useState(0)
  const [priceChange, setPriceChange] = useState(0)
  const [priceChangePercent, setPriceChangePercent] = useState(0)
  const [high24h, setHigh24h] = useState(0)
  
  // Order Entry
  const [orderType, setOrderType] = useState('Limit')
  const [price, setPrice] = useState('')
  const [size, setSize] = useState('')
  const [leverage] = useState(15)
  
  // Tabs
  const [activePositionsTab, setActivePositionsTab] = useState('positions')
  
  // Account
  const [accountBalance] = useState(0.1857)
  const [marginBalance] = useState(0.1857)
  const [unrealizedPNL] = useState(0)
  
  // Positions
  const [positions] = useState([])
  
  // Loading
  const [isLoadingPrice, setIsLoadingPrice] = useState(true)
  
  const popularPairs = [
    { symbol: 'BTCUSDT', name: 'Bitcoin' },
    { symbol: 'ETHUSDT', name: 'Ethereum' },
    { symbol: 'SOLUSDT', name: 'Solana' },
    { symbol: 'BNBUSDT', name: 'BNB' },
    { symbol: 'DOGEUSDT', name: 'Dogecoin' },
  ]

  // Fetch real-time price
  useEffect(() => {
    const fetchPrice = async () => {
      const coinGeckoMap = {
        'BTCUSDT': 'bitcoin',
        'ETHUSDT': 'ethereum',
        'SOLUSDT': 'solana',
        'BNBUSDT': 'binancecoin',
        'DOGEUSDT': 'dogecoin',
      }

      try {
        setIsLoadingPrice(true)
        const coinId = coinGeckoMap[selectedPair] || 'bitcoin'
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

  // Format helpers
  const formatPrice = (num) => {
    if (num === 0) return '0.0'
    if (num < 1) return num.toFixed(6)
    if (num < 100) return num.toFixed(1)
    return num.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
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
            <span className={`ticker-change ${selectedPair === pair.symbol && priceChangePercent >= 0 ? 'positive' : 'negative'}`}>
              {selectedPair === pair.symbol ? `${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%` : '...'}
            </span>
          </button>
        ))}
      </div>

      {/* Main Trading Grid: Chart | Order Book | Order Entry */}
      <div className="binance-trading-grid">
        {/* LEFT: Chart Section */}
        <div className="binance-chart-section">
          {/* Pair Header */}
          <div className="binance-pair-header">
            <div className="pair-info">
              <div className="pair-name-row">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
                </svg>
                <span className="pair-symbol">{selectedPair}</span>
                <span className="pair-type">Perp</span>
              </div>
              <div className="pair-price-data">
                <span className={`main-price ${priceChangePercent >= 0 ? 'positive' : 'negative'}`}>
                  {isLoadingPrice ? 'Loading...' : formatPrice(marketPrice)}
                </span>
                <span className={`price-change-amount ${priceChangePercent >= 0 ? 'positive' : 'negative'}`}>
                  {priceChange >= 0 ? '+' : ''}{formatPrice(priceChange)} {priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
                </span>
              </div>
            </div>
            
            <div className="pair-24h-stats">
              <div className="stat-col">
                <span className="stat-label">Mark</span>
                <span className="stat-value">{formatPrice(marketPrice)}</span>
              </div>
              <div className="stat-col">
                <span className="stat-label">Index</span>
                <span className="stat-value">{formatPrice(marketPrice)}</span>
              </div>
              <div className="stat-col">
                <span className="stat-label">Funding (8h) / Countdown</span>
                <span className="stat-value funding-rate">0.00322% / 02:15:14</span>
              </div>
              <div className="stat-col">
                <span className="stat-label">24h High</span>
                <span className="stat-value">{formatPrice(high24h)}</span>
              </div>
            </div>
          </div>

          {/* Chart Area with expand icon */}
          <div className="binance-chart-area">
            <button className="chart-expand-btn" title="Expand chart">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
              </svg>
            </button>
            <div className="chart-placeholder">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <polyline points="1 6 5 2 9 6 13 2 17 6 21 2"/>
                <polyline points="1 22 5 18 9 22 13 18 17 22 21 18"/>
              </svg>
              <h3>TradingView Chart Integration</h3>
              <p>Advanced charting coming soon</p>
            </div>
          </div>
        </div>

        {/* MIDDLE: Order Book */}
        <div className="binance-orderbook-column">
          <div className="orderbook-header">
            <span>Order Book</span>
            <div className="orderbook-view-btns">
              <button className="ob-view-btn active">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="1" y="1" width="6" height="14"/>
                  <rect x="9" y="1" width="6" height="14"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="orderbook-table-headers">
            <span>Price (USDT)</span>
            <span className="text-right">Size (USDT)</span>
            <span className="text-right">Sum (USDT)</span>
          </div>

          <div className="orderbook-content">
            {/* Sell Orders */}
            <div className="ob-sells">
              {[...Array(10)].map((_, i) => (
                <div key={`sell-${i}`} className="ob-row sell">
                  <span className="ob-price">{formatPrice(marketPrice + (10 - i) * 10)}</span>
                  <span className="ob-size">{(Math.random() * 300).toFixed(2)}</span>
                  <span className="ob-sum">{(Math.random() * 100).toFixed(2)}K</span>
                </div>
              ))}
            </div>

            {/* Current Price Banner */}
            <div className="ob-current-price">
              <span className={`price-big ${priceChangePercent >= 0 ? 'positive' : 'negative'}`}>
                {formatPrice(marketPrice)}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  {priceChangePercent >= 0 ? (
                    <path d="M7 14l5-5 5 5z"/>
                  ) : (
                    <path d="M7 10l5 5 5-5z"/>
                  )}
                </svg>
              </span>
              <span className="price-usd">{formatPrice(marketPrice)}</span>
            </div>

            {/* Buy Orders */}
            <div className="ob-buys">
              {[...Array(10)].map((_, i) => (
                <div key={`buy-${i}`} className="ob-row buy">
                  <span className="ob-price">{formatPrice(marketPrice - (i + 1) * 10)}</span>
                  <span className="ob-size">{(Math.random() * 300).toFixed(2)}</span>
                  <span className="ob-sum">{(Math.random() * 100).toFixed(2)}K</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trades Section */}
          <div className="recent-trades">
            <div className="trades-tabs">
              <button className="trades-tab active">Trades</button>
              <button className="trades-tab">Top Movers</button>
            </div>
            <div className="trades-headers">
              <span>Price (USDT)</span>
              <span>Amount (USDT)</span>
              <span>Time</span>
            </div>
            <div className="trades-list">
              {[...Array(5)].map((_, i) => (
                <div key={`trade-${i}`} className="trade-row">
                  <span className={i % 2 === 0 ? 'positive' : 'negative'}>
                    {formatPrice(marketPrice + (Math.random() - 0.5) * 20)}
                  </span>
                  <span>{(Math.random() * 10).toFixed(2)}K</span>
                  <span>22:44:{44 - i}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Order Entry Panel */}
        <div className="binance-order-entry">
          <div className="order-entry-header">
            <button className="isolated-btn">Isolated</button>
            <button className="leverage-display">{leverage}x</button>
            <button className="size-mode">S</button>
          </div>

          <div className="order-type-selector">
            <button className={`ot-btn ${orderType === 'Limit' ? 'active' : ''}`} onClick={() => setOrderType('Limit')}>
              Limit
            </button>
            <button className={`ot-btn ${orderType === 'Market' ? 'active' : ''}`} onClick={() => setOrderType('Market')}>
              Market
            </button>
            <button className={`ot-btn ${orderType === 'Stop Limit' ? 'active' : ''}`} onClick={() => setOrderType('Stop Limit')}>
              Stop Limit
            </button>
          </div>

          <div className="avbl-row">
            <span>Avbl</span>
            <span className="avbl-value">
              {accountBalance.toFixed(4)} USDT
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1l-1.5 1.5L10.293 6H1v2h9.293L6.5 11.5 8 13l6-6z"/>
              </svg>
            </span>
          </div>

          {orderType === 'Limit' && (
            <div className="entry-input-group">
              <label>Price</label>
              <div className="input-row">
                <input type="number" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} />
                <span className="input-unit">BTC</span>
                <button className="input-select">BBO</button>
              </div>
            </div>
          )}

          <div className="entry-input-group">
            <label>Size</label>
            <div className="input-row">
              <input type="number" placeholder="0" value={size} onChange={(e) => setSize(e.target.value)} />
              <span className="input-unit">USDT</span>
            </div>
            <div className="size-slider">
              <div className="slider-track"></div>
            </div>
          </div>

          <div className="tp-sl-row">
            <label className="checkbox-row">
              <input type="checkbox" />
              <span>TP/SL</span>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" />
              <span>Reduce-Only</span>
            </label>
          </div>

          <button className="buy-long-btn">Buy/Long</button>

          {/* Risk Metrics — immediately under Buy/Long as per design */}
          <div className="risk-metrics-panel">
            <div className="risk-metric-row">
              <span className="rm-label">Profit Target</span>
              <span className="rm-value">$0 / $1,000</span>
            </div>
            <div className="risk-metric-row warning">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="#f59e0b">
                <path d="M8 1L1 14h14L8 1zm0 3l5.5 9H2.5L8 4zm-1 3v3h2V7H7zm0 4v2h2v-2H7z"/>
              </svg>
              <span className="rm-label">Daily Loss</span>
              <span className="rm-value">$0 / $400</span>
            </div>
            <div className="risk-metric-row">
              <span className="rm-label">Max Drawdown</span>
              <span className="rm-value">$0 / $600</span>
            </div>
          </div>

          <button className="sell-short-btn">Sell/Short</button>

          <div className="order-summary">
            <div className="summary-row">
              <span>Cost</span>
              <span>0.00 USDT</span>
            </div>
            <div className="summary-row">
              <span>Max</span>
              <span>0.00 USDT</span>
            </div>
          </div>

          <div className="fee-level">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="8" r="7" stroke="currentColor" fill="none"/>
              <path d="M8 4v4l3 2"/>
            </svg>
            <span>Fee level</span>
          </div>
        </div>
      </div>

      {/* Bottom: Positions & Account */}
      <div className="binance-bottom-section">
        <div className="positions-panel">
          <div className="positions-tabs">
            <button className={`pos-tab ${activePositionsTab === 'positions' ? 'active' : ''}`} onClick={() => setActivePositionsTab('positions')}>
              Positions(0)
            </button>
            <button className="pos-tab">Open Orders(0)</button>
            <button className="pos-tab">Order History</button>
            <button className="pos-tab">Trade History</button>
            <button className="pos-tab">Transaction History</button>
            <button className="pos-tab">Position History</button>
            <button className="pos-tab">Bots</button>
            <button className="pos-tab">Assets</button>
            <label className="hide-symbols">
              <input type="checkbox" />
              <span>Hide Other Symbols</span>
            </label>
          </div>

          <div className="positions-table-headers">
            <span>Symbol</span>
            <span>Size</span>
            <span>Entry Price</span>
            <span>Break Even Price</span>
            <span>Mark Price</span>
            <span>Liq.Price</span>
            <span>Margin Ratio</span>
            <span>Margin</span>
            <span>PNL(ROI %)</span>
          </div>

          {positions.length === 0 && (
            <div className="empty-positions">
              <svg width="60" height="60" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="10" y="10" width="18" height="18" rx="2"/>
                <rect x="36" y="10" width="18" height="18" rx="2"/>
                <rect x="36" y="36" width="18" height="18" rx="2"/>
                <rect x="10" y="36" width="18" height="18" rx="2"/>
              </svg>
              <p>You have no position.</p>
            </div>
          )}
        </div>

        {/* Account Panel */}
        <div className="account-panel">
          <div className="account-header">
            <span>Account</span>
            <button className="switch-btn">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1l-1.5 1.5L10.293 6H1v2h9.293L6.5 11.5 8 13l6-6z"/>
              </svg>
              Switch
            </button>
          </div>

          <div className="account-stats">
            <div className="account-row">
              <span>Margin Ratio</span>
              <span className="positive">0.00%</span>
            </div>
            <div className="account-row">
              <span>Maintenance Margin</span>
              <span>0.0000 USDT</span>
            </div>
            <div className="account-row">
              <span>Margin Balance</span>
              <span>{marginBalance.toFixed(4)} USDT</span>
            </div>
          </div>

          <button className="single-asset-btn">Single-Asset Mode</button>

          <div className="asset-selector">
            <span>USDT</span>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 6l4 4 4-4z"/>
            </svg>
          </div>

          <div className="account-balance">
            <div className="balance-row">
              <span>Balance</span>
              <span>{accountBalance.toFixed(4)} USDT</span>
            </div>
            <div className="balance-row">
              <span>Unrealized PNL</span>
              <span className={unrealizedPNL >= 0 ? 'positive' : 'negative'}>
                {unrealizedPNL.toFixed(4)} USDT
              </span>
            </div>
          </div>

          <button className="pnl-analysis-btn">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="8" r="6" stroke="currentColor" fill="none"/>
            </svg>
            Futures PNL Analysis
          </button>

          <div className="account-actions">
            <button>Transfer</button>
            <button>Buy Crypto</button>
            <button>Swap</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MarketsPage