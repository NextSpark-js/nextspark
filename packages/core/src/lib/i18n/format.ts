/**
 * Dates and numbers in the format of the active locale (#412). The superadmin pages used `date-fns` formats
 * ("MMM dd, yyyy") and `toLocaleString()` with no locale, which show English month names or the browser's format
 * whatever the language of the interface.
 */
const DATE_STYLES = {
  /** Jan 05, 2024 */
  short: { month: 'short', day: '2-digit', year: 'numeric' },
  /** January 05, 2024 */
  long: { month: 'long', day: '2-digit', year: 'numeric' },
  /** Jan 05 */
  shortNoYear: { month: 'short', day: '2-digit' },
  /** 1/5/2024, 3:00:00 PM */
  dateTime: { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>

export type DateStyle = keyof typeof DATE_STYLES

export function formatLocaleDate(value: string | number | Date, locale: string, style: DateStyle = 'short'): string {
  const date = new Date(value)
  // an invalid date would make Intl throw a RangeError and take the render down with it
  if (isNaN(date.getTime())) return String(value)
  // a date with no time ("2026-12-24") is a calendar day, not an instant: read it in UTC so it is the same day west of UTC
  // ponytail: pg returns a DATE column as a Date at the server's local midnight (serialized as an ISO instant), so such a value
  // still shows the day before in a zone west of the server's. Fixing it means a pg parser for the DATE type (OID 1082) that returns the text, which changes
  // every API response that carries a DATE ("...T03:00:00.000Z" becomes "2026-12-24") for every client: its own change, not this one.
  const dateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  return new Intl.DateTimeFormat(locale, dateOnly ? { ...DATE_STYLES[style], timeZone: 'UTC' } : DATE_STYLES[style]).format(date)
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000], ['month', 2_592_000], ['day', 86_400], ['hour', 3_600], ['minute', 60],
]

/** "3 days ago", "in 2 hours" in the locale (what `formatDistanceToNow(..., { addSuffix: true })` gave in English only). */
export function formatLocaleRelative(value: string | number | Date, locale: string, now: number = Date.now()): string {
  const time = new Date(value).getTime()
  if (isNaN(time)) return String(value)
  const seconds = Math.round((time - now) / 1000)
  const [unit, size] = RELATIVE_UNITS.find(([, size]) => Math.abs(seconds) >= size) ?? ['second', 1]
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(Math.trunc(seconds / size), unit)
}

export function formatLocaleNumber(value: number, locale: string, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, options).format(value)
}

/** An amount in cents as dollars, with no decimals when it is a whole number of dollars (the plan prices of the matrices). */
export function formatLocaleDollars(cents: number, locale: string, { whole = false }: { whole?: boolean } = {}): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100)
}

/** A locale named in its own language ("Deutsch", "Español"), the way a language picker lists it. */
export function formatLanguageName(locale: string): string {
  let name: string | undefined
  try { name = new Intl.DisplayNames(locale, { type: 'language' }).of(locale) } catch { /* a code Intl does not know */ }
  return name && name !== locale ? name.charAt(0).toLocaleUpperCase(locale) + name.slice(1) : locale
}
