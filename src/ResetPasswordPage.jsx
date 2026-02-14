import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'

function ResetPasswordPage() {
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      setSuccess(true)

      setTimeout(() => {
        navigate('/dashboard')
      }, 2000)
    } catch (err) {
      setError(err.message || 'Failed to update password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="auth-page-new">
      <div className="auth-logo-header">
        <a href="/" className="auth-logo-link">
          <img src="/images/logo-icon.png" alt="IJGF" className="auth-logo-icon" />
          <span className="auth-logo-text">IJGF</span>
        </a>
      </div>

      <div className="auth-container-new">
        <div className="auth-header-new">
          <h1 className="auth-title-new">Reset Password</h1>
          <p className="auth-subtitle-new">Enter your new password below.</p>
        </div>

        {success && (
          <div className="success-message">
            &#10003; Password updated! Redirecting to dashboard...
          </div>
        )}

        {error && (
          <div className="auth-error-message">
            {error}
          </div>
        )}

        {!success && (
          <form className="auth-form-new" onSubmit={handleSubmit}>
            <div className="auth-input-group-new">
              <input
                type="password"
                placeholder="New Password"
                className="auth-input-new"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            </div>

            <div className="auth-input-group-new">
              <input
                type="password"
                placeholder="Confirm New Password"
                className="auth-input-new"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            </div>

            <button type="submit" className="auth-submit-btn-new" disabled={loading}>
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}

        <p className="auth-footer-text-new">
          <a onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
            &larr; Back to Dashboard
          </a>
        </p>
      </div>
    </section>
  )
}

export default ResetPasswordPage
