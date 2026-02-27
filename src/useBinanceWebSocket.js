/**
 * useBinanceWebSocket.js
 *
 * Price feed using Binance SPOT WebSocket (stream.binance.com).
 * Spot WS is accessible globally. Futures WS (fstream) is geo-blocked
 * in many regions so we avoid it.
 *
 * For futures-only tokens not on spot (PEPE, SHIB etc), CoinGecko
 * REST polling fills the gap automatically via the fallback path.
 *
 * Correct combined stream URL (spot):
 *   wss://stream.binance.com:9443/stream?streams=btcusdt@miniTicker/ethusdt@miniTicker
 * Combined messages are WRAPPED: { stream: "...", data: { e, s, c, ... } }
 */

import { useState, useEffect, useRef } from 'react'

// Spot combined stream endpoint
const WS_SPOT_COMBINED = 'wss://stream.binance.com:9443/stream?streams='
const WS_SPOT_SINGLE   = 'wss://stream.binance.com:9443/ws/'

// Comprehensive CoinGecko map — covers futures-only tokens not on spot
const COINGECKO_MAP = {
  BTCUSDT:     'bitcoin',
  ETHUSDT:     'ethereum',
  BNBUSDT:     'binancecoin',
  SOLUSDT:     'solana',
  XRPUSDT:     'ripple',
  ADAUSDT:     'cardano',
  DOGEUSDT:    'dogecoin',
  AVAXUSDT:    'avalanche-2',
  DOTUSDT:     'polkadot',
  MATICUSDT:   'matic-network',
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
  // Additional tokens
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
  AGIXUSDT:    'singularitynet',
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
  ENJUSDT:     'enjin-coin',
  CHRUSDT:     'chromia',
  ALICEUSDT:   'my-neighbor-alice',
  CTSIUSDT:    'cartesi',
  REEFUSDT:    'reef',
  SUPERUSDT:   'superfarm',
  WAVESUSDT:   'waves',
  ZENUSDT:     'horizen',
  DGBUSDT:     'digibyte',
  CVCUSDT:     'civic',
}

const WS_CONNECT_TIMEOUT = 6000
const POLL_INTERVAL = 10000

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

    // ------ CoinGecko polling fallback ------
    const startPolling = () => {
      if (!mountedRef.current) return
      if (pollRef.current) return
      setMode('polling')
      setIsConnected(true)

      const fetchPrices = async () => {
        try {
          const ids = [...new Set(
            symbols.map(s => COINGECKO_MAP[s]).filter(Boolean)
          )].join(',')
          if (!ids) return

          const res = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
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
        } catch (err) {
          console.error('CoinGecko poll error:', err)
        }
      }

      fetchPrices()
      pollRef.current = setInterval(fetchPrices, POLL_INTERVAL)
    }

    // ------ Attempt Spot WebSocket (combined stream) ------
    const tryWebSocket = () => {
      try {
        // Correct combined stream URL:
        // wss://stream.binance.com:9443/stream?streams=btcusdt@miniTicker/ethusdt@miniTicker
        const streamNames = symbols.map(s => `${s.toLowerCase()}@miniTicker`).join('/')
        const wsUrl = `${WS_SPOT_COMBINED}${streamNames}`
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
            // Combined streams wrap payload: { stream: "...", data: { e, s, c, ... } }
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
// Order book — spot single stream, falls back to simulated
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
      const ws = new WebSocket(`${WS_SPOT_SINGLE}${stream}`)
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
