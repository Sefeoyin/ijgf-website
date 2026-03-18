import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './supabase'

// ─── helpers ────────────────────────────────────────────────────────────────
function fmt(n, decimals = 2) {
  if (n == null || isNaN(n)) return '--'
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function fmtDate(ts) {
  if (!ts) return '--'
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts)
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function TradeHistoryPage({ userId, bybitData }) {
  // ── Detect Bybit mode ────────────────────────────────────────────────────
  const isBybit = bybitData?.account?.trading_mode === 'bybit'

  // ── Theme tokens (CSS variables — light/dark via body[data-theme]) ─────────
  const t = {
    cardBg:       'var(--bg-card)',
    cardBorder:   'var(--border-color)',
    rowBorder:    'var(--border-color)',
    rowHoverBg:   'var(--bg-card-hover, rgba(255,255,255,0.025))',
    textPrimary:  'var(--text-primary)',
    textSecondary:'var(--text-secondary)',
    textMuted:    'var(--text-muted)',
    textFaint:    'var(--text-muted)',
    textCell:     'var(--text-secondary)',
    inputBg:      'var(--bg-card)',
    inputBorder:  'var(--border-color)',
    bannerBg:     'rgba(245,158,11,0.07)',
    bannerBorder: 'rgba(245,158,11,0.2)',
    bannerText:   'var(--text-secondary)',
    winRow:       'rgba(34,197,94,0.04)',
    lossRow:      'rgba(246,70,93,0.04)',
  }

  // ── IJGF state ────────────────────────────────────────────────────────────
  const [ijgfTrades, setIjgfTrades] = useState([])
  const [loading, setLoading]       = useState(true)
  const [page, setPage]             = useState(0)
  const PAGE_SIZE = 50

  // ── Shared filter/sort state ──────────────────────────────────────────────
  const [search,     setSearch]     = useState('')
  const [sideFilter, setSideFilter] = useState('all') // all | long | short
  const [sortField,  setSortField]  = useState('date')
  const [sortDir,    setSortDir]    = useState('desc')

  // ── Load IJGF trades from Supabase ────────────────────────────────────────
  const loadIJGF = useCallback(async () => {
    if (isBybit || !userId) { setLoading(false); return }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('demo_trades')
        .select('*')
        .eq('user_id', userId)
        // Only closing trades carry realized_pnl and represent a completed round-trip.
        // Opening trades (is_close = false) have no PnL and would create duplicate rows
        // in the history table — one for open, one for close of the same position.
        .eq('is_close', true)
        .order('executed_at', { ascending: false })
        .limit(500)
      if (error) throw error
      setIjgfTrades(data ?? [])
    } catch (err) {
      console.error('[TradeHistoryPage] IJGF load error:', err.message)
    } finally {
      setLoading(false)
    }
  }, [userId, isBybit])

  useEffect(() => { loadIJGF() }, [loadIJGF])

  // ── Normalised trade shape for shared table logic ─────────────────────────
  // Bybit side: 'Sell' = closed a Long, 'Buy' = closed a Short
  // bybitData?.closedTrades is derived inside the memo to avoid a stale-closure
  // warning -- the array reference changes each sync cycle.
  const normalisedBybit = useMemo(() => {
    const bybitClosed = bybitData?.closedTrades ?? []
    return bybitClosed.map(tr => ({
      id:          tr.orderId ?? String(tr.createdTime),
      symbol:      tr.symbol,
      direction:   tr.side === 'Sell' ? 'Long' : 'Short',
      size:        parseFloat(tr.qty)        || 0,
      entryPrice:  parseFloat(tr.entryPrice) || 0,
      exitPrice:   parseFloat(tr.exitPrice)  || 0,
      pnl:         parseFloat(tr.closedPnl)  || 0,
      leverage:    parseInt(tr.leverage, 10) || 1,
      executedAt:  tr.updatedTime ? parseInt(tr.updatedTime, 10) : null,
      source:      'bybit',
    }))
  }, [bybitData])

  const normalisedIJGF = useMemo(() =>
    ijgfTrades.map(tr => ({
      id:         tr.id,
      symbol:     tr.symbol,
      // Closing trades: side is the CLOSING side (SELL=closed a Long, BUY=closed a Short)
      // Reverse-map to show the original position direction, matching Bybit convention.
      direction:  (tr.side ?? '').toUpperCase() === 'SELL' ? 'Long' : 'Short',
      size:       parseFloat(tr.quantity ?? tr.size) || 0,
      entryPrice: parseFloat(tr.entry_price)         || 0,
      // The closing price is stored in the 'price' column (not 'exit_price' — that column
      // does not exist in demo_trades). This was causing exitPrice to always show '--'.
      exitPrice:  parseFloat(tr.price)               || 0,
      pnl:        parseFloat(tr.realized_pnl)        || 0,
      leverage:   parseInt(tr.leverage, 10)          || 1,
      executedAt: tr.executed_at ? new Date(tr.executed_at).getTime() : null,
      source:     'ijgf',
    })),
    [ijgfTrades]
  )

  const trades = isBybit ? normalisedBybit : normalisedIJGF

  // ── Filter + sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = trades
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(t => t.symbol.toLowerCase().includes(q))
    }
    if (sideFilter !== 'all') {
      list = list.filter(t => t.direction.toLowerCase() === sideFilter)
    }
    // Sort
    list = [...list].sort((a, b) => {
      let va, vb
      switch (sortField) {
        case 'date':    va = a.executedAt ?? 0; vb = b.executedAt ?? 0; break
        case 'symbol':  va = a.symbol;          vb = b.symbol;          break
        case 'pnl':     va = a.pnl;             vb = b.pnl;             break
        case 'size':    va = a.size;             vb = b.size;            break
        default:        va = a.executedAt ?? 0; vb = b.executedAt ?? 0
      }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      return sortDir === 'asc' ? va - vb : vb - va
    })
    return list
  }, [trades, search, sideFilter, sortField, sortDir])

  // Pagination
  const totalPages   = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated    = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // ── Aggregate stats ───────────────────────────────────────────────────────
  const aggStats = useMemo(() => {
    if (filtered.length === 0) return null
    const wins    = filtered.filter(t => t.pnl > 0)
    const losses  = filtered.filter(t => t.pnl < 0)
    const total   = filtered.reduce((s, t) => s + t.pnl, 0)
    const avgWin  = wins.length  > 0 ? wins.reduce((s, t) => s + t.pnl, 0)   / wins.length  : 0
    const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0
    const grossW  = wins.reduce((s, t) => s + t.pnl, 0)
    const grossL  = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))
    return {
      count:    filtered.length,
      wins:     wins.length,
      losses:   losses.length,
      winRate:  ((wins.length / filtered.length) * 100).toFixed(1),
      totalPnl: total,
      avgWin,
      avgLoss,
      pf:       grossL > 0 ? (grossW / grossL).toFixed(2) : wins.length > 0 ? '∞' : '--',
    }
  }, [filtered])

  // ── Sort toggle helper ────────────────────────────────────────────────────
  function toggleSort(field) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
    setPage(0)
  }

  function SortIcon({ field }) {
    if (sortField !== field) return <span style={{ opacity: 0.3, fontSize: '0.7rem' }}>⇅</span>
    return <span style={{ fontSize: '0.7rem', color: '#7c3aed' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // ── CSV export ────────────────────────────────────────────────────────────
  function exportCSV() {
    const headers = ['Date','Symbol','Direction','Size','Entry','Exit','PnL','Leverage']
    const rows = filtered.map(t => [
      fmtDate(t.executedAt),
      t.symbol,
      t.direction,
      t.size,
      t.entryPrice.toFixed(2),
      t.exitPrice.toFixed(2),
      t.pnl.toFixed(4),
      `${t.leverage}x`,
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `ijgf_trade_history_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Loading (IJGF only) ───────────────────────────────────────────────────
  if (!isBybit && loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', gap:12, flexDirection:'column', color: t.textMuted }}>
        <div style={{ width:32, height:32, border:`3px solid rgba(124,58,237,0.2)`, borderTopColor:'#7c3aed', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        <span style={{ fontSize:'0.9rem' }}>Loading trade history…</span>
      </div>
    )
  }

  const inputStyle = {
    background:   t.inputBg,
    border:       `1px solid ${t.inputBorder}`,
    borderRadius: 8,
    padding:      '7px 12px',
    color:        t.textPrimary,
    fontSize:     '0.83rem',
    outline:      'none',
  }

  const tabStyle = (active) => ({
    padding:      '5px 14px',
    borderRadius: 6,
    border:       active ? '1px solid rgba(124,58,237,0.5)' : `1px solid ${t.inputBorder}`,
    background:   active ? 'rgba(124,58,237,0.15)' : t.inputBg,
    color:        active ? '#a78bfa' : t.textSecondary,
    fontSize:     '0.8rem',
    fontWeight:   active ? 600 : 400,
    cursor:       'pointer',
    transition:   'all 0.15s',
  })

  const thStyle = (field) => ({
    padding:       '8px 12px',
    textAlign:     field === 'symbol' || field === 'direction' ? 'left' : 'right',
    fontWeight:    600,
    fontSize:      '0.73rem',
    color:         sortField === field ? '#a78bfa' : t.textMuted,
    cursor:        'pointer',
    whiteSpace:    'nowrap',
    userSelect:    'none',
  })

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1100, margin: '0 auto' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* ── Bybit live banner ── */}
      {isBybit && (
        <div style={{
          display:'flex', alignItems:'center', gap:8, marginBottom:20,
          padding:'9px 14px',
          background: t.bannerBg, border:`1px solid ${t.bannerBorder}`,
          borderRadius:10, fontSize:'0.8rem', color: t.bannerText, flexWrap:'wrap',
        }}>
          <span style={{ color:'#f59e0b', fontWeight:700 }}>● LIVE</span>
          Bybit Demo Trading -- data syncs every 10s
          {bybitData?.lastSync && (
            <span style={{ opacity:0.6 }}>
              Last sync: {bybitData.lastSync.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => bybitData?.syncNow?.()}
            style={{
              marginLeft:4, padding:'2px 10px',
              background:'rgba(245,158,11,0.12)',
              border:'1px solid rgba(245,158,11,0.3)',
              borderRadius:6, fontSize:'0.72rem', fontWeight:600,
              color:'#f59e0b', cursor:'pointer',
            }}
          >Sync Now</button>
          <a href="https://www.bybit.com/en/trade/usdt/BTCUSDT?mode=demo"
            target="_blank" rel="noopener noreferrer"
            style={{ marginLeft:'auto', color:'#f59e0b', textDecoration:'none', fontWeight:600 }}
          >Open Bybit →</a>
        </div>
      )}

      {/* ── Page header ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ margin:0, fontSize:'1.15rem', fontWeight:700, color: t.textPrimary }}>
            Trade History
            {isBybit && <span style={{ marginLeft:10, fontSize:'0.7rem', fontWeight:700, background:'rgba(245,158,11,0.15)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.3)', borderRadius:20, padding:'2px 9px', verticalAlign:'middle' }}>BYBIT DEMO</span>}
          </h2>
          <p style={{ margin:'3px 0 0', fontSize:'0.8rem', color: t.textMuted }}>
            {isBybit
              ? `${bybitData?.closedTrades?.length ?? 0} closed trade${(bybitData?.closedTrades?.length ?? 0) !== 1 ? 's' : ''} this challenge`
              : `${ijgfTrades.length} trade${ijgfTrades.length !== 1 ? 's' : ''} recorded`}
          </p>
        </div>
        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          style={{
            padding:'8px 16px',
            background: filtered.length === 0 ? t.inputBg : 'rgba(124,58,237,0.15)',
            border: `1px solid ${filtered.length === 0 ? t.inputBorder : 'rgba(124,58,237,0.4)'}`,
            borderRadius:8, color: filtered.length === 0 ? t.textFaint : '#a78bfa',
            fontSize:'0.82rem', fontWeight:600, cursor: filtered.length === 0 ? 'default' : 'pointer',
            display:'flex', alignItems:'center', gap:6, transition:'all 0.15s',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export CSV
        </button>
      </div>

      {/* ── Aggregate stat cards ── */}
      {aggStats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:10, marginBottom:20 }}>
          {[
            { label:'Total Trades',  value: aggStats.count,                           color: t.textPrimary },
            { label:'Win Rate',      value:`${aggStats.winRate}%`,                    color: parseFloat(aggStats.winRate) >= 50 ? '#22c55e' : '#f6465d' },
            { label:'Net PnL',       value:`${aggStats.totalPnl >= 0 ? '+' : ''}$${fmt(aggStats.totalPnl)}`,  color: aggStats.totalPnl >= 0 ? '#22c55e' : '#f6465d' },
            { label:'Avg Win',       value:`+$${fmt(aggStats.avgWin)}`,               color:'#22c55e' },
            { label:'Avg Loss',      value:`-$${fmt(Math.abs(aggStats.avgLoss))}`,    color:'#f6465d' },
            { label:'Profit Factor', value: aggStats.pf,                              color: t.textPrimary },
          ].map(s => (
            <div key={s.label} style={{
              background: t.cardBg, border:`1px solid ${t.cardBorder}`,
              borderRadius:10, padding:'12px 14px',
            }}>
              <div style={{ fontSize:'0.72rem', color: t.textMuted, marginBottom:4 }}>{s.label}</div>
              <div style={{ fontSize:'1.0rem', fontWeight:700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filter bar ── */}
      <div style={{
        background: t.cardBg, border:`1px solid ${t.cardBorder}`,
        borderRadius:12, padding:'12px 16px', marginBottom:12,
        display:'flex', alignItems:'center', gap:10, flexWrap:'wrap',
      }}>
        <input
          type="text"
          placeholder="Search symbol…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
          style={{ ...inputStyle, minWidth:160 }}
        />
        <div style={{ display:'flex', gap:6 }}>
          {[['all','All'],['long','Long'],['short','Short']].map(([v,l]) => (
            <button key={v} onClick={() => { setSideFilter(v); setPage(0) }} style={tabStyle(sideFilter === v)}>{l}</button>
          ))}
        </div>
        <span style={{ marginLeft:'auto', fontSize:'0.78rem', color: t.textFaint }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          {filtered.length < trades.length ? ` (filtered from ${trades.length})` : ''}
        </span>
      </div>

      {/* ── Trade table ── */}
      <div style={{
        background: t.cardBg, border:`1px solid ${t.cardBorder}`,
        borderRadius:12, overflow:'hidden',
      }}>
        {paginated.length === 0 ? (
          <div style={{ padding:'60px 20px', textAlign:'center', color: t.textMuted }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity:0.4, display:'block', margin:'0 auto 12px' }}>
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
            </svg>
            {isBybit
              ? 'No closed trades for this challenge yet. Start trading on Bybit Demo.'
              : 'No trades found. Start a challenge to begin trading.'}
            {isBybit && (
              <div style={{ marginTop:14 }}>
                <a href="https://www.bybit.com/en/trade/usdt/BTCUSDT?mode=demo"
                  target="_blank" rel="noopener noreferrer"
                  style={{ color:'#f59e0b', fontWeight:600, fontSize:'0.85rem', textDecoration:'none' }}
                >Open Bybit Demo →</a>
              </div>
            )}
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem' }}>
              <thead>
                <tr style={{ borderBottom:`1px solid ${t.cardBorder}` }}>
                  <th onClick={() => toggleSort('date')}   style={thStyle('date')}>Date & Time <SortIcon field="date"/></th>
                  <th onClick={() => toggleSort('symbol')} style={{ ...thStyle('symbol'), textAlign:'left' }}>Symbol <SortIcon field="symbol"/></th>
                  <th style={{ ...thStyle('direction'), cursor:'default' }}>Direction</th>
                  <th onClick={() => toggleSort('size')}   style={thStyle('size')}>Size <SortIcon field="size"/></th>
                  <th style={{ ...thStyle('entry'), cursor:'default' }}>Entry</th>
                  <th style={{ ...thStyle('exit'), cursor:'default' }}>Exit</th>
                  <th onClick={() => toggleSort('pnl')}    style={thStyle('pnl')}>PnL <SortIcon field="pnl"/></th>
                  <th style={{ ...thStyle('leverage'), cursor:'default' }}>Lev.</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((tr, i) => (
                  <tr
                    key={tr.id ?? i}
                    style={{
                      borderBottom:`1px solid ${t.rowBorder}`,
                      background: tr.pnl > 0 ? t.winRow : tr.pnl < 0 ? t.lossRow : 'transparent',
                      transition:'background 0.1s',
                    }}
                  >
                    <td style={{ padding:'9px 12px', color: t.textFaint, fontSize:'0.76rem', whiteSpace:'nowrap' }}>
                      {fmtDate(tr.executedAt)}
                    </td>
                    <td style={{ padding:'9px 12px', color: t.textPrimary, fontWeight:600 }}>
                      {tr.symbol}
                    </td>
                    <td style={{ padding:'9px 12px', textAlign:'right', fontWeight:600,
                      color: tr.direction === 'Long' ? '#22c55e' : '#f6465d' }}>
                      {tr.direction}
                    </td>
                    <td style={{ padding:'9px 12px', textAlign:'right', color: t.textCell }}>
                      {tr.size}
                    </td>
                    <td style={{ padding:'9px 12px', textAlign:'right', color: t.textCell }}>
                      ${fmt(tr.entryPrice)}
                    </td>
                    <td style={{ padding:'9px 12px', textAlign:'right', color: t.textCell }}>
                      {tr.exitPrice > 0 ? `$${fmt(tr.exitPrice)}` : '--'}
                    </td>
                    <td style={{ padding:'9px 12px', textAlign:'right', fontWeight:700,
                      color: tr.pnl > 0 ? '#22c55e' : tr.pnl < 0 ? '#f6465d' : t.textCell }}>
                      {tr.pnl >= 0 ? '+' : ''}${fmt(tr.pnl)}
                    </td>
                    <td style={{ padding:'9px 12px', textAlign:'right', color: t.textMuted }}>
                      {tr.leverage}x
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'12px 16px', borderTop:`1px solid ${t.rowBorder}`,
          }}>
            <span style={{ fontSize:'0.78rem', color: t.textFaint }}>
              Page {page + 1} of {totalPages} · {filtered.length} trades
            </span>
            <div style={{ display:'flex', gap:6 }}>
              {[['← Prev', page > 0, () => setPage(p => p - 1)],
                ['Next →', page < totalPages - 1, () => setPage(p => p + 1)]].map(([label, enabled, fn]) => (
                <button
                  key={label}
                  onClick={fn}
                  disabled={!enabled}
                  style={{
                    padding:'5px 12px',
                    background: enabled ? 'rgba(124,58,237,0.12)' : t.inputBg,
                    border:`1px solid ${enabled ? 'rgba(124,58,237,0.35)' : t.inputBorder}`,
                    borderRadius:7, fontSize:'0.79rem', fontWeight:600,
                    color: enabled ? '#a78bfa' : t.textFaint,
                    cursor: enabled ? 'pointer' : 'default',
                  }}
                >{label}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Bybit footer note ── */}
      {isBybit && (
        <p style={{ marginTop:16, fontSize:'0.75rem', color: t.textFaint, textAlign:'center' }}>
          Showing closed trades for this challenge. Full history on{' '}
          <a href="https://www.bybit.com/en/trade/usdt/BTCUSDT?mode=demo"
            target="_blank" rel="noopener noreferrer" style={{ color:'#f59e0b' }}>bybit.com</a>
        </p>
      )}
    </div>
  )
}
