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

    window.gtag('config', GA_ID, {
      page_path: location.pathname + location.search,
      page_location: window.location.href,
      page_title: document.title,
    })
  }, [location.pathname, location.search])

  return null
}
