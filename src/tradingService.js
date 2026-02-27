/**
 * tradingService.js — Demo trading logic
 * All Supabase calls use anon key + RLS
 */

import { supabase } from './supabase'

// No trading fees — revenue comes from challenge fees

const CHALLENGE_CONFIGS = {
  '5k':   { initial: 5000,   profitTarget: 500,   dailyLoss: null, maxDrawdown: 400,  minTradingDays: 5 },
  '10k':  { initial: 10000,  profitTarget: 1000,  dailyLoss: null, maxDrawdown: 800,  minTradingDays: 5 },
  '25k':  { initial: 25000,  profitTarget: 2500,  dailyLoss: null, maxDrawdown: 2000, minTradingDays: 5 },
  '50k':  { initial: 50000,  profitTarget: 5000,  dailyLoss: null, maxDrawdown: 4000, minTradingDays: 5 },
  '100k': { initial: 100000, profitTarget: 10000, dailyLoss: null, maxDrawdown: 8000, minTradingDays: 5 },
}

// Platform-wide minimum — fallback if column absent from DB row
export const MIN_TRADING_DAYS = 5

// 100x leverage for all instruments
export const MAX_LEVERAGE = {
  DEFAULT: 100,
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------
export async function getOrCreateDemoAccount(userId, challengeType = '10k') {
  if (!userId) throw new Error('No user ID provided')

  // 1) Try active
  const { data: existing, error: fetchErr } = await supabase
    .from('demo_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('challenge_type', challengeType)
    .eq('status', 'active')
    .maybeSingle()

  if (fetchErr) {
    console.error('[Trading] Fetch account error:', fetchErr)
    throw new Error(`Failed to fetch account: ${fetchErr.message}`)
  }
  if (existing) {
    // Self-heal: correct any stale config values (e.g. max_total_drawdown changed)
    const config = CHALLENGE_CONFIGS[challengeType] || CHALLENGE_CONFIGS['10k']
    const needsFix = existing.max_total_drawdown !== config.maxDrawdown ||
                     existing.profit_target !== config.profitTarget
    if (needsFix) {
      const { data: fixed } = await supabase
        .from('demo_accounts')
        .update({
          max_total_drawdown: config.maxDrawdown,
          profit_target: config.profitTarget,
        })
        .eq('id', existing.id)
        .select()
        .single()
      if (fixed) return fixed
    }
    return existing
  }

  // 2) Check any status (failed/passed/expired)
  const { data: anyAccount } = await supabase
    .from('demo_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('challenge_type', challengeType)
    .maybeSingle()

  if (anyAccount) return anyAccount

  // 3) Create new
  const config = CHALLENGE_CONFIGS[challengeType] || CHALLENGE_CONFIGS['10k']
  const { data: account, error: insertErr } = await supabase
    .from('demo_accounts')
    .insert({
      user_id: userId,
      challenge_type: challengeType,
      initial_balance: config.initial,
      current_balance: config.initial,
      equity: config.initial,
      profit_target: config.profitTarget,
      max_daily_loss: config.dailyLoss,
      max_total_drawdown: config.maxDrawdown,
      high_water_mark: config.initial,
    })
    .select()
    .single()

  if (insertErr) {
    console.error('[Trading] Create account error:', insertErr)
    throw new Error(`Failed to create demo account: ${insertErr.message}`)
  }
  console.log('[Trading] Created demo account:', account.id)
  return account
}

export async function getAccountState(userId) {
  const account = await getOrCreateDemoAccount(userId)

  const [posRes, ordRes, tradeRes] = await Promise.all([
    supabase
      .from('demo_positions')
      .select('*')
      .eq('demo_account_id', account.id)
      .eq('status', 'open')
      .order('opened_at', { ascending: false }),
    supabase
      .from('demo_orders')
      .select('*')
      .eq('demo_account_id', account.id)
      .eq('status', 'open')
      .order('created_at', { ascending: false }),
    supabase
      .from('demo_trades')
      .select('*')
      .eq('demo_account_id', account.id)
      .order('executed_at', { ascending: false })
      .limit(50),
  ])

  // Count distinct calendar days where the trader CLOSED at least one trade.
  // Opening a position does not count — the day is only marked after closing.
  let tradingDays = 0
  try {
    tradingDays = new Set(
      (tradeRes.data || []).filter(t => t.is_close === true).map(t => t.executed_at.split('T')[0])
    ).size
  } catch { /* non-critical */ }

  return {
    account,
    positions: posRes.data || [],
    orders: ordRes.data || [],
    recentTrades: tradeRes.data || [],
    tradingDays,
  }
}

// ---------------------------------------------------------------------------
// Market Order
// ---------------------------------------------------------------------------
export async function placeMarketOrder({
  userId, symbol, side, sizeUsdt, leverage, currentPrice,
  takeProfit = null, stopLoss = null,
}) {
  console.log('[Trading] Market order:', { symbol, side, sizeUsdt, leverage, currentPrice })

  if (!currentPrice || currentPrice <= 0) throw new Error('Invalid price')
  if (!sizeUsdt || sizeUsdt <= 0) throw new Error('Invalid size')

  const maxLev = MAX_LEVERAGE[symbol] ?? MAX_LEVERAGE.DEFAULT
  if (leverage > maxLev) throw new Error(`Max leverage for ${symbol} is ${maxLev}x`)

  const account = await getOrCreateDemoAccount(userId)
  if (account.status !== 'active') throw new Error(`Challenge is ${account.status}`)

  const quantity = sizeUsdt / currentPrice
  const margin = sizeUsdt / leverage
  const fee = 0

  if (margin > account.current_balance) {
    throw new Error(`Insufficient balance. Need $${margin.toFixed(2)}, have $${account.current_balance.toFixed(2)}`)
  }

  // Check for existing opposite position
  const { data: existingPos } = await supabase
    .from('demo_positions')
    .select('*')
    .eq('demo_account_id', account.id)
    .eq('symbol', symbol)
    .eq('status', 'open')
    .maybeSingle()

  const positionSide = side === 'BUY' ? 'LONG' : 'SHORT'

  if (existingPos && existingPos.side !== positionSide) {
    console.log('[Trading] Closing opposite position:', existingPos.id)
    await closePosition({ userId, positionId: existingPos.id, currentPrice, reason: 'reversed' })
    const refreshed = await getOrCreateDemoAccount(userId)
    if (margin > refreshed.current_balance) {
      throw new Error('Insufficient balance after closing opposite position')
    }
  }

  const liqPrice = positionSide === 'LONG'
    ? currentPrice * (1 - 1 / leverage * 0.95)
    : currentPrice * (1 + 1 / leverage * 0.95)

  // Insert position
  const { data: position, error: posErr } = await supabase
    .from('demo_positions')
    .insert({
      demo_account_id: account.id,
      user_id: userId,
      symbol,
      side: positionSide,
      entry_price: currentPrice,
      quantity,
      leverage,
      margin,
      liquidation_price: liqPrice,
      take_profit: takeProfit,
      stop_loss: stopLoss,
    })
    .select()
    .single()

  if (posErr) {
    console.error('[Trading] Insert position error:', posErr)
    throw new Error(`Failed to open position: ${posErr.message}`)
  }

  // Trade log
  const { error: tradeErr } = await supabase
    .from('demo_trades')
    .insert({
      demo_account_id: account.id,
      user_id: userId,
      position_id: position.id,
      symbol, side,
      order_type: 'MARKET',
      price: currentPrice,
      quantity, leverage,
      total: sizeUsdt,
      fee,
      is_close: false,
    })

  if (tradeErr) console.error('[Trading] Trade log error:', tradeErr)

  // Update balance
  const newBalance = account.current_balance - margin
  await updateAccountBalance(account.id, newBalance)

  // Challenge rules (non-blocking)
  safeCheckRules(account.id, userId)

  console.log('[Trading] Position opened:', position.id, '| Margin:', margin, '| Fee:', fee)
  return { position, fee, margin }
}

// ---------------------------------------------------------------------------
// Limit / Stop-Limit Order
// ---------------------------------------------------------------------------
export async function placeLimitOrder({
  userId, symbol, side, orderType, price, stopPrice = null,
  sizeUsdt, leverage, takeProfit = null, stopLoss = null,
}) {
  console.log('[Trading] Limit order:', { symbol, side, orderType, price, sizeUsdt })

  if (orderType === 'STOP_LIMIT' && !stopPrice) {
    throw new Error('Stop price required for stop-limit orders')
  }

  const account = await getOrCreateDemoAccount(userId)
  if (account.status !== 'active') throw new Error(`Challenge is ${account.status}`)

  const quantity = sizeUsdt / price
  const margin = sizeUsdt / leverage

  if (margin > account.current_balance) {
    throw new Error('Insufficient balance')
  }

  const { data: order, error } = await supabase
    .from('demo_orders')
    .insert({
      demo_account_id: account.id,
      user_id: userId,
      symbol, side, order_type: orderType,
      price, stop_price: stopPrice,
      quantity, leverage,
      take_profit: takeProfit,
      stop_loss: stopLoss,
    })
    .select()
    .single()

  if (error) {
    console.error('[Trading] Insert order error:', error)
    throw new Error(`Failed to place order: ${error.message}`)
  }

  console.log('[Trading] Order placed:', order.id)
  return order
}

// ---------------------------------------------------------------------------
// Cancel Order
// ---------------------------------------------------------------------------
export async function cancelOrder(userId, orderId) {
  const { data, error } = await supabase
    .from('demo_orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('user_id', userId)
    .eq('status', 'open')
    .select()
    .single()

  if (error) {
    console.error('[Trading] Cancel order error:', error)
    throw new Error(`Failed to cancel: ${error.message}`)
  }
  return data
}

// ---------------------------------------------------------------------------
// Close Position
// ---------------------------------------------------------------------------
export async function closePosition({ userId, positionId, currentPrice, reason = 'manual' }) {
  // 1. Fetch the open position — locked to this user + open status
  const { data: pos, error: fetchErr } = await supabase
    .from('demo_positions')
    .select('*')
    .eq('id', positionId)
    .eq('user_id', userId)
    .eq('status', 'open')
    .single()

  if (fetchErr || !pos) {
    console.error('[Trading] Close position fetch error:', fetchErr)
    throw new Error('Position not found or already closed')
  }

  // 2. Compute realized PNL
  const pnl = pos.side === 'LONG'
    ? (currentPrice - pos.entry_price) * pos.quantity
    : (pos.entry_price - currentPrice) * pos.quantity

  const closedAt = new Date().toISOString()

  // 3. Mark position as closed — atomic claim (only if still 'open')
  const { data: closedPos, error: closeErr } = await supabase
    .from('demo_positions')
    .update({
      status: reason === 'liquidation' ? 'liquidated' : 'closed',
      unrealized_pnl: 0,
      closed_at: closedAt,
    })
    .eq('id', positionId)
    .eq('status', 'open')  // guard: prevents double-close race condition
    .select('id')

  if (closeErr) {
    console.error('[Trading] Close position update error:', closeErr)
    throw new Error(`Failed to close position: ${closeErr.message}`)
  }

  // If nothing was updated, position was already closed by a concurrent call (TP/SL race)
  if (!closedPos || closedPos.length === 0) {
    console.warn('[Trading] Position already closed (concurrent close detected):', positionId)
    throw new Error('Position already closed')
  }

  // 4. Fetch the account directly by demo_account_id (NOT by userId default lookup)
  //    Using pos.demo_account_id avoids the race where getOrCreateDemoAccount returns
  //    a stale/different account, causing balance to be written to the wrong row.
  const { data: account, error: accErr } = await supabase
    .from('demo_accounts')
    .select('*')
    .eq('id', pos.demo_account_id)
    .single()

  if (accErr || !account) {
    console.error('[Trading] Account fetch error after close:', accErr)
    // Balance fetch failed — log for manual reconciliation but don't throw
    // Position is already marked closed; throwing here would leave an inconsistent state
    console.error('[Trading] CRITICAL: Balance NOT updated for position', positionId, 'PNL:', pnl)
    // Attempt a best-effort balance recovery via userId
    try {
      const fallback = await getOrCreateDemoAccount(userId)
      const recoveredBalance = fallback.current_balance + (pos.margin || 0) + pnl
      await supabase.from('demo_accounts').update({
        current_balance: Math.max(0, recoveredBalance),
        equity: Math.max(0, recoveredBalance),
        updated_at: closedAt,
      }).eq('id', fallback.id)
      console.warn('[Trading] Balance recovered via fallback account')
    } catch (recErr) {
      console.error('[Trading] Balance recovery also failed:', recErr)
    }
    return { pnl, fee: 0, newBalance: null }
  }

  // 5. Compute and write new balance — margin is returned to the free balance
  const marginToReturn = pos.margin || 0
  const newBalance = account.current_balance + marginToReturn + pnl

  const { error: balanceErr } = await supabase
    .from('demo_accounts')
    .update({
      current_balance: Math.max(0, newBalance),
      equity:          Math.max(0, newBalance),
      total_trades:    account.total_trades + 1,
      winning_trades:  pnl > 0 ? account.winning_trades + 1 : account.winning_trades,
      updated_at:      closedAt,
    })
    .eq('id', pos.demo_account_id)

  if (balanceErr) {
    console.error('[Trading] CRITICAL: Balance update failed for position', positionId, balanceErr)
    throw new Error(`Balance update failed: ${balanceErr.message}`)
  }

  // 6. Log the closing trade — runs AFTER balance update to ensure atomic visibility
  const closeSide = pos.side === 'LONG' ? 'SELL' : 'BUY'
  const { error: tradeLogErr } = await supabase.from('demo_trades').insert({
    demo_account_id: pos.demo_account_id,
    user_id:         userId,
    position_id:     positionId,
    symbol:          pos.symbol,
    side:            closeSide,
    order_type:      'MARKET',
    price:           currentPrice,
    quantity:        pos.quantity,
    leverage:        pos.leverage,
    total:           currentPrice * pos.quantity,
    fee:             0,
    realized_pnl:    pnl,
    is_close:        true,
    opened_at:       pos.opened_at ?? null,
    closed_at:       closedAt,
    executed_at:     closedAt,
  })

  if (tradeLogErr) {
    // Non-critical: balance is already updated. Log for investigation but don't throw.
    console.error('[Trading] Trade log insert failed (balance already updated):', tradeLogErr)
  }

  // 7. Challenge rules check (non-blocking — must never revert balance)
  safeCheckRules(pos.demo_account_id, userId)

  console.log(
    '[Trading] Position closed:',  positionId,
    '| Symbol:',                   pos.symbol,
    '| PNL:',                      pnl.toFixed(2),
    '| Margin returned:',          marginToReturn.toFixed(2),
    '| New balance:',              Math.max(0, newBalance).toFixed(2),
    '| Reason:',                   reason,
  )

  return { pnl, fee: 0, newBalance: Math.max(0, newBalance) }
}

// ---------------------------------------------------------------------------
// Check pending orders
// ---------------------------------------------------------------------------
export async function checkPendingOrders(userId, priceMap) {
  const { data: orders } = await supabase
    .from('demo_orders')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'open')

  if (!orders || orders.length === 0) return []

  const filled = []

  for (const order of orders) {
    const cp = priceMap[order.symbol]
    if (!cp) continue

    let shouldFill = false

    if (order.order_type === 'LIMIT') {
      shouldFill = order.side === 'BUY' ? cp <= order.price : cp >= order.price
    } else if (order.order_type === 'STOP_LIMIT' && order.stop_price) {
      const triggered = order.side === 'BUY' ? cp >= order.stop_price : cp <= order.stop_price
      if (triggered) {
        shouldFill = order.side === 'BUY' ? cp <= order.price : cp >= order.price
      }
    }

    if (shouldFill) {
      try {
        // Atomic claim: update only if still 'open' — prevents double-fill from StrictMode
        const { data: claimed } = await supabase
          .from('demo_orders')
          .update({ status: 'filled', filled_qty: order.quantity, updated_at: new Date().toISOString() })
          .eq('id', order.id)
          .eq('status', 'open')
          .select('id')

        if (!claimed || claimed.length === 0) {
          console.log('[Trading] Order already claimed, skipping:', order.id)
          continue
        }

        try {
          const fillSize = order.price * order.quantity
          await placeMarketOrder({
            userId,
            symbol: order.symbol,
            side: order.side,
            sizeUsdt: fillSize,
            leverage: order.leverage,
            currentPrice: order.price,
            takeProfit: order.take_profit,
            stopLoss: order.stop_loss,
          })
          filled.push(order)
          console.log('[Trading] Order filled:', order.id, order.symbol, order.side, '@', order.price)
        } catch (execErr) {
          console.error('[Trading] Fill execution failed, reverting:', order.id, execErr)
          await supabase.from('demo_orders')
            .update({ status: 'open', updated_at: new Date().toISOString() })
            .eq('id', order.id)
        }
      } catch (err) {
        console.error('[Trading] Fill order error:', order.id, err)
      }
    }
  }

  return filled
}

// ---------------------------------------------------------------------------
// Check TP/SL
// ---------------------------------------------------------------------------
export async function checkPositionTPSL(userId, priceMap) {
  const { data: positions } = await supabase
    .from('demo_positions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'open')

  if (!positions || positions.length === 0) return []

  const closed = []

  for (const pos of positions) {
    const cp = priceMap[pos.symbol]
    if (!cp) continue

    let closeReason = null

    if (pos.side === 'LONG' && cp <= pos.liquidation_price) closeReason = 'liquidation'
    else if (pos.side === 'SHORT' && cp >= pos.liquidation_price) closeReason = 'liquidation'

    if (!closeReason && pos.take_profit) {
      if (pos.side === 'LONG' && cp >= pos.take_profit) closeReason = 'tp'
      if (pos.side === 'SHORT' && cp <= pos.take_profit) closeReason = 'tp'
    }

    if (!closeReason && pos.stop_loss) {
      if (pos.side === 'LONG' && cp <= pos.stop_loss) closeReason = 'sl'
      if (pos.side === 'SHORT' && cp >= pos.stop_loss) closeReason = 'sl'
    }

    if (closeReason) {
      try {
        const result = await closePosition({ userId, positionId: pos.id, currentPrice: cp, reason: closeReason })
        closed.push({ ...pos, closeReason, ...result })
      } catch (err) {
        console.error('[Trading] TP/SL close error:', pos.id, err)
      }
    }
  }

  return closed
}

// ---------------------------------------------------------------------------
// Unrealized PNL (pure)
// ---------------------------------------------------------------------------
export function computeUnrealizedPNL(positions, priceMap) {
  return positions.map(pos => {
    const cp = priceMap[pos.symbol] || pos.entry_price
    const pnl = pos.side === 'LONG'
      ? (cp - pos.entry_price) * pos.quantity
      : (pos.entry_price - cp) * pos.quantity
    const roi = pos.margin ? (pnl / pos.margin) * 100 : 0
    return { ...pos, unrealized_pnl: pnl, roi }
  })
}

// ---------------------------------------------------------------------------
// Challenge rules — WRAPPED IN TRY/CATCH so failures never block trades
// ---------------------------------------------------------------------------
async function safeCheckRules(accountId, userId) {
  try {
    await checkChallengeRules(accountId, userId)
  } catch (err) {
    console.error('[Trading] Challenge rules check failed (non-blocking):', err)
  }
}

async function checkChallengeRules(accountId, userId) {
  const { data: account } = await supabase
    .from('demo_accounts')
    .select('*')
    .eq('id', accountId)
    .single()

  if (!account || account.status !== 'active') return null

  // Fetch open positions to compute true equity.
  // current_balance has margin deducted, so without this we'd see
  // false drawdown breaches on any open position.
  const { data: openPositions } = await supabase
    .from('demo_positions')
    .select('margin, unrealized_pnl')
    .eq('demo_account_id', accountId)
    .eq('status', 'open')

  const lockedMargin = (openPositions || []).reduce((sum, p) => sum + (p.margin || 0), 0)
  const unrealizedPNL = (openPositions || []).reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0)

  // True equity = cash balance + margin locked in positions + unrealized PNL
  const trueEquity = account.current_balance + lockedMargin + unrealizedPNL

  const totalDrawdown = account.initial_balance - trueEquity

  // Max drawdown
  if (totalDrawdown >= account.max_total_drawdown) {
    try {
      await supabase.from('challenge_violations').insert({
        demo_account_id: accountId, user_id: userId,
        violation_type: 'MAX_DRAWDOWN',
        description: `Drawdown $${totalDrawdown.toFixed(2)} exceeded $${account.max_total_drawdown}`,
        balance_at_violation: trueEquity, violation_amount: totalDrawdown,
      })
    } catch { /* non-critical */ }

    await supabase
      .from('demo_accounts')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', accountId)
    return { failed: true, reason: 'MAX_DRAWDOWN' }
  }

  // Daily loss — use true equity vs start-of-day balance
  let dayStart = account.initial_balance
  try {
    const { data: todaySnap } = await supabase
      .from('challenge_progress')
      .select('starting_balance')
      .eq('demo_account_id', accountId)
      .eq('snapshot_date', new Date().toISOString().split('T')[0])
      .maybeSingle()
    if (todaySnap?.starting_balance) dayStart = todaySnap.starting_balance
  } catch { /* use initial_balance */ }

  const dailyLoss = dayStart - trueEquity
  if (dailyLoss >= account.max_daily_loss) {
    try {
      await supabase.from('challenge_violations').insert({
        demo_account_id: accountId, user_id: userId,
        violation_type: 'DAILY_LOSS',
        description: `Daily loss $${dailyLoss.toFixed(2)} exceeded $${account.max_daily_loss}`,
        balance_at_violation: trueEquity, violation_amount: dailyLoss,
      })
    } catch { /* non-critical */ }

    await supabase
      .from('demo_accounts')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', accountId)
    return { failed: true, reason: 'DAILY_LOSS' }
  }

  // Profit target — also use true equity
  // CRITICAL: trader must ALSO have completed min_trading_days before passing
  const totalProfit = trueEquity - account.initial_balance
  if (totalProfit >= account.profit_target) {
    // Count distinct calendar days with trades
    const { data: allTrades } = await supabase
      .from('demo_trades')
      .select('executed_at')
      .eq('demo_account_id', accountId)

    const tradingDays = new Set(
      (allTrades || []).filter(t => t.is_close === true).map(t => t.executed_at.split('T')[0])
    ).size

    const minDays = CHALLENGE_CONFIGS[account.challenge_type]?.minTradingDays ?? MIN_TRADING_DAYS

    if (tradingDays >= minDays) {
      // All conditions met — mark as passed
      await supabase
        .from('demo_accounts')
        .update({ status: 'passed', updated_at: new Date().toISOString() })
        .eq('id', accountId)
      return { passed: true, tradingDays }
    }

    // Target hit but not enough days — stay active, return pending state
    return { status: 'active', pendingPass: true, tradingDays, minDays }
  }

  // Count trading days for state tracking even if target not yet hit
  const { data: daysTrades } = await supabase
    .from('demo_trades')
    .select('executed_at, is_close')
    .eq('demo_account_id', accountId)
  const tradingDays = new Set(
    (daysTrades || []).filter(t => t.is_close === true).map(t => t.executed_at.split('T')[0])
  ).size

  // High water mark
  if (trueEquity > account.high_water_mark) {
    await supabase
      .from('demo_accounts')
      .update({ high_water_mark: trueEquity, updated_at: new Date().toISOString() })
      .eq('id', accountId)
  }

  return { status: 'active', tradingDays }
}

async function updateAccountBalance(accountId, newBalance) {
  const equity = Math.max(0, newBalance)
  const { error } = await supabase
    .from('demo_accounts')
    .update({ current_balance: equity, equity, updated_at: new Date().toISOString() })
    .eq('id', accountId)
  if (error) console.error('[Trading] Update balance error:', error)
}

// ---------------------------------------------------------------------------
// Update TP / SL on an existing open position
// ---------------------------------------------------------------------------
export async function updatePositionTPSL(positionId, userId, { takeProfit, stopLoss }) {
  const updates = {
    take_profit: (takeProfit != null && takeProfit !== '') ? parseFloat(takeProfit) : null,
    stop_loss:   (stopLoss   != null && stopLoss   !== '') ? parseFloat(stopLoss)   : null,
  }
  const { error } = await supabase
    .from('demo_positions')
    .update(updates)
    .eq('id', positionId)
    .eq('user_id', userId)
    .eq('status', 'open')
  if (error) throw new Error(`Failed to update TP/SL: ${error.message}`)
}

export async function resetDemoAccount(userId, challengeType = '10k') {
  // Close any open positions and orders on the current account
  await supabase.from('demo_positions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('user_id', userId).eq('status', 'open')
  await supabase.from('demo_orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('status', 'open')

  // Archive the old account by renaming its challenge_type with a timestamp suffix.
  // This preserves all trade history and analytics while allowing a fresh account
  // with the original challenge_type to be created.
  const archiveSuffix = `_archived_${Date.now()}`
  await supabase.from('demo_accounts')
    .update({ challenge_type: `${challengeType}${archiveSuffix}`, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('challenge_type', challengeType)

  return getOrCreateDemoAccount(userId, challengeType)
}

// ---------------------------------------------------------------------------
// Reconcile Balance
// Rebuilds account.current_balance from the ground truth in demo_trades,
// without deleting any history. Safe to run at any time.
//
// Formula:
//   correct_balance = initial_balance
//                     + Σ realized_pnl (all closed positions)
//                     - Σ margin       (all currently open positions)
//
// This repairs any balance desync caused by the old fire-and-forget bug
// where closePosition logged the trade but failed to update the balance row.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Trading Days Counter
// Returns the number of distinct calendar days an account has traded.
// ---------------------------------------------------------------------------
export async function getTradingDays(accountId) {
  if (!accountId) return 0
  const { data, error } = await supabase
    .from('demo_trades')
    .select('executed_at')
    .eq('demo_account_id', accountId)

  if (error || !data) return 0
  return new Set(data.filter(t => t.is_close === true).map(t => t.executed_at.split('T')[0])).size
}

export async function reconcileDemoAccount(userId, challengeType = '10k') {
  const account = await getOrCreateDemoAccount(userId, challengeType)

  // 1. All closing trades — these are the source of truth for realized PNL
  const { data: closingTrades, error: tradesErr } = await supabase
    .from('demo_trades')
    .select('realized_pnl')
    .eq('demo_account_id', account.id)
    .eq('is_close', true)

  if (tradesErr) throw new Error(`Failed to fetch trade history: ${tradesErr.message}`)

  const totalRealizedPnl = (closingTrades || []).reduce(
    (sum, t) => sum + (t.realized_pnl || 0), 0
  )
  const totalClosedTrades = (closingTrades || []).length
  const winningTrades     = (closingTrades || []).filter(t => (t.realized_pnl || 0) > 0).length

  // 2. Open positions — margin is currently locked (not in free balance)
  const { data: openPositions, error: posErr } = await supabase
    .from('demo_positions')
    .select('margin')
    .eq('demo_account_id', account.id)
    .eq('status', 'open')

  if (posErr) throw new Error(`Failed to fetch open positions: ${posErr.message}`)

  const totalMarginLocked = (openPositions || []).reduce(
    (sum, p) => sum + (p.margin || 0), 0
  )

  // 3. Recompute
  const correctBalance = account.initial_balance + totalRealizedPnl - totalMarginLocked
  const safeBalance    = Math.max(0, correctBalance)
  const oldBalance     = account.current_balance

  // 4. Commit — only write if there's an actual difference (avoids spurious updated_at bumps)
  const delta = Math.abs(safeBalance - oldBalance)
  if (delta > 0.001) {
    const { error: updateErr } = await supabase
      .from('demo_accounts')
      .update({
        current_balance: safeBalance,
        equity:          safeBalance,
        total_trades:    totalClosedTrades,
        winning_trades:  winningTrades,
        updated_at:      new Date().toISOString(),
      })
      .eq('id', account.id)

    if (updateErr) throw new Error(`Balance update failed: ${updateErr.message}`)
  }

  console.log(
    '[Reconcile] Account:', account.id,
    '| Old balance:', oldBalance.toFixed(2),
    '| Realized PNL:', totalRealizedPnl.toFixed(2),
    '| Margin locked:', totalMarginLocked.toFixed(2),
    '| New balance:', safeBalance.toFixed(2),
    '| Delta:', delta.toFixed(2),
  )

  return {
    oldBalance,
    newBalance:        safeBalance,
    delta,
    totalRealizedPnl,
    totalMarginLocked,
    totalClosedTrades,
    winningTrades,
    alreadyCorrect:    delta <= 0.001,
  }
}
