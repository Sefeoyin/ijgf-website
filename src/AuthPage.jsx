import { useState, useContext } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from './supabase'
import { ThemeContext } from './ThemeContext'

// Password rules — must match Supabase auth settings
const validatePassword = (pwd) => ({
  length:    pwd.length >= 8 && pwd.length <= 30,
  uppercase: /[A-Z]/.test(pwd),
  number:    /[0-9]/.test(pwd),
  symbol:    /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(pwd),
})

function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isLogin = location.pathname === '/login'
  const { theme } = useContext(ThemeContext)
  const dark = theme === 'night'

  // Theme-aware tokens for inline styles
  const toggleColor      = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)'
  const checklistBg     = dark ? 'rgba(13,15,20,0.98)'    : '#ffffff'
  const checklistBorder = 'rgba(124,58,237,0.3)'
  const checkUnmetCircle = dark ? 'rgba(255,255,255,0.2)'  : 'rgba(0,0,0,0.18)'
  const checkUnmetLabel  = dark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.4)'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!isLogin) {
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
    } else {
      // Login: keep the minimal check so existing short passwords still work
      if (password.length < 6) {
        setError('Password must be at least 6 characters')
        return
      }
    }

    setLoading(true)

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.toLowerCase().trim(),
          password: password,
        })

        if (error) throw error

        // Check if user has completed profile setup
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', data.user.id)
          .single()

        if (profileError) {
          console.error('Error fetching profile:', profileError)
        }

        if (!profile?.first_name || !profile?.last_name) {
          navigate('/profile-setup')
        } else {
          navigate('/dashboard')
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.toLowerCase().trim(),
          password: password,
          options: {
            emailRedirectTo: `${window.location.origin}/profile-setup`,
          }
        })

        if (error) throw error

        if (data?.user) {
          navigate('/profile-setup')
        }
      }
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      const siteUrl = import.meta.env.VITE_SITE_URL || 'https://ijgf-website-one.vercel.app'
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${siteUrl}/auth/callback`,
          skipBrowserRedirect: false,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      })

      if (error) throw error
    } catch (err) {
      setError(err.message || 'Failed to sign in with Google')
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
          <div className="auth-error-message">
            {error}
          </div>
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

          <div className="auth-input-group-new" style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
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
                color: toggleColor, lineHeight: 1, fontSize: 18,
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
            {/* Real-time password checklist — signup only, visible while focused */}
            {!isLogin && passwordFocused && (
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

          {!isLogin && (
            <div className="auth-input-group-new" style={{ position: 'relative' }}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm Password"
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
          )}

          {isLogin && (
            <div className="auth-forgot-password">
              <a onClick={() => navigate('/forgot-password')} style={{ cursor: 'pointer' }}>
                Forgot password?
              </a>
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
          Sign in with Google
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
  )
}

export default AuthPage