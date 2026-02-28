/**
 * /api/prices.js — Vercel serverless function
 *
 * Proxies price data from MEXC Futures REST API.
 * Called by the frontend as: GET /api/prices?symbols=BTCUSDT,ETHUSDT,SOLUSDT
 *
 * Because this runs on Vercel (same domain as the frontend), ISP-level
 * blocks on exchange domains do not affect it.
 *
 * Falls back to Bybit if MEXC fails.
 */

const MEXC_TICKERS  = 'https://contract.mexc.com/api/v1/contract/ticker'
const BYBIT_TICKERS = 'https://api.bybit.com/v5/market/tickers?category=linear'

// BTCUSDT → BTC_USDT
const toMEXC   = (s) => s.replace('USDT', '_USDT')
// BTC_USDT → BTCUSDT
const fromMEXC = (s) => s.replace('_USDT', 'USDT')

export default async function handler(req, res) {
  // CORS — allow requests from the frontend
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Cache-Control', 's-maxage=2, stale-while-revalidate=5')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { symbols } = req.query
  if (!symbols) return res.status(400).json({ error: 'symbols query param required' })

  const requested = symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
  const requestedSet = new Set(requested)

  // ── Try MEXC first ────────────────────────────────────────────────────────
  try {
    const mexcRes = await fetch(MEXC_TICKERS, {
      headers: { 'User-Agent': 'IJGF/1.0' },
      signal:  AbortSignal.timeout(5000),
    })

    if (!mexcRes.ok) throw new Error(`MEXC HTTP ${mexcRes.status}`)

    const { data } = await mexcRes.json()
    if (!Array.isArray(data)) throw new Error('MEXC unexpected response shape')

    const prices = {}
    for (const t of data) {
      const sym = fromMEXC(t.symbol)
      if (!requestedSet.has(sym)) continue
      prices[sym] = {
        price:       parseFloat(t.lastPrice)     || 0,
        change:      (parseFloat(t.riseFallRate) || 0) * 100,
        high:        parseFloat(t.high24Price)   || 0,
        low:         parseFloat(t.low24Price)    || 0,
        volume:      parseFloat(t.volume24)      || 0,
        quoteVolume: parseFloat(t.amount24)      || 0,
      }
    }

    return res.status(200).json({ source: 'mexc', prices })
  } catch (mexcErr) {
    console.warn('[/api/prices] MEXC failed:', mexcErr.message)
  }

  // ── Fallback: Bybit ───────────────────────────────────────────────────────
  try {
    const bybitRes = await fetch(BYBIT_TICKERS, {
      headers: { 'User-Agent': 'IJGF/1.0' },
      signal:  AbortSignal.timeout(5000),
    })

    if (!bybitRes.ok) throw new Error(`Bybit HTTP ${bybitRes.status}`)

    const { result } = await bybitRes.json()
    const list = result?.list || []

    const prices = {}
    for (const t of list) {
      if (!requestedSet.has(t.symbol)) continue
      prices[t.symbol] = {
        price:       parseFloat(t.lastPrice)      || 0,
        change:      (parseFloat(t.price24hPcnt)  || 0) * 100,
        high:        parseFloat(t.highPrice24h)   || 0,
        low:         parseFloat(t.lowPrice24h)    || 0,
        volume:      parseFloat(t.volume24h)      || 0,
        quoteVolume: parseFloat(t.turnover24h)    || 0,
      }
    }

    return res.status(200).json({ source: 'bybit', prices })
  } catch (bybitErr) {
    console.warn('[/api/prices] Bybit failed:', bybitErr.message)
  }

  return res.status(502).json({ error: 'All upstream price sources unavailable' })
}
