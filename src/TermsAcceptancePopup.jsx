import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function TermsAcceptancePopup() {
  const [showPopup, setShowPopup] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Check if user has already accepted terms
    const hasAcceptedTerms = localStorage.getItem('ijgf_terms_accepted')
    
    if (!hasAcceptedTerms) {
      // Show popup after a short delay
      const timer = setTimeout(() => {
        setShowPopup(true)
      }, 2000)
      
      return () => clearTimeout(timer)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem('ijgf_terms_accepted', 'true')
    localStorage.setItem('ijgf_terms_accepted_date', new Date().toISOString())
    setShowPopup(false)
  }

  const handleDecline = () => {
    // Redirect to a simple page explaining they can't use the service
    setShowPopup(false)
    alert('You must accept the Terms of Service and Privacy Policy to use IJGF.')
  }

  if (!showPopup) return null

  return (
    <>
      {/* Overlay */}
      <div className="terms-popup-overlay" onClick={(e) => e.stopPropagation()}>
        {/* Popup Container */}
        <div className="terms-popup-container">
          <div className="terms-popup-header">
            <h2>Welcome to IJGF</h2>
            <p>Please review and accept our terms to continue</p>
          </div>

          <div className="terms-popup-content">
            <p>
              By using IJGF's platform, you agree to our{' '}
              <button 
                className="terms-link" 
                onClick={() => {
                  navigate('/terms')
                  setShowPopup(false)
                }}
              >
                Terms of Service
              </button>
              {' '}and{' '}
              <button 
                className="terms-link" 
                onClick={() => {
                  navigate('/privacy')
                  setShowPopup(false)
                }}
              >
                Privacy Policy
              </button>.
            </p>

            <div className="terms-highlights">
              <h3>Key Points:</h3>
              <ul>
                <li>You must be 18 years or older to use our platform</li>
                <li>We use Stripe for secure payments and Supabase for data storage</li>
                <li>KYC verification is required for all users</li>
                <li>Trading involves risk - never invest more than you can afford to lose</li>
                <li>We collect and protect your personal data as outlined in our Privacy Policy</li>
              </ul>
            </div>
          </div>

          <div className="terms-popup-actions">
            <button className="btn-decline" onClick={handleDecline}>
              Decline
            </button>
            <button className="btn-accept" onClick={handleAccept}>
              I Accept
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default TermsAcceptancePopup
