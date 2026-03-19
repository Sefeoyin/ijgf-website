/**
 * ChallengeConfigPanel.jsx
 *
 * Shared challenge selector used on LandingPage and ChallengesPage.
 *
 * Layout (top → bottom):
 *   1. Challenge type toggle  (1-Step / 2-Step pill tabs)
 *   2. Account size row       (6 buttons, horizontal-scroll on mobile)
 *   3. Phase info cards       (2 cards for 1-Step, 3 cards for 2-Step)
 *   4. Bottom summary row     (Evaluation | Fee | Start Now)
 *
 * Props:
 *   onStart  function() — called when "Start Now" is clicked
 *
 * Pricing data is inlined (no tradingService.js import) to avoid
 * pulling in the Supabase dependency chain. Keep in sync with
 * CHALLENGE_PRICING in tradingService.js.
 */

import { useState } from 'react'
import { Zap, Target } from 'lucide-react'

// ─── Display-only constants (keep in sync with tradingService.js) ────────────

const TIERS = [
  { key: '5k',   label: '$5K',   labelFull: '$5,000',   amount: 5000   },
  { key: '10k',  label: '$10K',  labelFull: '$10,000',  amount: 10000  },
  { key: '25k',  label: '$25K',  labelFull: '$25,000',  amount: 25000  },
  { key: '50k',  label: '$50K',  labelFull: '$50,000',  amount: 50000  },
  { key: '100k', label: '$100K', labelFull: '$100,000', amount: 100000 },
  { key: '200k', label: '$200K', labelFull: '$200,000', amount: 200000 },
]

const PRICING = {
  '1step': { '5k': 58,  '10k': 110, '25k': 250, '50k': 440, '100k': 790,  '200k': 1450 },
  '2step': { '5k': 50,  '10k': 100, '25k': 230, '50k': 380, '100k': 650,  '200k': 1250 },
}

const TIER_FEATURES = {
  '5k':   ['Real-time evaluation', '24/7 support', 'Instant account activation', 'Fast approval process'],
  '10k':  ['Real-time evaluation', '24/7 support', 'Instant account activation', 'Fast approval process', 'Priority review'],
  '25k':  ['Real-time evaluation', '24/7 support', 'Instant account activation', 'Fast approval process', 'Priority review', 'Account Manager'],
  '50k':  ['Real-time evaluation', '24/7 support', 'Instant account activation', 'Fast approval process', 'Priority review', 'Account Manager'],
  '100k': ['Real-time evaluation', '24/7 support', 'Instant account activation', 'Fast approval process', 'Priority review', 'Account Manager'],
  '200k': ['Real-time evaluation', '24/7 support', 'Instant account activation', 'Fast approval process', 'Priority review', 'Account Manager'],
}

// ─── Phase card data ─────────────────────────────────────────────────────────

function getPhaseCards(challengeType, tierKey) {
  const tier    = TIERS.find(t => t.key === tierKey)
  const amount  = tier?.amount ?? 25000

  if (challengeType === '1step') {
    const profitAmt = Math.round(amount * 0.10)
    const ddAmt     = Math.round(amount * 0.08)
    return [
      {
        phase:       'Phase 1',
        accentText:  '10% PROFIT TARGET',
        accentColor: 'var(--accent-light, #a855f7)',
        rows: [
          { label: 'Profit Target',    value: `$${profitAmt.toLocaleString()} (10%)` },
          { label: 'Max Drawdown',     value: `$${ddAmt.toLocaleString()} (8%)`      },
          { label: 'Min Trading Days', value: '5 Days'                               },
          { label: 'Duration',         value: 'Indefinite'                           },
          { label: 'Leverage',         value: 'Up to 1:100'                          },
        ],
      },
      {
        phase:       'Live Stage',
        accentText:  '80% PROFIT SPLIT',
        accentColor: '#22c55e',
        rows: [
          { label: 'Profit Split',     value: '80%'         },
          { label: 'Max Drawdown',     value: '8%'          },
          { label: 'Min Trading Days', value: 'None'        },
          { label: 'Duration',         value: 'Indefinite'  },
          { label: 'Leverage',         value: 'Up to 1:100' },
        ],
      },
    ]
  }

  // 2-step
  const p1Amt = Math.round(amount * 0.08)
  const p2Amt = Math.round(amount * 0.05)
  const ddAmt = Math.round(amount * 0.10)
  return [
    {
      phase:       'Phase 1',
      accentText:  '8% PROFIT TARGET',
      accentColor: '#38bdf8',
      rows: [
        { label: 'Profit Target',    value: `$${p1Amt.toLocaleString()} (8%)`  },
        { label: 'Max Drawdown',     value: `$${ddAmt.toLocaleString()} (10%)` },
        { label: 'Min Trading Days', value: '5 Days'                           },
        { label: 'Duration',         value: 'Indefinite'                       },
        { label: 'Leverage',         value: 'Up to 1:100'                      },
      ],
    },
    {
      phase:       'Phase 2',
      accentText:  '5% PROFIT TARGET',
      accentColor: '#38bdf8',
      rows: [
        { label: 'Profit Target',    value: `$${p2Amt.toLocaleString()} (5%)`  },
        { label: 'Max Drawdown',     value: `$${ddAmt.toLocaleString()} (10%)` },
        { label: 'Min Trading Days', value: '5 Days'                           },
        { label: 'Duration',         value: 'Indefinite'                       },
        { label: 'Leverage',         value: 'Up to 1:100'                      },
      ],
    },
    {
      phase:       'Live Stage',
      accentText:  '80% PROFIT SPLIT',
      accentColor: '#22c55e',
      rows: [
        { label: 'Profit Split',     value: '80%'         },
        { label: 'Max Drawdown',     value: '10%'         },
        { label: 'Min Trading Days', value: 'None'        },
        { label: 'Duration',         value: 'Indefinite'  },
        { label: 'Leverage',         value: 'Up to 1:100' },
      ],
    },
  ]
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ChallengeConfigPanel({ onStart }) {
  const [challengeType, setChallengeType] = useState('1step')
  const [selectedTier,  setSelectedTier]  = useState('25k')
  const [featuresOpen,  setFeaturesOpen]  = useState(false)

  const fee        = PRICING[challengeType]?.[selectedTier]
  const tier       = TIERS.find(t => t.key === selectedTier)
  const phaseCards = getPhaseCards(challengeType, selectedTier)
  const is2step    = challengeType === '2step'

  return (
    <div className="ccp-wrapper">

      {/* ── 1. Challenge type toggle ─────────────────────────────────── */}
      <div className="ccp-toggle-track">
        {[
          { key: '1step', Icon: Zap,    label: '1-Step Challenge' },
          { key: '2step', Icon: Target, label: '2-Step Challenge' },
        ].map(opt => (
          <button
            key={opt.key}
            className={`ccp-toggle-btn ${challengeType === opt.key ? 'ccp-toggle-active' : ''}`}
            onClick={() => setChallengeType(opt.key)}
            style={challengeType === opt.key && opt.key === '2step'
              ? { background: 'linear-gradient(135deg,#0ea5e9,#38bdf8)', boxShadow: '0 4px 14px rgba(14,165,233,0.35)' }
              : undefined}
          >
            <opt.Icon size={18} strokeWidth={2.5} className="ccp-toggle-icon" />
            {opt.label}
          </button>
        ))}
      </div>

      {/* Toggle description */}
      <p className="ccp-toggle-desc" style={{ color: is2step ? '#38bdf8' : 'var(--accent-light, #a855f7)' }}>
        {is2step
          ? 'Hit 8% then 5% profit targets across two phases to get funded'
          : 'Hit a single 10% profit target to get funded'}
      </p>

      {/* ── 2. Account size selector ─────────────────────────────────── */}
      <div className="ccp-sizes-scroll">
        <div className="ccp-sizes">
          {TIERS.map(t => {
            const active = selectedTier === t.key
            return (
              <button
                key={t.key}
                className={`ccp-size-btn ${active ? 'ccp-size-active' : ''}`}
                style={active && is2step ? {
                  borderColor: 'rgba(56,189,248,0.6)',
                  background: 'rgba(14,165,233,0.12)',
                  color: '#38bdf8',
                } : undefined}
                onClick={() => { setFeaturesOpen(false); setSelectedTier(t.key) }}
              >
                {t.label}
                {t.key === '10k' && <span className="ccp-size-popular">Popular</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 3. Phase info cards ───────────────────────────────────────── */}
      <div className={`ccp-cards ccp-cards-${phaseCards.length}`}>
        {phaseCards.map((card, i) => (
          <div key={`${challengeType}-${i}`} className="ccp-card">
            <div className="ccp-card-header">
              <span className="ccp-card-phase">{card.phase}</span>
              <span className="ccp-card-accent" style={{ color: card.accentColor }}>
                {card.accentText}
              </span>
            </div>
            <div className="ccp-card-rows">
              {card.rows.map((row, j) => (
                <div key={j} className="ccp-card-row">
                  <span className="ccp-row-label">{row.label}</span>
                  <span className="ccp-row-value">{row.value}</span>
                </div>
              ))}

              {/* Collapsible features — Phase 1 card only */}
              {i === 0 && (
                <>
                  <div
                    className="ccp-features-trigger"
                    onClick={() => setFeaturesOpen(o => !o)}
                  >
                    <span>Features</span>
                    <span className={`ccp-features-chevron${featuresOpen ? ' ccp-features-chevron--open' : ''}`}>∨</span>
                  </div>
                  <div className={`ccp-features-body${featuresOpen ? ' ccp-features-body--open' : ''}`}>
                    {(TIER_FEATURES[selectedTier] || []).map((f, fi) => (
                      <div key={fi} className="ccp-feature-row">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── 4. Bottom summary row ────────────────────────────────────── */}
      <div className="ccp-bottom">
        <div className="ccp-bottom-item">
          <span className="ccp-bottom-tag">EVALUATION</span>
          <span className="ccp-bottom-val">{tier?.labelFull ?? '$25,000'} Account</span>
        </div>
        <div className="ccp-bottom-divider" />
        <div className="ccp-bottom-item">
          <span className="ccp-bottom-tag">ONE TIME FEE</span>
          <span className="ccp-bottom-fee" style={{ color: is2step ? '#38bdf8' : 'var(--accent-light, #a855f7)' }}>
            {fee != null ? `$${fee}` : '—'}
          </span>
        </div>
        <button className="ccp-start-btn" onClick={onStart}>
          Start Now
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <style>{`
        /* ── Wrapper ──────────────────────────────────────────────── */
        .ccp-wrapper {
          width: 100%;
          max-width: 900px;
          margin: 0 auto;
          box-sizing: border-box;
        }

        /* ── Challenge type toggle ────────────────────────────────── */
        .ccp-toggle-track {
          display: flex;
          background: var(--bg-card, rgba(15,15,20,0.5));
          border: 1px solid var(--border-color, rgba(255,255,255,0.08));
          border-radius: 50px;
          padding: 5px;
          width: fit-content;
          margin: 0 auto 10px;
          gap: 4px;
          overflow: hidden;
        }

        .ccp-toggle-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 11px 26px;
          border-radius: 50px;
          border: none;
          background: transparent;
          color: var(--text-muted, rgba(255,255,255,0.45));
          font-weight: 700;
          font-size: 0.92rem;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .ccp-toggle-active {
          background: var(--accent-primary, #7c3aed);
          color: #fff;
          box-shadow: 0 4px 14px rgba(124,58,237,0.35);
        }

        .ccp-toggle-icon {
          font-size: 1rem;
          line-height: 1;
        }

        .ccp-toggle-desc {
          text-align: center;
          font-size: 0.82rem;
          margin-bottom: 24px;
          transition: color 0.2s;
          min-height: 1.2em;
        }

        /* ── Account size selector ────────────────────────────────── */
        .ccp-sizes-scroll {
          margin-bottom: 20px;
        }

        .ccp-sizes {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .ccp-size-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          flex: 1 1 auto;
          min-width: 80px;
          text-align: center;
          padding: 10px 22px;
          border-radius: 10px;
          border: 1.5px solid var(--border-color, rgba(255,255,255,0.08));
          background: var(--bg-card, rgba(15,15,20,0.5));
          color: var(--text-secondary, rgba(255,255,255,0.65));
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .ccp-size-btn:hover {
          border-color: var(--border-accent, rgba(139,92,246,0.3));
          color: var(--text-primary, #fff);
        }

        .ccp-size-active {
          border-color: rgba(124,58,237,0.6) !important;
          background: rgba(124,58,237,0.12) !important;
          color: var(--accent-light, #a855f7) !important;
        }

        .ccp-size-popular {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.3px;
          background: rgba(34,197,94,0.85);
          color: white;
          border-radius: 999px;
          padding: 2px 8px;
          margin-left: 2px;
          flex-shrink: 0;
        }

        /* ── Phase info cards ─────────────────────────────────────── */
        .ccp-cards {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
          transition: all 0.2s;
        }

        .ccp-card {
          flex: 1;
          background: var(--bg-card-solid, #0d0d14);
          border: 1px solid var(--border-color, rgba(255,255,255,0.08));
          border-radius: 14px;
          padding: 18px 16px;
        }

        .ccp-card-header {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin-bottom: 14px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.08));
        }

        .ccp-card-phase {
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text-muted, rgba(255,255,255,0.45));
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .ccp-card-accent {
          font-size: 0.84rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .ccp-card-rows {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .ccp-card-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .ccp-row-label {
          font-size: 0.78rem;
          color: var(--text-muted, rgba(255,255,255,0.45));
          flex-shrink: 0;
        }

        .ccp-row-value {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary, rgba(255,255,255,0.65));
          text-align: right;
        }

        /* ── Bottom summary row ───────────────────────────────────── */
        .ccp-bottom {
          display: flex;
          align-items: center;
          background: var(--bg-card-solid, #0d0d14);
          border: 1px solid var(--border-color, rgba(255,255,255,0.08));
          border-radius: 14px;
          padding: 20px 28px;
          gap: 0;
        }

        .ccp-bottom-item {
          display: flex;
          flex-direction: column;
          gap: 5px;
          flex: 1;
        }

        .ccp-bottom-tag {
          font-size: 0.67rem;
          font-weight: 700;
          color: var(--text-muted, rgba(255,255,255,0.45));
          text-transform: uppercase;
          letter-spacing: 1.2px;
        }

        .ccp-bottom-val {
          font-size: 1.02rem;
          font-weight: 700;
          color: var(--text-primary, #fff);
        }

        .ccp-bottom-fee {
          font-size: 1.6rem;
          font-weight: 800;
          line-height: 1;
          transition: color 0.2s;
        }

        .ccp-bottom-divider {
          width: 1px;
          height: 52px;
          background: var(--border-color, rgba(255,255,255,0.08));
          margin: 0 28px;
          flex-shrink: 0;
        }

        .ccp-start-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 30px;
          background: var(--accent-primary, #7c3aed);
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .ccp-start-btn:hover {
          background: #6D28D9;
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(124,58,237,0.4);
        }

        /* ── Mobile ───────────────────────────────────────────────── */
        @media (max-width: 768px) {
          .ccp-wrapper {
            max-width: 100%;
            padding: 0 12px;
            margin: 0;
          }

          .ccp-toggle-track {
            width: 100%;
            border-radius: 14px;
          }

          .ccp-toggle-btn {
            flex: 1;
            justify-content: center;
            padding: 10px 12px;
            border-radius: 10px;
            font-size: 0.83rem;
          }

          .ccp-cards {
            flex-direction: column;
          }

          .ccp-bottom {
            flex-direction: column;
            align-items: stretch;
            gap: 14px;
            padding: 18px;
          }

          .ccp-bottom-divider {
            width: 100%;
            height: 1px;
            margin: 0;
          }

          .ccp-start-btn {
            width: 100%;
            justify-content: center;
            padding: 14px;
          }

          .ccp-bottom-fee {
            font-size: 1.35rem;
          }
        }

        /* ── Light mode (day theme) ───────────────────────────────── */
        body[data-theme="day"] .ccp-card {
          background: var(--bg-card-solid);
          border-color: var(--border-color);
        }

        body[data-theme="day"] .ccp-bottom {
          background: var(--bg-card-solid);
          border-color: var(--border-color);
        }

        body[data-theme="day"] .ccp-size-btn {
          background: var(--bg-card);
        }

        body[data-theme="day"] .ccp-toggle-track {
          background: var(--bg-card);
        }

        /* ── Collapsible features ─────────────────────────────────── */
        .ccp-features-trigger {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 10px;
          margin-top: 10px;
          border-top: 1px solid var(--border-color, rgba(255,255,255,0.08));
          cursor: pointer;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          user-select: none;
        }

        .ccp-features-chevron {
          display: inline-block;
          transition: transform 0.25s;
        }

        .ccp-features-chevron--open {
          transform: rotate(180deg);
        }

        .ccp-features-body {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s ease;
        }

        .ccp-features-body--open {
          max-height: 220px;
        }

        .ccp-feature-row {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 4px 0;
          font-size: 0.75rem;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  )
}

export default ChallengeConfigPanel
