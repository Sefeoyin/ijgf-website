import { useState, useEffect, useMemo, useRef, useCallback } from 'react'

function MarketsPage() {
  // ── Pair & price state ──────────────────────────────────────────
  const [selectedPair, setSelectedPair] = useState('BTCUSDT')
  const [pairsData, setPairsData]       = useState({})
  const [obTick, setObTick]             = useState(0)

  // ── Order form state ────────────────────────────────────────────
  const [orderType,      setOrderType]      = useState('Limit')
  const [tradeDirection, setTradeDirection] = useState('buy')
  const [price, setPrice]                   = useState('')
  const [size,  setSize]                    = useState('')
  const [leverage]                          = useState(10)
  const [tpChecked, setTpChecked]           = useState(false)
  const [slChecked, setSlChecked]           = useState(false)
  const [tpPrice,   setTpPrice]             = useState('')
  const [slPrice,   setSlPrice]             = useState('')

  // ── UI state ────────────────────────────────────────────────────
  const [activePositionsTab, setActivePositionsTab] = useState('0')
  const [activeChartTab,     setActiveChartTab]     = useState('Chart')
  const [activeTimeframe,    setActiveTimeframe]    = useState('1H')

  // ── Chart refs ──────────────────────────────────────────────────
  const chartContainerRef = useRef(null)
  const tvScriptLoaded    = useRef(false)

  // ── Account / challenge constants ───────────────────────────────
  const accountBalance   = 10000
  const marginBalance    = 10000
  const unrealizedPNL    = 0
  const challengeSize    = 10000
  const profitTarget     = 10   // 10 %
  const dailyDDLimit     = 4    //  4 %
  const maxDDLimit       = 6    //  6 %
  const currentProfit    = 0
  const currentDailyLoss = 0
  const currentMaxDD     = 0

  // ── Pairs config ────────────────────────────────────────────────
  const pairs = [
    { symbol: 'BTCUSDT',  coinId: 'bitcoin'     },
    { symbol: 'ETHUSDT',  coinId: 'ethereum'    },
    { symbol: 'SOLUSDT',  coinId: 'solana'      },
    { symbol: 'BNBUSDT',  coinId: 'binancecoin' },
    { symbol: 'DOGEUSDT', coinId: 'dogecoin'    },
  ]

  // ── Fetch all pairs at once ─────────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const ids = pairs.map(p => p.coinId).join(',')
        const res  = await fetch(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=24h`
        )
        const data = await res.json()
        const mapped = {}
        data.forEach(coin => {
          const pair = pairs.find(p => p.coinId === coin.id)
          if (pair) {
            mapped[pair.symbol] = {
              price:         coin.current_price                || 0,
              change24h:     coin.price_change_24h             || 0,
              changePercent: coin.price_change_percentage_24h  || 0,
              high24h:       coin.high_24h                     || 0,
              low24h:        coin.low_24h                      || 0,
              volume24h:     coin.total_volume                 || 0,
            }
          }
        })
        setPairsData(mapped)
      } catch (e) {
        console.error('Price fetch error:', e)
      }
    }
    fetchAll()
    const iv = setInterval(fetchAll, 15000)
    return () => clearInterval(iv)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Tick order book every 2 s ───────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => setObTick(t => t + 1), 2000)
    return () => clearInterval(iv)
  }, [])

  // ── TradingView widget ──────────────────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return
    chartContainerRef.current.innerHTML = ''

    const tf = activeTimeframe === '1D' ? 'D'
             : activeTimeframe === '1W' ? 'W'
             : activeTimeframe

    const mountWidget = () => {
      if (!window.TradingView || !chartContainerRef.current) return
      new window.TradingView.widget({
        container_id:        'mkts-tv-chart',
        symbol:              `BINANCE:${selectedPair}`,
        interval:            tf,
        theme:               'dark',
        style:               '1',
        locale:              'en',
        toolbar_bg:          '#0d0f14',
        enable_publishing:   false,
        hide_side_toolbar:   false,
        allow_symbol_change: false,
        save_image:          false,
        autosize:            true,
        overrides: {
          'paneProperties.background':     '#0d0f14',
          'paneProperties.backgroundType': 'solid',
          'scalesProperties.lineColor':    '#1e2530',
          'scalesProperties.textColor':    '#636b77',
        },
      })
    }

    if (window.TradingView) {
      mountWidget()
    } else if (!tvScriptLoaded.current) {
      tvScriptLoaded.current = true
      const s = document.createElement('script')
      s.src   = 'https://s3.tradingview.com/tv.js'
      s.async = true
      s.onload = mountWidget
      document.head.appendChild(s)
    } else {
      const poll = setInterval(() => {
        if (window.TradingView) { clearInterval(poll); mountWidget() }
      }, 200)
      return () => clearInterval(poll)
    }
  }, [selectedPair, activeTimeframe])

  // ── Pseudo-stable order book ────────────────────────────────────
  const genBook = useCallback((basePrice, tick) => {
    if (!basePrice) return { sells: [], buys: [] }
    const ph = n => Math.abs(
      Math.sin(n * 127.1 + tick * 311.7) * 0.5 +
      Math.cos(n * 431.3 + tick * 173.1) * 0.5
    )
    const step = basePrice < 1 ? 0.000005 : basePrice < 100 ? 0.005 : 0.5

    const sells = Array.from({ length: 14 }, (_, i) => ({
      price: basePrice + (i + 1) * step * (1 + ph(i) * 2),
      size:  (ph(i + 14) * 4800 + 200).toFixed(2),
      depth: ph(i + 28) * 86 + 4,
    })).reverse()

    const buys = Array.from({ length: 14 }, (_, i) => ({
      price: basePrice - (i + 1) * step * (1 + ph(i + 50) * 2),
      size:  (ph(i + 64) * 4800 + 200).toFixed(2),
      depth: ph(i + 78) * 86 + 4,
    }))

    return { sells, buys }
  }, [])

  const orderBook = useMemo(
    () => genBook(pairsData[selectedPair]?.price, obTick),
    [pairsData, selectedPair, obTick, genBook]
  )

  // ── Recent trades ───────────────────────────────────────────────
  const recentTrades = useMemo(() => {
    const base = pairsData[selectedPair]?.price || 0
    if (!base) return []
    const ph = n => Math.abs(Math.sin(n * 91.3 + obTick * 201.7))
    return Array.from({ length: 10 }, (_, i) => {
      const d = new Date()
      d.setSeconds(d.getSeconds() - i * 7)
      return {
        price: base * (1 + (ph(i) - 0.5) * 0.002),
        size:  (ph(i + 10) * 9.5 + 0.5).toFixed(3),
        isBuy: ph(i + 20) > 0.5,
        time:  `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`,
      }
    })
  }, [pairsData, selectedPair, obTick])

  // ── Derived values ──────────────────────────────────────────────
  const cur          = pairsData[selectedPair] || {}
  const marketPrice  = cur.price         || 0
  const changePct    = cur.changePercent || 0
  const changeDollar = cur.change24h     || 0
  const high24h      = cur.high24h       || 0
  const low24h       = cur.low24h        || 0
  const vol24h       = cur.volume24h     || 0

  const fmtPrice = n => {
    if (!n) return '—'
    if (n < 0.01)  return n.toFixed(6)
    if (n < 1)     return n.toFixed(4)
    if (n < 100)   return n.toFixed(2)
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  const fmtVol = n => {
    if (!n) return '—'
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
    return (n / 1e3).toFixed(2) + 'K'
  }

  // ── Risk helpers ────────────────────────────────────────────────
  const riskPct   = (val, limit) => Math.min((val / limit) * 100, 100)
  const riskColor = pct => pct > 80 ? '#f6465d' : pct > 50 ? '#f0a500' : '#0ecb81'
  const profitPct    = riskPct(currentProfit,    challengeSize * profitTarget / 100)
  const dailyLossPct = riskPct(currentDailyLoss, challengeSize * dailyDDLimit  / 100)
  const maxDDPct     = riskPct(currentMaxDD,     challengeSize * maxDDLimit    / 100)

  const tfList   = ['1m','5m','15m','1H','4H','1D','1W']
  const possTabs = ['Positions (0)','Open Orders (0)','Order History','Trade History','Position History']

  return (
    <div className="mkts-page">

      {/* ════════════════ TICKER BAR ════════════════ */}
      <div className="mkts-ticker-bar">
        {pairs.map(pair => {
          const d   = pairsData[pair.symbol]
          const pct = d?.changePercent || 0
          return (
            <button
              key={pair.symbol}
              className={`mkts-ticker-item ${selectedPair === pair.symbol ? 'active' : ''}`}
              onClick={() => setSelectedPair(pair.symbol)}
            >
              <span className="mkts-ticker-sym">{pair.symbol}</span>
              <span className={`mkts-ticker-px ${pct >= 0 ? 'pos' : 'neg'}`}>
                {d ? fmtPrice(d.price) : '—'}
              </span>
              <span className={`mkts-ticker-pct ${pct >= 0 ? 'pos' : 'neg'}`}>
                {d ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : '—'}
              </span>
            </button>
          )
        })}
      </div>

      {/* ════════════════ MAIN GRID ════════════════ */}
      <div className="mkts-trading-grid">

        {/* ─── LEFT: Chart column ─────────────────── */}
        <div className="mkts-chart-col">

          {/* Pair header */}
          <div className="mkts-pair-header">
            <div className="mkts-pair-left">
              <div className="mkts-pair-icon">
                {selectedPair.replace('USDT','').slice(0,1)}
              </div>
              <div>
                <div className="mkts-pair-name-row">
                  <span className="mkts-pair-sym">{selectedPair}</span>
                  <span className="mkts-perp-badge">Perp</span>
                </div>
                <div className="mkts-pair-price-row">
                  <span className={`mkts-main-px ${changePct >= 0 ? 'pos' : 'neg'}`}>
                    {marketPrice ? fmtPrice(marketPrice) : '—'}
                  </span>
                  <span className={`mkts-px-delta ${changePct >= 0 ? 'pos' : 'neg'}`}>
                    {changeDollar >= 0 ? '+' : ''}{fmtPrice(changeDollar)}
                    &nbsp;({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>

            <div className="mkts-pair-stats">
              {[
                { label: 'Mark',       val: fmtPrice(marketPrice),       cls: '' },
                { label: '24h High',   val: fmtPrice(high24h),           cls: 'pos' },
                { label: '24h Low',    val: fmtPrice(low24h),            cls: 'neg' },
                { label: '24h Volume', val: fmtVol(vol24h),              cls: '' },
                { label: 'Funding/8h', val: '0.00322%',                  cls: 'pos', extra: '02:15:14' },
              ].map(s => (
                <div key={s.label} className="mkts-stat-item">
                  <span className="mkts-stat-label">{s.label}</span>
                  <span className={`mkts-stat-val ${s.cls}`}>
                    {s.val}{s.extra && <em className="mkts-funding-timer"> {s.extra}</em>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Chart controls */}
          <div className="mkts-chart-controls">
            <div className="mkts-chart-tabs">
              {['Chart','Info','Trading Data'].map(t => (
                <button
                  key={t}
                  className={`mkts-chart-tab ${activeChartTab === t ? 'active' : ''}`}
                  onClick={() => setActiveChartTab(t)}
                >{t}</button>
              ))}
            </div>
            <div className="mkts-tf-row">
              {tfList.map(tf => (
                <button
                  key={tf}
                  className={`mkts-tf-btn ${activeTimeframe === tf ? 'active' : ''}`}
                  onClick={() => setActiveTimeframe(tf)}
                >{tf}</button>
              ))}
            </div>
          </div>

          {/* ── IJGF Risk Bar (signature feature) ── */}
          <div className="mkts-risk-bar">
            {/* Profit Target */}
            <div className="mkts-risk-item">
              <div className="mkts-risk-meta">
                <span className="mkts-risk-label">
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor"><circle cx="4.5" cy="4.5" r="3.5"/></svg>
                  Profit Target
                </span>
                <span className="mkts-risk-val pos">
                  ${currentProfit} / ${(challengeSize * profitTarget / 100).toLocaleString()}
                </span>
              </div>
              <div className="mkts-risk-track">
                <div className="mkts-risk-fill" style={{ width: `${profitPct}%`, background: '#0ecb81' }} />
              </div>
            </div>
            <div className="mkts-risk-sep" />
            {/* Daily Loss */}
            <div className="mkts-risk-item">
              <div className="mkts-risk-meta">
                <span className="mkts-risk-label">
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor"><path d="M4.5 1L1 8h7L4.5 1z"/></svg>
                  Daily Loss Limit
                </span>
                <span className={`mkts-risk-val ${dailyLossPct > 80 ? 'neg' : dailyLossPct > 50 ? 'warn' : ''}`}>
                  ${currentDailyLoss} / ${(challengeSize * dailyDDLimit / 100).toLocaleString()}
                </span>
              </div>
              <div className="mkts-risk-track">
                <div className="mkts-risk-fill" style={{ width: `${dailyLossPct}%`, background: riskColor(dailyLossPct) }} />
              </div>
            </div>
            <div className="mkts-risk-sep" />
            {/* Max Drawdown */}
            <div className="mkts-risk-item">
              <div className="mkts-risk-meta">
                <span className="mkts-risk-label">
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor"><rect x="1" y="1" width="7" height="7" rx="1"/></svg>
                  Max Drawdown
                </span>
                <span className={`mkts-risk-val ${maxDDPct > 80 ? 'neg' : maxDDPct > 50 ? 'warn' : ''}`}>
                  ${currentMaxDD} / ${(challengeSize * maxDDLimit / 100).toLocaleString()}
                </span>
              </div>
              <div className="mkts-risk-track">
                <div className="mkts-risk-fill" style={{ width: `${maxDDPct}%`, background: riskColor(maxDDPct) }} />
              </div>
            </div>
          </div>

          {/* TradingView chart */}
          <div className="mkts-chart-area" id="mkts-tv-chart" ref={chartContainerRef} />
        </div>

        {/* ─── MIDDLE: Order Book ──────────────────── */}
        <div className="mkts-ob-col">
          <div className="mkts-ob-header">
            <span className="mkts-ob-title">Order Book</span>
            <button className="mkts-ob-view active">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <rect x="0" y="0" width="5" height="1.5" rx="0.5" opacity="0.4"/>
                <rect x="7" y="0" width="7" height="1.5" rx="0.5"/>
                <rect x="0" y="3" width="5" height="1.5" rx="0.5" opacity="0.4"/>
                <rect x="7" y="3" width="7" height="1.5" rx="0.5"/>
                <rect x="0" y="6" width="7" height="1.5" rx="0.5"/>
                <rect x="7" y="6" width="5" height="1.5" rx="0.5" opacity="0.4"/>
                <rect x="0" y="9" width="7" height="1.5" rx="0.5"/>
                <rect x="7" y="9" width="5" height="1.5" rx="0.5" opacity="0.4"/>
                <rect x="0" y="12" width="7" height="1.5" rx="0.5"/>
                <rect x="7" y="12" width="5" height="1.5" rx="0.5" opacity="0.4"/>
              </svg>
            </button>
          </div>

          <div className="mkts-ob-col-heads">
            <span>Price (USDT)</span>
            <span>Size</span>
            <span>Total</span>
          </div>

          {/* Asks (sell orders) */}
          <div className="mkts-ob-asks">
            {orderBook.sells?.map((row, i) => (
              <div key={i} className="mkts-ob-row ask">
                <div className="mkts-ob-depth ask" style={{ width: `${row.depth}%` }} />
                <span className="mkts-ob-px ask">{fmtPrice(row.price)}</span>
                <span className="mkts-ob-sz">{parseFloat(row.size).toLocaleString()}</span>
                <span className="mkts-ob-tot">{(parseFloat(row.size) * row.price / 1000).toFixed(1)}K</span>
              </div>
            ))}
          </div>

          {/* Mid price */}
          <div className="mkts-ob-mid">
            <span className={`mkts-ob-mid-px ${changePct >= 0 ? 'pos' : 'neg'}`}>
              {fmtPrice(marketPrice)}
              {changePct >= 0
                ? <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor"><path d="M4.5 1.5l3.5 6H1z"/></svg>
                : <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor"><path d="M4.5 7.5L1 1.5h7z"/></svg>
              }
            </span>
            <span className="mkts-ob-mid-usd">≈ ${fmtPrice(marketPrice)}</span>
          </div>

          {/* Bids (buy orders) */}
          <div className="mkts-ob-bids">
            {orderBook.buys?.map((row, i) => (
              <div key={i} className="mkts-ob-row bid">
                <div className="mkts-ob-depth bid" style={{ width: `${row.depth}%` }} />
                <span className="mkts-ob-px bid">{fmtPrice(row.price)}</span>
                <span className="mkts-ob-sz">{parseFloat(row.size).toLocaleString()}</span>
                <span className="mkts-ob-tot">{(parseFloat(row.size) * row.price / 1000).toFixed(1)}K</span>
              </div>
            ))}
          </div>

          {/* Recent trades */}
          <div className="mkts-trades-section">
            <div className="mkts-trades-hd">
              <button className="mkts-trades-tab active">Recent Trades</button>
            </div>
            <div className="mkts-trades-heads">
              <span>Price (USDT)</span>
              <span>Size</span>
              <span>Time</span>
            </div>
            <div className="mkts-trades-list">
              {recentTrades.map((t, i) => (
                <div key={i} className="mkts-trade-row">
                  <span className={t.isBuy ? 'pos' : 'neg'}>{fmtPrice(t.price)}</span>
                  <span>{t.size}</span>
                  <span className="mkts-trade-time">{t.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── RIGHT: Order Entry ──────────────────── */}
        <div className="mkts-entry-col">

          {/* Top controls */}
          <div className="mkts-entry-top">
            <button className="mkts-chip">Isolated</button>
            <button className="mkts-chip accent">{leverage}×</button>
            <div style={{ flex: 1 }} />
            <button className="mkts-chip">USDT</button>
          </div>

          {/* Buy / Sell tabs */}
          <div className="mkts-dir-tabs">
            <button
              className={`mkts-dir-btn ${tradeDirection === 'buy' ? 'active buy' : ''}`}
              onClick={() => setTradeDirection('buy')}
            >Buy / Long</button>
            <button
              className={`mkts-dir-btn ${tradeDirection === 'sell' ? 'active sell' : ''}`}
              onClick={() => setTradeDirection('sell')}
            >Sell / Short</button>
          </div>

          {/* Order type */}
          <div className="mkts-ot-tabs">
            {['Limit','Market','Stop Limit'].map(t => (
              <button
                key={t}
                className={`mkts-ot-btn ${orderType === t ? 'active' : ''}`}
                onClick={() => setOrderType(t)}
              >{t}</button>
            ))}
          </div>

          {/* Available balance */}
          <div className="mkts-avbl">
            <span className="mkts-avbl-label">Available</span>
            <span className="mkts-avbl-val">{accountBalance.toLocaleString()} <em>USDT</em></span>
          </div>

          {/* Price */}
          {orderType !== 'Market' && (
            <div className="mkts-field">
              <label>Price</label>
              <div className="mkts-input-box">
                <button className="mkts-stepper" onClick={() => setPrice(p => String(Math.max(0,(parseFloat(p)||0)-1)))}>−</button>
                <input type="number" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)} />
                <span className="mkts-unit">USDT</span>
                <button className="mkts-stepper" onClick={() => setPrice(p => String((parseFloat(p)||0)+1))}>+</button>
              </div>
            </div>
          )}

          {/* Size */}
          <div className="mkts-field">
            <label>Size</label>
            <div className="mkts-input-box">
              <button className="mkts-stepper" onClick={() => setSize(s => String(Math.max(0,(parseFloat(s)||0)-10)))}>−</button>
              <input type="number" placeholder="0.00" value={size} onChange={e => setSize(e.target.value)} />
              <span className="mkts-unit">USDT</span>
              <button className="mkts-stepper" onClick={() => setSize(s => String((parseFloat(s)||0)+10))}>+</button>
            </div>
          </div>

          {/* Quick % */}
          <div className="mkts-pct-row">
            {[25,50,75,100].map(p => (
              <button
                key={p}
                className="mkts-pct-btn"
                onClick={() => setSize(String(Math.floor(accountBalance * p / 100)))}
              >{p}%</button>
            ))}
          </div>

          {/* TP / SL */}
          <div className="mkts-tpsl-row">
            <label className="mkts-check">
              <input type="checkbox" checked={tpChecked} onChange={e => setTpChecked(e.target.checked)} />
              <span>Take Profit</span>
            </label>
            <label className="mkts-check">
              <input type="checkbox" checked={slChecked} onChange={e => setSlChecked(e.target.checked)} />
              <span>Stop Loss</span>
            </label>
          </div>

          {tpChecked && (
            <div className="mkts-field">
              <label>Take Profit Price</label>
              <div className="mkts-input-box">
                <input type="number" placeholder="0.00" value={tpPrice} onChange={e => setTpPrice(e.target.value)} />
                <span className="mkts-unit">USDT</span>
              </div>
            </div>
          )}

          {slChecked && (
            <div className="mkts-field">
              <label>Stop Loss Price</label>
              <div className="mkts-input-box">
                <input type="number" placeholder="0.00" value={slPrice} onChange={e => setSlPrice(e.target.value)} />
                <span className="mkts-unit">USDT</span>
              </div>
            </div>
          )}

          {/* Submit button */}
          <button className={`mkts-submit ${tradeDirection === 'buy' ? 'buy' : 'sell'}`}>
            {tradeDirection === 'buy' ? '▲  Buy / Long' : '▼  Sell / Short'}
          </button>

          {/* Summary */}
          <div className="mkts-summary">
            <div className="mkts-sum-row">
              <span>Margin Required</span>
              <span>{size ? `${(parseFloat(size)/leverage).toFixed(2)} USDT` : '—'}</span>
            </div>
            <div className="mkts-sum-row">
              <span>Taker Fee</span>
              <span>{size ? `${(parseFloat(size)*0.0004).toFixed(4)} USDT` : '—'}</span>
            </div>
            <div className="mkts-sum-row">
              <span>Est. Liquidation</span>
              <span className="neg">—</span>
            </div>
          </div>

          {/* Rule notice */}
          <div className="mkts-rule-notice">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3v5m0 2v1"/>
            </svg>
            TP &amp; SL required by IJGF challenge rules
          </div>
        </div>
      </div>

      {/* ════════════════ BOTTOM PANEL ════════════════ */}
      <div className="mkts-bottom">

        {/* Positions */}
        <div className="mkts-pos-panel">
          <div className="mkts-pos-tab-bar">
            {possTabs.map((tab, i) => (
              <button
                key={tab}
                className={`mkts-pos-tab ${activePositionsTab === String(i) ? 'active' : ''}`}
                onClick={() => setActivePositionsTab(String(i))}
              >{tab}</button>
            ))}
            <label className="mkts-pos-filter">
              <input type="checkbox" />
              <span>Current pair only</span>
            </label>
          </div>

          <div className="mkts-pos-table-head">
            <span>Symbol</span>
            <span>Size</span>
            <span>Entry Price</span>
            <span>Mark Price</span>
            <span>Liq. Price</span>
            <span>Margin</span>
            <span>PNL (ROI%)</span>
            <span>TP / SL</span>
            <span>Action</span>
          </div>

          <div className="mkts-pos-empty">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="8" width="26" height="18" rx="3"/>
              <path d="M11 8V6a5 5 0 0110 0v2"/>
              <circle cx="16" cy="17" r="2.5"/>
            </svg>
            <span>No open positions</span>
          </div>
        </div>

        {/* Account */}
        <div className="mkts-acct-panel">
          <div className="mkts-acct-head">
            <span>Challenge Account</span>
            <span className="mkts-acct-tier">$10K</span>
          </div>

          <div className="mkts-acct-rows">
            {[
              { label: 'Balance',         val: `${accountBalance.toLocaleString()} USDT`,  cls: '' },
              { label: 'Unrealized PNL',  val: `+${unrealizedPNL.toFixed(2)} USDT`,        cls: 'pos' },
              { label: 'Margin Balance',  val: `${marginBalance.toLocaleString()} USDT`,   cls: '' },
              { label: 'Margin Ratio',    val: '0.00%',                                     cls: 'pos' },
            ].map(r => (
              <div key={r.label} className="mkts-acct-row">
                <span>{r.label}</span>
                <span className={r.cls}>{r.val}</span>
              </div>
            ))}
          </div>

          <div className="mkts-acct-divider" />

          <p className="mkts-acct-sub-label">Challenge Objectives</p>
          <div className="mkts-acct-rows">
            {[
              { label: 'Profit Target', val: '$0 / $1,000', cls: 'pos' },
              { label: 'Daily Loss',    val: '$0 / $400',   cls: '' },
              { label: 'Max Drawdown',  val: '$0 / $600',   cls: '' },
            ].map(r => (
              <div key={r.label} className="mkts-acct-row">
                <span>{r.label}</span>
                <span className={r.cls}>{r.val}</span>
              </div>
            ))}
          </div>

          <div className="mkts-acct-btns">
            <button>Transfer</button>
            <button>History</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MarketsPage
