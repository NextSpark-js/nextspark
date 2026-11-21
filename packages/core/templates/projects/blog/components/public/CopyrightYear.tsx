/**
 * The current year for the footer's copyright, rendered on the server.
 *
 * Cache Components does not let a page read the clock while it is prerendered unless the read is cached: the cached
 * value goes into the prerendered HTML and is refreshed daily. Reading it in a client component instead stopped the
 * whole public layout from rendering on the server (React error #419 on the post pages, #493).
 */
import { cacheLife } from 'next/cache'

export async function CopyrightYear() {
  'use cache'
  cacheLife('days')
  return new Date().getFullYear()
}
