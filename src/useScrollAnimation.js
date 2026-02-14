import { useEffect } from 'react'

const ANIMATION_DELAY_MS = 100

export function useScrollAnimation() {
  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed')
          // Unobserve after animating — no need to keep watching
          observer.unobserve(entry.target)
        }
      })
    }, observerOptions)

    const observeAll = (elements, className) => {
      elements.forEach(el => {
        el.classList.add(className)
        observer.observe(el)
      })
    }

    setTimeout(() => {
      observeAll(
        document.querySelectorAll('.section-title, .hero-title, .about-hero-title, .challenges-title, .how-page-title, .faq-page-title, .waitlist-title, .share-story-title, .story-title, .about-section-title, .how-section-title'),
        'scroll-animate-title'
      )

      observeAll(
        document.querySelectorAll('.section-subtitle, .hero-subtitle, .about-hero-subtitle, .challenges-subtitle, .how-page-subtitle, .faq-page-subtitle, .waitlist-subtitle, .share-story-description, .story-subtitle'),
        'scroll-animate-subtitle'
      )

      observeAll(
        document.querySelectorAll('.about-hero, .challenges-header, .how-page-header, .faq-page-header, .auth-header'),
        'scroll-animate-fade'
      )

      observeAll(
        document.querySelectorAll('.benefit-card, .step-card, .challenge-preview-card, .challenge-card, .how-step-card, .about-feature-card'),
        'scroll-animate-scale'
      )

      observeAll(
        document.querySelectorAll('.trusted-stat-card, .about-stat, .faq-item, .how-rule-item'),
        'scroll-animate'
      )

      // Alternate left/right for testimonials
      document.querySelectorAll('.testimonial-card').forEach((el, index) => {
        el.classList.add(index % 2 === 0 ? 'scroll-animate-left' : 'scroll-animate-right')
        observer.observe(el)
      })
    }, ANIMATION_DELAY_MS)

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
