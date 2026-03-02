/**
 * useBinanceWebSocket.js
 *
 * Price feed — four-tier cascade:
 *   1. /api/prices      — Vercel proxy (same domain, bypasses ISP blocks)
 *   2. MEXC Futures WS  — direct WebSocket, not on Nigeria NCC blocked list
 *   3. Bybit Linear WS  — direct WebSocket fallback
 *   4. CoinGecko REST   — final polling fallback
 *
 * Order book — three-tier cascade:
 *   1. /api/orderbook   — Vercel proxy REST snapshot, polls every 3s
 *   2. Bybit orderbook.50 WebSocket — if proxy unavailable
 *   3. Simulated        — mathematical fallback, always works
 *
 * The proxy runs on the same Vercel domain as the frontend.
 * ISPs cannot block it without taking down the entire platform.
 */

import { useState, useEffect, useRef } from 'react'

// ── Proxy endpoints (relative URLs — same Vercel domain) ──────────────────────
const PROXY_PRICES    = '/api/prices'
const PROXY_ORDERBOOK = '/api/orderbook'

// ── Direct WebSocket endpoints ────────────────────────────────────────────────
const MEXC_WS  = 'wss://contract.mexc.com/edge'
const BYBIT_WS = 'wss://stream.bybit.com/v5/public/linear'

// ── Timing ────────────────────────────────────────────────────────────────────
const PROXY_POLL_MS    = 3000
const WS_TIMEOUT_MS    = 3000
const MEXC_PING_MS     = 15000
const BYBIT_PING_MS    = 20000
const CG_POLL_MS       = 10000
const OB_PROXY_POLL_MS = 3000

// ── Symbol helpers ────────────────────────────────────────────────────────────
const toMEXC      = (s) => s.replace('USDT', '_USDT')
const fromMEXC    = (s) => s.replace('_USDT', 'USDT')
const BYBIT_BATCH = 10

// ── CoinGecko ID map ──────────────────────────────────────────────────────────
export const COINGECKO_MAP = {
  BTCUSDT:     'bitcoin',
  ETHUSDT:     'ethereum',
  BNBUSDT:     'binancecoin',
  SOLUSDT:     'solana',
  XRPUSDT:     'ripple',
  ADAUSDT:     'cardano',
  DOGEUSDT:    'dogecoin',
  AVAXUSDT:    'avalanche-2',
  DOTUSDT:     'polkadot',
  MATICUSDT:   'polygon-ecosystem-token',
  LINKUSDT:    'chainlink',
  UNIUSDT:     'uniswap',
  ATOMUSDT:    'cosmos',
  LTCUSDT:     'litecoin',
  NEARUSDT:    'near',
  APTUSDT:     'aptos',
  ARBUSDT:     'arbitrum',
  OPUSDT:      'optimism',
  BCHUSDT:     'bitcoin-cash',
  TONUSDT:     'the-open-network',
  TRXUSDT:     'tron',
  XLMUSDT:     'stellar',
  ETCUSDT:     'ethereum-classic',
  INJUSDT:     'injective-protocol',
  SUIUSDT:     'sui',
  SEIUSDT:     'sei-network',
  TIAUSDT:     'celestia',
  WLDUSDT:     'worldcoin-wld',
  PEPEUSDT:    'pepe',
  SHIBUSDT:    'shiba-inu',
  WIFUSDT:     'dogwifcoin',
  BONKUSDT:    'bonk',
  FLOKIUSDT:   'floki',
  ORDIUSDT:    'ordinals',
  RUNEUSDT:    'thorchain',
  LDOUSDT:     'lido-dao',
  ICPUSDT:     'internet-computer',
  HBARUSDT:    'hedera-hashgraph',
  FILUSDT:     'filecoin',
  ALGOUSDT:    'algorand',
  AAVEUSDT:    'aave',
  CRVUSDT:     'curve-dao-token',
  MKRUSDT:     'maker',
  COMPUSDT:    'compound-governance-token',
  GRTUSDT:     'the-graph',
  DYDXUSDT:    'dydx',
  PENDLEUSDT:  'pendle',
  GMXUSDT:     'gmx',
  STRKUSDT:    'starknet',
  SNXUSDT:     'havven',
  FETUSDT:     'fetch-ai',
  RENDERUSDT:  'render-token',
  TAOUSDT:     'bittensor',
  PYTHUSDT:    'pyth-network',
  AXSUSDT:     'axie-infinity',
  SANDUSDT:    'the-sandbox',
  MANAUSDT:    'decentraland',
  GALAUSDT:    'gala',
  IMXUSDT:     'immutable-x',
  KASUSDT:     'kaspa',
  JUPUSDT:     'jupiter-exchange-solana',
  POPCATUSDT:  'popcat',
  FTMUSDT:     'fantom',
  EOSUSDT:     'eos',
  VETUSDT:     'vechain',
  EGLDUSDT:    'elrond-erd-2',
  FLOWUSDT:    'flow',
  XTZUSDT:     'tezos',
  ZILUSDT:     'zilliqa',
  KAVAUSDT:    'kava',
  SUSHIUSDT:   'sushi',
  '1INCHUSDT': '1inch',
  BALUSDT:     'balancer',
  YFIUSDT:     'yearn-finance',
  LRCUSDT:     'loopring',
  OCEANUSDT:   'ocean-protocol',
  ARKMUSDT:    'arkham',
  APEUSDT:     'apecoin',
  BLURUSDT:    'blur',
  YGGUSDT:     'yield-guild-games',
  ENAUSDT:     'ethena',
  COTIUSDT:    'coti',
  ANKRUSDT:    'ankr',
  STORJUSDT:   'storj',
  BANDUSDT:    'band-protocol',
  CELRUSDT:    'celer-network',
  CKBUSDT:     'nervos-network',
  SCUSDT:      'siacoin',
  ONTUSDT:     'ontology',
  CHZUSDT:     'chiliz',
  ENJUSDT:     'enjincoin',
  CHRUSDT:     'chromaway',
  ALICEUSDT:   'my-neighbor-alice',
  CTSIUSDT:    'cartesi',
  REEFUSDT:    'reef',
  SUPERUSDT:   'superfarm',
  WAVESUSDT:   'waves',
  ZENUSDT:     'zencash',
  DGBUSDT:     'digibyte',
  CVCUSDT:     'civic',
}

// ─────────────────────────────────────────────────────────────────────────────
// useBinanceWebSocket — price feed, four-tier cascade
// ─────────────────────────────────────────────────────────────────────────────
export function useBinanceWebSocket(symbols = []) {
  const [prices, setPrices]           = useState({})
  const [isConnected, setIsConnected] = useState(false)
  const [mode, setMode]               = useState('connecting')

  const wsRef   = useRef(null)
  const pingRef = useRef(null)
  const pollRef = useRef(null)
  const mounted = useRef(true)

  const symbolsKey = symbols.slice().sort().join(',')

  useEffect(() => {
    mounted.current = true
    if (symbols.length === 0) return

    const closeWS = () => {
      if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null }
      if (wsRef.current) {
        try { wsRef.current.close() } catch { /* ignore */ }
        wsRef.current = null
      }
    }

    const stopPolling = () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }

    // ── Tier 4: CoinGecko REST ────────────────────────────────────────────────
    const startCoinGecko = () => {
      if (!mounted.current || pollRef.current) return
      setMode('polling')
      setIsConnected(true)

      const poll = async () => {
        try {
          const ids = [...new Set(
            symbols.map(s => COINGECKO_MAP[s]).filter(Boolean)
          )].join(',')
          if (!ids) return
          const res = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
          )
          if (!res.ok || !mounted.current) return
          const data = await res.json()
          setPrices(prev => {
            const next = { ...prev }
            for (const sym of symbols) {
              const coin = data[COINGECKO_MAP[sym]]
              if (coin) {
                next[sym] = {
                  price:       coin.usd || 0,
                  change:      coin.usd_24h_change || 0,
                  high:        0,
                  low:         0,
                  volume:      0,
                  quoteVolume: 0,
                  lastUpdate:  Date.now(),
                }
              }
            }
            return next
          })
        } catch { /* ignore */ }
      }

      poll()
      pollRef.current = setInterval(poll, CG_POLL_MS)
    }

    // ── Tier 3: Bybit Linear WebSocket ───────────────────────────────────────
    const tryBybit = () => {
      if (!mounted.current) return
      closeWS()

      let timedOut = false
      const timeout = setTimeout(() => {
        timedOut = true
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          closeWS()
          startCoinGecko()
        }
      }, WS_TIMEOUT_MS)

      try {
        const ws = new WebSocket(BYBIT_WS)
        wsRef.current = ws

        ws.onopen = () => {
          if (!mounted.current) { ws.close(); return }
          clearTimeout(timeout)
          if (timedOut) { ws.close(); return }
          stopPolling() // proxy poll no longer needed — WS is live
          for (let i = 0; i < symbols.length; i += BYBIT_BATCH) {
            ws.send(JSON.stringify({
              op:   'subscribe',
              args: symbols.slice(i, i + BYBIT_BATCH).map(s => `tickers.${s}`),
            }))
          }
          pingRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ op: 'ping' }))
          }, BYBIT_PING_MS)
          setIsConnected(true)
          setMode('ws')
        }

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            if (!msg.topic?.startsWith('tickers.')) return
            const d = msg.data
            if (!d?.symbol) return
            setPrices(prev => ({
              ...prev,
              [d.symbol]: {
                price:       parseFloat(d.lastPrice)     || 0,
                change:      (parseFloat(d.price24hPcnt) || 0) * 100,
                high:        parseFloat(d.highPrice24h)  || 0,
                low:         parseFloat(d.lowPrice24h)   || 0,
                volume:      parseFloat(d.volume24h)     || 0,
                quoteVolume: parseFloat(d.turnover24h)   || 0,
                lastUpdate:  Date.now(),
              },
            }))
          } catch { /* ignore */ }
        }

        ws.onclose = () => {
          clearTimeout(timeout)
          if (!mounted.current) return
          clearInterval(pingRef.current); pingRef.current = null
          wsRef.current = null
          setIsConnected(false)
          if (!timedOut) startCoinGecko()
        }

        ws.onerror = () => { clearTimeout(timeout); ws.close() }
      } catch {
        clearTimeout(timeout)
        startCoinGecko()
      }
    }

    // ── Tier 2: MEXC Futures WebSocket ───────────────────────────────────────
    const tryMEXC = () => {
      if (!mounted.current) return
      closeWS()

      let timedOut = false
      let didOpen  = false

      const timeout = setTimeout(() => {
        timedOut = true
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          closeWS()
          tryBybit()
        }
      }, WS_TIMEOUT_MS)

      try {
        const ws = new WebSocket(MEXC_WS)
        wsRef.current = ws

        ws.onopen = () => {
          if (!mounted.current) { ws.close(); return }
          clearTimeout(timeout)
          if (timedOut) { ws.close(); return }
          stopPolling() // proxy poll no longer needed — WS is live
          didOpen = true
          for (const sym of symbols) {
            ws.send(JSON.stringify({ method: 'sub.ticker', param: { symbol: toMEXC(sym) } }))
          }
          pingRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ method: 'ping' }))
          }, MEXC_PING_MS)
          setIsConnected(true)
          setMode('ws')
        }

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            if (msg.channel !== 'push.ticker' || !msg.data) return
            const d   = msg.data
            const sym = fromMEXC(d.symbol)
            setPrices(prev => ({
              ...prev,
              [sym]: {
                price:       parseFloat(d.lastPrice)     || 0,
                change:      (parseFloat(d.riseFallRate) || 0) * 100,
                high:        parseFloat(d.high24Price)   || 0,
                low:         parseFloat(d.low24Price)    || 0,
                volume:      parseFloat(d.volume24)      || 0,
                quoteVolume: parseFloat(d.amount24)      || 0,
                lastUpdate:  Date.now(),
              },
            }))
          } catch { /* ignore */ }
        }

        ws.onclose = () => {
          clearTimeout(timeout)
          if (!mounted.current) return
          clearInterval(pingRef.current); pingRef.current = null
          wsRef.current = null
          setIsConnected(false)
          if (didOpen || !timedOut) tryBybit()
        }

        ws.onerror = () => { clearTimeout(timeout); ws.close() }
      } catch {
        clearTimeout(timeout)
        tryBybit()
      }
    }

    // ── Tier 1: Vercel proxy polling ─────────────────────────────────────────
    // Fires immediately. Simultaneously attempts a direct WS in the background.
    // If the WS connects and starts writing prices, mode flips to 'ws'.
    const startProxy = () => {
      if (!mounted.current) return

      let wsStarted = false

      const poll = async () => {
        // Skip proxy poll if a live WS is already running
        if (wsRef.current?.readyState === WebSocket.OPEN) return

        try {
          const res = await fetch(
            `${PROXY_PRICES}?symbols=${symbols.join(',')}`,
            { signal: AbortSignal.timeout(4000) }
          )
          if (!res.ok) throw new Error(`proxy HTTP ${res.status}`)
          const { prices: data } = await res.json()
          if (!mounted.current) return

          setIsConnected(true)
          setMode(prev => prev === 'ws' ? 'ws' : 'proxy') // functional update — no stale closure

          setPrices(prev => {
            const next = { ...prev }
            for (const [sym, p] of Object.entries(data)) {
              next[sym] = { ...p, lastUpdate: Date.now() }
            }
            return next
          })

          // Attempt direct WS once proxy confirms the network is reachable
          if (!wsStarted) {
            wsStarted = true
            tryMEXC()
          }
        } catch {
          // Proxy itself failed — go direct immediately
          if (!wsStarted) {
            wsStarted = true
            stopPolling()
            tryMEXC()
          }
        }
      }

      poll()
      pollRef.current = setInterval(poll, PROXY_POLL_MS)
    }

    startProxy()

    return () => {
      mounted.current = false
      closeWS()
      stopPolling()
    }
  }, [symbolsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const priceMap = {}
  for (const [sym, data] of Object.entries(prices)) {
    priceMap[sym] = data.price
  }

  return { prices, priceMap, isConnected, mode }
}

// ─────────────────────────────────────────────────────────────────────────────
// useBinanceOrderBook — order book, three-tier cascade
// Proxy REST → Bybit WS → Simulated
// ─────────────────────────────────────────────────────────────────────────────
export function useBinanceOrderBook(symbol, depth = 10) {
  const [bids, setBids]               = useState([])
  const [asks, setAsks]               = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [mode, setMode]               = useState('connecting')

  const wsRef    = useRef(null)
  const pingRef  = useRef(null)
  const pollRef  = useRef(null)
  const mounted  = useRef(true)

  const localBids = useRef(new Map())
  const localAsks = useRef(new Map())

  const applyLevels = (levels, map) => {
    for (const [p, q] of levels) {
      const qty = parseFloat(q)
      if (qty === 0) map.delete(String(p))
      else map.set(String(p), qty)
    }
  }

  const flushBook = () => {
    const makeSide = (map, descending) => {
      let total = 0
      return [...map.entries()]
        .map(([p, q]) => ({ price: parseFloat(p), qty: q }))
        .filter(r => r.qty > 0)
        .sort((a, b) => descending ? b.price - a.price : a.price - b.price)
        .slice(0, depth)
        .map(r => { total += r.qty; return { ...r, total } })
    }
    setBids(makeSide(localBids.current, true))
    setAsks(makeSide(localAsks.current, false))
  }

  useEffect(() => {
    mounted.current = true
    localBids.current = new Map()
    localAsks.current = new Map()
    if (!symbol) return

    const closeWS = () => {
      if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null }
      if (wsRef.current) {
        try { wsRef.current.close() } catch { /* ignore */ }
        wsRef.current = null
      }
    }

    const stopPolling = () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }

    const goSimulated = () => {
      if (!mounted.current) return
      closeWS()
      stopPolling()
      setIsConnected(false)
      setMode('simulated')
    }

    // ── Tier 2: Bybit orderbook.50 WebSocket ─────────────────────────────────
    const tryBybit = () => {
      if (!mounted.current) return
      closeWS()

      let timedOut = false
      const timeout = setTimeout(() => {
        timedOut = true
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          closeWS()
          goSimulated()
        }
      }, WS_TIMEOUT_MS)

      try {
        const ws = new WebSocket(BYBIT_WS)
        wsRef.current = ws

        ws.onopen = () => {
          if (!mounted.current) { ws.close(); return }
          clearTimeout(timeout)
          if (timedOut) { ws.close(); return }
          stopPolling() // WS is live — proxy polling no longer needed
          ws.send(JSON.stringify({ op: 'subscribe', args: [`orderbook.50.${symbol}`] }))
          pingRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ op: 'ping' }))
          }, BYBIT_PING_MS)
          setIsConnected(true)
          setMode('ws')
        }

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            if (!msg.topic?.startsWith('orderbook.')) return
            const { type, data: d } = msg
            if (!d) return
            if (type === 'snapshot') {
              localBids.current = new Map()
              localAsks.current = new Map()
              for (const [p, q] of (d.b || [])) localBids.current.set(String(p), parseFloat(q))
              for (const [p, q] of (d.a || [])) localAsks.current.set(String(p), parseFloat(q))
            } else if (type === 'delta') {
              applyLevels(d.b || [], localBids.current)
              applyLevels(d.a || [], localAsks.current)
            }
            if (mounted.current) flushBook()
          } catch { /* ignore */ }
        }

        ws.onclose = () => {
          clearTimeout(timeout)
          if (!mounted.current) return
          clearInterval(pingRef.current); pingRef.current = null
          wsRef.current = null
          setIsConnected(false)
          if (!timedOut) goSimulated()
        }

        ws.onerror = () => { clearTimeout(timeout); ws.close() }
      } catch {
        clearTimeout(timeout)
        goSimulated()
      }
    }

    // ── Tier 1: Vercel proxy REST snapshot ───────────────────────────────────
    // Polls every 3s. Simultaneously attempts Bybit WS in the background.
    // If WS connects, proxy polling stops and WS takes over.
    const startProxyPolling = () => {
      if (!mounted.current) return

      let wsStarted  = false
      let proxyWorks = false

      const poll = async () => {
        // Skip poll if live WS is already running
        if (wsRef.current?.readyState === WebSocket.OPEN) return

        try {
          const res = await fetch(
            `${PROXY_ORDERBOOK}?symbol=${symbol}&depth=${depth}`,
            { signal: AbortSignal.timeout(4000) }
          )
          if (!res.ok) throw new Error(`proxy HTTP ${res.status}`)
          const { bids: rawBids, asks: rawAsks } = await res.json()
          if (!mounted.current) return

          localBids.current = new Map()
          localAsks.current = new Map()
          for (const [p, q] of rawBids) localBids.current.set(String(p), parseFloat(q))
          for (const [p, q] of rawAsks) localAsks.current.set(String(p), parseFloat(q))
          flushBook()

          if (!proxyWorks) {
            proxyWorks = true
            setIsConnected(true)
            setMode('proxy')
          }

          if (!wsStarted) {
            wsStarted = true
            tryBybit()
          }
        } catch {
          if (!wsStarted) {
            wsStarted = true
            stopPolling()
            tryBybit()
          }
        }
      }

      poll()
      pollRef.current = setInterval(poll, OB_PROXY_POLL_MS)
    }

    startProxyPolling()

    return () => {
      mounted.current = false
      closeWS()
      stopPolling()
    }
  }, [symbol, depth]) // eslint-disable-line react-hooks/exhaustive-deps

  return { bids, asks, isConnected, mode }
}

// ─────────────────────────────────────────────────────────────────────────────
// generateSimulatedOrderBook
// Mathematical fallback — rendered when all live providers fail
// ─────────────────────────────────────────────────────────────────────────────
export function generateSimulatedOrderBook(currentPrice, depth = 8) {
  if (!currentPrice || currentPrice <= 0) return { bids: [], asks: [] }

  const spreadPct = currentPrice > 1000 ? 0.0001 : currentPrice > 10 ? 0.0005 : 0.002
  const seededRandom = (i, offset) => {
    const x = Math.sin(i * 127.1 + offset * 311.7) * 43758.5453
    return x - Math.floor(x)
  }

  const genAsks = []
  let askTotal = 0
  for (let i = 0; i < depth; i++) {
    const price = currentPrice * (1 + spreadPct * (i + 1))
    const qty   = 0.1 + seededRandom(i, 1) * 4
    askTotal   += qty
    genAsks.push({ price, qty: parseFloat(qty.toFixed(3)), total: parseFloat(askTotal.toFixed(3)) })
  }

  const genBids = []
  let bidTotal = 0
  for (let i = 0; i < depth; i++) {
    const price = currentPrice * (1 - spreadPct * (i + 1))
    const qty   = 0.1 + seededRandom(i, 2) * 4
    bidTotal   += qty
    genBids.push({ price, qty: parseFloat(qty.toFixed(3)), total: parseFloat(bidTotal.toFixed(3)) })
  }

  return { bids: genBids, asks: genAsks }
}
