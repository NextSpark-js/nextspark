'use client'

/**
 * The current year, read in the browser.
 *
 * `new Date()` in a Server Component fails a Cache Components prerender (the value changes between
 * renders), and the footer is a Server Component. A Client Component that reads it at hydration is
 * the option Next names for a value that is not needed in the prerendered shell. The markup
 * suppresses the hydration warning because the year in the prerendered HTML is the build's.
 */
export function CurrentYear() {
  return <span suppressHydrationWarning>{new Date().getFullYear()}</span>
}
