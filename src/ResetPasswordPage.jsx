import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'

function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  // Supabase appends type=recovery to the URL hash when the user
  // arrives via the forgot password email link. If absent, the user
  // navigated here from inside the dashboard (in-app change password).
  const isRecoveryFlow = window.location.hash.includes('type=recovery')

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        setSessionReady(true)
      } else {
        setError('This reset link is invalid or has expired. Please request a new one.')
      }
    }

    checkSession()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) throw error

      setSuccess(true)

      if (isRecoveryFlow) {
        // User came from the forgot password email — sign out and send to login
        await supabase.auth.signOut()
        setTimeout(() => navigate('/login'), 3000)
      } else {
        // User came from dashboard settings — keep them logged in
        setTimeout(() => navigate('/dashboard'), 2000)
      }
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
        </a>
      </div>

      <div className="auth-container-new">
        <div className="auth-header-new">
          <h1 className="auth-title-new">
            {isRecoveryFlow ? 'Set New Password' : 'Change Password'}
          </h1>
          <p className="auth-subtitle-new">
            {success
              ? isRecoveryFlow
                ? 'Password updated. Redirecting you to log in...'
                : 'Password updated. Redirecting to dashboard...'
              : 'Choose a strong password for your account.'}
          </p>
        </div>

        {error && (
          <div className="auth-error-message">
            {error}
          </div>
        )}

        {success ? (
          <div className="auth-success-message">
            &#10003; {isRecoveryFlow
              ? 'Password updated successfully. Redirecting...'
              : 'Password changed successfully. Redirecting to dashboard...'}
          </div>
        ) : sessionReady ? (
          <form className="auth-form-new" onSubmit={handleSubmit}>
            <div className="auth-input-group-new">
              <input
                type="password"
                placeholder="New Password"
                className="auth-input-new"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
        ) : !error ? (
          <p className="auth-subtitle-new">Verifying your session...</p>
        ) : null}

        <p className="auth-footer-text-new">
          {isRecoveryFlow ? (
            <a onClick={() => navigate('/login')} style={{ cursor: 'pointer' }}>
              Back to Log in
            </a>
          ) : (
            <a onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
              &larr; Back to Dashboard
            </a>
          )}
        </p>
      </div>
    </section>
  )
}

export default ResetPasswordPage
