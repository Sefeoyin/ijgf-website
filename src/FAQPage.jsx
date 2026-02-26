import { useState } from 'react'

function FAQPage() {
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
      answer: "You keep up to 80% of the profits you generate. IJGF keeps 20%. This split applies to all funded accounts regardless of tier."
    },
    {
      question: "Are there time limits on challenges?",
      answer: "No. Unlike other platforms, IJGF has no time limits on evaluation challenges. Trade at your own pace and focus on executing your strategy properly without rushed decisions."
    },
    {
      question: "Is there a minimum number of trading days required?",
      answer: "Yes. To pass a challenge, you must trade on at least 5 distinct calendar days — even if you have already hit the profit target. This rule exists to ensure consistent, disciplined performance rather than a single lucky session. A trading day is counted any time you execute at least one trade on a given calendar day. The days do not need to be consecutive."
    },
    {
      question: "What is the maximum drawdown rule?",
      answer: "The maximum drawdown is 8% of your starting balance, calculated from the initial account value (static drawdown). If your account equity falls below this floor at any point — whether in an open position or after closing — your challenge is immediately failed. There is no daily drawdown limit."
    },
    {
      question: "Do I need to set a Stop Loss and Take Profit on every trade?",
      answer: "Yes. Every position must have both a Stop Loss and a Take Profit set before execution. Orders without these will be rejected by the platform. This is a core risk management requirement that protects both your account and firm capital."
    },
    {
      question: "Is IJGF regulated?",
      answer: "Yes. IJGF is pursuing VARA (Virtual Assets Regulatory Authority) licensing in Dubai, ensuring a secure, transparent, and compliant trading environment. We operate under a no-custody model, which carries the lightest regulatory burden while still providing full compliance protections."
    },
    {
      question: "What happens if I fail a challenge?",
      answer: "Failing a challenge means a rule breach (drawdown exceeded, prohibited strategy used, etc.). You can immediately start a new challenge. Each attempt is independent, and there are no limits on how many times you can retry. Many of the most successful traders failed multiple challenges before passing."
    },
    {
      question: "How do payouts work?",
      answer: "Once funded, your first payout is available after 14 days of trading. After that, payouts are available daily. Withdrawals are processed in USDC or USDT to your verified wallet address. There is no minimum withdrawal amount for funded accounts."
    }
  ]

  return (
    <section className="faq-page">
      <div className="section-container">
        <div className="faq-page-header">
          <h1 className="faq-page-title">Frequently Asked Questions</h1>
          <p className="faq-page-subtitle">
            Everything you need to know about how the platform works, funding, payouts, and trading rules - clearly explained before you get started.
          </p>
        </div>
        
        <div className="faq-list faq-page-list">
          {faqs.map((faq, index) => (
            <div key={index} className="faq-item">
              <button 
                className="faq-question"
                onClick={() => toggleFaq(index)}
              >
                {faq.question}
                <svg 
                  width="20" 
                  height="20" 
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
      </div>
    </section>
  )
}

export default FAQPage
