/**
 * /api/orderbook.js — Vercel serverless function
 *
 * Multi-exchange order book with automatic fallback:
 *   1. Bybit   — primary
 *   2. OKX     — secondary
 *   3. Binance — tertiary (blocks some cloud/Vercel IPs)
 *
 * All sources return the same format: { bids: [[price, qty], ...], asks: [...] }
 * so the frontend never needs to know which source responded.
 *
 * Called by the frontend as: GET /api/orderbook?symbol=BTCUSDT&depth=20
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate=2')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET')     return res.status(405).json({ error: 'Method not allowed' })

  const { symbol, depth = '20' } = req.query
  if (!symbol) return res.status(400).json({ error: 'symbol query param required' })

  const sym   = symbol.toUpperCase()
  const limit = Math.min(parseInt(depth) || 20, 200)

  // ── Source 1: Bybit ─────────────────────────────────────────────────────────
  // Bybit result.b / result.a arrays are [[price, qty], ...]
  try {
    const url = `https://api.bybit.com/v5/market/orderbook?category=linear&symbol=${sym}&limit=${limit}`
    const r = await fetch(url, {
      headers: { 'User-Agent': 'IJGF/1.0' },
      signal:  AbortSignal.timeout(5000),
    })
    if (!r.ok) throw new Error(`Bybit HTTP ${r.status}`)
    const json = await r.json()
    if (json.retCode !== 0 || !json.result?.b || !json.result?.a) {
      throw new Error(`Bybit retCode=${json.retCode}`)
    }
    return res.status(200).json({
      source: 'bybit',
      symbol: sym,
      bids:   json.result.b,
      asks:   json.result.a,
    })
  } catch (err) {
    console.warn('[/api/orderbook] Bybit failed:', err.message)
  }

  // ── Source 2: OKX ──────────────────────────────────────────────────────────
  // OKX symbol: BTCUSDT → BTC-USDT-SWAP
  // OKX bids/asks: [[price, qty, liquidatedOrders, numOrders], ...]
  // We normalise to [[price, qty]] to match the other sources.
  try {
    const base   = sym.endsWith('USDT') ? sym.slice(0, -4) : sym
    const okxSym = `${base}-USDT-SWAP`
    const url    = `https://www.okx.com/api/v5/market/books?instId=${okxSym}&sz=${limit}`
    const r = await fetch(url, {
      headers: { 'User-Agent': 'IJGF/1.0' },
      signal:  AbortSignal.timeout(5000),
    })
    if (!r.ok) throw new Error(`OKX HTTP ${r.status}`)
    const json = await r.json()
    if (json.code !== '0' || !Array.isArray(json.data) || !json.data[0]) {
      throw new Error(`OKX code=${json.code}`)
    }
    const book = json.data[0]
    return res.status(200).json({
      source: 'okx',
      symbol: sym,
      bids:   book.bids.map(([p, q]) => [p, q]),
      asks:   book.asks.map(([p, q]) => [p, q]),
    })
  } catch (err) {
    console.warn('[/api/orderbook] OKX failed:', err.message)
  }

  // ── Source 3: Binance (last resort) ───────────────────────────────────────
  try {
    const url = `https://fapi.binance.com/fapi/v1/depth?symbol=${sym}&limit=${limit}`
    const r = await fetch(url, {
      headers: { 'User-Agent': 'IJGF/1.0' },
      signal:  AbortSignal.timeout(5000),
    })
    if (!r.ok) throw new Error(`Binance HTTP ${r.status}`)
    const data = await r.json()
    if (!data.bids || !data.asks) throw new Error('Unexpected Binance response shape')
    return res.status(200).json({
      source: 'binance',
      symbol: sym,
      bids:   data.bids,
      asks:   data.asks,
    })
  } catch (err) {
    console.warn('[/api/orderbook] Binance failed:', err.message)
  }

  return res.status(502).json({ error: 'All orderbook sources unavailable' })
}
