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

export function ThemeProvider({ children, forcedThemeRoutes, forcedTheme, ...props }: ThemeProviderProps) {
  const pathname = usePathname()
  const routeForcedTheme = resolveForcedTheme(pathname, forcedThemeRoutes)

  return (
    <NextThemesProvider {...props} forcedTheme={routeForcedTheme ?? forcedTheme}>
      {children}
    </NextThemesProvider>
  )
}
