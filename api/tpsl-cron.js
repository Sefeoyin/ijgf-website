/* global Buffer, process */
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

import https from 'https'

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
// Price fetch cascade: Bybit → OKX → Binance
// fapi.binance.com blocks Vercel/AWS cloud IPs at the network layer —
// the 8s timeout alone can push total execution past Vercel Hobby's 10s
// limit. Bybit and OKX have permissive cloud-provider IP policies.
// ---------------------------------------------------------------------------
async function fetchBybitPrices() {
  try {
    const data = await httpsGet('https://api.bybit.com/v5/market/tickers?category=linear')
    const map = {}
    if (data?.result?.list && Array.isArray(data.result.list)) {
      for (const item of data.result.list) {
        if (item.symbol && item.lastPrice) {
          map[item.symbol] = parseFloat(item.lastPrice)
        }
      }
    }
    return map
  } catch (err) {
    console.error('[tpsl-cron] Bybit price fetch failed:', err.message)
    return {}
  }
}

async function fetchOKXPrices() {
  try {
    const data = await httpsGet('https://www.okx.com/api/v5/market/tickers?instType=SWAP')
    const map = {}
    if (data?.data && Array.isArray(data.data)) {
      for (const item of data.data) {
        // OKX format: BTC-USDT-SWAP → BTCUSDT
        if (item.instId && item.instId.endsWith('-USDT-SWAP') && item.last) {
          const base = item.instId.replace('-USDT-SWAP', '')
          map[`${base}USDT`] = parseFloat(item.last)
        }
      }
    }
    return map
  } catch (err) {
    console.error('[tpsl-cron] OKX price fetch failed:', err.message)
    return {}
  }
}

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

async function fetchPrices() {
  const bybit = await fetchBybitPrices()
  if (Object.keys(bybit).length > 0) {
    console.log(`[tpsl-cron] Prices from Bybit (${Object.keys(bybit).length} symbols)`)
    return bybit
  }
  const okx = await fetchOKXPrices()
  if (Object.keys(okx).length > 0) {
    console.log(`[tpsl-cron] Prices from OKX (${Object.keys(okx).length} symbols)`)
    return okx
  }
  console.log('[tpsl-cron] Falling back to Binance')
  return fetchBinancePrices()
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
async function closePosition(db, position, currentPrice, reason, priceMap = {}) {
  const now    = new Date().toISOString()
  const pnl    = parseFloat(calculatePnl(position, currentPrice).toFixed(8))
  const margin = parseFloat(position.margin)

  // 1. Mark position closed — idempotency guard: second PATCH on same position
  //    matches 0 rows (status already changed) and is a no-op.
  //    FIX Bug 3: use 'liquidated' status when reason === 'liquidation',
  //    matching tradingService.js exactly so UI badge/filter logic works.
  const positionStatus = reason === 'liquidation' ? 'liquidated' : 'closed'
  try {
    const updated = await db.update(
      'demo_positions',
      { status: positionStatus, closed_at: now, close_price: currentPrice, realized_pnl: pnl },
      `id=eq.${position.id}&status=eq.open`
    )
    // Supabase returns [] when no row matched (already closed)
    if (!updated || (Array.isArray(updated) && updated.length === 0)) {
      console.warn(`[tpsl-cron] Position ${position.id} already closed, skipping`)
      return null
    }
  } catch (closeErr) {
    console.warn(`[tpsl-cron] Position ${position.id} close failed:`, closeErr.message)
    return null
  }

  // 2. Insert closing trade record — schema must match tradingService.js exactly.
  //    FIX Bug 1: is_close: true is REQUIRED — getAccountState filters on this
  //               field to count tradingDays and build trade history PNL.
  //    FIX Bug 4: use 'price' (not 'exit_price'), add position_id, order_type,
  //               total, fee, opened_at, closed_at to match the real schema.
  //    FIX Bug 4: side should be the CLOSING side (LONG closes with SELL).
  const closeSide = position.side === 'LONG' ? 'SELL' : 'BUY'
  try {
    await db.insert('demo_trades', {
      demo_account_id: position.demo_account_id,
      user_id:         position.user_id,
      position_id:     position.id,
      symbol:          position.symbol,
      side:            closeSide,
      order_type:      'MARKET',
      price:           currentPrice,
      quantity:        parseFloat(position.quantity),
      leverage:        parseFloat(position.leverage) || 1,
      total:           currentPrice * parseFloat(position.quantity),
      fee:             0,
      realized_pnl:    pnl,
      is_close:        true,
      opened_at:       position.opened_at ?? null,
      closed_at:       now,
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
      `id=eq.${position.demo_account_id}&select=id,current_balance,initial_balance,status,profit_target,max_total_drawdown,high_water_mark,challenge_type,total_trades,winning_trades,min_trading_days`
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
  const rawNewBalance  = account.current_balance + pnl + margin
  // SAFETY GUARD: if any component is NaN/Infinity (e.g. from a bad price or missing
  // column), abort the balance update entirely rather than corrupt the account row.
  if (!isFinite(rawNewBalance)) {
    console.error(`[tpsl-cron] ABORT balance update for ${position.id}: computed newBalance is ${rawNewBalance}. pnl=${pnl} margin=${margin} current_balance=${account.current_balance}`)
    return { pnl, reason }
  }
  const newBalance     = Math.max(0, rawNewBalance)
  const initialBalance = parseFloat(account.initial_balance)
  const maxDrawdown    = parseFloat(account.max_total_drawdown)
  const profitTarget   = parseFloat(account.profit_target)

  // 5. Check max drawdown breach → fail challenge
  const totalDrawdown = initialBalance - newBalance
  if (maxDrawdown > 0 && totalDrawdown >= maxDrawdown) {
    try {
      // FIX Bug 2: increment total_trades and winning_trades on every balance update
      const updatedTrades  = (account.total_trades  || 0) + 1
      const updatedWinning = pnl > 0 ? (account.winning_trades || 0) + 1 : (account.winning_trades || 0)
      await db.update(
        'demo_accounts',
        {
          current_balance: newBalance,
          equity:          newBalance,
          status:          'failed',
          total_trades:    updatedTrades,
          winning_trades:  updatedWinning,
          updated_at:      now,
        },
        `id=eq.${account.id}`
      )
    } catch (failErr) {
      console.error(`[tpsl-cron] Failed to fail account ${account.id}:`, failErr.message)
    }

    // Force-close all remaining open positions on this account.
    // The triggering position is already closed above — exclude it by id.
    // Mirrors checkChallengeRules in tradingService.js which does the same loop
    // before marking failed, preventing ghost 'open' rows in demo_positions.
    try {
      const remaining = await db.select(
        'demo_positions',
        `demo_account_id=eq.${account.id}&status=eq.open&id=neq.${position.id}&select=id,symbol,side,entry_price,quantity,margin,leverage,opened_at,demo_account_id,user_id`
      )
      if (remaining && remaining.length > 0) {
        let forceClosedCount = 0
        for (const rem of remaining) {
          try {
            const livePrice = priceMap[rem.symbol]
            const closePrice = isFinite(livePrice) && livePrice > 0 ? livePrice : parseFloat(rem.entry_price)
            const remPnl = rem.side === 'LONG'
              ? (closePrice - parseFloat(rem.entry_price)) * parseFloat(rem.quantity)
              : (parseFloat(rem.entry_price) - closePrice) * parseFloat(rem.quantity)
            await db.update(
              'demo_positions',
              { status: 'closed', closed_at: now, close_price: closePrice, realized_pnl: parseFloat(remPnl.toFixed(8)) },
              `id=eq.${rem.id}&status=eq.open`
            )
            // Insert closing trade record so history is complete
            const closeSide = rem.side === 'LONG' ? 'SELL' : 'BUY'
            await db.insert('demo_trades', {
              demo_account_id: rem.demo_account_id,
              user_id:         rem.user_id,
              position_id:     rem.id,
              symbol:          rem.symbol,
              side:            closeSide,
              order_type:      'MARKET',
              price:           closePrice,
              quantity:        parseFloat(rem.quantity),
              leverage:        parseFloat(rem.leverage) || 1,
              total:           closePrice * parseFloat(rem.quantity),
              fee:             0,
              realized_pnl:    parseFloat(remPnl.toFixed(8)),
              is_close:        true,
              opened_at:       rem.opened_at ?? null,
              closed_at:       now,
              executed_at:     now,
            })
            forceClosedCount++
          } catch (remErr) {
            console.error(`[tpsl-cron] Force-close failed for remaining position ${rem.id}:`, remErr.message)
          }
        }
        console.log(`[tpsl-cron] Force-closed ${forceClosedCount} additional positions for account ${account.id}`)
      }
    } catch (remainErr) {
      console.error(`[tpsl-cron] Failed to query remaining positions for account ${account.id}:`, remainErr.message)
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

      // FIX Bug 6: use account.min_trading_days, fall back to 5
      const minDays = account.min_trading_days || 5
      if (tradingDays >= minDays) {
        // FIX Bug 2: increment total_trades and winning_trades
        const updatedTrades  = (account.total_trades  || 0) + 1
        const updatedWinning = pnl > 0 ? (account.winning_trades || 0) + 1 : (account.winning_trades || 0)
        await db.update(
          'demo_accounts',
          {
            current_balance: newBalance,
            equity:          newBalance,
            status:          'passed',
            total_trades:    updatedTrades,
            winning_trades:  updatedWinning,
            updated_at:      now,
          },
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
  // FIX Bug 2: increment total_trades and winning_trades on every close
  const updatedTrades  = (account.total_trades  || 0) + 1
  const updatedWinning = pnl > 0 ? (account.winning_trades || 0) + 1 : (account.winning_trades || 0)
  try {
    await db.update(
      'demo_accounts',
      {
        current_balance: newBalance,
        equity:          newBalance,
        high_water_mark: newHWM,
        total_trades:    updatedTrades,
        winning_trades:  updatedWinning,
        updated_at:      now,
      },
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
export default async function handler(req, res) {
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
      'status=eq.open&select=id,demo_account_id,user_id,symbol,side,quantity,entry_price,take_profit,stop_loss,margin,leverage,opened_at,liquidation_price'
    )

    if (!positions.length) {
      return res.status(200).json({
        ok:      true,
        message: 'No open positions',
        elapsed: Date.now() - startTime,
      })
    }

    // 2. Cascade: Bybit -> OKX -> Binance
    const priceMap = await fetchPrices()

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
    const checked = []
    let   skipped = 0

    for (const position of positions) {
      const currentPrice = priceMap[position.symbol]
      if (!currentPrice) {
        skipped++
        checked.push({ id: position.id, symbol: position.symbol, action: 'no_price' })
        continue
      }

      const reason = shouldClose(position, currentPrice)

      console.log(
        `[tpsl-cron] ${position.symbol} ${position.side}`,
        `entry=${position.entry_price} price=${currentPrice}`,
        `tp=${position.take_profit} sl=${position.stop_loss}`,
        `=> ${reason || 'hold'}`
      )

      checked.push({
        symbol: position.symbol,
        side:   position.side,
        price:  currentPrice,
        tp:     position.take_profit,
        sl:     position.stop_loss,
        action: reason || 'hold',
      })

      if (!reason) continue

      try {
        // Close at the exact trigger price, not the snapshot market price.
        // The cron runs every 60s so currentPrice can differ from the TP/SL level.
        // SAFETY: always validate fillPrice is a finite number before using it.
        // parseFloat(undefined) = NaN which would corrupt current_balance in the DB.
        const rawFillPrice = reason === 'tp'
          ? parseFloat(position.take_profit)
          : reason === 'sl'
          ? parseFloat(position.stop_loss)
          : reason === 'liquidation'
          ? parseFloat(position.liquidation_price)
          : currentPrice
        const fillPrice = isFinite(rawFillPrice) && rawFillPrice > 0 ? rawFillPrice : currentPrice
        const result = await closePosition(db, position, fillPrice, reason, priceMap)
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
      ok:            true,
      elapsed:       Date.now() - startTime,
      positionCount: positions.length,
      closed,
      errors,
      skipped,
      checked,
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
