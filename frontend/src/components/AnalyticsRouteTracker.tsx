import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

const GA_ID = 'G-1P76LQ7FN1'

export function AnalyticsRouteTracker() {
  const location = useLocation()

  useEffect(() => {
    if (!window.gtag) return

    const cleanPath = location.pathname
    window.gtag('config', GA_ID, {
      page_path: cleanPath,
      page_location: `${window.location.origin}${cleanPath}`,
      page_title: document.title,
    })
  }, [location.pathname])

  return null
}
