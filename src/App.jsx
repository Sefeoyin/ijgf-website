import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { createContext, useContext, useState, useEffect } from 'react'
import Navigation from './Navigation'
import Footer from './Footer'
import LandingPage from './LandingPage'
import WaitlistPage from './WaitlistPage'
import ShareStoryPage from './ShareStoryPage'
import './App.css'

// Theme Context
const ThemeContext = createContext()

export const useTheme = () => useContext(ThemeContext)

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
            <motion.div
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <LandingPage />
            </motion.div>
          } 
        />
        <Route 
          path="/waitlist" 
          element={
            <motion.div
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <WaitlistPage />
            </motion.div>
          } 
        />
        <Route 
          path="/share-story" 
          element={
            <motion.div
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <ShareStoryPage />
            </motion.div>
          } 
        />
      </Routes>
    </AnimatePresence>
  )
}

function App() {
  const [theme, setTheme] = useState('night')

  const toggleTheme = () => {
    setTheme(prev => prev === 'night' ? 'day' : 'night')
  }

  useEffect(() => {
    document.body.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <Router>
        <div className="App">
          <ScrollToTop />
          <Navigation />
          <AnimatedRoutes />
          <Footer />
        </div>
      </Router>
    </ThemeContext.Provider>
  )
}

export default App
