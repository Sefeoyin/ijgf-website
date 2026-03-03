/* global require, Buffer, module, process */
/* eslint-disable no-unused-vars */
/**
 * api/tpsl-cron.js
 *
 * Vercel Serverless Function — called by cron-job.org every minute.
 * Evaluates all open demo positions against live Binance prices and
 * closes any that have hit their Take Profit, Stop Loss, or
 * Liquidation price.
 *
 * CRITICAL REQUIREMENTS:
 *  - Must use SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)
 *  - Must be plain CommonJS (no ES import syntax) — Vercel Node runtime
 *  - Must return 200 even on partial failures (cron-job.org disables on 26 failures)
 *  - Must be idempotent — safe to run concurrently every 60 seconds
 *
 * Environment variables (set in Vercel dashboard → Settings → Environment Variables):
 *   SUPABASE_URL              — your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (NOT the anon key)
 */

const https = require('https')

// ---------------------------------------------------------------------------
// Minimal HTTPS helpers (no npm dependencies)
// ---------------------------------------------------------------------------

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 8000 }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (parseErr) { reject(new Error(`JSON parse failed: ${parseErr.message}`)) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
  })
}

// ---------------------------------------------------------------------------
// Minimal Supabase REST client (no npm dependency required)
// ---------------------------------------------------------------------------
class SupabaseClient {
  constructor(url, serviceKey) {
    this.url = url.replace(/\/$/, '')
    this.headers = {
      'apikey':        serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
    }
  }

  _request(method, table, params, body) {
    return new Promise((resolve, reject) => {
      const qs      = params ? `?${params}` : ''
      const parsed  = new URL(`${this.url}/rest/v1/${table}${qs}`)
      const payload = body ? JSON.stringify(body) : null

      const options = {
        hostname: parsed.hostname,
        path:     parsed.pathname + parsed.search,
        method,
        headers:  {
          ...this.headers,
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
        timeout: 10000,
      }

      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            const body2 = data ? JSON.parse(data) : null
            if (res.statusCode >= 400) {
              const msg = body2?.message || body2?.error || `HTTP ${res.statusCode}`
              reject(new Error(msg))
            } else {
              resolve(Array.isArray(body2) ? body2 : (body2 ?? []))
            }
          } catch {
            // Non-JSON response (e.g. empty 204) — treat as success
            resolve([])
          }
        })
      })

      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
      if (payload) req.write(payload)
      req.end()
    })
  }

  select(table, params)      { return this._request('GET',   table, params, null) }
  insert(table, row)         { return this._request('POST',  table, null,   row)  }
  update(table, row, params) { return this._request('PATCH', table, params, row)  }
}

// ---------------------------------------------------------------------------
// Fetch all live Binance Futures prices in one call
// ---------------------------------------------------------------------------
async function fetchBinancePrices() {
  try {
    const data = await httpsGet('https://fapi.binance.com/fapi/v1/ticker/price')
    const map = {}
    if (Array.isArray(data)) {
      for (const item of data) {
        map[item.symbol] = parseFloat(item.price)
      }
    }
    return map
  } catch (fetchErr) {
    console.error('[tpsl-cron] Binance price fetch failed:', fetchErr.message)
    return {}
  }
}

// ---------------------------------------------------------------------------
// PnL calculation — mirrors closePosition() in tradingService.js exactly
// ---------------------------------------------------------------------------
function calculatePnl(position, exitPrice) {
  const entryPrice = parseFloat(position.entry_price)
  const quantity   = parseFloat(position.quantity)
  if (position.side === 'LONG') {
    return (exitPrice - entryPrice) * quantity
  }
  return (entryPrice - exitPrice) * quantity
}

function calculateLiquidationPrice(position) {
  const entryPrice = parseFloat(position.entry_price)
  const margin     = parseFloat(position.margin)
  const quantity   = parseFloat(position.quantity)
  if (quantity <= 0) return null
  // 5% safety buffer before hard liquidation
  const buffer = 0.95
  if (position.side === 'LONG') {
    return entryPrice - (margin / quantity) * buffer
  }
  return entryPrice + (margin / quantity) * buffer
}

// ---------------------------------------------------------------------------
// Determine if a position should be closed and why
// ---------------------------------------------------------------------------
function shouldClose(position, currentPrice) {
  const tp  = position.take_profit ? parseFloat(position.take_profit) : null
  const sl  = position.stop_loss   ? parseFloat(position.stop_loss)   : null
  const liq = calculateLiquidationPrice(position)

  if (position.side === 'LONG') {
    if (tp  && currentPrice >= tp)  return 'tp'
    if (sl  && currentPrice <= sl)  return 'sl'
    if (liq && currentPrice <= liq) return 'liquidation'
  } else {
    if (tp  && currentPrice <= tp)  return 'tp'
    if (sl  && currentPrice >= sl)  return 'sl'
    if (liq && currentPrice >= liq) return 'liquidation'
  }
  return null
}

// ---------------------------------------------------------------------------
// Close a single position atomically and update the account balance
// ---------------------------------------------------------------------------
async function closePosition(db, position, currentPrice, reason) {
  const now    = new Date().toISOString()
  const pnl    = parseFloat(calculatePnl(position, currentPrice).toFixed(8))
  const margin = parseFloat(position.margin)

  // 1. Mark position closed.
  //    The filter `status=eq.open` is the idempotency guard:
  //    if two cron ticks race on the same position, the second PATCH
  //    matches 0 rows and is a no-op — no double-close, no double PnL.
  try {
    await db.update(
      'demo_positions',
      { status: 'closed', closed_at: now, close_price: currentPrice, realized_pnl: pnl },
      `id=eq.${position.id}&status=eq.open`
    )
  } catch {
    // Already closed by a concurrent execution — skip
    console.warn(`[tpsl-cron] Position ${position.id} already closed, skipping`)
    return null
  }

  // 2. Insert closing trade record
  //    is_close = true marks this as a position-close event (not an open).
  //    executed_at is used by tradingService.js to count trading days.
  try {
    await db.insert('demo_trades', {
      demo_account_id: position.demo_account_id,
      user_id:         position.user_id,
      symbol:          position.symbol,
      side:            position.side === 'LONG' ? 'BUY' : 'SELL',
      quantity:        parseFloat(position.quantity),
      entry_price:     parseFloat(position.entry_price),
      exit_price:      currentPrice,
      realized_pnl:    pnl,
      leverage:        parseFloat(position.leverage) || 1,
      is_close:        true,
      close_reason:    reason,
      executed_at:     now,
    })
  } catch (tradeErr) {
    console.error(`[tpsl-cron] Trade insert failed for ${position.id}:`, tradeErr.message)
    // Non-fatal — proceed to balance update
  }

  // 3. Fetch current account row
  let account = null
  try {
    const rows = await db.select(
      'demo_accounts',
      `id=eq.${position.demo_account_id}&select=id,current_balance,initial_balance,status,profit_target,max_total_drawdown,high_water_mark,challenge_type`
    )
    account = rows[0] || null
  } catch (fetchErr) {
    console.error(`[tpsl-cron] Account fetch failed for ${position.demo_account_id}:`, fetchErr.message)
    return { pnl, reason }
  }

  if (!account || account.status !== 'active') {
    // Already resolved — nothing to update
    return { pnl, reason }
  }

  // 4. Compute new balance
  //    new_balance = old_balance + pnl + margin
  //    (margin was subtracted from current_balance when position was opened;
  //     it is now returned to the account along with any profit/loss)
  const newBalance     = Math.max(0, account.current_balance + pnl + margin)
  const initialBalance = parseFloat(account.initial_balance)
  const maxDrawdown    = parseFloat(account.max_total_drawdown)
  const profitTarget   = parseFloat(account.profit_target)

  // 5. Check max drawdown breach → fail challenge
  const totalDrawdown = initialBalance - newBalance
  if (maxDrawdown > 0 && totalDrawdown >= maxDrawdown) {
    try {
      await db.update(
        'demo_accounts',
        { current_balance: newBalance, equity: newBalance, status: 'failed', updated_at: now },
        `id=eq.${account.id}`
      )
    } catch (failErr) {
      console.error(`[tpsl-cron] Failed to fail account ${account.id}:`, failErr.message)
    }
    return { pnl, reason, accountResult: 'failed' }
  }

  // 6. Check profit target → conditionally pass challenge
  const totalProfit = newBalance - initialBalance
  if (totalProfit >= profitTarget) {
    try {
      const trades = await db.select(
        'demo_trades',
        `demo_account_id=eq.${account.id}&is_close=eq.true&select=executed_at`
      )
      const tradingDays = new Set(
        (trades || []).map(t => t.executed_at?.split('T')[0]).filter(Boolean)
      ).size

      // Must match CHALLENGE_CONFIGS.minTradingDays in tradingService.js
      const minDays = 5
      if (tradingDays >= minDays) {
        await db.update(
          'demo_accounts',
          { current_balance: newBalance, equity: newBalance, status: 'passed', updated_at: now },
          `id=eq.${account.id}`
        )
        return { pnl, reason, accountResult: 'passed' }
      }
    } catch (daysErr) {
      console.error(`[tpsl-cron] Trading days check failed for ${account.id}:`, daysErr.message)
    }
  }

  // 7. Standard balance update (challenge still active)
  const newHWM = Math.max(parseFloat(account.high_water_mark || initialBalance), newBalance)
  try {
    await db.update(
      'demo_accounts',
      { current_balance: newBalance, equity: newBalance, high_water_mark: newHWM, updated_at: now },
      `id=eq.${account.id}`
    )
  } catch (updateErr) {
    console.error(`[tpsl-cron] Balance update failed for ${account.id}:`, updateErr.message)
  }

  return { pnl, reason }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('[tpsl-cron] FATAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    // Return 200 so cron-job.org never counts this as a job failure
    return res.status(200).json({ ok: false, error: 'Server misconfiguration — check Vercel env vars' })
  }

  const db        = new SupabaseClient(supabaseUrl, serviceKey)
  const startTime = Date.now()

  try {
    // 1. Fetch every open position across all accounts
    const positions = await db.select(
      'demo_positions',
      'status=eq.open&select=id,demo_account_id,user_id,symbol,side,quantity,entry_price,take_profit,stop_loss,margin,leverage'
    )

    if (!positions.length) {
      return res.status(200).json({
        ok:      true,
        message: 'No open positions',
        elapsed: Date.now() - startTime,
      })
    }

    // 2. Single Binance call fetches all symbols at once
    const priceMap = await fetchBinancePrices()

    if (!Object.keys(priceMap).length) {
      return res.status(200).json({
        ok:            true,
        message:       'Binance unavailable — skipping this cycle',
        positionCount: positions.length,
        elapsed:       Date.now() - startTime,
      })
    }

    // 3. Evaluate positions
    const closed  = []
    const errors  = []
    let   skipped = 0

    for (const position of positions) {
      const currentPrice = priceMap[position.symbol]
      if (!currentPrice) { skipped++; continue }

      const reason = shouldClose(position, currentPrice)
      if (!reason) continue

      try {
        const result = await closePosition(db, position, currentPrice, reason)
        if (result) {
          closed.push({
            symbol:  position.symbol,
            side:    position.side,
            reason,
            pnl:     result.pnl?.toFixed(4),
            account: result.accountResult || 'active',
          })
        }
      } catch (closeErr) {
        errors.push({ positionId: position.id, symbol: position.symbol, error: closeErr.message })
      }
    }

    console.log(
      `[tpsl-cron] ${Date.now() - startTime}ms |`,
      `positions=${positions.length}`,
      `skipped=${skipped}`,
      `closed=${closed.length}`,
      `errors=${errors.length}`
    )

    return res.status(200).json({
      ok:      true,
      elapsed: Date.now() - startTime,
      closed,
      errors,
      skipped,
    })

  } catch (fatalErr) {
    console.error('[tpsl-cron] Fatal:', fatalErr.message, fatalErr.stack)
    // Always 200 — never let cron-job.org disable the job again
    return res.status(200).json({
      ok:      false,
      error:   fatalErr.message,
      elapsed: Date.now() - startTime,
    })
  }
}
