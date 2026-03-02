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
  // Large caps
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
  'MATICUSDT', 'LTCUSDT', 'ATOMUSDT', 'NEARUSDT', 'APTUSDT',
  'TONUSDT', 'TRXUSDT', 'BCHUSDT', 'XLMUSDT', 'ETCUSDT',
  // Mid cap
  'UNIUSDT', 'OPUSDT', 'ARBUSDT', 'INJUSDT', 'SUIUSDT',
  'SEIUSDT', 'TIAUSDT', 'WLDUSDT', 'PEPEUSDT', 'SHIBUSDT',
  'WIFUSDT', 'BONKUSDT', 'FLOKIUSDT', 'ORDIUSDT', 'RUNEUSDT',
  'LDOUSDT', 'ICPUSDT', 'HBARUSDT', 'FILUSDT', 'ALGOUSDT',
  // DeFi
  'AAVEUSDT', 'CRVUSDT', 'MKRUSDT', 'COMPUSDT', 'GRTUSDT',
  'DYDXUSDT', 'PENDLEUSDT', 'GMXUSDT', 'STRKUSDT', 'SNXUSDT',
  // AI / Infra
  'FETUSDT', 'RENDERUSDT', 'TAOUSDT', 'PYTHUSDT',
  // Gaming / Metaverse
  'AXSUSDT', 'SANDUSDT', 'MANAUSDT', 'GALAUSDT', 'IMXUSDT',
  // Other
  'KASUSDT', 'JUPUSDT', 'POPCATUSDT', 'FTMUSDT', 'EOSUSDT',
]

export function useDemoTrading(userId, selectedPair = 'BTCUSDT') {
  // --------------- Account state ---------------
  const [account, setAccount] = useState(null)
  const [positions, setPositions] = useState([])
  const [openOrders, setOpenOrders] = useState([])
  const [recentTrades, setRecentTrades] = useState([])
  const [tradingDays, setTradingDays] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notifications, setNotifications] = useState([])
  // Challenge result modal state — set when account transitions active → passed/failed
  const [challengeResult, setChallengeResult] = useState(null)
  // Tracks previous account status to detect transitions within the session only
  const prevStatusRef = useRef(null)

  // --------------- WebSocket / CoinGecko prices ---------------
  // If the selected pair isn't in our base list, add it so it always gets a price
  const subscribedPairs = ALL_PAIRS.includes(selectedPair)
    ? ALL_PAIRS
    : [...ALL_PAIRS, selectedPair]
  const { prices, priceMap, isConnected, mode: priceMode } = useBinanceWebSocket(subscribedPairs)
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
    if (!userId) {
      console.warn('useDemoTrading: no userId provided')
      setIsLoading(false)
      return
    }
    try {
      const state = await getAccountState(userId)
      setAccount(state.account)
      setPositions(state.positions)
      setOpenOrders(state.orders)
      setRecentTrades(state.recentTrades)
      setTradingDays(state.tradingDays ?? 0)
      setError(null)
    } catch (err) {
      console.error('Error loading account state:', err)
      setError(err.message || 'Failed to load demo account')
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

  // Total margin locked in open positions — fallback to computed if margin column is null
  const totalMarginInUse = positions.reduce((sum, p) => {
    const m = (p.margin != null && p.margin > 0)
      ? p.margin
      : (p.entry_price * p.quantity) / (p.leverage || 1)
    return sum + (m || 0)
  }, 0)

  // Equity = balance + unrealized PNL (standard futures definition)
  // This is the "real" account value shown as "Equity"
  // Equity = cash + margin locked + unrealized PNL (margin is not lost)
  const equity = account
    ? account.current_balance + totalMarginInUse + totalUnrealizedPNL
    : 0

  const accountValue = equity

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

  // --------------- Derived stats (use accountValue for challenge metrics) ---------------
  const winRate = account && account.total_trades > 0
    ? ((account.winning_trades / account.total_trades) * 100).toFixed(1)
    : '0.0'

  // Profit toward target: accountValue vs initial (includes unrealized PNL but NOT margin as loss)
  const equityProfit = account ? accountValue - account.initial_balance : 0

  const profitTargetProgress = account
    ? Math.min(100, Math.max(0, (equityProfit / account.profit_target) * 100))
    : 0

  // Drawdown: only count ACTUAL losses, not margin locked in positions
  const drawdownUsed = account
    ? Math.max(0, account.initial_balance - accountValue)
    : 0

  const drawdownPercent = account && account.max_total_drawdown > 0
    ? (drawdownUsed / account.max_total_drawdown) * 100
    : 0

  // --------------- Challenge result detection ---------------
  // Fires only on active → passed/failed transitions within the current browser session.
  // prevStatusRef starts as null, so the first load (null → 'active') never triggers.
  // This prevents a stale 'passed' account from firing the modal on every page load.
  useEffect(() => {
    if (!account) return
    const curr = account.status
    const prev = prevStatusRef.current

    if (prev === 'active' && (curr === 'passed' || curr === 'failed')) {
      setChallengeResult(curr)
    }
    prevStatusRef.current = curr
  }, [account?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // Dismiss the challenge result modal without any side effects
  const dismissChallengeResult = useCallback(() => {
    setChallengeResult(null)
  }, [])

  // Dismiss modal AND reset account to start a fresh challenge
  const submitStartNewChallenge = useCallback(async () => {
    setChallengeResult(null)
    try {
      await submitResetAccount()
    } catch (err) {
      setError(err.message)
      addNotification(`Reset failed: ${err.message}`, 'error')
    }
  }, [submitResetAccount, addNotification]) // eslint-disable-line react-hooks/exhaustive-deps

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
    tradingDays,
    equity,
    accountValue,
    equityProfit,
    totalUnrealizedPNL,
    totalMarginInUse,
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

    // Challenge result modal
    challengeResult,
    dismissChallengeResult,
    submitStartNewChallenge,
  }
}
