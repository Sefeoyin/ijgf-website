/**
 * useBybitSync.js
 *
 * Dashboard-level hook for Bybit Demo Trading challenge tracking.
 * Mounts at Dashboard root — runs on EVERY tab, not just the Market tab.
 *
 * Responsibilities:
 *  1. Poll Bybit every 30s: live equity + open positions via /api/bybit-proxy
 *  2. Sync equity → demo_accounts (current_balance, bybit_equity, bybit_last_sync)
 *  3. Trading days: increment bybit_trading_days once per calendar day when
 *     the account has open positions OR equity has moved from initial_balance
 *  4. TP/SL enforcement: track positions without a Stop Loss across sync cycles.
 *     Force-close (reduce-only IOC market order) after TPSL_GRACE_CYCLES (~60s)
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
 * Returns: { equity, positions, tradingDays, account, loading, error, lastSync }
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'

const BYBIT_PROXY       = '/api/bybit-proxy'
const POLL_INTERVAL_MS  = 30_000  // 30 seconds
const TPSL_GRACE_CYCLES = 2       // ~60s grace before force-closing SL-less positions

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
  // Return raw json — caller decides whether retCode matters
  return await res.json()
}

// ── Nuke Bybit Demo balance to (near) zero on challenge end ──────────────────
// adjustType:1 = reduce. Loops all coins in ≤100k USDT chunks.
// Bybit enforces a minimum USDT floor — hitting it returns a non-zero retCode
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
    // Non-critical — never block the modal for a nuke failure
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

      if (!acct) { setLoading(false); return }

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
      const coins      = walletResult?.list?.[0]?.coin ?? []
      const usdtCoin   = coins.find(c => c.coin === 'USDT')
      const liveEquity = parseFloat(usdtCoin?.equity ?? usdtCoin?.walletBalance ?? '0')

      if (isNaN(liveEquity) || liveEquity < 0) {
        throw new Error('Invalid USDT equity received from Bybit')
      }

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

      // ── Step 4: TP/SL Enforcement ────────────────────────────────────────
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
              `[useBybitSync] Force-closing ${pos.symbol} — no SL for ${cycles} cycles`
            )
            await closeBybitPosition(key, secret, pos).catch(e =>
              console.error(`[useBybitSync] Force-close ${pos.symbol} failed:`, e.message)
            )
            delete noSlCycles.current[pos.symbol]
          }
        } else {
          // Trader added their SL — reset counter
          delete noSlCycles.current[pos.symbol]
        }
      }

      // ── Step 5: Trading Days Tracking ────────────────────────────────────
      const today          = new Date().toISOString().split('T')[0]   // 'YYYY-MM-DD'
      const prevDays       = acct.bybit_trading_days    ?? 0
      const lastActiveDate = acct.bybit_last_active_date ?? null
      const initial        = parseFloat(acct.initial_balance)
      let   newTradingDays = prevDays

      if (lastActiveDate !== today) {
        // Count today only if: positions are open OR equity has changed since start
        const hasActivity = openPos.length > 0 || Math.abs(liveEquity - initial) > 0.5
        if (hasActivity) {
          newTradingDays = prevDays + 1
          // Non-blocking update — don't await here to avoid delaying pass/fail check
          supabase.from('demo_accounts').update({
            bybit_trading_days:     newTradingDays,
            bybit_last_active_date: today,
          }).eq('id', acct.id)
            .then(({ error: e }) => {
              if (e) console.error('[useBybitSync] tradingDays update error:', e.message)
            })
        }
      }

      // ── Step 6: Pass / Fail Evaluation ───────────────────────────────────
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

      // ── Step 7: Write to Supabase ────────────────────────────────────────
      const dbUpdate = {
        bybit_equity:    liveEquity,
        current_balance: liveEquity,
        bybit_last_sync: new Date().toISOString(),
        updated_at:      new Date().toISOString(),
      }
      if (newStatus) dbUpdate.status = newStatus

      await supabase.from('demo_accounts').update(dbUpdate).eq('id', acct.id)

      // ── Step 8: Update React state ────────────────────────────────────────
      const updatedAccount = {
        ...acct,
        current_balance:    liveEquity,
        bybit_equity:       liveEquity,
        bybit_trading_days: newTradingDays,
        status:             newStatus ?? acct.status,
      }
      setAccount(updatedAccount)
      setEquity(liveEquity)
      setPositions(openPos)
      setTradingDays(newTradingDays)
      setLastSync(new Date())
      setError(null)

      // ── Step 9: Fire pass/fail once ───────────────────────────────────────
      if (newStatus && !statusFired.current) {
        statusFired.current = true
        nukeBybitBalance(key, secret).catch(() => {})   // fire-and-forget
        onStatusChangeRef.current?.(newStatus, updatedAccount, newTradingDays)
      }

    } catch (err) {
      console.error('[useBybitSync] Sync error:', err.message)
      setError(`Sync failed: ${err.message}`)
    } finally {
      isSyncing.current = false
      setLoading(false)
    }
  }, [userId, tradingMode])

  // Mount immediately + poll every 30s
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

  return { equity, positions, tradingDays, account, loading, error, lastSync }
}
