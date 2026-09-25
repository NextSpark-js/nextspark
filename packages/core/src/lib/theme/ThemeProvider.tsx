'use client'

/**
 * Enhanced Theme Provider for WordPress-like Theme System
 * 
 * Applies the root-first project's theme and integrates component overrides.
 */

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { ThemeConfig } from '../../types/theme'
// Client-safe: holds only each theme's own ThemeConfig, not the full server
// THEME_REGISTRY (which also carries dashboardConfig/appConfig/devConfig and
// used to ship all of it to every page - #207).
import { THEME_REGISTRY } from '@nextsparkjs/registries/theme-registry.client'
import { ImportResolverProvider } from './import-resolver'
import { applyThemeStyles } from './theme-styles'

/** The root-first compiler emits exactly one project entry. */
function getCurrentClientTheme(): ThemeConfig | undefined {
  return Object.values(THEME_REGISTRY)[0]
}

interface ThemeContextType {
  currentTheme: ThemeConfig | null
  loading: boolean
  error?: string
  reloadTheme: () => Promise<void>
}

const ThemeContext = createContext<ThemeContextType | null>(null)

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: string
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [currentTheme, setCurrentTheme] = useState<ThemeConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()

  const loadTheme = React.useCallback(() => {
    try {
      setLoading(true)
      setError(undefined)

      const projectTheme = getCurrentClientTheme()

      if (!projectTheme) {
        throw new Error('Project theme was not generated')
      }

      setCurrentTheme(projectTheme)

      // Apply theme styles synchronously
      if (projectTheme.styles?.globals) {
        applyThemeStyles(projectTheme)
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`[ThemeProvider] Loaded project theme: ${projectTheme.name} (build-time registry)`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('[ThemeProvider] Error loading theme:', error)
      setError(errorMsg)

      // No fallback: the root-first project theme must be present in the registry.
    } finally {
      setLoading(false)
    }
  }, [])

  const reloadTheme = React.useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (currentTheme) {
        loadTheme()
      }
      resolve()
    })
  }, [currentTheme, loadTheme])

  // Load the sole root-first project theme.
  useEffect(() => {
    loadTheme()
  }, [loadTheme])

  // Hot reload support in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const handleHotReload = () => {
        console.log('[ThemeProvider] Hot reload detected, refreshing themes')
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
  }, [currentTheme, reloadTheme])

  const contextValue: ThemeContextType = {
    currentTheme,
    loading,
    error,
    reloadTheme,
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
