import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

function LandingPage() {
  const navigate = useNavigate()
  const [openFaq, setOpenFaq] = useState(null)

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  const faqs = [
    {
      question: "What is a crypto prop trading platform?",
      answer: "A crypto prop trading platform provides skilled traders with firm capital to trade cryptocurrencies. You prove your ability through evaluation challenges, then trade with real capital while keeping a significant portion of the profits."
    },
    {
      question: "How much capital can I access?",
      answer: "Challenge sizes range from $10,000 to $200,000. Once funded, you trade with real firm capital and can scale your account based on consistent performance."
    },
    {
      question: "What are the profit splits?",
      answer: "You keep up to 80% of the profits you generate. The split depends on your challenge tier and performance consistency."
    },
    {
      question: "Are there time limits on challenges?",
      answer: "No. Unlike other platforms, IJGF has no time limits on evaluation challenges. Trade at your own pace and focus on executing your strategy properly without rushed decisions."
    },
    {
      question: "Is IJGF regulated?",
      answer: "Yes. IJGF is built to meet VARA (Virtual Assets Regulatory Authority) standards in Dubai, ensuring a secure, transparent, and compliant trading environment."
    }
  ]

  const scrollToSection = (id) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <>
      {/* Hero Section */}
      <section className="hero" style={{ position: 'relative', overflow: 'hidden' }}>
        <div
          className="hero-bg"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 0,
            margin: 0,
            padding: 0,
          }}
        >
          <img
            src="/images/Rectangle_6281.png"
            alt=""
            className="hero-bg-img"
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 35%',
              margin: 0,
              padding: 0,
            }}
          />
        </div>
        
        <div className="hero-content" style={{ position: 'relative', zIndex: 1 }}>
          <h1 className="hero-title">
            Where <span className="highlight">Skill</span>, Not Capital, Determines <span className="highlight">Opportunity</span>
          </h1>
          
          <p className="hero-subtitle blurred-text">
            The first VARA-regulated crypto prop trading platform.
          </p>
          
          <div className="hero-buttons">
            <button className="btn-primary" onClick={() => navigate('/waitlist')}>
              Join Waitlist
            </button>
            <button className="btn-secondary" onClick={() => scrollToSection('how-it-works')}>
              Learn How it Works
            </button>
          </div>
          
          <div className="hero-features">
            <div className="feature-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              VARA Regulated
            </div>
            <div className="feature-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
              Real Capital
            </div>
            <div className="feature-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              24/7 Markets
            </div>
            <div className="feature-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              Fast Daily Payouts
            </div>
          </div>
        </div>
      </section>

      {/* Key Benefits Section */}
      <section className="benefits-section">
        <div className="section-container">
          <h2 className="section-title">Key Benefits</h2>
          <p className="section-subtitle">
            The most transparent and trader-friendly platform in crypto prop trading
          </p>
          
          <div className="benefits-grid">
            <div className="benefit-card dark-card">
              <img src="/images/tdesign_secured-filled.png" alt="VARA Regulated" className="benefit-icon" />
              <h3>VARA Regulated & Compliant</h3>
              <p>Built to meet VARA regulatory standards, ensuring a secure, transparent, and compliant trading environment you can trust.</p>
            </div>
            
            <div className="benefit-card purple-card">
              <h3>Real Capital Deployment</h3>
              <p>Trade with actual firm capital once you qualify. no paper trading, no simulations. Your decisions impact real positions, real markets, and real payouts.</p>
              <img src="/images/capital_1.png" alt="Real Capital" className="benefit-illustration" />
            </div>
            
            <div className="benefit-card dark-card">
              <h3>Up to 80% Profit Split</h3>
              <p>Keep the majority of what you earn. Our profit-sharing model is designed to reward skill, consistency, and long-term performance.</p>
            </div>
            
            <div className="benefit-card dark-card">
              <h3>No Time Limits on Challenges</h3>
              <p>Trade at your own pace without pressure. Focus on proper risk management and strategy execution. no forced timelines, no rushed decisions.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="how-it-works-section" id="how-it-works">
        <div className="section-container">
          <h2 className="section-title">How it Works</h2>
          <p className="section-subtitle">Three simple steps to get funded</p>
          
          <div className="steps-grid">
            <div className="step-card">
              <span className="step-number">1</span>
              <span className="step-label">Step 1</span>
              <h3>Choose Challenge</h3>
              <p>Select a funding level that fits your trading style and risk appetite</p>
            </div>
            
            <div className="step-card">
              <span className="step-number">2</span>
              <span className="step-label">Step 2</span>
              <h3>Pass Evaluation</h3>
              <p>Demonstrate consistency, discipline, and risk control under real market conditions.</p>
            </div>
            
            <div className="step-card">
              <span className="step-number">3</span>
              <span className="step-label">Step 3</span>
              <h3>Get Funded</h3>
              <p>Trade with firm-backed capital and earn your share of the profits.</p>
            </div>
          </div>
          
          <button className="btn-secondary learn-more-btn" onClick={() => navigate('/waitlist')}>
            Learn More
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq-section">
        <div className="section-container">
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-subtitle">
            Everything you need to know about how the platform works, funding, payouts, and trading rules. clearly explained before you get started.
          </p>
          
          <div className="faq-list">
            {faqs.map((faq, index) => (
              <div key={index} className="faq-item">
                <button 
                  className="faq-question"
                  onClick={() => toggleFaq(index)}
                >
                  {faq.question}
                  <svg 
                    width="18" 
                    height="18" 
                    viewBox="0 0 20 20" 
                    fill="none"
                    className={openFaq === index ? 'rotated' : ''}
                  >
                    <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {openFaq === index && (
                  <div className="faq-answer">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <button className="btn-secondary learn-more-btn" onClick={() => navigate('/waitlist')}>
            Learn More
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </section>
    </>
  )
}

export default LandingPage