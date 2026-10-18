'use client'

/**
 * Analytics loaders (#272). Each renders nothing and loads no script until `analytics` is granted, then adds its
 * script to the page with the request CSP nonce. Revoking stops further tracking through the vendor's own switch
 * (Plausible's ignore flag, Google's `ga-disable` flag and consent mode); the script already loaded stays in memory
 * until the next page load, where it is not loaded again.
 */

import { useEffect } from 'react'
import { useConsent } from '../../lib/consent'

const PLAUSIBLE_SCRIPT = 'https://plausible.io/js/script.js'
const GA_SCRIPT = 'https://www.googletagmanager.com/gtag/js'

function addScript(id: string, src: string, nonce: string | undefined, attrs: Record<string, string> = {}) {
  if (document.querySelector(`script[data-nextspark-consent="${id}"]`)) return
  const script = document.createElement('script')
  script.async = true
  script.src = src
  script.dataset.nextsparkConsent = id
  for (const [name, value] of Object.entries(attrs)) script.setAttribute(name, value)
  // setAttribute, not the `nonce` property: it is what a nonce-only script-src checks, in every browser
  if (nonce) script.setAttribute('nonce', nonce)
  document.head.appendChild(script)
}

export function PlausibleLoader({ domain, scriptUrl, nonce }: { domain?: string; scriptUrl?: string; nonce?: string }) {
  const granted = useConsent().categories.analytics
  useEffect(() => {
    if (!domain) return
    try {
      if (granted) localStorage.removeItem('plausible_ignore')
      else if (document.querySelector('script[data-nextspark-consent="plausible"]')) localStorage.setItem('plausible_ignore', 'true')
    } catch {
      // storage blocked: Plausible keeps working without its ignore flag, as it does for everyone
    }
    if (granted) addScript('plausible', scriptUrl || PLAUSIBLE_SCRIPT, nonce, { defer: '', 'data-domain': domain })
  }, [granted, domain, scriptUrl, nonce])
  return null
}

type Gtag = (...args: unknown[]) => void
declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: Gtag
  }
}

function deleteGaCookies() {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0].trim()
    if (name === '_ga' || name.startsWith('_ga_')) document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`
  }
}

export function GoogleAnalyticsLoader({ measurementId, nonce }: { measurementId?: string; nonce?: string }) {
  const { categories } = useConsent()
  const analytics = categories.analytics
  const marketing = categories.marketing
  useEffect(() => {
    if (!measurementId) return
    const flag = `ga-disable-${measurementId}` as const
    const loaded = !!document.querySelector('script[data-nextspark-consent="google-analytics"]')
    if (!analytics && !loaded) return
    if (!window.gtag) {
      window.dataLayer = window.dataLayer || []
      // gtag.js reads `arguments` objects from the dataLayer, not arrays
      window.gtag = function () { window.dataLayer!.push(arguments) }
    }
    const gtag = window.gtag
    const mode = (granted: boolean) => (granted ? 'granted' : 'denied')
    ;(window as unknown as Record<string, unknown>)[flag] = !analytics
    gtag('consent', loaded ? 'update' : 'default', {
      analytics_storage: mode(analytics),
      ad_storage: mode(marketing),
      ad_user_data: mode(marketing),
      ad_personalization: mode(marketing),
    })
    if (!analytics) return deleteGaCookies()
    if (!loaded) {
      gtag('js', new Date())
      gtag('config', measurementId)
      addScript('google-analytics', `${GA_SCRIPT}?id=${encodeURIComponent(measurementId)}`, nonce)
    }
  }, [analytics, marketing, measurementId, nonce])
  return null
}
