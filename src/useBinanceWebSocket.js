/**
 * useBinanceWebSocket.js
 *
 * Real-time price streaming from Binance public WebSocket.
 * No API key needed — this is public market data.
 *
 * Usage:
 *   const { prices, isConnected } = useBinanceWebSocket(['BTCUSDT', 'ETHUSDT'])
 *   // prices = { BTCUSDT: { price: 98500, change: 1.23, high: 99000, low: 97000, volume: 12345 }, ... }
 */

import { useState, useEffect, useRef, useCallback } from 'react'

const WS_BASE = 'wss://stream.binance.com:9443/ws'
// For testnet: 'wss://testnet.binance.vision/ws'

const RECONNECT_DELAY_MS = 3000
const MAX_RECONNECT_ATTEMPTS = 10

export function useBinanceWebSocket(symbols = []) {
  const [prices, setPrices] = useState({})
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef(null)
  const reconnectCount = useRef(0)
  const reconnectTimer = useRef(null)
  const symbolsRef = useRef(symbols)

  // Keep symbols ref current
  useEffect(() => {
    symbolsRef.current = symbols
  }, [symbols])

  // Connect on mount / when symbols change
  useEffect(() => {
    const doConnect = () => {
      // Clean up any existing connection
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }

      if (symbols.length === 0) return

      // Build combined stream URL
      const streams = symbols.map(s => `${s.toLowerCase()}@miniTicker`).join('/')
      const url = `${WS_BASE}/${streams}`

      try {
        const ws = new WebSocket(url)
        wsRef.current = ws

        ws.onopen = () => {
          setIsConnected(true)
          reconnectCount.current = 0
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)

            if (data.e === '24hrMiniTicker') {
              const sym = data.s
              const closePrice = parseFloat(data.c)
              const openPrice = parseFloat(data.o)
              const changePercent = openPrice > 0
                ? ((closePrice - openPrice) / openPrice) * 100
                : 0

              setPrices(prev => ({
                ...prev,
                [sym]: {
                  price: closePrice,
                  change: changePercent,
                  high: parseFloat(data.h),
                  low: parseFloat(data.l),
                  volume: parseFloat(data.v),
                  quoteVolume: parseFloat(data.q),
                  lastUpdate: Date.now(),
                }
              }))
            }
          } catch {
            // Ignore malformed messages
          }
        }

        ws.onclose = (event) => {
          setIsConnected(false)
          wsRef.current = null

          // Auto-reconnect unless we explicitly closed
          if (!event.wasClean && reconnectCount.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectCount.current += 1
            const delay = RECONNECT_DELAY_MS * reconnectCount.current
            reconnectTimer.current = setTimeout(doConnect, delay)
          }
        }

        ws.onerror = () => {
          ws.close()
        }
      } catch (err) {
        console.error('WebSocket connection error:', err)
      }
    }

    doConnect()

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [symbols])

  // Build a simple price map (symbol → price number) for trading service
  const priceMap = {}
  for (const [sym, data] of Object.entries(prices)) {
    priceMap[sym] = data.price
  }

  return { prices, priceMap, isConnected }
}

/**
 * useBinanceOrderBook — real-time order book depth for a single symbol
 *
 * Usage:
 *   const { bids, asks, isConnected } = useBinanceOrderBook('BTCUSDT', 10)
 *   // bids/asks = [{ price, qty, total }, ...]
 */
export function useBinanceOrderBook(symbol, depth = 10) {
  const [bids, setBids] = useState([])
  const [asks, setAsks] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef(null)

  useEffect(() => {
    if (!symbol) return

    const stream = `${symbol.toLowerCase()}@depth${depth}@1000ms`
    const ws = new WebSocket(`${WS_BASE}/${stream}`)
    wsRef.current = ws

    ws.onopen = () => setIsConnected(true)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        // Partial book depth stream: { bids: [[price, qty], ...], asks: [[price, qty], ...] }
        if (data.bids) {
          let runningTotal = 0
          setBids(data.bids.map(([p, q]) => {
            const price = parseFloat(p)
            const qty = parseFloat(q)
            runningTotal += qty
            return { price, qty, total: runningTotal }
          }))
        }
        if (data.asks) {
          let runningTotal = 0
          setAsks(data.asks.map(([p, q]) => {
            const price = parseFloat(p)
            const qty = parseFloat(q)
            runningTotal += qty
            return { price, qty, total: runningTotal }
          }))
        }
      } catch {
        // Ignore
      }
    }

    ws.onclose = () => {
      setIsConnected(false)
      wsRef.current = null
    }

    ws.onerror = () => ws.close()

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [symbol, depth])

  return { bids, asks, isConnected }
}

/**
 * useBinanceKlines — real-time candlestick updates for TradingView
 *
 * Usage:
 *   const { candles } = useBinanceKlines('BTCUSDT', '1h')
 */
export function useBinanceKlines(symbol, interval = '1h') {
  const [candles, setCandles] = useState([])
  const wsRef = useRef(null)

  useEffect(() => {
    if (!symbol) return

    const stream = `${symbol.toLowerCase()}@kline_${interval}`
    const ws = new WebSocket(`${WS_BASE}/${stream}`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.k) {
          const k = data.k
          const candle = {
            time: Math.floor(k.t / 1000),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
            isClosed: k.x,
          }

          setCandles(prev => {
            const existing = [...prev]
            const lastIdx = existing.length - 1

            // Update last candle or add new one
            if (lastIdx >= 0 && existing[lastIdx].time === candle.time) {
              existing[lastIdx] = candle
            } else {
              existing.push(candle)
              // Keep last 500 candles
              if (existing.length > 500) existing.shift()
            }
            return existing
          })
        }
      } catch {
        // Ignore
      }
    }

    ws.onerror = () => ws.close()

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [symbol, interval])

  return { candles }
}
