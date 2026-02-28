/**
 * /api/prices.js — Vercel serverless function
 *
 * Returns current prices for the requested symbols from Binance fapi.
 * Runs server-side on Vercel (US datacenter) — no geo-block.
 *
 * Called by the frontend as: GET /api/prices?symbols=BTCUSDT,ETHUSDT
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Cache-Control', 's-maxage=2, stale-while-revalidate=5')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { symbols } = req.query
  if (!symbols) return res.status(400).json({ error: 'symbols query param required' })

  const requested    = symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
  const requestedSet = new Set(requested)

  try {
    const binanceRes = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr', {
      headers: { 'User-Agent': 'IJGF/1.0' },
      signal:  AbortSignal.timeout(5000),
    })
    if (!binanceRes.ok) throw new Error(`Binance HTTP ${binanceRes.status}`)

    const tickers = await binanceRes.json()
    if (!Array.isArray(tickers)) throw new Error('Unexpected response shape')

    const prices = {}
    for (const t of tickers) {
      if (!requestedSet.has(t.symbol)) continue
      prices[t.symbol] = {
        price:       parseFloat(t.lastPrice) || 0,
        change:      parseFloat(t.priceChangePercent) || 0,
        high:        parseFloat(t.highPrice) || 0,
        low:         parseFloat(t.lowPrice)  || 0,
        volume:      parseFloat(t.volume)    || 0,
        quoteVolume: parseFloat(t.quoteVolume) || 0,
      }
    }

    return res.status(200).json({ source: 'binance', prices })
  } catch (err) {
    console.error('[/api/prices]', err.message)
    return res.status(502).json({ error: 'Binance upstream unavailable' })
  }
}
