import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import Navigation from './Navigation'
import Footer from './Footer'
import LandingPage from './LandingPage'
import WaitlistPage from './WaitlistPage'
import ShareStoryPage from './ShareStoryPage'
import FAQPage from './FAQPage'
import AboutUsPage from './AboutUsPage'
import HowItWorksPage from './HowItWorksPage'
import ChallengesPage from './ChallengesPage'
import AuthPage from './AuthPage'
import AuthCallback from './AuthCallback'
import Dashboard from './Dashboard'
import ProfileSetup from './ProfileSetup'
import ResetPasswordPage from './ResetPasswordPage'
import BackToTop from './BackToTop'
import { useScrollAnimation, useMouseTracking } from './useScrollAnimation'
import { ThemeContext } from './ThemeContext'
import './App.css'

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}

// Shared animated page wrapper — avoids repeating motion.div on every route
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' }
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: { duration: 0.3, ease: 'easeIn' }
  }
}

function PageWrapper({ children }) {
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
      {children}
    </motion.div>
  )
}

function AnimatedRoutes() {
  const location = useLocation()

  const isAuthPage = ['/signup', '/login', '/profile-setup', '/dashboard', '/auth/callback', '/reset-password'].includes(location.pathname)

  return (
    <>
      {!isAuthPage && <Navigation />}

      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageWrapper><LandingPage /></PageWrapper>} />
          <Route path="/waitlist" element={<PageWrapper><WaitlistPage /></PageWrapper>} />
          <Route path="/share-story" element={<PageWrapper><ShareStoryPage /></PageWrapper>} />
          <Route path="/faq" element={<PageWrapper><FAQPage /></PageWrapper>} />
          <Route path="/about" element={<PageWrapper><AboutUsPage /></PageWrapper>} />
          <Route path="/how-it-works" element={<PageWrapper><HowItWorksPage /></PageWrapper>} />
          <Route path="/challenges" element={<PageWrapper><ChallengesPage /></PageWrapper>} />
          <Route path="/signup" element={<PageWrapper><AuthPage /></PageWrapper>} />
          <Route path="/login" element={<PageWrapper><AuthPage /></PageWrapper>} />
          <Route path="/auth/callback" element={<PageWrapper><AuthCallback /></PageWrapper>} />
          <Route path="/dashboard" element={<PageWrapper><Dashboard /></PageWrapper>} />
          <Route path="/profile-setup" element={<PageWrapper><ProfileSetup /></PageWrapper>} />
          <Route path="/reset-password" element={<PageWrapper><ResetPasswordPage /></PageWrapper>} />
          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>

      {!isAuthPage && <Footer />}
      {!isAuthPage && <BackToTop />}
    </>
  )
}

function App() {
  const [theme, setTheme] = useState('night')

  useScrollAnimation()
  useMouseTracking()

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'night' ? 'day' : 'night')
  }

  useEffect(() => {
    document.body.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <Router>
        <ScrollToTop />
        <div className="App">
          <AnimatedRoutes />
        </div>
      </Router>
    </ThemeContext.Provider>
  )
}

export default App
