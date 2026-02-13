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

    // Wait for DOM to be ready
    setTimeout(() => {
      // Auto-detect and add scroll-animate classes
      const benefitCards = document.querySelectorAll('.benefit-card')
      const stepCards = document.querySelectorAll('.step-card')
      const challengeCards = document.querySelectorAll('.challenge-preview-card, .challenge-card')
      const testimonialCards = document.querySelectorAll('.testimonial-card')
      const statCards = document.querySelectorAll('.trusted-stat-card')
      const faqItems = document.querySelectorAll('.faq-item')

      // Add scale animation to cards
      benefitCards.forEach(el => {
        el.classList.add('scroll-animate-scale')
        observer.observe(el)
      })

      stepCards.forEach(el => {
        el.classList.add('scroll-animate-scale')
        observer.observe(el)
      })

      challengeCards.forEach(el => {
        el.classList.add('scroll-animate-scale')
        observer.observe(el)
      })

      // Alternate left/right for testimonials
      testimonialCards.forEach((el, index) => {
        el.classList.add(index % 2 === 0 ? 'scroll-animate-left' : 'scroll-animate-right')
        observer.observe(el)
      })

      // Fade up for stats
      statCards.forEach(el => {
        el.classList.add('scroll-animate')
        observer.observe(el)
      })

      // Fade up for FAQ items
      faqItems.forEach(el => {
        el.classList.add('scroll-animate')
        observer.observe(el)
      })
    }, 100)

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
