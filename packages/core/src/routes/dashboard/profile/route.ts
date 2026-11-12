/**
 * /dashboard/profile: the profile lives under settings, so a guessed or hand-written link goes there (#433, #452).
 *
 * A Route Handler, not the proxy: the proxy cannot see the project's pages, and a project with a page of its own at
 * /dashboard/profile (in any route group) replaces this route when `nextspark prepare` plans the app (`yieldsToUrl` in
 * the route manifest). The redirect is temporary (307), so a browser never keeps it for a project that takes the path
 * back. The Location is relative, so the origin behind a proxy is the browser's own, and carries the basePath.
 * The proxy's sign-in check for /dashboard runs before this, and again at the destination.
 */
import { withBasePath } from '@nextsparkjs/core/lib/base-path'

export function GET(request: Request) {
  const { search } = new URL(request.url)
  // A route handler's Location does not get the basePath Next.js adds to redirect(): add it here.
  return new Response(null, { status: 307, headers: { Location: `${withBasePath('/dashboard/settings/profile')}${search}` } })
}

export const HEAD = GET
