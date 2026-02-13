import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState, createContext } from 'react'
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
import Dashboard from './Dashboard'
import ProfileSetup from './ProfileSetup'
import BackToTop from './BackToTop'
import { useScrollAnimation, useMouseTracking } from './useScrollAnimation'
import './App.css'

// Create theme context
export const ThemeContext = createContext()

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}

// Animated page wrapper component
function AnimatedRoutes() {
  const location = useLocation()

  const pageVariants = {
    initial: {
      opacity: 0,
      y: 20
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: 'easeOut'
      }
    },
    exit: {
      opacity: 0,
      y: -20,
      transition: {
        duration: 0.3,
        ease: 'easeIn'
      }
    }
  }

  // Check if current page is an auth page or dashboard
  const isAuthPage = ['/signup', '/login', '/profile-setup', '/dashboard'].includes(location.pathname)

  return (
    <>
      {/* Only show Navigation on non-auth pages */}
      {!isAuthPage && <Navigation />}
      
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route 
            path="/" 
            element={
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <LandingPage />
              </motion.div>
            } 
          />
          <Route 
            path="/waitlist" 
            element={
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <WaitlistPage />
              </motion.div>
            } 
          />
          <Route 
            path="/share-story" 
            element={
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <ShareStoryPage />
              </motion.div>
            } 
          />
          <Route 
            path="/faq" 
            element={
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <FAQPage />
              </motion.div>
            } 
          />
          <Route 
            path="/about" 
            element={
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <AboutUsPage />
              </motion.div>
            } 
          />
          <Route 
            path="/how-it-works" 
            element={
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <HowItWorksPage />
              </motion.div>
            } 
          />
          <Route 
            path="/challenges" 
            element={
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <ChallengesPage />
              </motion.div>
            } 
          />
          <Route 
            path="/signup" 
            element={
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <AuthPage />
              </motion.div>
            } 
          />
          <Route 
            path="/login" 
            element={
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <AuthPage />
              </motion.div>
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <Dashboard />
              </motion.div>
            } 
          />
          <Route 
            path="/profile-setup" 
            element={
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <ProfileSetup />
              </motion.div>
            } 
          />
        </Routes>
      </AnimatePresence>

      {/* Only show Footer on non-auth pages */}
      {!isAuthPage && <Footer />}
      
      {/* Only show Back to Top on non-auth pages */}
      {!isAuthPage && <BackToTop />}
    </>
  )
}

function App() {
  const [theme, setTheme] = useState('night') // night is default

  // Initialize scroll animations and mouse tracking
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
