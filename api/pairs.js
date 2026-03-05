/**
 * /api/pairs.js — Vercel serverless function
 *
 * Returns all USDT perpetual futures pairs sorted by 24h quote volume.
 * Multi-exchange fallback:
 *   1. Bybit   — primary
 *   2. OKX     — secondary
 *   3. Binance — tertiary (blocks some cloud/Vercel IPs)
 *
 * Called by the frontend as: GET /api/pairs
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET')     return res.status(405).json({ error: 'Method not allowed' })

  // ── Source 1: Bybit Linear Perpetuals ──────────────────────────────────────
  try {
    const r = await fetch('https://api.bybit.com/v5/market/tickers?category=linear', {
      headers: { 'User-Agent': 'IJGF/1.0' },
      signal:  AbortSignal.timeout(5000),
    })
    if (!r.ok) throw new Error(`Bybit HTTP ${r.status}`)
    const json = await r.json()
    if (json.retCode !== 0 || !Array.isArray(json.result?.list)) {
      throw new Error(`Bybit retCode=${json.retCode}`)
    }

    const pairs  = []
    const prices = {}

    json.result.list
      .filter(t => t.symbol.endsWith('USDT'))
      .sort((a, b) => parseFloat(b.turnover24h) - parseFloat(a.turnover24h))
      .forEach(t => {
        pairs.push(t.symbol)
        prices[t.symbol] = {
          price:  parseFloat(t.lastPrice)     || 0,
          change: (parseFloat(t.price24hPcnt) || 0) * 100,
        }
      })

    if (pairs.length > 0) {
      return res.status(200).json({ source: 'bybit', pairs, prices })
    }
    throw new Error('Bybit returned 0 pairs')
  } catch (err) {
    console.warn('[/api/pairs] Bybit failed:', err.message)
  }

  // ── Source 2: OKX Swap Perpetuals ─────────────────────────────────────────
  try {
    const r = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SWAP', {
      headers: { 'User-Agent': 'IJGF/1.0' },
      signal:  AbortSignal.timeout(5000),
    })
    if (!r.ok) throw new Error(`OKX HTTP ${r.status}`)
    const json = await r.json()
    if (json.code !== '0' || !Array.isArray(json.data)) {
      throw new Error(`OKX code=${json.code}`)
    }

    const withVolume = json.data
      .filter(t => t.instId?.endsWith('-USDT-SWAP'))
      .map(t => {
        const parts = t.instId.split('-')
        const sym   = parts[0] + 'USDT'
        const price = parseFloat(t.last)    || 0
        const open  = parseFloat(t.open24h) || 0
        return {
          sym,
          vol:    parseFloat(t.volCcy24h) || 0,
          price,
          change: open > 0 ? ((price - open) / open) * 100 : 0,
        }
      })
      .sort((a, b) => b.vol - a.vol)

    const pairs  = withVolume.map(x => x.sym)
    const prices = {}
    for (const x of withVolume) {
      prices[x.sym] = { price: x.price, change: x.change }
    }

    if (pairs.length > 0) {
      return res.status(200).json({ source: 'okx', pairs, prices })
    }
    throw new Error('OKX returned 0 pairs')
  } catch (err) {
    console.warn('[/api/pairs] OKX failed:', err.message)
  }

  // ── Source 3: Binance Futures (last resort) ────────────────────────────────
  try {
    const r = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr', {
      headers: { 'User-Agent': 'IJGF/1.0' },
      signal:  AbortSignal.timeout(5000),
    })
    if (!r.ok) throw new Error(`Binance HTTP ${r.status}`)
    const tickers = await r.json()
    if (!Array.isArray(tickers)) throw new Error('Unexpected Binance response')

    const pairs  = []
    const prices = {}

    tickers
      .filter(t => t.symbol.endsWith('USDT'))
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .forEach(t => {
        pairs.push(t.symbol)
        prices[t.symbol] = {
          price:  parseFloat(t.lastPrice)          || 0,
          change: parseFloat(t.priceChangePercent) || 0,
        }
      })

    if (pairs.length > 0) {
      return res.status(200).json({ source: 'binance', pairs, prices })
    }
    throw new Error('Binance returned 0 pairs')
  } catch (err) {
    console.warn('[/api/pairs] Binance failed:', err.message)
  }

  return res.status(502).json({ error: 'All pair sources unavailable' })
}
