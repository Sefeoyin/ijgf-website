import { useState, useEffect } from 'react'
import { getAccountState } from './tradingService'

// ─── helpers ────────────────────────────────────────────────────────────────
function fmt(n, d = 2) {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function pct(val, total) {
  if (!total) return 0
  return Math.min(100, Math.max(0, (val / total) * 100))
}

// ─── Progress bar ─────────────────────────────────────────────────────────
function ProgressBar({ value, max, color = '#8b5cf6', warn = 70, danger = 90 }) {
  const perc = pct(value, max)
  const c = perc >= danger ? '#f87171' : perc >= warn ? '#fbbf24' : color
  return (
    <div className="rules-progress-track">
      <div className="rules-progress-fill" style={{ width: `${perc}%`, background: c }} />
    </div>
  )
}

// ─── Status chip ──────────────────────────────────────────────────────────
function StatusChip({ ok, label }) {
  return (
    <span className={`rules-status-chip ${ok ? 'ok' : 'breach'}`}>
      {ok ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      )}
      {label}
    </span>
  )
}

// ─── Accordion rule ───────────────────────────────────────────────────────
function RuleCard({ title, summary, detail, icon, status }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`rules-accordion ${open ? 'open' : ''}`}>
      <button className="rules-accordion-header" onClick={() => setOpen(o => !o)}>
        <div className="rules-accordion-left">
          <span className="rules-accordion-icon">{icon}</span>
          <div>
            <div className="rules-accordion-title">{title}</div>
            {!open && <div className="rules-accordion-summary">{summary}</div>}
          </div>
        </div>
        <div className="rules-accordion-right">
          {status && <StatusChip ok={status.ok} label={status.ok ? 'Within Limit' : 'Breached'} />}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </button>
      {open && (
        <div className="rules-accordion-body">
          {detail}
        </div>
      )}
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────
export default function RulesObjectivesPage({ userId }) {
  const [state, setState]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    getAccountState(userId)
      .then(s => setState(s))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [userId])

  const account   = state?.account
  const positions = state?.positions || []

  // ── live metrics ──────────────────────────────────────────────────────
  const initial      = account?.initial_balance || 10000
  const current      = account ? account.current_balance + positions.reduce((s, p) => s + (p.margin || 0), 0) : initial
  const profitTarget = account?.profit_target || initial * 0.10
  const maxDrawdown  = account?.max_total_drawdown || initial * 0.08
  const maxDaily     = null  // No daily limit
  const leverage     = 'Up to 100x (all instruments)'

  const currentProfit       = current - initial
  const currentProfitPct    = (currentProfit / initial) * 100
  const currentDrawdown     = Math.max(0, initial - current)
  const currentDrawdownPct  = (currentDrawdown / initial) * 100
  const profitTargetPct     = (profitTarget / initial) * 100
  const maxDrawdownPct      = (maxDrawdown / initial) * 100
  const maxDailyPct         = (maxDaily / initial) * 100

  // estimate progress %
  const progressPct = Math.min(100, Math.max(0, (currentProfit / profitTarget) * 100))
  const challengeId = account?.id ? `CH-${String(account.id).slice(0,4).toUpperCase()}` : 'CH-—'
  const daysActive  = account?.created_at
    ? Math.floor((new Date() - new Date(account.created_at)) / 86400000)
    : null

  // ── rules data ────────────────────────────────────────────────────────
  const icons = {
    drawdown: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>
      </svg>
    ),
    profit: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
      </svg>
    ),
    leverage: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>
      </svg>
    ),
    stop: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
      </svg>
    ),
    consistency: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    strategy: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
    payout: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  }

  const rules = [
    {
      title: 'No Daily Drawdown Limit',
      summary: 'There is no daily drawdown limit. Only the overall max drawdown applies.',
      status: { ok: true },
      icon: icons.drawdown,
      detail: (
        <div className="rules-detail">
          <p>IJGF does <strong>not impose a daily drawdown limit</strong>. You are free to trade throughout the day without being locked out by a per-day cap.</p>
          <p>Only the overall <strong>Maximum Drawdown (8%)</strong> applies. Manage your risk accordingly — a single bad day can still breach the overall drawdown limit.</p>
          <div className="rules-example">
            <span className="rules-example-label">Note</span>
            <p>This is a trader-friendly rule. Focus on your overall drawdown limit of 8% and trade with confidence each day.</p>
          </div>
        </div>
      ),
    },
    {
      title: 'Maximum Overall Drawdown',
      summary: `Your account equity must never fall more than ${maxDrawdownPct.toFixed(0)}% ($${fmt(maxDrawdown, 0)}) below your starting balance.`,
      status: { ok: currentDrawdown < maxDrawdown },
      icon: icons.drawdown,
      detail: (
        <div className="rules-detail">
          <p>This is a <strong>static drawdown</strong> — it is calculated from your <em>initial starting balance</em> and never moves. If your account equity drops below <strong>${fmt(initial - maxDrawdown, 0)}</strong> at any point, your challenge is immediately failed.</p>
          <div className="rules-detail-row">
            <div className="rules-detail-item">
              <span className="rules-detail-label">Starting Balance</span>
              <span className="rules-detail-val">${fmt(initial)}</span>
            </div>
            <div className="rules-detail-item">
              <span className="rules-detail-label">Drawdown Limit</span>
              <span className="rules-detail-val red">${fmt(maxDrawdown, 0)} ({maxDrawdownPct.toFixed(0)}%)</span>
            </div>
            <div className="rules-detail-item">
              <span className="rules-detail-label">Minimum Equity Floor</span>
              <span className="rules-detail-val red">${fmt(initial - maxDrawdown, 0)}</span>
            </div>
          </div>
          <div className="rules-example">
            <span className="rules-example-label">Important</span>
            <p>Unlike some prop firms, IJGF uses a static drawdown model. Your floor never rises with your equity, giving you more room to recover from drawdowns.</p>
          </div>
        </div>
      ),
    },
    {
      title: 'Profit Target',
      summary: `You must reach a profit of ${profitTargetPct.toFixed(0)}% ($${fmt(profitTarget, 0)}) to pass the challenge.`,
      status: { ok: currentProfit >= 0 },
      icon: icons.profit,
      detail: (
        <div className="rules-detail">
          <p>To qualify for a funded account, you must achieve a minimum profit of <strong>${fmt(profitTarget, 0)} ({profitTargetPct.toFixed(0)}%)</strong> on your starting balance while respecting all risk rules.</p>
          <div className="rules-detail-row">
            <div className="rules-detail-item">
              <span className="rules-detail-label">Target</span>
              <span className="rules-detail-val green">+${fmt(profitTarget, 0)} ({profitTargetPct.toFixed(0)}%)</span>
            </div>
            <div className="rules-detail-item">
              <span className="rules-detail-label">Current Profit</span>
              <span className="rules-detail-val" style={{ color: currentProfit >= 0 ? '#4ade80' : '#f87171' }}>
                {currentProfit >= 0 ? '+' : ''}{fmt(currentProfit)} ({currentProfitPct.toFixed(2)}%)
              </span>
            </div>
          </div>
          <p>There is <strong>no time limit</strong> — take as long as you need to reach the target while staying within drawdown rules.</p>
        </div>
      ),
    },
    {
      title: 'Maximum Leverage',
      summary: `Leverage is capped at 100x on all instruments. Use leverage responsibly.`,
      icon: icons.leverage,
      detail: (
        <div className="rules-detail">
          <p>IJGF supports up to <strong>100x leverage</strong> on all instruments — BTC, ETH, and all altcoins. This is consistent across every challenge tier.</p>
          <div className="rules-detail-row">
            <div className="rules-detail-item">
              <span className="rules-detail-label">All instruments</span>
              <span className="rules-detail-val">Up to 100x</span>
            </div>
          </div>
          <p>Orders submitted above 100x will be automatically rejected. You can use any leverage from 1x to 100x.</p>
          <div className="rules-example">
            <span className="rules-example-label">Best Practice</span>
            <p>High leverage amplifies both gains and losses. Conservative traders use lower leverage to give positions room to breathe and stay within the 8% max drawdown.</p>
          </div>
        </div>
      ),
    },
    {
      title: 'Stop Loss & Take Profit Required',
      summary: 'Every position must have a Stop Loss and Take Profit set before execution.',
      icon: icons.stop,
      detail: (
        <div className="rules-detail">
          <p>IJGF requires <strong>both a Stop Loss and a Take Profit</strong> on every trade. This enforces a professional risk management mindset and protects firm capital from runaway losses.</p>
          <p>Orders submitted without a Stop Loss or Take Profit will be rejected. Both values must be logically valid:</p>
          <ul className="rules-detail-list">
            <li>Long positions: Stop Loss must be <em>below</em> entry price, Take Profit must be <em>above</em> entry price.</li>
            <li>Short positions: Stop Loss must be <em>above</em> entry price, Take Profit must be <em>below</em> entry price.</li>
          </ul>
          <div className="rules-example">
            <span className="rules-example-label">Why this rule exists</span>
            <p>Prop firms that have failed (like FTMO controversies) often cite uncontrolled emotional trading as a cause. Mandatory SL/TP keeps every trade defined and removes the temptation to "wait for recovery."</p>
          </div>
        </div>
      ),
    },
    {
      title: 'Prohibited Trading Strategies',
      summary: 'Certain exploitative strategies are not permitted on the IJGF platform.',
      icon: icons.strategy,
      detail: (
        <div className="rules-detail">
          <p>The following strategies are <strong>strictly prohibited</strong> and will result in immediate account termination:</p>
          <ul className="rules-detail-list">
            <li><strong>News Trading:</strong> Opening positions within 2 minutes of scheduled high-impact news events (FOMC, CPI, NFP) is not permitted.</li>
            <li><strong>Hedging Across Accounts:</strong> Opening opposite positions across multiple IJGF accounts to guarantee a pass is strictly forbidden.</li>
            <li><strong>Copy Trading / Signal Following:</strong> Using external signals or copy-trading services to mirror trades from outside sources is not allowed.</li>
            <li><strong>Martingale & Grid Strategies:</strong> Strategies that systematically increase position size after losses (martingale) or open a grid of orders to average down are prohibited.</li>
            <li><strong>High-Frequency Trading:</strong> Submitting more than 100 orders per minute is not allowed.</li>
            <li><strong>Latency Arbitrage:</strong> Exploiting price feed latency differences between IJGF and external exchanges is forbidden.</li>
          </ul>
          <div className="rules-example">
            <span className="rules-example-label">Detection</span>
            <p>IJGF's risk engine analyzes trade patterns, timing, and correlation across accounts. Violations are reviewed by the compliance team before any account is terminated.</p>
          </div>
        </div>
      ),
    },
    {
      title: 'Profit Split & Payouts',
      summary: 'Funded traders keep 80% of all profits. First payout available after 14 days.',
      icon: icons.payout,
      detail: (
        <div className="rules-detail">
          <p>Once you pass the challenge and receive a funded account, you are entitled to an <strong>80/20 profit split</strong> — you keep 80%, IJGF keeps 20%.</p>
          <div className="rules-detail-row">
            <div className="rules-detail-item">
              <span className="rules-detail-label">Trader Share</span>
              <span className="rules-detail-val green">80%</span>
            </div>
            <div className="rules-detail-item">
              <span className="rules-detail-label">First Payout Eligibility</span>
              <span className="rules-detail-val">After 14 days</span>
            </div>
            <div className="rules-detail-item">
              <span className="rules-detail-label">Subsequent Payouts</span>
              <span className="rules-detail-val">Daily</span>
            </div>
            <div className="rules-detail-item">
              <span className="rules-detail-label">Payout Currency</span>
              <span className="rules-detail-val">USDC or USDT</span>
            </div>
          </div>
          <p>Payouts are processed on-chain to your verified wallet address. There is no minimum withdrawal amount for funded accounts.</p>
        </div>
      ),
    },
    {
      title: 'Scaling Plan',
      summary: 'Consistent funded traders can grow their account up to $200K through the scaling program.',
      icon: icons.consistency,
      detail: (
        <div className="rules-detail">
          <p>IJGF rewards consistent funded traders with an automatic scaling plan. If you demonstrate steady profitability across payouts, your account size increases:</p>
          <div className="rules-scaling-track">
            {['$5K','$10K','$25K','$50K','$100K','$200K'].map((size, i) => (
              <div key={i} className="rules-scaling-step">
                <div className={`rules-scaling-dot ${i <= 1 ? 'active' : ''}`} />
                <span>{size}</span>
              </div>
            ))}
          </div>
          <p>Scaling is triggered automatically when a funded trader meets the consistency requirements for their current tier. There is no application required.</p>
        </div>
      ),
    },
  ]

  if (loading) return (
    <div className="analytics-loading">
      <div className="analytics-spinner" />
      <span>Loading rules…</span>
    </div>
  )

  return (
    <div className="rules-page">

      {/* ── Stat cards row ───────────────────────────────────────────────── */}
      <div className="rules-stat-grid">
        {[
          { label: 'Active Challenges', value: account ? '1' : '0', sub: 'Currently in progress', icon: '◎', colorClass: 'rules-color-purple' },
          { label: 'Challenge Progress', value: `${progressPct.toFixed(0)}%`, sub: 'Objectives completed', icon: '↗', colorClass: 'rules-color-default' },
          { label: 'Profit Target', value: '+10%', sub: 'Required to pass', icon: '📈', colorClass: 'rules-color-green' },
          { label: 'Current PNL', value: `${currentProfit >= 0 ? '+' : ''}${currentProfitPct.toFixed(1)}%`, sub: 'Since challenge start', icon: '$', colorClass: currentProfit >= 0 ? 'rules-color-green' : 'rules-color-red' },
          { label: 'Days Active', value: daysActive != null ? `${daysActive} days` : '—', sub: 'Since challenge start', icon: '◷', colorClass: 'rules-color-default' },
        ].map((card, i) => (
          <div key={i} className="rules-stat-card">
            <div className="rules-stat-header">
              <span className={`rules-stat-icon-wrap ${card.colorClass}`}>{card.icon}</span>
              <span className="rules-stat-label">{card.label}</span>
            </div>
            <div className={`rules-stat-value ${card.colorClass}`}>{card.value}</div>
            <div className="rules-stat-sub">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Active challenge card ─────────────────────────────────────────── */}
      {account && (
        <div className="rules-challenge-card">
          <div className="rules-challenge-header">
            <div>
              <span className="rules-challenge-id">{challengeId}</span>
              <span className="rules-challenge-size"> — <span style={{ color: '#8b5cf6' }}>${fmt(initial)} Challenge</span></span>
            </div>
            <span className={`rules-challenge-status ${account.status}`}>{account.status}</span>
          </div>
          <div className="rules-challenge-meta">
            <span>Start Date: {account.created_at ? new Date(account.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
            <span>Days Active: {daysActive != null ? daysActive : '—'} days</span>
          </div>
          <ProgressBar value={progressPct} max={100} color="#8b5cf6" />
          <div className="rules-challenge-pct">{progressPct.toFixed(0)}% Completed</div>

          <div className="rules-challenge-metrics">
            <div className="rules-metric-block">
              <div className="rules-metric-title">Profit Target</div>
              <div className="rules-metric-row">
                <span className="rules-metric-label">Target</span><span className="rules-metric-val green">+{profitTargetPct.toFixed(0)}%</span>
              </div>
              <div className="rules-metric-row">
                <span className="rules-metric-label">Current</span>
                <span className="rules-metric-val" style={{ color: currentProfit >= 0 ? '#4ade80' : '#f87171' }}>
                  {currentProfit >= 0 ? '+' : ''}{currentProfitPct.toFixed(1)}%
                </span>
              </div>
              <div className="rules-metric-row">
                <span className="rules-metric-label">Status</span>
                <StatusChip ok={currentProfit >= 0} label={currentProfit >= 0 ? 'In Progress' : 'Below Start'} />
              </div>
              <ProgressBar value={Math.max(0, currentProfit)} max={profitTarget} color="#4ade80" />
            </div>

            <div className="rules-metric-block">
              <div className="rules-metric-title">Max Daily Drawdown</div>
              <div className="rules-metric-row">
                <span className="rules-metric-label">Limit</span><span className="rules-metric-val red">{maxDailyPct.toFixed(0)}%</span>
              </div>
              <div className="rules-metric-row">
                <span className="rules-metric-label">Current</span><span className="rules-metric-val">{currentDrawdownPct.toFixed(1)}%</span>
              </div>
              <div className="rules-metric-row">
                <span className="rules-metric-label">Status</span>
                <StatusChip ok={currentDrawdownPct < maxDailyPct} label={currentDrawdownPct < maxDailyPct ? 'Within Limit' : 'Breached'} />
              </div>
            </div>

            <div className="rules-metric-block">
              <div className="rules-metric-title">Max Overall Drawdown</div>
              <div className="rules-metric-row">
                <span className="rules-metric-label">Limit</span><span className="rules-metric-val red">{maxDrawdownPct.toFixed(0)}%</span>
              </div>
              <div className="rules-metric-row">
                <span className="rules-metric-label">Current</span><span className="rules-metric-val">{currentDrawdownPct.toFixed(1)}%</span>
              </div>
              <div className="rules-metric-row">
                <span className="rules-metric-label">Status</span>
                <StatusChip ok={currentDrawdown < maxDrawdown} label={currentDrawdown < maxDrawdown ? 'Within Limit' : 'Breached'} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Rules accordion ───────────────────────────────────────────────── */}
      <div className="rules-section">
        <h3 className="rules-section-title">Rules</h3>
        <div className="rules-accordion-list">
          {rules.map((rule, i) => (
            <RuleCard key={i} {...rule} />
          ))}
        </div>
      </div>

    </div>
  )
}
