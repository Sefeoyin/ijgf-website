/**
 * /api/tpsl-cron.js — Server-side TP/SL & liquidation monitor
 *
 * Runs on a schedule (see vercel.json) so positions are closed even when
 * NO user has the dashboard open. This solves the core problem:
 * useTPSLMonitor only runs while the browser tab is open.
 *
 * Architecture:
 *   - Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS (no user session needed)
 *   - Fetches ALL open positions across ALL users in one query
 *   - Batch-fetches current prices from Binance via one API call
 *   - Closes triggered positions atomically (.eq('status','open') guard)
 *   - Updates account balances and logs closing trades
 *
 * Security:
 *   - Verifies CRON_SECRET header so only Vercel (or a trusted caller) can trigger it
 *   - Set CRON_SECRET as a Vercel env var. Add it to Authorization header when testing.
 *
 * Required env vars (set in Vercel dashboard → Settings → Environment Variables):
 *   SUPABASE_URL              — your project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (NOT the anon key)
 *   CRON_SECRET               — any random string, e.g. openssl rand -hex 32
 */

import { createClient } from '@supabase/supabase-js'

// Admin client — bypasses RLS, can read/write any row
function getAdminClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ---------------------------------------------------------------------------
// Price fetching — single Binance call for all needed symbols
// ---------------------------------------------------------------------------
async function fetchPrices(symbols) {
  if (!symbols.length) return {}
  try {
    // /api/prices is our own Vercel proxy — server calling server is fine.
    // Alternatively call Binance directly (no geo-block from Vercel servers).
    const res = await fetch(
      `https://fapi.binance.com/fapi/v1/ticker/price`,
      { signal: AbortSignal.timeout(5000), headers: { 'User-Agent': 'IJGF-Cron/1.0' } }
    )
    if (!res.ok) throw new Error(`Binance HTTP ${res.status}`)
    const tickers = await res.json() // [{ symbol, price }, ...]
    const map = {}
    for (const t of tickers) {
      if (symbols.includes(t.symbol)) {
        map[t.symbol] = parseFloat(t.price) || 0
      }
    }
    return map
  } catch (err) {
    console.error('[tpsl-cron] Price fetch failed:', err.message)
    return {}
  }
}

// ---------------------------------------------------------------------------
// Close a single position atomically and update the account balance
// ---------------------------------------------------------------------------
async function closePosition(supabase, pos, closePrice, reason) {
  const pnl = pos.side === 'LONG'
    ? (closePrice - pos.entry_price) * pos.quantity
    : (pos.entry_price - closePrice) * pos.quantity

  const closedAt = new Date().toISOString()

  // Step 1: atomic claim — only succeeds if still 'open'
  const { data: claimed, error: claimErr } = await supabase
    .from('demo_positions')
    .update({
      status: reason === 'liquidation' ? 'liquidated' : 'closed',
      unrealized_pnl: 0,
      closed_at: closedAt,
    })
    .eq('id', pos.id)
    .eq('status', 'open') // prevents double-close from concurrent cron + browser
    .select('id')

  if (claimErr) throw new Error(`Claim failed: ${claimErr.message}`)
  if (!claimed || claimed.length === 0) {
    // Already closed by another process (browser tab / another cron invocation)
    return null
  }

  // Step 2: fetch the account to get current balance
  const { data: account, error: accErr } = await supabase
    .from('demo_accounts')
    .select('*')
    .eq('id', pos.demo_account_id)
    .single()

  if (accErr || !account) throw new Error(`Account fetch failed: ${accErr?.message}`)

  // Step 3: update balance — margin returned + PNL added
  const marginToReturn = pos.margin || 0
  const newBalance = Math.max(0, account.current_balance + marginToReturn + pnl)

  const { error: balErr } = await supabase
    .from('demo_accounts')
    .update({
      current_balance: newBalance,
      equity: newBalance,
      total_trades: account.total_trades + 1,
      winning_trades: pnl > 0 ? account.winning_trades + 1 : account.winning_trades,
      updated_at: closedAt,
    })
    .eq('id', pos.demo_account_id)

  if (balErr) throw new Error(`Balance update failed: ${balErr.message}`)

  // Step 4: check challenge rules (drawdown / profit target)
  await checkChallengeRulesAdmin(supabase, account, newBalance, pos.user_id)

  // Step 5: log the closing trade
  const closeSide = pos.side === 'LONG' ? 'SELL' : 'BUY'
  await supabase.from('demo_trades').insert({
    demo_account_id: pos.demo_account_id,
    user_id: pos.user_id,
    position_id: pos.id,
    symbol: pos.symbol,
    side: closeSide,
    order_type: 'MARKET',
    price: closePrice,
    quantity: pos.quantity,
    leverage: pos.leverage,
    total: closePrice * pos.quantity,
    fee: 0,
    realized_pnl: pnl,
    is_close: true,
    opened_at: pos.opened_at ?? null,
    closed_at: closedAt,
    executed_at: closedAt,
  })

  console.log(
    `[tpsl-cron] Closed ${pos.symbol} ${pos.side} | reason=${reason}`,
    `| pnl=${pnl.toFixed(2)} | user=${pos.user_id.slice(0,8)}...`
  )

  return { pnl, newBalance, reason }
}

// ---------------------------------------------------------------------------
// Challenge rules check (server-side, no RLS)
// ---------------------------------------------------------------------------
async function checkChallengeRulesAdmin(supabase, account, newBalance, userId) {
  if (account.status !== 'active') return

  const totalDrawdown = account.initial_balance - newBalance

  // Max drawdown breached
  if (totalDrawdown >= account.max_total_drawdown) {
    await supabase.from('demo_accounts')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', account.id)

    try {
      await supabase.from('challenge_violations').insert({
        demo_account_id: account.id,
        user_id: userId,
        violation_type: 'MAX_DRAWDOWN',
        description: `[Cron] Drawdown $${totalDrawdown.toFixed(2)} exceeded $${account.max_total_drawdown}`,
        balance_at_violation: newBalance,
        violation_amount: totalDrawdown,
      })
    } catch { /* non-critical */ }
    return
  }

  // Profit target hit — check trading days
  const totalProfit = newBalance - account.initial_balance
  if (totalProfit >= account.profit_target) {
    const { data: trades } = await supabase
      .from('demo_trades')
      .select('executed_at')
      .eq('demo_account_id', account.id)
      .eq('is_close', true)

    const tradingDays = new Set(
      (trades || []).map(t => t.executed_at.split('T')[0])
    ).size

    const MIN_DAYS = 5
    if (tradingDays >= MIN_DAYS) {
      await supabase.from('demo_accounts')
        .update({ status: 'passed', updated_at: new Date().toISOString() })
        .eq('id', account.id)
    }
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  // Security: verify the caller is authorised
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers['authorization']
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const startMs = Date.now()
  let supabase
  try {
    supabase = getAdminClient()
  } catch (err) {
    console.error('[tpsl-cron] Admin client init failed:', err.message)
    return res.status(500).json({ error: err.message })
  }

  // 1. Fetch all open positions that have TP, SL, or a liquidation price
  const { data: positions, error: posErr } = await supabase
    .from('demo_positions')
    .select('*')
    .eq('status', 'open')

  if (posErr) {
    console.error('[tpsl-cron] Position fetch error:', posErr.message)
    return res.status(500).json({ error: posErr.message })
  }

  if (!positions || positions.length === 0) {
    return res.status(200).json({ checked: 0, closed: 0, ms: Date.now() - startMs })
  }

  // 2. Fetch current prices for all unique symbols in one Binance call
  const symbols = [...new Set(positions.map(p => p.symbol))]
  const priceMap = await fetchPrices(symbols)

  if (Object.keys(priceMap).length === 0) {
    // Price fetch failed entirely — bail out rather than close positions at $0
    console.warn('[tpsl-cron] No prices returned, skipping check')
    return res.status(200).json({ checked: positions.length, closed: 0, pricesFailed: true })
  }

  // 3. Evaluate each position
  const results = { checked: positions.length, closed: 0, skipped: 0, errors: 0 }

  for (const pos of positions) {
    const cp = priceMap[pos.symbol]
    if (!cp || cp <= 0) { results.skipped++; continue }

    // Determine trigger reason (priority: liquidation > TP > SL)
    let reason = null

    if (pos.liquidation_price) {
      if (pos.side === 'LONG'  && cp <= pos.liquidation_price) reason = 'liquidation'
      if (pos.side === 'SHORT' && cp >= pos.liquidation_price) reason = 'liquidation'
    }

    if (!reason && pos.take_profit) {
      if (pos.side === 'LONG'  && cp >= pos.take_profit) reason = 'tp'
      if (pos.side === 'SHORT' && cp <= pos.take_profit) reason = 'tp'
    }

    if (!reason && pos.stop_loss) {
      if (pos.side === 'LONG'  && cp <= pos.stop_loss) reason = 'sl'
      if (pos.side === 'SHORT' && cp >= pos.stop_loss) reason = 'sl'
    }

    if (!reason) continue

    try {
      const result = await closePosition(supabase, pos, cp, reason)
      if (result) results.closed++
      // result === null means already closed concurrently — that's fine
    } catch (err) {
      results.errors++
      console.error('[tpsl-cron] Close error:', pos.id, err.message)
    }
  }

  results.ms = Date.now() - startMs
  console.log('[tpsl-cron] Done:', results)
  return res.status(200).json(results)
}
