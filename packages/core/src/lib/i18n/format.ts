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
  // still shows the day before in a zone west of the server's. Fixing it means pg.types.setTypeParser(1082, s => s), which changes
  // every API response that carries a DATE ("...T03:00:00.000Z" becomes "2026-12-24") for every client: its own change, not this one.
  const dateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  return new Intl.DateTimeFormat(locale, dateOnly ? { ...DATE_STYLES[style], timeZone: 'UTC' } : DATE_STYLES[style]).format(date)
}

export function formatLocaleNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value)
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
