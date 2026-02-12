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
          <img 
            src="/images/logo-icon.png" 
            alt="IJGF Logo" 
            className="logo-img"
          />
        </div>

        {/* Desktop Navigation Links */}
        <div className="nav-links">
          {navLinks.map((link) => (
            <a
              key={link.path}
              className={`nav-link ${isActive(link.path) ? 'active' : ''} ${link.disabled ? 'disabled' : ''}`}
              onClick={() => handleNavClick(link.path, link.disabled)}
            >
              {link.name}
            </a>
          ))}
        </div>

        {/* Right Side: Theme Toggle + CTA */}
        <div className="nav-right">
          {/* Theme Toggle */}
          <button 
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === 'night' ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
              </svg>
            )}
          </button>

          {/* Get Started Button */}
          <button className="nav-cta-btn" onClick={() => navigate('/waitlist')}>
            Get Started
          </button>

          {/* Mobile Menu Button */}
          <button 
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
