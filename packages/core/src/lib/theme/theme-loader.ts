/**
 * Theme Loader with Build-Time Registry
 *
 * Loads themes from build-time registry for ultra-fast performance (zero I/O)
 */

import type { ThemeConfig } from '../../types/theme'
import { ThemeService } from '../services/theme.service'
import { preloadThemeOverrides, clearOverrideCache } from './override-resolver'

/**
 * No caching needed - registry provides instant access
 * Build-time registry eliminates all runtime I/O operations
 */

/**
 * Get all available themes from build-time registry (ultra-fast, zero I/O)
 */
export function getThemes(): ThemeConfig[] {
  return ThemeService.getAll()
}

/**
 * Load a specific theme configuration from registry (ultra-fast, zero I/O)
 */
export function loadThemeConfig(themeName: string): ThemeConfig | null {
  const theme = ThemeService.getByName(themeName)

  if (!theme) {
    console.error(`[Theme] Theme not found in registry: ${themeName}`)
    return null
  }

  console.log(`[Theme] Loaded theme from registry: ${themeName}`)
  return theme
}

/**
 * Load theme with all its dependencies and overrides (synchronous, zero I/O)
 */
export function loadThemeWithDependencies(themeName: string): ThemeConfig | null {
  const theme = loadThemeConfig(themeName)

  if (!theme) {
    return null
  }

  // Load parent theme if specified
  if (theme.parent) {
    console.log(`[Theme] Loading parent theme: ${theme.parent}`)
    const parentTheme = loadThemeWithDependencies(theme.parent)

    if (parentTheme) {
      // Merge parent theme configuration
      const mergedTheme: ThemeConfig = {
        ...parentTheme,
        ...theme,
        components: {
          ...parentTheme.components,
          ...theme.components,
          overrides: {
            ...parentTheme.components?.overrides,
            ...theme.components?.overrides
          }
        },
        config: {
          ...parentTheme.config,
          ...theme.config
        }
      }

      console.log(`[Theme] Merged theme ${themeName} with parent ${theme.parent}`)
      return mergedTheme
    }
  }

  return theme
}

/**
 * Apply a theme with preloading and caching (synchronous, zero I/O)
 */
export function applyThemeWithOptimizations(themeName: string): boolean {
  try {
    console.log(`[Theme] Applying theme: ${themeName}`)

    // Load theme with dependencies (instant from registry)
    const theme = loadThemeWithDependencies(themeName)

    if (!theme) {
      console.error(`[Theme] Failed to load theme: ${themeName}`)
      return false
    }

    // Clear old override cache for clean slate
    clearOverrideCache()

    // Preload component overrides for better performance
    preloadThemeOverrides(theme)

    // Apply theme styles
    if (theme.styles?.globals) {
      applyThemeStyles(theme)
    }

    console.log(`[Theme] Successfully applied theme: ${themeName}`)
    return true

  } catch (error) {
    console.error(`[Theme] Error applying theme ${themeName}:`, error)
    return false
  }
}

// Store current theme for dark mode observer
let currentThemeConfig: ThemeConfig | null = null
let darkModeObserver: MutationObserver | null = null

/**
 * Check if dark mode is active
 */
function isDarkMode(): boolean {
  if (typeof window === 'undefined') return false
  return document.documentElement.classList.contains('dark')
}

/**
 * Apply color variables to root element
 */
function applyColorVariables(colors: Record<string, unknown>): void {
  const root = document.documentElement
  Object.entries(colors).forEach(([key, value]) => {
    // Apply as base variable (e.g., --primary, --background)
    root.style.setProperty(`--${key}`, String(value))
    // Also apply with theme prefix for backwards compatibility
    root.style.setProperty(`--theme-color-${key}`, String(value))
  })
}

/**
 * Apply the correct colors based on current mode (light/dark)
 */
function applyCurrentModeColors(theme: ThemeConfig): void {
  const darkMode = isDarkMode()
  const colors = darkMode && theme.config?.darkColors
    ? theme.config.darkColors
    : theme.config?.colors

  if (colors) {
    applyColorVariables(colors)
    console.log(`[Theme] Applied ${darkMode ? 'dark' : 'light'} mode colors for theme: ${theme.name}`)
  }
}

/**
 * Setup observer to watch for dark mode changes
 */
function setupDarkModeObserver(theme: ThemeConfig): void {
  if (typeof window === 'undefined') return

  // Clean up existing observer
  if (darkModeObserver) {
    darkModeObserver.disconnect()
  }

  // Create new observer
  darkModeObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class') {
        console.log('[Theme] Dark mode class changed, reapplying colors')
        applyCurrentModeColors(theme)
      }
    }
  })

  // Observe class changes on html element
  darkModeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })

  console.log('[Theme] Dark mode observer initialized')
}

/**
 * Apply theme styles to the document (exported for ThemeProvider)
 *
 * This applies the base shadcn CSS variables directly to :root
 * to ensure theme colors work even if CSS file bundling fails.
 * Also sets up observer for dark mode changes.
 */
export function applyThemeStyles(theme: ThemeConfig): void {
  if (typeof window === 'undefined') {
    // Server-side: styles will be applied via CSS imports
    return
  }

  try {
    const root = document.documentElement
    currentThemeConfig = theme

    // Apply colors based on current mode (light/dark)
    applyCurrentModeColors(theme)

    // Setup observer to react to dark mode changes
    setupDarkModeObserver(theme)

    // Apply font variables
    if (theme.config?.fonts) {
      Object.entries(theme.config.fonts).forEach(([key, value]) => {
        root.style.setProperty(`--font-${key}`, String(value))
        root.style.setProperty(`--theme-font-${key}`, String(value))
      })
    }

    // Apply spacing/radius variables
    if (theme.config?.spacing) {
      Object.entries(theme.config.spacing).forEach(([key, value]) => {
        root.style.setProperty(`--${key}`, String(value))
      })
    }

    // Apply shadow variables
    if (theme.config?.shadows) {
      Object.entries(theme.config.shadows).forEach(([key, value]) => {
        root.style.setProperty(`--${key}`, String(value))
      })
    }

    console.log(`[Theme] Applied CSS variables for theme: ${theme.name}`)

  } catch (error) {
    console.error('[Theme] Error applying theme styles:', error)
  }
}

/**
 * Cleanup dark mode observer (call when unmounting)
 */
export function cleanupThemeObserver(): void {
  if (darkModeObserver) {
    darkModeObserver.disconnect()
    darkModeObserver = null
  }
}

/**
 * Get theme loading statistics (registry-based, zero overhead)
 */
export function getThemeLoadingStats(): {
  totalThemes: number
  loadMethod: string
  performanceNotes: string
} {
  const themes = ThemeService.getAll()
  return {
    totalThemes: themes.length,
    loadMethod: 'build-time-registry',
    performanceNotes: 'Ultra-fast loading via static registry (zero I/O, <3ms)'
  }
}

/**
 * Clear theme override cache (useful for development)
 * Note: Main theme registry is immutable and requires no cache clearing
 */
export function clearThemeCache(): void {
  clearOverrideCache()
  console.log('[Theme] Cleared theme override cache (registry is immutable)')
}

/**
 * Validate theme configuration
 */
export function validateThemeConfig(theme: ThemeConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!theme.name) {
    errors.push('Theme name is required')
  }
  
  if (!theme.displayName) {
    errors.push('Theme display name is required')
  }
  
  if (!theme.version) {
    errors.push('Theme version is required')
  }
  
  if (theme.parent && theme.parent === theme.name) {
    errors.push('Theme cannot be its own parent')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}