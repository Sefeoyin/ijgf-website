/**
 * /api/prices.js — Vercel serverless function
 *
 * Multi-exchange price feed with automatic fallback:
 *   1. Bybit   — primary   (cloud-friendly public API, permissive IP policy)
 *   2. OKX     — secondary
 *   3. Binance — tertiary  (blocks some cloud/Vercel IPs — kept as last resort)
 *
 * Called by the frontend as: GET /api/prices?symbols=BTCUSDT,ETHUSDT
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Cache-Control', 's-maxage=2, stale-while-revalidate=5')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET')     return res.status(405).json({ error: 'Method not allowed' })

  const { symbols } = req.query
  if (!symbols) return res.status(400).json({ error: 'symbols query param required' })

  const requested    = symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
  const requestedSet = new Set(requested)

  // ── Source 1: Bybit Linear Perpetuals ──────────────────────────────────────
  // Bybit's public API is accessible from Vercel/AWS without IP restrictions.
  // price24hPcnt is a decimal (0.0123 = 1.23%) — multiply by 100 for percent.
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

    const prices = {}
    for (const t of json.result.list) {
      if (!requestedSet.has(t.symbol)) continue
      prices[t.symbol] = {
        price:       parseFloat(t.lastPrice)     || 0,
        change:      (parseFloat(t.price24hPcnt) || 0) * 100,
        high:        parseFloat(t.highPrice24h)  || 0,
        low:         parseFloat(t.lowPrice24h)   || 0,
        volume:      parseFloat(t.volume24h)     || 0,
        quoteVolume: parseFloat(t.turnover24h)   || 0,
      }
    }
    if (Object.keys(prices).length > 0) {
      return res.status(200).json({ source: 'bybit', prices })
    }
    throw new Error('Bybit returned 0 matching symbols')
  } catch (err) {
    console.warn('[/api/prices] Bybit failed:', err.message)
  }

  // ── Source 2: OKX Swap Perpetuals ─────────────────────────────────────────
  // OKX symbol format: BTC-USDT-SWAP → split on '-', take base + append 'USDT'
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

    const prices = {}
    for (const t of json.data) {
      if (!t.instId?.endsWith('-USDT-SWAP')) continue
      // "BTC-USDT-SWAP" → ["BTC","USDT","SWAP"] → "BTCUSDT"
      const parts = t.instId.split('-')
      if (parts.length < 3) continue
      const sym = parts[0] + 'USDT'
      if (!requestedSet.has(sym)) continue

      const price = parseFloat(t.last)   || 0
      const open  = parseFloat(t.open24h) || 0
      prices[sym] = {
        price,
        change:      open > 0 ? ((price - open) / open) * 100 : 0,
        high:        parseFloat(t.high24h)   || 0,
        low:         parseFloat(t.low24h)    || 0,
        volume:      parseFloat(t.vol24h)    || 0,
        quoteVolume: parseFloat(t.volCcy24h) || 0,
      }
    }
    if (Object.keys(prices).length > 0) {
      return res.status(200).json({ source: 'okx', prices })
    }
    throw new Error('OKX returned 0 matching symbols')
  } catch (err) {
    console.warn('[/api/prices] OKX failed:', err.message)
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

    const prices = {}
    for (const t of tickers) {
      if (!requestedSet.has(t.symbol)) continue
      prices[t.symbol] = {
        price:       parseFloat(t.lastPrice)          || 0,
        change:      parseFloat(t.priceChangePercent) || 0,
        high:        parseFloat(t.highPrice)          || 0,
        low:         parseFloat(t.lowPrice)           || 0,
        volume:      parseFloat(t.volume)             || 0,
        quoteVolume: parseFloat(t.quoteVolume)        || 0,
      }
    }
    if (Object.keys(prices).length > 0) {
      return res.status(200).json({ source: 'binance', prices })
    }
    throw new Error('Binance returned 0 matching symbols')
  } catch (err) {
    console.warn('[/api/prices] Binance failed:', err.message)
  }

  return res.status(502).json({ error: 'All price sources unavailable' })
}
