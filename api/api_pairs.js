/**
 * /api/pairs.js — Vercel serverless function
 *
 * Returns all USDT perpetual futures pairs from Binance fapi, sorted by
 * 24h quote volume. Runs server-side on Vercel (US datacenter) — no geo-block.
 *
 * Called by the frontend as: GET /api/pairs
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const binanceRes = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr', {
      headers: { 'User-Agent': 'IJGF/1.0' },
      signal:  AbortSignal.timeout(5000),
    })
    if (!binanceRes.ok) throw new Error(`Binance HTTP ${binanceRes.status}`)

    const tickers = await binanceRes.json()
    if (!Array.isArray(tickers)) throw new Error('Unexpected response shape')

    const pairs  = []
    const prices = {}

    tickers
      .filter(t => t.symbol.endsWith('USDT'))
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .forEach(t => {
        pairs.push(t.symbol)
        prices[t.symbol] = {
          price:  parseFloat(t.lastPrice) || 0,
          change: parseFloat(t.priceChangePercent) || 0,
        }
      })

    return res.status(200).json({ source: 'binance', pairs, prices })
  } catch (err) {
    console.error('[/api/pairs]', err.message)
    return res.status(502).json({ error: 'Binance upstream unavailable' })
  }
}
