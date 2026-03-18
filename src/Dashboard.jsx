import { useState, useEffect, useContext, useCallback, useRef } from 'react'
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
import FenixAssistant from './FenixAssistant'
import ChallengeResultModal from './ChallengeResultModal'
import MyChallengesPage from './MyChallengesPage'
import { ThemeContext } from './ThemeContext'
import { useTPSLMonitor } from './useTPSLMonitor'
import { useBybitSync } from './useBybitSync'
import BybitLivePanel from './BybitLivePanel'
import { resetDemoAccount } from './tradingService'

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
  const [showUserMenu, setShowUserMenu] = useState(false)
  // Challenge result modal state — lifted here so it fires regardless of active tab
  const [challengeResultData, setChallengeResultData] = useState(null)
  const prevAccountStatusRef = useRef(null)
  const dashboardRefreshRef  = useRef(null)  // holds DashboardOverview's refreshAccountState
  const [tradingMode, setTradingMode] = useState(null) // null=loading, 'ijgf', 'bybit', 'none'
  // resetKey forces MarketsPage to remount (and re-initialise useDemoTrading) when a new
  // challenge starts. Without this, React reuses the existing MarketsPage instance whose
  // useDemoTrading hook already loaded the old account on mount and has no signal to reload.
  const [marketResetKey, setMarketResetKey] = useState(0)

  // TP/SL monitor — always active regardless of which dashboard tab is open.
  // MarketsPage unmounts when the user leaves the Market tab, which kills
  // the interval in useDemoTrading. This hook runs at Dashboard level so
  // TP/SL and liquidations always fire.
  useTPSLMonitor(
    userId,

    // onTriggered — TP/SL/liquidation hit, positions returned in closed[]
    (closedPositions) => {
      for (const pos of closedPositions) {
        const label = pos.closeReason === 'tp'
          ? `✅ ${pos.symbol} Take Profit hit! PNL: $${pos.pnl?.toFixed(2)}`
          : pos.closeReason === 'sl'
          ? `🛑 ${pos.symbol} Stop Loss hit. PNL: $${pos.pnl?.toFixed(2)}`
          : `💀 ${pos.symbol} Liquidated`
        console.info('[Dashboard] Auto-close:', label)
      }
    },

    // onChallengeFailed — fires when any auto-close ends the challenge,
    // OR when a drawdown breach force-closed everything (closed=[]).
    // Must: (1) refresh dashboard stats, (2) open the result modal.
    async (result) => {
      // 1. Force DashboardOverview to re-fetch immediately so Total PNL,
      //    Trade History, Win Rate, and Equity Chart all reflect final state.
      dashboardRefreshRef.current?.()

      // 2. Fetch fresh account + tradingDays for the modal
      try {
        const { data: acct } = await supabase
          .from('demo_accounts')
          .select('*')
          .eq('user_id', userId)
          .not('challenge_type', 'like', '%_archived_%')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!acct) return

        const { data: trades } = await supabase
          .from('demo_trades')
          .select('executed_at, is_close')
          .eq('demo_account_id', acct.id)

        const tradingDays = new Set(
          (trades || [])
            .filter(t => t.is_close === true)
            .map(t => t.executed_at?.split('T')[0])
            .filter(Boolean)
        ).size

        prevAccountStatusRef.current = result
        setChallengeResultData(prev => {
          // Don't re-open if modal is already showing
          if (prev) return prev
          return {
            result,
            account: acct,
            tradingDays,
            onStartNew: async (type, mode = 'ijgf') => {
              await resetDemoAccount(userId, type)
              setTradingMode(mode)
              if (mode === 'ijgf') {
                setMarketResetKey(Date.now())
                setActiveTab('market')
              }
              await checkUserAndLoadProfile()
            },
          }
        })
      } catch (err) {
        console.error('[Dashboard] onChallengeFailed error:', err)
      }
    }
  )

  // ── Bybit status change handler ─────────────────────────────────────────
  // Called by useBybitSync when the challenge transitions to passed / failed.
  // We seed prevAccountStatusRef so the background Supabase poll below
  // does NOT also fire a second modal for the same event.
  const handleBybitStatusChange = useCallback((status, acct, bybitTradingDays) => {
    prevAccountStatusRef.current = status
    setTradingMode('none')
    setChallengeResultData({
      result:      status,
      account:     acct,
      tradingDays: bybitTradingDays,
      onStartNew:  async (type, mode = 'ijgf') => {
        await resetDemoAccount(userId, type)
        setTradingMode(mode)
        if (mode === 'ijgf') {
          setMarketResetKey(Date.now())
          setActiveTab('market')
        }
        await checkUserAndLoadProfile()
      },
    })
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Background Bybit sync — always active regardless of active tab ────────
  // Returns { equity, positions, tradingDays, account, loading, error, lastSync }
  // Passed down as bybitData to every dashboard page that needs live Bybit values.
  const bybitSync = useBybitSync(userId, tradingMode, handleBybitStatusChange)

  useEffect(() => { checkUserAndLoadProfile() }, [])

  const checkUserAndLoadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }
      setUserId(user.id)

      // Read active challenge to know trading mode
      const { data: acct } = await supabase
        .from('demo_accounts')
        .select('id, status, trading_mode')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setTradingMode(acct ? (acct.trading_mode ?? 'ijgf') : 'none')

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
    { id: 'dashboard',  icon: 'grid',       label: 'Dashboard',          disabled: false },
    { id: 'market',     icon: 'chart',      label: 'Market',             disabled: false },
    { id: 'challenges', icon: 'trophy',     label: 'My Challenges',      disabled: false },
    { id: 'analytics',  icon: 'trending',   label: 'Analytics',          disabled: false },
    { id: 'history',    icon: 'clock',      label: 'Trade History',      disabled: false },
    { id: 'rules',      icon: 'book',       label: 'Rules & Objectives', disabled: false },

    { id: 'profile',    icon: 'user',       label: 'Profile',            disabled: false },
    { id: 'support',    icon: 'headphones', label: 'Support',            disabled: false },
    { id: 'settings',   icon: 'settings',   label: 'Settings',           disabled: false },
  ]

  const renderIcon = (name) => {
    const icons = {
      grid:       <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>,
      chart:      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>,
      trophy:     <><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></>,
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

  // ── Challenge result modal handlers ─────────────────────────────────────
  // Called by MarketsPage when the account transitions to passed/failed.
  const handleChallengeResult = useCallback((result, account, tradingDays, onStartNew) => {
    prevAccountStatusRef.current = result
    setTradingMode('none')
    setChallengeResultData({ result, account, tradingDays, onStartNew })
  }, [])

  const dismissChallengeResult = useCallback(() => {
    setChallengeResultData(null)
  }, [])

  const handleStartNewChallenge = useCallback(async (challengeType, mode = 'ijgf') => {
    if (!challengeResultData?.onStartNew) return
    try {
      await challengeResultData.onStartNew(challengeType, mode)
    } catch (err) {
      console.error('[Dashboard] start new challenge failed:', err)
    }
    setTradingMode(mode)
    if (mode === 'ijgf') setActiveTab('market')
    setChallengeResultData(null)
  }, [challengeResultData])

  // ── Background status polling ────────────────────────────────────────────
  // When the user is NOT on the Market tab, MarketsPage is unmounted so its
  // own challengeResult detection can't fire.  Poll here every 8s so the
  // modal fires regardless of which tab is active.
  useEffect(() => {
    if (!userId || activeTab === 'market' || tradingMode === 'bybit') return // Bybit: useBybitSync handles pass/fail

    const poll = async () => {
      try {
        // Only read the active account — avoids false modal when resetDemoAccount
        // briefly writes a 'failed' archived row with the newest updated_at
        const { data: account } = await supabase
          .from('demo_accounts')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'active')
          .not('challenge_type', 'like', '%_archived_%')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!account) return

        const curr = account.status
        const prev = prevAccountStatusRef.current

        // Only fire when we see an active → passed/failed transition
        if (prev === 'active' && (curr === 'passed' || curr === 'failed')) {
          prevAccountStatusRef.current = curr
          setChallengeResultData({
            result: curr,
            account,
            tradingDays: account.trading_days ?? 0,
            onStartNew: async (type, mode = 'ijgf') => {
              await resetDemoAccount(userId, type)
              setTradingMode(mode)
              if (mode === 'ijgf') {
                setMarketResetKey(Date.now())
                setActiveTab('market')
              }
              await checkUserAndLoadProfile()
            },
          })
        } else if (prev === null && curr) {
          // First read — just record the current status, don't fire a modal
          prevAccountStatusRef.current = curr
        }
      } catch (err) {
        console.error('[Dashboard] background status poll error:', err)
      }
    }

    const interval = setInterval(poll, 8000)
    poll() // run immediately

    return () => clearInterval(interval)
  }, [userId, activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

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
          {menuItems.map(item => {
            const isMarketLocked = item.id === 'market' && tradingMode !== 'ijgf'
            const isDisabled = item.disabled || isMarketLocked
            return (
              <button
                key={item.id}
                className={`dash-nav-item ${activeTab === item.id ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
                onClick={() => handleNavClick(item.id)}
                disabled={isDisabled}
                title={isMarketLocked ? 'Start a challenge to access the Market' : undefined}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {renderIcon(item.icon)}
                </svg>
                <span>{item.label}</span>
                {item.disabled && <span className="dash-nav-soon">Soon</span>}
                {isMarketLocked && <span className="dash-nav-soon">🔒</span>}
              </button>
            )
          })}
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

            <div className="dash-user-avatar-wrapper" style={{ position: 'relative' }}>
              <div
                className="dash-user-avatar"
                onClick={() => setShowUserMenu(v => !v)}
                style={{ cursor: 'pointer' }}
                title={userName}
              >
                {profileImage
                  ? <img src={profileImage} alt={userName} />
                  : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                }
              </div>

              {showUserMenu && (
                <>
                  {/* Click-outside backdrop */}
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="dash-profile-dropdown">
                    <div className="dash-profile-dropdown-header">
                      <span className="dash-profile-dropdown-name">{userName}</span>
                    </div>
                    <button
                      className="dash-profile-dropdown-item"
                      onClick={() => { setActiveTab('profile'); setShowUserMenu(false) }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      Profile
                    </button>
                    <div className="dash-profile-dropdown-divider" />
                    <button
                      className="dash-profile-dropdown-item dash-profile-dropdown-logout"
                      onClick={() => { setShowUserMenu(false); handleLogout() }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                      Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div className={`dash-content${activeTab === 'market' ? ' dash-content-markets' : ''}`}>
          {activeTab === 'dashboard'  && <DashboardOverview userId={userId} onNavigate={handleNavClick} bybitData={bybitSync} onChallengeStart={(mode, resetKey) => {
            setTradingMode(mode)
            // resetKey is a timestamp passed by DashboardOverview after resetDemoAccount
            // completes. Updating marketResetKey changes the key prop on MarketsPage,
            // which forces React to unmount the old instance and mount a fresh one.
            // This guarantees useDemoTrading re-initialises from the DB after the new
            // challenge account row exists — fixing the stale-state-on-tab-switch bug.
            if (resetKey) setMarketResetKey(resetKey)
            if (mode === 'ijgf') setActiveTab('market')
            // Refresh DashboardOverview stats so the new account shows immediately
            // if the user navigates back to the dashboard tab.
            dashboardRefreshRef.current?.()
          }} onForceRefresh={(fn) => { dashboardRefreshRef.current = fn }} />}
          {activeTab === 'market'     && (
            tradingMode === 'ijgf' ? (
              <MarketsPage
                key={marketResetKey}
                chartExpanded={chartExpanded}
                setChartExpanded={setChartExpanded}
                userId={userId}
                onChallengeResult={handleChallengeResult}
              />
            ) : (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',minHeight:'60vh',gap:16,color:'rgba(255,255,255,0.5)'}}>
                {tradingMode === null ? (
                  <p>Loading...</p>
                ) : tradingMode === 'bybit' ? (
                  <BybitLivePanel userId={userId} bybitData={bybitSync} />
                ) : (
                  <>
                    <p style={{fontSize:'1rem',fontWeight:500}}>No Active Challenge</p>
                    <p style={{fontSize:'0.85rem',maxWidth:320,textAlign:'center',lineHeight:1.6}}>Start a challenge from the Dashboard tab to activate trading.</p>
                  </>
                )}
              </div>
            )
          )}
          {activeTab === 'challenges' && <MyChallengesPage userId={userId} bybitData={bybitSync} />}
          {activeTab === 'analytics'  && <AnalyticsPage userId={userId} bybitData={bybitSync} />}
          {activeTab === 'history'    && <TradeHistoryPage userId={userId} bybitData={bybitSync} />}
          {activeTab === 'rules'      && <RulesObjectivesPage userId={userId} bybitData={bybitSync} />}

          {activeTab === 'profile'    && <ProfilePage isSetup={false} />}
          {activeTab === 'support'    && <SupportPage userId={userId} />}
          {activeTab === 'settings'   && <SettingsPage />}
        </div>
      </div>

      {/* Challenge result modal — rendered at Dashboard root so it fires on any tab */}
      {/* FENIX AI Assistant — popup, always mounted when logged in */}
      <FenixAssistant userId={userId} />

      {challengeResultData && (
        <ChallengeResultModal
          result={challengeResultData.result}
          userName={userName}
          profileImage={profileImage}
          account={challengeResultData.account}
          tradingDays={challengeResultData.tradingDays}
          onStartNew={handleStartNewChallenge}
          onDismiss={dismissChallengeResult}
        />
      )}
    </div>
  )
}

export default Dashboard