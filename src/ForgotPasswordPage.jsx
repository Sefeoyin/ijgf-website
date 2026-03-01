import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'

function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.toLowerCase().trim(),
        {
          redirectTo: `${siteUrl}/reset-password`,
        }
      )

      if (error) throw error

      setSent(true)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="auth-page-new">
      <div className="auth-logo-header">
        <a href="/" className="auth-logo-link">
          <img src="/images/logo-icon.png" alt="IJGF" className="auth-logo-icon" />
        </a>
      </div>

      <div className="auth-container-new">
        <div className="auth-header-new">
          <h1 className="auth-title-new">Reset Password</h1>
          <p className="auth-subtitle-new">
            {sent
              ? 'Check your inbox for a link to reset your password.'
              : "Enter the email address linked to your account and we'll send you a reset link."}
          </p>
        </div>

        {error && (
          <div className="auth-error-message">
            {error}
          </div>
        )}

        {sent ? (
          <div className="auth-success-message">
            Reset link sent. Please check your email.
          </div>
        ) : (
          <form className="auth-form-new" onSubmit={handleSubmit}>
            <div className="auth-input-group-new">
              <input
                type="email"
                placeholder="Your Email"
                className="auth-input-new"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <button type="submit" className="auth-submit-btn-new" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <p className="auth-footer-text-new">
          <a onClick={() => navigate('/login')} style={{ cursor: 'pointer' }}>
            Back to Log in
          </a>
        </p>
      </div>
    </section>
  )
}

export default ForgotPasswordPage
