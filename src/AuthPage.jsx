import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isLogin = location.pathname === '/login'
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    
    // For now, just redirect to waitlist since auth isn't implemented yet
    setTimeout(() => {
      setLoading(false)
      navigate('/waitlist')
    }, 1000)
  }

  const handleGoogleSignIn = () => {
    // Placeholder for Google OAuth
    navigate('/waitlist')
  }

  return (
    <section className="auth-page">
      <div className="auth-container">
        {/* Tab Toggle */}
        <div className="auth-toggle">
          <button 
            className={`auth-toggle-btn ${!isLogin ? 'active' : ''}`}
            onClick={() => navigate('/signup')}
          >
            Sign Up
          </button>
          <button 
            className={`auth-toggle-btn ${isLogin ? 'active' : ''}`}
            onClick={() => navigate('/login')}
          >
            Log in
          </button>
        </div>

        {/* Header */}
        <div className="auth-header">
          <h1 className="auth-title">
            {isLogin ? 'Welcome Back' : 'Create Your Account'}
          </h1>
          <p className="auth-subtitle">
            {isLogin 
              ? 'Log in to manage your challenges and funded accounts.'
              : 'Start your trading challenge in minutes.'
            }
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <input
              type="email"
              placeholder="Your Email"
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="auth-input-group">
            <input
              type="password"
              placeholder="Password"
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {!isLogin && (
            <div className="auth-input-group">
              <input
                type="password"
                placeholder="Confirm Password"
                className="auth-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          )}

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? 'Please wait...' : (isLogin ? 'Log in' : 'Create Account')}
          </button>
        </form>

        {/* Divider - Only for Sign Up */}
        {!isLogin && (
          <>
            <div className="auth-divider">
              <span>Or</span>
            </div>

            <button className="auth-google-btn" onClick={handleGoogleSignIn}>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </button>
          </>
        )}

        {/* Footer Link */}
        <p className="auth-footer-text">
          {isLogin ? (
            <>Don't have an account? <a onClick={() => navigate('/signup')}>Get Started</a></>
          ) : (
            <>Already have an account? <a onClick={() => navigate('/login')}>Log in</a></>
          )}
        </p>
      </div>
    </section>
  )
}

export default AuthPage
