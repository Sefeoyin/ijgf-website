/**
 * useDemoTrading.js
 *
 * Central hook for the Markets page — combines:
 *  - Supabase account state
 *  - Binance WebSocket prices
 *  - Order/position management via tradingService
 *  - Real-time TP/SL & pending order checks
 *
 * Usage in MarketsPage:
 *   const trading = useDemoTrading(userId, selectedPair)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useBinanceWebSocket, useBinanceOrderBook } from './useBinanceWebSocket'
import {
  getAccountState,
  placeMarketOrder,
  placeLimitOrder,
  cancelOrder,
  closePosition,
  checkPendingOrders,
  checkPositionTPSL,
  computeUnrealizedPNL,
  resetDemoAccount,
} from './tradingService'

const ALL_PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
  'MATICUSDT', 'LTCUSDT', 'ATOMUSDT', 'NEARUSDT', 'APTUSDT',
]

export function useDemoTrading(userId, selectedPair = 'BTCUSDT') {
  // --------------- Account state ---------------
  const [account, setAccount] = useState(null)
  const [positions, setPositions] = useState([])
  const [openOrders, setOpenOrders] = useState([])
  const [recentTrades, setRecentTrades] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notifications, setNotifications] = useState([])

  // --------------- WebSocket prices ---------------
  const { prices, priceMap, isConnected, mode: priceMode } = useBinanceWebSocket(ALL_PAIRS)
  const { bids, asks, isConnected: obConnected, mode: obMode } = useBinanceOrderBook(selectedPair, 10)

  // Current pair price
  const currentPrice = priceMap[selectedPair] || 0
  const currentPriceData = prices[selectedPair] || {}

  // --------------- Refs to avoid stale closures ---------------
  const priceMapRef = useRef(priceMap)
  useEffect(() => { priceMapRef.current = priceMap }, [priceMap])

  // --------------- Load account state ---------------
  const refreshState = useCallback(async () => {
    if (!userId) return
    try {
      const state = await getAccountState(userId)
      setAccount(state.account)
      setPositions(state.positions)
      setOpenOrders(state.orders)
      setRecentTrades(state.recentTrades)
      setError(null)
    } catch (err) {
      console.error('Error loading account state:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    refreshState()
  }, [refreshState])

  // --------------- Real-time unrealized PNL ---------------
  const positionsWithPNL = computeUnrealizedPNL(positions, priceMap)

  const totalUnrealizedPNL = positionsWithPNL.reduce(
    (sum, p) => sum + (p.unrealized_pnl || 0), 0
  )

  const equity = account
    ? account.current_balance + totalUnrealizedPNL
    : 0

  // --------------- Check TP/SL & pending orders on price updates ---------------
  useEffect(() => {
    if (!userId || !isConnected || positions.length === 0) return

    // Throttle to once every 2 seconds
    const interval = setInterval(async () => {
      const pm = priceMapRef.current
      if (Object.keys(pm).length === 0) return

      const closedPositions = await checkPositionTPSL(userId, pm)
      for (const closed of closedPositions) {
        addNotification(
          closed.closeReason === 'tp'
            ? `✅ ${closed.symbol} TP hit! PNL: $${closed.pnl?.toFixed(2)}`
            : closed.closeReason === 'sl'
            ? `🛑 ${closed.symbol} SL hit. PNL: $${closed.pnl?.toFixed(2)}`
            : closed.closeReason === 'liquidation'
            ? `💀 ${closed.symbol} liquidated!`
            : `Position ${closed.symbol} closed`,
          closed.pnl > 0 ? 'success' : 'warning'
        )
      }

      if (closedPositions.length > 0) refreshState()
    }, 2000)

    return () => clearInterval(interval)
  }, [userId, isConnected, positions.length, refreshState])

  // Check pending orders
  useEffect(() => {
    if (!userId || !isConnected || openOrders.length === 0) return

    const interval = setInterval(async () => {
      const pm = priceMapRef.current
      if (Object.keys(pm).length === 0) return

      const filledOrders = await checkPendingOrders(userId, pm)
      for (const order of filledOrders) {
        addNotification(
          `📋 ${order.side} ${order.symbol} order filled at $${order.price}`,
          'info'
        )
      }

      if (filledOrders.length > 0) refreshState()
    }, 2000)

    return () => clearInterval(interval)
  }, [userId, isConnected, openOrders.length, refreshState])

  // --------------- Actions ---------------
  const submitMarketOrder = useCallback(async ({
    symbol, side, sizeUsdt, leverage, takeProfit, stopLoss,
  }) => {
    try {
      setError(null)
      const cp = priceMapRef.current[symbol]
      if (!cp) throw new Error(`No price data for ${symbol}`)

      const result = await placeMarketOrder({
        userId,
        symbol,
        side,
        sizeUsdt: parseFloat(sizeUsdt),
        leverage: parseInt(leverage),
        currentPrice: cp,
        takeProfit: takeProfit ? parseFloat(takeProfit) : null,
        stopLoss: stopLoss ? parseFloat(stopLoss) : null,
      })

      addNotification(
        `${side} ${symbol} filled @ $${cp.toLocaleString()} | Margin: $${result.margin.toFixed(2)}`,
        'success'
      )

      await refreshState()
      return result
    } catch (err) {
      setError(err.message)
      addNotification(`Order failed: ${err.message}`, 'error')
      throw err
    }
  }, [userId, refreshState])

  const submitLimitOrder = useCallback(async ({
    symbol, side, orderType, price, stopPrice, sizeUsdt, leverage, takeProfit, stopLoss,
  }) => {
    try {
      setError(null)
      const result = await placeLimitOrder({
        userId,
        symbol,
        side,
        orderType,
        price: parseFloat(price),
        stopPrice: stopPrice ? parseFloat(stopPrice) : null,
        sizeUsdt: parseFloat(sizeUsdt),
        leverage: parseInt(leverage),
        takeProfit: takeProfit ? parseFloat(takeProfit) : null,
        stopLoss: stopLoss ? parseFloat(stopLoss) : null,
      })

      addNotification(
        `${orderType} ${side} order placed for ${symbol} @ $${price}`,
        'info'
      )

      await refreshState()
      return result
    } catch (err) {
      setError(err.message)
      addNotification(`Order failed: ${err.message}`, 'error')
      throw err
    }
  }, [userId, refreshState])

  const submitCancelOrder = useCallback(async (orderId) => {
    try {
      await cancelOrder(userId, orderId)
      addNotification('Order cancelled', 'info')
      await refreshState()
    } catch (err) {
      setError(err.message)
      addNotification(`Cancel failed: ${err.message}`, 'error')
    }
  }, [userId, refreshState])

  const submitClosePosition = useCallback(async (positionId) => {
    try {
      const pos = positions.find(p => p.id === positionId)
      if (!pos) throw new Error('Position not found')

      const cp = priceMapRef.current[pos.symbol]
      if (!cp) throw new Error(`No price data for ${pos.symbol}`)

      const result = await closePosition({
        userId,
        positionId,
        currentPrice: cp,
      })

      addNotification(
        `${pos.symbol} closed | PNL: ${result.pnl >= 0 ? '+' : ''}$${result.pnl.toFixed(2)}`,
        result.pnl >= 0 ? 'success' : 'warning'
      )

      await refreshState()
      return result
    } catch (err) {
      setError(err.message)
      addNotification(`Close failed: ${err.message}`, 'error')
      throw err
    }
  }, [userId, positions, refreshState])

  const submitResetAccount = useCallback(async () => {
    try {
      await resetDemoAccount(userId)
      addNotification('Demo account reset to $10,000', 'info')
      await refreshState()
    } catch (err) {
      setError(err.message)
    }
  }, [userId, refreshState])

  // --------------- Notifications ---------------
  const addNotification = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    setNotifications(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 6000)
  }, [])

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  // --------------- Derived stats ---------------
  const winRate = account && account.total_trades > 0
    ? ((account.winning_trades / account.total_trades) * 100).toFixed(1)
    : '0.0'

  const profitTargetProgress = account
    ? Math.min(100, Math.max(0,
        ((account.current_balance - account.initial_balance) / account.profit_target) * 100
      ))
    : 0

  const drawdownUsed = account
    ? Math.max(0, account.initial_balance - account.current_balance)
    : 0

  const drawdownPercent = account
    ? (drawdownUsed / account.max_total_drawdown) * 100
    : 0

  return {
    // State
    account,
    positions: positionsWithPNL,
    openOrders,
    recentTrades,
    isLoading,
    error,
    notifications,

    // Prices
    prices,
    priceMap,
    currentPrice,
    currentPriceData,
    isConnected,
    priceMode,

    // Order book
    bids,
    asks,
    obConnected,
    obMode,

    // Derived
    equity,
    totalUnrealizedPNL,
    winRate,
    profitTargetProgress,
    drawdownUsed,
    drawdownPercent,

    // Actions
    submitMarketOrder,
    submitLimitOrder,
    submitCancelOrder,
    submitClosePosition,
    submitResetAccount,
    refreshState,
    dismissNotification,
  }
}
