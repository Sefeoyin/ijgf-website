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
      // Section titles and subtitles - elegant fade in from top
      const sectionTitles = document.querySelectorAll('.section-title, .hero-title, .about-hero-title, .challenges-title, .how-page-title, .faq-page-title, .waitlist-title, .share-story-title, .story-title, .about-section-title, .how-section-title')
      const sectionSubtitles = document.querySelectorAll('.section-subtitle, .hero-subtitle, .about-hero-subtitle, .challenges-subtitle, .how-page-subtitle, .faq-page-subtitle, .waitlist-subtitle, .share-story-description, .story-subtitle')
      
      // Page-specific headers
      const pageHeaders = document.querySelectorAll('.about-hero, .challenges-header, .how-page-header, .faq-page-header, .auth-header')
      
      // Auto-detect and add scroll-animate classes
      const benefitCards = document.querySelectorAll('.benefit-card')
      const stepCards = document.querySelectorAll('.step-card')
      const challengeCards = document.querySelectorAll('.challenge-preview-card, .challenge-card')
      const testimonialCards = document.querySelectorAll('.testimonial-card')
      const statCards = document.querySelectorAll('.trusted-stat-card, .about-stat')
      const faqItems = document.querySelectorAll('.faq-item')
      const featureCards = document.querySelectorAll('.about-feature-card')
      const howStepCards = document.querySelectorAll('.how-step-card')
      const ruleItems = document.querySelectorAll('.how-rule-item')

      // Elegant title animations - fade down
      sectionTitles.forEach(el => {
        el.classList.add('scroll-animate-title')
        observer.observe(el)
      })

      // Subtitle animations - slight delay after title
      sectionSubtitles.forEach(el => {
        el.classList.add('scroll-animate-subtitle')
        observer.observe(el)
      })

      // Page headers
      pageHeaders.forEach(el => {
        el.classList.add('scroll-animate-fade')
        observer.observe(el)
      })

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

      howStepCards.forEach(el => {
        el.classList.add('scroll-animate-scale')
        observer.observe(el)
      })

      featureCards.forEach(el => {
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

      // Fade up for rule items
      ruleItems.forEach(el => {
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