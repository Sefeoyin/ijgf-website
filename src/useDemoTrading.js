/**
 * useDemoTrading.js
 *
 * Central hook for the Markets page — combines:
 *  - Supabase account state
 *  - Binance WebSocket / CoinGecko prices
 *  - Order/position management via tradingService
 *  - Real-time TP/SL & pending order checks
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

  // --------------- WebSocket / CoinGecko prices ---------------
  const { prices, priceMap, isConnected, mode: priceMode } = useBinanceWebSocket(ALL_PAIRS)
  const { bids, asks, mode: obMode } = useBinanceOrderBook(selectedPair, 10)

  // KEY FIX: use hasPrices instead of isConnected for order/position checks
  // CoinGecko polling sets isConnected=true, but there's a delay.
  // This ensures checks run as soon as we have ANY price data.
  const hasPrices = Object.keys(priceMap).length > 0

  const currentPrice = priceMap[selectedPair] || 0
  const currentPriceData = prices[selectedPair] || {}

  // Refs to avoid stale closures in intervals
  const priceMapRef = useRef(priceMap)
  useEffect(() => { priceMapRef.current = priceMap }, [priceMap])

  const userIdRef = useRef(userId)
  useEffect(() => { userIdRef.current = userId }, [userId])

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

  // --------------- Notifications helper ---------------
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

  // --------------- Check TP/SL on open positions ---------------
  // FIX: use hasPrices instead of isConnected
  useEffect(() => {
    if (!userId || !hasPrices || positions.length === 0) return

    const interval = setInterval(async () => {
      const pm = priceMapRef.current
      if (Object.keys(pm).length === 0) return

      try {
        const closedPositions = await checkPositionTPSL(userIdRef.current, pm)
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
      } catch (err) {
        console.error('TP/SL check error:', err)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [userId, hasPrices, positions.length, refreshState, addNotification])

  // --------------- Check pending orders ---------------
  // FIX: use hasPrices instead of isConnected
  useEffect(() => {
    if (!userId || !hasPrices || openOrders.length === 0) return

    const interval = setInterval(async () => {
      const pm = priceMapRef.current
      if (Object.keys(pm).length === 0) return

      try {
        const filledOrders = await checkPendingOrders(userIdRef.current, pm)
        for (const order of filledOrders) {
          addNotification(
            `📋 ${order.side} ${order.symbol} order filled at $${order.price}`,
            'info'
          )
        }
        if (filledOrders.length > 0) refreshState()
      } catch (err) {
        console.error('Pending order check error:', err)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [userId, hasPrices, openOrders.length, refreshState, addNotification])

  // --------------- Actions ---------------
  const submitMarketOrder = useCallback(async ({
    symbol, side, sizeUsdt, leverage, takeProfit, stopLoss,
  }) => {
    try {
      setError(null)
      const cp = priceMapRef.current[symbol]
      if (!cp) throw new Error(`No price data for ${symbol}. Wait for prices to load.`)

      const result = await placeMarketOrder({
        userId: userIdRef.current,
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
  }, [refreshState, addNotification])

  const submitLimitOrder = useCallback(async ({
    symbol, side, orderType, price, stopPrice, sizeUsdt, leverage, takeProfit, stopLoss,
  }) => {
    try {
      setError(null)
      const result = await placeLimitOrder({
        userId: userIdRef.current,
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
  }, [refreshState, addNotification])

  const submitCancelOrder = useCallback(async (orderId) => {
    try {
      await cancelOrder(userIdRef.current, orderId)
      addNotification('Order cancelled', 'info')
      await refreshState()
    } catch (err) {
      setError(err.message)
      addNotification(`Cancel failed: ${err.message}`, 'error')
    }
  }, [refreshState, addNotification])

  const submitClosePosition = useCallback(async (positionId) => {
    try {
      const pos = positions.find(p => p.id === positionId)
      if (!pos) throw new Error('Position not found')

      const cp = priceMapRef.current[pos.symbol]
      if (!cp) throw new Error(`No price data for ${pos.symbol}`)

      const result = await closePosition({
        userId: userIdRef.current,
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
  }, [positions, refreshState, addNotification])

  const submitResetAccount = useCallback(async () => {
    try {
      await resetDemoAccount(userIdRef.current)
      addNotification('Demo account reset to $10,000', 'info')
      await refreshState()
    } catch (err) {
      setError(err.message)
    }
  }, [refreshState, addNotification])

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
    hasPrices,
    priceMode,

    // Order book
    bids,
    asks,
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
