/**
 * Theme Settings (Server-Side)
 *
 * The theme mode the root layout starts from, taken from configuration alone:
 * `defaultMode` and `forcedThemeRoutes` from theme.config.ts, `allowUserToggle`
 * from app.config.ts. Nothing is read from the request, so the pages that use it
 * can be prerendered. A visitor's own choice is the theme provider's to apply from
 * localStorage before first paint; a signed-in user's saved choice reaches a
 * browser that has none through SessionCookieRefresher.
 */

import { ThemeService } from '../services/theme.service'
import type { ForcedThemeRoutes } from './forced-theme'

type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeSettings {
  defaultMode: ThemeMode
  allowUserToggle: boolean
  /** Route prefixes whose theme is forced (theme.config.ts → forcedThemeRoutes) */
  forcedThemeRoutes?: ForcedThemeRoutes
}

/**
 * Get theme settings for the RootLayout
 * Returns defaultMode and whether user can toggle theme
 * Server-side only function
 */
export async function getThemeSettings(): Promise<ThemeSettings> {
  const themeConfig = ThemeService.getCurrent()
  const appConfig = ThemeService.getCurrentAppConfig()

  // Get allowUserToggle from app.config.ts (ui.theme.allowUserToggle)
  // Default to true if not specified
  const allowUserToggle = appConfig?.ui?.theme?.allowUserToggle ?? true

  // Get base defaultMode from theme.config.ts
  const defaultMode = (themeConfig?.defaultMode as ThemeMode) || 'system'

  // Per-route forced themes from theme.config.ts. Resolved against the current
  // pathname by the root ThemeProvider (see lib/theme/forced-theme.ts).
  const forcedThemeRoutes = themeConfig?.forcedThemeRoutes

  return { defaultMode, allowUserToggle, forcedThemeRoutes }
}

/**
 * The theme props both root layouts give the theme provider. With `allowUserToggle: false` the default mode is
 * forced, and the system preference is tracked only when that mode is "system" (the default when theme.config sets
 * none), so the forced mode resolves to the device's light or dark. Otherwise the visitor's choice applies, and
 * "System" must be resolvable whatever the default is, since ThemeToggle always offers it (#175, #371).
 */
export function themeProviderProps({ defaultMode, allowUserToggle }: Pick<ThemeSettings, 'defaultMode' | 'allowUserToggle'>) {
  return {
    defaultTheme: defaultMode,
    forcedTheme: allowUserToggle ? undefined : defaultMode,
    enableSystem: allowUserToggle || defaultMode === 'system',
  }
}

/**
 * Get the default theme mode for the current user
 * Server-side only function
 * @deprecated Use getThemeSettings() instead for full theme configuration
 */
export async function getDefaultThemeMode(): Promise<ThemeMode> {
  const { defaultMode } = await getThemeSettings()
  return defaultMode
}
