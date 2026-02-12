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

  return (
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
      </Routes>
    </AnimatePresence>
  )
}

function App() {
  const [theme, setTheme] = useState('night') // night is default

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
          <Navigation />
          <AnimatedRoutes />
          <Footer />
        </div>
      </Router>
    </ThemeContext.Provider>
  )
}

export default App
