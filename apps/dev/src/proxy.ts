/**
 * The proxy every generated project runs (packages/core/templates/proxy.ts),
 * so apps/dev answers requests the way those projects do: the session and role
 * a protected area needs are checked before its page renders, identity headers
 * come only from the verified session, and a docs page the registry lacks is a
 * 404.
 *
 * The template's own imports resolve from packages/core, which declares
 * @better-fetch/fetch as a dev dependency for it. Next.js reads `config` from
 * this file's source rather than from its imports, so the matcher is written
 * here; tests/node/apps-dev-proxy.test.ts keeps it equal to the template's.
 */
export { proxy } from '../../../packages/core/templates/proxy'

export const config = {
  matcher: [
    '/((?!_next/static/|_next/image$|favicon\\.ico$).*)',
  ],
}
