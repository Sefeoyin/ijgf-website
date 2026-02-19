import { useState, useEffect, useRef } from 'react'

function MarketsPage() {
  const [selectedPair] = useState('BTCUSDT')
  const [marketPrice, setMarketPrice] = useState(0)
  const [priceChange, setPriceChange] = useState(0)
  const [priceChangePercent, setPriceChangePercent] = useState(0)
  const [high24h, setHigh24h] = useState(0)
  const [orderSide, setOrderSide] = useState('buy')
  const [orderType, setOrderType] = useState('Limit')
  const [price, setPrice] = useState('')
  const [size, setSize] = useState('')
  const [leverage] = useState(10)
  const [tpEnabled, setTpEnabled] = useState(false)
  const [slEnabled, setSlEnabled] = useState(false)
  const [activePositionsTab, setActivePositionsTab] = useState('positions')
  const [accountBalance] = useState(10000)
  const [marginBalance] = useState(10000)
  const [unrealizedPNL] = useState(0)
  const [positions] = useState([])
  const [isLoadingPrice, setIsLoadingPrice] = useState(true)
  const [chartExpanded, setChartExpanded] = useState(false)
  const chartContainerRef = useRef(null)
  const tvWidgetRef = useRef(null)

  const getTVSymbol = (pair) => `BINANCE:${pair}.P`

  // Fetch live price from CoinGecko
  useEffect(() => {
    const coinGeckoMap = {
      'BTCUSDT': 'bitcoin',
      'ETHUSDT': 'ethereum',
      'SOLUSDT': 'solana',
      'BNBUSDT': 'binancecoin',
      'DOGEUSDT': 'dogecoin',
    }

    const fetchPrice = async () => {
      try {
        setIsLoadingPrice(true)
        const coinId = coinGeckoMap[selectedPair] || 'bitcoin'
        const res = await fetch(
          `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`
        )
        const data = await res.json()
        setMarketPrice(data.market_data.current_price.usd)
        setPriceChange(data.market_data.price_change_24h || 0)
        setPriceChangePercent(data.market_data.price_change_percentage_24h || 0)
        setHigh24h(data.market_data.high_24h.usd || 0)
      } catch (err) {
        console.error('Price fetch error:', err)
      } finally {
        setIsLoadingPrice(false)
      }
    }

    fetchPrice()
    const interval = setInterval(fetchPrice, 15000)
    return () => clearInterval(interval)
  }, [selectedPair])

  // TradingView chart
  useEffect(() => {
    if (!chartContainerRef.current) return
    chartContainerRef.current.innerHTML = ''

    const tvConfig = {
      autosize: true,
      symbol: getTVSymbol(selectedPair),
      interval: '60',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      toolbar_bg: '#0d0d0d',
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_side_toolbar: false,
      allow_symbol_change: false,
      container_id: 'tv_chart_container',
      backgroundColor: '#0d0d0d',
      gridColor: 'rgba(255,255,255,0.04)',
      hide_volume: false,
      disabled_features: [
        'header_symbol_search', 'header_compare', 'header_screenshot',
        'header_undo_redo', 'use_localstorage_for_settings', 'border_around_the_chart',
      ],
      enabled_features: ['side_toolbar_in_fullscreen_mode'],
    }

    if (typeof window.TradingView !== 'undefined') {
      tvWidgetRef.current = new window.TradingView.widget(tvConfig)
    } else {
      const script = document.createElement('script')
      script.src = 'https://s3.tradingview.com/tv.js'
      script.async = true
      script.onload = () => {
        if (typeof window.TradingView !== 'undefined' && chartContainerRef.current) {
          tvWidgetRef.current = new window.TradingView.widget(tvConfig)
        }
      }
      document.head.appendChild(script)
    }

    return () => {
      if (tvWidgetRef.current && typeof tvWidgetRef.current.remove === 'function') {
        tvWidgetRef.current.remove()
      }
    }
  }, [selectedPair])

  const formatPrice = (num) => {
    if (!num || num === 0) return '0.00'
    if (num < 1) return num.toFixed(6)
    if (num < 100) return num.toFixed(2)
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const getBaseAsset = () => selectedPair.replace('USDT', '')

  // Price step: BTC=$10, ETH=$1, others=$0.01
  const priceStep = selectedPair === 'BTCUSDT' ? 10 : selectedPair === 'ETHUSDT' ? 1 : 0.01

  // Adjust price — uses live market price as base when field is empty
  const adjustPrice = (dir) => {
    const base = price === '' ? marketPrice : parseFloat(price.replace(/,/g, '')) || marketPrice
    const next = dir === 'up' ? base + priceStep : Math.max(0, base - priceStep)
    setPrice(formatPrice(next))
  }

  // Adjust size in $10 USDT steps
  const adjustSize = (dir) => {
    const base = size === '' ? 0 : Number(size)
    const next = dir === 'up' ? base + 10 : Math.max(0, base - 10)
    setSize(String(next))
  }

  // Clicking an order book row fills the price input
  const handleObClick = (obPrice) => {
    setPrice(formatPrice(obPrice))
  }

  return (
    <div className="binance-markets-page">
      <div className={`binance-trading-grid ${chartExpanded ? 'chart-is-expanded' : ''}`}>

        {/* LEFT: Chart */}
        <div className={`binance-chart-section ${chartExpanded ? 'chart-expanded' : ''}`}>

          {/* Pair Header */}
          <div className="binance-pair-header">
            <div className="pair-info">
              <div className="pair-name-row">
                <span className="pair-symbol">{selectedPair}</span>
                <span className="pair-type">Perp</span>
              </div>
              <div className="pair-price-data">
                <span className={`main-price ${priceChangePercent >= 0 ? 'positive' : 'negative'}`}>
                  {isLoadingPrice ? '—' : formatPrice(marketPrice)}
                </span>
                <span className={`price-change-amount ${priceChangePercent >= 0 ? 'positive' : 'negative'}`}>
                  {priceChange >= 0 ? '+' : ''}{formatPrice(priceChange)}
                  &nbsp;({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                </span>
              </div>
            </div>

            {/* Stats spaced across header */}
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
                <span className="stat-label">Funding / 8h</span>
                <span className="stat-value funding-rate">0.0100%</span>
              </div>
              <div className="stat-col">
                <span className="stat-label">24h High</span>
                <span className="stat-value positive">{formatPrice(high24h)}</span>
              </div>
            </div>
          </div>

          {/* Expand bar — directly above the chart */}
          <div className="chart-expand-bar">
            <button className="chart-expand-btn" onClick={() => setChartExpanded(e => !e)}>
              {chartExpanded ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3v5H3M21 3l-7 7M16 21v-5h5M3 21l7-7"/>
                  </svg>
                  Retract Chart
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                  </svg>
                  Expand Chart
                </>
              )}
            </button>
          </div>

          {/* TradingView Chart */}
          <div className="binance-chart-area">
            <div
              id="tv_chart_container"
              ref={chartContainerRef}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>

        {/* MIDDLE: Order Book */}
        <div className="binance-orderbook-column">
          <div className="orderbook-header">
            <span>Order Book</span>
            <div className="orderbook-view-btns">
              <button className="ob-view-btn active">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="1" y="1" width="6" height="14" opacity="0.5"/>
                  <rect x="9" y="1" width="6" height="14"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="orderbook-table-headers">
            <span>Price (USDT)</span>
            <span className="text-right">Size</span>
            <span className="text-right">Total</span>
          </div>

          {/* Sell orders — 8 fixed rows, no scroll */}
          <div className="ob-sells">
            {[...Array(8)].map((_, i) => {
              const obPrice = marketPrice + (8 - i) * 12
              const sz = (((i * 1.3 + 0.7) % 3.5) + 0.1).toFixed(3)
              const total = (Number(sz) * marketPrice).toFixed(0)
              return (
                <div key={`sell-${i}`} className="ob-row sell" onClick={() => handleObClick(obPrice)}>
                  <span className="ob-price negative">{formatPrice(obPrice)}</span>
                  <span className="ob-size">{sz}</span>
                  <span className="ob-sum">{Number(total).toLocaleString()}</span>
                </div>
              )
            })}
          </div>

          {/* Mid Price */}
          <div className="ob-current-price">
            <span className={`price-big ${priceChangePercent >= 0 ? 'positive' : 'negative'}`}>
              {formatPrice(marketPrice)}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                {priceChangePercent >= 0
                  ? <path d="M7 14l5-5 5 5z"/>
                  : <path d="M7 10l5 5 5-5z"/>
                }
              </svg>
            </span>
            <span className="price-usd">${formatPrice(marketPrice)}</span>
          </div>

          {/* Buy orders — 8 fixed rows, no scroll */}
          <div className="ob-buys">
            {[...Array(8)].map((_, i) => {
              const obPrice = marketPrice - (i + 1) * 12
              const sz = (((i * 0.9 + 1.1) % 3.5) + 0.1).toFixed(3)
              const total = (Number(sz) * marketPrice).toFixed(0)
              return (
                <div key={`buy-${i}`} className="ob-row buy" onClick={() => handleObClick(obPrice)}>
                  <span className="ob-price positive">{formatPrice(obPrice)}</span>
                  <span className="ob-size">{sz}</span>
                  <span className="ob-sum">{Number(total).toLocaleString()}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT: Order Entry */}
        <div className="binance-order-entry">
          <div className="order-entry-header">
            <button className="isolated-btn">Isolated</button>
            <button className="leverage-display">{leverage}x</button>
          </div>

          <div className="buy-sell-tabs">
            <button
              className={`bs-tab buy ${orderSide === 'buy' ? 'active' : ''}`}
              onClick={() => setOrderSide('buy')}
            >
              Buy / Long
            </button>
            <button
              className={`bs-tab sell ${orderSide === 'sell' ? 'active' : ''}`}
              onClick={() => setOrderSide('sell')}
            >
              Sell / Short
            </button>
          </div>

          <div className="order-type-selector">
            {['Limit', 'Market', 'Stop Limit'].map(t => (
              <button
                key={t}
                className={`ot-btn ${orderType === t ? 'active' : ''}`}
                onClick={() => setOrderType(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="avbl-row">
            <span>Avbl</span>
            <span className="avbl-value">{accountBalance.toLocaleString()} USDT</span>
          </div>

          {/* Price input: [−] [input | BASE ASSET] [+] */}
          {orderType !== 'Market' && (
            <div className="entry-input-group">
              <label>Price</label>
              <div className="input-row">
                <button className="input-adj-btn" onClick={() => adjustPrice('down')}>−</button>
                <div className="input-with-unit">
                  <input
                    type="text"
                    placeholder={formatPrice(marketPrice)}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                  <span className="input-unit-inside">{getBaseAsset()}</span>
                </div>
                <button className="input-adj-btn" onClick={() => adjustPrice('up')}>+</button>
              </div>
            </div>
          )}

          {/* Size input: [−] [input | USDT] [+] */}
          <div className="entry-input-group">
            <label>Size</label>
            <div className="input-row">
              <button className="input-adj-btn" onClick={() => adjustSize('down')}>−</button>
              <div className="input-with-unit">
                <input
                  type="text"
                  placeholder="0.00"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                />
                <span className="input-unit-inside">USDT</span>
              </div>
              <button className="input-adj-btn" onClick={() => adjustSize('up')}>+</button>
            </div>
            <div className="size-pct-btns">
              {['25%', '50%', '75%', '100%'].map(pct => (
                <button key={pct} className="pct-btn">{pct}</button>
              ))}
            </div>
          </div>

          <div className="tp-sl-row">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={tpEnabled}
                onChange={e => setTpEnabled(e.target.checked)}
              />
              <span>Take Profit</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={slEnabled}
                onChange={e => setSlEnabled(e.target.checked)}
              />
              <span>Stop Loss</span>
            </label>
          </div>

          <p className="tp-sl-notice">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="#f59e0b">
              <path d="M8 1L1 14h14L8 1zm0 3l5.5 9H2.5L8 4zm-1 3v3h2V7H7zm0 4v2h2v-2H7z"/>
            </svg>
            TP &amp; SL required by IJGF rules
          </p>

          <button className={`order-submit-btn ${orderSide === 'buy' ? 'buy-long-btn' : 'sell-short-btn'}`}>
            {orderSide === 'buy' ? '▲ Buy / Long' : '▼ Sell / Short'}
          </button>

          <div className="risk-metrics-panel">
            <div className="risk-metric-row">
              <span className="rm-label">
                <svg width="10" height="10" viewBox="0 0 16 16" fill="#22c55e">
                  <circle cx="8" cy="8" r="6"/>
                </svg>
                Profit Target
              </span>
              <span className="rm-value">$0 / $1,000</span>
            </div>
            <div className="risk-metric-row">
              <span className="rm-label">
                <svg width="10" height="10" viewBox="0 0 16 16" fill="#f59e0b">
                  <path d="M8 1L1 14h14L8 1zm-1 9v2h2v-2H7zm0-5v4h2V5H7z"/>
                </svg>
                Daily Loss
              </span>
              <span className="rm-value">$0 / $400</span>
            </div>
            <div className="risk-metric-row">
              <span className="rm-label">
                <svg width="10" height="10" viewBox="0 0 16 16" fill="#ef4444">
                  <circle cx="8" cy="8" r="6"/>
                </svg>
                Max Drawdown
              </span>
              <span className="rm-value">$0 / $600</span>
            </div>
          </div>

          <div className="order-summary">
            <div className="summary-row"><span>Margin Required</span><span>—</span></div>
            <div className="summary-row"><span>Taker Fee (0.04%)</span><span>—</span></div>
            <div className="summary-row"><span>Est. Liquidation</span><span>—</span></div>
          </div>
        </div>
      </div>

      {/* Bottom: Positions & Account */}
      <div className="binance-bottom-section">
        <div className="positions-panel">
          <div className="positions-tabs">
            {['Positions(0)', 'Open Orders(0)', 'Order History', 'Trade History', 'Transactions'].map(tab => (
              <button
                key={tab}
                className={`pos-tab ${activePositionsTab === tab ? 'active' : ''}`}
                onClick={() => setActivePositionsTab(tab)}
              >
                {tab}
              </button>
            ))}
            <label className="hide-symbols">
              <input type="checkbox" />
              <span>Hide Other Symbols</span>
            </label>
          </div>

          <div className="positions-table-headers">
            <span>Symbol</span>
            <span>Size</span>
            <span>Entry Price</span>
            <span>Break Even</span>
            <span>Mark Price</span>
            <span>Liq. Price</span>
            <span>Margin</span>
            <span>PNL (ROI%)</span>
          </div>

          {positions.length === 0 && (
            <div className="empty-positions">
              <svg width="48" height="48" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.2">
                <rect x="10" y="10" width="18" height="18" rx="2"/>
                <rect x="36" y="10" width="18" height="18" rx="2"/>
                <rect x="36" y="36" width="18" height="18" rx="2"/>
                <rect x="10" y="36" width="18" height="18" rx="2"/>
              </svg>
              <p>No open positions</p>
            </div>
          )}
        </div>

        <div className="account-panel">
          <div className="account-header"><span>Account</span></div>
          <div className="account-stats">
            <div className="account-row">
              <span>Margin Ratio</span>
              <span className="positive">—</span>
            </div>
            <div className="account-row">
              <span>Margin Balance</span>
              <span>{marginBalance.toLocaleString()} USDT</span>
            </div>
            <div className="account-row">
              <span>Unrealized PNL</span>
              <span className={unrealizedPNL >= 0 ? 'positive' : 'negative'}>
                {unrealizedPNL.toFixed(2)} USDT
              </span>
            </div>
          </div>
          <div className="account-actions">
            <button>Transfer</button>
            <button>Buy Crypto</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MarketsPage