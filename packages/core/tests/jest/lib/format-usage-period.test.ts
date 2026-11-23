/**
 * A usage period key (what getPeriodKey writes) read back in words (#534).
 */
import { formatUsagePeriod, getPeriodKey } from '../../../src/lib/billing/helpers'

const label = (key: string, locale = 'en') => formatUsagePeriod(key, locale, 'All time')

it('names the periods of the four reset periods', () => {
  expect(label('all_time')).toBe('All time')
  expect(label('2026')).toBe('2026')
  expect(label('2026-11')).toBe('November 2026')
  expect(label('2026-11-05')).toBe('Nov 5, 2026')
})

it('writes the month in the locale and does not shift it with the time zone', () => {
  expect(label('2026-01', 'es')).toBe('enero de 2026')
  expect(label('2026-12-31', 'de')).toBe('31.12.2026')
})

it('returns a key it does not know as it is', () => {
  expect(label('weekly-3')).toBe('weekly-3')
  expect(label('2026-13')).toBe('2026-13')
})

it('reads what getPeriodKey writes', () => {
  expect(label(getPeriodKey('never'))).toBe('All time')
  expect(label(getPeriodKey('monthly'))).toMatch(/^\w+ \d{4}$/)
})
