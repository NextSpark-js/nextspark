/**
 * Route-based forced theme
 *
 * Resolves the theme that must be forced for a given pathname from the
 * `forcedThemeRoutes` map declared in `theme.config.ts`. The result is passed
 * to next-themes' `forcedTheme` prop on the single root ThemeProvider, so the
 * blocking script, SSR output and client hydration all agree from the very
 * first paint (no flash, no post-hydration correction).
 *
 * Matching rules:
 * - Keys are route prefixes matched at segment boundaries:
 *   `'/login'` matches `/login` and `/login/verify`, but not `/login-help`.
 * - `'/'` matches every route.
 * - When several prefixes match, the longest (most specific) one wins.
 * - Query strings, hashes and trailing slashes are ignored.
 *
 * @example
 * forcedThemeRoutes: { '/login': 'light', '/signup': 'light', '/embed': 'dark' }
 */

export type ForcedThemeMode = 'light' | 'dark'

/** Route prefix → theme to force on that route subtree */
export type ForcedThemeRoutes = Record<string, ForcedThemeMode>

const FORCED_THEME_MODES: readonly ForcedThemeMode[] = ['light', 'dark']

function isForcedThemeMode(value: unknown): value is ForcedThemeMode {
  return typeof value === 'string' && (FORCED_THEME_MODES as readonly string[]).includes(value)
}

/**
 * Normalize a pathname or route pattern for comparison:
 * strips query/hash, ensures a leading slash and removes trailing slashes.
 */
function normalizePath(value: string): string {
  let path = value.split(/[?#]/)[0].trim()
  if (!path.startsWith('/')) path = `/${path}`
  path = path.replace(/\/+$/, '')
  return path === '' ? '/' : path
}

/**
 * Resolve the forced theme for a pathname.
 *
 * Pure function (no Next.js imports) so it can run on the server, in client
 * components and in unit tests.
 *
 * @param pathname - Current pathname (e.g. from `usePathname()` or the `x-pathname` header)
 * @param routes - `forcedThemeRoutes` from the active theme config
 * @returns The theme to force, or `undefined` when the route is not forced
 */
export function resolveForcedTheme(
  pathname: string | null | undefined,
  routes: ForcedThemeRoutes | null | undefined
): ForcedThemeMode | undefined {
  if (!pathname || !routes) return undefined

  const path = normalizePath(pathname)
  let best: { length: number; theme: ForcedThemeMode } | undefined

  for (const [pattern, theme] of Object.entries(routes)) {
    if (!isForcedThemeMode(theme)) continue

    const prefix = normalizePath(pattern)
    const matches = prefix === '/' || path === prefix || path.startsWith(`${prefix}/`)

    if (matches && (!best || prefix.length > best.length)) {
      best = { length: prefix.length, theme }
    }
  }

  return best?.theme
}
