/**
 * /api/bybit-proxy.js
 *
 * Vercel serverless function.
 * Signs Bybit Demo Trading API requests server-side using HMAC-SHA256.
 * The API secret never appears in browser network logs.
 *
 * Place this file at: /api/bybit-proxy.js  (root of your repo, NOT inside /src)
 */

import crypto from 'crypto'

const BYBIT_BASE = 'https://api-demo.bybit.com'  // Bybit Demo Trading (NOT testnet)

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

  // Never log API keys or secrets
  const timestamp   = Date.now().toString()
  const recvWindow  = '5000'
  const queryString = method === 'GET'  ? new URLSearchParams(params).toString() : ''
  const bodyString  = method !== 'GET'  ? JSON.stringify(params)                 : ''
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
      signal: AbortSignal.timeout(25000),  // 25s — demo-apply-money can be slow
    })

    // Read as text first — Bybit returns HTML 403 pages when geo-blocked
    const text = await bybitRes.text()
    if (!bybitRes.ok) {
      console.error(`[bybit-proxy] Bybit HTTP ${bybitRes.status} for ${endpoint}`)
      // Return a valid JSON structure so proxyCall can read retCode
      return res.status(200).json({
        retCode: bybitRes.status === 403 ? -403 : -bybitRes.status,
        retMsg: `Bybit HTTP ${bybitRes.status} — possible geo-block or invalid endpoint`,
        result: {},
      })
    }

    let data
    try {
      data = JSON.parse(text)
    } catch {
      console.error(`[bybit-proxy] Non-JSON response from Bybit for ${endpoint}:`, text.slice(0, 200))
      return res.status(200).json({
        retCode: -1,
        retMsg: `Bybit returned non-JSON response — possible geo-block`,
        result: {},
      })
    }

    if (data.retCode !== 0) {
      console.warn(`[bybit-proxy] Bybit retCode ${data.retCode} for ${endpoint}: ${data.retMsg}`)
    }
    return res.status(200).json(data)

  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError'
    console.error(`[bybit-proxy] ${isTimeout ? 'Timeout' : 'Fetch error'} for ${endpoint}:`, err.message)
    return res.status(200).json({
      retCode: isTimeout ? -408 : -502,
      retMsg: isTimeout
        ? `Bybit request timed out after 25s — server may be slow, try again`
        : `Bybit request failed: ${err.message}`,
      result: {},
    })
  }
}
