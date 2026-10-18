import { act, render } from '@testing-library/react'
import { GoogleAnalyticsLoader, PlausibleLoader } from '@nextsparkjs/core/components/consent/loaders'
import { useConsent } from '@nextsparkjs/core/lib/consent'

jest.mock('@nextsparkjs/core/lib/config/public-config-client', () => ({
  CONSENT_CONFIG: jest.requireActual('@nextsparkjs/core/lib/consent/cookie').resolveConsentConfig({ enabled: true }),
}))

let consent: ReturnType<typeof useConsent>
function Probe() {
  consent = useConsent()
  return null
}
const scripts = () => Array.from(document.head.querySelectorAll<HTMLScriptElement>('script[data-nextspark-consent]'))
const gtagCalls = () => (window.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>))

beforeEach(() => {
  document.cookie.split(';').forEach((c) => (document.cookie = `${c.split('=')[0].trim()}=; Max-Age=0; Path=/`))
  document.head.innerHTML = ''
  localStorage.clear()
  delete window.dataLayer
  delete window.gtag
})

describe('PlausibleLoader', () => {
  const mount = (props = {}) => render(<><Probe /><PlausibleLoader domain="example.com" nonce="n0nce" {...props} /></>)

  it('renders nothing and loads no script before analytics is granted', () => {
    const { container } = mount()
    expect(container).toBeEmptyDOMElement()
    expect(scripts()).toHaveLength(0)
  })

  it('stays off for a visitor who only granted marketing', () => {
    mount()
    act(() => consent.update({ marketing: true }))
    expect(scripts()).toHaveLength(0)
  })

  it('loads the script with the nonce and the domain once analytics is granted', () => {
    mount()
    act(() => consent.update({ analytics: true }))
    expect(scripts()).toHaveLength(1)
    const script = scripts()[0]
    expect(script.getAttribute('src')).toBe('https://plausible.io/js/script.js')
    expect(script.getAttribute('nonce')).toBe('n0nce')
    expect(script.getAttribute('data-domain')).toBe('example.com')
    expect(script.hasAttribute('defer')).toBe(true)
  })

  it('loads a self-hosted script URL and does not load it twice', () => {
    mount({ scriptUrl: 'https://stats.example.org/js/plausible.js' })
    act(() => consent.accept())
    act(() => consent.update({ marketing: false }))
    expect(scripts().map((s) => s.getAttribute('src'))).toEqual(['https://stats.example.org/js/plausible.js'])
  })

  it('loads nothing without a domain', () => {
    mount({ domain: undefined })
    act(() => consent.accept())
    expect(scripts()).toHaveLength(0)
  })

  it('on revoke sets Plausible’s ignore flag, and clears it on a new grant', () => {
    mount()
    act(() => consent.accept())
    expect(localStorage.getItem('plausible_ignore')).toBeNull()
    act(() => consent.reject())
    expect(localStorage.getItem('plausible_ignore')).toBe('true')
    act(() => consent.accept())
    expect(localStorage.getItem('plausible_ignore')).toBeNull()
  })

  it('leaves no ignore flag behind for a visitor who never granted anything', () => {
    mount()
    act(() => consent.reject())
    expect(localStorage.getItem('plausible_ignore')).toBeNull()
  })
})

describe('GoogleAnalyticsLoader', () => {
  const mount = () => render(<><Probe /><GoogleAnalyticsLoader measurementId="G-TEST123" nonce="n0nce" /></>)

  it('renders nothing, loads no script and touches no global before analytics is granted', () => {
    const { container } = mount()
    expect(container).toBeEmptyDOMElement()
    expect(scripts()).toHaveLength(0)
    expect(window.dataLayer).toBeUndefined()
    expect(window.gtag).toBeUndefined()
  })

  it('loads gtag.js with the nonce after the grant, with consent mode granted for analytics only', () => {
    mount()
    act(() => consent.update({ analytics: true }))
    expect(scripts()).toHaveLength(1)
    expect(scripts()[0].getAttribute('src')).toBe('https://www.googletagmanager.com/gtag/js?id=G-TEST123')
    expect(scripts()[0].getAttribute('nonce')).toBe('n0nce')
    const calls = gtagCalls()
    expect(calls[0]).toEqual(['consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }])
    expect(calls.map((c) => c[0])).toEqual(['consent', 'js', 'config'])
    expect(calls[2]).toEqual(['config', 'G-TEST123'])
  })

  it('on revoke sets consent mode to denied and the ga-disable flag, and removes the _ga cookies', () => {
    mount()
    act(() => consent.accept())
    document.cookie = '_ga=GA1.1.1; Path=/'
    document.cookie = '_ga_TEST123=GS1.1.1; Path=/'
    act(() => consent.reject())
    const last = gtagCalls().at(-1)
    expect(last).toEqual(['consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }])
    expect((window as unknown as Record<string, unknown>)['ga-disable-G-TEST123']).toBe(true)
    expect(document.cookie).not.toContain('_ga')
  })

  it('re-enables tracking on a new grant without a second init', () => {
    mount()
    act(() => consent.accept())
    act(() => consent.reject())
    act(() => consent.accept())
    expect((window as unknown as Record<string, unknown>)['ga-disable-G-TEST123']).toBe(false)
    expect(scripts()).toHaveLength(1)
    expect(gtagCalls().filter((c) => c[0] === 'config')).toHaveLength(1)
  })
})
