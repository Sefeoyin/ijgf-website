import { useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useTheme } from './App'

function Navigation() {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'About us', path: '/about' },
    { name: 'How it Works', path: '/how-it-works' },
    { name: 'Challenges', path: '/challenges' },
    { name: 'Leaderboard', path: '/leaderboard', disabled: true },
  ]

  const handleNavClick = (path, disabled) => {
    if (!disabled) {
      navigate(path)
      setMobileMenuOpen(false)
    }
  }

  return (
    <nav className="nav">
      <div className="nav-container">
        {/* Logo */}
        <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <img src="/images/logo.png" alt="IJGF" className="logo-img" />
        </div>

        {/* Desktop Nav Links - Centered */}
        <div className="nav-links-desktop">
          {navLinks.map((link) => (
            <button
              key={link.name}
              className={`nav-link ${location.pathname === link.path ? 'active' : ''} ${link.disabled ? 'disabled' : ''}`}
              onClick={() => handleNavClick(link.path, link.disabled)}
              disabled={link.disabled}
            >
              {link.name}
              {link.disabled && <span className="coming-soon-badge">Soon</span>}
            </button>
          ))}
        </div>

        {/* Right Side - Get Started + Theme Toggle */}
        <div className="nav-right">
          <button className="get-started-btn" onClick={() => navigate('/waitlist')}>
            Get Started
          </button>
          <button 
            className="theme-toggle" 
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'night' ? 'light' : 'dark'} mode`}
          >
            {theme === 'night' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>

          {/* Mobile Menu Button */}
          <button 
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu">
          <div className="mobile-menu-links">
            {navLinks.map((link) => (
              <button
                key={link.name}
                className={`mobile-nav-link ${location.pathname === link.path ? 'active' : ''} ${link.disabled ? 'disabled' : ''}`}
                onClick={() => handleNavClick(link.path, link.disabled)}
                disabled={link.disabled}
              >
                {link.name}
                {link.disabled && <span className="coming-soon-badge">Soon</span>}
              </button>
            ))}
          </div>
          <div className="mobile-menu-actions">
            <button className="get-started-btn mobile" onClick={() => { navigate('/waitlist'); setMobileMenuOpen(false); }}>
              Get Started
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navigation
