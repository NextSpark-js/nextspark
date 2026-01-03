/**
 * Theme Import Resolver
 * 
 * Resolves imports to prioritize theme overrides over core components
 * Provides seamless component replacement with hot reload support
 */

'use client'

import React from 'react'
import type { ThemeConfig } from '../../types/theme'

/**
 * Component cache for resolved overrides
 */
const componentCache = new Map<string, React.ComponentType<unknown>>()

/**
 * Theme context for accessing current theme
 */
interface ImportResolverContextType {
  currentTheme: ThemeConfig | null
  resolveComponent: <T>(path: string, fallback: T) => Promise<T | React.ComponentType<unknown>>
  clearComponentCache: () => void
}

const ImportResolverContext = React.createContext<ImportResolverContextType | null>(null)

/**
 * Provider that manages component resolution
 */
export function ImportResolverProvider({
  children,
  theme
}: {
  children: React.ReactNode
  theme: ThemeConfig | null
}) {
  const resolveComponent = React.useCallback(
    async function resolveComponentImpl<T>(
      componentPath: string,
      fallback: T
    ): Promise<T | React.ComponentType<unknown>> {
    if (!theme) {
      return fallback
    }

    const cacheKey = `${theme.name}:${componentPath}`
    
    // Check cache first
    const cached = componentCache.get(cacheKey)
    if (cached) {
      return cached
    }

    try {
      // Check if theme has an override for this component
      const override = theme.components?.overrides?.[componentPath]
      
      if (override) {
        let resolvedComponent: React.ComponentType<unknown>
        
        if (typeof override === 'function') {
          // Dynamic import function
          const imported = await override()
          resolvedComponent = imported.default || imported
        } else {
          // Direct component reference
          resolvedComponent = override
        }
        
        // Cache the resolved component
        componentCache.set(cacheKey, resolvedComponent)
        
        console.log(`[ImportResolver] Using override for ${componentPath} from theme ${theme.name}`)
        return resolvedComponent
      }
      
      // No override found, return fallback
      return fallback
      
    } catch (error) {
      console.error(`[ImportResolver] Error resolving component ${componentPath}:`, error)
      return fallback
    }
  }, [theme])

  const clearComponentCache = React.useCallback(() => {
    componentCache.clear()
    console.log('[ImportResolver] Component cache cleared')
  }, [])

  // Clear cache when theme changes
  React.useEffect(() => {
    clearComponentCache()
  }, [theme?.name, clearComponentCache])

  const contextValue: ImportResolverContextType = {
    currentTheme: theme,
    resolveComponent,
    clearComponentCache
  }

  return (
    <ImportResolverContext.Provider value={contextValue}>
      {children}
    </ImportResolverContext.Provider>
  )
}

/**
 * Hook to use the import resolver
 */
export function useImportResolver() {
  const context = React.useContext(ImportResolverContext)
  
  if (!context) {
    throw new Error('useImportResolver must be used within ImportResolverProvider')
  }
  
  return context
}

/**
 * HOC to automatically resolve component overrides
 */
export function withThemeOverride<T extends React.ComponentType<unknown>>(
  componentPath: string,
  OriginalComponent: T
): T {
  const WrappedComponent = React.forwardRef<unknown, React.ComponentProps<T>>((props, ref) => {
    const { resolveComponent } = useImportResolver()
    const [ResolvedComponent, setResolvedComponent] = React.useState<T | React.ComponentType<unknown>>(OriginalComponent)

    React.useEffect(() => {
      resolveComponent(componentPath, OriginalComponent).then(resolved => {
        setResolvedComponent(resolved as T)
      })
    }, [resolveComponent])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return React.createElement(ResolvedComponent as any, { ...(props as object), ref } as any)
  })

  WrappedComponent.displayName = `withThemeOverride(${OriginalComponent.displayName || OriginalComponent.name})`
  
  return WrappedComponent as unknown as T
}

/**
 * Utility to create a themed component that automatically resolves overrides
 */
export function createThemedComponent<T extends React.ComponentType<unknown>>(
  componentPath: string,
  OriginalComponent: T,
  options?: {
    displayName?: string
    fallback?: React.ComponentType<unknown>
  }
): T {
  const ThemedComponent = React.forwardRef<unknown, React.ComponentProps<T>>((props, ref) => {
    const { currentTheme, resolveComponent } = useImportResolver()
    const [ResolvedComponent, setResolvedComponent] = React.useState<T | React.ComponentType<unknown>>(
      options?.fallback || OriginalComponent
    )
    const [isLoading, setIsLoading] = React.useState(false)

    React.useEffect(() => {
      if (!currentTheme) {
        setResolvedComponent(OriginalComponent)
        return
      }

      setIsLoading(true)
      resolveComponent(componentPath, OriginalComponent)
        .then(resolved => {
          setResolvedComponent(resolved as T)
        })
        .finally(() => {
          setIsLoading(false)
        })
    }, [currentTheme, resolveComponent])

    // Show loading state for theme components if needed
    if (isLoading && options?.fallback) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return React.createElement(options.fallback, props as any)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return React.createElement(ResolvedComponent as any, { ...(props as object), ref } as any)
  })

  ThemedComponent.displayName = options?.displayName || `Themed(${OriginalComponent.displayName || OriginalComponent.name})`
  
  return ThemedComponent as unknown as T
}

/**
 * Utility to get custom theme components
 */
export async function getCustomComponent(
  theme: ThemeConfig,
  componentName: string
): Promise<React.ComponentType<unknown> | null> {
  if (!theme.components?.custom?.[componentName]) {
    return null
  }

  try {
    const customComponent = theme.components.custom[componentName]
    
    if (typeof customComponent === 'function') {
      const imported = await customComponent()
      return imported.default || imported
    }
    
    return customComponent
  } catch (error) {
    console.error(`[ImportResolver] Error loading custom component ${componentName}:`, error)
    return null
  }
}

/**
 * Development helper to refresh component cache (for hot reload)
 */
export function refreshThemeComponents() {
  if (process.env.NODE_ENV === 'development') {
    componentCache.clear()
    console.log('[ImportResolver] Component cache refreshed for hot reload')
  }
}

/**
 * Get component cache statistics
 */
export function getImportResolverStats() {
  return {
    cachedComponents: componentCache.size,
    cacheKeys: Array.from(componentCache.keys())
  }
}