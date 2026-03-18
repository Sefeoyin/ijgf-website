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
  // 1-step: derive from amount
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
    <div>
      {/* ── Challenge type toggle ────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, padding: 4,
        marginBottom: 8,
      }}>
        {[
          { key: '1step', label: '⚡ 1-Step', activeGrad: 'linear-gradient(135deg, #7c3aed, #a855f7)' },
          { key: '2step', label: '🎯 2-Step', activeGrad: 'linear-gradient(135deg, #0ea5e9, #38bdf8)' },
        ].map(opt => {
          const active = selectedChallengeType === opt.key
          return (
            <button
              key={opt.key}
              onClick={() => setSelectedChallengeType(opt.key)}
              style={{
                flex: 1, padding: '9px 8px',
                background: active ? opt.activeGrad : 'transparent',
                border: 'none', borderRadius: 9,
                cursor: 'pointer', transition: 'all 0.2s',
                color: active ? '#ffffff' : 'rgba(255,255,255,0.45)',
                fontWeight: 700, fontSize: '0.88rem',
                letterSpacing: 0.2,
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Toggle description */}
      <p style={{
        margin: '0 0 14px',
        fontSize: '0.76rem',
        color: is2step ? 'rgba(56,189,248,0.8)' : 'rgba(168,85,247,0.8)',
        textAlign: 'center',
        lineHeight: 1.4,
        minHeight: '1.4em',
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
       *
       * Source: CHALLENGE_PRICING from tradingService.js
       * Updates live when toggle switches — no hardcoded values here.
       */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 8,
      }}>
        {TIERS.map(t => {
          const sel = selectedTier === t.key
          const fee = CHALLENGE_PRICING[selectedChallengeType]?.[t.key]
          const accentColor = is2step ? '#0ea5e9' : '#7c3aed'
          const accentRgb   = is2step ? '14,165,233' : '124,58,237'

          return (
            <button
              key={t.key}
              onClick={() => setSelectedTier(t.key)}
              style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'flex-start',
                background: sel
                  ? `rgba(${accentRgb},0.15)`
                  : 'rgba(255,255,255,0.03)',
                border: `1.5px solid ${sel
                  ? `rgba(${accentRgb},0.6)`
                  : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 12, padding: '12px 14px',
                cursor: 'pointer', transition: 'all 0.15s',
                textAlign: 'left', width: '100%', position: 'relative',
              }}
            >
              {/* Popular badge — 10k only */}
              {t.key === '10k' && (
                <span style={{
                  position: 'absolute', top: 8, right: 8,
                  fontSize: '0.58rem', fontWeight: 700, letterSpacing: 0.4,
                  background: 'rgba(34,197,94,0.15)', color: '#22c55e',
                  border: '1px solid rgba(34,197,94,0.3)',
                  borderRadius: 20, padding: '2px 6px',
                }}>
                  POPULAR
                </span>
              )}

              {/* Account size */}
              <div style={{
                fontSize: '1rem', fontWeight: 800,
                color: sel ? (is2step ? '#38bdf8' : '#a78bfa') : 'var(--text-primary, #eaecef)',
                marginBottom: 4,
              }}>
                {t.label}
              </div>

              {/* Fee — updates live */}
              <div style={{
                fontSize: '1.1rem', fontWeight: 700,
                color: sel ? accentColor : 'rgba(255,255,255,0.75)',
                marginBottom: 5,
              }}>
                {fee != null ? `$${fee}` : '—'}
              </div>

              {/* Subtext — profit/DD info */}
              <div style={{
                fontSize: '0.68rem',
                color: 'rgba(255,255,255,0.38)',
                lineHeight: 1.4,
              }}>
                {tierSubtext(t.key, selectedChallengeType)}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Account Mode Selector ────────────────────────────────────────────────────

const ACCOUNT_MODES = [
  {
    key:      'demo',
    label:    'Demo Account',
    desc:     'Practice with simulated funds — same challenge rules',
    icon:     '🎮',
    disabled: false,
  },
  {
    key:      'live',
    label:    'Live Account',
    desc:     'Real capital allocation',
    icon:     '💼',
    disabled: true,
  },
]

export function AccountModeSelector({ value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {ACCOUNT_MODES.map(mode => {
        const sel = !mode.disabled && value === mode.key
        return (
          <div
            key={mode.key}
            onClick={() => { if (!mode.disabled) onChange(mode.key) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: sel
                ? 'rgba(124,58,237,0.15)'
                : 'var(--border-color, rgba(255,255,255,0.04))',
              border: `1.5px solid ${sel
                ? 'rgba(124,58,237,0.6)'
                : 'var(--border-color, rgba(255,255,255,0.1))'}`,
              borderRadius: 14, padding: '16px 18px',
              cursor: mode.disabled ? 'not-allowed' : 'pointer',
              opacity: mode.disabled ? 0.5 : 1,
              transition: 'all 0.15s',
              userSelect: 'none',
            }}
          >
            {/* Icon */}
            <div style={{
              width: 42, height: 42, borderRadius: 11, flexShrink: 0,
              background: sel ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${sel ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.25rem',
            }}>
              {mode.icon}
            </div>

            {/* Text */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{
                  fontSize: '0.97rem', fontWeight: 700,
                  color: sel ? '#a78bfa' : 'var(--text-primary, #eaecef)',
                }}>
                  {mode.label}
                </span>
                {mode.disabled && (
                  <span style={{
                    fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.5,
                    background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                    border: '1px solid rgba(245,158,11,0.3)',
                    borderRadius: 20, padding: '2px 7px',
                    textTransform: 'uppercase',
                  }}>
                    Coming Soon
                  </span>
                )}
              </div>
              <div style={{
                fontSize: '0.78rem',
                color: 'var(--text-muted, rgba(255,255,255,0.45))',
                lineHeight: 1.4,
              }}>
                {mode.desc}
              </div>
            </div>

            {/* Radio indicator (non-disabled only) */}
            {!mode.disabled && (
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${sel ? '#a855f7' : 'rgba(255,255,255,0.2)'}`,
                background: sel ? '#7c3aed' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}>
                {sel && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
