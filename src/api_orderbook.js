/**
 * /api/orderbook.js — Vercel serverless function
 *
 * Proxies order book snapshot from MEXC Futures REST API.
 * Called by the frontend as: GET /api/orderbook?symbol=BTCUSDT&depth=20
 *
 * Falls back to Bybit if MEXC fails.
 */

// BTCUSDT → BTC_USDT
const toMEXC = (s) => s.replace('USDT', '_USDT')

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate=2')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { symbol, depth = '20' } = req.query
  if (!symbol) return res.status(400).json({ error: 'symbol query param required' })

  const sym   = symbol.toUpperCase()
  const limit = Math.min(parseInt(depth) || 20, 50)

  // ── Try MEXC first ────────────────────────────────────────────────────────
  try {
    const url = `https://contract.mexc.com/api/v1/contract/depth/${toMEXC(sym)}?limit=${limit}`
    const mexcRes = await fetch(url, {
      headers: { 'User-Agent': 'IJGF/1.0' },
      signal:  AbortSignal.timeout(5000),
    })

    if (!mexcRes.ok) throw new Error(`MEXC HTTP ${mexcRes.status}`)

    const { data } = await mexcRes.json()
    if (!data?.bids || !data?.asks) throw new Error('MEXC unexpected response shape')

    // MEXC returns [[price, qty, ...], ...]
    const bids = data.bids.map(([p, q]) => [String(p), String(q)])
    const asks = data.asks.map(([p, q]) => [String(p), String(q)])

    return res.status(200).json({ source: 'mexc', symbol: sym, bids, asks })
  } catch (mexcErr) {
    console.warn('[/api/orderbook] MEXC failed:', mexcErr.message)
  }

  // ── Fallback: Bybit ───────────────────────────────────────────────────────
  try {
    const url = `https://api.bybit.com/v5/market/orderbook?category=linear&symbol=${sym}&limit=${limit}`
    const bybitRes = await fetch(url, {
      headers: { 'User-Agent': 'IJGF/1.0' },
      signal:  AbortSignal.timeout(5000),
    })

    if (!bybitRes.ok) throw new Error(`Bybit HTTP ${bybitRes.status}`)

    const { result } = await bybitRes.json()
    if (!result?.b || !result?.a) throw new Error('Bybit unexpected response shape')

    return res.status(200).json({
      source: 'bybit',
      symbol: sym,
      bids:   result.b,
      asks:   result.a,
    })
  } catch (bybitErr) {
    console.warn('[/api/orderbook] Bybit failed:', bybitErr.message)
  }

  return res.status(502).json({ error: 'All upstream order book sources unavailable' })
}
