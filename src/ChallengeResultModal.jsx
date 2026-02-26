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
 *   onStartNew     function(challengeType) — resets and starts new challenge
 *   onDismiss      function — just closes the modal
 */

import { useEffect, useState, useRef } from 'react'

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
    const PARTICLE_COUNT = 180

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

    const handleResize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(raf)
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

  // Animate in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t)
  }, [])

  const handleStart = () => {
    if (onStartNew) onStartNew('10k')
  }

  const isPassed = result === 'passed'
  const acctSize = account?.challenge_type
    ? account.challenge_type.replace('k', ',000')
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

              <div className="cr-actions">
                <button className="cr-btn-primary" onClick={handleStart}>
                  Start New Challenge
                </button>
                <button className="cr-btn-ghost" onClick={onDismiss}>
                  View Dashboard
                </button>
              </div>
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
                  <span className="cr-fail-stat-val cr-neg">
                    {account
                      ? `$${Math.abs(account.current_balance - account.initial_balance).toFixed(0)}`
                      : '—'
                    }
                  </span>
                  <span className="cr-fail-stat-lbl">Net Loss</span>
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

              <div className="cr-actions">
                <button className="cr-btn-primary" onClick={handleStart}>
                  Try Again
                </button>
                <button className="cr-btn-ghost" onClick={onDismiss}>
                  Review History
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        /* ── Overlay ── */
        .cr-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          opacity: 0; transition: opacity 0.35s ease;
        }
        .cr-overlay.cr-visible { opacity: 1; }

        /* ── Card ── */
        .cr-card {
          background: #0d0f14;
          border-radius: 20px;
          padding: 36px 32px;
          max-width: 520px; width: 100%;
          max-height: 90vh; overflow-y: auto;
          text-align: center;
          transform: translateY(40px) scale(0.95);
          opacity: 0;
          transition: transform 0.45s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease;
          scrollbar-width: thin; scrollbar-color: #2b3139 transparent;
        }
        .cr-card.cr-card-in { transform: translateY(0) scale(1); opacity: 1; }
        .cr-card.cr-passed { border: 1px solid rgba(245,158,11,0.35); }
        .cr-card.cr-failed { border: 1px solid rgba(255,255,255,0.08); }

        /* ── Badge ── */
        .cr-badge-ring {
          position: relative; width: 80px; height: 80px;
          margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;
        }
        .cr-badge-inner {
          width: 80px; height: 80px; border-radius: 50%;
          background: linear-gradient(135deg,rgba(245,158,11,0.25),rgba(251,191,36,0.1));
          border: 2px solid rgba(245,158,11,0.5);
          display: flex; align-items: center; justify-content: center;
          position: relative; z-index: 1;
          animation: cr-badge-in 0.6s 0.3s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes cr-badge-in {
          from { transform: scale(0) rotate(-180deg); }
          to   { transform: scale(1) rotate(0deg); }
        }
        .cr-badge-pulse {
          position: absolute; inset: -8px; border-radius: 50%;
          border: 1px solid rgba(245,158,11,0.3);
          animation: cr-pulse 2s ease infinite;
        }
        @keyframes cr-pulse {
          0%,100% { transform: scale(1); opacity: 0.4; }
          50%      { transform: scale(1.15); opacity: 0; }
        }

        /* ── Fail icon ── */
        .cr-fail-icon {
          width: 72px; height: 72px; margin: 0 auto 16px;
          background: rgba(245,158,11,0.1);
          border: 1px solid rgba(245,158,11,0.25);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
        }

        /* ── Text ── */
        .cr-title { font-size: 1.75rem; font-weight: 700; margin-bottom: 8px; }
        .cr-title-pass {
          background: linear-gradient(135deg,#f59e0b,#fbbf24);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .cr-title-fail { color: #eaecef; }
        .cr-subtitle { color: rgba(255,255,255,0.55); font-size: 0.95rem; margin-bottom: 24px; }
        .cr-subtitle-fail { color: rgba(255,255,255,0.45); }

        /* ── Certificate ── */
        .cr-certificate {
          position: relative;
          background: linear-gradient(160deg,#0f1117,#13172a);
          border: 1px solid rgba(245,158,11,0.25);
          border-radius: 14px; padding: 24px 20px 20px;
          margin-bottom: 20px;
          animation: cr-cert-in 0.5s 0.5s ease both;
        }
        @keyframes cr-cert-in {
          from { opacity:0; transform: translateY(16px); }
          to   { opacity:1; transform: translateY(0); }
        }
        .cr-cert-border {
          position: absolute; inset: 6px; border: 1px dashed rgba(245,158,11,0.15);
          border-radius: 10px; pointer-events: none;
        }
        .cr-cert-header {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          margin-bottom: 16px;
        }
        .cr-cert-logo {
          font-size: 1.1rem; font-weight: 800; letter-spacing: 3px;
          background: linear-gradient(135deg,#f59e0b,#fbbf24);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .cr-cert-label { font-size: 0.7rem; color: rgba(255,255,255,0.4); letter-spacing: 1.5px; text-transform: uppercase; }

        .cr-cert-avatar {
          width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 12px;
          border: 2px solid rgba(245,158,11,0.4);
          overflow: hidden; background: rgba(124,58,237,0.3);
          display: flex; align-items: center; justify-content: center;
        }
        .cr-cert-img { width: 100%; height: 100%; object-fit: cover; }
        .cr-cert-initials { font-size: 1.25rem; font-weight: 700; color: #a78bfa; }

        .cr-cert-name { font-size: 1.25rem; font-weight: 700; color: #eaecef; margin-bottom: 4px; }
        .cr-cert-text { font-size: 0.8rem; color: rgba(255,255,255,0.4); margin-bottom: 4px; }
        .cr-cert-tier {
          font-size: 1rem; font-weight: 700;
          background: linear-gradient(135deg,#f59e0b,#fbbf24);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text; margin-bottom: 16px;
        }
        .cr-cert-stats {
          display: flex; justify-content: center; gap: 24px;
          padding: 12px 0; border-top: 1px solid rgba(255,255,255,0.07); border-bottom: 1px solid rgba(255,255,255,0.07);
          margin-bottom: 12px;
        }
        .cr-cert-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .cr-cert-stat-val { font-size: 1rem; font-weight: 700; color: #22c55e; }
        .cr-cert-stat-lbl { font-size: 0.7rem; color: rgba(255,255,255,0.4); }
        .cr-cert-date { font-size: 0.75rem; color: rgba(255,255,255,0.3); }

        /* ── Quote card ── */
        .cr-quote-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px; padding: 20px;
          margin-bottom: 20px; position: relative; text-align: left;
          animation: cr-cert-in 0.5s 0.4s ease both;
        }
        .cr-quote-mark {
          position: absolute; top: 10px; left: 14px;
          font-size: 3rem; line-height: 1; color: rgba(124,58,237,0.4); font-family: serif;
        }
        .cr-quote-text {
          font-size: 0.95rem; color: rgba(255,255,255,0.8);
          line-height: 1.6; margin: 16px 0 8px; padding-left: 4px;
        }
        .cr-quote-author { font-size: 0.8rem; color: rgba(255,255,255,0.4); }

        /* ── Fail stats ── */
        .cr-fail-stats {
          display: flex; justify-content: center; gap: 28px;
          padding: 16px 0; margin-bottom: 20px;
          border-top: 1px solid rgba(255,255,255,0.06);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .cr-fail-stat { display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .cr-fail-stat-val { font-size: 1.1rem; font-weight: 700; color: #eaecef; }
        .cr-fail-stat-val.cr-neg { color: #f6465d; }
        .cr-fail-stat-lbl { font-size: 0.7rem; color: rgba(255,255,255,0.4); }

        /* ── Resilience message ── */
        .cr-resilience {
          background: rgba(124,58,237,0.08);
          border: 1px solid rgba(124,58,237,0.2);
          border-radius: 12px; padding: 16px 18px;
          margin-bottom: 16px; text-align: left;
        }
        .cr-resilience-heading {
          font-size: 0.85rem; font-weight: 700; color: #a78bfa; margin-bottom: 8px;
          text-transform: uppercase; letter-spacing: 0.8px;
        }
        .cr-resilience-text {
          font-size: 0.88rem; color: rgba(255,255,255,0.6); line-height: 1.6; margin: 0;
        }
        .cr-resilience-text strong { color: rgba(255,255,255,0.85); }

        /* ── Note ── */
        .cr-note {
          font-size: 0.8rem; color: rgba(255,255,255,0.35);
          margin-bottom: 20px; line-height: 1.5;
        }
        .cr-note-pass { color: rgba(255,255,255,0.45); }

        /* ── Actions ── */
        .cr-actions { display: flex; flex-direction: column; gap: 10px; }
        .cr-btn-primary {
          width: 100%; padding: 13px;
          background: #7C3AED; color: white; border: none;
          border-radius: 10px; font-size: 1rem; font-weight: 600;
          cursor: pointer; transition: all 0.2s;
        }
        .cr-btn-primary:hover { background: #6D28D9; transform: translateY(-1px); box-shadow: 0 8px 20px rgba(124,58,237,0.4); }
        .cr-btn-ghost {
          width: 100%; padding: 12px;
          background: transparent; color: rgba(255,255,255,0.55);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; font-size: 0.95rem; cursor: pointer; transition: all 0.2s;
        }
        .cr-btn-ghost:hover { border-color: rgba(255,255,255,0.2); color: #eaecef; }

        /* ── Scrollbar ── */
        .cr-card::-webkit-scrollbar { width: 4px; }
        .cr-card::-webkit-scrollbar-thumb { background: #2b3139; border-radius: 2px; }

        @media (max-width: 480px) {
          .cr-card { padding: 28px 20px; border-radius: 16px; }
          .cr-title { font-size: 1.4rem; }
          .cr-cert-stats { gap: 16px; }
          .cr-fail-stats { gap: 20px; }
        }
      `}</style>
    </>
  )
}

export default ChallengeResultModal
