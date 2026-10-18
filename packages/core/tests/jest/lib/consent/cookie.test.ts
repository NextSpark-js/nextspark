import {
  parseConsentCookie,
  readCookie,
  resolveConsentConfig,
  serializeConsentCookie,
} from '@nextsparkjs/core/lib/consent/cookie'

const config = resolveConsentConfig({ enabled: true })
const DAY = 86_400_000
const cookieValue = (setCookie: string) => setCookie.split(';')[0].split('=').slice(1).join('=')

describe('resolveConsentConfig', () => {
  it('is off by default and fills the defaults in', () => {
    expect(resolveConsentConfig(undefined)).toMatchObject({
      enabled: false,
      cookieName: 'nextspark_consent',
      maxAgeDays: 180,
      categories: ['analytics', 'marketing'],
    })
  })

  it('holds the lifetime between 6 and 12 months', () => {
    expect(resolveConsentConfig({ enabled: true, maxAgeDays: 7 }).maxAgeDays).toBe(180)
    expect(resolveConsentConfig({ enabled: true, maxAgeDays: 270 }).maxAgeDays).toBe(270)
    expect(resolveConsentConfig({ enabled: true, maxAgeDays: 1000 }).maxAgeDays).toBe(365)
  })

  it('puts the version and the offered categories in the cookie version', () => {
    const a = resolveConsentConfig({ enabled: true, version: 1 })
    expect(resolveConsentConfig({ enabled: true, version: 2 }).version).not.toBe(a.version)
    expect(resolveConsentConfig({ enabled: true, version: 1, categories: ['analytics'] }).version).not.toBe(a.version)
  })
})

describe('serializeConsentCookie', () => {
  it('writes a first-party, SameSite=Lax cookie that lives as long as the configured lifetime', () => {
    const cookie = serializeConsentCookie({ necessary: true, analytics: true, marketing: false }, config)
    expect(cookie).toMatch(/^nextspark_consent=/)
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain(`Max-Age=${180 * 86_400}`)
    expect(cookie).not.toContain('Secure')
    expect(cookie).not.toContain('Domain')
  })

  it('adds Secure when asked and honours a custom name and lifetime', () => {
    const custom = resolveConsentConfig({ enabled: true, cookieName: 'my_consent', maxAgeDays: 365 })
    const cookie = serializeConsentCookie({ necessary: true, analytics: false, marketing: false }, custom, { secure: true })
    expect(cookie).toMatch(/^my_consent=/)
    expect(cookie).toContain('Secure')
    expect(cookie).toContain(`Max-Age=${365 * 86_400}`)
  })

  it('stores only the categories that are offered', () => {
    const analyticsOnly = resolveConsentConfig({ enabled: true, categories: ['analytics'] })
    const cookie = serializeConsentCookie({ necessary: true, analytics: true, marketing: true }, analyticsOnly)
    expect(decodeURIComponent(cookieValue(cookie))).not.toContain('marketing')
  })
})

describe('parseConsentCookie', () => {
  const stored = (categories: { analytics: boolean; marketing: boolean }, now = Date.now(), cfg = config) =>
    cookieValue(serializeConsentCookie({ necessary: true, ...categories }, cfg, { now }))

  it('round-trips the choice', () => {
    expect(parseConsentCookie(stored({ analytics: true, marketing: false }), config)).toEqual({
      categories: { necessary: true, analytics: true, marketing: false },
      hasChosen: true,
    })
  })

  it('is "no choice" with nothing optional granted when the cookie is missing or malformed', () => {
    const none = { categories: { necessary: true, analytics: false, marketing: false }, hasChosen: false }
    expect(parseConsentCookie(undefined, config)).toEqual(none)
    expect(parseConsentCookie('', config)).toEqual(none)
    expect(parseConsentCookie('not-json', config)).toEqual(none)
    expect(parseConsentCookie(encodeURIComponent('{"v":"x"}'), config)).toEqual(none)
    expect(parseConsentCookie('%E0%A4%A', config)).toEqual(none)
  })

  it('asks again when the version or the offered categories changed', () => {
    const value = stored({ analytics: true, marketing: true })
    expect(parseConsentCookie(value, resolveConsentConfig({ enabled: true, version: 2 })).hasChosen).toBe(false)
    expect(parseConsentCookie(value, resolveConsentConfig({ enabled: true, categories: ['analytics'] })).hasChosen).toBe(false)
  })

  it('asks again once the choice is older than the lifetime', () => {
    const now = Date.now()
    const value = stored({ analytics: true, marketing: true }, now - 179 * DAY)
    expect(parseConsentCookie(value, config, now).hasChosen).toBe(true)
    expect(parseConsentCookie(stored({ analytics: true, marketing: true }, now - 181 * DAY), config, now)).toMatchObject({
      hasChosen: false,
      categories: { analytics: false, marketing: false },
    })
  })
})

describe('a timestamp in the future', () => {
  it('counts as no choice beyond one day ahead, and as a choice within it (clock skew)', () => {
    const now = Date.now()
    const at = (t: number) => cookieValue(serializeConsentCookie({ necessary: true, analytics: true, marketing: true }, config, { now: t }))
    expect(parseConsentCookie(at(now + 2 * DAY), config, now).hasChosen).toBe(false)
    expect(parseConsentCookie(at(9e15), config, now).hasChosen).toBe(false)
    expect(parseConsentCookie(at(now + DAY / 2), config, now).hasChosen).toBe(true)
  })
})

describe('readCookie', () => {
  it('finds one cookie in a header, whatever its neighbours', () => {
    expect(readCookie('a=1; nextspark_consent=abc%20d; b=2', 'nextspark_consent')).toBe('abc%20d')
    expect(readCookie('xnextspark_consent=no', 'nextspark_consent')).toBeUndefined()
    expect(readCookie(null, 'a')).toBeUndefined()
  })
})
