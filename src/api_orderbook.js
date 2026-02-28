/**
 * /api/orderbook.js — Vercel serverless function
 *
 * Returns an order book snapshot for the requested symbol from Binance fapi.
 * Runs server-side on Vercel (US datacenter) — no geo-block.
 *
 * Called by the frontend as: GET /api/orderbook?symbol=BTCUSDT&depth=20
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate=2')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { symbol, depth = '20' } = req.query
  if (!symbol) return res.status(400).json({ error: 'symbol query param required' })

  const sym   = symbol.toUpperCase()
  const limit = Math.min(parseInt(depth) || 20, 1000)

  try {
    const url = `https://fapi.binance.com/fapi/v1/depth?symbol=${sym}&limit=${limit}`
    const binanceRes = await fetch(url, {
      headers: { 'User-Agent': 'IJGF/1.0' },
      signal:  AbortSignal.timeout(5000),
    })
    if (!binanceRes.ok) throw new Error(`Binance HTTP ${binanceRes.status}`)

    const data = await binanceRes.json()
    if (!data.bids || !data.asks) throw new Error('Unexpected response shape')

    return res.status(200).json({
      source: 'binance',
      symbol: sym,
      bids:   data.bids,
      asks:   data.asks,
    })
  } catch (err) {
    console.error('[/api/orderbook]', err.message)
    return res.status(502).json({ error: 'Binance upstream unavailable' })
  }
}
