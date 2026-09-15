/**
 * Base path
 *
 * The app's Next.js `basePath`. Next.js adds it by itself to `<Link>`,
 * `router.push` and `redirect()`, and to nothing else: fetch calls, raw
 * anchors, URLs a route handler builds from `req.url`, email links, and every
 * URL Better Auth serves or builds (its API routes, the OAuth redirect_uri,
 * its error redirects) need it added here.
 *
 * Next.js inlines `process.env.__NEXT_ROUTER_BASEPATH` at build time in the
 * client, Node.js and edge bundles (`next/dist/build/define-env.js`), so the
 * expression has to stay written exactly like that.
 */

function basePath(): string {
  return process.env.__NEXT_ROUTER_BASEPATH || ''
}

/**
 * Prefixes the base path onto an in-app path written without it
 * (`/dashboard`, never `/base/dashboard`). The path is always prefixed, even
 * when it starts with the same segment as the base path: under
 * `basePath: '/dashboard'`, `/dashboard` is the app's dashboard page and
 * becomes `/dashboard/dashboard`.
 */
export function withBasePath(path: string): string {
  const base = basePath()
  if (!base) return path
  return path === '/' ? base : `${base}${path}`
}

/**
 * The request with the base path in its URL. Next.js hands a route handler
 * the URL without it, while Better Auth matches requests against its own
 * `basePath`, which includes it.
 */
export function withBasePathRequest(request: Request): Request {
  if (!basePath()) return request
  const url = new URL(request.url)
  url.pathname = withBasePath(url.pathname)
  return new Request(url, request)
}
