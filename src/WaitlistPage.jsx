import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

function WaitlistPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const navigate = useNavigate()
  const storySectionRef = useRef(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (email) {
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 3000)
      setEmail('')
      
      // Scroll to story section after a brief delay
      setTimeout(() => {
        storySectionRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        })
      }, 500)
    }
  }

  return (
    <section className="waitlist-section waitlist-page">
      <div className="section-container">
        <div className="waitlist-container">
          <div className="waitlist-icon">
            <img src="/images/logo.png" alt="IJGF" style={{width: '100%', height: '100%', objectFit: 'contain'}} />
          </div>
          
          <h2 className="waitlist-title">Get Early Access to Funded Crypto Trading</h2>
          <p className="waitlist-subtitle">
            Join the waitlist to be among the first traders to access real capital, transparent rules, and performance-based payouts.
          </p>
          
          {submitted && (
            <div className="success-message">
              âœ“ Thank you! You're on the waitlist. We'll be in touch soon.
            </div>
          )}
          
          <form className="waitlist-form" onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Your Email"
              className="email-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" className="submit-btn">Join Waitlist</button>
          </form>
          
          <div className="waitlist-count">
            <div className="avatars">
              <div className="avatar">ðŸ‘¤</div>
              <div className="avatar">ðŸ‘¤</div>
              <div className="avatar">ðŸ‘¤</div>
            </div>
            Join others on the waitlist
          </div>
        </div>

        <button className="optional-btn" onClick={() => navigate('/share-story')}>
          One More Thing (Optional)
        </button>

        {/* Story Section */}
        <div className="story-section" ref={storySectionRef}>
          <h2 className="story-title">Your story could help us shape how we build IJGF</h2>
          <p className="story-subtitle">
            We're not just building another prop firm, we're building a launchpad for traders who've been held back by capital, not skill. If that's you, we'd love to hear your story.
          </p>
          
          <div className="traders-grid">
            <img src="/images/images__5_.png" alt="Traders Community" className="traders-collage" />
          </div>
          
          <button className="btn-secondary share-story-btn" onClick={() => navigate('/share-story')}>
            Share Story
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </section>
  )
}

export default WaitlistPage
