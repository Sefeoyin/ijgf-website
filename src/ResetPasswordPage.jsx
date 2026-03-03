import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { ThemeContext } from './ThemeContext'

const validatePassword = (pwd) => ({
  length:    pwd.length >= 8 && pwd.length <= 30,
  uppercase: /[A-Z]/.test(pwd),
  number:    /[0-9]/.test(pwd),
  symbol:    /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(pwd),
})

function ResetPasswordPage() {
  const navigate = useNavigate()
  const { theme } = useContext(ThemeContext)
  const dark = theme === 'night'

  const toggleColor      = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)'
  const checklistBg      = dark ? 'rgba(13,15,20,0.98)'    : '#ffffff'
  const checklistBorder  = 'rgba(124,58,237,0.3)'
  const checkUnmetCircle = dark ? 'rgba(255,255,255,0.2)'  : 'rgba(0,0,0,0.18)'
  const checkUnmetLabel  = dark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.4)'
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)

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

    const pwdCheck = validatePassword(password)
    if (!pwdCheck.length) {
      setError('Password must be between 8 and 30 characters')
      return
    }
    if (!pwdCheck.uppercase) {
      setError('Password must contain at least one uppercase letter')
      return
    }
    if (!pwdCheck.number) {
      setError('Password must contain at least one number')
      return
    }
    if (!pwdCheck.symbol) {
      setError('Password must contain at least one special character')
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
            <div className="auth-input-group-new" style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="New Password"
                className="auth-input-new"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setTimeout(() => setPasswordFocused(false), 150)}
                required
                disabled={loading}
                maxLength={30}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                disabled={loading}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  color: toggleColor, lineHeight: 1,
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
              {passwordFocused && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                  background: checklistBg, border: `1px solid ${checklistBorder}`,
                  borderRadius: 10, padding: '12px 14px', zIndex: 20,
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  {[
                    { key: 'length',    label: '8–30 characters' },
                    { key: 'uppercase', label: 'One uppercase letter' },
                    { key: 'number',    label: 'One number' },
                    { key: 'symbol',    label: 'One special character' },
                  ].map(({ key, label }) => {
                    const met = validatePassword(password)[key]
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          {met
                            ? <><circle cx="8" cy="8" r="8" fill="rgba(34,197,94,0.2)"/><path d="M5 8l2 2 4-4" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></>
                            : <circle cx="8" cy="8" r="7" stroke={checkUnmetCircle} strokeWidth="1.5"/>
                          }
                        </svg>
                        <span style={{ color: met ? '#22c55e' : checkUnmetLabel }}>{label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="auth-input-group-new" style={{ position: 'relative' }}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm New Password"
                className="auth-input-new"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                maxLength={30}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(v => !v)}
                disabled={loading}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  color: toggleColor, lineHeight: 1,
                }}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
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
