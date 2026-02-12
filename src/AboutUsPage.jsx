function AboutUsPage() {
  return (
    <section className="about-page">
      <div className="section-container">
        {/* Hero Section */}
        <div className="about-hero">
          <h1 className="about-hero-title">Funding Talent,<br />Not Wallets</h1>
          <p className="about-hero-subtitle">
            We provide access to firm-backed crypto capital for disciplined traders who prove their edge through consistency and risk management.
          </p>
        </div>

        {/* Mission Section */}
        <div className="about-mission">
          <h2 className="about-section-title">Our Mission</h2>
          <div className="about-mission-content">
            <p>
              IJGF believes in funding talent, not wallets. We empower traders globally through transparent funding models, AI-driven evaluation, and community support. Our mission is to democratize access to trading capital and create opportunities for skilled traders everywhere. In the traditional financial world, capital is often a barrier to entry. We're changing that. By focusing on skill rather than personal wealth, we're building a new generation of successful traders who earn their way to the top through performance and dedication.
            </p>
          </div>
        </div>

        {/* Stats Section */}
        <div className="about-stats">
          <div className="about-stat">
            <span className="about-stat-value">2.5k+</span>
            <span className="about-stat-label">Funded Traders</span>
          </div>
          <div className="about-stat">
            <span className="about-stat-value">$1.5M+</span>
            <span className="about-stat-label">Total Payouts</span>
          </div>
          <div className="about-stat">
            <span className="about-stat-value">15</span>
            <span className="about-stat-label">Countries Served</span>
          </div>
        </div>

        {/* What We Do Section */}
        <div className="about-what-we-do">
          <h2 className="about-section-title">What We Do</h2>
          <p className="about-what-we-do-text">
            We operate a crypto prop trading platform that evaluates traders based on predefined risk and performance criteria. Traders who pass our evaluation gain access to real, firm-backed capital, trade live markets, and earn a majority share of the profits.
          </p>
        </div>

        {/* Features Grid */}
        <div className="about-features-grid">
          <div className="about-feature-card">
            <div className="about-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="4"/>
              </svg>
            </div>
            <h3>Transparency</h3>
            <p>Clear rules, honest evaluations, and complete visibility into our funding process.</p>
          </div>

          <div className="about-feature-card">
            <div className="about-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M9 9h6v6H9z"/>
              </svg>
            </div>
            <h3>Automation</h3>
            <p>AI-driven evaluation systems ensure fair, unbiased assessment of your trading skills.</p>
          </div>

          <div className="about-feature-card">
            <div className="about-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <h3>Funding</h3>
            <p>Access up to $100K in trading capital with industry-leading profit split ratios.</p>
          </div>

          <div className="about-feature-card">
            <div className="about-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h3>Community</h3>
            <p>Join a global network of traders sharing strategies, insights, and success stories.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AboutUsPage
