import { useNavigate } from 'react-router-dom'
import { useContext } from 'react'
import { ThemeContext } from './App'

function Navigation() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useContext(ThemeContext)

  return (
    <nav className="nav">
      <div className="nav-container">
        <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <img src="/images/logo.png" alt="IJGF" className="logo-img" />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Modern Sliding Toggle */}
          <div 
            className="theme-toggle-wrapper" 
            onClick={toggleTheme}
            role="button"
            aria-label="Toggle theme"
            tabIndex="0"
          >
            <div className={`theme-toggle-track ${theme === 'day' ? 'day-active' : ''}`}>
              <div className="theme-toggle-slider">
                <div className="theme-icon">
                  {theme === 'night' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="12" r="4"/>
                      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                    </svg>
                  )}
                </div>
              </div>
              <div className="theme-toggle-icons">
                <svg className="sun-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="4"/>
                  <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                </svg>
                <svg className="moon-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              </div>
            </div>
          </div>
          
          <button className="join-btn-nav" onClick={() => navigate('/waitlist')}>
            Join Waitlist
          </button>
        </div>
      </div>
    </nav>
  )
}

export default Navigation