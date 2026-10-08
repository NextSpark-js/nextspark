/**
 * Protected areas in a project's proxy (#203, S21)
 *
 * core checks the /superadmin and /devtools roles on the server whatever the proxy does, but only the proxy can refuse
 * a signed-in user without the role with a 307 before anything renders (a Cache Components page has sent its shell
 * with a 200 by then), and core's proxy template does it. A project owns its proxy (`src/proxy.ts`), so one copied
 * before the template gained the check, or written by hand, may not have it: `nextspark prepare` (and `migrate`, in
 * the CLI) warn, naming each area the proxy never mentions.
 *
 * Same for the session check (S80): a proxy copied before 0.1.0-beta.196 fetches its own /api/auth/get-session from
 * the request's origin, which behind a proxy that terminates TLS is https on a plain-HTTP port, so every signed-in
 * user is sent to /login. That copy is never updated by an upgrade, so prepare and migrate say what to change.
 *
 * @module core/scripts/build/registry/host/proxy-areas
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const PROXY_AREA_WARNING = 'NS_PROXY_PROTECTED_AREA_MISSING'

/** The areas and the roles core's proxy template lets into each. */
export const PROTECTED_AREAS = Object.freeze([
  { path: '/superadmin', roles: 'superadmin or developer' },
  { path: '/devtools', roles: 'developer' },
])

/** Where Next loads a project's proxy from, next to the generated src/app. */
export const PROXY_FILES = Object.freeze(['src/proxy.ts', 'src/proxy.js', 'src/middleware.ts', 'src/middleware.js'])

/**
 * A proxy that re-exports core's template under its own name (apps/dev does) has the check without naming the areas
 * itself. Exact name (`proxy as x` is not the proxy Next loads), a concrete specifier (the package, or the repository's
 * packages/core), and only code: a commented-out line does not count.
 */
const REEXPORTS_CORE_PROXY =
  /^\s*export\s*\{\s*(?:[\w$]+\s*,\s*)*proxy\s*(?:,[^}]*)?\}\s*from\s*['"](?:@nextsparkjs\/core|(?:\.\.\/)+packages\/core)\/templates\/proxy(?:\.ts)?['"]/m
/**
 * The source without its comments (`//` to the end of the line, wherever it starts, and block comments). String
 * literals are kept whole, so a `/*` or `//` inside one is text. Not parsed: regular-expression literals (a quote in
 * one can hide the code after it) and template-literal `${}` nesting; nor does the session detector follow a URL
 * assembled from parts. No template that copied the HTTP session check needs either.
 */
export function withoutComments(source) {
  let out = ''
  let quote = null
  for (let i = 0; i < source.length; i++) {
    const c = source[i]
    if (quote) {
      out += c
      if (c === '\\') out += source[++i] ?? ''
      else if (c === quote) quote = null
    } else if (c === '/' && source[i + 1] === '/') {
      while (i + 1 < source.length && source[i + 1] !== '\n') i++
    } else if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2)
      i = end < 0 ? source.length : end + 1
      out += ' '
    } else {
      if (c === "'" || c === '"' || c === '`') quote = c
      out += c
    }
  }
  return out
}

/** A proxy built on core's proxy entry (the scaffold's facade, or createProxy) has core's checks. */
const USES_CORE_PROXY = /['"]@nextsparkjs\/core\/proxy['"]/

/** The protected areas a proxy's source never names as a path (`'/superadmin'`, `"/devtools"`, `` `/devtools` ``). */
export function missingProxyAreas(source) {
  const code = withoutComments(source)
  if (REEXPORTS_CORE_PROXY.test(code) || USES_CORE_PROXY.test(code)) return []
  return PROTECTED_AREAS.filter(area => !new RegExp(`['"\`]${area.path}(?![\\w-])`).test(source))
}

/** The warning for one proxy file whose source misses some areas, or null. */
export function proxyAreaNotice(file, source) {
  const missing = missingProxyAreas(source)
  if (missing.length === 0) return null
  return {
    code: PROXY_AREA_WARNING,
    target: file,
    areas: missing.map(area => area.path),
    message:
      `${file} does not protect ${missing.map(area => area.path).join(' or ')}. core still refuses those pages on the server, ` +
      `but without the proxy check a signed-in user without the role gets a 200 with a client-side redirect instead of a 307. ` +
      `Add the protected-area check of node_modules/@nextsparkjs/core/templates/proxy.ts (protectedArea / authorize): ` +
      `${missing.map(area => `${area.path} needs ${area.roles}`).join(', ')}; no session goes to /login?callbackUrl=..., ` +
      `a session without the role to /dashboard?error=access_denied`,
  }
}

export const PROXY_SESSION_WARNING = 'NS_PROXY_SESSION_OVER_HTTP'

/** What to write instead of the HTTP session check; migrate in the CLI says the same. */
export const PROXY_SESSION_FIX =
  "import { auth } from '@nextsparkjs/core/lib/auth' and replace the betterFetch('/api/auth/get-session', ...) call with " +
  "auth.api.getSession({ headers: new Headers({ cookie: request.headers.get('cookie') || '' }), query: { disableRefresh: true, disableCookieCache: true } }), " +
  'which returns the session itself (or null), not { data }'

/** The warning for a proxy whose code (not a comment) asks /api/auth/get-session over HTTP, or null. */
export function proxySessionNotice(file, source) {
  if (!withoutComments(source).includes('/api/auth/get-session')) return null
  return {
    code: PROXY_SESSION_WARNING,
    target: file,
    message:
      `${file} checks the session by fetching /api/auth/get-session from the request's own origin. Behind a proxy that ` +
      `terminates TLS (X-Forwarded-Proto: https) that origin is https on a port that speaks plain HTTP: the fetch fails ` +
      `and every signed-in user is sent to /login. Read the session in process, as ` +
      `node_modules/@nextsparkjs/core/templates/proxy.ts does: ${PROXY_SESSION_FIX}`,
  }
}

export const PROXY_SESSION_CACHED_WARNING = 'NS_PROXY_SESSION_CACHED'

/** What to add to an in-process session read (the 0.1.0-beta.196 template); migrate in the CLI says the same. */
export const PROXY_SESSION_CACHED_FIX =
  "add disableCookieCache: true to the query of its auth.api.getSession call: query: { disableRefresh: true, disableCookieCache: true }, " +
  "and refuse a suspended account's session at the end of getSession: return session && (session.user as { role?: unknown }).role !== 'suspended' ? (session as Session) : null"

/**
 * The warning for a proxy whose code (not a comment) reads the session in process (auth.api.getSession, as the
 * 0.1.0-beta.196 template) without disableCookieCache, or without refusing a suspended account, or null: Better Auth
 * then answers from the cached session_data cookie, so a signed-out cookie pair or an old role passes the proxy for up
 * to 5 minutes, and a suspended account's session passes it.
 */
export function proxySessionCachedNotice(file, source) {
  const code = withoutComments(source)
  if (!code.includes('auth.api.getSession(') || (code.includes('disableCookieCache') && code.includes("'suspended'"))) return null
  return {
    code: PROXY_SESSION_CACHED_WARNING,
    target: file,
    message:
      `${file} reads the session with auth.api.getSession from Better Auth's cookie cache: after a sign-out, the copied cookie ` +
      `pair, or a role changed since sign-in, still passes the proxy until the cached cookie expires (5 minutes by default), ` +
      `and a suspended account's session passes it. ` +
      `As node_modules/@nextsparkjs/core/templates/proxy.ts does, ${PROXY_SESSION_CACHED_FIX}`,
  }
}

/** The warnings for the proxy Next would load in `projectRoot` (the first of PROXY_FILES that exists). */
export function proxyAreaNotices(projectRoot) {
  if (!projectRoot) return []
  const file = PROXY_FILES.find(candidate => existsSync(join(projectRoot, candidate)))
  if (!file) return []
  const source = readFileSync(join(projectRoot, file), 'utf8')
  return [proxyAreaNotice(file, source), proxySessionNotice(file, source), proxySessionCachedNotice(file, source)].filter(Boolean)
}
