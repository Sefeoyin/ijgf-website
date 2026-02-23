/**
 * tradingService.js — Demo trading logic
 * All Supabase calls use anon key + RLS
 */

import { supabase } from './supabase'

// No trading fees — revenue comes from challenge fees

const CHALLENGE_CONFIGS = {
  '5k':   { initial: 5000,   profitTarget: 500,   dailyLoss: 200,  maxDrawdown: 300  },
  '10k':  { initial: 10000,  profitTarget: 1000,  dailyLoss: 400,  maxDrawdown: 600  },
  '25k':  { initial: 25000,  profitTarget: 2500,  dailyLoss: 1000, maxDrawdown: 1500 },
  '50k':  { initial: 50000,  profitTarget: 5000,  dailyLoss: 2000, maxDrawdown: 3000 },
  '100k': { initial: 100000, profitTarget: 10000, dailyLoss: 4000, maxDrawdown: 6000 },
}

export const MAX_LEVERAGE = {
  BTCUSDT: 10, ETHUSDT: 10,
  DEFAULT: 5,
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
  if (existing) return existing

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

  return {
    account,
    positions: posRes.data || [],
    orders: ordRes.data || [],
    recentTrades: tradeRes.data || [],
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

  const pnl = pos.side === 'LONG'
    ? (currentPrice - pos.entry_price) * pos.quantity
    : (pos.entry_price - currentPrice) * pos.quantity

  const fee = 0

  const { error: closeErr } = await supabase
    .from('demo_positions')
    .update({
      status: reason === 'liquidation' ? 'liquidated' : 'closed',
      unrealized_pnl: 0,
      closed_at: new Date().toISOString(),
    })
    .eq('id', positionId)

  if (closeErr) {
    console.error('[Trading] Close position update error:', closeErr)
    throw new Error(`Failed to close position: ${closeErr.message}`)
  }

  // Trade log (non-blocking)
  const closeSide = pos.side === 'LONG' ? 'SELL' : 'BUY'
  supabase.from('demo_trades').insert({
    demo_account_id: pos.demo_account_id,
    user_id: userId,
    position_id: positionId,
    symbol: pos.symbol,
    side: closeSide,
    order_type: 'MARKET',
    price: currentPrice,
    quantity: pos.quantity,
    leverage: pos.leverage,
    total: currentPrice * pos.quantity,
    fee,
    realized_pnl: pnl,
    is_close: true,
  }).then(({ error }) => {
    if (error) console.error('[Trading] Close trade log error:', error)
  })

  // Update balance
  const account = await getOrCreateDemoAccount(userId)
  const newBalance = account.current_balance + pos.margin + pnl
  const isWin = pnl > 0

  await supabase
    .from('demo_accounts')
    .update({
      current_balance: Math.max(0, newBalance),
      equity: Math.max(0, newBalance),
      total_trades: account.total_trades + 1,
      winning_trades: isWin ? account.winning_trades + 1 : account.winning_trades,
      updated_at: new Date().toISOString(),
    })
    .eq('id', account.id)

  // Challenge rules (non-blocking)
  safeCheckRules(account.id, userId)

  console.log('[Trading] Position closed:', positionId, '| PNL:', pnl.toFixed(2), '| Reason:', reason)
  return { pnl, fee, newBalance: Math.max(0, newBalance) }
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
        // Atomic claim: update only if still 'open', check count to prevent double-fill
        const { data: claimed } = await supabase
          .from('demo_orders')
          .update({ status: 'filled', filled_qty: order.quantity, updated_at: new Date().toISOString() })
          .eq('id', order.id)
          .eq('status', 'open')
          .select('id')

        // If no rows returned, another interval already claimed it
        if (!claimed || claimed.length === 0) {
          console.log('[Trading] Order already claimed, skipping:', order.id)
          continue
        }

        // Execute position — if this fails, revert order to 'open' so it can retry
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
          console.error('[Trading] Fill execution failed, reverting order:', order.id, execErr)
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

  const totalDrawdown = account.initial_balance - account.current_balance

  // Max drawdown
  if (totalDrawdown >= account.max_total_drawdown) {
    // Try to log violation (may fail if no INSERT policy — that's ok)
    try {
      await supabase.from('challenge_violations').insert({
        demo_account_id: accountId, user_id: userId,
        violation_type: 'MAX_DRAWDOWN',
        description: `Drawdown $${totalDrawdown.toFixed(2)} exceeded $${account.max_total_drawdown}`,
        balance_at_violation: account.current_balance, violation_amount: totalDrawdown,
      })
    } catch { /* non-critical */ }

    await supabase
      .from('demo_accounts')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', accountId)
    return { failed: true, reason: 'MAX_DRAWDOWN' }
  }

  // Daily loss
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

  const dailyLoss = dayStart - account.current_balance
  if (dailyLoss >= account.max_daily_loss) {
    try {
      await supabase.from('challenge_violations').insert({
        demo_account_id: accountId, user_id: userId,
        violation_type: 'DAILY_LOSS',
        description: `Daily loss $${dailyLoss.toFixed(2)} exceeded $${account.max_daily_loss}`,
        balance_at_violation: account.current_balance, violation_amount: dailyLoss,
      })
    } catch { /* non-critical */ }

    await supabase
      .from('demo_accounts')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', accountId)
    return { failed: true, reason: 'DAILY_LOSS' }
  }

  // Profit target
  const totalProfit = account.current_balance - account.initial_balance
  if (totalProfit >= account.profit_target) {
    await supabase
      .from('demo_accounts')
      .update({ status: 'passed', updated_at: new Date().toISOString() })
      .eq('id', accountId)
    return { passed: true }
  }

  // High water mark
  if (account.current_balance > account.high_water_mark) {
    await supabase
      .from('demo_accounts')
      .update({ high_water_mark: account.current_balance, updated_at: new Date().toISOString() })
      .eq('id', accountId)
  }

  return { status: 'active' }
}

async function updateAccountBalance(accountId, newBalance) {
  const equity = Math.max(0, newBalance)
  const { error } = await supabase
    .from('demo_accounts')
    .update({ current_balance: equity, equity, updated_at: new Date().toISOString() })
    .eq('id', accountId)
  if (error) console.error('[Trading] Update balance error:', error)
}

export async function resetDemoAccount(userId, challengeType = '10k') {
  await supabase.from('demo_positions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('user_id', userId).eq('status', 'open')
  await supabase.from('demo_orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('status', 'open')
  await supabase.from('demo_accounts')
    .delete().eq('user_id', userId).eq('challenge_type', challengeType)
  return getOrCreateDemoAccount(userId, challengeType)
}
