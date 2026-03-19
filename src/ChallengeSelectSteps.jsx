/**
 * ChallengeSelectSteps.jsx
 *
 * Reusable selection components shared between OnboardingModal and
 * ChallengeResultModal (retry flow).
 *
 * Exports:
 *   ChallengeAndTierSelector  — combined toggle + 6-tier grid (step A+1 merged)
 *   AccountModeSelector       — Demo / Live (Live = disabled, Coming Soon)
 *
 * Both use CSS variables for light/dark mode compatibility.
 */

import { Zap, Target, Monitor, Briefcase } from 'lucide-react'

// ─── Display-only constants ───────────────────────────────────────────────────
// Inlined here to avoid importing tradingService.js (which carries a Supabase
// dependency). The authoritative values live in tradingService.js — keep in sync.

const CHALLENGE_PRICING = {
  '1step': { '5k': 58,  '10k': 110, '25k': 250, '50k': 440, '100k': 790,  '200k': 1450 },
  '2step': { '5k': 50,  '10k': 100, '25k': 230, '50k': 380, '100k': 650,  '200k': 1250 },
}

const CHALLENGE_CONFIGS_2STEP = {
  '5k':   { phase1: { profitTarget: 400   }, phase2: { profitTarget: 250   } },
  '10k':  { phase1: { profitTarget: 800   }, phase2: { profitTarget: 500   } },
  '25k':  { phase1: { profitTarget: 2000  }, phase2: { profitTarget: 1250  } },
  '50k':  { phase1: { profitTarget: 4000  }, phase2: { profitTarget: 2500  } },
  '100k': { phase1: { profitTarget: 8000  }, phase2: { profitTarget: 5000  } },
  '200k': { phase1: { profitTarget: 16000 }, phase2: { profitTarget: 10000 } },
}

// ─── Tier definitions ─────────────────────────────────────────────────────────

const TIERS = [
  { key: '5k',   label: '$5K',   amount: 5000   },
  { key: '10k',  label: '$10K',  amount: 10000  },
  { key: '25k',  label: '$25K',  amount: 25000  },
  { key: '50k',  label: '$50K',  amount: 50000  },
  { key: '100k', label: '$100K', amount: 100000 },
  { key: '200k', label: '$200K', amount: 200000 },
]

// Brief subtext shown inside each tier card — compact for 2-col grid
function tierSubtext(key, challengeType) {
  if (challengeType === '2step') {
    const cfg = CHALLENGE_CONFIGS_2STEP[key]
    if (!cfg) return '8% → 5% profit · 10% DD'
    return `Phase 1: $${cfg.phase1.profitTarget.toLocaleString()} · Phase 2: $${cfg.phase2.profitTarget.toLocaleString()}`
  }
  const t = TIERS.find(t => t.key === key)
  if (!t) return '10% profit · 8% DD'
  const profit = Math.round(t.amount * 0.10).toLocaleString()
  const dd     = Math.round(t.amount * 0.08).toLocaleString()
  return `$${profit} target · $${dd} DD`
}

// ─── Combined Challenge Type + Tier Selector ──────────────────────────────────

export function ChallengeAndTierSelector({
  selectedChallengeType,
  setSelectedChallengeType,
  selectedTier,
  setSelectedTier,
}) {
  const is2step = selectedChallengeType === '2step'

  return (
    <div className="cst-root">
      {/* ── Challenge type toggle ────────────────────────────────────────── */}
      <div className="cst-toggle-track">
        {[
          { key: '1step', Icon: Zap,    label: '1-Step', activeGrad: 'linear-gradient(135deg, #7c3aed, #a855f7)' },
          { key: '2step', Icon: Target, label: '2-Step', activeGrad: 'linear-gradient(135deg, #0ea5e9, #38bdf8)' },
        ].map(opt => {
          const active = selectedChallengeType === opt.key
          return (
            <button
              key={opt.key}
              onClick={() => setSelectedChallengeType(opt.key)}
              className={`cst-toggle-btn${active ? ' cst-toggle-btn--active' : ''}`}
              style={active ? { background: opt.activeGrad } : undefined}
            >
              <opt.Icon size={15} strokeWidth={2.5} />
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Toggle description */}
      <p className="cst-toggle-desc" style={{
        color: is2step ? 'rgba(56,189,248,0.9)' : 'var(--accent-light, #a855f7)',
      }}>
        {is2step
          ? 'Hit 8% then 5% profit targets to get funded'
          : 'Hit 10% profit target to get funded'}
      </p>

      {/* ── Tier grid — 2 columns ────────────────────────────────────────── */}
      {/*
       * PRICING TABLE (for review):
       *
       * Tier   | 1-Step fee | 2-Step fee
       * -------|------------|------------
       * 5k     | $58        | $50
       * 10k    | $110       | $100
       * 25k    | $250       | $230
       * 50k    | $440       | $380
       * 100k   | $790       | $650
       * 200k   | $1,450     | $1,250
       */}
      <div className="cst-tier-grid">
        {TIERS.map(t => {
          const sel        = selectedTier === t.key
          const fee        = CHALLENGE_PRICING[selectedChallengeType]?.[t.key]
          const accentColor = is2step ? '#0ea5e9' : 'var(--accent-primary, #7c3aed)'
          const accentRgb   = is2step ? '14,165,233' : '124,58,237'

          return (
            <button
              key={t.key}
              onClick={() => setSelectedTier(t.key)}
              className={`cst-tier-btn${sel ? ' cst-tier-btn--sel' : ''}`}
              style={sel ? {
                background: `rgba(${accentRgb},0.12)`,
                borderColor: `rgba(${accentRgb},0.6)`,
              } : undefined}
            >
              {/* Account size + inline popular badge */}
              <div className="cst-tier-label">
                {t.label}
                {t.key === '10k' && <span className="cst-popular-badge">POPULAR</span>}
              </div>

              {/* Fee */}
              <div className="cst-tier-fee" style={{
                color: sel ? accentColor : 'var(--text-secondary)',
              }}>
                {fee != null ? `$${fee}` : '—'}
              </div>

              {/* Subtext */}
              <div className="cst-tier-sub">
                {tierSubtext(t.key, selectedChallengeType)}
              </div>
            </button>
          )
        })}
      </div>

      <style>{`
        .cst-toggle-track {
          display: flex;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 8px;
          gap: 4px;
        }

        .cst-toggle-btn {
          flex: 1;
          padding: 9px 8px;
          background: transparent;
          border: none;
          border-radius: 9px;
          cursor: pointer;
          transition: all 0.2s;
          color: var(--text-muted);
          font-weight: 700;
          font-size: 0.88rem;
          letter-spacing: 0.2px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .cst-toggle-btn--active {
          color: #ffffff;
        }

        .cst-toggle-desc {
          margin: 0 0 14px;
          font-size: 0.76rem;
          text-align: center;
          line-height: 1.4;
          min-height: 1.4em;
        }

        .cst-tier-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .cst-tier-btn {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          background: var(--bg-card);
          border: 1.5px solid var(--border-color);
          border-radius: 12px;
          padding: 12px 14px;
          cursor: pointer;
          transition: all 0.15s;
          text-align: left;
          width: 100%;
          position: relative;
          overflow: hidden;
        }

        .cst-tier-btn:hover {
          border-color: var(--border-accent);
        }

        .cst-tier-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-primary);
          opacity: 1;
          margin-bottom: 4px;
        }

        .cst-popular-badge {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.3px;
          background: rgba(34,197,94,0.85);
          color: white;
          border-radius: 999px;
          padding: 2px 8px;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .cst-tier-fee {
          font-size: 1.1rem;
          font-weight: 700;
          margin-bottom: 5px;
          transition: color 0.15s;
        }

        .cst-tier-sub {
          font-size: 0.68rem;
          color: var(--text-muted);
          line-height: 1.4;
        }

        /* ── AccountModeSelector ────────────────────────────────── */
        .cst-mode-card {
          display: flex;
          align-items: center;
          gap: 14px;
          background: var(--bg-card);
          border: 1.5px solid var(--border-color);
          border-radius: 14px;
          padding: 16px 18px;
          transition: all 0.15s;
          user-select: none;
        }

        .cst-mode-card--sel {
          background: rgba(124,58,237,0.1);
          border-color: rgba(124,58,237,0.55);
        }

        .cst-mode-card--disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .cst-mode-card:not(.cst-mode-card--disabled) {
          cursor: pointer;
        }

        .cst-mode-icon-wrap {
          width: 42px;
          height: 42px;
          border-radius: 11px;
          flex-shrink: 0;
          background: var(--bg-card-hover, var(--bg-secondary));
          border: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          transition: all 0.15s;
        }

        .cst-mode-card--sel .cst-mode-icon-wrap {
          background: rgba(124,58,237,0.15);
          border-color: rgba(124,58,237,0.35);
          color: var(--accent-light, #a855f7);
        }

        .cst-mode-title {
          font-size: 0.97rem;
          font-weight: 700;
          color: var(--text-primary);
          transition: color 0.15s;
        }

        .cst-mode-card--sel .cst-mode-title {
          color: var(--accent-light, #a855f7);
        }

        .cst-mode-desc {
          font-size: 0.78rem;
          color: var(--text-muted);
          line-height: 1.4;
        }

        .cst-coming-soon {
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.5px;
          background: rgba(245,158,11,0.15);
          color: #f59e0b;
          border: 1px solid rgba(245,158,11,0.3);
          border-radius: 20px;
          padding: 2px 7px;
          text-transform: uppercase;
        }

        .cst-radio {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          flex-shrink: 0;
          border: 2px solid var(--border-color);
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }

        .cst-mode-card--sel .cst-radio {
          border-color: var(--accent-light, #a855f7);
          background: var(--accent-primary, #7c3aed);
        }

        .cst-radio-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: white;
        }
      `}</style>
    </div>
  )
}

// ─── Account Mode Selector ────────────────────────────────────────────────────

const ACCOUNT_MODES = [
  {
    key:      'demo',
    label:    'Demo Account',
    desc:     'Practice with simulated funds — same challenge rules',
    Icon:     Monitor,
    disabled: false,
  },
  {
    key:      'live',
    label:    'Live Account',
    desc:     'Real capital allocation',
    Icon:     Briefcase,
    disabled: true,
  },
]

export function AccountModeSelector({ value, onChange }) {
  return (
    <div className="cst-ams-root">
      {ACCOUNT_MODES.map(mode => {
        const sel = !mode.disabled && value === mode.key
        const cardClass = [
          'cst-ams-card',
          sel           ? 'cst-ams-card--sel'      : '',
          mode.disabled ? 'cst-ams-card--disabled' : '',
        ].filter(Boolean).join(' ')

        return (
          <div
            key={mode.key}
            className={cardClass}
            onClick={() => { if (!mode.disabled) onChange(mode.key) }}
          >
            {/* Row 1: Icon · Title · Badge · Radio */}
            <div className="cst-ams-row1">
              <div className="cst-ams-icon">
                <mode.Icon size={20} strokeWidth={1.75} />
              </div>
              <span className="cst-ams-title">{mode.label}</span>
              {mode.disabled && (
                <span className="cst-ams-badge">Coming Soon</span>
              )}
              {!mode.disabled && (
                <div className={`cst-ams-radio${sel ? ' cst-ams-radio--sel' : ''}`}>
                  {sel && <div className="cst-ams-dot" />}
                </div>
              )}
            </div>
            {/* Row 2: Description */}
            <p className="cst-ams-desc">{mode.desc}</p>
          </div>
        )
      })}

      <style>{`
        .cst-ams-root {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .cst-ams-card {
          background: var(--bg-card-solid, #0d0d14);
          border: 1px solid var(--border-color, rgba(255,255,255,0.1));
          border-radius: 14px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.15s;
          user-select: none;
        }

        .cst-ams-card--sel {
          border-color: var(--accent-primary, #7c3aed);
          background: rgba(124,58,237,0.08);
        }

        .cst-ams-card--disabled {
          opacity: 0.5;
          cursor: not-allowed;
          pointer-events: none;
        }

        .cst-ams-row1 {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 6px;
        }

        .cst-ams-icon {
          width: 36px;
          height: 36px;
          border-radius: 9px;
          flex-shrink: 0;
          background: var(--bg-card-hover, rgba(255,255,255,0.06));
          border: 1px solid var(--border-color, rgba(255,255,255,0.1));
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          transition: all 0.15s;
        }

        .cst-ams-card--sel .cst-ams-icon {
          background: rgba(124,58,237,0.15);
          border-color: rgba(124,58,237,0.35);
          color: var(--accent-light, #a855f7);
        }

        .cst-ams-title {
          flex: 1;
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-primary);
          transition: color 0.15s;
        }

        .cst-ams-card--sel .cst-ams-title {
          color: var(--accent-light, #a855f7);
        }

        .cst-ams-badge {
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.5px;
          background: rgba(245,158,11,0.15);
          color: #f59e0b;
          border: 1px solid rgba(245,158,11,0.3);
          border-radius: 20px;
          padding: 2px 7px;
          text-transform: uppercase;
        }

        .cst-ams-radio {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          flex-shrink: 0;
          border: 2px solid var(--border-color, rgba(255,255,255,0.2));
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }

        .cst-ams-radio--sel {
          border-color: var(--accent-primary, #7c3aed);
          background: var(--accent-primary, #7c3aed);
        }

        .cst-ams-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: white;
        }

        .cst-ams-desc {
          font-size: 0.78rem;
          color: var(--text-muted);
          line-height: 1.4;
          margin: 0;
          padding-left: 46px;
        }
      `}</style>
    </div>
  )
}
