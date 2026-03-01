/**
 * useTPSLMonitor.js
 *
 * Monitors open positions for TP, SL, and liquidation triggers.
 * Runs in Dashboard.jsx so it stays active regardless of which tab
 * the user is on. MarketsPage mounts/unmounts with the Market tab,
 * so any interval inside it stops when the user navigates away.
 * This hook ensures TP/SL always executes.
 *
 * Subscribes only to the symbols the user has open positions in —
 * not the full 60+ pair list — to keep WebSocket usage minimal.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import { useBinanceWebSocket } from './useBinanceWebSocket'
import { checkPositionTPSL } from './tradingService'

const CHECK_INTERVAL_MS = 3000
const SYMBOL_REFRESH_MS = 15000 // re-check which positions are open every 15s

export function useTPSLMonitor(userId, onTriggered) {
  const [symbols, setSymbols] = useState([])
  const { priceMap } = useBinanceWebSocket(symbols)

  // Refs to avoid stale closures inside setInterval
  const priceMapRef = useRef(priceMap)
  const userIdRef   = useRef(userId)

  useEffect(() => { priceMapRef.current = priceMap }, [priceMap])
  useEffect(() => { userIdRef.current = userId }, [userId])

  // Fetch the distinct symbols for all open positions
  // so we only subscribe to WebSocket feeds we actually need
  const refreshSymbols = useCallback(async () => {
    if (!userId) return
    try {
      const { data: positions, error } = await supabase
        .from('demo_positions')
        .select('symbol')
        .eq('user_id', userId)
        .eq('status', 'open')

      if (error) {
        console.error('[TPSLMonitor] Symbol refresh error:', error)
        return
      }

      const unique = [...new Set((positions || []).map(p => p.symbol))]
      setSymbols(prev => {
        // Only update state if the symbol list actually changed
        const prevKey = [...prev].sort().join(',')
        const nextKey = [...unique].sort().join(',')
        return prevKey === nextKey ? prev : unique
      })
    } catch (err) {
      console.error('[TPSLMonitor] Symbol refresh failed:', err)
    }
  }, [userId])

  // Initial load + periodic symbol refresh
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshSymbols()
    const interval = setInterval(refreshSymbols, SYMBOL_REFRESH_MS)
    return () => clearInterval(interval)
  }, [refreshSymbols])

  // TP/SL check interval — runs only when there are open positions with prices
  useEffect(() => {
    if (!userId || symbols.length === 0) return

    const interval = setInterval(async () => {
      const pm = priceMapRef.current
      if (Object.keys(pm).length === 0) return

      try {
        const closed = await checkPositionTPSL(userIdRef.current, pm)

        if (closed.length > 0) {
          // Notify Dashboard so it can surface toast notifications
          onTriggered?.(closed)

          // Re-fetch symbols — some positions are now closed
          refreshSymbols()
        }
      } catch (err) {
        console.error('[TPSLMonitor] Check error:', err)
      }
    }, CHECK_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [userId, symbols.length, refreshSymbols, onTriggered])
}
