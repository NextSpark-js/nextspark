/**
 * Verify email link
 *
 * A verification email links to Better Auth's own `/api/auth/verify-email`.
 * The auth route handler sends that click on to the app's verify-email page,
 * which verifies the token and shows the result.
 */

import { withBasePath } from '../base-path'

/** The verify-email page for the URL of a clicked email link, or null when it carries no token. */
export function verifyEmailPageUrl(linkUrl: string): URL | null {
  const link = new URL(linkUrl)
  const token = link.searchParams.get('token')
  if (!token) return null

  const page = new URL(withBasePath('/verify-email'), link)
  page.searchParams.set('token', token)
  const callbackURL = link.searchParams.get('callbackURL')
  if (callbackURL) page.searchParams.set('callbackURL', callbackURL)
  return page
}
