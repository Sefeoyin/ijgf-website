import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './supabase'
import { getAccountState } from './tradingService'

// ─── helpers ────────────────────────────────────────────────────────────────
function fmt(n, d = 2) {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}
function fmtDuration(ms) {
  if (!ms || ms < 0) return '—'
  const m = Math.floor(ms / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem ? `${h}h ${rem}m` : `${h}h`
}
function tradeDuration(trade) {
  if (!trade.opened_at || !trade.closed_at) return null
  return new Date(trade.closed_at) - new Date(trade.opened_at)
}

export default function TradeHistoryPage({ userId }) {
  const [trades, setTrades]             = useState([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [sideFilter, setSideFilter]     = useState('all')
  const [symbolFilter, setSymbolFilter] = useState('all')
  const [showFilters, setShowFilters]   = useState(false)
  const [sortCol, setSortCol]           = useState('executed_at')
  const [sortDir, setSortDir]           = useState('desc')
  const [page, setPage]                 = useState(1)
  const PER_PAGE = 20

  // ── Load & pair open+close records by position_id ─────────────────────────
  // The DB stores two rows per round-trip: is_close=false (open leg) and
  // is_close=true (close leg). We pair them so Entry, Exit, Duration and PNL
  // all appear on a single row — exactly how Binance/Bybit display history.
  const loadTrades = useCallback(async () => {
    setLoading(true)
    try {
      const state = await getAccountState(userId)
      const demoAccountId = state.account.id

      const { data } = await supabase
        .from('demo_trades')
        .select('*')
        .eq('demo_account_id', demoAccountId)
        .order('executed_at', { ascending: false })

      const raw = data || []

      // Index all open legs by position_id
      const openMap = {}
      raw.forEach(t => {
        if (!t.is_close) openMap[t.position_id] = t
      })

      const paired = []
      const closedPositions = new Set()

      // Match every close leg with its open leg
      raw.forEach(t => {
        if (!t.is_close) return
        const openLeg = openMap[t.position_id]
        closedPositions.add(t.position_id)
        paired.push({
          id:           t.id,
          position_id:  t.position_id,
          symbol:       t.symbol,
          side:         openLeg ? (openLeg.side === 'BUY' ? 'LONG' : 'SHORT') : t.side,
          entry_price:  openLeg?.price ?? null,
          exit_price:   t.price,
          quantity:     t.quantity,
          leverage:     t.leverage,
          realized_pnl: t.realized_pnl,
          opened_at:    openLeg?.executed_at ?? null,
          closed_at:    t.executed_at,
          executed_at:  t.executed_at,
        })
      })

      // Include still-open positions (no close leg yet)
      raw.forEach(t => {
        if (!t.is_close && !closedPositions.has(t.position_id)) {
          paired.push({
            id:           t.id,
            position_id:  t.position_id,
            symbol:       t.symbol,
            side:         t.side === 'BUY' ? 'LONG' : 'SHORT',
            entry_price:  t.price,
            exit_price:   null,
            quantity:     t.quantity,
            leverage:     t.leverage,
            realized_pnl: null,
            opened_at:    t.executed_at,
            closed_at:    null,
            executed_at:  t.executed_at,
          })
        }
      })

      paired.sort((a, b) => new Date(b.executed_at) - new Date(a.executed_at))
      setTrades(paired)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return
    loadTrades()
  }, [userId, loadTrades])

  // ── Derived symbols for filter ────────────────────────────────────────────
  const symbols = useMemo(() => {
    const s = new Set(trades.map(t => t.symbol))
    return ['all', ...Array.from(s)]
  }, [trades])

  // ── Filtered + sorted ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...trades]
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(t =>
        t.symbol?.toLowerCase().includes(q) ||
        t.id?.toString().includes(q) ||
        t.side?.toLowerCase().includes(q)
      )
    }
    if (sideFilter !== 'all') list = list.filter(t => t.side?.toLowerCase() === sideFilter)
    if (symbolFilter !== 'all') list = list.filter(t => t.symbol === symbolFilter)

    list.sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol]
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [trades, search, sideFilter, symbolFilter, sortCol, sortDir])

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
    setPage(1)
  }

  // ── CSV export ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['Trade ID','Date & Time','Symbol','Side','Entry','Exit','Size','Leverage','PNL','Duration']
    const rows = filtered.map(t => [
      `TRD-${t.id}`,
      fmtDate(t.executed_at),
      t.symbol,
      t.side,
      fmt(t.entry_price),
      fmt(t.exit_price),
      fmt(t.quantity, 4),
      `${t.leverage}x`,
      t.realized_pnl != null ? (t.realized_pnl >= 0 ? `+${fmt(t.realized_pnl)}` : fmt(t.realized_pnl)) : '—',
      fmtDuration(tradeDuration(t)),
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'ijgf-trade-history.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const SortArrow = ({ col }) => {
    if (sortCol !== col) return <span style={{ opacity: 0.2, fontSize: 10 }}>↕</span>
    return <span style={{ color: '#8b5cf6', fontSize: 10 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  if (loading) return (
    <div className="analytics-loading">
      <div className="analytics-spinner" />
      <span>Loading trade history…</span>
    </div>
  )

  return (
    <div className="history-page">

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="history-toolbar">
        <div className="history-search-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="history-search"
            placeholder="Search by symbol or Trade ID…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
          {search && (
            <button className="history-search-clear" onClick={() => { setSearch(''); setPage(1) }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        <div className="history-toolbar-right">
          <button className={`history-filter-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(v => !v)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
            Filter
          </button>
          <button className="history-export-btn" onClick={exportCSV}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export as CSV
          </button>
        </div>
      </div>

      {/* ── Filter row ───────────────────────────────────────────────────── */}
      {showFilters && (
        <div className="history-filter-row">
          <div className="history-filter-group">
            <label>Side</label>
            <div className="history-filter-pills">
              {['all','long','short'].map(s => (
                <button key={s} className={`history-pill ${sideFilter === s ? 'active' : ''}`}
                  onClick={() => { setSideFilter(s); setPage(1) }}>
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="history-filter-group">
            <label>Symbol</label>
            <div className="history-filter-pills">
              {symbols.map(s => (
                <button key={s} className={`history-pill ${symbolFilter === s ? 'active' : ''}`}
                  onClick={() => { setSymbolFilter(s); setPage(1) }}>
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
            </div>
          </div>
          {(sideFilter !== 'all' || symbolFilter !== 'all') && (
            <button className="history-clear-filters" onClick={() => { setSideFilter('all'); setSymbolFilter('all'); setPage(1) }}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="history-table-wrap">
        {filtered.length === 0 ? (
          <div className="history-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(139,92,246,0.3)" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <p>{search ? 'No trades match your search.' : 'No trade history yet.'}</p>
          </div>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                {[
                  ['id','Trade ID'],
                  ['executed_at','Date & Time'],
                  ['symbol','Symbol'],
                  ['side','Side'],
                  ['entry_price','Entry'],
                  ['exit_price','Exit'],
                  ['quantity','Size'],
                  ['leverage','Leverage'],
                  ['realized_pnl','PNL'],
                  [null,'Duration'],
                ].map(([col, label]) => (
                  <th key={label} onClick={col ? () => toggleSort(col) : undefined}
                    className={col ? 'sortable' : ''}>
                    {label} {col && <SortArrow col={col} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(trade => {
                const pnl = trade.realized_pnl
                const dur = tradeDuration(trade)
                // ROI as % of margin used (matches Binance/Bybit convention)
                const margin = trade.entry_price && trade.quantity && trade.leverage
                  ? (trade.entry_price * trade.quantity) / trade.leverage : null
                const pnlPct = pnl != null && margin ? ((pnl / margin) * 100).toFixed(2) : null

                return (
                  <tr key={trade.id}>
                    <td className="history-id">TRD-{String(trade.id).slice(-5).toUpperCase()}</td>
                    <td className="history-date">{fmtDate(trade.executed_at)}</td>
                    <td className="history-symbol">{trade.symbol}</td>
                    <td>
                      <span className={`history-side-badge ${trade.side?.toLowerCase() === 'long' ? 'long' : 'short'}`}>
                        {trade.side?.toLowerCase() === 'long' ? 'Buy' : 'Sell'}
                      </span>
                    </td>
                    <td>{fmt(trade.entry_price)}</td>
                    <td>{fmt(trade.exit_price)}</td>
                    <td>{fmt(trade.quantity, 4)}</td>
                    <td>{trade.leverage}x</td>
                    <td>
                      {pnl != null ? (
                        <span className={pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                          {pnl >= 0 ? '+' : ''}{fmt(pnl)}
                          {pnlPct && <span className="pnl-pct"> ({pnl >= 0 ? '+' : ''}{pnlPct}%)</span>}
                        </span>
                      ) : '—'}
                    </td>
                    <td>{fmtDuration(dur)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="history-pagination">
          <span className="history-count">
            {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} trades
          </span>
          <div className="history-page-btns">
            <button disabled={page === 1} onClick={() => setPage(1)}>«</button>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2 + i, totalPages - 4 + i))
              return (
                <button key={p} className={page === p ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>
              )
            })}
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
            <button disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
          </div>
        </div>
      )}
    </div>
  )
}
