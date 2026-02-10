import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'

function ShareStoryPage() {
  const [story, setStory] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error: supabaseError } = await supabase
        .from('Stories')
        .insert([
          { story: story.trim() }
        ])
        .select()

      if (supabaseError) {
        throw supabaseError
      }

      setSubmitted(true)
      setStory('')
      
      // Redirect to waitlist after 2 seconds
      setTimeout(() => {
        navigate('/waitlist')
      }, 2000)

    } catch (err) {
      console.error('Error saving story:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="share-story-page">
      <div className="section-container">
        <div className="share-story-container">
          <div className="share-story-icon">
            <img src="/images/logo.png" alt="IJGF" style={{width: '100%', height: '100%', objectFit: 'contain'}} />
          </div>

          <div className="share-story-content">
            <div className="share-story-form-section">
              <h1 className="share-story-title">Share your story</h1>
              <p className="share-story-description">
                What's your trading journey been like? What would access to funding change for you?
              </p>

              {submitted && (
                <div className="success-message">
                  ✓ Thank you for sharing! Redirecting...
                </div>
              )}

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <textarea
                  className="story-textarea"
                  placeholder="I've been trading for 3 years, consistently profitable, but I've never had more than $500 to trade with. If I had real capital, I could finally..."
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                  required
                  disabled={loading}
                  rows="8"
                />
                <button type="submit" className="btn-primary share-submit-btn" disabled={loading}>
                  {loading ? 'Submitting...' : 'Share Story'}
                </button>
              </form>
            </div>

            <div className="divider-line"></div>

            <div className="why-share-section">
              <h2 className="why-share-title">Why share?</h2>
              <p className="why-share-intro">
                Traders who share a genuine story will be considered for:
              </p>
              <ul className="why-share-list">
                <li>
                  <strong>Priority Access</strong> — Be among the first to get funded when we launch
                </li>
                <li>
                  <strong>Founding Trader Recognition</strong> — Early believers get remembered
                </li>
                <li>
                  <strong>Potential Fee Discounts</strong>
                </li>
              </ul>
              <p className="why-share-footer">
                We reward those who helped us build this
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ShareStoryPage