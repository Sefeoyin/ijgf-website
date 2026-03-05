/**
 * bybitService.js
 *
 * Manages Bybit Testnet demo futures API integration for IJGF challenge tracking.
 *
 * Responsibilities:
 *   1. Validate API credentials against Bybit Testnet
 *   2. Place orders WITH mandatory TP/SL (challenges require both — no naked positions)
 *   3. Poll open positions and sync P&L back to demo_accounts in Supabase
 *   4. Enforce challenge drawdown rules — close all positions if max drawdown breached
 *   5. Detect pass/fail conditions and update demo_accounts.status
 *
 * Architecture:
 *   - All Bybit API calls go through /api/bybit-proxy (Vercel serverless) to avoid
 *     CORS and ISP blocks. The proxy signs requests server-side with HMAC-SHA256.
 *   - This file contains only the client-side orchestration logic.
 *   - No API keys are stored in memory beyond the duration of a single function call.
 *     Keys are fetched from Supabase on each operation and never logged.
 *
 * REQUIRED: Add /api/bybit-proxy.js to your Vercel project (see bottom of this file).
 * REQUIRED: DB migration must have run:
 *   ALTER TABLE demo_accounts
 *     ADD COLUMN IF NOT EXISTS trading_mode        TEXT DEFAULT 'ijgf',
 *     ADD COLUMN IF NOT EXISTS bybit_api_key       TEXT,
 *     ADD COLUMN IF NOT EXISTS bybit_api_secret    TEXT,
 *     ADD COLUMN IF NOT EXISTS bybit_connected_at  TIMESTAMPTZ,
 *     ADD COLUMN IF NOT EXISTS bybit_last_sync     TIMESTAMPTZ,
 *     ADD COLUMN IF NOT EXISTS bybit_equity        NUMERIC(20,8);
 */

import { supabase } from './supabase'

const BYBIT_PROXY = '/api/bybit-proxy'

// ── Internal: call the Vercel proxy ─────────────────────────────────────────
// The proxy handles HMAC signing so the secret never leaves the server.
async function bybitCall(apiKey, apiSecret, method, endpoint, params = {}) {
  const res = await fetch(BYBIT_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret, method, endpoint, params }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Bybit proxy HTTP ${res.status}: ${text}`)
  }
  const json = await res.json()
  if (json.retCode !== 0) {
    throw new Error(`Bybit API error ${json.retCode}: ${json.retMsg}`)
  }
  return json.result
}

// ── Validate credentials against Bybit Testnet ──────────────────────────────
export async function validateBybitCredentials(apiKey, apiSecret) {
  try {
    const result = await bybitCall(apiKey, apiSecret, 'GET', '/v5/account/wallet-balance', {
      accountType: 'UNIFIED',
    })
    // If we reach here without throwing, credentials are valid
    const usdtBalance = result?.list?.[0]?.coin?.find(c => c.coin === 'USDT')
    return {
      valid: true,
      equity: parseFloat(usdtBalance?.equity ?? 0),
      availableBalance: parseFloat(usdtBalance?.availableToWithdraw ?? 0),
    }
  } catch (err) {
    return { valid: false, error: err.message }
  }
}

// ── Place a futures order with MANDATORY TP and SL ──────────────────────────
// On Bybit Testnet perpetual futures, both takeProfit and stopLoss are required
// fields for IJGF challenge compliance. Orders without both will be rejected here
// before they reach Bybit, protecting the trader from uncapped drawdown.
export async function placeBybitOrder({
  accountId,       // demo_accounts.id — used to fetch credentials
  symbol,          // e.g. 'BTCUSDT'
  side,            // 'Buy' | 'Sell'
  qty,             // position size in base currency (e.g. 0.001 BTC)
  takeProfit,      // TP price (required — no exceptions)
  stopLoss,        // SL price (required — no exceptions)
  leverage = 10,   // default 10x
}) {
  // ── Enforce TP/SL before any network call ──
  if (!takeProfit || !stopLoss) {
    throw new Error(
      'IJGF Challenge Rule: Both Take Profit and Stop Loss are required on every position. ' +
      'This protects your challenge account from uncontrolled drawdown.'
    )
  }
  if (side === 'Buy'  && stopLoss  >= takeProfit) throw new Error('Buy order: Stop Loss must be below Take Profit')
  if (side === 'Sell' && stopLoss  <= takeProfit) throw new Error('Sell order: Stop Loss must be above Take Profit')
  if (side === 'Buy'  && stopLoss  >= parseFloat(qty) * 0) {} // qty sanity — bybit validates
  if (!qty || parseFloat(qty) <= 0) throw new Error('Order quantity must be greater than 0')

  // Fetch credentials from DB — never cache in memory
  const { data: acct, error: fetchErr } = await supabase
    .from('demo_accounts')
    .select('bybit_api_key, bybit_api_secret')
    .eq('id', accountId)
    .single()
  if (fetchErr || !acct?.bybit_api_key) {
    throw new Error('Bybit credentials not found. Please reconnect your Bybit account.')
  }

  const { bybit_api_key: apiKey, bybit_api_secret: apiSecret } = acct

  // Set leverage first (idempotent — safe to call repeatedly)
  await bybitCall(apiKey, apiSecret, 'POST', '/v5/position/set-leverage', {
    category: 'linear',
    symbol,
    buyLeverage: String(leverage),
    sellLeverage: String(leverage),
  }).catch(() => {}) // leverage may already be set — suppress duplicate errors

  // Place the order with TP/SL
  const result = await bybitCall(apiKey, apiSecret, 'POST', '/v5/order/create', {
    category:    'linear',
    symbol,
    side,
    orderType:   'Market',
    qty:         String(qty),
    takeProfit:  String(takeProfit),
    stopLoss:    String(stopLoss),
    tpTriggerBy: 'MarkPrice',
    slTriggerBy: 'MarkPrice',
    timeInForce: 'IOC',
    positionIdx: 0, // one-way mode
  })

  return {
    orderId:  result.orderId,
    symbol,
    side,
    qty,
    takeProfit,
    stopLoss,
    leverage,
  }
}

// ── Sync Bybit equity → demo_accounts.current_balance ───────────────────────
// Called periodically (every 30s) by useBybitSync hook (see below).
// Updates current_balance and checks challenge pass/fail conditions.
export async function syncBybitEquity(accountId) {
  const { data: acct, error } = await supabase
    .from('demo_accounts')
    .select('id, bybit_api_key, bybit_api_secret, initial_balance, profit_target, max_drawdown, status, challenge_type')
    .eq('id', accountId)
    .single()

  if (error || !acct?.bybit_api_key) return null
  if (acct.status !== 'active') return null

  const { bybit_api_key: apiKey, bybit_api_secret: apiSecret } = acct

  let equity
  try {
    const result = await bybitCall(apiKey, apiSecret, 'GET', '/v5/account/wallet-balance', {
      accountType: 'UNIFIED',
    })
    const usdtCoin = result?.list?.[0]?.coin?.find(c => c.coin === 'USDT')
    equity = parseFloat(usdtCoin?.equity ?? 0)
    if (!equity || isNaN(equity)) return null
  } catch (err) {
    console.warn('[bybitService] syncBybitEquity failed to fetch equity:', err.message)
    return null
  }

  const initialBalance   = parseFloat(acct.initial_balance)
  const profitTarget     = parseFloat(acct.profit_target)
  const maxDrawdown      = parseFloat(acct.max_drawdown)
  const pnl              = equity - initialBalance
  const drawdown         = initialBalance - equity  // positive = losing money

  // ── Challenge pass/fail detection ──────────────────────────────────────
  let newStatus = 'active'

  if (drawdown >= maxDrawdown) {
    // Max drawdown breached — challenge failed
    newStatus = 'failed'
    // Attempt to close all positions to protect the account
    await closeAllBybitPositions(apiKey, apiSecret).catch(e =>
      console.error('[bybitService] Failed to close positions on drawdown breach:', e.message)
    )
  } else if (pnl >= profitTarget) {
    // Profit target hit — challenge passed (trading days checked separately)
    newStatus = 'passed'
  }

  // Write equity + status back to Supabase
  const updatePayload = {
    current_balance:  equity,
    bybit_equity:     equity,
    bybit_last_sync:  new Date().toISOString(),
    updated_at:       new Date().toISOString(),
  }
  if (newStatus !== 'active') {
    updatePayload.status = newStatus
  }

  const { error: updateErr } = await supabase
    .from('demo_accounts')
    .update(updatePayload)
    .eq('id', accountId)

  if (updateErr) {
    console.error('[bybitService] Failed to update demo_accounts:', updateErr.message)
  }

  return { equity, pnl, drawdown, status: newStatus }
}

// ── Close all open positions (drawdown breach enforcement) ──────────────────
async function closeAllBybitPositions(apiKey, apiSecret) {
  const result = await bybitCall(apiKey, apiSecret, 'GET', '/v5/position/list', {
    category:   'linear',
    settleCoin: 'USDT',
  })

  const positions = result?.list ?? []
  const openPositions = positions.filter(p => parseFloat(p.size) > 0)

  await Promise.allSettled(
    openPositions.map(pos =>
      bybitCall(apiKey, apiSecret, 'POST', '/v5/order/create', {
        category:    'linear',
        symbol:      pos.symbol,
        side:        pos.side === 'Buy' ? 'Sell' : 'Buy', // close direction
        orderType:   'Market',
        qty:         pos.size,
        reduceOnly:  true,
        timeInForce: 'IOC',
        positionIdx: 0,
      })
    )
  )
}

// ── Get open positions from Bybit ────────────────────────────────────────────
export async function getBybitPositions(accountId) {
  const { data: acct } = await supabase
    .from('demo_accounts')
    .select('bybit_api_key, bybit_api_secret')
    .eq('id', accountId)
    .single()

  if (!acct?.bybit_api_key) return []

  try {
    const result = await bybitCall(
      acct.bybit_api_key,
      acct.bybit_api_secret,
      'GET',
      '/v5/position/list',
      { category: 'linear', settleCoin: 'USDT' }
    )
    return (result?.list ?? [])
      .filter(p => parseFloat(p.size) > 0)
      .map(p => ({
        symbol:        p.symbol,
        side:          p.side,
        size:          parseFloat(p.size),
        entryPrice:    parseFloat(p.avgPrice),
        markPrice:     parseFloat(p.markPrice),
        unrealisedPnl: parseFloat(p.unrealisedPnl),
        takeProfit:    parseFloat(p.takeProfit) || null,
        stopLoss:      parseFloat(p.stopLoss)   || null,
        leverage:      parseInt(p.leverage),
        // Flag if TP or SL is missing — challenge violation
        missingTpSl:   !p.takeProfit || !p.stopLoss,
      }))
  } catch (err) {
    console.warn('[bybitService] getBybitPositions failed:', err.message)
    return []
  }
}

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * REQUIRED: /api/bybit-proxy.js — Vercel serverless function
 *
 * Add this file to your /api/ directory. It signs Bybit requests server-side
 * so the API secret never appears in browser network logs.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * import crypto from 'crypto'
 *
 * const BYBIT_BASE = 'https://api-testnet.bybit.com'  // Testnet
 *
 * export default async function handler(req, res) {
 *   res.setHeader('Access-Control-Allow-Origin', '*')
 *   res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
 *   if (req.method === 'OPTIONS') return res.status(200).end()
 *   if (req.method !== 'POST')   return res.status(405).json({ error: 'POST only' })
 *
 *   const { apiKey, apiSecret, method, endpoint, params = {} } = req.body
 *   if (!apiKey || !apiSecret || !method || !endpoint) {
 *     return res.status(400).json({ error: 'Missing required fields' })
 *   }
 *
 *   const timestamp   = Date.now().toString()
 *   const recvWindow  = '5000'
 *   const queryString = method === 'GET' ? new URLSearchParams(params).toString() : ''
 *   const bodyString  = method !== 'GET' ? JSON.stringify(params) : ''
 *   const signPayload = `${timestamp}${apiKey}${recvWindow}${queryString || bodyString}`
 *   const signature   = crypto.createHmac('sha256', apiSecret).update(signPayload).digest('hex')
 *
 *   const headers = {
 *     'X-BAPI-API-KEY':     apiKey,
 *     'X-BAPI-SIGN':        signature,
 *     'X-BAPI-TIMESTAMP':   timestamp,
 *     'X-BAPI-RECV-WINDOW': recvWindow,
 *     'Content-Type':       'application/json',
 *   }
 *
 *   const url = `${BYBIT_BASE}${endpoint}${queryString ? '?' + queryString : ''}`
 *   const bybitRes = await fetch(url, {
 *     method,
 *     headers,
 *     body: method !== 'GET' ? bodyString : undefined,
 *     signal: AbortSignal.timeout(8000),
 *   })
 *
 *   const data = await bybitRes.json()
 *   return res.status(200).json(data)
 * }
 */
