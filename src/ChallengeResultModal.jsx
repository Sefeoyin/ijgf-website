/**
 * ChallengeResultModal.jsx
 *
 * Full-screen animated overlay for challenge PASSED and FAILED outcomes.
 *
 * PASSED: Confetti rain, certificate card, gold badge, trader name + avatar.
 * FAILED: Motivational quotes, resilience messaging, encouragement to retry.
 *
 * Props:
 *   result         'passed' | 'failed'
 *   userName       string — trader's display name
 *   profileImage   string — avatar URL (optional)
 *   account        object — demo account with challenge_type, initial_balance etc.
 *   tradingDays    number
 *   onStartNew     function(challengeType, mode) — resets and starts new challenge
 *   onDismiss      function — just closes the modal
 */

import { useEffect, useState, useRef, memo } from 'react'
import { Rocket, Link2 } from 'lucide-react'
import { ChallengeAndTierSelector, AccountModeSelector } from './ChallengeSelectSteps'
import './ChallengeResultModal.css'

// ── Motivational quotes for failed challenges ──────────────────────────────
const FAIL_QUOTES = [
  {
    text: "Every funded trader has a drawer full of failed challenges. The ones who made it kept opening new ones.",
    author: "Prop Trading Wisdom"
  },
  {
    text: "FTMO's global pass rate is under 10%. You're not an outlier — you're in the majority. The difference is who tries again.",
    author: "Industry Data"
  },
  {
    text: "Losses are tuition fees at the University of Markets. The most expensive lesson is the one that finally sticks.",
    author: "Trading Principle"
  },
  {
    text: "The market doesn't care about your feelings, your strategy, or your confidence. It only respects adaptation. Adapt.",
    author: "Risk Management 101"
  },
  {
    text: "Every master was once a disaster. Every expert was once a beginner who refused to quit.",
    author: "T. Harv Eker"
  },
  {
    text: "Resilience is not about bouncing back. It's about bouncing forward — with better risk management.",
    author: "IJGF Principle"
  },
  {
    text: "The trader who never fails is the trader who never trades. Failure is not the opposite of success — it's part of it.",
    author: "Mark Douglas"
  },
]

// ── Confetti particle component ────────────────────────────────────────────
function Confetti() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight

    const COLORS = ['#7C3AED','#a855f7','#f59e0b','#fbbf24','#22c55e','#60a5fa','#f472b6','#e879f9']
    const PARTICLE_COUNT = window.innerWidth >= 1024 ? 60 : 180

    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x:       Math.random() * canvas.width,
      y:       Math.random() * canvas.height - canvas.height,
      w:       Math.random() * 10 + 5,
      h:       Math.random() * 5 + 3,
      color:   COLORS[Math.floor(Math.random() * COLORS.length)],
      vx:      (Math.random() - 0.5) * 3,
      vy:      Math.random() * 3 + 2,
      angle:   Math.random() * Math.PI * 2,
      spin:    (Math.random() - 0.5) * 0.15,
      opacity: Math.random() * 0.6 + 0.4,
    }))

    let raf
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        p.angle += p.spin
        if (p.y > canvas.height + 20) {
          p.y = -20
          p.x = Math.random() * canvas.width
        }
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.angle)
        ctx.globalAlpha = p.opacity
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      })
      raf = requestAnimationFrame(tick)
    }
    tick()

    const stopTimer = setTimeout(() => {
      cancelAnimationFrame(raf)
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    }, 4000)

    const handleResize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(stopTimer)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        zIndex: 9998,
      }}
    />
  )
}

// ── Main modal ─────────────────────────────────────────────────────────────
function ChallengeResultModal({
  result,
  userName = 'Trader',
  profileImage = '',
  account,
  tradingDays = 0,
  onStartNew,
  onDismiss,
}) {
  const [visible, setVisible]   = useState(false)
  const [quote]                  = useState(
    () => FAIL_QUOTES[Math.floor(Math.random() * FAIL_QUOTES.length)]
  )

  // Retry state machine:
  // 'idle' → 'accountMode' → 'challengeSelect' → 'selectMode' → 'bybitApi'
  const [startStep, setStartStep]           = useState('idle')
  const [selectedAccountMode, setSelectedAccountMode] = useState('demo')
  const [selectedChallengeType, setSelectedChallengeType] = useState('1step')
  const [selectedTier, setSelectedTier]     = useState('10k')
  const [apiKey, setApiKey]                 = useState('')
  const [apiSecret, setApiSecret]           = useState('')
  const [apiError, setApiError]             = useState('')
  const [apiSaving, setApiSaving]           = useState(false)

  // Compound key: '10k' | '10k_2step'
  const challengeTypeKey = selectedTier + (selectedChallengeType === '2step' ? '_2step' : '')

  // Animate in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t)
  }, [])

  // Opens the account mode selection screen first
  const handleStart = () => setStartStep('accountMode')

  // User picks IJGF Market — activates demo trading with IJGF MarketsPage
  const handleSelectIJGF = () => {
    if (onStartNew) onStartNew(challengeTypeKey, 'ijgf')
  }

  // User picks Bybit — show API key entry
  const handleSelectBybit = () => setStartStep('bybitApi')

  // Save Bybit API credentials then start challenge
  const handleSaveBybit = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) {
      setApiError('Both API Key and API Secret are required')
      return
    }
    setApiSaving(true)
    setApiError('')
    try {
      const { getOrCreateDemoAccount } = await import('./tradingService')
      const { supabase } = await import('./supabase')

      // Resolve userId from the existing account or from the auth session
      let userId = account?.user_id
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser()
        userId = user?.id
      }

      // Create (or get) the new challenge account for the selected compound key
      const newAccount = await getOrCreateDemoAccount(userId, challengeTypeKey)

      // Write Bybit credentials onto the new account row
      const { error } = await supabase
        .from('demo_accounts')
        .update({
          trading_mode:       'bybit',
          bybit_api_key:      apiKey.trim(),
          bybit_api_secret:   apiSecret.trim(),
          bybit_connected_at: new Date().toISOString(),
        })
        .eq('id', newAccount.id)
      if (error) throw error

      if (onStartNew) onStartNew(challengeTypeKey, 'bybit')
    } catch (err) {
      setApiError(err.message || 'Failed to save API credentials')
    } finally {
      setApiSaving(false)
    }
  }

  const isPassed = result === 'passed'

  // Strip _2step suffix before display: '10k_2step' → '$10,000'
  const acctSize = account?.challenge_type
    ? account.challenge_type.replace('_2step', '').replace('k', ',000')
    : '10,000'

  return (
    <>
      {isPassed && <Confetti />}

      <div
        className={`cr-overlay ${visible ? 'cr-visible' : ''}`}
        onClick={(e) => { if (e.target === e.currentTarget) onDismiss?.() }}
      >
        <div className={`cr-card ${isPassed ? 'cr-passed' : 'cr-failed'} ${visible ? 'cr-card-in' : ''}`}>

          {/* ── PASSED ─────────────────────────────────── */}
          {isPassed && (
            <>
              {/* Gold ring badge */}
              <div className="cr-badge-ring">
                <div className="cr-badge-inner">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21.02 7 14.14 2 9.27l6.91-1.01L12 2z"
                      fill="#f59e0b" stroke="#fbbf24" strokeWidth="0.5"/>
                  </svg>
                </div>
                <div className="cr-badge-pulse" />
              </div>

              <div className="cr-title cr-title-pass">Challenge Passed!</div>
              <div className="cr-subtitle">You've proven your edge. Capital awaits.</div>

              {/* Certificate */}
              <div className="cr-certificate">
                <div className="cr-cert-border" />
                <div className="cr-cert-header">
                  <span className="cr-cert-logo">IJGF</span>
                  <span className="cr-cert-label">Certificate of Achievement</span>
                </div>

                <div className="cr-cert-avatar">
                  {profileImage
                    ? <img src={profileImage} alt={userName} className="cr-cert-img" />
                    : <div className="cr-cert-initials">
                        {userName.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                      </div>
                  }
                </div>

                <div className="cr-cert-name">{userName}</div>
                <div className="cr-cert-text">
                  has successfully completed the
                </div>
                <div className="cr-cert-tier">${acctSize} Challenge</div>

                <div className="cr-cert-stats">
                  <div className="cr-cert-stat">
                    <span className="cr-cert-stat-val">{tradingDays}</span>
                    <span className="cr-cert-stat-lbl">Trading Days</span>
                  </div>
                  <div className="cr-cert-stat">
                    <span className="cr-cert-stat-val">
                      {account
                        ? `+$${Math.max(0, account.current_balance - account.initial_balance).toFixed(0)}`
                        : '—'
                      }
                    </span>
                    <span className="cr-cert-stat-lbl">Net Profit</span>
                  </div>
                  <div className="cr-cert-stat">
                    <span className="cr-cert-stat-val">80%</span>
                    <span className="cr-cert-stat-lbl">Profit Split</span>
                  </div>
                </div>

                <div className="cr-cert-date">
                  {new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}
                </div>
              </div>

              <div className="cr-note cr-note-pass">
                🎉 In live mode, your funded account would now be activated. For this demo, start a new challenge to keep practising.
              </div>

              {startStep === 'idle' && (
                <div className="cr-actions">
                  <button className="cr-btn-primary" onClick={handleStart}>
                    Start New Challenge
                  </button>
                  <button className="cr-btn-ghost" onClick={onDismiss}>
                    View Dashboard
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── FAILED ─────────────────────────────────── */}
          {!isPassed && (
            <>
              <div className="cr-fail-icon">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5">
                  <path d="M12 2L2 20h20L12 2z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <circle cx="12" cy="16.5" r="0.5" fill="#f59e0b"/>
                </svg>
              </div>

              <div className="cr-title cr-title-fail">Challenge Ended</div>
              <div className="cr-subtitle cr-subtitle-fail">
                This one didn't go your way — and that's okay.
              </div>

              {/* Quote card */}
              <div className="cr-quote-card">
                <div className="cr-quote-mark">"</div>
                <p className="cr-quote-text">{quote.text}</p>
                <span className="cr-quote-author">— {quote.author}</span>
              </div>

              {/* Stats of the attempt */}
              <div className="cr-fail-stats">
                <div className="cr-fail-stat">
                  <span className="cr-fail-stat-val">{tradingDays}</span>
                  <span className="cr-fail-stat-lbl">Days Traded</span>
                </div>
                <div className="cr-fail-stat">
                  <span className={`cr-fail-stat-val${account && account.current_balance < account.initial_balance ? ' cr-neg' : ''}`}>
                    {account
                      ? `${account.current_balance >= account.initial_balance ? '+' : '-'}$${Math.abs(account.current_balance - account.initial_balance).toFixed(0)}`
                      : '—'
                    }
                  </span>
                  <span className="cr-fail-stat-lbl">Net P&amp;L</span>
                </div>
                <div className="cr-fail-stat">
                  <span className="cr-fail-stat-val">
                    {account?.total_trades || 0}
                  </span>
                  <span className="cr-fail-stat-lbl">Total Trades</span>
                </div>
              </div>

              {/* Resilience message */}
              <div className="cr-resilience">
                <div className="cr-resilience-heading">The Traders Who Made It</div>
                <p className="cr-resilience-text">
                  FTMO's global pass rate is under 10%. The best traders in the world failed challenges before they got funded.
                  What separates them from everyone else is simple: <strong>they came back</strong>. Resilience is the one trait
                  no market condition can take from you.
                </p>
              </div>

              <div className="cr-note">
                Review your trade history to identify patterns. Risk management — not entry timing — is what gets traders funded.
              </div>

              {startStep === 'idle' && (
                <div className="cr-actions">
                  <button className="cr-btn-primary" onClick={handleStart}>
                    Try Again
                  </button>
                  <button className="cr-btn-ghost" onClick={onDismiss}>
                    Review History
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── SHARED RETRY STEPS — outside both passed/failed blocks ────── */}

          {startStep === 'accountMode' && (
            <div className="cr-mode-picker">
              <p className="cr-mode-title">Select Account Type</p>
              <AccountModeSelector
                value={selectedAccountMode}
                onChange={setSelectedAccountMode}
              />
              <div className="cr-actions" style={{ marginTop: 12 }}>
                <button
                  className="cr-btn-primary"
                  onClick={() => setStartStep('challengeSelect')}
                >
                  Continue →
                </button>
                <button className="cr-btn-ghost" onClick={() => setStartStep('idle')}>
                  ← Back
                </button>
              </div>
            </div>
          )}

          {startStep === 'challengeSelect' && (
            <div className="cr-mode-picker">
              <p className="cr-mode-title">Select Challenge</p>
              <ChallengeAndTierSelector
                selectedChallengeType={selectedChallengeType}
                setSelectedChallengeType={setSelectedChallengeType}
                selectedTier={selectedTier}
                setSelectedTier={setSelectedTier}
              />
              <div className="cr-actions" style={{ marginTop: 12 }}>
                <button
                  className="cr-btn-primary"
                  onClick={() => setStartStep('selectMode')}
                >
                  Continue →
                </button>
                <button className="cr-btn-ghost" onClick={() => setStartStep('accountMode')}>
                  ← Back
                </button>
              </div>
            </div>
          )}

          {startStep === 'selectMode' && (
            <div className="cr-mode-picker">
              <p className="cr-mode-title">How would you like to trade?</p>
              <button className="cr-mode-btn" onClick={handleSelectIJGF}>
                <span className="cr-mode-icon"><Rocket size={20} strokeWidth={1.75} /></span>
                <div className="cr-mode-info">
                  <span className="cr-mode-name">IJGF Market</span>
                  <span className="cr-mode-desc">Trade Binance tokens inside this platform</span>
                </div>
              </button>
              <button className="cr-mode-btn" onClick={handleSelectBybit}>
                <span className="cr-mode-icon"><Link2 size={20} strokeWidth={1.75} /></span>
                <div className="cr-mode-info">
                  <span className="cr-mode-name">Connect Bybit</span>
                  <span className="cr-mode-desc">Trade on your Bybit demo futures terminal</span>
                </div>
              </button>
              <button className="cr-btn-ghost" style={{ marginTop: 4 }} onClick={() => setStartStep('challengeSelect')}>
                ← Back
              </button>
            </div>
          )}

          {startStep === 'bybitApi' && (
            <div className="cr-bybit-form">
              <p className="cr-mode-title">Connect Bybit Demo Account</p>
              <p className="cr-bybit-hint">
                Create a <strong>read + trade</strong> API key on Bybit Testnet. Do not enable withdrawals.
              </p>
              {apiError && (
                <div className="cr-api-error">{apiError}</div>
              )}
              <label className="cr-api-label">API Key</label>
              <input
                className="cr-api-input"
                type="password"
                placeholder="Paste Bybit API key"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
              <label className="cr-api-label">API Secret</label>
              <input
                className="cr-api-input"
                type="password"
                placeholder="Paste Bybit API secret"
                value={apiSecret}
                onChange={e => setApiSecret(e.target.value)}
              />
              <div className="cr-actions" style={{ marginTop: 16 }}>
                <button
                  className="cr-btn-primary"
                  onClick={handleSaveBybit}
                  disabled={apiSaving}
                  style={{ opacity: apiSaving ? 0.7 : 1 }}
                >
                  {apiSaving ? 'Connecting...' : 'Connect & Start Challenge'}
                </button>
                <button className="cr-btn-ghost" onClick={() => setStartStep('selectMode')}>
                  ← Back
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}

export default memo(ChallengeResultModal)
