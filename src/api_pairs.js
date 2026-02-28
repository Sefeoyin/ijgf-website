/**
 * /api/pairs.js — Vercel serverless function
 *
 * Returns all USDT perpetual futures pairs sorted by 24h quote volume.
 * Called by the frontend as: GET /api/pairs
 *
 * Tries MEXC first, falls back to Bybit.
 * Both return symbol + price + change, which replaces the Binance snapshot.
 */

const MEXC_TICKERS  = 'https://contract.mexc.com/api/v1/contract/ticker'
const BYBIT_TICKERS = 'https://api.bybit.com/v5/market/tickers?category=linear'

const fromMEXC = (s) => s.replace('_USDT', 'USDT')

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  // ── Try MEXC first ────────────────────────────────────────────────────────
  try {
    const mexcRes = await fetch(MEXC_TICKERS, {
      headers: { 'User-Agent': 'IJGF/1.0' },
      signal:  AbortSignal.timeout(5000),
    })
    if (!mexcRes.ok) throw new Error(`MEXC HTTP ${mexcRes.status}`)
    const { data } = await mexcRes.json()
    if (!Array.isArray(data)) throw new Error('MEXC unexpected shape')

    const pairs = []
    const prices = {}

    data
      .filter(t => t.symbol.endsWith('_USDT'))
      .sort((a, b) => parseFloat(b.amount24) - parseFloat(a.amount24))
      .forEach(t => {
        const sym = fromMEXC(t.symbol)
        pairs.push(sym)
        prices[sym] = {
          price:  parseFloat(t.lastPrice) || 0,
          change: (parseFloat(t.riseFallRate) || 0) * 100,
        }
      })

    return res.status(200).json({ source: 'mexc', pairs, prices })
  } catch (mexcErr) {
    console.warn('[/api/pairs] MEXC failed:', mexcErr.message)
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

    const pairs = []
    const prices = {}

    list
      .filter(t => t.symbol.endsWith('USDT'))
      .sort((a, b) => parseFloat(b.turnover24h) - parseFloat(a.turnover24h))
      .forEach(t => {
        pairs.push(t.symbol)
        prices[t.symbol] = {
          price:  parseFloat(t.lastPrice) || 0,
          change: (parseFloat(t.price24hPcnt) || 0) * 100,
        }
      })

    return res.status(200).json({ source: 'bybit', pairs, prices })
  } catch (bybitErr) {
    console.warn('[/api/pairs] Bybit failed:', bybitErr.message)
  }

  return res.status(502).json({ error: 'All upstream pair sources unavailable' })
}
