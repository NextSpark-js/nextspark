"use client"

import { usePathname } from "next/navigation"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps as NextThemesProviderProps } from "next-themes"
import { resolveForcedTheme, type ForcedThemeRoutes } from "../lib/theme/forced-theme"

export interface ThemeProviderProps extends NextThemesProviderProps {
  /**
   * Routes whose theme is forced regardless of user/system preference
   * (`theme.config.ts` → `forcedThemeRoutes`).
   *
   * Resolved here, on the client, against `usePathname()` instead of once in
   * the root layout from request headers: the root layout does not re-render
   * on client-side navigations, so a server-computed value would go stale as
   * soon as the user navigated into or out of a forced route. On the initial
   * request this component is still server-rendered, so next-themes' blocking
   * script receives the forced value and there is no flash.
   *
   * Takes precedence over the plain `forcedTheme` prop.
   */
  forcedThemeRoutes?: ForcedThemeRoutes
}

/**
 * Reads the pathname, so it is only rendered when the app declares forced routes. `usePathname()` is
 * runtime data for a route with dynamic segments: with Cache Components a component that reads it
 * outside Suspense fails the prerender, and this provider sits at the top of the root layout.
 */
function RouteForcedThemeProvider({ children, forcedThemeRoutes, forcedTheme, ...props }: ThemeProviderProps & { forcedThemeRoutes: ForcedThemeRoutes }) {
  const pathname = usePathname()
  const routeForcedTheme = resolveForcedTheme(pathname, forcedThemeRoutes)

  return (
    <NextThemesProvider {...props} forcedTheme={routeForcedTheme ?? forcedTheme}>
      {children}
    </NextThemesProvider>
  )
}

export function ThemeProvider({ children, forcedThemeRoutes, forcedTheme, ...props }: ThemeProviderProps) {
  if (forcedThemeRoutes && Object.keys(forcedThemeRoutes).length > 0) {
    return (
      <RouteForcedThemeProvider {...props} forcedTheme={forcedTheme} forcedThemeRoutes={forcedThemeRoutes}>
        {children}
      </RouteForcedThemeProvider>
    )
  }

  return (
    <NextThemesProvider {...props} forcedTheme={forcedTheme}>
      {children}
    </NextThemesProvider>
  )
}
