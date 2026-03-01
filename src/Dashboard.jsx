import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import ProfilePage from './ProfilePage'
import LoadingAnimation from './LoadingAnimation'
import DashboardOverview from './DashboardOverview'
import MarketsPage from './MarketsPage'
import AnalyticsPage from './AnalyticsPage'
import TradeHistoryPage from './TradeHistoryPage'
import RulesObjectivesPage from './RulesObjectivesPage'
import SupportPage from './SupportPage'
import SettingsPage from './SettingsPage'
import AIAssistantPage from './AIAssistantPage'
import { ThemeContext } from './ThemeContext'
import { useTPSLMonitor } from './useTPSLMonitor'

function Dashboard() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useContext(ThemeContext)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userName, setUserName] = useState('')
  const [profileImage, setProfileImage] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNotificationPanel, setShowNotificationPanel] = useState(false)
  const [activeAlertCount, setActiveAlertCount] = useState(0)
  const [chartExpanded, setChartExpanded] = useState(false)
  const [userId, setUserId] = useState(null)

  // TP/SL monitor — always active regardless of which dashboard tab is open.
  // MarketsPage unmounts when the user leaves the Market tab, which kills
  // the interval in useDemoTrading. This hook runs at Dashboard level so
  // TP/SL and liquidations always fire.
  useTPSLMonitor(userId, (closedPositions) => {
    for (const pos of closedPositions) {
      const label = pos.closeReason === 'tp'
        ? `✅ ${pos.symbol} Take Profit hit! PNL: $${pos.pnl?.toFixed(2)}`
        : pos.closeReason === 'sl'
        ? `🛑 ${pos.symbol} Stop Loss hit. PNL: $${pos.pnl?.toFixed(2)}`
        : `💀 ${pos.symbol} Liquidated`
      console.info('[Dashboard] Auto-close:', label)
      // If the user is on the Market tab MarketsPage will also show its own
      // notification via useDemoTrading — that's fine, it deduplicates via
      // the atomic .eq('status', 'open') guard in closePosition.
    }
  })

  useEffect(() => { checkUserAndLoadProfile() }, [])

  const checkUserAndLoadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }
      setUserId(user.id)
      const { data: profile, error } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      if (error) console.error('Error loading profile:', error)
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

  useEffect(() => {
    const checkAlerts = () => {
      try {
        const alerts = JSON.parse(localStorage.getItem('priceAlerts') || '[]')
        setActiveAlertCount(alerts.filter(a => !a.triggered).length)
      } catch { setActiveAlertCount(0) }
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
    { id: 'dashboard', icon: 'grid',       label: 'Dashboard',          disabled: false },
    { id: 'market',    icon: 'chart',      label: 'Market',             disabled: false },
    { id: 'analytics', icon: 'trending',   label: 'Analytics',          disabled: false },
    { id: 'history',   icon: 'clock',      label: 'Trade History',      disabled: false },
    { id: 'rules',     icon: 'book',       label: 'Rules & Objectives', disabled: false },
    { id: 'ai',        icon: 'cpu',        label: 'AI Assistant',       disabled: true },
    { id: 'profile',   icon: 'user',       label: 'Profile',            disabled: false },
    { id: 'support',   icon: 'headphones', label: 'Support',            disabled: false },
    { id: 'settings',  icon: 'settings',   label: 'Settings',           disabled: false },
  ]

  const renderIcon = (name) => {
    const icons = {
      grid:       <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>,
      chart:      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>,
      trending:   <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
      clock:      <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
      book:       <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></>,
      cpu:        <><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M20 9h2M20 15h2M2 9h2M2 15h2"/></>,
      user:       <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
      headphones: <><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></>,
      settings:   <><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M5.7 5.7l4.2 4.2m4.2 4.2l4.2 4.2M1 12h6m6 0h6M5.7 18.3l4.2-4.2m4.2-4.2l4.2-4.2"/></>,
    }
    return icons[name] || null
  }

  const handleNavClick = (id) => {
    if (!menuItems.find(m => m.id === id)?.disabled) {
      setActiveTab(id)
      setSidebarOpen(false)
    }
  }

  if (loading) return <LoadingAnimation />

  return (
    <div className="dash-layout">

      {/* Sidebar drawer */}
      <aside className={`dash-sidebar ${sidebarOpen ? 'dash-sidebar-open' : ''}`}>
        <div className="dash-sidebar-header">
          <img src="/images/logo.png" alt="IJGF" className="dash-sidebar-logo" />
          <button className="dash-sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <nav className="dash-sidebar-nav">
          {menuItems.map(item => (
            <button
              key={item.id}
              className={`dash-nav-item ${activeTab === item.id ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
              onClick={() => handleNavClick(item.id)}
              disabled={item.disabled}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {renderIcon(item.icon)}
              </svg>
              <span>{item.label}</span>
              {item.disabled && <span className="dash-nav-soon">Soon</span>}
            </button>
          ))}
        </nav>

        <div className="dash-sidebar-footer">
          <button className="dash-nav-item" onClick={handleLogout}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* Backdrop */}
      {sidebarOpen && (
        <div className="dash-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main — always full width, scrollable */}
      <div className="dash-main">
        <header className="dash-header">
          <div className="dash-header-left">
            <button className="dash-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="3" y1="6"  x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <span className="dash-page-title">
              {menuItems.find(m => m.id === activeTab)?.label || 'Dashboard'}
            </span>
          </div>

          <div className="dash-header-right">
            {/* Retract chart button — only visible when market tab is active and chart is expanded */}
            {activeTab === 'market' && chartExpanded && (
              <button className="dash-icon-btn chart-retract-header-btn" onClick={() => setChartExpanded(false)} title="Retract Chart">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>
                </svg>
              </button>
            )}
            <div style={{ position: 'relative' }}>
              <button className="dash-icon-btn" onClick={() => setShowNotificationPanel(v => !v)} title="Alerts">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {activeAlertCount > 0 && <span className="dash-badge">{activeAlertCount}</span>}
              </button>
              {showNotificationPanel && (
                <div className="notification-panel">
                  <div className="notification-panel-header">
                    <h3>Price Alerts</h3>
                    <span className="alert-count">{activeAlertCount} active</span>
                  </div>
                  <div className="notification-panel-body">
                    {activeAlertCount === 0
                      ? <div className="no-notifications"><p>No active alerts</p></div>
                      : <div className="alert-message"><p>{activeAlertCount} active alert{activeAlertCount > 1 ? 's' : ''}</p></div>
                    }
                  </div>
                </div>
              )}
            </div>

            <button className="dash-icon-btn" onClick={toggleTheme} title="Toggle theme">
              {theme === 'night'
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
              }
            </button>

            <div className="dash-user-avatar">
              {profileImage
                ? <img src={profileImage} alt={userName} />
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              }
            </div>
          </div>
        </header>

        <div className={`dash-content${activeTab === 'market' ? ' dash-content-markets' : ''}`}>
          {activeTab === 'dashboard' && <DashboardOverview userId={userId} />}
          {activeTab === 'market'    && <MarketsPage chartExpanded={chartExpanded} setChartExpanded={setChartExpanded} userId={userId} />}
          {activeTab === 'analytics' && <AnalyticsPage userId={userId} />}
          {activeTab === 'history'   && <TradeHistoryPage userId={userId} />}
          {activeTab === 'rules'     && <RulesObjectivesPage userId={userId} />}
          {activeTab === 'ai'        && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              height: '100%', minHeight: '60vh', gap: '16px', color: 'rgba(255,255,255,0.5)',
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.3">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                <path d="M9 8h.01M12 8h.01M15 8h.01M9 12h6"/>
              </svg>
              <p style={{ fontSize: '1rem', fontWeight: 500 }}>AI Assistant — Coming Soon</p>
              <p style={{ fontSize: '0.85rem', maxWidth: 320, textAlign: 'center', lineHeight: 1.6 }}>
                Your AI trading coach is in development. It will analyze your trades, flag risk patterns, and give personalized strategy feedback.
              </p>
            </div>
          )}
          {activeTab === 'profile'   && <ProfilePage isSetup={false} />}
          {activeTab === 'support'   && <SupportPage userId={userId} />}
          {activeTab === 'settings'  && <SettingsPage />}
        </div>
      </div>
    </div>
  )
}

export default Dashboard