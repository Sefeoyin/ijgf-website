/**
 * useBinanceWebSocket.js
 *
 * ARCHITECTURE — price feed:
 *
 *   The Vercel proxy (/api/prices) is the PERMANENT backbone.
 *   It runs on Vercel US servers → calls Binance server-side → no ISP geo-block.
 *   It starts immediately and NEVER stops on its own.
 *
 *   WebSockets (MEXC → Bybit) are OPTIONAL upgrades for lower latency.
 *   When a WS connects successfully it pauses the proxy poll.
 *   If that WS later disconnects, the proxy poll restarts immediately.
 *   Prices NEVER go dark — users always see live data.
 *
 *   CoinGecko REST is the absolute last resort (rate-limited, 50-coin coverage).
 *
 * Price feed cascade:
 *   1. /api/prices  — Vercel proxy, permanent backbone, 3 s poll
 *   2. MEXC WS      — direct, not on Nigeria NCC block list, pauses proxy when live
 *   3. Bybit WS     — direct fallback, pauses proxy when live
 *   4. CoinGecko    — last resort, proxy tried first before falling here
 *
 * Order book cascade:
 *   1. /api/orderbook — Vercel proxy REST snapshot, 3 s poll
 *   2. Bybit orderbook.50 WebSocket
 *   3. Simulated — mathematical fallback, always works
 */

import { useState, useEffect, useRef } from 'react'

// ── Proxy endpoints (relative URLs — same Vercel domain, no CORS, no geo-block) ─
const PROXY_PRICES    = '/api/prices'
const PROXY_ORDERBOOK = '/api/orderbook'

// ── Direct WebSocket endpoints ────────────────────────────────────────────────
const MEXC_WS  = 'wss://contract.mexc.com/edge'
const BYBIT_WS = 'wss://stream.bybit.com/v5/public/linear'

// ── Timing ────────────────────────────────────────────────────────────────────
const PROXY_POLL_MS    = 3000   // proxy poll interval
const WS_TIMEOUT_MS    = 4000   // time to wait for WS to open before giving up
const MEXC_PING_MS     = 15000
const BYBIT_PING_MS    = 20000
const CG_POLL_MS       = 10000
const OB_PROXY_POLL_MS = 3000

// ── Symbol helpers ────────────────────────────────────────────────────────────
const toMEXC      = (s) => s.replace('USDT', '_USDT')
const fromMEXC    = (s) => s.replace('_USDT', 'USDT')
const BYBIT_BATCH = 10

// ── CoinGecko ID map (last resort — ~80 major coins) ─────────────────────────
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

  const wsRef   = useRef(null)
  const pingRef = useRef(null)
  const pollRef = useRef(null)
  const mounted = useRef(true)

  const symbolsKey = symbols.slice().sort().join(',')

  useEffect(() => {
    mounted.current = true
    if (symbols.length === 0) return

    // Close any active WebSocket
    const closeWS = () => {
      if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null }
      if (wsRef.current) {
        try { wsRef.current.close() } catch { /* ignore */ }
        wsRef.current = null
      }
    }

    // Stop the proxy / CoinGecko poll — ONLY called when a live WS is confirmed open
    const stopPolling = () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }

    // ── Proxy poll (permanent backbone) ──────────────────────────────────────
    // Calls /api/prices every 3 s. Runs on Vercel US servers → calls Binance
    // server-side → completely bypasses Nigerian ISP geo-blocks.
    // Started at mount and restarted any time a WS dies.
    const startProxyPoll = () => {
      if (!mounted.current || pollRef.current) return // already running

      const poll = async () => {
        // If a live WebSocket is open, skip — WS is providing prices already
        if (wsRef.current?.readyState === WebSocket.OPEN) return
        try {
          const res = await fetch(
            `${PROXY_PRICES}?symbols=${symbols.join(',')}`,
            { signal: AbortSignal.timeout(8000) }
          )
          if (!res.ok) throw new Error(`proxy ${res.status}`)
          const { prices: data } = await res.json()
          if (!mounted.current) return
          setIsConnected(true)
          // Don't overwrite 'ws' mode if a WS just connected while fetch was in-flight
          setMode(prev => prev === 'ws' ? 'ws' : 'proxy')
          setPrices(prev => {
            const next = { ...prev }
            for (const [sym, p] of Object.entries(data)) {
              next[sym] = { ...p, lastUpdate: Date.now() }
            }
            return next
          })
        } catch { /* cold-start or transient — retry next tick */ }
      }

      poll() // fire immediately
      pollRef.current = setInterval(poll, PROXY_POLL_MS)
    }

    // ── Tier 4: CoinGecko REST ────────────────────────────────────────────────
    // True last resort — rate-limited, covers ~80 coins only.
    // We always try restarting the proxy first before falling here.
    const startCoinGecko = () => {
      if (!mounted.current) return
      // Proxy is more reliable — restart it. If it's already running, this is a no-op.
      startProxyPoll()
      if (pollRef.current) return // proxy is polling, CoinGecko not needed

      setMode('polling')
      setIsConnected(true)

      const poll = async () => {
        try {
          const ids = [...new Set(symbols.map(s => COINGECKO_MAP[s]).filter(Boolean))].join(',')
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
        } catch { /* rate-limited or blocked — retry next tick */ }
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
          // Bybit timed out — proxy is still polling, no action needed
          // (proxy was never stopped since WS never opened)
        }
      }, WS_TIMEOUT_MS)

      try {
        const ws = new WebSocket(BYBIT_WS)
        wsRef.current = ws

        ws.onopen = () => {
          if (!mounted.current) { ws.close(); return }
          clearTimeout(timeout)
          if (timedOut) { ws.close(); return }
          // WS is live — pause the proxy poll to save bandwidth
          stopPolling()
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
          setMode('proxy')
          // WS died — immediately restart proxy so prices never go dark
          startProxyPoll()
        }

        ws.onerror = () => { clearTimeout(timeout); ws.close() }
      } catch {
        clearTimeout(timeout)
        // WS failed to construct — proxy is still running, nothing to do
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
          // WS is live — pause the proxy poll to save bandwidth
          stopPolling()
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
          if (didOpen) {
            // MEXC was working then died — restart proxy immediately, try Bybit next
            setMode('proxy')
            startProxyPoll()
            tryBybit()
          } else if (!timedOut) {
            // Closed before opening and before timeout — unusual, try Bybit
            tryBybit()
          }
          // If timedOut and never opened: timeout handler already called tryBybit()
        }

        ws.onerror = () => { clearTimeout(timeout); ws.close() }
      } catch {
        clearTimeout(timeout)
        tryBybit()
      }
    }

    // ── Start: proxy first, then attempt WS upgrade ───────────────────────────
    // Proxy starts immediately. First successful proxy response triggers one
    // WS upgrade attempt. This way users get prices within 3 s even on cold
    // Vercel starts, and get lower-latency WS if available.
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
          setIsConnected(true)
          setMode(prev => prev === 'ws' ? 'ws' : 'proxy')
          setPrices(prev => {
            const next = { ...prev }
            for (const [sym, p] of Object.entries(data)) {
              next[sym] = { ...p, lastUpdate: Date.now() }
            }
            return next
          })
          // Once proxy confirms network is reachable, attempt WS upgrade once
          if (!wsUpgradeStarted) {
            wsUpgradeStarted = true
            tryMEXC()
          }
        } catch {
          // Proxy cold-start or transient — keep retrying.
          // Also try WS in parallel (it may work even if proxy is warming up)
          if (!wsUpgradeStarted) {
            wsUpgradeStarted = true
            tryMEXC()
          }
        }
      }

      poll()
      pollRef.current = setInterval(poll, PROXY_POLL_MS)
    }

    startWithProxyThenWS()

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

    // Fall back to simulated order book (mathematical, always works)
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
    // Polls every 3 s. Runs server-side on Vercel — no geo-block.
    // Simultaneously tries Bybit WS in the background.
    // If WS connects it stops the poll. If WS dies, simulated takes over.
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
          // Cold-start or transient — keep retrying
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
