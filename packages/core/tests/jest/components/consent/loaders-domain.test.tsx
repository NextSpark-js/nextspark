/**
 * @jest-environment-options {"url": "https://www.example.com/"}
 *
 * gtag.js sets `_ga` and `_ga_<id>` on the highest domain it can, so revoking must expire them for every parent
 * domain of the host as well: on a real domain a host-only expiry leaves them. (jsdom on localhost cannot show it.)
 */
import { act, render } from '@testing-library/react'
import { GoogleAnalyticsLoader } from '@nextsparkjs/core/components/consent/loaders'
import { useConsent } from '@nextsparkjs/core/lib/consent'

jest.mock('@nextsparkjs/core/lib/config/public-config-client', () => ({
  CONSENT_CONFIG: jest.requireActual('@nextsparkjs/core/lib/consent/cookie').resolveConsentConfig({ enabled: true }),
}))

let consent: ReturnType<typeof useConsent>
function Probe() {
  consent = useConsent()
  return null
}

it('on revoke expires each _ga cookie host-only and for every dotted suffix of the hostname', () => {
  render(<><Probe /><GoogleAnalyticsLoader measurementId="G-TEST123" /></>)
  act(() => consent.accept())
  const nativeCookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!
  const writes: string[] = []
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: () => '_ga=GA1.1.1; _ga_TEST123=GS1.1.1; theme=dark; nextspark_consent=x',
    set: (value: string) => void writes.push(value),
  })
  try {
    act(() => consent.reject())
  } finally {
    delete (document as unknown as Record<string, unknown>).cookie
    Object.defineProperty(Document.prototype, 'cookie', nativeCookie)
  }
  const expiries = writes.filter((w) => w.includes('Max-Age=0') && /^_ga/.test(w))
  for (const name of ['_ga', '_ga_TEST123']) {
    const mine = expiries.filter((w) => w.startsWith(`${name}=;`))
    expect(mine.some((w) => !w.includes('Domain='))).toBe(true)
    expect(mine.filter((w) => w.includes('Domain=')).map((w) => /Domain=(\S+)$/.exec(w)![1]).sort()).toEqual(['.example.com', '.www.example.com'])
  }
  expect(writes.some((w) => w.startsWith('theme=') || w.startsWith('_ga_x'))).toBe(false)
})
