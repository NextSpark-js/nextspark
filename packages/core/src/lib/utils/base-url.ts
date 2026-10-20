/**
 * The server's own base URL, for the links and callbacks Better Auth builds.
 * Order: BETTER_AUTH_URL, NEXT_PUBLIC_APP_URL, https://$VERCEL_URL (only on a
 * Vercel preview deployment, VERCEL_ENV === 'preview'), then localhost.
 * Production never uses VERCEL_URL.
 */
export function resolveBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (env.BETTER_AUTH_URL) return env.BETTER_AUTH_URL
  if (env.NEXT_PUBLIC_APP_URL) return env.NEXT_PUBLIC_APP_URL
  if (env.VERCEL_ENV === 'preview' && env.VERCEL_URL) return `https://${env.VERCEL_URL}`
  return 'http://localhost:5173'
}
