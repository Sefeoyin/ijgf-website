/**
 * /api/bybit-proxy.js
 *
 * Vercel serverless function.
 * Signs Bybit Demo Trading API requests server-side using HMAC-SHA256.
 * Place this file at: /api/bybit-proxy.js  (root of repo, NOT inside /src)
 */

import crypto from 'crypto'

const BYBIT_BASE = 'https://api-demo.bybit.com'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'POST only' })

  const { apiKey, apiSecret, method, endpoint, params = {} } = req.body ?? {}

  if (!apiKey || !apiSecret || !method || !endpoint) {
    return res.status(400).json({ error: 'Missing required fields: apiKey, apiSecret, method, endpoint' })
  }

  const timestamp   = Date.now().toString()
  const recvWindow  = '5000'
  const queryString = method === 'GET' ? new URLSearchParams(params).toString() : ''
  const bodyString  = method !== 'GET' ? JSON.stringify(params) : ''
  const signPayload = `${timestamp}${apiKey}${recvWindow}${queryString || bodyString}`
  const signature   = crypto.createHmac('sha256', apiSecret).update(signPayload).digest('hex')

  const headers = {
    'X-BAPI-API-KEY':     apiKey,
    'X-BAPI-SIGN':        signature,
    'X-BAPI-TIMESTAMP':   timestamp,
    'X-BAPI-RECV-WINDOW': recvWindow,
    'Content-Type':       'application/json',
  }

  try {
    const url = `${BYBIT_BASE}${endpoint}${queryString ? '?' + queryString : ''}`

    const bybitRes = await fetch(url, {
      method,
      headers,
      body:   method !== 'GET' ? bodyString : undefined,
      signal: AbortSignal.timeout(8000),
    })

    // ── Read raw text first, THEN parse ──────────────────────────────────
    // If Bybit returns an HTML error page (403, 429, 5xx), .json() throws
    // "Unexpected token '<'" which completely hides the real error.
    // We read text first so we always know what Bybit actually sent.
    const rawText = await bybitRes.text()

    // Log non-200 HTTP status so it appears in Vercel function logs
    if (!bybitRes.ok) {
      console.error(
        `[bybit-proxy] HTTP ${bybitRes.status} from Bybit on ${method} ${endpoint}. ` +
        `Body: ${rawText.slice(0, 300)}`
      )
      return res.status(200).json({
        retCode: -bybitRes.status,
        retMsg:  `Bybit HTTP ${bybitRes.status}: ${rawText.slice(0, 200)}`,
        result:  {},
      })
    }

    // Parse JSON — if it fails, Bybit sent something unexpected
    let data
    try {
      data = JSON.parse(rawText)
    } catch {
      console.error(`[bybit-proxy] Non-JSON response from Bybit on ${method} ${endpoint}: ${rawText.slice(0, 300)}`)
      return res.status(200).json({
        retCode: -1,
        retMsg:  `Bybit returned non-JSON response: ${rawText.slice(0, 200)}`,
        result:  {},
      })
    }

    // Log non-zero retCodes to Vercel function logs for visibility
    if (data.retCode !== 0) {
      console.error(`[bybit-proxy] retCode ${data.retCode} on ${method} ${endpoint}: ${data.retMsg}`)
    }

    return res.status(200).json(data)

  } catch (err) {
    console.error('[bybit-proxy] Fetch error:', err.message)
    return res.status(502).json({ error: `Bybit request failed: ${err.message}` })
  }
}
