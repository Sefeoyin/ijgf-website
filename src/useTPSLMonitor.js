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

export function useTPSLMonitor(userId, onTriggered, onChallengeFailed) {
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
        // checkPositionTPSL now returns { closed, challengeResult }.
        // challengeResult is set when safeCheckRules fired a drawdown/daily-loss
        // breach and force-closed all positions. In that case closed=[] — the
        // old bare-array check (closed.length > 0) meant NOTHING happened in
        // the UI: no refreshState, no modal, no PNL/trade update.
        const { closed, challengeResult } = await checkPositionTPSL(userIdRef.current, pm)

        if (closed.length > 0) {
          // ── Case A: TP/SL/liquidation closed one or more positions ──────
          onTriggered?.(closed)
          refreshSymbols()
        }

        // ── Challenge ended detection — covers BOTH paths ─────────────────
        // Path 1: safeCheckRules (proactive drawdown check) ended the challenge.
        //         closed=[], challengeResult.failed/passed = true.
        // Path 2: A TP/SL close itself pushed balance past the drawdown limit.
        //         closed=[...], one item has challengeFailed=true.
        // Previously only Path 2 was handled, and only when closed.length > 0.
        const challengeEndedViaRules = challengeResult?.failed || challengeResult?.passed
        const challengeEndedViaTrade = closed.find(c => c.challengeFailed || c.challengePassed)

        if (challengeEndedViaRules) {
          const result = challengeResult.failed ? 'failed' : 'passed'
          refreshSymbols()
          onChallengeFailed?.(result)
        } else if (challengeEndedViaTrade) {
          const result = challengeEndedViaTrade.challengeFailed ? 'failed' : 'passed'
          onChallengeFailed?.(result)
        }
      } catch (err) {
        console.error('[TPSLMonitor] Check error:', err)
      }
    }, CHECK_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [userId, symbols.length, refreshSymbols, onTriggered])
}
