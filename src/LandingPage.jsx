import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { motion } from 'framer-motion'

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

  const challengeTiers = [
    { size: '$5K', price: '$49', target: '10%', maxDrawdown: '6%', dailyLimit: '4%', status: 'active' },
    { size: '$10K', price: '$99', target: '10%', maxDrawdown: '6%', dailyLimit: '4%', status: 'popular' },
    { size: '$25K', price: '$249', target: '10%', maxDrawdown: '6%', dailyLimit: '4%', status: 'coming' },
    { size: '$50K', price: '$499', target: '10%', maxDrawdown: '6%', dailyLimit: '4%', status: 'coming' },
    { size: '$100K', price: '$999', target: '10%', maxDrawdown: '6%', dailyLimit: '4%', status: 'coming' },
  ]

  const scrollToSection = (id) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Animation variants
  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' }
    }
  }

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1
      }
    }
  }

  const scaleIn = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { duration: 0.5, ease: 'easeOut' }
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
        
        <motion.div 
          className="hero-content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
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
        </motion.div>
      </section>

      {/* Key Benefits Section */}
      <section className="benefits-section">
        <div className="section-container">
          <motion.h2 
            className="section-title"
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            Key Benefits
          </motion.h2>
          <motion.p 
            className="section-subtitle"
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            The most transparent and trader-friendly platform in crypto prop trading
          </motion.p>
          
          <motion.div 
            className="benefits-grid"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            <motion.div className="benefit-card dark-card" variants={scaleIn}>
              <img src="/images/tdesign_secured-filled.png" alt="VARA Regulated" className="benefit-icon" />
              <h3>VARA Regulated & Compliant</h3>
              <p>Built to meet VARA regulatory standards, ensuring a secure, transparent, and compliant trading environment you can trust.</p>
            </motion.div>
            
            <motion.div className="benefit-card purple-card" variants={scaleIn}>
              <h3>Real Capital Deployment</h3>
              <p>Trade with actual firm capital once you qualify. no paper trading, no simulations. Your decisions impact real positions, real markets, and real payouts.</p>
              <img src="/images/capital_1.png" alt="Real Capital" className="benefit-illustration" />
            </motion.div>
            
            <motion.div className="benefit-card dark-card" variants={scaleIn}>
              <h3>Up to 80% Profit Split</h3>
              <p>Keep the majority of what you earn. Our profit-sharing model is designed to reward skill, consistency, and long-term performance.</p>
            </motion.div>
            
            <motion.div className="benefit-card dark-card" variants={scaleIn}>
              <h3>No Time Limits on Challenges</h3>
              <p>Trade at your own pace without pressure. Focus on proper risk management and strategy execution. no forced timelines, no rushed decisions.</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="how-it-works-section" id="how-it-works">
        <div className="section-container">
          <motion.h2 
            className="section-title"
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            How it Works
          </motion.h2>
          <motion.p 
            className="section-subtitle"
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            Three simple steps to get funded
          </motion.p>
          
          <motion.div 
            className="steps-grid"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            <motion.div className="step-card" variants={fadeInUp}>
              <span className="step-number">1</span>
              <span className="step-label">Step 1</span>
              <h3>Choose Challenge</h3>
              <p>Select a funding level that fits your trading style and risk appetite</p>
            </motion.div>
            
            <motion.div className="step-card" variants={fadeInUp}>
              <span className="step-number">2</span>
              <span className="step-label">Step 2</span>
              <h3>Pass Evaluation</h3>
              <p>Demonstrate consistency, discipline, and risk control under real market conditions.</p>
            </motion.div>
            
            <motion.div className="step-card" variants={fadeInUp}>
              <span className="step-number">3</span>
              <span className="step-label">Step 3</span>
              <h3>Get Funded</h3>
              <p>Trade with firm-backed capital and earn your share of the profits.</p>
            </motion.div>
          </motion.div>
          
          <motion.button 
            className="btn-secondary learn-more-btn" 
            onClick={() => navigate('/how-it-works')}
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            Learn More
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.button>
        </div>
      </section>

      {/* Choose Your Challenge Section */}
      <section className="challenges-preview-section">
        <div className="section-container">
          <motion.h2 
            className="section-title"
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            Choose Your Challenge
          </motion.h2>
          <motion.p 
            className="section-subtitle"
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            Select your path to funded trading
          </motion.p>

          <motion.div 
            className="challenge-cards-grid"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            {challengeTiers.map((tier, index) => (
              <motion.div 
                key={index}
                className={`challenge-preview-card ${tier.status === 'popular' ? 'popular' : ''} ${tier.status === 'coming' ? 'coming-soon' : ''}`}
                variants={scaleIn}
              >
                {tier.status === 'popular' && <span className="popular-badge">Popular</span>}
                {tier.status === 'coming' && <span className="coming-badge">Coming Soon</span>}
                
                <div className="challenge-size">{tier.size}</div>
                <div className="challenge-price">{tier.price}</div>
                
                <div className="challenge-specs">
                  <div className="spec-row">
                    <span>Profit Target</span>
                    <span>{tier.target}</span>
                  </div>
                  <div className="spec-row">
                    <span>Max Drawdown</span>
                    <span>{tier.maxDrawdown}</span>
                  </div>
                  <div className="spec-row">
                    <span>Daily Limit</span>
                    <span>{tier.dailyLimit}</span>
                  </div>
                  <div className="spec-row">
                    <span>Profit Split</span>
                    <span>80%</span>
                  </div>
                </div>

                <button 
                  className={`challenge-btn ${tier.status === 'coming' ? 'disabled' : ''}`}
                  onClick={() => tier.status !== 'coming' && navigate('/challenges')}
                  disabled={tier.status === 'coming'}
                >
                  {tier.status === 'coming' ? 'Coming Soon' : 'Start Challenge'}
                </button>
              </motion.div>
            ))}
          </motion.div>

          <motion.button 
            className="btn-secondary learn-more-btn"
            onClick={() => navigate('/challenges')}
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            View All Challenges
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.button>
        </div>
      </section>

      {/* Trusted By Section */}
      <section className="trusted-section">
        <div className="section-container">
          <motion.div 
            className="trusted-content"
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            <h2 className="trusted-title">Trusted by skilled traders worldwide</h2>
            
            <div className="trusted-stats">
              <div className="stat-item">
                <span className="stat-number">2.5k+</span>
                <span className="stat-label">Funded Traders</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">$1.5M+</span>
                <span className="stat-label">Total Payouts</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">15+</span>
                <span className="stat-label">Countries Served</span>
              </div>
            </div>

            <div className="trusted-avatars">
              <div className="avatar-stack">
                <div className="avatar">👤</div>
                <div className="avatar">👤</div>
                <div className="avatar">👤</div>
                <div className="avatar">👤</div>
                <div className="avatar">👤</div>
              </div>
              <span className="avatar-text">Join thousands of traders</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq-section">
        <div className="section-container">
          <motion.h2 
            className="section-title"
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            Frequently Asked Questions
          </motion.h2>
          <motion.p 
            className="section-subtitle"
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            Everything you need to know about how the platform works, funding, payouts, and trading rules—clearly explained before you get started.
          </motion.p>
          
          <motion.div 
            className="faq-list"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            {faqs.map((faq, index) => (
              <motion.div key={index} className="faq-item" variants={fadeInUp}>
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
              </motion.div>
            ))}
          </motion.div>
          
          <motion.button 
            className="btn-secondary learn-more-btn" 
            onClick={() => navigate('/faq')}
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            Learn More
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.button>
        </div>
      </section>
    </>
  )
}

export default LandingPage
