/**
 * useBinanceWebSocket.js
 *
 * ARCHITECTURE — price feed cascade:
 *
 *   1. /api/prices  — Vercel proxy PERMANENT backbone, 3s poll.
 *                     Runs on Vercel US servers → Bybit → OKX → Binance.
 *                     Zero geo-blocking risk. Starts immediately.
 *
 *   2. Bybit WS     — Optional browser-direct upgrade for lower latency.
 *                     Pauses proxy poll when live. Proxy restarts on disconnect.
 *
 *   3. CoinGecko    — Browser-direct last resort. 10s poll, ~80 coins.
 *                     Runs passively in parallel. Only writes prices that the
 *                     proxy has not refreshed in the last 12 seconds.
 *                     Not geo-blocked in Nigeria.
 *
 * Order book cascade:
 *   1. /api/orderbook — Vercel proxy REST snapshot (Bybit → OKX → Binance), 3s poll
 *   2. Bybit orderbook.50 WebSocket — direct optional upgrade
 *   3. Simulated — mathematical fallback, always works
 */

import { useState, useEffect, useRef } from 'react'

// ── Proxy endpoints ───────────────────────────────────────────────────────────
const PROXY_PRICES    = '/api/prices'
const PROXY_ORDERBOOK = '/api/orderbook'

// ── Direct WebSocket endpoint ─────────────────────────────────────────────────
const BYBIT_WS = 'wss://stream.bybit.com/v5/public/linear'

// ── Timing ────────────────────────────────────────────────────────────────────
const PROXY_POLL_MS    = 3000
const WS_TIMEOUT_MS    = 4000
const BYBIT_PING_MS    = 20000
const CG_POLL_MS       = 10000   // CoinGecko is rate-limited — keep this generous
const CG_STALE_MS      = 12000   // Only use CoinGecko if proxy data is older than this
const OB_PROXY_POLL_MS = 3000

// ── WS subscription batch size ───────────────────────────────────────────────
const BYBIT_BATCH = 10

// ── CoinGecko ID map (browser last-resort — ~80 major coins) ─────────────────
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
// useBinanceWebSocket — price feed
// ─────────────────────────────────────────────────────────────────────────────
export function useBinanceWebSocket(symbols = []) {
  const [prices, setPrices]           = useState({})
  const [isConnected, setIsConnected] = useState(false)
  const [mode, setMode]               = useState('connecting')

  const wsRef    = useRef(null)
  const pingRef  = useRef(null)
  const pollRef  = useRef(null)
  const cgRef    = useRef(null)   // CoinGecko fallback interval
  const mounted  = useRef(true)
  // Track last-update timestamps per symbol so CoinGecko doesn't overwrite
  // fresh proxy data. Stored as { BTCUSDT: timestampMs, ... }
  const lastProxyUpdate = useRef({})

  const symbolsKey = symbols.slice().sort().join(',')

  useEffect(() => {
    mounted.current = true
    if (symbols.length === 0) return

    // ── Helpers ──────────────────────────────────────────────────────────────

    const closeWS = () => {
      if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null }
      if (wsRef.current) {
        try { wsRef.current.close() } catch { /* ignore */ }
        wsRef.current = null
      }
    }

    // Only called when a live WS is confirmed open — pauses bandwidth usage
    const stopProxyPoll = () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }

    const stopCoinGecko = () => {
      if (cgRef.current) { clearInterval(cgRef.current); cgRef.current = null }
    }

    // ── Tier 3: CoinGecko browser-direct fallback ─────────────────────────────
    // Runs in the background at all times. Only writes prices for symbols
    // where the proxy/WS has not provided a fresh price in the last CG_STALE_MS.
    // CoinGecko is not blocked by Nigerian ISPs — it is a data service, not an
    // exchange. Rate limit: 10-30 req/min on the free tier.
    const startCoinGecko = () => {
      if (!mounted.current || cgRef.current) return  // already running

      const poll = async () => {
        if (!mounted.current) return

        // Determine which symbols need CoinGecko (proxy data is stale or missing)
        const now   = Date.now()
        const stale = symbols.filter(s => {
          const last = lastProxyUpdate.current[s]
          return !last || (now - last) > CG_STALE_MS
        })
        if (stale.length === 0) return  // proxy is healthy — nothing to do

        const cgIds = [...new Set(stale.map(s => COINGECKO_MAP[s]).filter(Boolean))]
        if (cgIds.length === 0) return

        try {
          const res = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${cgIds.join(',')}&vs_currencies=usd&include_24hr_change=true`,
            { signal: AbortSignal.timeout(10000) }
          )
          if (!res.ok || !mounted.current) return
          const data = await res.json()

          setPrices(prev => {
            const next = { ...prev }
            for (const sym of stale) {
              const coin = data[COINGECKO_MAP[sym]]
              if (!coin) continue
              // Double-check: if proxy updated while we were fetching, skip
              const proxyTs = lastProxyUpdate.current[sym]
              if (proxyTs && (Date.now() - proxyTs) <= CG_STALE_MS) continue
              next[sym] = {
                price:       coin.usd              || 0,
                change:      coin.usd_24h_change   || 0,
                high:        0,
                low:         0,
                volume:      0,
                quoteVolume: 0,
                lastUpdate:  Date.now(),
              }
            }
            return next
          })

          if (!isConnected) {
            setIsConnected(true)
            setMode(prev => prev === 'ws' || prev === 'proxy' ? prev : 'coingecko')
          }
        } catch { /* rate-limited or transient — retry next tick */ }
      }

      poll()
      cgRef.current = setInterval(poll, CG_POLL_MS)
    }

    // ── Tier 2: Bybit Linear WebSocket ───────────────────────────────────────
    // Optional upgrade. If it opens, proxy is paused. If it dies, proxy restarts.
    const tryBybit = () => {
      if (!mounted.current) return
      closeWS()

      let timedOut = false
      const timeout = setTimeout(() => {
        timedOut = true
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          closeWS()
          // Timed out — proxy is still polling, nothing else needed
        }
      }, WS_TIMEOUT_MS)

      try {
        const ws = new WebSocket(BYBIT_WS)
        wsRef.current = ws

        ws.onopen = () => {
          if (!mounted.current) { ws.close(); return }
          clearTimeout(timeout)
          if (timedOut) { ws.close(); return }
          // WS is live — pause proxy to save bandwidth
          stopProxyPoll()
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
            const now = Date.now()
            lastProxyUpdate.current[d.symbol] = now  // WS counts as "fresh"
            setPrices(prev => ({
              ...prev,
              [d.symbol]: {
                price:       parseFloat(d.lastPrice)     || 0,
                change:      (parseFloat(d.price24hPcnt) || 0) * 100,
                high:        parseFloat(d.highPrice24h)  || 0,
                low:         parseFloat(d.lowPrice24h)   || 0,
                volume:      parseFloat(d.volume24h)     || 0,
                quoteVolume: parseFloat(d.turnover24h)   || 0,
                lastUpdate:  now,
              },
            }))
          } catch { /* ignore malformed message */ }
        }

        ws.onclose = () => {
          clearTimeout(timeout)
          if (!mounted.current) return
          clearInterval(pingRef.current); pingRef.current = null
          wsRef.current = null
          setIsConnected(false)
          setMode('proxy')
          // WS died — restart proxy immediately so prices never go dark
          startProxyPoll() // eslint-disable-line no-use-before-define
        }

        ws.onerror = () => { clearTimeout(timeout); ws.close() }
      } catch {
        clearTimeout(timeout)
        // WS failed to construct — proxy is still running
      }
    }

    // ── Tier 1: Vercel proxy (permanent backbone) ─────────────────────────────
    // Polls /api/prices every 3s. Runs on Vercel US → Bybit → OKX → Binance.
    // Completely bypasses ISP geo-blocks. Restarts whenever a WS dies.
    const startProxyPoll = () => {
      if (!mounted.current || pollRef.current) return  // already running

      const poll = async () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return  // WS is covering us
        try {
          const res = await fetch(
            `${PROXY_PRICES}?symbols=${symbols.join(',')}`,
            { signal: AbortSignal.timeout(8000) }
          )
          if (!res.ok) throw new Error(`proxy ${res.status}`)
          const { prices: data } = await res.json()
          if (!mounted.current) return

          const now = Date.now()
          setIsConnected(true)
          setMode(prev => prev === 'ws' ? 'ws' : 'proxy')
          setPrices(prev => {
            const next = { ...prev }
            for (const [sym, p] of Object.entries(data)) {
              next[sym]                     = { ...p, lastUpdate: now }
              lastProxyUpdate.current[sym]  = now
            }
            return next
          })
        } catch { /* cold-start or transient — retry next tick */ }
      }

      poll()
      pollRef.current = setInterval(poll, PROXY_POLL_MS)
    }

    // ── Bootstrap ─────────────────────────────────────────────────────────────
    // 1. Start proxy immediately — users get prices within 3s even on cold start.
    // 2. Start CoinGecko in parallel — silent background fallback.
    // 3. After first successful proxy response, attempt Bybit WS upgrade once.
    let wsUpgradeStarted = false

    const startWithProxyThenWS = () => {
      const poll = async () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return
        try {
          const res = await fetch(
            `${PROXY_PRICES}?symbols=${symbols.join(',')}`,
            { signal: AbortSignal.timeout(8000) }
          )
          if (!res.ok) throw new Error(`proxy ${res.status}`)
          const { prices: data } = await res.json()
          if (!mounted.current) return

          const now = Date.now()
          setIsConnected(true)
          setMode(prev => prev === 'ws' ? 'ws' : 'proxy')
          setPrices(prev => {
            const next = { ...prev }
            for (const [sym, p] of Object.entries(data)) {
              next[sym]                    = { ...p, lastUpdate: now }
              lastProxyUpdate.current[sym] = now
            }
            return next
          })

          // Attempt Bybit WS upgrade once proxy confirms connectivity
          if (!wsUpgradeStarted) {
            wsUpgradeStarted = true
            tryBybit()
          }
        } catch {
          // Proxy cold-start or failing — also try WS in parallel
          if (!wsUpgradeStarted) {
            wsUpgradeStarted = true
            tryBybit()
          }
        }
      }

      poll()
      pollRef.current = setInterval(poll, PROXY_POLL_MS)
    }

    startWithProxyThenWS()
    startCoinGecko()  // runs passively in background, fills gaps only

    return () => {
      mounted.current = false
      closeWS()
      stopProxyPoll()
      stopCoinGecko()
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
          stopPolling()
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
    // Polls every 3s. Runs server-side — no geo-block.
    // Simultaneously tries Bybit WS in the background.
    const startProxyPolling = () => {
      if (!mounted.current) return

      let wsStarted  = false
      let proxyWorks = false

      const poll = async () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return
        try {
          const res = await fetch(
            `${PROXY_ORDERBOOK}?symbol=${symbol}&depth=${depth}`,
            { signal: AbortSignal.timeout(8000) }
          )
          if (!res.ok) throw new Error(`proxy ${res.status}`)
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
