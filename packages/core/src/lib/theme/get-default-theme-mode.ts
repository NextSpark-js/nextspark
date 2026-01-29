/**
 * Get Default Theme Mode (Server-Side)
 *
 * Priority:
 * 1. User logged in → use uiPreferences.theme from user meta
 * 2. User not logged in → use defaultMode from theme.config
 */

import { auth } from '../auth'
import { ThemeService } from '../services/theme.service'
import { headers } from 'next/headers'

type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeSettings {
  defaultMode: ThemeMode
  allowUserToggle: boolean
}

/**
 * Get theme settings for the RootLayout
 * Returns defaultMode and whether user can toggle theme
 * Server-side only function
 */
export async function getThemeSettings(): Promise<ThemeSettings> {
  const activeThemeName = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default'
  const themeConfig = ThemeService.getByName(activeThemeName)
  const appConfig = ThemeService.getAppConfig(activeThemeName)

  // Get allowUserToggle from app.config.ts (ui.theme.allowUserToggle)
  // Default to true if not specified
  const allowUserToggle = appConfig?.ui?.theme?.allowUserToggle ?? true

  // Get base defaultMode from theme.config.ts
  const configDefaultMode = (themeConfig?.defaultMode as ThemeMode) || 'system'

  // If user can toggle, try to get their preference
  if (allowUserToggle) {
    const userTheme = await getUserThemePreference()
    if (userTheme) {
      return { defaultMode: userTheme, allowUserToggle }
    }
  }

  return { defaultMode: configDefaultMode, allowUserToggle }
}

const VALID_THEME_MODES: ThemeMode[] = ['light', 'dark', 'system']

/**
 * Validate if a value is a valid ThemeMode
 */
function isValidThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && VALID_THEME_MODES.includes(value as ThemeMode)
}

/**
 * Get user's theme preference from their profile metadata
 */
async function getUserThemePreference(): Promise<ThemeMode | null> {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (session?.user?.id) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173'
      const response = await fetch(`${baseUrl}/api/user/profile?includeMeta=true`, {
        headers: {
          cookie: (await headers()).get('cookie') || '',
        },
        cache: 'no-store'
      })

      if (response.ok) {
        const data = await response.json()
        const theme = data.meta?.uiPreferences?.theme
        if (isValidThemeMode(theme)) {
          return theme
        }
      }
    }
  } catch (error) {
    // Silently fail during static generation
    if (process.env.NODE_ENV === 'development') {
      console.warn('[getThemeSettings] Failed to fetch user preference:', error)
    }
  }
  return null
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