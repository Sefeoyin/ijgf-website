import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useScrollAnimation } from './useScrollAnimation'

function ChallengesPage() {
  const navigate = useNavigate()
  const [challengeType, setChallengeType] = useState('1-step')
  const [expandedChallenge, setExpandedChallenge] = useState(null)
  useScrollAnimation()

  const toggleChallengeDetails = (index) => {
    setExpandedChallenge(expandedChallenge === index ? null : index)
  }

  const challenges = [
    {
      name: "The $5k Challenge",
      price: "$49",
      profitTarget: "$500",
      maxDrawdown: "$500",
      dailyLimit: "$200",
      duration: "30 Days",
      available: true,
      popular: false,
      features: ["Real-time evaluation", "24/7 support", "Unlimited retakes", "Fast approval process"]
    },
    {
      name: "The $10k Challenge",
      price: "$99",
      profitTarget: "$1,000",
      maxDrawdown: "$750",
      dailyLimit: "$400",
      duration: "45 Days",
      available: true,
      popular: true,
      features: ["Real-time evaluation", "24/7 support", "Unlimited retakes", "Fast approval process", "Priority review"]
    },
    {
      name: "The $25k Challenge",
      price: "$249",
      profitTarget: "$2,500",
      maxDrawdown: "$1,500",
      dailyLimit: "$1,000",
      duration: "30 Days",
      available: false,
      popular: false,
      features: ["Real-time evaluation", "24/7 support", "Unlimited retakes", "Fast approval process", "Priority review", "Account Manager"]
    },
    {
      name: "The $50k Challenge",
      price: "$499",
      profitTarget: "$5,000",
      maxDrawdown: "$3,000",
      dailyLimit: "$2,000",
      duration: "30 Days",
      available: false,
      popular: false,
      features: ["Real-time evaluation", "24/7 support", "Unlimited retakes", "Fast approval process", "Priority review", "Account Manager"]
    },
    {
      name: "The $100k Challenge",
      price: "$999",
      profitTarget: "$10,000",
      maxDrawdown: "$6,000",
      dailyLimit: "$4,000",
      duration: "30 Days",
      available: false,
      popular: false,
      features: ["Real-time evaluation", "24/7 support", "Unlimited retakes", "Fast approval process", "Priority review", "Account Manager"]
    }
  ]

  return (
    <section className="challenges-page">
      <div className="section-container">
        {/* Header */}
        <div className="challenges-header">
          <h1 className="challenges-title">Choose Your Challenge</h1>
          <p className="challenges-subtitle">
            Choose your path to becoming a funded trader. All challenges include the same core evaluation metrics with varying capital sizes.
          </p>
        </div>

        {/* Challenge Type Toggle */}
        <div className="challenges-toggle">
          <button
            className={`toggle-btn ${challengeType === '1-step' ? 'active' : ''}`}
            onClick={() => setChallengeType('1-step')}
          >
            1-step challenge
          </button>
          <button
            className={`toggle-btn ${challengeType === '2-step' ? 'active' : ''}`}
            onClick={() => setChallengeType('2-step')}
          >
            2-step challenge
          </button>
        </div>

        {/* Pricing Cards — same structure as homepage challenge section */}
        <div className="challenges-preview-grid">
          {challenges.map((challenge, index) => (
            <div
              key={index}
              className={`challenge-preview-card ${!challenge.available ? 'disabled' : ''} ${challenge.popular ? 'popular' : ''}`}
            >
              {challenge.popular && <span className="popular-badge">Popular</span>}

              <h3 className="challenge-preview-name">{challenge.name}</h3>

              <div className="challenge-preview-price">
                <span className="price">{challenge.price}</span>
                <span className="price-period">One time</span>
              </div>

              <div className="challenge-preview-specs">
                <div className="spec-row">
                  <span className="spec-label">Profit Target</span>
                  <span className="spec-value">{challenge.profitTarget}</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Max Drawdown</span>
                  <span className="spec-value">{challenge.maxDrawdown}</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Daily Limit</span>
                  <span className="spec-value">{challenge.dailyLimit}</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Duration</span>
                  <span className="spec-value">{challenge.duration}</span>
                </div>
              </div>

              <button
                className={`challenge-preview-btn ${challenge.available ? 'btn-primary' : 'btn-coming-soon'}`}
                onClick={() => challenge.available && navigate('/waitlist')}
                disabled={!challenge.available}
              >
                {challenge.available ? 'Start Challenge' : 'Coming Soon'}
              </button>

              <button
                className={`challenge-details-toggle ${expandedChallenge === index ? 'expanded' : ''}`}
                onClick={() => challenge.available && toggleChallengeDetails(index)}
                disabled={!challenge.available}
              >
                More Details
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              <ul className={`challenge-preview-features ${expandedChallenge === index ? 'expanded' : ''}`}>
                {challenge.features.map((feature, fIndex) => (
                  <li key={fIndex}>&#10003; {feature}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default ChallengesPage