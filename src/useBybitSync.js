/**
 * useBybitSync.js
 *
 * Dashboard-level hook for Bybit Demo Trading challenge tracking.
 * Mounts at Dashboard root -- runs on EVERY tab, not just the Market tab.
 *
 * Responsibilities:
 *  1. Poll Bybit every 10s: live equity + open positions via /api/bybit-proxy
 *  2. Sync equity → demo_accounts (current_balance, bybit_equity, bybit_last_sync)
 *  3. Trading days: increment bybit_trading_days once per calendar day when
 *     the account has open positions OR equity has moved from initial_balance
 *  4. TP/SL enforcement: track positions without a Stop Loss across sync cycles.
 *     Force-close (reduce-only IOC market order) after TPSL_GRACE_CYCLES (~60s = 6 × 10s)
 *  5. Pass / fail evaluation (runs every cycle, fires exactly once per challenge):
 *       FAIL: drawdown >= max_total_drawdown
 *       PASS: pnl >= profit_target AND tradingDays >= min_trading_days
 *  6. On pass/fail:
 *       a. Update demo_accounts.status in DB
 *       b. Nuke Bybit Demo balance fire-and-forget (non-blocking)
 *       c. Call onStatusChange(status, account, tradingDays) → ChallengeResultModal
 *
 * Required DB migration (run once in Supabase SQL editor if not already done):
 *   ALTER TABLE demo_accounts
 *     ADD COLUMN IF NOT EXISTS bybit_trading_days    INTEGER DEFAULT 0,
 *     ADD COLUMN IF NOT EXISTS bybit_last_active_date DATE;
 *
 * Returns: { equity, positions, winStats, closedTrades, tradingDays, account, loading, error, lastSync, syncNow }
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'

const BYBIT_PROXY       = '/api/bybit-proxy'
const POLL_INTERVAL_MS  = 10_000  // 10 seconds -- fast enough to catch closes within one tick
const TPSL_GRACE_CYCLES = 6       // 6 × 10s = ~60s real-world grace before force-closing SL-less positions

// ── Proxy helpers ─────────────────────────────────────────────────────────────

async function proxyGet(apiKey, apiSecret, endpoint, params = {}) {
  const res = await fetch(BYBIT_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret, method: 'GET', endpoint, params }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`)
  const json = await res.json()
  if (json.retCode !== 0) throw new Error(`Bybit ${json.retCode}: ${json.retMsg}`)
  return json.result
}

async function proxyPost(apiKey, apiSecret, endpoint, params = {}) {
  const res = await fetch(BYBIT_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret, method: 'POST', endpoint, params }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`)
  // Return raw json -- caller decides whether retCode matters
  return await res.json()
}

// ── Nuke Bybit Demo balance to (near) zero on challenge end ──────────────────
// adjustType:1 = reduce. Loops all coins in ≤100k USDT chunks.
// Bybit enforces a minimum USDT floor -- hitting it returns a non-zero retCode
// which we intentionally swallow. That's expected & correct.
async function nukeBybitBalance(apiKey, apiSecret) {
  try {
    const r = await proxyGet(apiKey, apiSecret, '/v5/account/wallet-balance', { accountType: 'UNIFIED' })
    const coins = r?.list?.[0]?.coin ?? []
    for (const coinEntry of coins) {
      const bal = Math.floor(parseFloat(coinEntry.walletBalance ?? 0))
      if (bal <= 0) continue
      let rem = bal
      while (rem > 0) {
        const chunk = Math.min(rem, 100_000)
        await proxyPost(apiKey, apiSecret, '/v5/account/demo-apply-money', {
          adjustType: 1,
          utaDemoApplyMoney: [{ coin: coinEntry.coin, amountStr: String(chunk) }],
        })
        rem -= chunk
      }
    }
  } catch (err) {
    // Non-critical -- never block the modal for a nuke failure
    console.warn('[useBybitSync] nukeBybitBalance non-critical error:', err.message)
  }
}

// ── Force-close a single Bybit position (reduce-only IOC) ────────────────────
async function closeBybitPosition(apiKey, apiSecret, pos) {
  await proxyPost(apiKey, apiSecret, '/v5/order/create', {
    category:    'linear',
    symbol:      pos.symbol,
    side:        pos.side === 'Buy' ? 'Sell' : 'Buy',
    orderType:   'Market',
    qty:         String(pos.size),
    reduceOnly:  true,
    timeInForce: 'IOC',
    positionIdx: 0,
  })
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useBybitSync(userId, tradingMode, onStatusChange) {
  const [equity,      setEquity]      = useState(null)
  const [positions,   setPositions]   = useState([])
  const [winStats,    setWinStats]    = useState({ wins: 0, losses: 0, total: 0 })
  const [closedTrades, setClosedTrades] = useState([])
  const [tradingDays, setTradingDays] = useState(0)
  const [account,     setAccount]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [lastSync,    setLastSync]    = useState(null)

  // Refs for concurrency safety and stable callbacks
  const isSyncing         = useRef(false)  // prevents overlapping fetches
  const statusFired       = useRef(false)  // fires ChallengeResultModal exactly once
  const noSlCycles        = useRef({})     // { symbol: consecutiveCyclesWithoutSL }
  const onStatusChangeRef = useRef(onStatusChange)
  useEffect(() => { onStatusChangeRef.current = onStatusChange }, [onStatusChange])

  const runSync = useCallback(async () => {
    if (!userId || tradingMode !== 'bybit') { setLoading(false); return }
    if (isSyncing.current) return   // skip if previous sync is still in-flight
    isSyncing.current = true

    try {
      console.log('[useBybitSync] Sync cycle starting. userId:', userId, 'mode:', tradingMode)
      // ── Step 1: Load active Bybit account row from Supabase ──────────────
      const { data: acct } = await supabase
        .from('demo_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('trading_mode', 'bybit')
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!acct) {
        // No active Bybit challenge found in DB.
        // This can mean: status was changed to 'failed'/'passed', or no Bybit account exists.
        // We surface this as an error so it's visible -- not a silent freeze.
        setError('No active Bybit challenge found. Your challenge may have ended, or the account status changed unexpectedly. Check the My Challenges tab.')
        console.warn('[useBybitSync] No active Bybit account found in DB (status=active). userId:', userId)
        setLoading(false)
        return
      }

      if (!acct.bybit_api_key || !acct.bybit_api_secret) {
        setError('No Bybit API credentials found. Please reconnect via a new challenge.')
        setLoading(false)
        return
      }

      const key    = acct.bybit_api_key
      const secret = acct.bybit_api_secret

      // ── Step 2: Fetch live USDT equity ───────────────────────────────────
      let walletResult
      try {
        walletResult = await proxyGet(key, secret, '/v5/account/wallet-balance', { accountType: 'UNIFIED' })
      } catch {
        // Some Bybit demo accounts use CONTRACT account type
        walletResult = await proxyGet(key, secret, '/v5/account/wallet-balance', { accountType: 'CONTRACT' })
      }
      const accountRow = walletResult?.list?.[0] ?? {}
      const coins      = accountRow.coin ?? []
      const usdtCoin   = coins.find(c => c.coin === 'USDT')

      // Equity extraction with fallback chain:
      // 1. USDT coin-level equity (includes unrealised PnL for open positions)
      // 2. USDT coin-level walletBalance (realised cash only)
      // 3. Account-level totalEquity (all coins combined -- safe for USDT-only accounts)
      // 4. Account-level totalWalletBalance
      const rawEquity = usdtCoin?.equity
        ?? usdtCoin?.walletBalance
        ?? accountRow.totalEquity
        ?? accountRow.totalWalletBalance
        ?? null

      console.log('[useBybitSync] wallet-balance raw:', {
        accountType: accountRow.accountType,
        totalEquity: accountRow.totalEquity,
        totalWalletBalance: accountRow.totalWalletBalance,
        usdtCoin: usdtCoin ? { equity: usdtCoin.equity, walletBalance: usdtCoin.walletBalance } : 'NOT FOUND',
        coinCount: coins.length,
      })

      if (rawEquity === null) {
        throw new Error('No USDT equity value found in Bybit wallet response. Check accountType and coin array.')
      }

      const liveEquity = parseFloat(rawEquity)

      if (isNaN(liveEquity) || liveEquity < 0) {
        throw new Error(`Invalid USDT equity received from Bybit: "${rawEquity}"`)
      }

      // Guard: equity of exactly zero on an account with initial_balance > 0 means
      // the coin array was empty (wrong account type) -- NOT a real drawdown.
      // Without this guard, a single sync with an empty coin array would trigger
      // challenge fail, wipe the demo balance, and freeze the dashboard forever.
      const initialForCheck = parseFloat(acct.initial_balance ?? 0)
      if (liveEquity === 0 && initialForCheck > 100) {
        throw new Error(`Bybit returned zero equity for an account with initial_balance ${initialForCheck}. Likely wrong accountType or empty coin array. Skipping to prevent false drawdown fail.`)
      }

      console.log('[useBybitSync] Step 2 OK: liveEquity =', liveEquity)
      // ── Step 3: Fetch open positions ─────────────────────────────────────
      const posResult = await proxyGet(key, secret, '/v5/position/list', {
        category: 'linear', settleCoin: 'USDT',
      })
      const openPos = (posResult?.list ?? [])
        .filter(p => parseFloat(p.size) > 0)
        .map(p => ({
          symbol:        p.symbol,
          side:          p.side,
          size:          parseFloat(p.size),
          entryPrice:    parseFloat(p.avgPrice),
          markPrice:     parseFloat(p.markPrice),
          unrealisedPnl: parseFloat(p.unrealisedPnl),
          takeProfit:    parseFloat(p.takeProfit)  || null,
          stopLoss:      parseFloat(p.stopLoss)    || null,
          leverage:      parseInt(p.leverage, 10)  || 1,
        }))

      // ── Step 4: Fetch closed PnL -- win-rate + trading days calculation ───
      // Bybit's closed-pnl endpoint returns all historical closes.
      // We pull the last 200 filtered to the current challenge start so past
      // challenges never inflate the trading-day count.
      // Failures are non-critical -- winStats and computedTradingDays fall back
      // to their last known DB values rather than crashing the sync.

      // Initialise to last known DB value -- overwritten below if API succeeds.
      // Safe fallback: never reset to 0 on a transient API error.
      let computedTradingDays = acct.bybit_trading_days ?? 0

      try {
        const closedResult = await proxyGet(key, secret, '/v5/position/closed-pnl', {
          category: 'linear',
          limit: 200,
        })
        const closedList = closedResult?.list ?? []

        // Filter to ONLY trades closed during this challenge.
        // bybit_connected_at marks challenge start -- prevents prior-challenge trades
        // from inflating win rate or trading days. Same filter for both.
        const challengeStartMs = acct.bybit_connected_at
          ? new Date(acct.bybit_connected_at).getTime()
          : (acct.created_at ? new Date(acct.created_at).getTime() : 0)

        const thisChallengeList = closedList.filter(
          t => t.updatedTime && parseInt(t.updatedTime, 10) >= challengeStartMs
        )

        if (thisChallengeList.length > 0) {
          const wins   = thisChallengeList.filter(t => parseFloat(t.closedPnl) > 0).length
          const losses = thisChallengeList.filter(t => parseFloat(t.closedPnl) < 0).length
          setWinStats({ wins, losses, total: thisChallengeList.length })
          setClosedTrades(thisChallengeList)

          // Trading days = distinct calendar days where >=1 trade was closed.
          // Mirrors IJGF tradingService.js is_close logic exactly.
          computedTradingDays = new Set(
            thisChallengeList.map(
              t => new Date(parseInt(t.updatedTime, 10)).toISOString().split('T')[0]
            )
          ).size
        }
      } catch (e) {
        // Non-fatal -- win rate and trading days show previous DB values
        console.warn('[useBybitSync] closed-pnl fetch failed (non-fatal):', e.message)
      }

      // ── Step 5: TP/SL Enforcement ────────────────────────────────────────
      // Clear tracker entries for positions that have been closed
      const openSymbols = new Set(openPos.map(p => p.symbol))
      for (const sym of Object.keys(noSlCycles.current)) {
        if (!openSymbols.has(sym)) delete noSlCycles.current[sym]
      }
      // Check every open position for a missing Stop Loss
      for (const pos of openPos) {
        if (!pos.stopLoss) {
          const cycles = (noSlCycles.current[pos.symbol] ?? 0) + 1
          noSlCycles.current[pos.symbol] = cycles
          if (cycles >= TPSL_GRACE_CYCLES) {
            console.warn(
              `[useBybitSync] Force-closing ${pos.symbol} - no SL for ${cycles} cycles`
            )
            await closeBybitPosition(key, secret, pos).catch(e =>
              console.error(`[useBybitSync] Force-close ${pos.symbol} failed:`, e.message)
            )
            delete noSlCycles.current[pos.symbol]
          }
        } else {
          // Trader added their SL -- reset counter
          delete noSlCycles.current[pos.symbol]
        }
      }

      // ── Step 6: Trading Days Tracking ────────────────────────────────────
      // Derived from closed positions (computed in Step 4).
      // A trading day is a CALENDAR DAY where the user CLOSED at least one trade
      // this challenge -- identical to IJGF's is_close logic in tradingService.js.
      // Opening a position alone does NOT count.
      //
      // CRITICAL: Trading days must NEVER decrease.
      // The closed-pnl endpoint has a hard limit of 200 records. If the trader
      // has more than 200 closes, older calendar days roll off the paginated
      // response and the computed count drops. We take MAX(computed, DB stored)
      // so a legitimately earned day is never silently un-counted.
      // The only source of truth for "did this day happen" is what we've
      // already verified and persisted -- we only ever move forward.
      const initial        = parseFloat(acct.initial_balance)
      const prevDays       = acct.bybit_trading_days ?? 0
      const newTradingDays = Math.max(computedTradingDays, prevDays)

      // Only write to DB when the value has actually changed
      if (newTradingDays !== prevDays) {
        supabase.from('demo_accounts').update({
          bybit_trading_days: newTradingDays,
        }).eq('id', acct.id)
          .then(({ error: e }) => {
            if (e) console.error('[useBybitSync] tradingDays update error:', e.message)
          })
      }

      // ── Step 7: Pass / Fail Evaluation ───────────────────────────────────
      const pnl      = liveEquity - initial
      const drawdown = initial - liveEquity   // positive = net loss from initial
      const target   = parseFloat(acct.profit_target)
      // Use max_total_drawdown → max_drawdown → 8% fallback (normalised)
      const maxDD    = parseFloat(
        acct.max_total_drawdown ??
        acct.max_drawdown       ??
        (initial * 0.08)
      )
      const minDays  = parseInt(acct.min_trading_days ?? 5, 10)

      let newStatus = null
      if (!statusFired.current) {
        if (drawdown >= maxDD) {
          newStatus = 'failed'
        } else if (pnl >= target && newTradingDays >= minDays) {
          newStatus = 'passed'
        }
      }

      // ── Step 8: Update React state immediately ───────────────────────────
      // State update MUST happen before the DB write so that a Supabase failure
      // (network blip, rate limit, row lock) can never block the UI from showing
      // the live data we already successfully fetched from Bybit.
      // This is the root cause of "trade not reflecting" -- DB write was awaited
      // first, and any failure skipped setEquity() entirely.
      const updatedAccount = {
        ...acct,
        current_balance:    liveEquity,
        bybit_equity:       liveEquity,
        bybit_trading_days: newTradingDays,
        status:             newStatus ?? acct.status,
      }
      console.log('[useBybitSync] Step 8 OK: updating React state. equity:', liveEquity, 'positions:', openPos.length, 'tradingDays:', newTradingDays)
      setAccount(updatedAccount)
      setEquity(liveEquity)
      setPositions(openPos)
      setTradingDays(newTradingDays)
      setLastSync(new Date())
      setError(null)

      // ── Step 9: Persist to Supabase (fire-and-forget) ────────────────────
      // Non-blocking -- a DB write failure must not affect the UI.
      // The live data is already displayed above; the DB write is secondary.
      const dbUpdate = {
        bybit_equity:    liveEquity,
        current_balance: liveEquity,
        bybit_last_sync: new Date().toISOString(),
        updated_at:      new Date().toISOString(),
      }
      if (newStatus) dbUpdate.status = newStatus

      supabase.from('demo_accounts').update(dbUpdate).eq('id', acct.id)
        .then(({ error: dbErr }) => {
          if (dbErr) console.error('[useBybitSync] DB persist error (non-critical):', dbErr.message)
        })

      // ── Step 10: Fire pass/fail once ───────────────────────────────────────
      if (newStatus && !statusFired.current) {
        statusFired.current = true
        // On failure: close all open positions FIRST, then nuke.
        // Nuking USDT while positions are open locks margin that the nuke
        // cannot reduce, and leaves floating unrealised PnL in Bybit.
        if (newStatus === 'failed' && openPos.length > 0) {
          await Promise.allSettled(
            openPos.map(pos =>
              closeBybitPosition(key, secret, pos).catch(e =>
                console.error(`[useBybitSync] Force-close on breach ${pos.symbol}:`, e.message)
              )
            )
          )
        }
        nukeBybitBalance(key, secret).catch(() => {})   // fire-and-forget
        onStatusChangeRef.current?.(newStatus, updatedAccount, newTradingDays)
      }

    } catch (err) {
      console.error('[useBybitSync] Sync FAILED at step:', err.message)
      setError(`Sync failed: ${err.message}`)
    } finally {
      isSyncing.current = false
      setLoading(false)
    }
  }, [userId, tradingMode])

  // Mount immediately + poll every 10s
  useEffect(() => {
    if (!userId || tradingMode !== 'bybit') {
      setLoading(false)
      return
    }
    // Reset guards each time a new Bybit challenge starts (tradingMode flips to 'bybit')
    statusFired.current = false
    noSlCycles.current  = {}

    runSync()
    const interval = setInterval(runSync, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [userId, tradingMode, runSync])

  return { equity, positions, winStats, closedTrades, tradingDays, account, loading, error, lastSync, syncNow: runSync }
}
