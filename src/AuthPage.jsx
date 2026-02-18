import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from './supabase'

function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isLogin = location.pathname === '/login'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [termsChecked, setTermsChecked] = useState(false)
  const [pendingAction, setPendingAction] = useState(null) // 'email' | 'google'

  // The actual signup actions, called after terms accepted
  const doEmailSignup = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password: password,
        options: {
          emailRedirectTo: `${window.location.origin}/profile-setup`,
        }
      })
      if (error) throw error
      if (data?.user) navigate('/profile-setup')
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const doGoogleSignup = async () => {
    try {
      const siteUrl = import.meta.env.VITE_SITE_URL || 'https://ijgf-website.vercel.app'
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${siteUrl}/auth/callback`,
          skipBrowserRedirect: false,
          queryParams: { access_type: 'offline', prompt: 'consent' }
        }
      })
      if (error) throw error
    } catch (err) {
      setError(err.message || 'Failed to sign in with Google')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.toLowerCase().trim(),
          password: password,
        })
        if (error) throw error

        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', data.user.id)
          .single()

        if (!profile?.first_name || !profile?.last_name) {
          navigate('/profile-setup')
        } else {
          navigate('/dashboard')
        }
        return
      }

      // Signup: show terms first
      setLoading(false)
      setPendingAction('email')
      setTermsChecked(false)
      setShowTermsModal(true)
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.')
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    if (!isLogin) {
      // Signup: show terms first
      setPendingAction('google')
      setTermsChecked(false)
      setShowTermsModal(true)
      return
    }
    // Login: go straight to OAuth
    try {
      const siteUrl = import.meta.env.VITE_SITE_URL || 'https://ijgf-website.vercel.app'
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${siteUrl}/auth/callback`,
          skipBrowserRedirect: false,
          queryParams: { access_type: 'offline', prompt: 'consent' }
        }
      })
      if (error) throw error
    } catch (err) {
      setError(err.message || 'Failed to sign in with Google')
    }
  }

  const handleAcceptTerms = async () => {
    setShowTermsModal(false)
    localStorage.setItem('ijgf_terms_accepted', 'true')
    localStorage.setItem('ijgf_terms_accepted_date', new Date().toISOString())
    if (pendingAction === 'email') await doEmailSignup()
    if (pendingAction === 'google') await doGoogleSignup()
    setPendingAction(null)
  }

  const handleDeclineTerms = () => {
    setShowTermsModal(false)
    setPendingAction(null)
    setError('You must accept our Terms of Service and Privacy Policy to create an account.')
  }

  return (
    <>
      {/* Terms Acceptance Modal */}
      {showTermsModal && (
        <div className="terms-modal-overlay">
          <div className="terms-modal">
            <div className="terms-modal-header">
              <img src="/images/logo-icon.png" alt="IJGF" className="terms-modal-logo" />
              <h2>Before you continue</h2>
              <p>Please review and accept our terms to create your IJGF account.</p>
            </div>
            <div className="terms-modal-body">
              <ul className="terms-modal-list">
                <li>You must be <strong>18 years or older</strong> to use our platform</li>
                <li>Trading involves risk — only trade with what you can afford to lose</li>
                <li>KYC verification is required for funded accounts and payouts</li>
                <li>We use Stripe for payments and Supabase for secure data storage</li>
                <li>Your personal data is handled as outlined in our Privacy Policy</li>
              </ul>
              <p className="terms-modal-links">
                By accepting, you agree to our{' '}
                <button className="terms-text-link" onClick={() => { navigate('/terms'); setShowTermsModal(false) }}>Terms of Service</button>
                {' '}and{' '}
                <button className="terms-text-link" onClick={() => { navigate('/privacy'); setShowTermsModal(false) }}>Privacy Policy</button>.
              </p>
              <label className="terms-modal-checkbox">
                <input
                  type="checkbox"
                  checked={termsChecked}
                  onChange={e => setTermsChecked(e.target.checked)}
                />
                <span>I have read and agree to the Terms of Service and Privacy Policy</span>
              </label>
            </div>
            <div className="terms-modal-actions">
              <button className="terms-decline-btn" onClick={handleDeclineTerms}>Decline</button>
              <button
                className="terms-accept-btn"
                onClick={handleAcceptTerms}
                disabled={!termsChecked}
                style={{ opacity: termsChecked ? 1 : 0.45, cursor: termsChecked ? 'pointer' : 'not-allowed' }}
              >Accept &amp; Continue</button>
            </div>
          </div>
        </div>
      )}

      <section className="auth-page-new">
        <div className="auth-logo-header">
          <a href="/" className="auth-logo-link">
            <img src="/images/logo-icon.png" alt="IJGF" className="auth-logo-icon" />
          </a>
        </div>

        <div className="auth-container-new">
          {/* Tab Toggle */}
          <div className="auth-toggle-new">
            <button
              className={`auth-toggle-btn-new ${!isLogin ? 'active' : ''}`}
              onClick={() => navigate('/signup')}
            >
              Sign Up
            </button>
            <button
              className={`auth-toggle-btn-new ${isLogin ? 'active' : ''}`}
              onClick={() => navigate('/login')}
            >
              Log in
            </button>
          </div>

          {/* Header */}
          <div className="auth-header-new">
            <h1 className="auth-title-new">
              {isLogin ? 'Welcome Back' : 'Create Your Account'}
            </h1>
            <p className="auth-subtitle-new">
              {isLogin
                ? 'Log in to manage your challenges and funded accounts.'
                : 'Start your trading challenge in minutes.'
              }
            </p>
          </div>

          {error && (
            <div className="auth-error-message">{error}</div>
          )}

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

            <div className="auth-input-group-new">
              <input
                type="password"
                placeholder="Password"
                className="auth-input-new"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            </div>

            {!isLogin && (
              <div className="auth-input-group-new">
                <input
                  type="password"
                  placeholder="Confirm Password"
                  className="auth-input-new"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                />
              </div>
            )}

            <button type="submit" className="auth-submit-btn-new" disabled={loading}>
              {loading ? 'Please wait...' : (isLogin ? 'Log in' : 'Create Account')}
            </button>
          </form>

          <div className="auth-divider-new">
            <span>Or</span>
          </div>

          <button className="auth-google-btn-new" onClick={handleGoogleSignIn} disabled={loading}>
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {isLogin ? 'Sign in with Google' : 'Sign up with Google'}
          </button>

          <p className="auth-footer-text-new">
            {isLogin ? (
              <>Don&apos;t have an account? <a onClick={() => navigate('/signup')} style={{ cursor: 'pointer' }}>Get Started</a></>
            ) : (
              <>Already have an account? <a onClick={() => navigate('/login')} style={{ cursor: 'pointer' }}>Log in</a></>
            )}
          </p>
        </div>
      </section>
    </>
  )
}

export default AuthPage