/**
 * Verify email link
 *
 * A verification email links to Better Auth's own `/api/auth/verify-email`.
 * The auth route handler sends that click on to the app's verify-email page,
 * which verifies the token and shows the result.
 */

import { withBasePath } from '../base-path'

/**
 * The verify-email page for the URL of a clicked email link, or null when it
 * carries no token. Relative: behind a proxy the request's URL carries the
 * internal host, and the browser resolves this against the address it opened.
 */
export function verifyEmailPageUrl(linkUrl: string): string | null {
  const link = new URL(linkUrl)
  const token = link.searchParams.get('token')
  if (!token) return null

  const query = new URLSearchParams({ token })
  const callbackURL = link.searchParams.get('callbackURL')
  if (callbackURL) query.set('callbackURL', callbackURL)
  return `${withBasePath('/verify-email')}?${query}`
}
