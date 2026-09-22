/**
 * `nextspark sync:app` keeps this file up to date while its first line is the
 * generated tag sync writes and the rest of the file is unchanged since then,
 * which is how a release ships changes to it. Edit the file, or delete that
 * line, to own it: from then on sync reports it and leaves it alone.
 *
 * NextSpark Proxy (Next.js 16+)
 *
 * Handles authentication, route protection, and user context injection.
 * Note: In Next.js 16, "middleware" was renamed to "proxy" with nodejs runtime.
 *
 * Key responsibilities:
 * 1. Theme middleware extension support without bypassing core access checks
 * 2. Redirecting historical 3-level docs URLs to their current route
 * 3. Documentation access control
 * 4. Protected route authentication, and the roles /superadmin and /devtools need
 * 5. User header injection for downstream use (x-user-id, x-pathname, x-active-team-id)
 *
 * IMPORTANT: The EntityPermissionLayout depends on x-user-id and x-pathname
 * headers being set here for server-side permission validation.
 */
import { betterFetch } from '@better-fetch/fetch'
import { NextRequest, NextResponse } from 'next/server'
import {
  hasThemeMiddleware,
  executeThemeMiddleware,
  getThemeAppConfig
} from '@nextsparkjs/core/lib/middleware'
import { ACTIVE_TEAM_COOKIE, activeTeamIdForSession } from '@nextsparkjs/core/lib/teams/active-team-cookie'
import { SESSION_HINT_COOKIE, SESSION_HINT_MAX_AGE, hasSessionCookie } from '@nextsparkjs/core/lib/auth/session-hint'
import { isDocsPublic, legacyDocsAccessMessage } from '@nextsparkjs/core/lib/docs/access'
import { DOCS_REGISTRY } from '@nextsparkjs/registries/docs-registry'

/**
 * Session type for proxy (inline definition)
 */
interface Session {
  user: {
    id: string
    email?: string
    role?: string
    [key: string]: unknown
  } | null
  session?: {
    id: string
    [key: string]: unknown
  }
}

/**
 * Public paths that don't require authentication
 */
const publicPaths = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/terms',
  '/privacy',
  '/api/auth',
  '/api/test-auth',
  '/auth-test',
  '/auth/callback',
] as const

/**
 * Check if a path is public (doesn't require auth)
 */
function isPublicPath(pathname: string): boolean {
  return publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

/**
 * Whether `pathname` is `prefix` or a path under it: `/devtools/config` is,
 * `/devtools-guide` and `/profile-photo.jpg` are not.
 */
function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

type ProtectedArea = 'authenticated' | 'admin' | 'superadmin' | 'devtools'

/** The single route policy shared by original and rewritten destinations. */
function protectedArea(pathname: string): ProtectedArea | null {
  if (isUnder(pathname, '/admin')) return 'admin'
  if (isUnder(pathname, '/superadmin')) return 'superadmin'
  if (isUnder(pathname, '/devtools')) return 'devtools'
  if (
    isUnder(pathname, '/dashboard') ||
    isUnder(pathname, '/settings') ||
    isUnder(pathname, '/profile') ||
    isUnder(pathname, '/update-password')
  ) return 'authenticated'
  return null
}

/**
 * A URL on this app at `pathname`, keeping the base path and locale the request
 * came in with; one built from `request.url` would lose both.
 */
function appUrl(request: NextRequest, pathname: string): NextRequest['nextUrl'] {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  return url
}

/**
 * Whether `pathname` is a docs page route — `/docs/<section>/<page>` or
 * `/superadmin/docs/<section>/<page>` — whose section and page the docs
 * registry does not have together. Segments are compared decoded, the way the
 * page reads its params.
 */
function isMissingDocsPage(pathname: string): boolean {
  const match = pathname.match(/^(\/superadmin)?\/docs\/([^/]+)\/([^/]+)$/)
  if (!match) return false

  let sectionSlug: string
  let pageSlug: string
  try {
    sectionSlug = decodeURIComponent(match[2])
    pageSlug = decodeURIComponent(match[3])
  } catch {
    return true
  }

  const sections = match[1] ? DOCS_REGISTRY.superadmin : DOCS_REGISTRY.public
  return !sections.some(section => section.slug === sectionSlug && section.pages.some(page => page.slug === pageSlug))
}

/**
 * Serve the app's not-found page with a 404 status for a docs page the
 * registry does not have. The docs pages answer 404 on their own only where
 * their `dynamicParams = false` has a list to check: in `next dev`, and for
 * public docs prerendered by an app whose locale is fixed. Rendered on demand
 * (superadmin docs always, public docs when the locale comes from the
 * request), their notFound() runs inside the layouts' Suspense boundaries,
 * after the response head has gone out with a 200. Deciding it here, before
 * anything renders, gives those requests the 404.
 */
function rewriteToNotFound(
  request: NextRequest,
  requestHeaders: Headers,
  themeResponse: NextResponse | null = null
): NextResponse {
  return syncSessionHint(request, NextResponse.rewrite(appUrl(request, '/_not-found'), {
    headers: themeResponseHeaders(themeResponse),
    request: { headers: requestHeaders },
  }))
}

/**
 * Send a visitor without a session to login. LoginForm reads `callbackUrl` and
 * returns them to the page they asked for, query included, once signed in.
 */
interface RequestTarget {
  pathname: string
  search: string
}

function requestTarget(request: NextRequest): RequestTarget {
  return { pathname: request.nextUrl.pathname, search: request.nextUrl.search }
}

function redirectToLogin(request: NextRequest, target: RequestTarget = requestTarget(request)): NextResponse {
  const loginUrl = appUrl(request, '/login')
  loginUrl.searchParams.set('callbackUrl', `${target.pathname}${target.search}`)
  return NextResponse.redirect(loginUrl)
}

/** Send a signed-in user without the role an area needs back to the dashboard. */
function redirectAccessDenied(request: NextRequest): NextResponse {
  const dashboardUrl = appUrl(request, '/dashboard')
  dashboardUrl.searchParams.set('error', 'access_denied')
  return NextResponse.redirect(dashboardUrl)
}

/**
 * The session the request's cookies carry, asked of this app's own auth route,
 * which is served under the base path like every other route.
 */
function getSession(request: NextRequest) {
  return betterFetch<Session>('/api/auth/get-session', {
    baseURL: `${request.nextUrl.origin}${request.nextUrl.basePath}`,
    headers: { cookie: request.headers.get('cookie') || '' },
  })
}

/**
 * Identity headers this proxy injects for downstream server code.
 *
 * SECURITY (#87): these headers are trusted by RSC layouts and permission
 * checks, so an inbound value must NEVER reach the app. They are stripped from
 * every request before any path branching and re-added only from the verified
 * session. Gating the strip on protected prefixes is not enough: Next.js
 * dispatches Server Actions by the `Next-Action` header, not by the URL, so an
 * action can be POSTed to a public path with a forged `x-user-id`.
 */
const TRUSTED_IDENTITY_HEADERS = ['x-user-id', 'x-user-email', 'x-pathname', 'x-active-team-id'] as const

/**
 * Build the request headers forwarded to the app: inbound copy minus every
 * trusted identity header, plus the real pathname.
 */
function sanitizeRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers)
  for (const name of TRUSTED_IDENTITY_HEADERS) {
    headers.delete(name)
  }
  headers.set('x-pathname', request.nextUrl.pathname)
  return headers
}

/**
 * Keep the readable session hint (lib/auth/session-hint) in line with the
 * session cookie, so client code knows whether to ask for the session. A browser
 * that got its session without client code seeing it (before the hint existed,
 * or through OAuth) gets the hint on its next request, and one whose session
 * cookie is gone loses it. The session itself is not checked here.
 */
function syncSessionHint(request: NextRequest, response: NextResponse): NextResponse {
  const hasSession = hasSessionCookie(request.headers.get('cookie'))
  const hinted = request.cookies.get(SESSION_HINT_COOKIE)?.value === '1'
  if (hasSession && !hinted) {
    response.cookies.set(SESSION_HINT_COOKIE, '1', {
      path: '/',
      maxAge: SESSION_HINT_MAX_AGE,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
    })
  } else if (!hasSession && hinted) {
    response.cookies.set(SESSION_HINT_COOKIE, '', { path: '/', maxAge: 0 })
  }
  return response
}

/**
 * Give theme code a real NextRequest whose forgeable identity headers have
 * already been removed. Reusing the request as constructor input keeps its
 * method/body/signal; the explicit nextUrl clone keeps Next's basePath and
 * locale parsing, which the public Request constructor does not carry over.
 */
function requestForTheme(request: NextRequest, requestHeaders: Headers): NextRequest {
  const themeRequest = new NextRequest(request, { headers: requestHeaders })
  Object.defineProperty(themeRequest, 'nextUrl', { value: request.nextUrl.clone() })
  return themeRequest
}

const THEME_CONTROL_HEADERS = new Set([
  'location',
  'x-middleware-next',
  'x-middleware-refresh',
  'x-middleware-rewrite',
  'x-middleware-override-headers',
])

/** Response headers/cookies a theme may add, without its routing controls. */
function themeResponseHeaders(themeResponse: NextResponse | null): Headers {
  const headers = new Headers(themeResponse?.headers)
  for (const name of [...headers.keys()]) {
    if (
      THEME_CONTROL_HEADERS.has(name) ||
      name.startsWith('x-middleware-request-') ||
      TRUSTED_IDENTITY_HEADERS.includes(name as typeof TRUSTED_IDENTITY_HEADERS[number])
    ) {
      headers.delete(name)
    }
  }
  // A continuation/rewrite has no response body, so a theme response's body
  // framing metadata must not be copied onto it.
  headers.delete('content-length')
  headers.delete('transfer-encoding')
  return headers
}

/**
 * Decode the NextResponse.next/rewrite request override protocol. When the
 * list is present it is the complete set Next forwards, not a patch over the
 * incoming request, so omitted headers stay omitted.
 */
function themeRequestHeaders(themeResponse: NextResponse | null, fallback: Headers): Headers {
  if (!themeResponse) {
    return new Headers(fallback)
  }

  const overridden = themeResponse.headers.get('x-middleware-override-headers')
  if (overridden === null) {
    return new Headers(fallback)
  }

  const headers = new Headers()
  for (const rawName of overridden.split(',')) {
    const name = rawName.trim().toLowerCase()
    if (!name || TRUSTED_IDENTITY_HEADERS.includes(name as typeof TRUSTED_IDENTITY_HEADERS[number])) continue
    const value = themeResponse.headers.get(`x-middleware-request-${name}`)
    if (value !== null) headers.set(name, value)
  }
  return headers
}

function terminalThemeResponse(request: NextRequest, themeResponse: NextResponse): NextResponse {
  const response = new NextResponse(themeResponse.body, {
    status: themeResponse.status,
    statusText: themeResponse.statusText,
    headers: themeResponseHeaders(themeResponse),
  })
  const location = themeResponse.headers.get('location')
  if (location) response.headers.set('location', location)
  return syncSessionHint(request, response)
}

function mergeThemeHeaders(response: NextResponse, themeResponse: NextResponse | null): NextResponse {
  themeResponseHeaders(themeResponse).forEach((value, name) => {
    if (name === 'set-cookie' && response.headers.has(name)) {
      response.headers.append(name, value)
    } else if (!response.headers.has(name)) {
      response.headers.set(name, value)
    }
  })
  return response
}

function unsupportedThemeRewrite(request: NextRequest): NextResponse {
  return syncSessionHint(request, new NextResponse('Unsupported or ambiguous theme rewrite destination', { status: 502 }))
}

/**
 * The canonical app-relative pathname used for rewrite access checks.
 *
 * Next normalizes literal repeated slashes and backslashes while routing. We
 * mirror that behavior before applying policy, then decode each segment once
 * so an encoded protected segment cannot evade the same check. Encoded path
 * separators, malformed escapes and still-encoded output are ambiguous across
 * routing layers, so they fail closed instead of being decoded repeatedly.
 */
function rewritePathname(request: NextRequest, destination: URL): string | null {
  let pathname = destination.pathname.replace(/\\/g, '/').replace(/\/\/+/g, '/')

  const segments: string[] = []
  for (const segment of pathname.split('/')) {
    let decoded: string
    try {
      decoded = decodeURIComponent(segment)
    } catch {
      return null
    }
    if (/[\\/?#%\u0000-\u001F\u007F]/.test(decoded)) {
      return null
    }
    segments.push(decoded)
  }
  pathname = segments.join('/')

  const basePath = request.nextUrl.basePath
  if (basePath && isUnder(pathname, basePath)) {
    pathname = pathname.slice(basePath.length) || '/'
  }

  const locale = request.nextUrl.locale
  if (locale && locale !== 'default') {
    const localePrefix = `/${locale}`
    if (isUnder(pathname, localePrefix)) {
      pathname = pathname.slice(localePrefix.length) || '/'
    }
  }
  return pathname
}

/** Add only identity established by the core session lookup. */
function addVerifiedIdentity(
  request: NextRequest,
  headers: Headers,
  session: Session,
  pathname: string
): Headers {
  for (const name of TRUSTED_IDENTITY_HEADERS) headers.delete(name)
  headers.set('x-pathname', pathname)
  if (session.user?.id) headers.set('x-user-id', session.user.id)
  if (session.user?.email) headers.set('x-user-email', session.user.email)

  const activeTeamId = activeTeamIdForSession(
    request.cookies.get(ACTIVE_TEAM_COOKIE)?.value,
    session.session?.id
  )
  if (activeTeamId) headers.set('x-active-team-id', activeTeamId)
  return headers
}

/**
 * Continue to the app with the (sanitized) request headers.
 * Every pass-through in this proxy MUST go through here so the strip applies
 * to public paths, /api/v1 and unmatched routes alike.
 */
function passThrough(
  request: NextRequest,
  requestHeaders: Headers,
  themeResponse: NextResponse | null = null,
  rewriteDestination: URL | null = null
): NextResponse {
  const init = {
    headers: themeResponseHeaders(themeResponse),
    request: { headers: requestHeaders },
  }
  const response = rewriteDestination
    ? NextResponse.rewrite(rewriteDestination, init)
    : NextResponse.next(init)
  return syncSessionHint(request, response)
}

let legacyDocsAccessWarned = false

/** Says once per server process what to change in an app config that still
 * gates /docs with the older `docs.public` boolean. */
function warnLegacyDocsAccess(docsConfig: Parameters<typeof legacyDocsAccessMessage>[0]): void {
  if (legacyDocsAccessWarned) return
  const message = legacyDocsAccessMessage(docsConfig)
  if (!message) return
  legacyDocsAccessWarned = true
  console.warn(`[NextSpark] ${message}`)
}

export async function proxy(request: NextRequest) {
  const originalTarget = requestTarget(request)
  const sanitizedHeaders = sanitizeRequestHeaders(request)
  const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME

  // Theme middleware is an extension hook, not a replacement security
  // boundary. It sees a sanitized request and its continuations/rewrites are
  // fed back through the core route checks below.
  let themeResponse: NextResponse | null = null
  if (activeTheme && hasThemeMiddleware(activeTheme)) {
    try {
      themeResponse = await executeThemeMiddleware(
        activeTheme,
        requestForTheme(request, sanitizedHeaders),
        null
      )
    } catch (error) {
      console.error(`Error executing middleware for theme '${activeTheme}':`, error)
    }
  }

  const themeLocation = themeResponse?.headers.get('location')
  const isThemeRedirect = !!themeLocation && [301, 302, 303, 307, 308].includes(themeResponse!.status)
  if (themeResponse && isThemeRedirect) {
    return terminalThemeResponse(request, themeResponse)
  }

  const themeRewrite = themeResponse?.headers.get('x-middleware-rewrite')
  let rewriteDestination: URL | null = null
  let target = originalTarget
  if (themeRewrite !== null && themeRewrite !== undefined) {
    if (!themeRewrite.trim()) return unsupportedThemeRewrite(request)
    try {
      rewriteDestination = new URL(themeRewrite, request.url)
    } catch {
      return unsupportedThemeRewrite(request)
    }
    if (rewriteDestination.origin !== request.nextUrl.origin) {
      return unsupportedThemeRewrite(request)
    }
    const pathname = rewritePathname(request, rewriteDestination)
    if (pathname === null) return unsupportedThemeRewrite(request)
    target = {
      pathname,
      search: rewriteDestination.search,
    }
  }

  const isThemeContinuation = themeResponse?.headers.get('x-middleware-next') === '1'
  let requestHeaders = themeRequestHeaders(themeResponse, sanitizedHeaders)
  for (const name of TRUSTED_IDENTITY_HEADERS) requestHeaders.delete(name)
  requestHeaders.set('x-pathname', target.pathname)

  let sessionPromise: Promise<Session | null> | undefined
  let sessionError: unknown
  const verifiedSession = async (): Promise<Session | null> => {
    if (!sessionPromise) {
      sessionPromise = getSession(request)
        .then(({ data }) => data)
        .catch(error => {
          sessionError = error
          return null
        })
    }
    return sessionPromise
  }

  const docsConfig = () => {
    const config = getThemeAppConfig(activeTheme as string)?.docs
    warnLegacyDocsAccess(config)
    return config
  }

  interface AccessResult {
    response: NextResponse | null
    session: Session | null
    injectIdentity: boolean
  }

  const authorize = async (accessTarget: RequestTarget): Promise<AccessResult> => {
    const { pathname } = accessTarget
    const area = protectedArea(pathname)
    const isProtectedRoute = area !== null
    const privateDocs = isUnder(pathname, '/docs') && !isDocsPublic(docsConfig())

    if (!privateDocs && !isProtectedRoute) {
      return { response: null, session: null, injectIdentity: false }
    }

    const session = await verifiedSession()
    if (!session) {
      if (sessionError && isProtectedRoute) console.error('Proxy error:', sessionError)
      return { response: redirectToLogin(request, accessTarget), session: null, injectIdentity: false }
    }

    const role = session.user?.role
    if (
      (area === 'admin' && role !== 'superadmin') ||
      (area === 'superadmin' && role !== 'superadmin' && role !== 'developer') ||
      (area === 'devtools' && role !== 'developer')
    ) {
      return { response: redirectAccessDenied(request), session, injectIdentity: false }
    }

    return { response: null, session, injectIdentity: isProtectedRoute }
  }

  const finishCoreResponse = (response: NextResponse): NextResponse =>
    syncSessionHint(request, mergeThemeHeaders(response, themeResponse))

  // Rewriting a protected original route to a public destination must not
  // discard the original route's boundary. Direct theme responses are also
  // gated here because they otherwise replace the protected route outright.
  let originalAccess: AccessResult = { response: null, session: null, injectIdentity: false }
  if (rewriteDestination || (themeResponse && !isThemeContinuation)) {
    originalAccess = await authorize(originalTarget)
    if (originalAccess.response) return finishCoreResponse(originalAccess.response)
  }

  // A non-routing response is terminal only after the original route's access
  // checks above. Redirects were handled earlier because they disclose no app
  // content and are a supported way for themes to customize navigation.
  if (themeResponse && !isThemeContinuation && !rewriteDestination) {
    return terminalThemeResponse(request, themeResponse)
  }

  const { pathname } = target

  // Redirect historical 3-level docs URLs (/docs/<core|theme>/<section>/<page>)
  // to the current route. That split predates this app's history: `core` and
  // `theme` were the only two categories ever generated (a third, `plugins`,
  // was scaffolded but never activated), and both were collapsed into a single
  // docs tree per source - `public` (served at /docs) and `superadmin` (served
  // at /superadmin/docs) - without renaming any section that survived the
  // collapse. A section from that era can therefore only be in one of the two
  // registries today, or in neither if its docs were dropped rather than
  // moved; the redirect follows the section, not the old category. The page
  // has to survive too - a section can live on with a different set of pages -
  // so both are checked against the registry rather than only the section,
  // which is the one thing this route can actually confirm still resolves.
  const oldDocsMatch = pathname.match(/^\/docs\/(?:core|theme)\/([^/]+)\/([^/]+)$/)
  if (oldDocsMatch) {
    const [, sectionSlug, pageSlug] = oldDocsMatch
    const newUrl = appUrl(request, '/docs')
    newUrl.search = target.search
    const superadminSection = DOCS_REGISTRY.superadmin.find((section) => section.slug === sectionSlug)
    const publicSection = DOCS_REGISTRY.public.find((section) => section.slug === sectionSlug)

    if (superadminSection?.pages.some((page) => page.slug === pageSlug)) {
      newUrl.pathname = `/superadmin/docs/${sectionSlug}/${pageSlug}`
    } else if (publicSection?.pages.some((page) => page.slug === pageSlug)) {
      newUrl.pathname = `/docs/${sectionSlug}/${pageSlug}`
    } else {
      // The section is gone, or survived without this exact page - either way
      // there is no page left to send this to, so it goes to the docs home
      // instead of a dead link.
      newUrl.pathname = '/docs'
    }
    return finishCoreResponse(NextResponse.redirect(newUrl, 301))
  }

  // Documentation access control: docs.publicAccess, or the older
  // docs.public boolean it replaced (see lib/docs/access)
  if (isUnder(pathname, '/docs')) {
    const access = await authorize(target)
    if (access.response) return finishCoreResponse(access.response)
    if (originalAccess.injectIdentity && originalAccess.session) {
      requestHeaders = addVerifiedIdentity(request, requestHeaders, originalAccess.session, pathname)
    }
    if (isMissingDocsPage(pathname)) {
      return rewriteToNotFound(request, requestHeaders, themeResponse)
    }
    return passThrough(request, requestHeaders, themeResponse, rewriteDestination)
  }

  // Allow public paths
  if (isPublicPath(pathname)) {
    if (originalAccess.injectIdentity && originalAccess.session) {
      requestHeaders = addVerifiedIdentity(request, requestHeaders, originalAccess.session, pathname)
    }
    return passThrough(request, requestHeaders, themeResponse, rewriteDestination)
  }

  // API v1 routes handle their own dual authentication
  if (pathname.startsWith('/api/v1')) {
    if (originalAccess.injectIdentity && originalAccess.session) {
      requestHeaders = addVerifiedIdentity(request, requestHeaders, originalAccess.session, pathname)
    }
    return passThrough(request, requestHeaders, themeResponse, rewriteDestination)
  }

  // Protected routes require authentication and inject user headers.
  // Areas are matched by path segment, so /dashboard-guide is not /dashboard.
  // /superadmin and /devtools also need a role, the same ones SuperAdminGuard
  // and DeveloperGuard let in. The guards decide it again in the browser, but
  // only after the page has been served, so it is decided here first.
  const area = protectedArea(pathname)

  if (area) {
    const access = await authorize(target)
    if (access.response) return finishCoreResponse(access.response)
    const session = access.session ?? originalAccess.session
    if (session) requestHeaders = addVerifiedIdentity(request, requestHeaders, session, pathname)

    if (area === 'superadmin' && isMissingDocsPage(pathname)) {
      return rewriteToNotFound(request, requestHeaders, themeResponse)
    }

    return passThrough(request, requestHeaders, themeResponse, rewriteDestination)
  }

  if (originalAccess.injectIdentity && originalAccess.session) {
    requestHeaders = addVerifiedIdentity(request, requestHeaders, originalAccess.session, pathname)
  }
  return passThrough(request, requestHeaders, themeResponse, rewriteDestination)
}

/**
 * Everything runs through the proxy except the exact paths of Next's own
 * output: `_next/static/`, the `_next/image` endpoint and `favicon.ico`.
 * Excluding by file extension, or by a prefix without its boundary, would let a
 * dynamic segment such as `alice.png` or `favicon.icoevil` reach the app without
 * the session check and with forged identity headers intact. Files under
 * public/ simply pass through.
 */
export const config = {
  matcher: [
    '/((?!_next/static/|_next/image$|favicon\\.ico$).*)',
  ],
}
