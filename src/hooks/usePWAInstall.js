/**
 * usePWAInstall.js
 *
 * Exposes PWA install state and the native browser install prompt.
 *
 *   isInstallable  — true when the browser install prompt is available OR
 *                    when on iOS Safari in non-standalone mode (manual install)
 *   isInstalled    — true when running in standalone (already installed)
 *   isIOS          — true on iOS/iPadOS (no beforeinstallprompt; needs manual steps)
 *   promptInstall  — triggers the native Chrome/Edge install dialog;
 *                    on iOS this is a no-op (caller should show manual instructions)
 */

import { useState, useEffect } from 'react'

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

function detectIOS() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstalled, setIsInstalled]       = useState(isStandalone)
  const [isIOS]                             = useState(detectIOS)

  useEffect(() => {
    // Already installed — nothing to do
    if (isInstalled) return

    const handler = (e) => {
      e.preventDefault()          // Stop the mini-info bar
      setDeferredPrompt(e)        // Save for later use
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Listen for the app being installed (e.g. from the browser's own prompt)
    const installedHandler = () => setIsInstalled(true)
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [isInstalled])

  const promptInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setIsInstalled(true)
    setDeferredPrompt(null)
  }

  // isInstallable:
  //   — Chrome/Edge: true only when a deferred prompt has been captured
  //   — iOS:        true when not yet in standalone mode (prompt is manual)
  const isInstallable = !isInstalled && (deferredPrompt !== null || isIOS)

  return { isInstallable, isInstalled, isIOS, promptInstall }
}
