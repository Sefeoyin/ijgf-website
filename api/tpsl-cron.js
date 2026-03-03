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
 *  - Must be idempotent — safe to run every 60 seconds
 *
 * Environment variables (set in Vercel dashboard):
 *   SUPABASE_URL              — your project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (NOT the anon key)
 */

const https = require('https')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 8000 }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error(`JSON parse failed: ${e.message}`)) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
  })
}

function httpsPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const parsed = new URL(url)
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
      timeout: 10000,
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch (e) { resolve({ status: res.statusCode, body: data }) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
    req.write(payload)
    req.end()
  })
}

function httpsPatch(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const parsed = new URL(url)
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
      timeout: 10000,
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch (e) { resolve({ status: res.statusCode, body: data }) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
    req.write(payload)
    req.end()
  })
}

// ---------------------------------------------------------------------------
// Supabase REST client (no npm dependency)
// ---------------------------------------------------------------------------
class SupabaseClient {
  constructor(url, serviceKey) {
    this.url = url.replace(/\/$/, '')
    this.headers = {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    }
  }

  _buildUrl(table, params = '') {
    return `${this.url}/rest/v1/${table}${params ? '?' + params : ''}`
  }

  async select(table, params = '') {
    return new Promise((resolve, reject) => {
      const url = this._buildUrl(table, params)
      const parsed = new URL(url)
      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: { ...this.headers },
        timeout: 10000,
      }
      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            if (res.statusCode >= 400) reject(new Error(parsed.message || `HTTP ${res.statusCode}`))
            else resolve(Array.isArray(parsed) ? parsed : [parsed])
          } catch (e) { reject(e) }
        })
      })
      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
      req.end()
    })
  }

  async insert(table, row) {
    return new Promise((resolve, reject) => {
      const url = this._buildUrl(table)
      const payload = JSON.stringify(row)
      const parsed = new URL(url)
      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          ...this.headers,
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 10000,
      }
      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            if (res.statusCode >= 400) reject(new Error(parsed.message || `HTTP ${res.statusCode}`))
            else resolve(parsed)
          } catch (e) { reject(e) }
        })
      })
      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
      req.write(payload)
      req.end()
    })
  }

  async update(table, row, filterParam) {
    return new Promise((resolve, reject) => {
      const url = this._buildUrl(table, filterParam)
      const payload = JSON.stringify(row)
      const parsed = new URL(url)
      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname + (parsed.search || ''),
        method: 'PATCH',
        headers: {
          ...this.headers,
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 10000,
      }
      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            if (res.statusCode >= 400) {
              const body = JSON.parse(data)
              reject(new Error(body.message || `HTTP ${res.statusCode}`))
            } else resolve(data ? JSON.parse(data) : null)
          } catch (e) { resolve(null) }
        })
      })
      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
      req.write(payload)
      req.end()
    })
  }
}

// ---------------------------------------------------------------------------
// Fetch live prices from Binance Futures (same source as proxy endpoint)
// ---------------------------------------------------------------------------
async function fetchBinancePrices(symbols) {
  if (!symbols.length) return {}

  try {
    // Batch fetch all 24hr ticker stats
    const data = await httpsGet(
      'https://fapi.binance.com/fapi/v1/ticker/price'
    )

    const priceMap = {}
    if (Array.isArray(data)) {
      for (const item of data) {
        priceMap[item.symbol] = parseFloat(item.price)
      }
    }
    return priceMap
  } catch (err) {
    console.error('[tpsl-cron] Binance price fetch failed:', err.message)
    return {}
  }
}

// ---------------------------------------------------------------------------
// PnL calculation (mirrors closePosition in tradingService.js)
// ---------------------------------------------------------------------------
function calculatePnl(position, exitPrice) {
  const entryPrice = parseFloat(position.entry_price)
  const quantity   = parseFloat(position.quantity)
  const side       = position.side // 'LONG' | 'SHORT'

  if (side === 'LONG') {
    return (exitPrice - entryPrice) * quantity
  } else {
    return (entryPrice - exitPrice) * quantity
  }
}

function calculateLiquidationPrice(position) {
  const entryPrice = parseFloat(position.entry_price)
  const leverage   = parseFloat(position.leverage) || 1
  const margin     = parseFloat(position.margin)
  const quantity   = parseFloat(position.quantity)

  if (quantity <= 0) return null

  // Liq price = entry ± (margin / quantity) with a 5% buffer
  const liquidationBuffer = 0.95  // 5% safety margin
  if (position.side === 'LONG') {
    return entryPrice - (margin / quantity) * liquidationBuffer
  } else {
    return entryPrice + (margin / quantity) * liquidationBuffer
  }
}

// ---------------------------------------------------------------------------
// Determine if a position should be closed and why
// ---------------------------------------------------------------------------
function shouldClose(position, currentPrice) {
  const tp  = position.take_profit  ? parseFloat(position.take_profit)  : null
  const sl  = position.stop_loss    ? parseFloat(position.stop_loss)    : null
  const liq = calculateLiquidationPrice(position)
  const side = position.side

  if (side === 'LONG') {
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
// Close a single position atomically
// ---------------------------------------------------------------------------
async function closePosition(db, position, currentPrice, reason) {
  const now    = new Date().toISOString()
  const pnl    = parseFloat(calculatePnl(position, currentPrice).toFixed(8))
  const margin = parseFloat(position.margin)

  // 1. Mark position closed — atomic guard on status='open' prevents double-close
  try {
    await db.update(
      'demo_positions',
      { status: 'closed', closed_at: now, close_price: currentPrice, realized_pnl: pnl },
      `id=eq.${position.id}&status=eq.open`
    )
  } catch (err) {
    // If status was already changed (race condition), abort silently
    console.warn(`[tpsl-cron] Position ${position.id} already closed, skipping`)
    return null
  }

  // 2. Insert trade record (the source of truth for PnL and trading days)
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
  } catch (err) {
    console.error(`[tpsl-cron] Failed to insert trade for position ${position.id}:`, err.message)
    // Continue — balance update is more critical than trade log
  }

  // 3. Fetch current account state to compute correct new balance
  let account = null
  try {
    const accounts = await db.select(
      'demo_accounts',
      `id=eq.${position.demo_account_id}&select=id,current_balance,initial_balance,status,profit_target,max_total_drawdown,high_water_mark,challenge_type`
    )
    account = accounts[0] || null
  } catch (err) {
    console.error(`[tpsl-cron] Failed to fetch account ${position.demo_account_id}:`, err.message)
    return { position, pnl, reason }
  }

  if (!account || account.status !== 'active') {
    // Account already failed/passed — nothing to update
    return { position, pnl, reason }
  }

  // 4. New balance = old balance + PnL + released margin
  //    (margin was subtracted when position opened, now it's returned + profit)
  const newBalance = Math.max(0, account.current_balance + pnl + margin)

  // 5. Check max drawdown breach
  const initialBalance = parseFloat(account.initial_balance)
  const totalDrawdown  = initialBalance - newBalance
  const maxDrawdown    = parseFloat(account.max_total_drawdown)

  if (maxDrawdown > 0 && totalDrawdown >= maxDrawdown) {
    // Challenge failed — max drawdown breached
    try {
      await db.update(
        'demo_accounts',
        {
          current_balance: newBalance,
          equity:          newBalance,
          status:          'failed',
          updated_at:      now,
        },
        `id=eq.${account.id}`
      )
    } catch (err) {
      console.error(`[tpsl-cron] Failed to fail account ${account.id}:`, err.message)
    }
    return { position, pnl, reason, accountResult: 'failed' }
  }

  // 6. Check profit target
  const totalProfit = newBalance - initialBalance
  const profitTarget = parseFloat(account.profit_target)

  if (totalProfit >= profitTarget) {
    // Profit target hit — check trading days
    try {
      const trades = await db.select(
        'demo_trades',
        `demo_account_id=eq.${account.id}&is_close=eq.true&select=executed_at`
      )
      const tradingDays = new Set(
        (trades || []).map(t => t.executed_at?.split('T')[0]).filter(Boolean)
      ).size

      const minDays = 5  // matches CHALLENGE_CONFIGS
      if (tradingDays >= minDays) {
        await db.update(
          'demo_accounts',
          {
            current_balance: newBalance,
            equity:          newBalance,
            status:          'passed',
            updated_at:      now,
          },
          `id=eq.${account.id}`
        )
        return { position, pnl, reason, accountResult: 'passed' }
      }
    } catch (err) {
      console.error(`[tpsl-cron] Trading days check failed for account ${account.id}:`, err.message)
    }
  }

  // 7. Normal balance update
  const newHWM = Math.max(parseFloat(account.high_water_mark || initialBalance), newBalance)
  try {
    await db.update(
      'demo_accounts',
      {
        current_balance: newBalance,
        equity:          newBalance,
        high_water_mark: newHWM,
        updated_at:      now,
      },
      `id=eq.${account.id}`
    )
  } catch (err) {
    console.error(`[tpsl-cron] Failed to update balance for account ${account.id}:`, err.message)
  }

  return { position, pnl, reason }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
module.exports = async function handler(req, res) {
  // Only allow GET (from cron-job.org) and POST (manual trigger)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Validate environment
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('[tpsl-cron] FATAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return res.status(500).json({
      error: 'Server misconfiguration: missing environment variables',
    })
  }

  const db = new SupabaseClient(supabaseUrl, serviceKey)
  const startTime = Date.now()

  try {
    // 1. Fetch all open positions across ALL active accounts
    const positions = await db.select(
      'demo_positions',
      'status=eq.open&select=id,demo_account_id,user_id,symbol,side,quantity,entry_price,take_profit,stop_loss,margin,leverage'
    )

    if (!positions.length) {
      return res.status(200).json({
        ok: true,
        message: 'No open positions',
        elapsed: Date.now() - startTime,
      })
    }

    // 2. Collect unique symbols and fetch prices once
    const symbols = [...new Set(positions.map(p => p.symbol))]
    const priceMap = await fetchBinancePrices(symbols)

    if (!Object.keys(priceMap).length) {
      return res.status(200).json({
        ok: true,
        message: 'Could not fetch prices — skipping this cycle',
        positionCount: positions.length,
        elapsed: Date.now() - startTime,
      })
    }

    // 3. Evaluate each position
    const results = {
      checked:  0,
      closed:   [],
      errors:   [],
      skipped:  0,
    }

    for (const position of positions) {
      const currentPrice = priceMap[position.symbol]
      if (!currentPrice) {
        results.skipped++
        continue
      }

      results.checked++

      const reason = shouldClose(position, currentPrice)
      if (!reason) continue

      try {
        const result = await closePosition(db, position, currentPrice, reason)
        if (result) {
          results.closed.push({
            symbol:  position.symbol,
            side:    position.side,
            reason,
            pnl:     result.pnl?.toFixed(4),
            account: result.accountResult || 'active',
          })
        }
      } catch (err) {
        results.errors.push({
          positionId: position.id,
          symbol:     position.symbol,
          error:      err.message,
        })
      }
    }

    console.log(
      `[tpsl-cron] Done in ${Date.now() - startTime}ms |`,
      `checked=${results.checked}`,
      `closed=${results.closed.length}`,
      `skipped=${results.skipped}`,
      `errors=${results.errors.length}`
    )

    return res.status(200).json({
      ok:      true,
      elapsed: Date.now() - startTime,
      ...results,
    })

  } catch (err) {
    console.error('[tpsl-cron] Unhandled error:', err.message, err.stack)
    // Return 200 so cron-job.org does NOT count this as a failure and disable the job.
    // The error is logged for investigation but the cron must stay enabled.
    return res.status(200).json({
      ok:      false,
      error:   err.message,
      elapsed: Date.now() - startTime,
    })
  }
}
