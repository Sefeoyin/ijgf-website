/**
 * useTPSLMonitor.js
 *
 * Monitors open positions for TP, SL, liquidation, and drawdown breaches.
 * Runs in Dashboard.jsx so it stays active regardless of which tab the user is on.
 *
 * CRITICAL REDESIGN: This hook no longer uses useBinanceWebSocket for prices.
 * The WebSocket subscription required symbols state to be populated first, then
 * a WebSocket connection to establish, then prices to flow — creating a multi-step
 * async chain that often left priceMapRef empty, silently skipping every check.
 *
 * Instead: prices are fetched directly via REST every CHECK_INTERVAL_MS using
 * the same Bybit → OKX → Binance cascade as the server cron. This is:
 *   - Synchronous per tick (no async state dependency chain)
 *   - Guaranteed to have prices before every check
 *   - Identical price source to the offline cron (no discrepancy)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import { checkPositionTPSL } from './tradingService'

const CHECK_INTERVAL_MS  = 4000   // how often to check TP/SL
const SYMBOL_REFRESH_MS  = 15000  // how often to refresh the open-position symbol list

// ---------------------------------------------------------------------------
// Price fetch cascade — mirrors tpsl-cron.js exactly
// Bybit has the most permissive cloud-IP policy; OKX as fallback; Binance last.
// ---------------------------------------------------------------------------
async function fetchSpotPrices(symbols) {
  if (!symbols || symbols.length === 0) return {}

  // Try Bybit linear (futures) tickers
  try {
    const res  = await fetch('https://api.bybit.com/v5/market/tickers?category=linear', { signal: AbortSignal.timeout(5000) })
    const data = await res.json()
    if (data?.result?.list?.length > 0) {
      const map = {}
      for (const item of data.result.list) {
        if (item.symbol && item.lastPrice) map[item.symbol] = parseFloat(item.lastPrice)
      }
      const result = {}
      for (const s of symbols) { if (map[s]) result[s] = map[s] }
      if (Object.keys(result).length > 0) return result
    }
  } catch { /* fall through */ }

  // Try OKX swap tickers
  try {
    const res  = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SWAP', { signal: AbortSignal.timeout(5000) })
    const data = await res.json()
    if (data?.data?.length > 0) {
      const map = {}
      for (const item of data.data) {
        if (item.instId?.endsWith('-USDT-SWAP') && item.last) {
          const base = item.instId.replace('-USDT-SWAP', '')
          map[`${base}USDT`] = parseFloat(item.last)
        }
      }
      const result = {}
      for (const s of symbols) { if (map[s]) result[s] = map[s] }
      if (Object.keys(result).length > 0) return result
    }
  } catch { /* fall through */ }

  // Try Binance futures (may be blocked on some networks but worth trying)
  try {
    const res  = await fetch('https://fapi.binance.com/fapi/v1/ticker/price', { signal: AbortSignal.timeout(5000) })
    const data = await res.json()
    if (Array.isArray(data)) {
      const map = {}
      for (const item of data) map[item.symbol] = parseFloat(item.price)
      const result = {}
      for (const s of symbols) { if (map[s]) result[s] = map[s] }
      if (Object.keys(result).length > 0) return result
    }
  } catch { /* fall through */ }

  return {}
}

// ---------------------------------------------------------------------------
export function useTPSLMonitor(userId, onTriggered, onChallengeFailed) {
  const [symbols, setSymbols] = useState([])
  const symbolsRef   = useRef([])
  const userIdRef    = useRef(userId)
  const runningRef   = useRef(false) // mutex — prevents overlapping async ticks

  useEffect(() => { userIdRef.current = userId }, [userId])
  useEffect(() => { symbolsRef.current = symbols }, [symbols])

  // Fetch distinct symbols for all open positions
  const refreshSymbols = useCallback(async () => {
    if (!userId) return
    try {
      const { data: positions } = await supabase
        .from('demo_positions')
        .select('symbol')
        .eq('user_id', userId)
        .eq('status', 'open')

      const unique = [...new Set((positions || []).map(p => p.symbol))]
      setSymbols(prev => {
        const prevKey = [...prev].sort().join(',')
        const nextKey = [...unique].sort().join(',')
        return prevKey === nextKey ? prev : unique
      })
    } catch (err) {
      console.error('[TPSLMonitor] Symbol refresh failed:', err)
    }
  }, [userId])

  // Initial load + periodic refresh
  useEffect(() => {
    refreshSymbols()
    const id = setInterval(refreshSymbols, SYMBOL_REFRESH_MS)
    return () => clearInterval(id)
  }, [refreshSymbols])

  // Main check loop
  useEffect(() => {
    if (!userId) return

    const tick = async () => {
      // Skip if previous tick is still running
      if (runningRef.current) return
      runningRef.current = true

      try {
        const syms = symbolsRef.current
        if (syms.length === 0) return

        // Fetch live prices via REST cascade — guaranteed to have values before check
        const priceMap = await fetchSpotPrices(syms)
        if (Object.keys(priceMap).length === 0) {
          console.warn('[TPSLMonitor] No prices returned from any source — skipping tick')
          return
        }

        const hadPositions = syms.length > 0
        const closed = await checkPositionTPSL(userIdRef.current, priceMap)

        if (closed.length > 0) {
          // ── Normal TP/SL/liquidation closes ──────────────────────────────
          onTriggered?.(closed)
          refreshSymbols()

          const ended = closed.find(c => c.challengeFailed || c.challengePassed)
          if (ended) {
            onChallengeFailed?.(ended.challengeFailed ? 'failed' : 'passed')
          }

        } else if (hadPositions) {
          // ── Empty result despite having open positions ─────────────────
          // checkPositionTPSL runs a proactive drawdown check (safeCheckRules)
          // BEFORE checking individual TP/SL. If that check finds a drawdown
          // breach it force-closes ALL positions at entry_price, marks the account
          // 'failed', then re-fetches remaining positions → gets [] → returns [].
          // We must detect this case and fire onChallengeFailed.
          try {
            const { data: failedAcct } = await supabase
              .from('demo_accounts')
              .select('status')
              .eq('user_id', userIdRef.current)
              .eq('status', 'failed')
              .not('challenge_type', 'like', '%_archived_%')
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (failedAcct?.status === 'failed') {
              console.log('[TPSLMonitor] Drawdown breach detected (empty return with open positions)')
              refreshSymbols()
              onChallengeFailed?.('failed')
            }
          } catch (e) {
            console.error('[TPSLMonitor] Post-empty status check error:', e.message)
          }
        }
      } catch (err) {
        console.error('[TPSLMonitor] Tick error:', err)
      } finally {
        runningRef.current = false
      }
    }

    const id = setInterval(tick, CHECK_INTERVAL_MS)
    tick() // run immediately on mount
    return () => clearInterval(id)
  }, [userId, refreshSymbols, onTriggered, onChallengeFailed])
}
