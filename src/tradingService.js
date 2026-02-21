/**
 * tradingService.js
 *
 * All demo-trading logic in one service module.
 * Works directly with Supabase (RLS protects per-user data).
 *
 * Why client-side instead of Edge Functions for MVP:
 *  - Faster iteration, no deploy step for function changes
 *  - RLS already restricts data to the logged-in user
 *  - Edge Functions can be added later for sensitive ops (real funded accounts)
 */

import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const FEE_RATE = 0.0004 // 0.04% taker fee (Binance futures standard)

const CHALLENGE_CONFIGS = {
  '5k':   { initial: 5000,   profitTarget: 500,   dailyLoss: 200,  maxDrawdown: 300  },
  '10k':  { initial: 10000,  profitTarget: 1000,  dailyLoss: 400,  maxDrawdown: 600  },
  '25k':  { initial: 25000,  profitTarget: 2500,  dailyLoss: 1000, maxDrawdown: 1500 },
  '50k':  { initial: 50000,  profitTarget: 5000,  dailyLoss: 2000, maxDrawdown: 3000 },
  '100k': { initial: 100000, profitTarget: 10000, dailyLoss: 4000, maxDrawdown: 6000 },
}

// Max leverage per asset class
const MAX_LEVERAGE = {
  BTCUSDT: 10, ETHUSDT: 10,
  DEFAULT: 5, // altcoins
}

// ---------------------------------------------------------------------------
// Account helpers
// ---------------------------------------------------------------------------

/** Get or create the user's active demo account */
export async function getOrCreateDemoAccount(userId, challengeType = '10k') {
  // Try to fetch existing active account
  const { data: existing, error: fetchErr } = await supabase
    .from('demo_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('challenge_type', challengeType)
    .eq('status', 'active')
    .maybeSingle()

  if (fetchErr) throw fetchErr
  if (existing) return existing

  // Create new account
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

  if (insertErr) throw insertErr
  return account
}

/** Fetch full account state: account + open positions + open orders */
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
// Place a market order (instant fill at current price)
// ---------------------------------------------------------------------------
export async function placeMarketOrder({
  userId,
  symbol,
  side, // 'BUY' or 'SELL'
  sizeUsdt,
  leverage,
  currentPrice,
  takeProfit = null,
  stopLoss = null,
}) {
  // 1. Validate inputs
  if (!currentPrice || currentPrice <= 0) throw new Error('Invalid price')
  if (!sizeUsdt || sizeUsdt <= 0) throw new Error('Invalid size')

  const maxLev = MAX_LEVERAGE[symbol] ?? MAX_LEVERAGE.DEFAULT
  if (leverage > maxLev) throw new Error(`Max leverage for ${symbol} is ${maxLev}x`)

  // 2. Get account
  const account = await getOrCreateDemoAccount(userId)
  if (account.status !== 'active') throw new Error(`Challenge is ${account.status}`)

  // 3. Calculate quantities
  const quantity = sizeUsdt / currentPrice
  const margin = sizeUsdt / leverage
  const fee = sizeUsdt * FEE_RATE

  if (margin + fee > account.current_balance) {
    throw new Error('Insufficient balance')
  }

  // 4. Check if there's an existing open position for this symbol
  const { data: existingPos } = await supabase
    .from('demo_positions')
    .select('*')
    .eq('demo_account_id', account.id)
    .eq('symbol', symbol)
    .eq('status', 'open')
    .maybeSingle()

  const positionSide = side === 'BUY' ? 'LONG' : 'SHORT'

  // If there's an opposite position, close it first
  if (existingPos && existingPos.side !== positionSide) {
    await closePosition({
      userId,
      positionId: existingPos.id,
      currentPrice,
      reason: 'reversed',
    })
    // Re-fetch account after close
    const refreshed = await getOrCreateDemoAccount(userId)
    if (margin + fee > refreshed.current_balance) {
      throw new Error('Insufficient balance after closing opposite position')
    }
  }

  // 5. Calculate liquidation price
  const liqPrice = positionSide === 'LONG'
    ? currentPrice * (1 - 1 / leverage * 0.95) // 95% of margin lost
    : currentPrice * (1 + 1 / leverage * 0.95)

  // 6. Insert position
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

  if (posErr) throw posErr

  // 7. Insert trade log
  const { error: tradeErr } = await supabase
    .from('demo_trades')
    .insert({
      demo_account_id: account.id,
      user_id: userId,
      position_id: position.id,
      symbol,
      side,
      order_type: 'MARKET',
      price: currentPrice,
      quantity,
      leverage,
      total: sizeUsdt,
      fee,
      is_close: false,
    })

  if (tradeErr) throw tradeErr

  // 8. Deduct margin + fee from balance
  const newBalance = account.current_balance - margin - fee
  await updateAccountBalance(account.id, newBalance, account)

  // 9. Check challenge rules
  await checkChallengeRules(account.id, userId)

  return { position, fee, margin }
}

// ---------------------------------------------------------------------------
// Place a limit / stop-limit order (pending — fill checked client-side)
// ---------------------------------------------------------------------------
export async function placeLimitOrder({
  userId,
  symbol,
  side,
  orderType, // 'LIMIT' or 'STOP_LIMIT'
  price,
  stopPrice = null,
  sizeUsdt,
  leverage,
  takeProfit = null,
  stopLoss = null,
}) {
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
      symbol,
      side,
      order_type: orderType,
      price,
      stop_price: stopPrice,
      quantity,
      leverage,
      take_profit: takeProfit,
      stop_loss: stopLoss,
    })
    .select()
    .single()

  if (error) throw error
  return order
}

// ---------------------------------------------------------------------------
// Cancel an open order
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

  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Close an open position
// ---------------------------------------------------------------------------
export async function closePosition({
  userId,
  positionId,
  currentPrice,
  reason = 'manual', // 'manual' | 'tp' | 'sl' | 'liquidation' | 'reversed'
}) {
  // 1. Fetch position
  const { data: pos, error: fetchErr } = await supabase
    .from('demo_positions')
    .select('*')
    .eq('id', positionId)
    .eq('user_id', userId)
    .eq('status', 'open')
    .single()

  if (fetchErr || !pos) throw new Error('Position not found or already closed')

  // 2. Calculate PNL
  const pnl = pos.side === 'LONG'
    ? (currentPrice - pos.entry_price) * pos.quantity
    : (pos.entry_price - currentPrice) * pos.quantity

  const fee = currentPrice * pos.quantity * FEE_RATE

  // 3. Close position
  const { error: closeErr } = await supabase
    .from('demo_positions')
    .update({
      status: reason === 'liquidation' ? 'liquidated' : 'closed',
      unrealized_pnl: 0,
      closed_at: new Date().toISOString(),
    })
    .eq('id', positionId)

  if (closeErr) throw closeErr

  // 4. Log the closing trade
  const closeSide = pos.side === 'LONG' ? 'SELL' : 'BUY'
  await supabase.from('demo_trades').insert({
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
  })

  // 5. Update balance: return margin + PNL - fee
  const account = await getOrCreateDemoAccount(userId)
  const newBalance = account.current_balance + pos.margin + pnl - fee

  // Update win/loss stats
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

  // 6. Check challenge rules
  await checkChallengeRules(account.id, userId)

  return { pnl, fee, newBalance: Math.max(0, newBalance) }
}

// ---------------------------------------------------------------------------
// Check pending orders against current prices (call on each price update)
// ---------------------------------------------------------------------------
export async function checkPendingOrders(userId, priceMap) {
  // priceMap = { 'BTCUSDT': 98500, 'ETHUSDT': 3200, ... }
  const { data: orders } = await supabase
    .from('demo_orders')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'open')

  if (!orders || orders.length === 0) return []

  const filled = []

  for (const order of orders) {
    const currentPrice = priceMap[order.symbol]
    if (!currentPrice) continue

    let shouldFill = false

    if (order.order_type === 'LIMIT') {
      // Buy limit fills when price <= order price
      // Sell limit fills when price >= order price
      shouldFill = order.side === 'BUY'
        ? currentPrice <= order.price
        : currentPrice >= order.price
    } else if (order.order_type === 'STOP_LIMIT' && order.stop_price) {
      // Stop triggered when price crosses stop, then limit checked
      const stopTriggered = order.side === 'BUY'
        ? currentPrice >= order.stop_price
        : currentPrice <= order.stop_price

      if (stopTriggered) {
        shouldFill = order.side === 'BUY'
          ? currentPrice <= order.price
          : currentPrice >= order.price
      }
    }

    if (shouldFill) {
      try {
        // Mark order as filled
        await supabase
          .from('demo_orders')
          .update({
            status: 'filled',
            filled_qty: order.quantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id)

        // Execute as market order at the limit price
        const sizeUsdt = order.price * order.quantity
        await placeMarketOrder({
          userId,
          symbol: order.symbol,
          side: order.side,
          sizeUsdt,
          leverage: order.leverage,
          currentPrice: order.price,
          takeProfit: order.take_profit,
          stopLoss: order.stop_loss,
        })

        filled.push(order)
      } catch (err) {
        console.error(`Failed to fill order ${order.id}:`, err)
      }
    }
  }

  return filled
}

// ---------------------------------------------------------------------------
// Check TP/SL on open positions (call on each price update)
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
    const currentPrice = priceMap[pos.symbol]
    if (!currentPrice) continue

    let closeReason = null

    // Check liquidation
    if (pos.side === 'LONG' && currentPrice <= pos.liquidation_price) {
      closeReason = 'liquidation'
    } else if (pos.side === 'SHORT' && currentPrice >= pos.liquidation_price) {
      closeReason = 'liquidation'
    }

    // Check take profit
    if (!closeReason && pos.take_profit) {
      if (pos.side === 'LONG' && currentPrice >= pos.take_profit) closeReason = 'tp'
      if (pos.side === 'SHORT' && currentPrice <= pos.take_profit) closeReason = 'sl'
    }

    // Check stop loss
    if (!closeReason && pos.stop_loss) {
      if (pos.side === 'LONG' && currentPrice <= pos.stop_loss) closeReason = 'sl'
      if (pos.side === 'SHORT' && currentPrice >= pos.stop_loss) closeReason = 'sl'
    }

    if (closeReason) {
      try {
        const result = await closePosition({
          userId,
          positionId: pos.id,
          currentPrice,
          reason: closeReason,
        })
        closed.push({ ...pos, closeReason, ...result })
      } catch (err) {
        console.error(`Failed to close position ${pos.id}:`, err)
      }
    }
  }

  return closed
}

// ---------------------------------------------------------------------------
// Update unrealized PNL for display (doesn't write to DB, returns computed)
// ---------------------------------------------------------------------------
export function computeUnrealizedPNL(positions, priceMap) {
  return positions.map(pos => {
    const currentPrice = priceMap[pos.symbol] || pos.entry_price
    const pnl = pos.side === 'LONG'
      ? (currentPrice - pos.entry_price) * pos.quantity
      : (pos.entry_price - currentPrice) * pos.quantity
    const roi = (pnl / pos.margin) * 100

    return { ...pos, unrealized_pnl: pnl, roi }
  })
}

// ---------------------------------------------------------------------------
// Challenge rule checks
// ---------------------------------------------------------------------------
async function checkChallengeRules(accountId, userId) {
  const { data: account } = await supabase
    .from('demo_accounts')
    .select('*')
    .eq('id', accountId)
    .single()

  if (!account || account.status !== 'active') return null

  const totalDrawdown = account.initial_balance - account.current_balance

  // ---- Max drawdown check ----
  if (totalDrawdown >= account.max_total_drawdown) {
    await supabase.from('challenge_violations').insert({
      demo_account_id: accountId,
      user_id: userId,
      violation_type: 'MAX_DRAWDOWN',
      description: `Drawdown of $${totalDrawdown.toFixed(2)} exceeded limit of $${account.max_total_drawdown}`,
      balance_at_violation: account.current_balance,
      violation_amount: totalDrawdown,
    })

    await supabase
      .from('demo_accounts')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', accountId)

    return { failed: true, reason: 'MAX_DRAWDOWN' }
  }

  // ---- Daily loss check ----
  // Get today's starting balance
  const { data: todaySnap } = await supabase
    .from('challenge_progress')
    .select('starting_balance')
    .eq('demo_account_id', accountId)
    .eq('snapshot_date', new Date().toISOString().split('T')[0])
    .maybeSingle()

  const dayStart = todaySnap?.starting_balance ?? account.initial_balance
  const dailyLoss = dayStart - account.current_balance

  if (dailyLoss >= account.max_daily_loss) {
    await supabase.from('challenge_violations').insert({
      demo_account_id: accountId,
      user_id: userId,
      violation_type: 'DAILY_LOSS',
      description: `Daily loss of $${dailyLoss.toFixed(2)} exceeded limit of $${account.max_daily_loss}`,
      balance_at_violation: account.current_balance,
      violation_amount: dailyLoss,
    })

    await supabase
      .from('demo_accounts')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', accountId)

    return { failed: true, reason: 'DAILY_LOSS' }
  }

  // ---- Profit target check ----
  const totalProfit = account.current_balance - account.initial_balance
  if (totalProfit >= account.profit_target) {
    await supabase
      .from('demo_accounts')
      .update({ status: 'passed', updated_at: new Date().toISOString() })
      .eq('id', accountId)

    return { passed: true }
  }

  // ---- Update high water mark ----
  if (account.current_balance > account.high_water_mark) {
    await supabase
      .from('demo_accounts')
      .update({
        high_water_mark: account.current_balance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId)
  }

  return { status: 'active' }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
async function updateAccountBalance(accountId, newBalance, account) {
  const equity = Math.max(0, newBalance)
  await supabase
    .from('demo_accounts')
    .update({
      current_balance: equity,
      equity,
      updated_at: new Date().toISOString(),
    })
    .eq('id', accountId)
}

// ---------------------------------------------------------------------------
// Get challenge progress history
// ---------------------------------------------------------------------------
export async function getChallengeProgress(userId) {
  const { data, error } = await supabase
    .from('challenge_progress')
    .select('*')
    .eq('user_id', userId)
    .order('snapshot_date', { ascending: true })

  if (error) throw error
  return data || []
}

// ---------------------------------------------------------------------------
// Get violations
// ---------------------------------------------------------------------------
export async function getViolations(userId) {
  const { data, error } = await supabase
    .from('challenge_violations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

// ---------------------------------------------------------------------------
// Reset demo account (start over)
// ---------------------------------------------------------------------------
export async function resetDemoAccount(userId, challengeType = '10k') {
  // Close all open positions at entry price (no PNL)
  await supabase
    .from('demo_positions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('status', 'open')

  // Cancel all open orders
  await supabase
    .from('demo_orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('status', 'open')

  // Delete the old account
  await supabase
    .from('demo_accounts')
    .delete()
    .eq('user_id', userId)
    .eq('challenge_type', challengeType)

  // Create fresh account
  return getOrCreateDemoAccount(userId, challengeType)
}
