/**
 * #413: formatLocaleDate does not throw on an invalid date, and a date with no time is the same calendar day in every time zone.
 */
import { formatLocaleDate } from '../../../../src/lib/i18n/format'

describe('formatLocaleDate', () => {
  const zone = process.env.TZ

  afterEach(() => {
    if (zone === undefined) delete process.env.TZ
    else process.env.TZ = zone
  })

  test('an invalid date is returned as it is, not thrown', () => {
    expect(() => formatLocaleDate('not a date', 'de')).not.toThrow()
    expect(formatLocaleDate('not a date', 'de')).toBe('not a date')
    expect(formatLocaleDate(NaN, 'de')).toBe('NaN')
  })

  test.each(['America/Los_Angeles', 'Pacific/Auckland', 'UTC'])('a date with no time keeps its day in %s', tz => {
    process.env.TZ = tz
    expect(formatLocaleDate('2026-12-24', 'en')).toBe('Dec 24, 2026')
    expect(formatLocaleDate('2026-12-24', 'de')).toContain('24')
  })

  test('a date with a time is formatted in the local zone, in the locale', () => {
    expect(formatLocaleDate('2026-12-24T12:00:00Z', 'de')).toContain('Dez')
  })
})
