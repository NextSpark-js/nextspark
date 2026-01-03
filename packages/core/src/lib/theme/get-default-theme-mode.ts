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

/**
 * Get the default theme mode for the current user
 * Server-side only function
 */
export async function getDefaultThemeMode(): Promise<ThemeMode> {
  try {
    // Get current session
    const session = await auth.api.getSession({
      headers: await headers()
    })

    // If user is logged in, try to get their theme preference from user meta
    if (session?.user?.id) {
      try {
        // Fetch user profile with metadata
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173'
        const response = await fetch(`${baseUrl}/api/user/profile?includeMeta=true`, {
          headers: {
            cookie: (await headers()).get('cookie') || '',
          },
          cache: 'no-store'
        })

        if (response.ok) {
          const data = await response.json()

          // Check if user has uiPreferences.theme in metadata
          if (data.meta?.uiPreferences?.theme) {
            const userTheme = data.meta.uiPreferences.theme as ThemeMode
            return userTheme
          }
        }
      } catch (error) {
        // Continue to fallback - silently fail during static generation
      }
    }
  } catch (error) {
    // Silently fail during static generation when headers() is not available
  }

  // Fallback: use theme.config defaultMode
  try {
    const activeThemeName = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default'
    const themeConfig = ThemeService.getByName(activeThemeName)

    const defaultMode = (themeConfig?.defaultMode as ThemeMode) || 'system'
    return defaultMode
  } catch (error) {
    // Ultimate fallback
    return 'system'
  }
}