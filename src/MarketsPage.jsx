import { useState, useEffect, useRef, useMemo } from 'react'

function MarketsPage() {
  const [selectedPair, setSelectedPair] = useState('BTCUSDT')
  const [allPrices, setAllPrices] = useState({})
  const [isLoadingPrice, setIsLoadingPrice] = useState(true)
  const [orderType, setOrderType] = useState('Limit')
  const [orderSide, setOrderSide] = useState('buy')
  const [price, setPrice] = useState('')
  const [size, setSize] = useState('')
  const [leverage] = useState(10)
  const [tpEnabled, setTpEnabled] = useState(false)
  const [slEnabled, setSlEnabled] = useState(false)
  const [tpPrice, setTpPrice] = useState('')
  const [slPrice, setSlPrice] = useState('')
  const [activePositionsTab, setActivePositionsTab] = useState('Positions(0)')
  const [chartFullscreen, setChartFullscreen] = useState(false)
  const [activeTimeframe, setActiveTimeframe] = useState('1D')
  const [obTick, setObTick] = useState(0)
  const [showPairSearch, setShowPairSearch] = useState(false)
  const [pairSearchQuery, setPairSearchQuery] = useState('')
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  const [mobilePanel, setMobilePanel] = useState('chart')

  const tvContainerDesktopRef = useRef(null)
  const tvContainerMobileRef = useRef(null)
  const tvScriptRef = useRef(null)
  const pairBtnRef = useRef(null)

  const coinGeckoMap = {
    BTCUSDT: 'bitcoin', ETHUSDT: 'ethereum', SOLUSDT: 'solana',
    BNBUSDT: 'binancecoin', DOGEUSDT: 'dogecoin', XRPUSDT: 'ripple',
    ADAUSDT: 'cardano', AVAXUSDT: 'avalanche-2',
  }

  const popularPairs = [
    { symbol: 'BTCUSDT', name: 'Bitcoin' }, { symbol: 'ETHUSDT', name: 'Ethereum' },
    { symbol: 'SOLUSDT', name: 'Solana' }, { symbol: 'BNBUSDT', name: 'BNB' },
    { symbol: 'DOGEUSDT', name: 'Dogecoin' }, { symbol: 'XRPUSDT', name: 'XRP' },
    { symbol: 'ADAUSDT', name: 'Cardano' }, { symbol: 'AVAXUSDT', name: 'Avalanche' },
  ]

  const filteredPairs = popularPairs.filter(p =>
    p.symbol.toLowerCase().includes(pairSearchQuery.toLowerCase()) ||
    p.name.toLowerCase().includes(pairSearchQuery.toLowerCase())
  )

  const tfToTv = { '1m': '1', '5m': '5', '15m': '15', '1H': '60', '4H': '240', '1D': 'D', '1W': 'W' }

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        setIsLoadingPrice(true)
        const ids = Object.values(coinGeckoMap).join(',')
        const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=24h`)
        const data = await res.json()
        const map = {}
        data.forEach(coin => {
          const sym = Object.keys(coinGeckoMap).find(k => coinGeckoMap[k] === coin.id)
          if (sym) map[sym] = coin
        })
        setAllPrices(map)
      } catch (e) { console.error('Price fetch error:', e) }
      finally { setIsLoadingPrice(false) }
    }
    fetchPrices()
    const interval = setInterval(fetchPrices, 15000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setObTick(n => n + 1), 2000)
    return () => clearInterval(t)
  }, [])

  const loadTVWidget = (containerRef) => {
    if (!containerRef.current) return
    containerRef.current.innerHTML = ''
    const containerId = `tv_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const widgetDiv = document.createElement('div')
    widgetDiv.id = containerId
    widgetDiv.style.cssText = 'width:100%;height:100%;'
    containerRef.current.appendChild(widgetDiv)

    const config = {
      autosize: true,
      symbol: `BINANCE:${selectedPair}`,
      interval: tfToTv[activeTimeframe] || 'D',
      timezone: 'Etc/UTC', theme: 'dark', style: '1', locale: 'en',
      toolbar_bg: '#131722', enable_publishing: false,
      hide_side_toolbar: false, allow_symbol_change: true,
      container_id: containerId,
      overrides: {
        'mainSeriesProperties.candleStyle.upColor': '#0ecb81',
        'mainSeriesProperties.candleStyle.downColor': '#f6465d',
        'mainSeriesProperties.candleStyle.borderUpColor': '#0ecb81',
        'mainSeriesProperties.candleStyle.borderDownColor': '#f6465d',
        'mainSeriesProperties.candleStyle.wickUpColor': '#0ecb81',
        'mainSeriesProperties.candleStyle.wickDownColor': '#f6465d',
        'paneProperties.background': '#0e1116',
        'paneProperties.backgroundType': 'solid',
        'scalesProperties.backgroundColor': '#0e1116',
      },
    }

    const init = () => { if (window.TradingView && containerRef.current) new window.TradingView.widget(config) }

    if (window.TradingView) { init(); return }
    if (!tvScriptRef.current) {
      const script = document.createElement('script')
      script.src = 'https://s3.tradingview.com/tv.js'
      script.async = true
      script.onload = init
      tvScriptRef.current = script
      document.head.appendChild(script)
    } else {
      const check = setInterval(() => { if (window.TradingView) { clearInterval(check); init() } }, 200)
      setTimeout(() => clearInterval(check), 10000)
    }
  }

  // Load TV for desktop
  useEffect(() => { loadTVWidget(tvContainerDesktopRef) }, [selectedPair, activeTimeframe])

  // Load TV for mobile (only when chart tab active)
  useEffect(() => {
    if (mobilePanel === 'chart') loadTVWidget(tvContainerMobileRef)
  }, [selectedPair, activeTimeframe, mobilePanel])

  const orderBook = useMemo(() => {
    const midPrice = allPrices[selectedPair]?.current_price || 95000
    const ph = (n) => Math.abs(Math.sin(n * 127.1 + obTick * 311.7) * 0.5 + Math.cos(n * 431.3 + obTick * 173.1) * 0.5)
    const asks = Array.from({ length: 14 }, (_, i) => {
      const offset = (i + 1) * midPrice * 0.0003 * (1 + ph(i + 100) * 0.5)
      const p = midPrice + offset
      const sz = (ph(i) * 5 + 0.2).toFixed(3)
      const tot = (p * parseFloat(sz) / 1000).toFixed(1) + 'K'
      return { price: p, size: sz, total: tot, pct: ph(i + 50) * 70 + 15 }
    }).reverse()
    const bids = Array.from({ length: 14 }, (_, i) => {
      const offset = (i + 1) * midPrice * 0.0003 * (1 + ph(i + 200) * 0.5)
      const p = midPrice - offset
      const sz = (ph(i + 50) * 5 + 0.2).toFixed(3)
      const tot = (p * parseFloat(sz) / 1000).toFixed(1) + 'K'
      return { price: p, size: sz, total: tot, pct: ph(i + 150) * 70 + 15 }
    })
    return { asks, bids }
  }, [selectedPair, allPrices, obTick])

  const cur = allPrices[selectedPair]
  const marketPrice = cur?.current_price || 0
  const priceChangePercent = cur?.price_change_percentage_24h || 0
  const priceChange = cur?.price_change_24h || 0
  const high24h = cur?.high_24h || 0
  const low24h = cur?.low_24h || 0
  const vol24h = cur?.total_volume || 0

  const formatPrice = (num) => {
    if (!num) return '—'
    if (num < 1) return num.toFixed(5)
    if (num < 100) return num.toFixed(2)
    return num.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  }
  const formatVol = (num) => {
    if (!num) return '—'
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B'
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M'
    return num.toLocaleString()
  }

  const timeframes = ['1m', '5m', '15m', '1H', '4H', '1D', '1W']

  const handlePairSelectorClick = () => {
    if (pairBtnRef.current) {
      const rect = pairBtnRef.current.getBoundingClientRect()
      setDropdownPos({ top: rect.bottom + 6, left: rect.left })
    }
    setShowPairSearch(v => !v)
    setPairSearchQuery('')
  }
  const closePairSearch = () => { setShowPairSearch(false); setPairSearchQuery('') }

  // ─── Shared JSX blocks ────────────────────────────────────────

  const pairHeaderInner = (
    <div className="mkts-pair-header">
      <div className="mkts-pair-left">
        <div className="mkts-pair-selector-wrap">
          <button ref={pairBtnRef} className="mkts-pair-selector" onClick={handlePairSelectorClick}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <span className="mkts-pair-symbol">{selectedPair}</span>
            <span className="mkts-pair-badge">Perp</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>
        </div>
        <div className="mkts-price-block">
          <span className={`mkts-main-price ${priceChangePercent >= 0 ? 'pos' : 'neg'}`}>
            {isLoadingPrice ? '—' : formatPrice(marketPrice)}
          </span>
          <span className={`mkts-price-chg ${priceChangePercent >= 0 ? 'pos' : 'neg'}`}>
            {priceChange >= 0 ? '+' : ''}{formatPrice(priceChange)}&nbsp;
            ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
          </span>
        </div>
      </div>
      <div className="mkts-pair-stats">
        <div className="mkts-stat"><span className="mkts-stat-lbl">24h High</span><span className="mkts-stat-val">{formatPrice(high24h)}</span></div>
        <div className="mkts-stat"><span className="mkts-stat-lbl">24h Low</span><span className="mkts-stat-val">{formatPrice(low24h)}</span></div>
        <div className="mkts-stat"><span className="mkts-stat-lbl">24h Vol</span><span className="mkts-stat-val">{formatVol(vol24h)}</span></div>
        <div className="mkts-stat"><span className="mkts-stat-lbl">Funding / 8h</span><span className="mkts-stat-val" style={{ color: '#0ecb81' }}>0.0100%</span></div>
      </div>
    </div>
  )

  const orderBookInner = (
    <div className="mkts-orderbook">
      <div className="mkts-ob-header"><span>Order Book</span></div>
      <div className="mkts-ob-heads">
        <span>Price(USDT)</span><span>Size</span><span>Total</span>
      </div>
      <div className="mkts-ob-content">
        <div className="mkts-ob-asks">
          {orderBook.asks.map((row, i) => (
            <div key={i} className="mkts-ob-row">
              <div className="mkts-ob-depth ask-depth" style={{ width: `${row.pct}%` }} />
              <span className="mkts-ob-pr neg">{formatPrice(row.price)}</span>
              <span className="mkts-ob-sz">{row.size}</span>
              <span className="mkts-ob-tot">{row.total}</span>
            </div>
          ))}
        </div>
        <div className={`mkts-ob-mid ${priceChangePercent >= 0 ? 'pos' : 'neg'}`}>
          <span>{formatPrice(marketPrice)}</span>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
            <path d={priceChangePercent >= 0 ? 'M12 4l8 16H4z' : 'M12 20l-8-16h16z'}/>
          </svg>
        </div>
        <div className="mkts-ob-bids">
          {orderBook.bids.map((row, i) => (
            <div key={i} className="mkts-ob-row">
              <div className="mkts-ob-depth bid-depth" style={{ width: `${row.pct}%` }} />
              <span className="mkts-ob-pr pos">{formatPrice(row.price)}</span>
              <span className="mkts-ob-sz">{row.size}</span>
              <span className="mkts-ob-tot">{row.total}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const orderEntryInner = (
    <div className="mkts-order-entry">
      <div className="mkts-oe-top-row">
        <button className="mkts-margin-btn">Isolated</button>
        <button className="mkts-lev-btn">{leverage}×</button>
      </div>
      <div className="mkts-side-tabs">
        <button className={`mkts-side-tab buy-tab ${orderSide === 'buy' ? 'active' : ''}`} onClick={() => setOrderSide('buy')}>Buy / Long</button>
        <button className={`mkts-side-tab sell-tab ${orderSide === 'sell' ? 'active' : ''}`} onClick={() => setOrderSide('sell')}>Sell / Short</button>
      </div>
      <div className="mkts-ot-tabs">
        {['Limit', 'Market', 'Stop Limit'].map(t => (
          <button key={t} className={`mkts-ot-btn ${orderType === t ? 'active' : ''}`} onClick={() => setOrderType(t)}>{t}</button>
        ))}
      </div>
      <div className="mkts-avbl">
        <span>Avbl</span>
        <span className="mkts-avbl-val">10,000.00 USDT</span>
      </div>
      {orderType !== 'Market' && (
        <div className="mkts-field">
          <label className="mkts-field-lbl">Price</label>
          <div className="mkts-field-row">
            <button className="mkts-adj" onClick={() => setPrice(p => (parseFloat(p || marketPrice) - 1).toFixed(1))}>−</button>
            <input type="number" className="mkts-input" placeholder={formatPrice(marketPrice)} value={price} onChange={e => setPrice(e.target.value)} />
            <button className="mkts-adj" onClick={() => setPrice(p => (parseFloat(p || marketPrice) + 1).toFixed(1))}>+</button>
            <span className="mkts-unit">USDT</span>
          </div>
        </div>
      )}
      <div className="mkts-field">
        <label className="mkts-field-lbl">Size</label>
        <div className="mkts-field-row">
          <button className="mkts-adj" onClick={() => setSize(s => Math.max(0, parseFloat(s || 0) - 0.001).toFixed(3))}>−</button>
          <input type="number" className="mkts-input" placeholder="0.000" value={size} onChange={e => setSize(e.target.value)} />
          <button className="mkts-adj" onClick={() => setSize(s => (parseFloat(s || 0) + 0.001).toFixed(3))}>+</button>
          <span className="mkts-unit">BTC</span>
        </div>
        <div className="mkts-pct-btns">
          {[25, 50, 75, 100].map(pct => (
            <button key={pct} className="mkts-pct" onClick={() => setSize(marketPrice ? (10000 * pct / 100 / marketPrice).toFixed(4) : '0')}>{pct}%</button>
          ))}
        </div>
      </div>
      <div className="mkts-tpsl">
        <div className="mkts-tpsl-checks">
          <label className="mkts-chk">
            <input type="checkbox" checked={tpEnabled} onChange={e => setTpEnabled(e.target.checked)} />
            <span>Take Profit</span>
          </label>
          <label className="mkts-chk">
            <input type="checkbox" checked={slEnabled} onChange={e => setSlEnabled(e.target.checked)} />
            <span>Stop Loss</span>
          </label>
        </div>
        {tpEnabled && <input type="number" className="mkts-input mkts-tpsl-inp" placeholder="TP Price (USDT)" value={tpPrice} onChange={e => setTpPrice(e.target.value)} />}
        {slEnabled && <input type="number" className="mkts-input mkts-tpsl-inp" placeholder="SL Price (USDT)" value={slPrice} onChange={e => setSlPrice(e.target.value)} />}
        <div className="mkts-rule-notice">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f0a500" strokeWidth="2.5">
            <path d="m10.29 3.86-8.2 14.22A1 1 0 0 0 3 20h18a1 1 0 0 0 .91-1.41l-8.2-14.22a1 1 0 0 0-1.84-.01Z"/>
            <line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
          </svg>
          TP &amp; SL required by IJGF rules
        </div>
      </div>
      <div className="mkts-summary">
        <div className="mkts-sum-row"><span>Margin Required</span><span>—</span></div>
        <div className="mkts-sum-row"><span>Taker Fee (0.04%)</span><span>—</span></div>
        <div className="mkts-sum-row"><span>Est. Liquidation</span><span>—</span></div>
      </div>
      <button className={`mkts-place-btn ${orderSide === 'buy' ? 'mkts-buy-btn' : 'mkts-sell-btn'}`}>
        {orderSide === 'buy' ? '▲ Buy / Long' : '▼ Sell / Short'}
      </button>
    </div>
  )

  const positionsPanelInner = (
    <div className="mkts-bottom">
      <div className="mkts-pos-tabs-row">
        {['Positions(0)', 'Open Orders(0)', 'Order History', 'Trade History'].map(tab => (
          <button key={tab} className={`mkts-pos-tab ${activePositionsTab === tab ? 'active' : ''}`} onClick={() => setActivePositionsTab(tab)}>{tab}</button>
        ))}
        <label className="mkts-hide-others">
          <input type="checkbox" />
          <span>Current pair only</span>
        </label>
      </div>
      <div className="mkts-pos-cols">
        <span>Symbol</span><span>Size</span><span>Entry Price</span>
        <span>Mark Price</span><span>Liq. Price</span><span>Margin</span>
        <span>PNL (ROI%)</span><span>TP/SL</span><span>Action</span>
      </div>
      <div className="mkts-empty-pos">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5">
          <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/>
        </svg>
        <span>No open positions</span>
      </div>
    </div>
  )

  const riskBar = (
    <div className="mkts-risk-bar">
      <div className="mkts-risk-item">
        <span className="mkts-risk-lbl">🎯 Profit Target</span>
        <div className="mkts-risk-track"><div className="mkts-risk-fill" style={{ width: '0%', background: '#0ecb81' }} /></div>
        <span className="mkts-risk-amt">$0 / $1,000</span>
      </div>
      <div className="mkts-risk-item">
        <span className="mkts-risk-lbl">⚠️ Daily Loss</span>
        <div className="mkts-risk-track"><div className="mkts-risk-fill" style={{ width: '0%', background: '#0ecb81' }} /></div>
        <span className="mkts-risk-amt">$0 / $400</span>
      </div>
      <div className="mkts-risk-item">
        <span className="mkts-risk-lbl">📉 Max Drawdown</span>
        <div className="mkts-risk-track"><div className="mkts-risk-fill" style={{ width: '0%', background: '#0ecb81' }} /></div>
        <span className="mkts-risk-amt">$0 / $600</span>
      </div>
    </div>
  )

  const chartControls = (
    <div className="mkts-chart-controls">
      <div className="mkts-tfs">
        {timeframes.map(tf => (
          <button key={tf} className={`mkts-tf-btn ${activeTimeframe === tf ? 'active' : ''}`} onClick={() => setActiveTimeframe(tf)}>{tf}</button>
        ))}
      </div>
      <button className="mkts-fs-btn" onClick={() => setChartFullscreen(v => !v)} title={chartFullscreen ? 'Exit fullscreen' : 'Expand chart'}>
        {chartFullscreen
          ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 0 2-2h3M3 16h3a2 2 0 0 0 2 2v3"/></svg>Exit</>
          : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>Expand</>
        }
      </button>
    </div>
  )

  return (
    <div className="mkts-page">

      {/* ═══════════════════════════════════ DESKTOP ═════════════════════════════════ */}
      <div className="mkts-desktop-layout">
        <div className={`mkts-trading-grid ${chartFullscreen ? 'mkts-fs-grid' : ''}`}>

          {/* Chart column */}
          <div className={`mkts-chart-section ${chartFullscreen ? 'mkts-chart-fs' : ''}`}>
            {pairHeaderInner}
            {chartControls}
            {riskBar}
            <div className="mkts-chart-area" ref={tvContainerDesktopRef} />
          </div>

          {/* Order book */}
          {!chartFullscreen && orderBookInner}

          {/* Order entry */}
          {!chartFullscreen && orderEntryInner}
        </div>

        {/* Positions — separate row, always below grid */}
        {!chartFullscreen && positionsPanelInner}
      </div>

      {/* ═══════════════════════════════════ MOBILE ══════════════════════════════════ */}
      <div className="mkts-mobile-layout">
        {/* Mobile pair header */}
        {pairHeaderInner}

        {/* Mobile tab bar */}
        <div className="mkts-mobile-tabs">
          <button className={`mkts-mob-tab ${mobilePanel === 'chart' ? 'active' : ''}`} onClick={() => setMobilePanel('chart')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            Chart
          </button>
          <button className={`mkts-mob-tab ${mobilePanel === 'book' ? 'active' : ''}`} onClick={() => setMobilePanel('book')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            Order Book
          </button>
          <button className={`mkts-mob-tab ${mobilePanel === 'trade' ? 'active' : ''}`} onClick={() => setMobilePanel('trade')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            Trade
          </button>
        </div>

        {/* Chart panel */}
        {mobilePanel === 'chart' && (
          <div className="mkts-mob-chart-panel">
            <div className="mkts-chart-controls">
              <div className="mkts-tfs">
                {timeframes.map(tf => (
                  <button key={tf} className={`mkts-tf-btn ${activeTimeframe === tf ? 'active' : ''}`} onClick={() => setActiveTimeframe(tf)}>{tf}</button>
                ))}
              </div>
            </div>
            <div className="mkts-risk-bar mkts-risk-bar-compact">
              <div className="mkts-risk-item">
                <span className="mkts-risk-lbl">🎯</span>
                <div className="mkts-risk-track"><div className="mkts-risk-fill" style={{ width: '0%', background: '#0ecb81' }} /></div>
                <span className="mkts-risk-amt">$0/$1K</span>
              </div>
              <div className="mkts-risk-item">
                <span className="mkts-risk-lbl">⚠️</span>
                <div className="mkts-risk-track"><div className="mkts-risk-fill" style={{ width: '0%', background: '#0ecb81' }} /></div>
                <span className="mkts-risk-amt">$0/$400</span>
              </div>
            </div>
            <div className="mkts-mob-chart-area" ref={tvContainerMobileRef} />
          </div>
        )}

        {/* Order book panel */}
        {mobilePanel === 'book' && (
          <div className="mkts-mob-book-panel">
            {orderBookInner}
          </div>
        )}

        {/* Trade panel */}
        {mobilePanel === 'trade' && (
          <div className="mkts-mob-trade-panel">
            {orderEntryInner}
          </div>
        )}
      </div>

      {/* ═══ Pair dropdown — FIXED position above TradingView iframe ═══ */}
      {showPairSearch && (
        <>
          <div className="mkts-pair-backdrop" style={{ zIndex: 99998 }} onClick={closePairSearch} />
          <div className="mkts-pair-dropdown" style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex: 99999 }}>
            <div className="mkts-pair-search-row">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#848e9c" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                autoFocus
                className="mkts-pair-search-input"
                placeholder="Search pair..."
                value={pairSearchQuery}
                onChange={e => setPairSearchQuery(e.target.value)}
              />
            </div>
            <div className="mkts-pair-list">
              {filteredPairs.map(p => {
                const pd = allPrices[p.symbol]
                return (
                  <button
                    key={p.symbol}
                    className={`mkts-pair-opt ${selectedPair === p.symbol ? 'active' : ''}`}
                    onClick={() => { setSelectedPair(p.symbol); closePairSearch() }}
                  >
                    <span className="mkts-po-sym">{p.symbol}</span>
                    <span className="mkts-po-name">{p.name}</span>
                    {pd && <span className={`mkts-po-chg ${pd.price_change_percentage_24h >= 0 ? 'pos' : 'neg'}`}>
                      {pd.price_change_percentage_24h >= 0 ? '+' : ''}{pd.price_change_percentage_24h?.toFixed(2)}%
                    </span>}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default MarketsPage