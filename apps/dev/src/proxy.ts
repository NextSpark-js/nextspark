/**
 * The request proxy (Next.js 16+). This file is yours: core's proxy does the
 * work (sessions, protected areas, roles, docs access, identity headers) and is
 * updated with @nextsparkjs/core.
 *
 * - Request behaviour of your own (redirects, rewrites, headers) goes in
 *   config/hooks/proxy.ts, which core's proxy runs before its checks.
 * - More paths that need a signed-in user:
 *     import { createProxy } from '@nextsparkjs/core/proxy'
 *     export const proxy = createProxy({ authenticatedPaths: ['/account'] })
 * - Next.js reads `config` from this file's own source, so the matcher stays
 *   written here. It leaves out only the exact paths of Next's own output
 *   (`_next/static/`, `_next/image`, `favicon.ico`): excluding by file
 *   extension would let a route such as /profile/alice.png skip the proxy.
 */
export { proxy } from '@nextsparkjs/core/proxy'

export const config = {
  matcher: [
    '/((?!_next/static/|_next/image$|favicon\\.ico$).*)',
  ],
}
