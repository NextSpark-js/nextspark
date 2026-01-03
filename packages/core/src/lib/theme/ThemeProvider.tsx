'use client'

/**
 * Enhanced Theme Provider for WordPress-like Theme System
 * 
 * Manages theme loading, component overrides, hot swapping, and integrates with import resolver
 */

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { ThemeConfig } from '../../types/theme'
import { ThemeService } from '../services/theme.service'
import { ImportResolverProvider } from './import-resolver'
import { applyThemeStyles } from './theme-loader'

interface ThemeContextType {
  currentTheme: ThemeConfig | null
  availableThemes: ThemeConfig[]
  loading: boolean
  error?: string
  switchTheme: (themeName: string) => Promise<boolean>
  reloadTheme: () => Promise<void>
  refreshThemes: () => Promise<void>
}

const ThemeContext = createContext<ThemeContextType | null>(null)

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: string
}

export function ThemeProvider({ children, defaultTheme = 'default' }: ThemeProviderProps) {
  const [currentTheme, setCurrentTheme] = useState<ThemeConfig | null>(null)
  const [availableThemes, setAvailableThemes] = useState<ThemeConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()

  const loadTheme = React.useCallback((themeName?: string) => {
    try {
      setLoading(true)
      setError(undefined)

      // Get theme name from parameter or env only (no hardcoded fallback)
      const activeThemeName = themeName || process.env.NEXT_PUBLIC_ACTIVE_THEME

      // Load theme from registry (ultra-fast, zero I/O)
      const activeTheme = ThemeService.getByName(activeThemeName || '')

      if (!activeTheme) {
        throw new Error(`Theme not found: ${activeThemeName}`)
      }

      setCurrentTheme(activeTheme)

      // Apply theme styles synchronously
      if (activeTheme.styles?.globals) {
        applyThemeStyles(activeTheme)
      }

      console.log(`[ThemeProvider] Loaded theme: ${activeTheme.name} (build-time registry)`)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('[ThemeProvider] Error loading theme:', error)
      setError(errorMsg)

      // No fallback - theme must be specified in ENV
    } finally {
      setLoading(false)
    }
  }, [])

  const loadAvailableThemes = React.useCallback(() => {
    try {
      // Load themes from registry (ultra-fast, zero I/O)
      const themes = ThemeService.getAll()
      setAvailableThemes(themes)
      console.log(`[ThemeProvider] Loaded ${themes.length} themes from registry`)
    } catch (error) {
      console.error('[ThemeProvider] Error loading themes:', error)
      setAvailableThemes([])
    }
  }, [])

  const switchTheme = (themeName: string): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        setLoading(true)
        loadTheme(themeName)

        // Persist theme preference
        if (typeof window !== 'undefined') {
          localStorage.setItem('selected-theme', themeName)
          console.log(`[ThemeProvider] Persisted theme preference: ${themeName}`)
        }

        resolve(true)
      } catch (error) {
        console.error('[ThemeProvider] Failed to switch theme:', error)
        resolve(false)
      }
    })
  }

  const reloadTheme = React.useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (currentTheme) {
        console.log(`[ThemeProvider] Reloading theme: ${currentTheme.name}`)
        loadTheme(currentTheme.name)
      }
      resolve()
    })
  }, [currentTheme, loadTheme])

  const refreshThemes = React.useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      console.log('[ThemeProvider] Refreshing available themes')
      loadAvailableThemes()
      resolve()
    })
  }, [loadAvailableThemes])

  // Load initial theme and discover available themes
  useEffect(() => {
    const initTheme = async () => {
      // Only use ENV variable - ignore defaultTheme prop and localStorage
      const themeToLoad = process.env.NEXT_PUBLIC_ACTIVE_THEME

      if (themeToLoad) {
        console.log(`[ThemeProvider] Using ENV theme: ${themeToLoad}`)
      } else {
        console.warn('[ThemeProvider] No NEXT_PUBLIC_ACTIVE_THEME set in ENV')
      }

      // Load themes and initial theme synchronously
      loadAvailableThemes()
      loadTheme(themeToLoad)
    }

    initTheme()
  }, [loadAvailableThemes, loadTheme])

  // Hot reload support in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const handleHotReload = () => {
        console.log('[ThemeProvider] Hot reload detected, refreshing themes')
        refreshThemes()
        if (currentTheme) {
          reloadTheme()
        }
      }

      // Listen for hot reload events (basic implementation)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof window !== 'undefined' && (window as any).webpackHotUpdate) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).addEventListener('webpack-hot-update', handleHotReload)
        
        return () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).removeEventListener('webpack-hot-update', handleHotReload)
        }
      }
    }
  }, [currentTheme, refreshThemes, reloadTheme])

  const contextValue: ThemeContextType = {
    currentTheme,
    availableThemes,
    loading,
    error,
    switchTheme,
    reloadTheme,
    refreshThemes
  }

  return (
    <ThemeContext.Provider value={contextValue}>
      <ImportResolverProvider theme={currentTheme}>
        {children}
      </ImportResolverProvider>
    </ThemeContext.Provider>
  )
}

/**
 * Hook to use theme context
 */
export function useTheme() {
  const context = useContext(ThemeContext)
  
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  
  return context
}

/**
 * Hook to check if component has an override
 */
export function useComponentOverride(componentPath: string) {
  const { currentTheme } = useTheme()
  
  const override = currentTheme?.components?.overrides?.[componentPath]
  
  return {
    hasOverride: !!override,
    Override: override,
    originalPath: componentPath,
    themeName: currentTheme?.name
  }
}

/**
 * Hook to get custom theme components
 */
export function useCustomComponent(componentName: string) {
  const { currentTheme } = useTheme()
  
  const customComponent = currentTheme?.components?.custom?.[componentName]
  
  return {
    hasCustom: !!customComponent,
    CustomComponent: customComponent,
    themeName: currentTheme?.name
  }
}

/**
 * Hook to get theme configuration values
 */
export function useThemeConfig() {
  const { currentTheme } = useTheme()
  
  return {
    colors: currentTheme?.config?.colors || {},
    fonts: currentTheme?.config?.fonts || {},
    spacing: currentTheme?.config?.spacing || {},
    breakpoints: currentTheme?.config?.breakpoints || {},
    themeName: currentTheme?.name
  }
}