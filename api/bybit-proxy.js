/**
 * /api/bybit-proxy.js
 *
 * Vercel serverless function.
 * Signs Bybit Testnet API requests server-side using HMAC-SHA256.
 * The API secret never appears in browser network logs.
 *
 * Place this file at: /api/bybit-proxy.js  (root of your repo, NOT inside /src)
 */

import crypto from 'crypto'

const BYBIT_BASE = 'https://api-testnet.bybit.com'

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
      signal: AbortSignal.timeout(8000),
    })

    const data = await bybitRes.json()
    return res.status(200).json(data)

  } catch (err) {
    console.error('[bybit-proxy] Fetch error:', err.message)
    return res.status(502).json({ error: `Bybit request failed: ${err.message}` })
  }
}
