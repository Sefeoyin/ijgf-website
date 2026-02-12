import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { motion } from 'framer-motion'

// Animation variants for scroll reveal
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' }
  }
}

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.6, ease: 'easeOut' }
  }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.5, ease: 'easeOut' }
  }
}

function LandingPage() {
  const navigate = useNavigate()
  const [openFaq, setOpenFaq] = useState(null)

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  const challenges = [
    { size: '$5K', price: '$49', popular: false, available: true },
    { size: '$10K', price: '$99', popular: true, available: true },
    { size: '$25K', price: '$249', popular: false, available: false },
    { size: '$50K', price: '$499', popular: false, available: false },
    { size: '$100K', price: '$999', popular: false, available: false },
  ]

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

  return (
    <>
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-bg">
          <img src="/images/Rectangle_6281.png" alt="" className="hero-bg-img" />
        </div>
        
        <motion.div 
          className="hero-content"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.h1 className="hero-title" variants={fadeInUp}>
            Trade on Skill. We <span className="highlight">Fund</span> the Rest.
          </motion.h1>
          
          <motion.p className="hero-subtitle" variants={fadeInUp}>
            Prove your edge through disciplined, risk-managed trading and earn access to firm-backed crypto capital. No upfront capital required
          </motion.p>
          
          <motion.div className="hero-buttons" variants={fadeInUp}>
            <button className="btn-primary" onClick={() => navigate('/waitlist')}>
              Join Waitlist
            </button>
            <button className="btn-secondary" onClick={() => document.getElementById('how-it-works').scrollIntoView({ behavior: 'smooth' })}>
              Learn How it Works
            </button>
          </motion.div>
          
          <motion.div className="hero-features" variants={fadeInUp}>
            <div className="feature-item">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M16.667 5L7.5 14.167L3.333 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              VARA Regulated
            </div>
            <div className="feature-item">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M16.667 5L7.5 14.167L3.333 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Real Capital
            </div>
            <div className="feature-item">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M16.667 5L7.5 14.167L3.333 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              24/7 Markets
            </div>
            <div className="feature-item">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M16.667 5L7.5 14.167L3.333 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Fast Daily Payouts
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Key Benefits Section */}
      <section className="benefits-section">
        <div className="section-container">
          <motion.h2 
            className="section-title"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
          >
            Key Benefits
          </motion.h2>
          <motion.p 
            className="section-subtitle"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
          >
            The most transparent and trader-friendly platform in crypto prop trading
          </motion.p>
          
          <motion.div 
            className="benefits-grid"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
          >
            <motion.div className="benefit-card dark-card" variants={scaleIn}>
              <div className="benefit-icon-wrapper">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <path d="M9 12l2 2 4-4"/>
                </svg>
              </div>
              <h3>VARA Regulated & Compliant</h3>
              <p>Built to meet VARA regulatory standards, ensuring a secure, transparent, and compliant trading environment you can trust.</p>
            </motion.div>
            
            <motion.div className="benefit-card dark-card" variants={scaleIn}>
              <div className="benefit-icon-wrapper">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <h3>Real Capital Deployment</h3>
              <p>Trade with actual firm capital once you qualify—no paper trading, no simulations. Your decisions impact real positions, real markets, and real payouts.</p>
            </motion.div>
            
            <motion.div className="benefit-card dark-card" variants={scaleIn}>
              <div className="benefit-icon-wrapper">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23"/>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </div>
              <h3>Up to 80% Profit Split</h3>
              <p>Keep the majority of what you earn. Our profit-sharing model is designed to reward skill, consistency, and long-term performance.</p>
            </motion.div>
            
            <motion.div className="benefit-card dark-card" variants={scaleIn}>
              <div className="benefit-icon-wrapper">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <h3>No Time Limits on Challenges</h3>
              <p>Trade at your own pace without pressure. Focus on proper risk management and strategy execution—no forced timelines, no rushed decisions.</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="how-it-works-section" id="how-it-works">
        <div className="section-container">
          <motion.h2 
            className="section-title"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
          >
            How it Works
          </motion.h2>
          <motion.p 
            className="section-subtitle"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
          >
            Three simple steps to get funded
          </motion.p>
          
          <motion.div 
            className="steps-grid"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
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
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
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
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
          >
            Choose Your Challenge
          </motion.h2>
          <motion.p 
            className="section-subtitle"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
          >
            Select your path to funded trading
          </motion.p>
          
          <motion.div 
            className="challenges-preview-grid"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
          >
            {challenges.map((challenge, index) => (
              <motion.div 
                key={index} 
                className={`challenge-preview-card ${challenge.popular ? 'popular' : ''} ${!challenge.available ? 'coming-soon' : ''}`}
                variants={scaleIn}
              >
                {challenge.popular && <span className="popular-badge">Popular</span>}
                <div className="challenge-size">{challenge.size}</div>
                <div className="challenge-price">{challenge.price}</div>
                <div className="challenge-specs">
                  <span>10% Profit Target</span>
                  <span>80% Profit Split</span>
                  <span>Up to 8x Leverage</span>
                </div>
                <button 
                  className={`challenge-btn ${challenge.available ? 'btn-primary' : 'btn-disabled'}`}
                  onClick={() => challenge.available && navigate('/waitlist')}
                  disabled={!challenge.available}
                >
                  {challenge.available ? 'Start Challenge' : 'Coming Soon'}
                </button>
              </motion.div>
            ))}
          </motion.div>
          
          <motion.button 
            className="btn-secondary learn-more-btn"
            onClick={() => navigate('/challenges')}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            View All Challenges
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.button>
        </div>
      </section>

      {/* Trusted by Traders Section */}
      <section className="trusted-section">
        <div className="section-container">
          <motion.div 
            className="trusted-content"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
          >
            <h2 className="section-title">Trusted by skilled traders worldwide</h2>
            <p className="section-subtitle">
              Join a growing community of traders who've chosen IJGF as their path to professional trading
            </p>
            
            <div className="trusted-stats">
              <div className="stat-item">
                <span className="stat-number">2,500+</span>
                <span className="stat-label">Traders on Waitlist</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">15+</span>
                <span className="stat-label">Countries</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">$500K+</span>
                <span className="stat-label">Capital Ready</span>
              </div>
            </div>

            <div className="trusted-avatars">
              <div className="avatar-stack">
                <div className="avatar-circle">👤</div>
                <div className="avatar-circle">👤</div>
                <div className="avatar-circle">👤</div>
                <div className="avatar-circle">👤</div>
                <div className="avatar-circle">👤</div>
              </div>
              <span className="avatar-text">Join 2,500+ traders on the waitlist</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq-section">
        <div className="section-container">
          <motion.h2 
            className="section-title"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
          >
            Frequently Asked Questions
          </motion.h2>
          <motion.p 
            className="section-subtitle"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
          >
            Everything you need to know about how the platform works, funding, payouts, and trading rules—clearly explained before you get started.
          </motion.p>
          
          <motion.div 
            className="faq-list"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
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
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
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
