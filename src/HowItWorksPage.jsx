import { useState } from 'react'

function HowItWorksPage() {
  const [openRule, setOpenRule] = useState(null)

  const toggleRule = (index) => {
    setOpenRule(openRule === index ? null : index)
  }

  const rules = [
    {
      title: "Profit Targets",
      content: "Achieve a 10% profit target on your challenge account to pass the evaluation. There's no time limit — trade at your own pace while managing risk effectively."
    },
    {
      title: "Minimum Trading Days",
      content: "You must trade on at least 5 distinct calendar days before a challenge can be marked as passed. This rule applies even if the profit target is already met. It promotes consistent, disciplined trading over single-session lucky runs. A trading day counts any calendar day on which at least one trade is executed — the days do not need to be consecutive."
    },
    {
      title: "No Daily Loss Limit",
      content: "IJGF does not impose a daily loss limit. You can trade freely throughout the day without being locked out by a per-day cap. Only the overall maximum drawdown applies."
    },
    {
      title: "Maximum Drawdown",
      content: "The maximum drawdown is 8% (static) from your starting balance. This is your hard floor — if your account equity drops below this level at any point, your challenge is immediately failed."
    },
    {
      title: "Leverage Limits",
      content: "Maximum leverage is 100x on all instruments — BTC, ETH, and all altcoins. This is consistent across every challenge tier. Use leverage responsibly as it amplifies both gains and losses."
    },
    {
      title: "Payout Structure",
      content: "Once funded, you keep 80% of all profits. First payout is available after 14 days of funded trading, then daily payouts are available in USDC or USDT."
    }
  ]

  return (
    <section className="how-it-works-page">
      <div className="section-container">
        {/* Header */}
        <div className="how-page-header">
          <h1 className="how-page-title">How it works</h1>
          <p className="how-page-subtitle">
            A clear, step-by-step path from evaluation to trading with firm-backed capital.
          </p>
        </div>

        {/* Step Cards */}
        <div className="how-steps-grid">
          <div className="how-step-card">
            <span className="how-step-number">1</span>
            <span className="how-step-label">Step 1</span>
            <h3>Choose Challenge</h3>
            <p>Select a funding level that fits your trading style and risk appetite</p>
          </div>
          
          <div className="how-step-card">
            <span className="how-step-number">2</span>
            <span className="how-step-label">Step 2</span>
            <h3>Pass Evaluation</h3>
            <p>Demonstrate consistency, discipline, and risk control under real market conditions.</p>
          </div>
          
          <div className="how-step-card">
            <span className="how-step-number">3</span>
            <span className="how-step-label">Step 3</span>
            <h3>Get Funded</h3>
            <p>Trade with firm-backed capital and earn your share of the profits.</p>
          </div>
        </div>

        {/* Step by Step Process & Know Your Rules */}
        <div className="how-details-grid">
          {/* Left: Step by Step Process */}
          <div className="how-process-section">
            <h2 className="how-section-title">Step - by - Step Process</h2>
            <ol className="how-process-list">
              <li><span>1.</span> Sign Up  —  Create your account</li>
              <li><span>2.</span> Choose Challenge  —  Pick account size ($5K–$100K)</li>
              <li><span>3.</span> Complete Evaluation  —  Hit the 10% profit target, stay within 8% max drawdown, and trade on at least 5 distinct calendar days</li>
              <li><span>4.</span> Select Exchange  —  Choose your preferred exchange (Binance, Bybit, OKX, Bitget, etc.)</li>
              <li><span>5.</span> Get Funded  —  Trade real capital with up to 80% profit split</li>
              <li><span>6.</span> Withdraw Profits  —  On-demand payouts in USDC or USDT</li>
            </ol>
          </div>

          {/* Right: Know Your Rules */}
          <div className="how-rules-section">
            <h2 className="how-section-title">Know Your Rules</h2>
            <div className="how-rules-list">
              {rules.map((rule, index) => (
                <div key={index} className="how-rule-item">
                  <button 
                    className="how-rule-question"
                    onClick={() => toggleRule(index)}
                  >
                    {rule.title}
                    <svg 
                      width="20" 
                      height="20" 
                      viewBox="0 0 20 20" 
                      fill="none"
                      className={openRule === index ? 'rotated' : ''}
                    >
                      <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {openRule === index && (
                    <div className="how-rule-answer">
                      {rule.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HowItWorksPage
