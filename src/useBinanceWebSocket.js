/**
 * useBinanceWebSocket.js
 *
 * Hybrid price feed: tries Binance WebSocket first, falls back to
 * CoinGecko REST polling if WS fails (e.g. region blocks, CORS).
 *
 * The TradingView chart handles its own data — this hook is
 * only for the order book, order entry, and position PNL.
 */

import { useState, useEffect, useRef } from 'react'

// ---------------------------------------------------------------------------
// CoinGecko symbol → id mapping
// ---------------------------------------------------------------------------
const COINGECKO_MAP = {
  BTCUSDT: 'bitcoin',
  ETHUSDT: 'ethereum',
  SOLUSDT: 'solana',
  BNBUSDT: 'binancecoin',
  XRPUSDT: 'ripple',
  ADAUSDT: 'cardano',
  DOGEUSDT: 'dogecoin',
  AVAXUSDT: 'avalanche-2',
  DOTUSDT: 'polkadot',
  MATICUSDT: 'polygon-ecosystem-token',
  LINKUSDT: 'chainlink',
  UNIUSDT: 'uniswap',
  ATOMUSDT: 'cosmos',
  LTCUSDT: 'litecoin',
  NEARUSDT: 'near',
  APTUSDT: 'aptos',
  ARBUSDT: 'arbitrum',
  OPUSDT: 'optimism',
  BCHUSDT: 'bitcoin-cash',
}

const WS_BASE = 'wss://fstream.binance.com/ws'
const WS_CONNECT_TIMEOUT = 5000
const POLL_INTERVAL = 10000

// ---------------------------------------------------------------------------
// Main hook: prices for all trading pairs
// ---------------------------------------------------------------------------
export function useBinanceWebSocket(symbols = []) {
  const [prices, setPrices] = useState({})
  const [isConnected, setIsConnected] = useState(false)
  const [mode, setMode] = useState('connecting')
  const wsRef = useRef(null)
  const pollRef = useRef(null)
  const mountedRef = useRef(true)
  const symbolsKey = symbols.slice().sort().join(',')

  useEffect(() => {
    mountedRef.current = true
    if (symbols.length === 0) return

    let wsTimedOut = false
    let timeoutId = null

    // ------ CoinGecko polling fallback ------
    const startPolling = () => {
      if (!mountedRef.current) return
      // Don't start twice
      if (pollRef.current) return
      setMode('polling')
      setIsConnected(true)

      const fetchPrices = async () => {
        try {
          const ids = symbols
            .map(s => COINGECKO_MAP[s])
            .filter(Boolean)
          // Deduplicate
          const uniqueIds = [...new Set(ids)].join(',')
          if (!uniqueIds) return

          const res = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${uniqueIds}&vs_currencies=usd&include_24hr_change=true`
          )
          if (!res.ok) return
          const data = await res.json()
          if (!mountedRef.current) return

          setPrices(prev => {
            const next = { ...prev }
            for (const sym of symbols) {
              const geckoId = COINGECKO_MAP[sym]
              const coin = geckoId && data[geckoId]
              if (coin) {
                next[sym] = {
                  price: coin.usd || 0,
                  change: coin.usd_24h_change || 0,
                  high: 0,
                  low: 0,
                  volume: 0,
                  quoteVolume: 0,
                  lastUpdate: Date.now(),
                }
              }
            }
            return next
          })
        } catch (err) {
          console.error('CoinGecko poll error:', err)
        }
      }

      fetchPrices()
      pollRef.current = setInterval(fetchPrices, POLL_INTERVAL)
    }

    // ------ Attempt WebSocket ------
    const tryWebSocket = () => {
      try {
        const streams = symbols.map(s => `${s.toLowerCase()}@miniTicker`).join('/')
        const ws = new WebSocket(`${WS_BASE}/${streams}`)
        wsRef.current = ws

        timeoutId = setTimeout(() => {
          wsTimedOut = true
          if (ws.readyState !== WebSocket.OPEN) {
            ws.close()
            startPolling()
          }
        }, WS_CONNECT_TIMEOUT)

        ws.onopen = () => {
          if (!mountedRef.current) return
          clearTimeout(timeoutId)
          if (wsTimedOut) { ws.close(); return }
          setIsConnected(true)
          setMode('ws')
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.e === '24hrMiniTicker') {
              const sym = data.s
              const closePrice = parseFloat(data.c)
              const openPrice = parseFloat(data.o)
              const change = openPrice > 0
                ? ((closePrice - openPrice) / openPrice) * 100
                : 0
              setPrices(prev => ({
                ...prev,
                [sym]: {
                  price: closePrice,
                  change,
                  high: parseFloat(data.h),
                  low: parseFloat(data.l),
                  volume: parseFloat(data.v),
                  quoteVolume: parseFloat(data.q),
                  lastUpdate: Date.now(),
                }
              }))
            }
          } catch { /* ignore */ }
        }

        ws.onclose = () => {
          if (!mountedRef.current) return
          setIsConnected(false)
          wsRef.current = null
          if (!wsTimedOut) startPolling()
        }

        ws.onerror = () => { ws.close() }
      } catch {
        startPolling()
      }
    }

    tryWebSocket()

    return () => {
      mountedRef.current = false
      clearTimeout(timeoutId)
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  }, [symbolsKey])

  const priceMap = {}
  for (const [sym, data] of Object.entries(prices)) {
    priceMap[sym] = data.price
  }

  return { prices, priceMap, isConnected, mode }
}

// ---------------------------------------------------------------------------
// Order book — tries WS, falls back to simulated
// ---------------------------------------------------------------------------
export function useBinanceOrderBook(symbol, depth = 10) {
  const [bids, setBids] = useState([])
  const [asks, setAsks] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [mode, setMode] = useState('connecting')
  const wsRef = useRef(null)

  useEffect(() => {
    if (!symbol) return
    let mounted = true
    let wsTimedOut = false

    const timeoutId = setTimeout(() => {
      wsTimedOut = true
      if (wsRef.current && wsRef.current.readyState !== WebSocket.OPEN) {
        wsRef.current.close()
      }
      if (mounted) setMode('simulated')
    }, WS_CONNECT_TIMEOUT)

    try {
      const stream = `${symbol.toLowerCase()}@depth${depth}@1000ms`
      const ws = new WebSocket(`${WS_BASE}/${stream}`)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mounted) return
        clearTimeout(timeoutId)
        if (wsTimedOut) { ws.close(); return }
        setIsConnected(true)
        setMode('ws')
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.bids) {
            let total = 0
            setBids(data.bids.map(([p, q]) => {
              const price = parseFloat(p)
              const qty = parseFloat(q)
              total += qty
              return { price, qty, total }
            }))
          }
          if (data.asks) {
            let total = 0
            setAsks(data.asks.map(([p, q]) => {
              const price = parseFloat(p)
              const qty = parseFloat(q)
              total += qty
              return { price, qty, total }
            }))
          }
        } catch { /* ignore */ }
      }

      ws.onclose = () => {
        if (!mounted) return
        setIsConnected(false)
        setMode('simulated')
        wsRef.current = null
      }

      ws.onerror = () => { ws.close() }
    } catch {
      // Defer setState out of the synchronous effect body
      setTimeout(() => { if (mounted) setMode('simulated') }, 0)
    }

    return () => {
      mounted = false
      clearTimeout(timeoutId)
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
    }
  }, [symbol, depth])

  return { bids, asks, isConnected, mode }
}

/**
 * generateSimulatedOrderBook
 * Creates realistic bids/asks around a live price.
 * Call from MarketsPage when OB mode === 'simulated'.
 */
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
    const qty = 0.1 + seededRandom(i, 1) * 4
    askTotal += qty
    genAsks.push({ price, qty: parseFloat(qty.toFixed(3)), total: parseFloat(askTotal.toFixed(3)) })
  }

  const genBids = []
  let bidTotal = 0
  for (let i = 0; i < depth; i++) {
    const price = currentPrice * (1 - spreadPct * (i + 1))
    const qty = 0.1 + seededRandom(i, 2) * 4
    bidTotal += qty
    genBids.push({ price, qty: parseFloat(qty.toFixed(3)), total: parseFloat(bidTotal.toFixed(3)) })
  }

  return { bids: genBids, asks: genAsks }
}
