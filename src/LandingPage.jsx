import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'

function LandingPage() {
  const navigate = useNavigate()
  const [openFaq, setOpenFaq] = useState(null)
  const [currentTestimonial, setCurrentTestimonial] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const testimonialRef = useRef(null)

  const testimonials = [
    {
      text: "The lack of time pressure completely changed how I trade. I focused on execution instead of rushing setups, and the funding followed.",
      name: "Marcus Chen",
      role: "$50k Trader",
      isPurple: false
    },
    {
      text: "Finally, a platform that values consistency over speed. Passed my evaluation in 3 weeks and got funded within 48 hours. The payout process is seamless.",
      name: "Sarah Martinez",
      role: "$25k Trader",
      isPurple: true
    },
    {
      text: "I've tried other prop firms before, but IJGF's transparent rules and no hidden fees make all the difference. Been trading funded for 6 months now.",
      name: "James Wilson",
      role: "$100k Trader",
      isPurple: false
    },
    {
      text: "As a swing trader, having no time limits was crucial. I could wait for my setups without pressure. Made 12% in my first funded month.",
      name: "Ahmed Hassan",
      role: "$10k Trader",
      isPurple: false
    },
    {
      text: "The support team is incredibly responsive. When I had questions about the evaluation criteria, they explained everything clearly. No runarounds, just straight answers.",
      name: "Emily Rodriguez",
      role: "$50k Trader",
      isPurple: true
    },
    {
      text: "Been profitable from day one of getting funded. The 80% profit split is industry-leading, and payouts arrive in USDC within 24 hours. Game changer.",
      name: "Thomas Kim",
      role: "$25k Trader",
      isPurple: false
    }
  ]

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (!isMobile) return

    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length)
    }, 5000) // Change every 5 seconds

    return () => clearInterval(interval)
  }, [isMobile, testimonials.length])

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
      answer: "Challenge sizes range from $5,000 to $100,000. Once funded, you trade with real firm capital and can scale your account based on consistent performance."
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
      <section className="hero">
        <div className="hero-bg">
          <img
            src="/images/Rectangle_6281.png"
            alt=""
            className="hero-bg-img"
          />
        </div>
        
        <div className="hero-content">
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
              <p>Trade with actual firm capital once you qualify. No paper trading, no simulations. Your decisions impact real positions, real markets, and real payouts.</p>
              <img src="/images/capital_1.png" alt="Real Capital" className="benefit-illustration" />
            </div>
            
            <div className="benefit-card dark-card">
              <h3>Up to 80% Profit Split</h3>
              <p>Keep the majority of what you earn. Our profit-sharing model is designed to reward skill, consistency, and long-term performance.</p>
            </div>
            
            <div className="benefit-card dark-card">
              <h3>No Time Limits on Challenges</h3>
              <p>Trade at your own pace without pressure. Focus on proper risk management and strategy execution. No forced timelines, no rushed decisions.</p>
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
          
          <button className="btn-secondary learn-more-btn" onClick={() => navigate('/how-it-works')}>
            Learn More
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </section>

      {/* Choose Your Challenge Section */}
      <section className="challenges-section">
        <div className="section-container">
          <h2 className="section-title">Choose Your Challenge</h2>
          <p className="section-subtitle">
            Select a funding level that matches your trading goals. All plans include our comprehensive evaluation system.
          </p>
          
          <div className="challenges-preview-grid">
            <div className="challenge-preview-card">
              <h3 className="challenge-preview-name">The $5k Challenge</h3>
              <div className="challenge-preview-price">
                <span className="price">$49.99</span>
                <span className="price-period">One time</span>
              </div>
              <div className="challenge-preview-specs">
                <div className="spec-row">
                  <span className="spec-label">Profit Target</span>
                  <span className="spec-value">$1,000</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Max Drawdown</span>
                  <span className="spec-value">$1,000</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Daily Limit</span>
                  <span className="spec-value">$200</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Duration</span>
                  <span className="spec-value">30 Days</span>
                </div>
              </div>
              <button className="btn-primary challenge-preview-btn" onClick={() => navigate('/challenges')}>
                Start Challenge
              </button>
              <ul className="challenge-preview-features">
                <li>✓ Real-time evaluation</li>
                <li>✓ 24/7 support</li>
                <li>✓ Unlimited retakes</li>
                <li>✓ Fast approval process</li>
              </ul>
            </div>

            <div className="challenge-preview-card popular">
              <span className="popular-badge">Popular</span>
              <h3 className="challenge-preview-name">The $10k Challenge</h3>
              <div className="challenge-preview-price">
                <span className="price">$99.99</span>
                <span className="price-period">One time</span>
              </div>
              <div className="challenge-preview-specs">
                <div className="spec-row">
                  <span className="spec-label">Profit Target</span>
                  <span className="spec-value">$2,000</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Max Drawdown</span>
                  <span className="spec-value">$1,250</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Daily Limit</span>
                  <span className="spec-value">$500</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Duration</span>
                  <span className="spec-value">45 Days</span>
                </div>
              </div>
              <button className="btn-primary challenge-preview-btn" onClick={() => navigate('/challenges')}>
                Start Challenge
              </button>
              <ul className="challenge-preview-features">
                <li>✓ Real-time evaluation</li>
                <li>✓ 24/7 support</li>
                <li>✓ Unlimited retakes</li>
                <li>✓ Fast approval process</li>
                <li>✓ Priority review</li>
              </ul>
            </div>

            <div className="challenge-preview-card disabled">
              <h3 className="challenge-preview-name">The $25k Challenge</h3>
              <div className="challenge-preview-price">
                <span className="price">$249.99</span>
                <span className="price-period">One time</span>
              </div>
              <div className="challenge-preview-specs">
                <div className="spec-row">
                  <span className="spec-label">Profit Target</span>
                  <span className="spec-value">$1,000</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Max Drawdown</span>
                  <span className="spec-value">$1,000</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Daily Limit</span>
                  <span className="spec-value">$200</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Duration</span>
                  <span className="spec-value">30 Days</span>
                </div>
              </div>
              <button className="btn-coming-soon challenge-preview-btn" disabled>
                Coming Soon
              </button>
              <ul className="challenge-preview-features">
                <li>✓ Real-time evaluation</li>
                <li>✓ 24/7 support</li>
                <li>✓ Unlimited retakes</li>
                <li>✓ Fast approval process</li>
                <li>✓ Priority review</li>
                <li>✓ Account Manager</li>
              </ul>
            </div>

            <div className="challenge-preview-card disabled">
              <h3 className="challenge-preview-name">The $50k Challenge</h3>
              <div className="challenge-preview-price">
                <span className="price">$249.99</span>
                <span className="price-period">One time</span>
              </div>
              <div className="challenge-preview-specs">
                <div className="spec-row">
                  <span className="spec-label">Profit Target</span>
                  <span className="spec-value">$1,000</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Max Drawdown</span>
                  <span className="spec-value">$1,000</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Daily Limit</span>
                  <span className="spec-value">$200</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Duration</span>
                  <span className="spec-value">30 Days</span>
                </div>
              </div>
              <button className="btn-coming-soon challenge-preview-btn" disabled>
                Coming Soon
              </button>
              <ul className="challenge-preview-features">
                <li>✓ Real-time evaluation</li>
                <li>✓ 24/7 support</li>
                <li>✓ Unlimited retakes</li>
                <li>✓ Fast approval process</li>
                <li>✓ Priority review</li>
                <li>✓ Account Manager</li>
              </ul>
            </div>

            <div className="challenge-preview-card disabled">
              <h3 className="challenge-preview-name">The $100k Challenge</h3>
              <div className="challenge-preview-price">
                <span className="price">$999.99</span>
                <span className="price-period">One time</span>
              </div>
              <div className="challenge-preview-specs">
                <div className="spec-row">
                  <span className="spec-label">Profit Target</span>
                  <span className="spec-value">$1,000</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Max Drawdown</span>
                  <span className="spec-value">$1,000</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Daily Limit</span>
                  <span className="spec-value">$200</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Duration</span>
                  <span className="spec-value">30 Days</span>
                </div>
              </div>
              <button className="btn-coming-soon challenge-preview-btn" disabled>
                Coming Soon
              </button>
              <ul className="challenge-preview-features">
                <li>✓ Real-time evaluation</li>
                <li>✓ 24/7 support</li>
                <li>✓ Unlimited retakes</li>
                <li>✓ Fast approval process</li>
                <li>✓ Priority review</li>
                <li>✓ Account Manager</li>
              </ul>
            </div>
          </div>

          <button className="btn-secondary learn-more-btn" onClick={() => navigate('/challenges')}>
            Show More
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </section>

      {/* Trusted by Skilled Traders Worldwide Section */}
      <section className="trusted-section">
        <div className="section-container">
          <h2 className="section-title">Trusted by Skilled Traders Worldwide</h2>
          <p className="section-subtitle">
            Real capital deployment, consistent payouts, and a growing global network of disciplined crypto traders.
          </p>

          {/* Stats Cards with Background Graphics */}
          <div className="trusted-stats-grid">
            <div className="trusted-stat-card">
              <div className="stat-card-content">
                <span className="trusted-stat-value">2.5k+</span>
                <span className="trusted-stat-title">Total Traders Funded</span>
                <p className="trusted-stat-desc">Number of traders currently trading with firm-backed capital after passing evaluation.</p>
              </div>
            </div>
            
            <div className="trusted-stat-card">
              <div className="stat-card-content">
                <span className="trusted-stat-value">$1.5M+</span>
                <span className="trusted-stat-title">Total Payouts</span>
                <p className="trusted-stat-desc">Cumulative profits paid out to funded traders across all accounts.</p>
              </div>
            </div>
            
            <div className="trusted-stat-card">
              <div className="stat-card-content">
                <span className="trusted-stat-value">15</span>
                <span className="trusted-stat-title">Countries</span>
                <p className="trusted-stat-desc">Active traders participating from across the world.</p>
              </div>
            </div>
          </div>

          {/* Testimonials Grid */}
          {isMobile ? (
            <div className="testimonials-carousel">
              <div className="testimonial-card-wrapper">
                <div className={`testimonial-card ${testimonials[currentTestimonial].isPurple ? 'testimonial-purple' : ''}`}>
                  <p className="testimonial-text">
                    {testimonials[currentTestimonial].text}
                  </p>
                  <div className="testimonial-author">
                    <div className="author-avatar"></div>
                    <div className="author-info">
                      <span className="author-name">{testimonials[currentTestimonial].name}</span>
                      <span className="author-role">{testimonials[currentTestimonial].role}</span>
                      <div className="author-rating">★★★★★</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="carousel-dots">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    className={`carousel-dot ${index === currentTestimonial ? 'active' : ''}`}
                    onClick={() => setCurrentTestimonial(index)}
                    aria-label={`Go to testimonial ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="testimonials-grid">
              <div className="testimonial-card">
                <p className="testimonial-text">
                  The lack of time pressure completely changed how I trade. I focused on execution instead of rushing setups, and the funding followed.
                </p>
                <div className="testimonial-author">
                  <div className="author-avatar"></div>
                  <div className="author-info">
                    <span className="author-name">Marcus Chen</span>
                    <span className="author-role">$50k Trader</span>
                    <div className="author-rating">★★★★★</div>
                  </div>
                </div>
              </div>

              <div className="testimonial-card testimonial-purple">
                <p className="testimonial-text">
                  Finally, a platform that values consistency over speed. Passed my evaluation in 3 weeks and got funded within 48 hours. The payout process is seamless.
                </p>
                <div className="testimonial-author">
                  <div className="author-avatar"></div>
                  <div className="author-info">
                    <span className="author-name">Sarah Martinez</span>
                    <span className="author-role">$25k Trader</span>
                    <div className="author-rating">★★★★★</div>
                  </div>
                </div>
              </div>

              <div className="testimonial-card">
                <p className="testimonial-text">
                  I've tried other prop firms before, but IJGF's transparent rules and no hidden fees make all the difference. Been trading funded for 6 months now.
                </p>
                <div className="testimonial-author">
                  <div className="author-avatar"></div>
                  <div className="author-info">
                    <span className="author-name">James Wilson</span>
                    <span className="author-role">$100k Trader</span>
                    <div className="author-rating">★★★★★</div>
                  </div>
                </div>
              </div>

              <div className="testimonial-card">
                <p className="testimonial-text">
                  As a swing trader, having no time limits was crucial. I could wait for my setups without pressure. Made 12% in my first funded month.
                </p>
                <div className="testimonial-author">
                  <div className="author-avatar"></div>
                  <div className="author-info">
                    <span className="author-name">Ahmed Hassan</span>
                    <span className="author-role">$10k Trader</span>
                    <div className="author-rating">★★★★★</div>
                  </div>
                </div>
              </div>

              <div className="testimonial-card testimonial-purple">
                <p className="testimonial-text">
                  The support team is incredibly responsive. When I had questions about the evaluation criteria, they explained everything clearly. No runarounds, just straight answers.
                </p>
                <div className="testimonial-author">
                  <div className="author-avatar"></div>
                  <div className="author-info">
                    <span className="author-name">Emily Rodriguez</span>
                    <span className="author-role">$50k Trader</span>
                    <div className="author-rating">★★★★★</div>
                  </div>
                </div>
              </div>

              <div className="testimonial-card">
                <p className="testimonial-text">
                  Been profitable from day one of getting funded. The 80% profit split is industry-leading, and payouts arrive in USDC within 24 hours. Game changer.
                </p>
                <div className="testimonial-author">
                  <div className="author-avatar"></div>
                  <div className="author-info">
                    <span className="author-name">Thomas Kim</span>
                    <span className="author-role">$25k Trader</span>
                    <div className="author-rating">★★★★★</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq-section">
        <div className="section-container">
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-subtitle">
            Everything you need to know about how the platform works, funding, payouts, and trading rules clearly explained before you get started.
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
          
          <button className="btn-secondary learn-more-btn" onClick={() => navigate('/faq')}>
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
