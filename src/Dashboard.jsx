import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import ProfilePage from './ProfilePage'
import LoadingAnimation from './LoadingAnimation'
import DashboardOverview from './DashboardOverview'
import { ThemeContext } from './ThemeContext'

function Dashboard() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useContext(ThemeContext)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [profileImage, setProfileImage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNotificationPanel, setShowNotificationPanel] = useState(false)
  const [activeAlertCount, setActiveAlertCount] = useState(0)

  useEffect(() => {
    checkUserAndLoadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkUserAndLoadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        navigate('/login')
        return
      }

      setUserEmail(user.email || '')

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error loading profile:', error)
      }

      if (profile) {
        const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
        setUserName(fullName || 'User')
        setProfileImage(profile.profile_image || '')
      }
    } catch (err) {
      console.error('Error:', err)
      navigate('/login')
    } finally {
      setLoading(false)
    }
  }

  // Check for active price alerts in localStorage
  useEffect(() => {
    const checkAlerts = () => {
      try {
        const alerts = JSON.parse(localStorage.getItem('priceAlerts') || '[]')
        const activeAlerts = alerts.filter(a => !a.triggered)
        setActiveAlertCount(activeAlerts.length)
      } catch {
        setActiveAlertCount(0)
      }
    }
    
    checkAlerts()
    const interval = setInterval(checkAlerts, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const menuItems = [
    { id: 'dashboard', icon: 'grid', label: 'Dashboard', disabled: false },
    { id: 'market', icon: 'chart', label: 'Market', disabled: true },
    { id: 'analytics', icon: 'trending', label: 'Analytics', disabled: true },
    { id: 'history', icon: 'clock', label: 'Trade History', disabled: true },
    { id: 'rules', icon: 'book', label: 'Rules & Objectives', disabled: true },
    { id: 'ai', icon: 'cpu', label: 'AI Assistant', disabled: true },
    { id: 'profile', icon: 'user', label: 'Profile', disabled: false },
    { id: 'support', icon: 'headphones', label: 'Support', disabled: true },
    { id: 'settings', icon: 'settings', label: 'Settings', disabled: true },
  ]

  const renderIcon = (iconName) => {
    const icons = {
      grid: <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>,
      chart: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
      trending: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
      clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
      book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></>,
      cpu: <><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M20 9h2M20 15h2M2 9h2M2 15h2"/></>,
      user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
      headphones: <><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></>,
      settings: <><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M5.7 5.7l4.2 4.2m4.2 4.2l4.2 4.2M1 12h6m6 0h6M5.7 18.3l4.2-4.2m4.2-4.2l4.2-4.2"/></>,
    }
    return icons[iconName] || null
  }

  if (loading) {
    return <LoadingAnimation />
  }

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className={`dashboard-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="/images/logo.png" alt="IJGF" />
          </div>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map(item => (
            <button
              key={item.id}
              className={`sidebar-nav-item ${activeTab === item.id ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
              onClick={() => !item.disabled && setActiveTab(item.id)}
              disabled={item.disabled}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {renderIcon(item.icon)}
              </svg>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>Help</span>
          </button>
          <button className="sidebar-nav-item" onClick={handleLogout}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="dashboard-main">
        {/* Top Header */}
        <header className="dashboard-header">
          <button 
            className="mobile-menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

          {/* Search — icon on RIGHT to match Figma */}
          <div className="dashboard-search search-icon-right">
            <input 
              type="text" 
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
          </div>

          <div className="dashboard-user">
            <button 
              className="notification-btn"
              onClick={() => setShowNotificationPanel(!showNotificationPanel)}
              title="Price Alerts"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {activeAlertCount > 0 && (
                <span className="notification-badge">{activeAlertCount}</span>
              )}
            </button>

            {showNotificationPanel && (
              <div className="notification-panel">
                <div className="notification-panel-header">
                  <h3>Price Alerts</h3>
                  <span className="alert-count">{activeAlertCount} active</span>
                </div>
                <div className="notification-panel-body">
                  {activeAlertCount === 0 ? (
                    <div className="no-notifications">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                      </svg>
                      <p>No active alerts</p>
                      <span>Set price alerts on any crypto in the Markets widget</span>
                    </div>
                  ) : (
                    <div className="alert-message">
                      <p>You have {activeAlertCount} active price alert{activeAlertCount > 1 ? 's' : ''}</p>
                      <span>Manage them in the Markets widget on your dashboard</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              className="theme-toggle-btn"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={theme === 'night' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'night' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="4"/>
                  <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                </svg>
              )}
            </button>

            <div className="user-profile">
              <div className="user-avatar">
                {profileImage ? (
                  <img src={profileImage} alt={userName} />
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                )}
              </div>
              <div className="user-info">
                <span className="user-name">{userName}</span>
                <span className="user-email">{userEmail}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="dashboard-content">
          {activeTab === 'dashboard' && <DashboardOverview />}
          {activeTab === 'profile' && <ProfilePage isSetup={false} />}
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}

export default Dashboard
