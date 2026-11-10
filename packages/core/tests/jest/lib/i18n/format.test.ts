/**
 * #413: formatLocaleDate does not throw on an invalid date, and a date with no time is the same calendar day in every time zone.
 */
import { formatLocaleDate, formatLocaleNumber, formatLocaleRelative } from '../../../../src/lib/i18n/format'

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

  test('a relative time is written in the locale, in the past and in the future, and an invalid one is returned as it is', () => {
    const now = Date.UTC(2026, 11, 24, 12)
    expect(formatLocaleRelative(now - 3 * 86_400_000, 'en', now)).toBe('3 days ago')
    expect(formatLocaleRelative(now - 3 * 86_400_000, 'de', now)).toBe('vor 3 Tagen')
    expect(formatLocaleRelative(now - 3 * 86_400_000, 'es', now)).toBe('hace 3 días')
    expect(formatLocaleRelative(now + 2 * 3_600_000, 'fr', now)).toBe('dans 2 heures')
    expect(formatLocaleRelative('nope', 'de', now)).toBe('nope')
  })

  test('a date with a time is formatted in the local zone, in the locale', () => {
    expect(formatLocaleDate('2026-12-24T12:00:00Z', 'de')).toContain('Dez')
  })
})

describe('formatLocaleNumber (#422)', () => {
  test('takes Intl options: a percentage and a currency are written the way the locale does', () => {
    const percent = { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 } as const
    expect(formatLocaleNumber(0.425, 'en', percent)).toBe('42.5%')
    expect(formatLocaleNumber(0.425, 'de', percent).replace(/\s/g, ' ')).toBe('42,5 %')
    expect(formatLocaleNumber(1500, 'es', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })).toContain('1500')
    expect(formatLocaleNumber(1234567, 'de')).toBe('1.234.567')
  })
})
