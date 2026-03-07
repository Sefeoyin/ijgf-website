/**
 * BybitLivePanel.jsx
 *
 * Shown on the Market tab when tradingMode === 'bybit'.
 *
 * ── External mode (bybitData prop provided by Dashboard via useBybitSync) ──
 *   Display-only. All sync, pass/fail evaluation, TP/SL enforcement, and
 *   DB writes are owned by useBybitSync running at Dashboard root.
 *   This component simply renders what the hook returns.
 *
 * ── Fallback mode (no bybitData prop) ────────────────────────────────────
 *   Self-polls every 30s for standalone use cases.
 *   Does NOT run pass/fail evaluation — that must be in useBybitSync.
 *
 * TP/SL violation banner is shown whenever any open position is missing a SL.
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

const BYBIT_PROXY = '/api/bybit-proxy'

async function bybitGet(apiKey, apiSecret, endpoint, params = {}) {
  const res = await fetch(BYBIT_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret, method: 'GET', endpoint, params }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Proxy ${res.status}`)
  const json = await res.json()
  if (json.retCode !== 0) throw new Error(`Bybit ${json.retCode}: ${json.retMsg}`)
  return json.result
}

export default function BybitLivePanel({ userId, bybitData }) {
  // ── Fallback-only local state (unused in external mode) ─────────────────
  const [acct,      setAcct]      = useState(null)
  const [equity,    setEquity]    = useState(null)
  const [positions, setPositions] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [lastSync,  setLastSync]  = useState(null)

  const isExternal = !!bybitData  // true → Dashboard owns sync

  // ── Fallback self-poll ────────────────────────────────────────────────────
  const fetchAccount = useCallback(async () => {
    const { data } = await supabase
      .from('demo_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('trading_mode', 'bybit')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data
  }, [userId])

  const syncBybit = useCallback(async () => {
    if (isExternal) return
    try {
      const account = await fetchAccount()
      if (!account) { setLoading(false); return }
      setAcct(account)

      if (!account.bybit_api_key || !account.bybit_api_secret) {
        setError('No Bybit API credentials found. Please reconnect.')
        setLoading(false)
        return
      }

      const { bybit_api_key: key, bybit_api_secret: secret } = account

      let walletResult
      try {
        walletResult = await bybitGet(key, secret, '/v5/account/wallet-balance', { accountType: 'UNIFIED' })
      } catch {
        walletResult = await bybitGet(key, secret, '/v5/account/wallet-balance', { accountType: 'CONTRACT' })
      }
      const coins      = walletResult?.list?.[0]?.coin ?? []
      const usdtCoin   = coins.find(c => c.coin === 'USDT')
      const liveEquity = parseFloat(usdtCoin?.equity ?? usdtCoin?.walletBalance ?? 0)
      setEquity(liveEquity)

      const posResult = await bybitGet(key, secret, '/v5/position/list', {
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
          takeProfit:    parseFloat(p.takeProfit) || null,
          stopLoss:      parseFloat(p.stopLoss)   || null,
          leverage:      parseInt(p.leverage, 10),
        }))
      setPositions(openPos)
      setLastSync(new Date())
      setError('')

      // Display-only DB sync (no pass/fail — useBybitSync owns that)
      await supabase.from('demo_accounts').update({
        bybit_equity:    liveEquity,
        current_balance: liveEquity,
        bybit_last_sync: new Date().toISOString(),
        updated_at:      new Date().toISOString(),
      }).eq('id', account.id)

    } catch (err) {
      setError(`Failed to sync: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [fetchAccount, isExternal])

  useEffect(() => {
    if (isExternal) return
    fetchAccount().then(a => { if (a) setAcct(a) })
  }, [fetchAccount, isExternal])

  useEffect(() => {
    if (isExternal) return
    syncBybit()
    const interval = setInterval(syncBybit, 30_000)
    return () => clearInterval(interval)
  }, [syncBybit, isExternal])

  // ── Resolve data source ──────────────────────────────────────────────────
  const resolvedAcct      = isExternal ? bybitData.account    : acct
  const resolvedEquity    = isExternal ? bybitData.equity      : equity
  const resolvedPositions = isExternal ? bybitData.positions   : positions
  const resolvedLoading   = isExternal ? bybitData.loading     : loading
  const resolvedError     = isExternal ? (bybitData.error || '') : error
  const resolvedLastSync  = isExternal ? bybitData.lastSync    : lastSync

  // ── Derived render values ────────────────────────────────────────────────
  const initial  = resolvedAcct ? parseFloat(resolvedAcct.initial_balance) : 0
  const pnl      = resolvedEquity != null ? resolvedEquity - initial : null
  const pnlPct   = pnl != null && initial > 0 ? (pnl / initial) * 100 : null
  const drawdown = resolvedEquity != null ? Math.max(0, initial - resolvedEquity) : null
  const ddPct    = drawdown != null && initial > 0 ? (drawdown / initial) * 100 : null
  const target   = resolvedAcct ? parseFloat(resolvedAcct.profit_target) : 0
  const maxDD    = resolvedAcct
    ? parseFloat(resolvedAcct.max_total_drawdown ?? resolvedAcct.max_drawdown ?? initial * 0.08)
    : 0
  const progress = pnl != null && target > 0
    ? Math.min(100, Math.max(0, (pnl / target) * 100))
    : 0

  // TP/SL violation: positions without a Stop Loss
  const violatingPositions = resolvedPositions.filter(p => !p.stopLoss)

  const fmt = (n, decimals = 2) =>
    n != null
      ? n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : '—'

  // ── Loading state ────────────────────────────────────────────────────────
  if (resolvedLoading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'rgba(255,255,255,0.4)' }}>
      <span style={{ fontSize:'0.95rem' }}>Syncing Bybit account…</span>
    </div>
  )

  if (!resolvedAcct) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60vh', gap:12, color:'rgba(255,255,255,0.4)' }}>
      <p style={{ fontSize:'1rem' }}>No active Bybit challenge found.</p>
      <p style={{ fontSize:'0.85rem' }}>Start a new challenge and choose Connect Bybit Demo.</p>
    </div>
  )

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding:'24px 20px', maxWidth:900, margin:'0 auto' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ margin:0, fontSize:'1.2rem', fontWeight:700, color:'#eaecef' }}>
            Bybit Demo Challenge
            <span style={{
              marginLeft:10, fontSize:'0.7rem', fontWeight:700,
              background:'rgba(245,158,11,0.15)', color:'#f59e0b',
              border:'1px solid rgba(245,158,11,0.3)', borderRadius:20, padding:'2px 9px',
              verticalAlign:'middle',
            }}>DEMO</span>
            {isExternal && (
              <span style={{
                marginLeft:8, fontSize:'0.65rem', fontWeight:700,
                background:'rgba(34,197,94,0.12)', color:'#22c55e',
                border:'1px solid rgba(34,197,94,0.2)', borderRadius:20, padding:'2px 8px',
                verticalAlign:'middle',
              }}>● LIVE</span>
            )}
          </h2>
          <p style={{ margin:'4px 0 0', fontSize:'0.82rem', color:'rgba(255,255,255,0.4)' }}>
            {resolvedLastSync ? `Last synced ${resolvedLastSync.toLocaleTimeString()}` : 'Syncing…'}
          </p>
        </div>
        <a
          href="https://www.bybit.com/en/trade/usdt/BTCUSDT?mode=demo"
          target="_blank" rel="noopener noreferrer"
          style={{
            padding:'9px 18px', background:'linear-gradient(135deg,#f59e0b,#fbbf24)',
            color:'#000', borderRadius:9, fontWeight:700, fontSize:'0.85rem', textDecoration:'none',
          }}
        >Open Bybit Demo →</a>
      </div>

      {/* Error banner */}
      {resolvedError && (
        <div style={{
          background:'rgba(246,70,93,0.1)', border:'1px solid rgba(246,70,93,0.3)',
          color:'#f6465d', borderRadius:9, padding:'10px 14px', fontSize:'0.84rem', marginBottom:16,
        }}>{resolvedError}</div>
      )}

      {/* TP/SL violation banner — shown when any open position has no Stop Loss */}
      {violatingPositions.length > 0 && (
        <div style={{
          display:'flex', alignItems:'center', gap:10, marginBottom:16,
          padding:'11px 16px',
          background:'rgba(246,70,93,0.1)', border:'1px solid rgba(246,70,93,0.4)',
          borderRadius:10, fontSize:'0.85rem', color:'#f6465d',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink:0 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>
            <strong>Stop Loss required</strong> — {violatingPositions.length} position{violatingPositions.length > 1 ? 's' : ''} missing a Stop Loss
            ({violatingPositions.map(p => p.symbol).join(', ')}).
            Positions will be force-closed in ~60s if SL is not set.
          </span>
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { label:'Account Equity',   value:`$${fmt(resolvedEquity)}`,     color: (pnl ?? 0) >= 0 ? '#22c55e' : '#f6465d' },
          { label:'P&L',              value: pnl != null ? `${pnl >= 0 ? '+' : ''}$${fmt(pnl)} (${pnl >= 0 ? '+' : ''}${fmt(pnlPct)}%)` : '—', color: (pnl ?? 0) >= 0 ? '#22c55e' : '#f6465d' },
          { label:'Drawdown',         value: drawdown != null ? `$${fmt(drawdown)} (${fmt(ddPct)}%)` : '—', color: drawdown > maxDD * 0.7 ? '#f59e0b' : 'rgba(255,255,255,0.7)' },
          { label:'Initial Balance',  value:`$${fmt(initial)}`,             color:'rgba(255,255,255,0.7)' },
        ].map(s => (
          <div key={s.label} style={{
            background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)',
            borderRadius:12, padding:'14px 16px',
          }}>
            <div style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.4)', marginBottom:5 }}>{s.label}</div>
            <div style={{ fontSize:'1.05rem', fontWeight:700, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Profit target progress */}
      <div style={{
        background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)',
        borderRadius:12, padding:'16px 18px', marginBottom:16,
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
          <span style={{ fontSize:'0.82rem', color:'rgba(255,255,255,0.5)' }}>Profit Target Progress</span>
          <span style={{ fontSize:'0.82rem', fontWeight:600, color:progress >= 100 ? '#22c55e' : '#eaecef' }}>
            ${fmt(Math.max(0, pnl ?? 0))} / ${fmt(target)}
          </span>
        </div>
        <div style={{ height:8, background:'rgba(255,255,255,0.08)', borderRadius:4, overflow:'hidden' }}>
          <div style={{
            height:'100%', borderRadius:4,
            background: progress >= 100 ? '#22c55e' : 'linear-gradient(90deg,#7c3aed,#a855f7)',
            width:`${progress}%`, transition:'width 0.5s ease',
          }}/>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
          <span style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.35)' }}>Max Drawdown Limit: ${fmt(maxDD)}</span>
          <span style={{ fontSize:'0.75rem', color:progress >= 100 ? '#22c55e' : 'rgba(255,255,255,0.35)' }}>
            {progress >= 100 ? '🎉 Target reached!' : `${fmt(progress, 1)}% complete`}
          </span>
        </div>
      </div>

      {/* Open positions */}
      <div style={{
        background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)',
        borderRadius:12, padding:'16px 18px',
      }}>
        <div style={{ fontSize:'0.88rem', fontWeight:600, color:'rgba(255,255,255,0.7)', marginBottom:14 }}>
          Open Positions ({resolvedPositions.length})
        </div>
        {resolvedPositions.length === 0 ? (
          <p style={{ margin:0, fontSize:'0.83rem', color:'rgba(255,255,255,0.35)', textAlign:'center', padding:'12px 0' }}>
            No open positions. Trade on Bybit Demo to see them here.
          </p>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem' }}>
              <thead>
                <tr style={{ color:'rgba(255,255,255,0.4)', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                  {['Symbol','Side','Size','Entry','Mark','Unrealised P&L','TP','SL'].map(h => (
                    <th key={h} style={{ padding:'6px 10px', textAlign: h === 'Symbol' ? 'left' : 'right', fontWeight:500, whiteSpace:'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resolvedPositions.map((p, i) => {
                  const missingTpSl = !p.stopLoss
                  return (
                    <tr key={i} style={{
                      borderBottom:'1px solid rgba(255,255,255,0.05)',
                      background: missingTpSl ? 'rgba(246,70,93,0.04)' : 'transparent',
                    }}>
                      <td style={{ padding:'8px 10px', color:'#eaecef', fontWeight:600 }}>{p.symbol}</td>
                      <td style={{ padding:'8px 10px', textAlign:'right', color: p.side === 'Buy' ? '#22c55e' : '#f6465d', fontWeight:600 }}>{p.side}</td>
                      <td style={{ padding:'8px 10px', textAlign:'right', color:'rgba(255,255,255,0.7)' }}>{p.size}</td>
                      <td style={{ padding:'8px 10px', textAlign:'right', color:'rgba(255,255,255,0.7)' }}>${fmt(p.entryPrice)}</td>
                      <td style={{ padding:'8px 10px', textAlign:'right', color:'rgba(255,255,255,0.7)' }}>${fmt(p.markPrice)}</td>
                      <td style={{ padding:'8px 10px', textAlign:'right', color: p.unrealisedPnl >= 0 ? '#22c55e' : '#f6465d', fontWeight:600 }}>
                        {p.unrealisedPnl >= 0 ? '+' : ''}${fmt(p.unrealisedPnl)}
                      </td>
                      <td style={{ padding:'8px 10px', textAlign:'right', color:'rgba(255,255,255,0.5)' }}>
                        {p.takeProfit ? `$${fmt(p.takeProfit)}` : <span style={{ color:'#f59e0b' }}>⚠ None</span>}
                      </td>
                      <td style={{ padding:'8px 10px', textAlign:'right' }}>
                        {p.stopLoss
                          ? <span style={{ color:'rgba(255,255,255,0.5)' }}>${fmt(p.stopLoss)}</span>
                          : <span style={{ color:'#f6465d', fontWeight:700 }}>⚠ Required</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ margin:'14px 0 0', fontSize:'0.75rem', color:'rgba(255,255,255,0.3)' }}>
          ⚠ Always set Take Profit and Stop Loss on every position to protect your challenge account.
        </p>
      </div>
    </div>
  )
}
