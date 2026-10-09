'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { analyticsUrl, GA_MEASUREMENT_ID, isAnalyticsPage } from '@/lib/analytics'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    alrehlaAnalyticsInitialized?: boolean
    'ga-disable-G-953D3NL6LV'?: boolean
  }
}

/** A small client island: root layout and page data remain server-rendered. */
export function GoogleAnalytics() {
  const pathname = usePathname()
  const lastPage = useRef<string | null>(null)
  const enabled = process.env.NODE_ENV === 'production' && isAnalyticsPage(pathname)

  useEffect(() => {
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
    window['ga-disable-G-953D3NL6LV'] = !enabled || local
    if (!enabled || local) {
      lastPage.current = null
      return
    }

    window.dataLayer ??= []
    window.gtag ??= function () { window.dataLayer?.push(arguments) }
    const location = analyticsUrl(window.location.href)
    if (!window.alrehlaAnalyticsInitialized) {
      window.gtag('js', new Date())
      window.gtag('config', GA_MEASUREMENT_ID, {
        send_page_view: false,
        page_location: location,
        page_referrer: analyticsUrl(document.referrer),
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      })
      window.alrehlaAnalyticsInitialized = true
    }
    if (lastPage.current === pathname) return
    lastPage.current = pathname
    window.gtag('set', { page_location: location })
    window.gtag('event', 'page_view', {
      send_to: GA_MEASUREMENT_ID,
      page_location: location,
      page_title: document.title,
      page_referrer: analyticsUrl(document.referrer),
    })
  }, [enabled, pathname])

  if (!enabled) return null
  return <Script
    id="alrehla-ga4"
    src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
    strategy="afterInteractive"
  />
}
