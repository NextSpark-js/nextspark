import { act, fireEvent, render, screen } from '@testing-library/react'
import { ConsentManager } from '@nextsparkjs/core/components/consent/ConsentManager'
import { CookieSettingsLink } from '@nextsparkjs/core/components/consent/CookieSettingsLink'
import { CONSENT_EVENT, getConsentState } from '@nextsparkjs/core/lib/consent'
import consentMessages from '@nextsparkjs/core/messages/en/consent.json'

// next-intl ships ESM only; the component reads its strings through useTranslations
jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) =>
    key.split('.').reduce<any>((node, part) => node?.[part], jest.requireActual('@nextsparkjs/core/messages/en/consent.json')) ?? `${namespace}.${key}`,
}))

jest.mock('@nextsparkjs/core/lib/config/public-config-client', () => ({
  CONSENT_CONFIG: jest.requireActual('@nextsparkjs/core/lib/consent/cookie').resolveConsentConfig({
    enabled: true,
    loaders: { plausible: { domain: 'example.com' } },
  }),
}))

const renderManager = (nonce?: string) =>
  render(
    <>
      <button>page content</button>
      <ConsentManager nonce={nonce} />
      <CookieSettingsLink label="Cookie settings" />
    </>,
  )
const banner = () => screen.queryByRole('region', { name: consentMessages.title })
const scripts = () => document.head.querySelectorAll('script[data-nextspark-consent]')

beforeEach(() => {
  document.cookie.split(';').forEach((c) => (document.cookie = `${c.split('=')[0].trim()}=; Max-Age=0; Path=/`))
  document.head.innerHTML = ''
})

describe('ConsentManager', () => {
  it('asks a visitor who has not chosen, with Accept all and Reject all as the same kind of button', () => {
    renderManager()
    expect(banner()).toBeInTheDocument()
    const accept = screen.getByRole('button', { name: 'Accept all' })
    const reject = screen.getByRole('button', { name: 'Reject all' })
    expect(accept.className).toBe(reject.className)
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('is not a modal: nothing is inert or hidden and focus is not taken', () => {
    renderManager()
    expect(banner()).not.toHaveAttribute('aria-modal')
    expect(screen.getByRole('button', { name: 'page content' })).toBeVisible()
    expect(document.body).toHaveFocus()
  })

  it('Accept all stores the choice, closes the banner and fires the event', () => {
    const detail: unknown[] = []
    window.addEventListener(CONSENT_EVENT, (e) => detail.push((e as CustomEvent).detail), { once: true })
    renderManager()
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))
    expect(banner()).not.toBeInTheDocument()
    expect(getConsentState().categories).toEqual({ necessary: true, analytics: true, marketing: true })
    expect(detail).toHaveLength(1)
  })

  it('Reject all stores the refusal and closes the banner', () => {
    renderManager()
    fireEvent.click(screen.getByRole('button', { name: 'Reject all' }))
    expect(banner()).not.toBeInTheDocument()
    expect(getConsentState()).toMatchObject({ hasChosen: true, categories: { analytics: false, marketing: false } })
  })

  it('does not show again once a choice is stored', () => {
    document.cookie = ''
    const first = renderManager()
    fireEvent.click(screen.getByRole('button', { name: 'Reject all' }))
    first.unmount()
    renderManager()
    expect(banner()).not.toBeInTheDocument()
  })

  it('Settings shows necessary (always on, disabled) and one switch per category, and saves the per-category choice', () => {
    renderManager()
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('switch', { name: /Necessary/ })).toBeDisabled()
    expect(screen.getByRole('switch', { name: /Necessary/ })).toBeChecked()
    const analytics = screen.getByRole('switch', { name: 'Analytics' })
    expect(analytics).not.toBeChecked()
    fireEvent.click(analytics)
    fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }))
    expect(getConsentState()).toMatchObject({ hasChosen: true, categories: { analytics: true, marketing: false } })
    expect(banner()).not.toBeInTheDocument()
  })

  it('reopens from the footer link with the current choice, moves focus to it, and Escape closes it and returns focus', () => {
    renderManager()
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))
    const link = screen.getByRole('button', { name: 'Cookie settings' })
    link.focus()
    fireEvent.click(link)
    const region = banner()!
    expect(region).toHaveFocus()
    expect(screen.getByRole('switch', { name: 'Analytics' })).toBeChecked()
    fireEvent.keyDown(region, { key: 'Escape' })
    expect(banner()).not.toBeInTheDocument()
    expect(link).toHaveFocus()
    expect(getConsentState().categories.analytics).toBe(true)
  })

  it('Escape does not dismiss the first-time banner', () => {
    renderManager()
    fireEvent.keyDown(banner()!, { key: 'Escape' })
    expect(banner()).toBeInTheDocument()
    expect(getConsentState().hasChosen).toBe(false)
  })

  it('holds the configured loader back until the visitor accepts, then loads it with the nonce', () => {
    renderManager('abc')
    expect(scripts()).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Reject all' }))
    expect(scripts()).toHaveLength(0)
    act(() => screen.getByRole('button', { name: 'Cookie settings' }).click())
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))
    expect(scripts()).toHaveLength(1)
    expect(scripts()[0].getAttribute('nonce')).toBe('abc')
  })
})
