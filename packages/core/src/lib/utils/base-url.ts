/**
 * The server's own URLs, for the links and callbacks the app builds.
 * App URL order: NEXT_PUBLIC_APP_URL, https://$VERCEL_URL (only on a Vercel
 * preview deployment, VERCEL_ENV === 'preview'), then localhost. Production
 * never uses VERCEL_URL. The auth base URL puts BETTER_AUTH_URL first.
 */
type UrlEnv = Pick<NodeJS.ProcessEnv, 'BETTER_AUTH_URL' | 'NEXT_PUBLIC_APP_URL' | 'VERCEL_ENV' | 'VERCEL_URL'>

// Literal `process.env.X` accesses: Next.js inlines NEXT_PUBLIC_* at build time
// only for these, on the server too (a Docker build ARG relies on it). Reading
// them through a `process.env` object passed around would lose that value.
const readEnv = (): UrlEnv => ({
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  VERCEL_ENV: process.env.VERCEL_ENV,
  VERCEL_URL: process.env.VERCEL_URL,
})

export function resolveAppUrl(env: UrlEnv = readEnv()): string {
  if (env.NEXT_PUBLIC_APP_URL) return env.NEXT_PUBLIC_APP_URL
  if (env.VERCEL_ENV === 'preview' && env.VERCEL_URL) {
    const host = env.VERCEL_URL.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
    if (host) return `https://${host}`
  }
  return 'http://localhost:5173'
}

export function resolveBaseUrl(env: UrlEnv = readEnv()): string {
  return env.BETTER_AUTH_URL || resolveAppUrl(env)
}
