/**
 * useBinanceWebSocket.js
 *
 * Binance FUTURES price feed (fstream.binance.com).
 * Falls back to Binance REST polling if WebSocket fails.
 *
 * Key URL formats for futures:
 *   Combined streams: wss://fstream.binance.com/stream?streams=s1/s2/s3
 *   Single stream:    wss://fstream.binance.com/ws/<streamName>
 *   Combined messages are wrapped: { stream: "...", data: { e, s, c, ... } }
 */

import { useState, useEffect, useRef } from 'react'

const WS_FUTURES_COMBINED = 'wss://fstream.binance.com/stream?streams='
const WS_FUTURES_SINGLE   = 'wss://fstream.binance.com/ws/'
const REST_FUTURES_TICKER = 'https://fapi.binance.com/fapi/v1/ticker/24hr'

const WS_CONNECT_TIMEOUT = 6000
const POLL_INTERVAL = 8000

// ---------------------------------------------------------------------------
// Main hook: prices for subscribed pairs
// ---------------------------------------------------------------------------
export function useBinanceWebSocket(symbols = []) {
  const [prices, setPrices] = useState({})
  const [isConnected, setIsConnected] = useState(false)
  const [mode, setMode] = useState('connecting')
  const wsRef = useRef(null)
  const pollRef = useRef(null)
  const mountedRef = useRef(true)

  // Stable string key — only reconnect when symbol list actually changes
  const symbolsKey = symbols.slice().sort().join(',')

  useEffect(() => {
    mountedRef.current = true
    if (symbols.length === 0) return

    let wsTimedOut = false
    let timeoutId = null

    // ------ Binance REST fallback (covers ALL futures pairs) ------
    const startPolling = () => {
      if (!mountedRef.current) return
      if (pollRef.current) return
      setMode('polling')
      setIsConnected(true)

      const fetchPrices = async () => {
        try {
          const res = await fetch(REST_FUTURES_TICKER)
          if (!res.ok) return
          const tickers = await res.json()
          if (!mountedRef.current) return

          const tickerMap = {}
          for (const t of tickers) {
            tickerMap[t.symbol] = t
          }

          setPrices(prev => {
            const next = { ...prev }
            for (const sym of symbols) {
              const t = tickerMap[sym]
              if (t) {
                const closePrice = parseFloat(t.lastPrice)
                const openPrice  = parseFloat(t.openPrice)
                const change = openPrice > 0
                  ? ((closePrice - openPrice) / openPrice) * 100
                  : 0
                next[sym] = {
                  price: closePrice,
                  change,
                  high:        parseFloat(t.highPrice),
                  low:         parseFloat(t.lowPrice),
                  volume:      parseFloat(t.volume),
                  quoteVolume: parseFloat(t.quoteVolume),
                  lastUpdate:  Date.now(),
                }
              }
            }
            return next
          })
        } catch (err) {
          console.error('Binance REST poll error:', err)
        }
      }

      fetchPrices()
      pollRef.current = setInterval(fetchPrices, POLL_INTERVAL)
    }

    // ------ Attempt Futures WebSocket (combined stream) ------
    const tryWebSocket = () => {
      try {
        const streamNames = symbols.map(s => `${s.toLowerCase()}@miniTicker`).join('/')
        const wsUrl = `${WS_FUTURES_COMBINED}${streamNames}`
        const ws = new WebSocket(wsUrl)
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
            const msg = JSON.parse(event.data)
            // Combined stream wraps payload: { stream: "...", data: { e, s, c, ... } }
            const ticker = msg.data || msg
            if (ticker.e === '24hrMiniTicker') {
              const sym        = ticker.s
              const closePrice = parseFloat(ticker.c)
              const openPrice  = parseFloat(ticker.o)
              const change     = openPrice > 0
                ? ((closePrice - openPrice) / openPrice) * 100
                : 0
              setPrices(prev => ({
                ...prev,
                [sym]: {
                  price:       closePrice,
                  change,
                  high:        parseFloat(ticker.h),
                  low:         parseFloat(ticker.l),
                  volume:      parseFloat(ticker.v),
                  quoteVolume: parseFloat(ticker.q),
                  lastUpdate:  Date.now(),
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
  }, [symbolsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const priceMap = {}
  for (const [sym, data] of Object.entries(prices)) {
    priceMap[sym] = data.price
  }

  return { prices, priceMap, isConnected, mode }
}

// ---------------------------------------------------------------------------
// Order book — futures single stream, falls back to simulated
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
      // Single stream — /ws/ path is correct for futures single streams
      const stream = `${symbol.toLowerCase()}@depth${depth}@500ms`
      const ws = new WebSocket(`${WS_FUTURES_SINGLE}${stream}`)
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
              const qty   = parseFloat(q)
              total += qty
              return { price, qty, total }
            }))
          }
          if (data.asks) {
            let total = 0
            setAsks(data.asks.map(([p, q]) => {
              const price = parseFloat(p)
              const qty   = parseFloat(q)
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
    const qty   = 0.1 + seededRandom(i, 1) * 4
    askTotal += qty
    genAsks.push({ price, qty: parseFloat(qty.toFixed(3)), total: parseFloat(askTotal.toFixed(3)) })
  }

  const genBids = []
  let bidTotal = 0
  for (let i = 0; i < depth; i++) {
    const price = currentPrice * (1 - spreadPct * (i + 1))
    const qty   = 0.1 + seededRandom(i, 2) * 4
    bidTotal += qty
    genBids.push({ price, qty: parseFloat(qty.toFixed(3)), total: parseFloat(bidTotal.toFixed(3)) })
  }

  return { bids: genBids, asks: genAsks }
}
