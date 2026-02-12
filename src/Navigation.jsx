import { useNavigate, useLocation } from 'react-router-dom'
import { useContext, useState } from 'react'
import { ThemeContext } from './App'

function Navigation() {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, toggleTheme } = useContext(ThemeContext)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'About us', path: '/about' },
    { name: 'How it Works', path: '/how-it-works' },
    { name: 'Challenges', path: '/challenges' },
    { name: 'Leaderboard', path: '/leaderboard', disabled: true },
  ]

  const isActive = (path) => location.pathname === path

  const handleNavClick = (path, disabled) => {
    if (disabled) return
    navigate(path)
    setMobileMenuOpen(false)
  }

  return (
    <nav className="nav">
      <div className="nav-container">
        {/* Logo */}
        <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <img src="/images/logo-icon.png" alt="IJGF" className="logo-img" />
        </div>

        {/* Desktop Navigation Links - Centered */}
        <div className="nav-links-desktop">
          {navLinks.map((link) => (
            <a
              key={link.path}
              className={`nav-link ${isActive(link.path) ? 'active' : ''} ${link.disabled ? 'disabled' : ''}`}
              onClick={() => handleNavClick(link.path, link.disabled)}
            >
              {link.name}
              {link.disabled && <span className="soon-badge">Soon</span>}
            </a>
          ))}
        </div>

        {/* Right Side: CTA + Theme Toggle */}
        <div className="nav-right">
          {/* Get Started Button */}
          <button className="nav-cta-btn" onClick={() => navigate('/waitlist')}>
            Get Started
          </button>

          {/* Theme Toggle - After Get Started, no frame */}
          <button 
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label="Toggle theme"
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
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
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu">
          {navLinks.map((link) => (
            <a
              key={link.path}
              className={`mobile-nav-link ${isActive(link.path) ? 'active' : ''} ${link.disabled ? 'disabled' : ''}`}
              onClick={() => handleNavClick(link.path, link.disabled)}
            >
              {link.name}
              {link.disabled && <span className="soon-badge-mobile">Soon</span>}
            </a>
          ))}
          <button 
            className="mobile-cta-btn" 
            onClick={() => { navigate('/waitlist'); setMobileMenuOpen(false); }}
          >
            Get Started
          </button>
        </div>
      )}
    </nav>
  )
}

export default Navigation
