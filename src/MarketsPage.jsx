import { useState, useEffect, useRef, useMemo } from 'react'
import { useDemoTrading } from './useDemoTrading'
import { generateSimulatedOrderBook } from './useBinanceWebSocket'
import { MAX_LEVERAGE, reconcileDemoAccount, MIN_TRADING_DAYS, updatePositionTPSL } from './tradingService'
import './MarketsPage.css'

// Module-level constant — never changes, no need to be inside the component
// Comprehensive USDT perpetual pairs — ordered by market cap / volume
// Update this list periodically when major new tokens launch
const FALLBACK_PAIRS = [
  // Large caps
  'BTCUSDT',  'ETHUSDT',  'BNBUSDT',  'SOLUSDT',  'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT',  'AVAXUSDT', 'DOTUSDT',  'LINKUSDT',
  'MATICUSDT','LTCUSDT',  'ATOMUSDT', 'NEARUSDT', 'APTUSDT',
  'TONUSDT',  'TRXUSDT',  'BCHUSDT',  'XLMUSDT',  'ETCUSDT',
  // Mid caps
  'UNIUSDT',  'OPUSDT',   'ARBUSDT',  'INJUSDT',  'SUIUSDT',
  'SEIUSDT',  'TIAUSDT',  'WLDUSDT',  'PEPEUSDT', 'SHIBUSDT',
  'WIFUSDT',  'BONKUSDT', 'FLOKIUSDT','ORDIUSDT', 'RUNEUSDT',
  'LDOUSDT',  'ICPUSDT',  'HBARUSDT', 'FILUSDT',  'ALGOUSDT',
  'KASUSDT',  'JUPUSDT',  'FTMUSDT',  'EOSUSDT',  'VETUSDT',
  'EGLDUSDT', 'FLOWUSDT', 'XTZUSDT',  'ZILUSDT',  'KAVAUSDT',
  // DeFi
  'AAVEUSDT', 'CRVUSDT',  'MKRUSDT',  'COMPUSDT', 'GRTUSDT',
  'DYDXUSDT', 'PENDLEUSDT','GMXUSDT', 'STRKUSDT', 'SNXUSDT',
  'SUSHIUSDT','1INCHUSDT','BALUSDT',  'YFIUSDT',  'LRCUSDT',
  // AI / Infra
  'FETUSDT',  'RENDERUSDT','TAOUSDT', 'PYTHUSDT', 'AGIXUSDT',
  'OCEANUSDT','ARKMUSDT',  'ENAUSDT',
  // Gaming / Metaverse
  'AXSUSDT',  'SANDUSDT', 'MANAUSDT', 'GALAUSDT', 'IMXUSDT',
  'POPCATUSDT','APEUSDT', 'BLURUSDT', 'YGGUSDT',
  // Other
  'LDOUSDT',  'COTIUSDT', 'ANKRUSDT', 'STORJUSDT','BANDUSDT',
  'CELRUSDT', 'CKBUSDT',  'SCUSDT',   'ONTUSDT',  'WAVESUSDT',
  'ZENUSDT',  'CTSIUSDT', 'REEFUSDT', 'ALICEUSDT','SUPERUSDT',
  'CHZUSDT',  'ENJUSDT',  'CHRUSDT',  'CVCUSDT',  'DGBUSDT',
]

// CoinGecko IDs for snapshot price seeding (globally accessible, no geo-restrictions)
const SNAPSHOT_COINGECKO_IDS = [
  'bitcoin','ethereum','binancecoin','solana','ripple','dogecoin','cardano',
  'avalanche-2','polkadot','chainlink','matic-network','litecoin','cosmos',
  'near','aptos','the-open-network','tron','bitcoin-cash','stellar',
  'ethereum-classic','uniswap','optimism','arbitrum','injective-protocol',
  'sui','sei-network','celestia','worldcoin-wld','pepe','shiba-inu',
  'dogwifcoin','bonk','floki','ordinals','thorchain','lido-dao',
  'internet-computer','hedera-hashgraph','filecoin','algorand','kaspa',
  'jupiter-exchange-solana','fantom','eos','vechain','elrond-erd-2',
  'flow','tezos','zilliqa','kava','aave','curve-dao-token','maker',
  'compound-governance-token','the-graph','dydx','pendle','gmx',
  'starknet','havven','fetch-ai','render-token','bittensor','pyth-network',
  'artificial-superintelligence-alliance','ocean-protocol','axie-infinity',
  'the-sandbox','decentraland','gala','immutable-x','apecoin',
]

const SNAPSHOT_SYMBOL_MAP = {
  'bitcoin':'BTCUSDT','ethereum':'ETHUSDT','binancecoin':'BNBUSDT','solana':'SOLUSDT',
  'ripple':'XRPUSDT','dogecoin':'DOGEUSDT','cardano':'ADAUSDT','avalanche-2':'AVAXUSDT',
  'polkadot':'DOTUSDT','chainlink':'LINKUSDT','matic-network':'MATICUSDT','litecoin':'LTCUSDT',
  'cosmos':'ATOMUSDT','near':'NEARUSDT','aptos':'APTUSDT','the-open-network':'TONUSDT',
  'tron':'TRXUSDT','bitcoin-cash':'BCHUSDT','stellar':'XLMUSDT','ethereum-classic':'ETCUSDT',
  'uniswap':'UNIUSDT','optimism':'OPUSDT','arbitrum':'ARBUSDT','injective-protocol':'INJUSDT',
  'sui':'SUIUSDT','sei-network':'SEIUSDT','celestia':'TIAUSDT','worldcoin-wld':'WLDUSDT',
  'pepe':'PEPEUSDT','shiba-inu':'SHIBUSDT','dogwifcoin':'WIFUSDT','bonk':'BONKUSDT',
  'floki':'FLOKIUSDT','ordinals':'ORDIUSDT','thorchain':'RUNEUSDT','lido-dao':'LDOUSDT',
  'internet-computer':'ICPUSDT','hedera-hashgraph':'HBARUSDT','filecoin':'FILUSDT',
  'algorand':'ALGOUSDT','kaspa':'KASUSDT','jupiter-exchange-solana':'JUPUSDT',
  'fantom':'FTMUSDT','eos':'EOSUSDT','vechain':'VETUSDT','elrond-erd-2':'EGLDUSDT',
  'flow':'FLOWUSDT','tezos':'XTZUSDT','zilliqa':'ZILUSDT','kava':'KAVAUSDT',
  'aave':'AAVEUSDT','curve-dao-token':'CRVUSDT','maker':'MKRUSDT',
  'compound-governance-token':'COMPUSDT','the-graph':'GRTUSDT','dydx':'DYDXUSDT',
  'pendle':'PENDLEUSDT','gmx':'GMXUSDT','starknet':'STRKUSDT','havven':'SNXUSDT',
  'fetch-ai':'FETUSDT','render-token':'RENDERUSDT','bittensor':'TAOUSDT',
  'pyth-network':'PYTHUSDT','artificial-superintelligence-alliance':'AGIXUSDT',
  'ocean-protocol':'OCEANUSDT','axie-infinity':'AXSUSDT','the-sandbox':'SANDUSDT',
  'decentraland':'MANAUSDT','gala':'GALAUSDT','immutable-x':'IMXUSDT','apecoin':'APEUSDT',
}

function MarketsPage({ chartExpanded = false, setChartExpanded = () => {}, userId, onChallengeResult }) {
  const [selectedPair, setSelectedPair] = useState('BTCUSDT')
  const [showPairDropdown, setShowPairDropdown] = useState(false)
  const [pairSearch, setPairSearch] = useState('')
  const [orderType, setOrderType] = useState('Limit')
  const [price, setPrice] = useState('')
  const [stopPrice, setStopPrice] = useState('')
  const [size, setSize] = useState('')
  const [leverage, setLeverage] = useState(10)
  const [showLeverageModal, setShowLeverageModal] = useState(false)
  const [leverageInput, setLeverageInput] = useState('10')
  const [tpPrice, setTpPrice] = useState('')
  const [slPrice, setSlPrice] = useState('')
  const [tpEnabled, setTpEnabled] = useState(false)
  const [slEnabled, setSlEnabled] = useState(false)
  const [activePositionsTab, setActivePositionsTab] = useState('positions')
  const [mobileChartView, setMobileChartView] = useState(false)
  const [orderSubmitting, setOrderSubmitting] = useState(false)
  const [availablePairs] = useState(FALLBACK_PAIRS)
  const [pairsLoading] = useState(false)
  const [snapshotPrices, setSnapshotPrices] = useState({}) // { BTCUSDT: { price, change } }
  // Reconcile balance state
  const [reconcileState, setReconcileState] = useState('idle') // 'idle' | 'confirm' | 'running' | 'done' | 'error'
  const [reconcileResult, setReconcileResult] = useState(null)
  const chartContainerRef = useRef(null)
  const tvWidgetRef = useRef(null)
  const mobileChartRef = useRef(null)
  const mobileTvWidgetRef = useRef(null)

  // ---- Trading hook ----
  const trading = useDemoTrading(userId, selectedPair)

  const {
    account, positions, openOrders, recentTrades,
    currentPrice, currentPriceData, hasPrices, priceMode,
    bids: liveBids, asks: liveAsks, obMode,
    equity, equityProfit, totalUnrealizedPNL,
    drawdownUsed, drawdownPercent,
    challengeResult,
    tradingDays,
    notifications, dismissNotification,
    submitMarketOrder, submitLimitOrder, submitCancelOrder, submitClosePosition,
  } = trading

  const minTradingDays = MIN_TRADING_DAYS

  // Inline TP/SL editing state: { [posId]: { tp: string, sl: string, saving: bool } }
  const [tpSlEdit, setTpSlEdit] = useState({})
  const initTpSl = (pos) => {
    if (tpSlEdit[pos.id]) return
    setTpSlEdit(prev => ({ ...prev, [pos.id]: { tp: pos.take_profit ?? '', sl: pos.stop_loss ?? '', saving: false } }))
  }
  const saveTpSl = async (pos) => {
    setTpSlEdit(prev => ({ ...prev, [pos.id]: { ...prev[pos.id], saving: true } }))
    await updatePositionTPSL(pos.id, userId, { takeProfit: tpSlEdit[pos.id].tp, stopLoss: tpSlEdit[pos.id].sl })
    await trading.refreshState()
    setTpSlEdit(prev => { const n = { ...prev }; delete n[pos.id]; return n })
  }

  // Use simulated order book when WS order book isn't connected
  const simOb = useMemo(
    () => generateSimulatedOrderBook(currentPrice, 8),
    [currentPrice]
  )
  const bids = obMode === 'ws' ? liveBids : simOb.bids
  const asks = obMode === 'ws' ? liveAsks : simOb.asks

  // Seed dropdown snapshot prices via CoinGecko — no geo-restrictions, globally accessible
  useEffect(() => {
    const seedSnapshotPrices = async () => {
      try {
        const CHUNK_SIZE = 50
        const chunks = []
        for (let i = 0; i < SNAPSHOT_COINGECKO_IDS.length; i += CHUNK_SIZE) {
          chunks.push(SNAPSHOT_COINGECKO_IDS.slice(i, i + CHUNK_SIZE))
        }
        const results = await Promise.all(chunks.map(chunk => {
          const ids = chunk.join(',')
          return fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`)
            .then(r => r.ok ? r.json() : {})
            .catch(() => ({}))
        }))
        const data = Object.assign({}, ...results)
        const snap = {}
        for (const [geckoId, symbol] of Object.entries(SNAPSHOT_SYMBOL_MAP)) {
          const d = data[geckoId]
          if (d) snap[symbol] = { price: d.usd || 0, change: d.usd_24h_change || 0 }
        }
        setSnapshotPrices(snap)
      } catch { /* silent — WebSocket will provide live prices once connected */ }
    }
    seedSnapshotPrices()
  }, [])

  const filteredPairs = pairSearch.trim()
    ? availablePairs.filter(p => p.toLowerCase().includes(pairSearch.toLowerCase()))
    : availablePairs

  const getTVSymbol = (pair) => `BINANCE:${pair}.P`

  // Max leverage for selected pair
  const maxLeverage = MAX_LEVERAGE[selectedPair] ?? MAX_LEVERAGE.DEFAULT

  // Reset inputs when pair changes
  useEffect(() => {
    setPrice('')
    setStopPrice('')
    setSize('')
    setTpPrice('')
    setSlPrice('')
    // Cap leverage to max for new pair
    setLeverage(prev => Math.min(prev, MAX_LEVERAGE[selectedPair] ?? MAX_LEVERAGE.DEFAULT))
  }, [selectedPair])

  // ---- TradingView chart (desktop) ----
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
      try { if (tvWidgetRef.current?.remove) tvWidgetRef.current.remove() } catch { /* */ }
      tvWidgetRef.current = null
    }
  }, [selectedPair])

  // ---- TradingView chart (mobile) ----
  useEffect(() => {
    if (!mobileChartView || !mobileChartRef.current) return
    mobileChartRef.current.innerHTML = ''

    const mobileConfig = {
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
      hide_side_toolbar: true,
      allow_symbol_change: false,
      container_id: 'tv_chart_container_mobile',
      backgroundColor: '#0d0d0d',
      gridColor: 'rgba(255,255,255,0.04)',
      hide_volume: false,
      disabled_features: [
        'header_symbol_search', 'header_compare', 'header_screenshot',
        'header_undo_redo', 'use_localstorage_for_settings', 'border_around_the_chart',
      ],
    }

    if (typeof window.TradingView !== 'undefined') {
      mobileTvWidgetRef.current = new window.TradingView.widget(mobileConfig)
    }

    return () => {
      try { mobileTvWidgetRef.current?.remove?.() } catch { /* */ }
      mobileTvWidgetRef.current = null
    }
  }, [mobileChartView, selectedPair])

  // ---- Price formatting ----
  const fmt = (num) => {
    if (!num || num === 0) return '0.00'
    if (num < 0.01) return num.toFixed(6)
    if (num < 1) return num.toFixed(4)
    if (num < 100) return num.toFixed(2)
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const getBaseAsset = () => selectedPair.replace('USDT', '')

  const priceStep = selectedPair === 'BTCUSDT' ? 10 : selectedPair === 'ETHUSDT' ? 1 : 0.01

  const adjustPrice = (dir) => {
    const base = price === '' ? currentPrice : parseFloat(price.replace(/,/g, '')) || currentPrice
    const next = dir === 'up' ? base + priceStep : Math.max(0, base - priceStep)
    setPrice(fmt(next))
  }

  const adjustSize = (dir) => {
    const base = size === '' ? 0 : Number(size)
    const next = dir === 'up' ? base + 10 : Math.max(0, base - 10)
    setSize(String(next))
  }

  const handleSizePercent = (pct) => {
    if (!account) return
    const availableBalance = account.current_balance
    const amount = availableBalance * pct / 100
    setSize(amount.toFixed(2))
  }

  // Format order book quantity/total: 49845 → 49.8K, 1234567 → 1.23M, 2100000000 → 2.1B
  const fmtQty = (num) => {
    if (!num || isNaN(num)) return '—'
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toPrecision(3).replace(/\.?0+$/, '') + 'B'
    if (num >= 1_000_000)     return (num / 1_000_000).toPrecision(3).replace(/\.?0+$/, '') + 'M'
    if (num >= 1_000)         return (num / 1_000).toPrecision(3).replace(/\.?0+$/, '') + 'K'
    return num.toPrecision(3).replace(/\.?0+$/, '')
  }


  // ---- TP/SL Expected PNL Calculations (Binance/Bybit style) ----
  const getEntryPrice = () => {
    if (orderType === 'Market') return currentPrice
    const p = parseFloat(price.replace(/,/g, ''))
    return p > 0 ? p : currentPrice
  }

  const sizeVal = parseFloat(size) || 0
  const entryPriceVal = getEntryPrice()
  const qtyEstimate = entryPriceVal > 0 ? (sizeVal * leverage) / entryPriceVal : 0

  // Expected TP profit
  const tpPriceVal = parseFloat(tpPrice) || 0
  const tpPnl = useMemo(() => {
    if (!tpPriceVal || !entryPriceVal || !qtyEstimate) return null
    // For Buy/Long: (tp - entry) * qty
    // For Sell/Short: (entry - tp) * qty
    // We show both since user hasn't clicked Buy or Sell yet
    const longPnl = (tpPriceVal - entryPriceVal) * qtyEstimate
    const shortPnl = (entryPriceVal - tpPriceVal) * qtyEstimate
    return { longPnl, shortPnl }
  }, [tpPriceVal, entryPriceVal, qtyEstimate])

  // Expected SL loss
  const slPriceVal = parseFloat(slPrice) || 0
  const slPnl = useMemo(() => {
    if (!slPriceVal || !entryPriceVal || !qtyEstimate) return null
    const longPnl = (slPriceVal - entryPriceVal) * qtyEstimate
    const shortPnl = (entryPriceVal - slPriceVal) * qtyEstimate
    return { longPnl, shortPnl }
  }, [slPriceVal, entryPriceVal, qtyEstimate])

  // Estimated liquidation price
  const estLiqLong = entryPriceVal > 0 ? entryPriceVal * (1 - 1 / leverage * 0.95) : 0
  const estLiqShort = entryPriceVal > 0 ? entryPriceVal * (1 + 1 / leverage * 0.95) : 0

  // ---- Leverage modal ----
  const openLeverageModal = () => {
    setLeverageInput(String(leverage))
    setShowLeverageModal(true)
  }

  const confirmLeverage = () => {
    const val = parseInt(leverageInput)
    if (val >= 1 && val <= maxLeverage) {
      setLeverage(val)
    }
    setShowLeverageModal(false)
  }

  const leveragePresets = [1, 2, 3, 5, 10].filter(v => v <= maxLeverage)

  // ---- Submit order ----
  const handleOrder = async (side) => {
    if (orderSubmitting) return
    if (!sizeVal || sizeVal <= 0) return

    setOrderSubmitting(true)
    try {
      if (orderType === 'Market') {
        await submitMarketOrder({
          symbol: selectedPair,
          side,
          sizeUsdt: sizeVal * leverage,
          leverage,
          takeProfit: tpEnabled ? tpPrice : null,
          stopLoss: slEnabled ? slPrice : null,
        })
      } else {
        const orderPrice = parseFloat(price.replace(/,/g, ''))
        if (!orderPrice) { setOrderSubmitting(false); return }

        await submitLimitOrder({
          symbol: selectedPair,
          side,
          orderType: orderType === 'Stop Limit' ? 'STOP_LIMIT' : 'LIMIT',
          price: orderPrice,
          stopPrice: orderType === 'Stop Limit' ? parseFloat(stopPrice) : null,
          sizeUsdt: sizeVal * leverage,
          leverage,
          takeProfit: tpEnabled ? tpPrice : null,
          stopLoss: slEnabled ? slPrice : null,
        })
      }
      setSize('')
    } catch {
      // Error shown via notification
    } finally {
      setOrderSubmitting(false)
    }
  }

  const handleObClick = (obPrice) => setPrice(fmt(obPrice))

  const priceChangePercent = currentPriceData.change || 0
  const high24h = currentPriceData.high || 0

  // Format PNL with color
  const fmtPnl = (val) => {
    if (val === null || val === undefined || isNaN(val)) return null
    const sign = val >= 0 ? '+' : ''
    return { text: `${sign}$${val.toFixed(2)}`, cls: val >= 0 ? 'positive' : 'negative' }
  }

  // ---- Fire parent callback when challenge status changes ----
  useEffect(() => {
    if ((challengeResult === 'passed' || challengeResult === 'failed') && onChallengeResult) {
      onChallengeResult(
        challengeResult,
        trading.account,
        trading.tradingDays,
        trading.submitStartNewChallenge
      )
      // Reset local state so it doesn't re-fire
      trading.dismissChallengeResult()
    }
  }, [challengeResult]) // eslint-disable-line

  // ---- Reconcile balance handler ----
  const handleReconcile = async () => {
    if (reconcileState === 'idle' || reconcileState === 'done' || reconcileState === 'error') {
      setReconcileState('confirm')
      setReconcileResult(null)
      return
    }
    if (reconcileState === 'confirm') {
      setReconcileState('running')
      try {
        const result = await reconcileDemoAccount(userId)
        setReconcileResult(result)
        setReconcileState('done')
        // Refresh all account state so UI reflects the corrected balance immediately
        await trading.refreshState()
      } catch (err) {
        console.error('[Reconcile] Failed:', err)
        setReconcileResult({ error: err.message })
        setReconcileState('error')
      }
    }
  }

  return (
    <div className="binance-markets-page">
      {/* Notifications */}
      <div className="trade-notifications">
        {notifications.map(n => (
          <div key={n.id} className={`trade-notification ${n.type}`}>
            <span>{n.message}</span>
            <button onClick={() => dismissNotification(n.id)}>×</button>
          </div>
        ))}
      </div>

      {/* Connection status — only show if no prices at all */}
      {!hasPrices && priceMode === 'connecting' && (
        <div className="ws-status disconnected">
          <span className="ws-dot"></span> Connecting to price feed...
        </div>
      )}

      {/* Mobile pair info bar */}
      <div className="mobile-pair-info-bar">
        <div className="mobile-pair-top">
          <div className="mobile-pair-name" onClick={() => setShowPairDropdown(prev => !prev)} style={{ cursor: 'pointer' }}>
            <span className="pair-symbol">{selectedPair}</span>
            <span className="pair-type">Perp</span>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" style={{ marginLeft: 4, opacity: 0.5 }}>
              <path d="M2 4l4 4 4-4"/>
            </svg>
          </div>
          <span className={`mobile-pair-change ${priceChangePercent >= 0 ? 'positive' : 'negative'}`}>
            {priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
          </span>
          <button className="mobile-chart-btn" onClick={() => setMobileChartView(true)} title="Chart">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="8" y1="6" x2="8" y2="18"/>
              <line x1="16" y1="4" x2="16" y2="20"/>
              <rect x="6" y="9" width="4" height="5" fill="currentColor" stroke="none" rx="0.5"/>
              <rect x="14" y="8" width="4" height="7" fill="currentColor" stroke="none" rx="0.5"/>
            </svg>
          </button>
        </div>
        <div className="mobile-funding-row">
          <span className="funding-label">Funding (8h) / Countdown</span>
          <span className="funding-value">0.0100% / —</span>
        </div>
      </div>

      <div className={`binance-trading-grid ${chartExpanded ? 'chart-is-expanded' : ''}`}>

        {/* LEFT: Chart */}
        <div className={`binance-chart-section ${chartExpanded ? 'chart-expanded' : ''}`}>
          <div className="binance-pair-header">
            <div className="pair-info">
              <div className="pair-name-row" onClick={() => setShowPairDropdown(prev => !prev)} style={{ cursor: 'pointer' }}>
                <span className="pair-symbol">{selectedPair}</span>
                <span className="pair-type">Perp</span>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" style={{ marginLeft: 4, opacity: 0.5 }}>
                  <path d="M2 4l4 4 4-4"/>
                </svg>
              </div>
              <div className="pair-price-data">
                <span className={`main-price ${priceChangePercent >= 0 ? 'positive' : 'negative'}`}>
                  {currentPrice ? fmt(currentPrice) : '—'}
                </span>
                <span className={`price-change-amount ${priceChangePercent >= 0 ? 'positive' : 'negative'}`}>
                  {priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="pair-24h-stats">
              <div className="stat-col">
                <span className="stat-label">Mark</span>
                <span className="stat-value">{fmt(currentPrice)}</span>
              </div>
              <div className="stat-col">
                <span className="stat-label">24h High</span>
                <span className="stat-value positive">{fmt(high24h)}</span>
              </div>
              <div className="stat-col">
                <span className="stat-label">24h Vol</span>
                <span className="stat-value">{currentPriceData.volume ? `${(currentPriceData.volume / 1000).toFixed(1)}K` : '—'}</span>
              </div>
            </div>

            {!chartExpanded && (
              <button className="chart-expand-btn-header" onClick={() => setChartExpanded(true)} title="Expand Chart">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                </svg>
              </button>
            )}
          </div>

          <div className="binance-chart-area">
            <div id="tv_chart_container" ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
          </div>
        </div>

        {/* MIDDLE: Order Book */}
        <div className="binance-orderbook-column">
          <div className="orderbook-header">
            <span>Order Book</span>
            <span className={`ob-status ${obMode === 'ws' ? 'live' : 'simulated'}`}>
              <span className="live-dot"></span>
              {obMode === 'ws' ? 'Live' : obMode === 'simulated' ? 'Simulated' : '...'}
            </span>
          </div>

          <div className="orderbook-table-headers">
            <span>Price (USDT)</span>
            <span className="text-right">Size</span>
            <span className="text-right">Total</span>
          </div>

          {/* Sell orders (asks) */}
          <div className="ob-sells">
            {asks.slice(0, 8).reverse().map((row, i) => (
              <div key={`sell-${i}`} className="ob-row sell" onClick={() => handleObClick(row.price)}>
                <span className="ob-price negative">{fmt(row.price)}</span>
                <span className="ob-size">{fmtQty(row.qty)}</span>
                <span className="ob-sum">{fmtQty(row.total)}</span>
              </div>
            ))}
          </div>

          {/* Mid Price */}
          <div className="ob-current-price">
            <span className={`price-big ${priceChangePercent >= 0 ? 'positive' : 'negative'}`}>
              {fmt(currentPrice)}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                {priceChangePercent >= 0
                  ? <path d="M7 14l5-5 5 5z"/>
                  : <path d="M7 10l5 5 5-5z"/>
                }
              </svg>
            </span>
            <span className="price-usd">${fmt(currentPrice)}</span>
          </div>

          {/* Buy orders (bids) */}
          <div className="ob-buys">
            {bids.slice(0, 8).map((row, i) => (
              <div key={`buy-${i}`} className="ob-row buy" onClick={() => handleObClick(row.price)}>
                <span className="ob-price positive">{fmt(row.price)}</span>
                <span className="ob-size">{fmtQty(row.qty)}</span>
                <span className="ob-sum">{fmtQty(row.total)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Order Entry */}
        <div className="binance-order-entry">
          {/* Error display for debugging */}
          {trading.error && (
            <div style={{
              padding: '8px 12px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              color: '#ef4444',
              fontSize: '11px',
              marginBottom: '8px',
              wordBreak: 'break-word'
            }}>
              ⚠️ {trading.error}
            </div>
          )}

          {/* Row 1: Isolated + Leverage */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px' }}>
            <button className="isolated-btn">Isolated</button>
            <button className="leverage-display" onClick={openLeverageModal}>{leverage}x</button>
          </div>

          {/* Row 2: Order Type Tabs — Limit / Market / Stop Limit */}
          <div style={{
            display: 'flex',
            border: '1px solid #2b3139',
            borderRadius: '6px',
            overflow: 'hidden',
            marginBottom: '8px',
            minHeight: '32px',
            flexShrink: 0,
          }}>
            <button
              onClick={() => setOrderType('Limit')}
              style={{
                flex: 1, padding: '7px 4px', cursor: 'pointer', whiteSpace: 'nowrap',
                fontSize: '12px', fontWeight: orderType === 'Limit' ? '600' : '400',
                background: orderType === 'Limit' ? 'rgba(124,58,237,0.15)' : 'transparent',
                color: orderType === 'Limit' ? '#a78bfa' : '#848e9c',
                border: 'none', borderRight: '1px solid #2b3139', textAlign: 'center',
              }}
            >Limit</button>
            <button
              onClick={() => setOrderType('Market')}
              style={{
                flex: 1, padding: '7px 4px', cursor: 'pointer', whiteSpace: 'nowrap',
                fontSize: '12px', fontWeight: orderType === 'Market' ? '600' : '400',
                background: orderType === 'Market' ? 'rgba(124,58,237,0.15)' : 'transparent',
                color: orderType === 'Market' ? '#a78bfa' : '#848e9c',
                border: 'none', borderRight: '1px solid #2b3139', textAlign: 'center',
              }}
            >Market</button>
            <button
              onClick={() => setOrderType('Stop Limit')}
              style={{
                flex: 1, padding: '7px 4px', cursor: 'pointer', whiteSpace: 'nowrap',
                fontSize: '12px', fontWeight: orderType === 'Stop Limit' ? '600' : '400',
                background: orderType === 'Stop Limit' ? 'rgba(124,58,237,0.15)' : 'transparent',
                color: orderType === 'Stop Limit' ? '#a78bfa' : '#848e9c',
                border: 'none', textAlign: 'center',
              }}
            >Stop Limit</button>
          </div>

          <div className="avbl-row">
            <span>Avbl</span>
            <span className="avbl-value">{account ? account.current_balance.toLocaleString() : '—'} USDT</span>
          </div>

          {/* Stop price (for Stop Limit) */}
          {orderType === 'Stop Limit' && (
            <div className="entry-input-group">
              <label>Stop Price</label>
              <div className="input-row">
                <div className="input-with-unit">
                  <input type="text" placeholder="Stop price" value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} />
                  <span className="input-unit-inside">USDT</span>
                </div>
              </div>
            </div>
          )}

          {/* Limit price */}
          {orderType !== 'Market' && (
            <div className="entry-input-group">
              <label>Price</label>
              <div className="input-row">
                <button className="input-adj-btn" onClick={() => adjustPrice('down')}>−</button>
                <div className="input-with-unit">
                  <input type="text" placeholder={fmt(currentPrice)} value={price} onChange={(e) => setPrice(e.target.value)} />
                  <span className="input-unit-inside">{getBaseAsset()}</span>
                </div>
                <button className="input-adj-btn" onClick={() => adjustPrice('up')}>+</button>
              </div>
            </div>
          )}

          <div className="entry-input-group">
            <label>Amount</label>
            <div className="input-row">
              <button className="input-adj-btn" onClick={() => adjustSize('down')}>−</button>
              <div className="input-with-unit">
                <input type="text" placeholder="0.00" value={size} onChange={(e) => setSize(e.target.value)} />
                <span className="input-unit-inside">USDT</span>
              </div>
              <button className="input-adj-btn" onClick={() => adjustSize('up')}>+</button>
            </div>
            <div className="size-pct-btns">
              {[25, 50, 75, 100].map(pct => (
                <button key={pct} className="pct-btn" onClick={() => handleSizePercent(pct)}>
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* TP/SL with expected PNL */}
          <div className="tp-sl-row">
            <label className="checkbox-row">
              <input type="checkbox" checked={tpEnabled} onChange={e => setTpEnabled(e.target.checked)} />
              <span>Take Profit</span>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={slEnabled} onChange={e => setSlEnabled(e.target.checked)} />
              <span>Stop Loss</span>
            </label>
          </div>

          {tpEnabled && (
            <div className="entry-input-group compact">
              <div className="input-with-unit">
                <input type="text" placeholder="TP price" value={tpPrice} onChange={e => setTpPrice(e.target.value)} />
                <span className="input-unit-inside">USDT</span>
              </div>
              {/* Expected TP profit display */}
              {tpPnl && sizeVal > 0 && (
                <div className="tp-sl-pnl-row">
                  <span className="tp-sl-pnl-label">Expected Profit:</span>
                  <span className="tp-sl-pnl-values">
                    <span className="tp-sl-pnl-tag long">
                      Long {fmtPnl(tpPnl.longPnl)?.text}
                    </span>
                    <span className="tp-sl-pnl-tag short">
                      Short {fmtPnl(tpPnl.shortPnl)?.text}
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}

          {slEnabled && (
            <div className="entry-input-group compact">
              <div className="input-with-unit">
                <input type="text" placeholder="SL price" value={slPrice} onChange={e => setSlPrice(e.target.value)} />
                <span className="input-unit-inside">USDT</span>
              </div>
              {/* Expected SL loss display */}
              {slPnl && sizeVal > 0 && (
                <div className="tp-sl-pnl-row">
                  <span className="tp-sl-pnl-label">Expected Loss:</span>
                  <span className="tp-sl-pnl-values">
                    <span className="tp-sl-pnl-tag long">
                      Long {fmtPnl(slPnl.longPnl)?.text}
                    </span>
                    <span className="tp-sl-pnl-tag short">
                      Short {fmtPnl(slPnl.shortPnl)?.text}
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}

          <p className="tp-sl-notice">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="#f59e0b">
              <path d="M8 1L1 14h14L8 1zm0 3l5.5 9H2.5L8 4zm-1 3v3h2V7H7zm0 4v2h2v-2H7z"/>
            </svg>
            TP &amp; SL required by IJGF rules
          </p>

          {/* Buy/Long + Sell/Short */}
          <div className="order-buttons-row">
            <button
              className="order-submit-btn buy-long-btn"
              onClick={() => handleOrder('BUY')}
              disabled={orderSubmitting || !account || account.status !== 'active'}
            >
              {orderSubmitting ? '...' : 'Buy/Long'}
            </button>
            <button
              className="order-submit-btn sell-short-btn"
              onClick={() => handleOrder('SELL')}
              disabled={orderSubmitting || !account || account.status !== 'active'}
            >
              {orderSubmitting ? '...' : 'Sell/Short'}
            </button>
          </div>

          {/* Risk metrics — uses EQUITY not just balance */}
          <div className="risk-metrics-panel">
            <div className="risk-metric-row">
              <span className="rm-label">
                <svg width="10" height="10" viewBox="0 0 16 16" fill="#22c55e"><circle cx="8" cy="8" r="6"/></svg>
                Profit Target
              </span>
              <span className={`rm-value ${equityProfit >= 0 ? 'positive' : ''}`}>
                ${equityProfit.toFixed(0)} / ${account?.profit_target?.toFixed(0) || '1,000'}
              </span>
            </div>
            <div className="risk-metric-row">
              <span className="rm-label">
                <svg width="10" height="10" viewBox="0 0 16 16" fill="#ef4444"><circle cx="8" cy="8" r="6"/></svg>
                Max Drawdown
              </span>
              <span className="rm-value">
                ${drawdownUsed.toFixed(0)} / ${account?.max_total_drawdown?.toFixed(0) || '800'}
              </span>
            </div>
            <div className="risk-metric-row">
              <span className="rm-label">
                <svg width="10" height="10" viewBox="0 0 16 16" fill="#a78bfa"><circle cx="8" cy="8" r="6"/></svg>
                Trading Days
              </span>
              <span className={`rm-value ${tradingDays >= minTradingDays ? 'positive' : ''}`}>
                {tradingDays} / {minTradingDays} days
              </span>
            </div>
            {drawdownPercent > 50 && (
              <div className="drawdown-warning">
                ⚠️ {Math.min(drawdownPercent, 999).toFixed(0)}% of max drawdown used
              </div>
            )}
            {equityProfit >= (account?.profit_target || 1000) && tradingDays < minTradingDays && (
              <div className="drawdown-warning" style={{borderColor:'rgba(167,139,250,0.4)',color:'#a78bfa'}}>
                🏁 Target hit! Trade {minTradingDays - tradingDays} more day{minTradingDays - tradingDays !== 1 ? 's' : ''} to pass
              </div>
            )}
          </div>

          <div className="order-summary">
            <div className="summary-row">
              <span>Margin Required</span>
              <span>{sizeVal ? `$${sizeVal.toFixed(2)}` : '—'}</span>
            </div>

            <div className="summary-row">
              <span>Est. Liq. (Long)</span>
              <span>{sizeVal && entryPriceVal ? `$${fmt(estLiqLong)}` : '—'}</span>
            </div>
            <div className="summary-row">
              <span>Est. Liq. (Short)</span>
              <span>{sizeVal && entryPriceVal ? `$${fmt(estLiqShort)}` : '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Positions & Account */}
      <div className="binance-bottom-section">
        <div className="positions-panel">
          <div className="positions-tabs">
            {[
              { key: 'positions', label: `Positions(${positions.length})` },
              { key: 'orders', label: `Open Orders(${openOrders.length})` },
              { key: 'orderHistory', label: 'Order History' },
              { key: 'tradeHistory', label: 'Trade History' },
            ].map(tab => (
              <button
                key={tab.key}
                className={`pos-tab ${activePositionsTab === tab.key ? 'active' : ''}`}
                onClick={() => setActivePositionsTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Positions tab */}
          {activePositionsTab === 'positions' && (
            <div className="bp-table-scroll">
              <table className="bp-table">
                <colgroup>
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '80px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '80px' }} />
                  <col style={{ width: '140px' }} />
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '70px' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Size</th>
                    <th>Entry Price</th>
                    <th>Mark Price</th>
                    <th>Liq. Price</th>
                    <th>Margin</th>
                    <th>TP / SL</th>
                    <th>PNL (ROI%)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="bp-empty-cell">
                        <div className="empty-positions">
                          <svg width="36" height="36" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.2">
                            <rect x="10" y="10" width="18" height="18" rx="2"/><rect x="36" y="10" width="18" height="18" rx="2"/>
                            <rect x="36" y="36" width="18" height="18" rx="2"/><rect x="10" y="36" width="18" height="18" rx="2"/>
                          </svg>
                          <p>No open positions</p>
                        </div>
                      </td>
                    </tr>
                  ) : positions.map(pos => {
                    const edit = tpSlEdit[pos.id]
                    const isDirty = edit && (String(edit.tp) !== String(pos.take_profit ?? '') || String(edit.sl) !== String(pos.stop_loss ?? ''))
                    return (
                      <tr key={pos.id}>
                        <td className={pos.side === 'LONG' ? 'positive' : 'negative'}>
                          {pos.symbol}<br /><small>{pos.side} {pos.leverage}x</small>
                        </td>
                        <td>{pos.quantity.toFixed(4)}</td>
                        <td>{fmt(pos.entry_price)}</td>
                        <td>{fmt(trading.priceMap[pos.symbol] || pos.entry_price)}</td>
                        <td>{fmt(pos.liquidation_price)}</td>
                        <td>${pos.margin.toFixed(2)}</td>
                        <td className="tpsl-cell" onClick={() => initTpSl(pos)}>
                          {edit ? (
                            <div className="tpsl-inputs">
                              <input
                                className="tpsl-input tp"
                                type="number"
                                placeholder="TP"
                                value={edit.tp}
                                onChange={e => setTpSlEdit(prev => ({ ...prev, [pos.id]: { ...prev[pos.id], tp: e.target.value } }))}
                              />
                              <input
                                className="tpsl-input sl"
                                type="number"
                                placeholder="SL"
                                value={edit.sl}
                                onChange={e => setTpSlEdit(prev => ({ ...prev, [pos.id]: { ...prev[pos.id], sl: e.target.value } }))}
                              />
                              {isDirty && (
                                <button className="tpsl-save-btn" onClick={() => saveTpSl(pos)} disabled={edit.saving}>
                                  {edit.saving ? '…' : 'Save'}
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="tpsl-display">
                              <span className="tpsl-tp">{pos.take_profit ? fmt(pos.take_profit) : <span className="tpsl-none">—</span>}</span>
                              <span className="tpsl-sep"> / </span>
                              <span className="tpsl-sl">{pos.stop_loss ? fmt(pos.stop_loss) : <span className="tpsl-none">—</span>}</span>
                              <span className="tpsl-edit-hint">✎</span>
                            </div>
                          )}
                        </td>
                        <td className={pos.unrealized_pnl >= 0 ? 'positive' : 'negative'}>
                          {pos.unrealized_pnl >= 0 ? '+' : ''}${pos.unrealized_pnl.toFixed(2)}
                          <br /><small>({pos.roi?.toFixed(1)}%)</small>
                        </td>
                        <td>
                          <button className="close-pos-btn" onClick={() => submitClosePosition(pos.id)}>Close</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Open Orders tab */}
          {activePositionsTab === 'orders' && (
            <div className="bp-table-scroll">
              <table className="bp-table">
                <colgroup>
                  <col style={{ width: '90px' }} />
                  <col style={{ width: '80px' }} />
                  <col style={{ width: '55px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '80px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '65px' }} />
                  <col style={{ width: '65px' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Type</th>
                    <th>Side</th>
                    <th>Price</th>
                    <th>Qty</th>
                    <th>TP / SL</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {openOrders.length === 0 ? (
                    <tr><td colSpan={8} className="bp-empty-cell"><div className="empty-positions"><p>No open orders</p></div></td></tr>
                  ) : openOrders.map(order => (
                    <tr key={order.id}>
                      <td>{order.symbol}</td>
                      <td>{order.order_type}</td>
                      <td className={order.side === 'BUY' ? 'positive' : 'negative'}>{order.side}</td>
                      <td>{fmt(order.price)}</td>
                      <td>{order.quantity.toFixed(4)}</td>
                      <td>
                        <div className="tpsl-display">
                          <span className="tpsl-tp">{order.take_profit ? fmt(order.take_profit) : <span className="tpsl-none">—</span>}</span>
                          <span className="tpsl-sep"> / </span>
                          <span className="tpsl-sl">{order.stop_loss ? fmt(order.stop_loss) : <span className="tpsl-none">—</span>}</span>
                        </div>
                      </td>
                      <td>{order.status}</td>
                      <td>
                        <button className="close-pos-btn" onClick={() => submitCancelOrder(order.id)}>Cancel</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Trade History / Order History tab */}
          {(activePositionsTab === 'tradeHistory' || activePositionsTab === 'orderHistory') && (
            <div className="bp-table-scroll">
              <table className="bp-table">
                <colgroup>
                  <col style={{ width: '82px' }} />  {/* Date */}
                  <col style={{ width: '72px' }} />  {/* Time */}
                  <col style={{ width: '82px' }} />  {/* Symbol */}
                  <col style={{ width: '52px' }} />  {/* Side */}
                  <col style={{ width: '96px' }} />  {/* Price */}
                  <col style={{ width: '72px' }} />  {/* Qty */}
                  <col style={{ width: '88px' }} />  {/* PNL */}
                </colgroup>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Symbol</th>
                    <th>Side</th>
                    <th>Price</th>
                    <th>Qty</th>
                    <th>PNL</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTrades.length === 0 ? (
                    <tr><td colSpan={7} className="bp-empty-cell"><div className="empty-positions"><p>No trade history yet</p></div></td></tr>
                  ) : recentTrades.map(trade => {
                    const d = new Date(trade.executed_at)
                    const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
                    const timePart = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
                    const pnl = trade.realized_pnl
                    return (
                      <tr key={trade.id}>
                        <td className="bp-date">{datePart}</td>
                        <td className="bp-time">{timePart}</td>
                        <td>{trade.symbol}</td>
                        <td className={trade.side === 'BUY' ? 'positive' : 'negative'}>
                          {trade.side}
                        </td>
                        <td>{fmt(trade.price)}</td>
                        <td>{trade.quantity.toFixed(4)}</td>
                        <td className={pnl == null ? '' : pnl >= 0 ? 'positive' : 'negative'}>
                          {pnl != null ? `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Account panel */}
        <div className="account-panel">
          <div className="account-header"><span>Account</span></div>
          <div className="account-stats">
            <div className="account-row">
              <span>Balance</span>
              <span>{account ? account.current_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'} USDT</span>
            </div>
            <div className="account-row">
              <span>Equity</span>
              <span>{equity.toFixed(2)} USDT</span>
            </div>
            <div className="account-row">
              <span>Unrealized PNL</span>
              <span className={totalUnrealizedPNL >= 0 ? 'positive' : 'negative'}>
                {totalUnrealizedPNL >= 0 ? '+' : ''}{totalUnrealizedPNL.toFixed(2)} USDT
              </span>
            </div>
            <div className="account-row">
              <span>Challenge</span>
              <span className={account?.status === 'active' ? 'positive' : account?.status === 'passed' ? 'positive' : 'negative'}>
                {account?.status?.toUpperCase() || '—'}
              </span>
            </div>
          </div>

          {/* ── Reconcile Balance ── */}
          <div className="reconcile-section">

            {/* Idle / done / error — show button */}
            {(reconcileState === 'idle' || reconcileState === 'done' || reconcileState === 'error') && (
              <button className="reconcile-btn" onClick={handleReconcile}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                Reconcile Balance
              </button>
            )}

            {/* Confirmation prompt */}
            {reconcileState === 'confirm' && (
              <div className="reconcile-confirm">
                <p className="reconcile-confirm-text">
                  Recalculate balance from trade history?<br />
                  <small>No data will be deleted.</small>
                </p>
                <div className="reconcile-confirm-actions">
                  <button className="reconcile-btn-yes" onClick={handleReconcile}>Run</button>
                  <button className="reconcile-btn-no" onClick={() => setReconcileState('idle')}>Cancel</button>
                </div>
              </div>
            )}

            {/* Running spinner */}
            {reconcileState === 'running' && (
              <div className="reconcile-running">
                <div className="reconcile-spinner" />
                <span>Reconciling…</span>
              </div>
            )}

            {/* Success result */}
            {reconcileState === 'done' && reconcileResult && !reconcileResult.error && (
              <div className="reconcile-result">
                {reconcileResult.alreadyCorrect ? (
                  <div className="reconcile-ok">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    Balance already correct
                  </div>
                ) : (
                  <>
                    <div className="reconcile-ok">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                      Balance corrected
                    </div>
                    <div className="reconcile-diff-row">
                      <span className="reconcile-label">Was</span>
                      <span className="reconcile-old">${reconcileResult.oldBalance.toFixed(2)}</span>
                    </div>
                    <div className="reconcile-diff-row">
                      <span className="reconcile-label">Now</span>
                      <span className="reconcile-new">${reconcileResult.newBalance.toFixed(2)}</span>
                    </div>
                    <div className="reconcile-diff-row">
                      <span className="reconcile-label">Realized PNL</span>
                      <span className={reconcileResult.totalRealizedPnl >= 0 ? 'positive' : 'negative'}>
                        {reconcileResult.totalRealizedPnl >= 0 ? '+' : ''}${reconcileResult.totalRealizedPnl.toFixed(2)}
                      </span>
                    </div>
                    <div className="reconcile-diff-row">
                      <span className="reconcile-label">Closed trades</span>
                      <span>{reconcileResult.totalClosedTrades}</span>
                    </div>
                  </>
                )}
                <button className="reconcile-dismiss" onClick={() => setReconcileState('idle')}>Dismiss</button>
              </div>
            )}

            {/* Error state */}
            {reconcileState === 'error' && reconcileResult?.error && (
              <div className="reconcile-error">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {reconcileResult.error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile full-screen chart */}
      {mobileChartView && (
        <div className="mobile-chart-overlay" ref={() => { document.body.style.overflow = 'hidden' }}>
          <div className="mobile-chart-header">
            <button className="mobile-chart-back" onClick={() => { setMobileChartView(false); document.body.style.overflow = '' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            <div className="mobile-chart-pair">
              <span className="pair-symbol">{selectedPair}</span>
              <span className="pair-type">Perp</span>
            </div>
            <span className={`mobile-chart-price ${priceChangePercent >= 0 ? 'positive' : 'negative'}`}>
              {fmt(currentPrice)}
            </span>
          </div>
          <div className="mobile-chart-body">
            <div id="tv_chart_container_mobile" ref={mobileChartRef} style={{ width: '100%', height: '100%' }} />
          </div>
        </div>
      )}

      {/* Pair dropdown */}
      {showPairDropdown && (
        <div className="pair-dropdown-overlay" onClick={() => { setShowPairDropdown(false); setPairSearch('') }}>
          <div className="pair-dropdown" onClick={(ev) => ev.stopPropagation()}>
            <div className="pair-dropdown-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                autoFocus
                type="text"
                placeholder="Search pair..."
                value={pairSearch}
                onChange={e => setPairSearch(e.target.value)}
                className="pair-search-input"
              />
              {pairSearch && (
                <button className="pair-search-clear" onClick={() => setPairSearch('')}>×</button>
              )}
            </div>
            <div className="pair-dropdown-list">
              {pairsLoading ? (
                <div className="pair-dropdown-loading">
                  <div className="pair-dropdown-spinner" />
                  Loading pairs...
                </div>
              ) : filteredPairs.length === 0 ? (
                <div className="pair-dropdown-empty">No pairs found</div>
              ) : filteredPairs.map(pair => (
                <button
                  key={pair}
                  className={`pair-dropdown-item ${pair === selectedPair ? 'active' : ''}`}
                  onClick={() => { setSelectedPair(pair); setShowPairDropdown(false); setPairSearch('') }}
                >
                  {pair.replace('USDT', '')} <span className="pair-dropdown-quote">/ USDT</span>
                  {(() => {
                    const liveData = trading.prices[pair]
                    const snapData = snapshotPrices[pair]
                    const data = liveData || snapData
                    if (!data) return null
                    return (
                      <span className={`pair-dropdown-price ${(data.change || 0) >= 0 ? 'positive' : 'negative'}`}>
                        ${fmt(data.price)}
                      </span>
                    )
                  })()}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Leverage Modal */}
      {showLeverageModal && (
        <div className="leverage-modal-overlay" onClick={() => setShowLeverageModal(false)}>
          <div className="leverage-modal" onClick={(e) => e.stopPropagation()}>
            <div className="leverage-modal-header">
              <h3>Adjust Leverage</h3>
              <button className="leverage-modal-close" onClick={() => setShowLeverageModal(false)}>×</button>
            </div>
            <p className="leverage-modal-sub">Max leverage for {getBaseAsset()}: {maxLeverage}x</p>

            <div className="leverage-slider-section">
              <input
                type="range"
                min="1"
                max={maxLeverage}
                step="1"
                value={leverageInput}
                onChange={(e) => setLeverageInput(e.target.value)}
                className="leverage-slider"
              />
              <div className="leverage-input-row">
                <input
                  type="number"
                  min="1"
                  max={maxLeverage}
                  value={leverageInput}
                  onChange={(e) => setLeverageInput(e.target.value)}
                  className="leverage-number-input"
                />
                <span className="leverage-x">x</span>
              </div>
            </div>

            <div className="leverage-presets">
              {leveragePresets.map(v => (
                <button
                  key={v}
                  className={`leverage-preset-btn ${parseInt(leverageInput) === v ? 'active' : ''}`}
                  onClick={() => setLeverageInput(String(v))}
                >
                  {v}x
                </button>
              ))}
            </div>

            <p className="leverage-warning">
              ⚠️ Higher leverage increases both profit potential and liquidation risk.
            </p>

            <button className="leverage-confirm-btn" onClick={confirmLeverage}>
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MarketsPage
