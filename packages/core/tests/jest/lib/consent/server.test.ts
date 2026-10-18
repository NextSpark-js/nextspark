/**
 * @jest-environment node
 */
import { getConsent } from '@nextsparkjs/core/lib/consent/server'
import { resolveConsentConfig, serializeConsentCookie } from '@nextsparkjs/core/lib/consent/cookie'

const mockHeaders = jest.fn()
jest.mock('next/headers', () => ({ headers: () => mockHeaders() }))

const config = resolveConsentConfig({ enabled: true })
const header = (analytics: boolean, marketing = false, cfg = config) =>
  `theme=dark; ${serializeConsentCookie({ necessary: true, analytics, marketing }, cfg).split(';')[0]}; other=1`

describe('getConsent', () => {
  beforeEach(() => mockHeaders.mockReset())

  it('reads the choice from a Headers object', async () => {
    const headers = new Headers({ cookie: header(true, false) })
    expect(await getConsent(headers, config)).toEqual({ hasChosen: true, categories: { necessary: true, analytics: true, marketing: false } })
  })

  it('reads it from a Cookie header string and from a request-like object', async () => {
    expect((await getConsent(header(false, true), config)).categories.marketing).toBe(true)
    expect((await getConsent({ get: () => header(true) }, config)).categories.analytics).toBe(true)
  })

  it('reads it from a Request or NextRequest, an object with `headers`', async () => {
    expect((await getConsent({ headers: new Headers({ cookie: header(true) }) }, config)).categories.analytics).toBe(true)
    expect((await getConsent(new Request('https://example.com/', { headers: { cookie: header(false, true) } }), config)).categories.marketing).toBe(true)
  })

  it('grants nothing optional without a cookie, with a bad one or with one from another version', async () => {
    const none = { hasChosen: false, categories: { necessary: true, analytics: false, marketing: false } }
    expect(await getConsent(new Headers(), config)).toEqual(none)
    expect(await getConsent('nextspark_consent=garbage', config)).toEqual(none)
    expect(await getConsent(header(true, true), resolveConsentConfig({ enabled: true, version: 9 }))).toEqual(none)
  })

  it('reads the current request when it is given no source', async () => {
    mockHeaders.mockResolvedValueOnce(new Headers({ cookie: header(true) }))
    expect((await getConsent(undefined, config)).categories.analytics).toBe(true)
  })

  it('reads the cookie under the configured name', async () => {
    const custom = resolveConsentConfig({ enabled: true, cookieName: 'my_consent' })
    expect((await getConsent(header(true, false, custom), custom)).categories.analytics).toBe(true)
    expect((await getConsent(header(true, false, custom), config)).hasChosen).toBe(false)
  })

  it('with consent disabled grants everything and reads nothing', async () => {
    const result = await getConsent('', resolveConsentConfig({ enabled: false }))
    expect(result).toEqual({ hasChosen: true, categories: { necessary: true, analytics: true, marketing: true } })
    expect(mockHeaders).not.toHaveBeenCalled()
  })
})
