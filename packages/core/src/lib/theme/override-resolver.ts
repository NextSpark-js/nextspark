/**
 * Component Override Resolver
 * 
 * Handles resolution of component overrides with caching for performance
 */

import type React from 'react'
import type { ThemeConfig } from '../../types/theme'

/**
 * Cache for resolved component overrides
 */
const overrideCache = new Map<string, CacheEntry>()

/**
 * Cache TTL: 5 minutes in development, 30 minutes in production
 */
const CACHE_TTL = process.env.NODE_ENV === 'development' ? 5 * 60 * 1000 : 30 * 60 * 1000

interface CacheEntry {
  component: React.ComponentType<unknown> | null
  timestamp: number
  theme: string
}

/**
 * Generate cache key for component override
 */
function getCacheKey(componentPath: string, themeName: string): string {
  return `${themeName}:${componentPath}`
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL
}

/**
 * Resolve component override for a specific path
 */
export async function resolveComponentOverride(
  componentPath: string, 
  theme: ThemeConfig
): Promise<React.ComponentType<unknown> | null> {
  const cacheKey = getCacheKey(componentPath, theme.name)
  
  // Check cache first
  const cached = overrideCache.get(cacheKey)
  if (cached && isCacheValid(cached)) {
    console.log(`[Override] Cache hit for ${componentPath} in theme ${theme.name}`)
    return cached.component
  }

  try {
    // Look for override in theme configuration
    const override = theme.components?.overrides?.[componentPath]
    
    if (!override) {
      // Cache negative result
      overrideCache.set(cacheKey, {
        component: null,
        timestamp: Date.now(),
        theme: theme.name
      })
      return null
    }

    // Cache positive result
    overrideCache.set(cacheKey, {
      component: override,
      timestamp: Date.now(),
      theme: theme.name
    })

    console.log(`[Override] Resolved override for ${componentPath} in theme ${theme.name}`)
    return override

  } catch (error) {
    console.error(`[Override] Error resolving override for ${componentPath}:`, error)
    
    // Cache error result to avoid repeated failures
    overrideCache.set(cacheKey, {
      component: null,
      timestamp: Date.now(),
      theme: theme.name
    })
    
    return null
  }
}

/**
 * Resolve component with fallback to original
 */
export async function resolveComponent<T>(
  componentPath: string,
  originalComponent: T,
  theme: ThemeConfig
): Promise<T | React.ComponentType<unknown>> {
  const override = await resolveComponentOverride(componentPath, theme)
  
  if (override) {
    console.log(`[Override] Using override for ${componentPath}`)
    return override
  }

  console.log(`[Override] Using original component for ${componentPath}`)
  return originalComponent
}

/**
 * Create a component wrapper that automatically resolves overrides
 */
export function createOverridableComponent<T = React.ComponentType<unknown>>(
  componentPath: string,
  originalComponent: T
): T {
  // This would be implemented based on the specific component type
  // For now, return the original component
  return originalComponent
}

/**
 * Clear override cache (useful for development and testing)
 */
export function clearOverrideCache(componentPath?: string, themeName?: string): void {
  if (componentPath && themeName) {
    const cacheKey = getCacheKey(componentPath, themeName)
    overrideCache.delete(cacheKey)
    console.log(`[Override] Cleared cache for ${componentPath} in theme ${themeName}`)
  } else if (themeName) {
    // Clear all cache entries for a specific theme
    for (const [key] of overrideCache) {
      if (key.startsWith(`${themeName}:`)) {
        overrideCache.delete(key)
      }
    }
    console.log(`[Override] Cleared all cache entries for theme ${themeName}`)
  } else {
    // Clear entire cache
    overrideCache.clear()
    console.log('[Override] Cleared entire override cache')
  }
}

/**
 * Get cache statistics (for monitoring)
 */
export function getOverrideCacheStats(): {
  size: number
  entries: string[]
  hitRate?: number
} {
  return {
    size: overrideCache.size,
    entries: Array.from(overrideCache.keys()),
  }
}

/**
 * Preload overrides for better performance
 */
export async function preloadThemeOverrides(theme: ThemeConfig): Promise<void> {
  if (!theme.components?.overrides) {
    return
  }

  const overridePaths = Object.keys(theme.components.overrides)
  
  console.log(`[Override] Preloading ${overridePaths.length} overrides for theme ${theme.name}`)
  
  const promises = overridePaths.map(async (path) => {
    try {
      await resolveComponentOverride(path, theme)
    } catch (error) {
      console.warn(`[Override] Failed to preload ${path}:`, error)
    }
  })

  await Promise.allSettled(promises)
  console.log(`[Override] Preloading complete for theme ${theme.name}`)
}