import { useEffect } from 'react'

export function useScrollAnimation() {
  useEffect(() => {
    // Intersection Observer for scroll animations
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed')
        }
      })
    }, observerOptions)

    // Observe all elements with scroll-animate classes
    const animateElements = document.querySelectorAll(
      '.scroll-animate, .scroll-animate-left, .scroll-animate-right, .scroll-animate-scale'
    )
    
    animateElements.forEach(el => observer.observe(el))

    return () => observer.disconnect()
  }, [])
}

export function useMouseTracking() {
  useEffect(() => {
    let rafId = null
    
    const handleMouseMove = (e) => {
      if (rafId) return
      
      rafId = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth) * 100
        const y = (e.clientY / window.innerHeight) * 100
        
        document.body.style.setProperty('--mouse-x', `${x}%`)
        document.body.style.setProperty('--mouse-y', `${y}%`)
        document.body.classList.add('mouse-active')
        
        rafId = null
      })
    }

    const handleMouseLeave = () => {
      document.body.classList.remove('mouse-active')
    }

    window.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])
}
