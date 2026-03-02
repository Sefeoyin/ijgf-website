import { useState, useEffect, useCallback } from 'react'
import { getAccountState, resetDemoAccount } from './tradingService'

function DashboardOverview({ userId, onNavigate }) {
  const [timeRange, setTimeRange] = useState('1W')
  const [selectedMarket, setSelectedMarket] = useState(null)
  const [isLoadingPrices, setIsLoadingPrices] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [sortBy, setSortBy] = useState('default')
  const [priceAlerts, setPriceAlerts] = useState([])
  const [showAlertModal, setShowAlertModal] = useState(false)
  const [alertModalMarket, setAlertModalMarket] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [showMarketsModal, setShowMarketsModal] = useState(false)
  const [showChallengeModal, setShowChallengeModal] = useState(false)
  const [startingChallenge, setStartingChallenge] = useState(false)
  
  // Real account data from Supabase
  const [account, setAccount] = useState(null)
  const [accountLoading, setAccountLoading] = useState(true)
  const [accountPositions, setAccountPositions] = useState([])
  const [accountTradingDays, setAccountTradingDays] = useState(0)

  // Load account + trades from Supabase
  useEffect(() => {
    if (!userId) return
    const load = async () => {
      try {
        setAccountLoading(true)
        const state = await getAccountState(userId)
        setAccount(state.account)
        setRealTrades(state.recentTrades)
        setAccountPositions(state.positions || [])
        setAccountTradingDays(state.tradingDays ?? 0)
      } catch (err) {
        console.error('DashboardOverview: failed to load account', err)
      } finally {
        setAccountLoading(false)
      }
    }
    load()
  }, [userId])

  // Real-time market data from Binance Futures — all USDT perps
  // Pre-populated with top coins so list is never empty while fetch loads
  const [markets, setMarkets] = useState([
    // Large caps
    { symbol: 'BTCUSDT',   name: 'Bitcoin',          price: 0, change: 0, favorite: true  },
    { symbol: 'ETHUSDT',   name: 'Ethereum',          price: 0, change: 0, favorite: true  },
    { symbol: 'SOLUSDT',   name: 'Solana',            price: 0, change: 0, favorite: false },
    { symbol: 'BNBUSDT',   name: 'BNB',               price: 0, change: 0, favorite: false },
    { symbol: 'XRPUSDT',   name: 'XRP',               price: 0, change: 0, favorite: false },
    { symbol: 'ADAUSDT',   name: 'Cardano',           price: 0, change: 0, favorite: false },
    { symbol: 'DOGEUSDT',  name: 'Dogecoin',          price: 0, change: 0, favorite: false },
    { symbol: 'AVAXUSDT',  name: 'Avalanche',         price: 0, change: 0, favorite: false },
    { symbol: 'DOTUSDT',   name: 'Polkadot',          price: 0, change: 0, favorite: false },
    { symbol: 'MATICUSDT', name: 'Polygon',           price: 0, change: 0, favorite: false },
    { symbol: 'LINKUSDT',  name: 'Chainlink',         price: 0, change: 0, favorite: false },
    { symbol: 'UNIUSDT',   name: 'Uniswap',           price: 0, change: 0, favorite: false },
    { symbol: 'ATOMUSDT',  name: 'Cosmos',            price: 0, change: 0, favorite: false },
    { symbol: 'LTCUSDT',   name: 'Litecoin',          price: 0, change: 0, favorite: false },
    { symbol: 'NEARUSDT',  name: 'NEAR Protocol',     price: 0, change: 0, favorite: false },
    { symbol: 'APTUSDT',   name: 'Aptos',             price: 0, change: 0, favorite: false },
    { symbol: 'ARBUSDT',   name: 'Arbitrum',          price: 0, change: 0, favorite: false },
    { symbol: 'OPUSDT',    name: 'Optimism',          price: 0, change: 0, favorite: false },
    { symbol: 'TONUSDT',   name: 'Toncoin',           price: 0, change: 0, favorite: false },
    { symbol: 'TRXUSDT',   name: 'TRON',              price: 0, change: 0, favorite: false },
    { symbol: 'BCHUSDT',   name: 'Bitcoin Cash',      price: 0, change: 0, favorite: false },
    { symbol: 'XLMUSDT',   name: 'Stellar',           price: 0, change: 0, favorite: false },
    { symbol: 'ETCUSDT',   name: 'Ethereum Classic',  price: 0, change: 0, favorite: false },
    // Mid caps
    { symbol: 'SUIUSDT',   name: 'Sui',               price: 0, change: 0, favorite: false },
    { symbol: 'INJUSDT',   name: 'Injective',         price: 0, change: 0, favorite: false },
    { symbol: 'SEIUSDT',   name: 'Sei',               price: 0, change: 0, favorite: false },
    { symbol: 'TIAUSDT',   name: 'Celestia',          price: 0, change: 0, favorite: false },
    { symbol: 'WLDUSDT',   name: 'Worldcoin',         price: 0, change: 0, favorite: false },
    { symbol: 'PEPEUSDT',  name: 'Pepe',              price: 0, change: 0, favorite: false },
    { symbol: 'SHIBUSDT',  name: 'Shiba Inu',         price: 0, change: 0, favorite: false },
    { symbol: 'WIFUSDT',   name: 'dogwifhat',         price: 0, change: 0, favorite: false },
    { symbol: 'BONKUSDT',  name: 'Bonk',              price: 0, change: 0, favorite: false },
    { symbol: 'FLOKIUSDT', name: 'Floki',             price: 0, change: 0, favorite: false },
    { symbol: 'ORDIUSDT',  name: 'Ordinals',          price: 0, change: 0, favorite: false },
    { symbol: 'RUNEUSDT',  name: 'THORChain',         price: 0, change: 0, favorite: false },
    { symbol: 'LDOUSDT',   name: 'Lido',              price: 0, change: 0, favorite: false },
    { symbol: 'ICPUSDT',   name: 'Internet Computer', price: 0, change: 0, favorite: false },
    { symbol: 'HBARUSDT',  name: 'Hedera',            price: 0, change: 0, favorite: false },
    { symbol: 'FILUSDT',   name: 'Filecoin',          price: 0, change: 0, favorite: false },
    { symbol: 'ALGOUSDT',  name: 'Algorand',          price: 0, change: 0, favorite: false },
    { symbol: 'KASUSDT',   name: 'Kaspa',             price: 0, change: 0, favorite: false },
    { symbol: 'JUPUSDT',   name: 'Jupiter',           price: 0, change: 0, favorite: false },
    { symbol: 'FTMUSDT',   name: 'Fantom',            price: 0, change: 0, favorite: false },
    { symbol: 'VETUSDT',   name: 'VeChain',           price: 0, change: 0, favorite: false },
    // DeFi
    { symbol: 'AAVEUSDT',  name: 'Aave',              price: 0, change: 0, favorite: false },
    { symbol: 'CRVUSDT',   name: 'Curve DAO',         price: 0, change: 0, favorite: false },
    { symbol: 'MKRUSDT',   name: 'Maker',             price: 0, change: 0, favorite: false },
    { symbol: 'COMPUSDT',  name: 'Compound',          price: 0, change: 0, favorite: false },
    { symbol: 'GRTUSDT',   name: 'The Graph',         price: 0, change: 0, favorite: false },
    { symbol: 'DYDXUSDT',  name: 'dYdX',              price: 0, change: 0, favorite: false },
    { symbol: 'PENDLEUSDT',name: 'Pendle',            price: 0, change: 0, favorite: false },
    { symbol: 'GMXUSDT',   name: 'GMX',               price: 0, change: 0, favorite: false },
    { symbol: 'STRKUSDT',  name: 'Starknet',          price: 0, change: 0, favorite: false },
    { symbol: 'SNXUSDT',   name: 'Synthetix',         price: 0, change: 0, favorite: false },
    { symbol: 'SUSHIUSDT', name: 'SushiSwap',         price: 0, change: 0, favorite: false },
    // AI / Infra
    { symbol: 'FETUSDT',   name: 'Fetch.ai',          price: 0, change: 0, favorite: false },
    { symbol: 'RENDERUSDT',name: 'Render',            price: 0, change: 0, favorite: false },
    { symbol: 'TAOUSDT',   name: 'Bittensor',         price: 0, change: 0, favorite: false },
    { symbol: 'PYTHUSDT',  name: 'Pyth Network',      price: 0, change: 0, favorite: false },
    { symbol: 'OCEANUSDT', name: 'Ocean Protocol',    price: 0, change: 0, favorite: false },
    { symbol: 'ARKMUSDT',  name: 'Arkham',            price: 0, change: 0, favorite: false },
    // Gaming / Metaverse
    { symbol: 'AXSUSDT',   name: 'Axie Infinity',     price: 0, change: 0, favorite: false },
    { symbol: 'SANDUSDT',  name: 'The Sandbox',       price: 0, change: 0, favorite: false },
    { symbol: 'MANAUSDT',  name: 'Decentraland',      price: 0, change: 0, favorite: false },
    { symbol: 'GALAUSDT',  name: 'Gala',              price: 0, change: 0, favorite: false },
    { symbol: 'IMXUSDT',   name: 'Immutable X',       price: 0, change: 0, favorite: false },
    { symbol: 'APEUSDT',   name: 'ApeCoin',           price: 0, change: 0, favorite: false },
    // Other
    { symbol: 'ENAUSDT',   name: 'Ethena',            price: 0, change: 0, favorite: false },
    { symbol: 'ANKRUSDT',  name: 'Ankr',              price: 0, change: 0, favorite: false },
    { symbol: 'CHZUSDT',   name: 'Chiliz',            price: 0, change: 0, favorite: false },
    { symbol: 'ENJUSDT',   name: 'Enjin',             price: 0, change: 0, favorite: false },
    { symbol: 'CHRUSDT',   name: 'Chromia',           price: 0, change: 0, favorite: false },
    { symbol: 'YGGUSDT',   name: 'Yield Guild',       price: 0, change: 0, favorite: false },
    { symbol: 'BLURUSDT',  name: 'Blur',              price: 0, change: 0, favorite: false },
    { symbol: 'COTIUSDT',  name: 'COTI',              price: 0, change: 0, favorite: false },
    { symbol: 'STORJUSDT', name: 'Storj',             price: 0, change: 0, favorite: false },
    { symbol: 'BANDUSDT',  name: 'Band Protocol',     price: 0, change: 0, favorite: false },
    { symbol: 'CELRUSDT',  name: 'Celer Network',     price: 0, change: 0, favorite: false },
    { symbol: 'CKBUSDT',   name: 'Nervos Network',    price: 0, change: 0, favorite: false },
    { symbol: 'SCUSDT',    name: 'Siacoin',           price: 0, change: 0, favorite: false },
    { symbol: 'ONTUSDT',   name: 'Ontology',          price: 0, change: 0, favorite: false },
    { symbol: 'WAVESUSDT', name: 'Waves',             price: 0, change: 0, favorite: false },
    { symbol: 'ZENUSDT',   name: 'Horizen',           price: 0, change: 0, favorite: false },
    { symbol: 'CTSIUSDT',  name: 'Cartesi',           price: 0, change: 0, favorite: false },
    { symbol: 'REEFUSDT',  name: 'Reef',              price: 0, change: 0, favorite: false },
    { symbol: 'ALICEUSDT', name: 'My Neighbor Alice', price: 0, change: 0, favorite: false },
    { symbol: 'SUPERUSDT', name: 'SuperFarm',         price: 0, change: 0, favorite: false },
    { symbol: 'CVCUSDT',   name: 'Civic',             price: 0, change: 0, favorite: false },
    { symbol: 'DGBUSDT',   name: 'DigiByte',          price: 0, change: 0, favorite: false },
    { symbol: 'LRCUSDT',   name: 'Loopring',          price: 0, change: 0, favorite: false },
    { symbol: 'POPCATUSDT',name: 'Popcat',            price: 0, change: 0, favorite: false },
  ])

  const [realTrades, setRealTrades] = useState([])

  // Margin locked in open positions — fallback to entry_price * qty / leverage if column is null
  const totalMarginInUse = accountPositions.reduce((sum, p) => {
    const m = (p.margin != null && p.margin > 0)
      ? p.margin
      : (p.entry_price * p.quantity) / (p.leverage || 1)
    return sum + (m || 0)
  }, 0)

  // True account value = cash + margin (returned on close) + unrealized PNL from open positions
  // This is what the balance card should show
  const trueAccountValue = account ? account.current_balance + totalMarginInUse : 0

  // Realized PNL only (from closed trades) — excludes margin distortion
  const realizedPNL = realTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0)

  // Derived stats from real account data
  const stats = {
    activeChallenges: account?.status === 'active' ? 1 : 0,
    totalPNL: realizedPNL,
    winRate: account?.total_trades > 0
      ? ((account.winning_trades / account.total_trades) * 100).toFixed(1)
      : 0,
    currentEquity: trueAccountValue,
  }

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

  // Human-readable names for top coins — others fall back to ticker base
  const COIN_NAMES = {
    BTCUSDT:'Bitcoin', ETHUSDT:'Ethereum', BNBUSDT:'BNB', SOLUSDT:'Solana',
    XRPUSDT:'XRP', ADAUSDT:'Cardano', DOGEUSDT:'Dogecoin', AVAXUSDT:'Avalanche',
    DOTUSDT:'Polkadot', MATICUSDT:'Polygon', LINKUSDT:'Chainlink', UNIUSDT:'Uniswap',
    ATOMUSDT:'Cosmos', LTCUSDT:'Litecoin', NEARUSDT:'NEAR Protocol', APTUSDT:'Aptos',
    ARBUSDT:'Arbitrum', OPUSDT:'Optimism', SUIUSDT:'Sui', INJUSDT:'Injective',
    SEIUSDT:'Sei', WLDUSDT:'Worldcoin', PEPEUSDT:'Pepe', SHIBUSDT:'Shiba Inu',
    TONUSDT:'Toncoin', TRXUSDT:'TRON', BCHUSDT:'Bitcoin Cash', XLMUSDT:'Stellar',
    ETCUSDT:'Ethereum Classic', FILUSDT:'Filecoin', ICPUSDT:'Internet Computer',
    HBARUSDT:'Hedera', AAVEUSDT:'Aave', LDOUSDT:'Lido', WIFUSDT:'dogwifhat',
    BONKUSDT:'Bonk', FLOKIUSDT:'Floki', RUNEUSDT:'THORChain', FETUSDT:'Fetch.ai',
    RENDERUSDT:'Render', IMXUSDT:'Immutable X', KASUSDT:'Kaspa', JUPUSDT:'Jupiter',
    TAOUSDT:'Bittensor', SANDUSDT:'The Sandbox', MANAUSDT:'Decentraland',
    GALAUSDT:'Gala', AXSUSDT:'Axie Infinity', GMXUSDT:'GMX', PENDLEUSDT:'Pendle',
    TIAUSDT:'Celestia', STRKUSDT:'Starknet', CRVUSDT:'Curve DAO', MKRUSDT:'Maker',
    COMPUSDT:'Compound', GRTUSDT:'The Graph', DYDXUSDT:'dYdX', ALGOUSDT:'Algorand',
  }

  // Fetch all Binance Futures USDT pairs sorted by 24h volume
  useEffect(() => {
    const FAVORITES = new Set(['BTCUSDT', 'ETHUSDT'])

    // CoinGecko chunked seed — covers all tokens, no geo-block issues
    const COINGECKO_SYMBOL_MAP = {
      'bitcoin':'BTCUSDT','ethereum':'ETHUSDT','solana':'SOLUSDT','binancecoin':'BNBUSDT',
      'ripple':'XRPUSDT','cardano':'ADAUSDT','dogecoin':'DOGEUSDT','avalanche-2':'AVAXUSDT',
      'polkadot':'DOTUSDT','polygon-ecosystem-token':'MATICUSDT','chainlink':'LINKUSDT',
      'uniswap':'UNIUSDT','cosmos':'ATOMUSDT','litecoin':'LTCUSDT','near':'NEARUSDT',
      'aptos':'APTUSDT','arbitrum':'ARBUSDT','optimism':'OPUSDT','the-open-network':'TONUSDT',
      'tron':'TRXUSDT','bitcoin-cash':'BCHUSDT','stellar':'XLMUSDT','ethereum-classic':'ETCUSDT',
      'sui':'SUIUSDT','injective-protocol':'INJUSDT','sei-network':'SEIUSDT','celestia':'TIAUSDT',
      'worldcoin-wld':'WLDUSDT','pepe':'PEPEUSDT','shiba-inu':'SHIBUSDT','dogwifcoin':'WIFUSDT',
      'bonk':'BONKUSDT','floki':'FLOKIUSDT','ordinals':'ORDIUSDT','thorchain':'RUNEUSDT',
      'lido-dao':'LDOUSDT','internet-computer':'ICPUSDT','hedera-hashgraph':'HBARUSDT',
      'filecoin':'FILUSDT','algorand':'ALGOUSDT','kaspa':'KASUSDT',
      'jupiter-exchange-solana':'JUPUSDT','fantom':'FTMUSDT','vechain':'VETUSDT',
      'aave':'AAVEUSDT','curve-dao-token':'CRVUSDT','maker':'MKRUSDT',
      'compound-governance-token':'COMPUSDT','the-graph':'GRTUSDT','dydx':'DYDXUSDT',
      'pendle':'PENDLEUSDT','gmx':'GMXUSDT','starknet':'STRKUSDT','havven':'SNXUSDT',
      'sushi':'SUSHIUSDT','fetch-ai':'FETUSDT','render-token':'RENDERUSDT',
      'bittensor':'TAOUSDT','pyth-network':'PYTHUSDT','ocean-protocol':'OCEANUSDT',
      'arkham':'ARKMUSDT','axie-infinity':'AXSUSDT','the-sandbox':'SANDUSDT',
      'decentraland':'MANAUSDT','gala':'GALAUSDT','immutable-x':'IMXUSDT','apecoin':'APEUSDT',
      'ethena':'ENAUSDT','ankr':'ANKRUSDT','chiliz':'CHZUSDT','enjincoin':'ENJUSDT',
      'chromaway':'CHRUSDT','yield-guild-games':'YGGUSDT','blur':'BLURUSDT',
      'coti':'COTIUSDT','storj':'STORJUSDT','band-protocol':'BANDUSDT',
      'celer-network':'CELRUSDT','nervos-network':'CKBUSDT','siacoin':'SCUSDT',
      'ontology':'ONTUSDT','waves':'WAVESUSDT','zencash':'ZENUSDT','cartesi':'CTSIUSDT',
      'reef':'REEFUSDT','my-neighbor-alice':'ALICEUSDT','superfarm':'SUPERUSDT',
      'civic':'CVCUSDT','digibyte':'DGBUSDT','loopring':'LRCUSDT','popcat':'POPCATUSDT',
    }
    const COINGECKO_IDS = Object.keys(COINGECKO_SYMBOL_MAP)
    const CHUNK_SIZE = 50

    // Tier 1: Vercel proxy — runs server-side, bypasses all client-side ISP blocks
    // (fapi.binance.com is blocked at the DNS/TCP level by NCC in Nigeria and other regions)
    const fetchViaProxy = async () => {
      try {
        const res = await fetch('/api/pairs', { signal: AbortSignal.timeout(9000) })
        if (!res.ok) throw new Error(`proxy HTTP ${res.status}`)
        const body = await res.json()
        if (!Array.isArray(body.pairs) || body.pairs.length === 0) throw new Error('empty pairs')
        const prices = body.prices || {}
        const parsed = body.pairs.map(symbol => ({
          symbol,
          name: COIN_NAMES[symbol] || symbol.replace('USDT', ''),
          price: parseFloat(prices[symbol]) || 0,
          change: parseFloat(body.changes?.[symbol]) || 0,
          favorite: FAVORITES.has(symbol),
        }))
        setMarkets(parsed)
        setIsLoadingPrices(false)
        return true
      } catch (err) {
        console.warn('DashboardOverview: proxy fetch failed, falling back to CoinGecko:', err.message)
        return false
      }
    }

    // Tier 2: CoinGecko — public API, no geo-blocking, rate-limited (30 req/min free tier)
    // Only used when the Vercel proxy is unavailable. Chunked to avoid silent truncation at 50-item limit.
    const seedViaCoinGecko = async () => {
      try {
        const chunks = []
        for (let i = 0; i < COINGECKO_IDS.length; i += CHUNK_SIZE) {
          chunks.push(COINGECKO_IDS.slice(i, i + CHUNK_SIZE))
        }
        const results = await Promise.all(chunks.map(chunk =>
          fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${chunk.join(',')}&vs_currencies=usd&include_24hr_change=true`)
            .then(r => r.ok ? r.json() : {})
            .catch(() => ({}))
        ))
        const data = Object.assign({}, ...results)
        setMarkets(prev => prev.map(m => {
          const cgId = Object.entries(COINGECKO_SYMBOL_MAP).find(([, sym]) => sym === m.symbol)?.[0]
          const d = cgId && data[cgId]
          return d ? { ...m, price: d.usd || 0, change: d.usd_24h_change || 0 } : m
        }))
        setIsLoadingPrices(false)
      } catch { /* silent — markets will show with stale/zero prices, still functional */ }
    }

    const init = async () => {
      const proxyOk = await fetchViaProxy()
      if (!proxyOk) await seedViaCoinGecko()
    }

    init()
    // Refresh via proxy every 30s. CoinGecko is NOT used in the interval — its 30 req/min
    // free tier would be exhausted by a 30s poll with chunked requests.
    const interval = setInterval(fetchViaProxy, 30000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Build equity chart from real trade history
  const buildChartFromTrades = useCallback((trades, hoursBack) => {
    const initial = account?.initial_balance ?? 10000
    const now = Date.now()
    const cutoff = now - hoursBack * 60 * 60 * 1000

    // Filter trades within window, oldest first
    const filtered = [...trades]
      .filter(t => t.realized_pnl != null && new Date(t.executed_at).getTime() >= cutoff)
      .sort((a, b) => new Date(a.executed_at) - new Date(b.executed_at))

    if (filtered.length === 0) {
      const pad = initial * 0.15
      return { path: 'M 50 90 L 750 90', fillPath: 'M 50 90 L 750 90 L 750 170 L 50 170 Z', equity: initial, change: 0, dates: [], yMin: initial - pad, yMax: initial + pad }
    }

    // Build cumulative equity points
    let running = initial
    const points = [{ x: 50, y: 170, equity: initial }]
    filtered.forEach((t, i) => {
      running += (t.realized_pnl || 0)
      const x = 50 + ((i + 1) / filtered.length) * 700
      points.push({ x, equity: running })
    })
    points[points.length - 1].x = 750

    // Normalize to SVG y-axis (170 = bottom, 10 = top)
    const equities = points.map(p => p.equity)
    const rawMin = Math.min(...equities)
    const rawMax = Math.max(...equities)
    const pad = (rawMax - rawMin) * 0.15 || initial * 0.1
    const yMin = rawMin - pad
    const yMax = rawMax + pad
    const range = yMax - yMin
    const normalize = (e) => 170 - ((e - yMin) / range) * 160

    const normalized = points.map(p => ({ x: p.x, y: normalize(p.equity), equity: p.equity }))
    const path = normalized.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    const fillPath = path + ` L ${normalized[normalized.length-1].x.toFixed(1)} 170 L 50 170 Z`

    const finalEquity = running
    const change = ((finalEquity - initial) / initial) * 100

    return { path, fillPath, equity: finalEquity, change, dates: [], yMin, yMax }
  }, [account])

  const hoursMap = { '1D': 24, '1W': 168, '1M': 720, '3M': 2160, '6M': 4320, '1Y': 8760 }
  const dateLabels = {
    '1D': ['6am', '9am', '12pm', '3pm', '6pm'],
    '1W': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    '1M': ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    '3M': ['Jan', 'Feb', 'Mar'],
    '6M': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    '1Y': ['Q1', 'Q2', 'Q3', 'Q4'],
  }

  const builtChart = buildChartFromTrades(realTrades, hoursMap[timeRange] || 24)
  const currentChart = { ...builtChart, dates: dateLabels[timeRange] }

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

  // currentChart is built above from real trade data

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
          <div className={`stats-value ${stats.totalPNL > 0 ? 'pnl-positive' : stats.totalPNL < 0 ? 'pnl-negative' : 'pnl-neutral'}`}>{formatCurrency(stats.totalPNL)}</div>
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

        <div className="stats-card">
          <div className="stats-card-header">
            <div className="stats-icon blue">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <span className="stats-label">Trading Days</span>
          </div>
          <div className="stats-value">{accountTradingDays}/{account?.min_trading_days || 5}</div>
          <div className="stats-subtitle">Days active this challenge</div>
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
            {['1D', '1W', '1M', '3M', '6M', '1Y'].map((range) => (
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
            {/* Y-axis labels — dynamic based on actual equity range */}
            <div className="chart-y-axis">
              {[4,3,2,1,0].map(i => {
                const val = (currentChart.yMin || 0) + i * ((currentChart.yMax - currentChart.yMin) / 4 || 1)
                return <span key={i}>{formatCurrency(val)}</span>
              })}
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
          {accountLoading ? (
            <div className="challenge-card empty-state"><p className="empty-subtext">Loading...</p></div>
          ) : account && account.status === 'active' ? (
            <div className="challenge-card active-challenge">
              <div className="challenge-info-row">
                <span className="challenge-badge">{account.challenge_type?.toUpperCase()} Challenge</span>
                <span className="challenge-status active">● Active</span>
              </div>
              <div className="challenge-metrics">
                <div className="challenge-metric">
                  <span className="metric-label">Balance</span>
                  <span className="metric-value">{formatCurrency(trueAccountValue)}</span>
                </div>
                <div className="challenge-metric">
                  <span className="metric-label">Profit Target</span>
                  <span className="metric-value">{formatCurrency(account.profit_target)}</span>
                </div>
                <div className="challenge-metric">
                  <span className="metric-label">Max Drawdown</span>
                  <span className="metric-value">{formatCurrency(account.max_total_drawdown)}</span>
                </div>
                <div className="challenge-metric">
                  <span className="metric-label">Min Trading Days</span>
                  <span className="metric-value">{accountTradingDays}/{account.min_trading_days || 5}</span>
                </div>
              </div>
              <div className="challenge-progress">
                <div className="progress-label">
                  <span>Profit Progress</span>
                  <span>{Math.max(0, ((trueAccountValue - account.initial_balance) / account.profit_target * 100)).toFixed(1)}%</span>
                </div>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${Math.min(100, Math.max(0, (trueAccountValue - account.initial_balance) / account.profit_target * 100))}%` }}
                  />
                </div>
              </div>
              <div className="challenge-progress">
                <div className="progress-label">
                  <span>Trading Days</span>
                  <span>{accountTradingDays}/{account.min_trading_days || 5} days</span>
                </div>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill progress-bar-fill--blue"
                    style={{ width: `${Math.min(100, (accountTradingDays / (account.min_trading_days || 5)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="challenge-card empty-state">
              <div className="empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <p className="empty-text">
                {account?.status === 'failed' ? 'Challenge Failed' : account?.status === 'passed' ? 'Challenge Passed! 🎉' : 'No active challenges'}
              </p>
              <p className="empty-subtext">
                {account?.status === 'failed' ? 'Ready to try again?' : account?.status === 'passed' ? 'Start a new challenge to keep trading' : 'Start a challenge to begin trading'}
              </p>
            </div>
          )}
          {/* Only show Start New Challenge when NOT actively in a challenge */}
          {!accountLoading && account?.status !== 'active' && (
            <button className="btn-start-challenge" onClick={() => setShowChallengeModal(true)}>
              {account?.status === 'failed' ? 'Try Again' : account?.status === 'passed' ? 'Start New Challenge' : 'Start Challenge'}
            </button>
          )}
        </div>

        {/* History Widget - Bottom Right */}
        <div className="history-widget">
          <div className="widget-header">
            <h3>History</h3>
            <button className="btn-view-all-link" onClick={() => onNavigate && onNavigate('history')}>View All</button>
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
            {realTrades.length === 0 ? (
              <div className="empty-history">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
                <p>No trading history yet</p>
                <span>Your trades will appear here</span>
              </div>
            ) : (
              realTrades.slice(0, 10).map((trade) => (
                <div key={trade.id} className="table-row">
                  <div title={trade.id}>{trade.id.slice(0, 8)}…</div>
                  <div>{new Date(trade.executed_at).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}</div>
                  <div>{trade.symbol}</div>
                  <div className={`trade-side ${trade.side.toLowerCase()}`}>{trade.side?.toLowerCase() === 'long' ? 'Buy' : 'Sell'}</div>
                  <div>{trade.leverage}x</div>
                  <div className={(trade.realized_pnl ?? 0) >= 0 ? 'positive' : 'negative'}>
                    {trade.realized_pnl != null
                      ? `${trade.realized_pnl >= 0 ? '+' : ''}$${Math.abs(trade.realized_pnl).toFixed(2)}`
                      : '—'}
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
                        <th className="text-center">Alert</th>
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

      {/* Challenge Picker Modal */}
      {showChallengeModal && (
        <div className="modal-overlay" onClick={() => !startingChallenge && setShowChallengeModal(false)}>
          <div className="challenge-picker-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Choose Your Challenge</h3>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginTop: '0.25rem' }}>Select your account size to begin</p>
              </div>
              <button className="modal-close" onClick={() => setShowChallengeModal(false)} disabled={startingChallenge}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="challenge-picker-grid">
              {[
                { key: '5k',   size: '$5,000',   fee: '$49',  target: '10%', drawdown: '8%' },
                { key: '10k',  size: '$10,000',  fee: '$99',  target: '10%', drawdown: '8%' },
                { key: '25k',  size: '$25,000',  fee: '$249', target: '10%', drawdown: '8%' },
                { key: '50k',  size: '$50,000',  fee: '$499', target: '10%', drawdown: '8%' },
                { key: '100k', size: '$100,000', fee: '$749', target: '10%', drawdown: '8%' },
                { key: '200k', size: '$200,000', fee: '$999', target: '10%', drawdown: '8%', comingSoon: true },
              ].map(tier => (
                <div
                  key={tier.key}
                  className={`challenge-tier-card ${tier.comingSoon ? 'coming-soon' : ''}`}
                  onClick={() => {
                    if (tier.comingSoon || startingChallenge) return
                    setStartingChallenge(true)
                    resetDemoAccount(userId, tier.key)
                      .then(() => {
                        setShowChallengeModal(false)
                        // Reload account state
                        return getAccountState(userId)
                      })
                      .then(state => {
                        setAccount(state.account)
                        setRealTrades(state.recentTrades)
                        setAccountPositions(state.positions || [])
                        setAccountTradingDays(state.tradingDays ?? 0)
                      })
                      .catch(err => console.error('Failed to start challenge:', err))
                      .finally(() => setStartingChallenge(false))
                  }}
                >
                  {tier.comingSoon && <span className="tier-coming-soon-badge">Coming Soon</span>}
                  <div className="tier-size">{tier.size}</div>
                  <div className="tier-fee">{tier.fee} fee</div>
                  <div className="tier-details">
                    <span>Profit Target: <strong>{tier.target}</strong></span>
                    <span>Max Drawdown: <strong>{tier.drawdown}</strong></span>
                    <span>Profit Split: <strong>80%</strong></span>
                  </div>
                  {!tier.comingSoon && (
                    <div className="tier-cta">
                      {startingChallenge ? 'Starting...' : 'Select'}
                    </div>
                  )}
                </div>
              ))}
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