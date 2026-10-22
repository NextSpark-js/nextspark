/**
 * Dashboard landing route
 *
 * `homeRoute` in dashboard.config: where a signed-in user lands when nothing asked for another page. A path, or a
 * map from a user role to a path with a `default` key for the roles it does not list. Without it, `/dashboard`.
 * A path must be on this app (same rules as a `callbackUrl`, see callback-url.ts): an absolute URL, `//host` and
 * `/\host` would take the user to another site right after they sign in.
 */
import { safeCallbackPath } from './callback-url'

export type HomeRouteConfig = string | Record<string, string>

export const DEFAULT_HOME_ROUTE = '/dashboard'

const hasOwn = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key)

const isMap = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

function assertPath(value: unknown, where: string): void {
  if (typeof value !== 'string' || safeCallbackPath(value) === null) {
    throw new Error(
      `dashboard.homeRoute${where} must be a path inside the app that starts with a single "/" (for example "/dashboard/tasks"); got ${JSON.stringify(value)}.`
    )
  }
}

/** Throws a clear error when the `homeRoute` of a dashboard config is not a path (or a map of paths) on this app. */
export function assertHomeRoute(dashboardConfig: object | undefined): void {
  const homeRoute = (dashboardConfig as { homeRoute?: unknown } | undefined)?.homeRoute
  if (homeRoute === undefined) return
  if (isMap(homeRoute)) {
    for (const [role, path] of Object.entries(homeRoute)) assertPath(path, `["${role}"]`)
    return
  }
  assertPath(homeRoute, '')
}

// The roles each restricted area lets in (the proxy and routes/_internal/area-access apply the same rules)
const AREA_ROLES: Record<string, readonly string[]> = {
  admin: ['superadmin', 'developer'],
  superadmin: ['superadmin', 'developer'],
  devtools: ['developer'],
}

/** Whether `path` is inside a restricted area that `role` cannot open. */
function isClosedArea(path: string, role?: string | null): boolean {
  const area = path.split(/[/?#]/)[1]?.toLowerCase()
  if (!area || !hasOwn(AREA_ROLES, area)) return false
  return !(typeof role === 'string' && AREA_ROLES[area].includes(role))
}

/**
 * The landing path for a user with `role`: the configured string, the entry of the map for the role or its
 * `default`, else `/dashboard`. A value that is not an in-app path (a config that skipped assertHomeRoute) is
 * never used, and neither is one inside /admin, /superadmin or /devtools for a role that cannot open it (that
 * would send the user back to the access-denied redirect forever). A trailing slash of the path is dropped.
 */
export function resolveHomeRoute(dashboardConfig: object | undefined, role?: string | null): string {
  const homeRoute = (dashboardConfig as { homeRoute?: unknown } | undefined)?.homeRoute
  let chosen: unknown = homeRoute
  if (isMap(homeRoute)) {
    chosen = typeof role === 'string' && hasOwn(homeRoute, role) ? homeRoute[role] : hasOwn(homeRoute, 'default') ? homeRoute.default : undefined
  }
  const safe = typeof chosen === 'string' ? safeCallbackPath(chosen) : null
  if (!safe) return DEFAULT_HOME_ROUTE
  const url = new URL(safe, 'http://callback.invalid')
  const path = `${url.pathname.replace(/\/+$/, '') || '/'}${url.search}${url.hash}`
  return isClosedArea(path, role) ? DEFAULT_HOME_ROUTE : path
}

/** Where a signed-in user without the role an area needs goes: their landing route with `error=access_denied`. */
export function accessDeniedPath(dashboardConfig: object | undefined, role?: string | null): string {
  const url = new URL(resolveHomeRoute(dashboardConfig, role), 'http://callback.invalid')
  url.searchParams.set('error', 'access_denied')
  return `${url.pathname}${url.search}${url.hash}`
}
