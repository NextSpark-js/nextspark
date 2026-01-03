/**
 * Advanced Namespace Loading for Performance Optimization
 * 
 * This module implements true lazy loading of translation namespaces,
 * loading only what's needed for each page/component.
 */

import { I18N_CONFIG, type SupportedLocale, type TranslationNamespace } from './config'
import { getSafeLocale } from './i18n-utils'
import type { NamespaceCache, NamespaceData, NamespacesMap } from '../messages/types'

// Cache for loaded namespaces to avoid duplicate requests
const loadedNamespaces: NamespaceCache = new Map<string, NamespaceData>()

// Page-to-namespace mapping for automatic optimization
// Note: Entity namespaces (tasks, customers, etc.) are loaded dynamically from entity configs
// Only core namespaces should be listed here
const PAGE_NAMESPACE_MAP: Record<string, TranslationNamespace[]> = {
  // Dashboard pages
  '/dashboard': ['common', 'dashboard'],
  '/dashboard/settings': ['common', 'settings'],
  '/dashboard/settings/profile': ['common', 'settings'],
  '/dashboard/settings/password': ['common', 'settings'],
  '/dashboard/settings/security': ['common', 'settings'],
  '/dashboard/settings/notifications': ['common', 'settings'],
  '/dashboard/settings/billing': ['common', 'settings'],
  
  // Public pages
  '/': ['common', 'public'],
  '/features': ['common', 'public'],
  '/pricing': ['common', 'public'],
  '/docs': ['common', 'public'],
  '/support': ['common', 'public'],
  
  // Auth pages
  '/login': ['common', 'auth'],
  '/signup': ['common', 'auth'],
  '/forgot-password': ['common', 'auth'],
  '/reset-password': ['common', 'auth'],
  '/verify-email': ['common', 'auth'],
}

/**
 * Generate cache key for namespace
 */
function getCacheKey(locale: SupportedLocale, namespace: TranslationNamespace): string {
  return `${locale}:${namespace}`
}

/**
 * Load a single namespace with caching
 */
export async function loadNamespace(
  locale: SupportedLocale, 
  namespace: TranslationNamespace
): Promise<NamespaceData> {
  const cacheKey = getCacheKey(locale, namespace)
  
  // Return cached version if available
  if (loadedNamespaces.has(cacheKey)) {
    return loadedNamespaces.get(cacheKey)!
  }
  
  try {
    const messages = await import(`../messages/${locale}/${namespace}.json`)
    const namespaceData = messages.default
    
    // Cache the loaded namespace
    loadedNamespaces.set(cacheKey, namespaceData)
    
    return namespaceData
  } catch (error) {
    console.error(`Failed to load ${namespace} for ${locale}:`, error)
    
    // Fallback to default locale
    const fallbackLocale = I18N_CONFIG.defaultLocale
    if (locale !== fallbackLocale) {
      const fallbackCacheKey = getCacheKey(fallbackLocale, namespace)
      
      if (!loadedNamespaces.has(fallbackCacheKey)) {
        try {
          const fallbackMessages = await import(`../messages/${fallbackLocale}/${namespace}.json`)
          const fallbackData = fallbackMessages.default
          loadedNamespaces.set(fallbackCacheKey, fallbackData)
          return fallbackData
        } catch (fallbackError) {
          console.error(`Failed to load fallback ${namespace}:`, fallbackError)
          return {} as NamespaceData as NamespaceData
        }
      }
      
      return loadedNamespaces.get(fallbackCacheKey) || ({} as NamespaceData)
    }
    
    return {} as NamespaceData
  }
}

/**
 * Load multiple namespaces efficiently
 */
export async function loadNamespaces(
  locale: SupportedLocale,
  namespaces: TranslationNamespace[]
): Promise<NamespacesMap> {
  const safeLocale = getSafeLocale(locale)
  
  // Load all namespaces in parallel
  const namespacePromises = namespaces.map(async (namespace) => {
    const data = await loadNamespace(safeLocale, namespace)
    return [namespace, data]
  })
  
  const results = await Promise.all(namespacePromises)
  
  // Convert to object
  return Object.fromEntries(results)
}

/**
 * Get required namespaces for a specific page/route
 */
export function getPageNamespaces(pathname: string): TranslationNamespace[] {
  // Exact match first
  if (PAGE_NAMESPACE_MAP[pathname]) {
    return PAGE_NAMESPACE_MAP[pathname]
  }
  
  // Pattern matching for dynamic routes
  // Note: Entity-specific namespaces are loaded dynamically by i18n-integration.ts
  if (pathname.startsWith('/dashboard/settings/')) {
    return ['common', 'settings']
  }
  
  if (pathname.startsWith('/dashboard')) {
    return ['common', 'dashboard']
  }
  
  if (pathname.startsWith('/auth') || pathname === '/login' || pathname === '/signup') {
    return ['common', 'auth']
  }
  
  // Default for unknown pages (include public for safety)
  return ['common', 'public']
}

/**
 * Load messages optimized for a specific page
 * This is the main function that should be used in i18n.ts
 */
export async function loadPageMessages(
  locale: SupportedLocale,
  pathname?: string
): Promise<NamespacesMap> {
  const safeLocale = getSafeLocale(locale)
  
  // If no pathname provided, load all (fallback behavior)
  if (!pathname) {
    return loadAllNamespaces(safeLocale)
  }
  
  // Get required namespaces for this page
  const requiredNamespaces = getPageNamespaces(pathname)
  
  // Load only required namespaces
  const namespaceData = await loadNamespaces(safeLocale, requiredNamespaces)
  
  // Combine into single messages object
  return namespaceData
}

/**
 * Load all namespaces (fallback for backward compatibility)
 */
async function loadAllNamespaces(locale: SupportedLocale): Promise<NamespacesMap> {
  try {
    const messages = await import(`../messages/${locale}/index.ts`)
    return messages.default
  } catch (error) {
    console.error(`Failed to load all messages for ${locale}:`, error)
    
    // Fallback to default locale
    if (locale !== I18N_CONFIG.defaultLocale) {
      try {
        const fallbackMessages = await import(`../messages/${I18N_CONFIG.defaultLocale}/index.ts`)
        return fallbackMessages.default
      } catch (fallbackError) {
        console.error('Failed to load fallback messages:', fallbackError)
        return {} as NamespacesMap
      }
    }
    
    return {} as NamespacesMap
  }
}

/**
 * Preload critical namespaces for better performance
 */
export async function preloadCriticalNamespaces(locale: SupportedLocale) {
  const criticalNamespaces = I18N_CONFIG.performance.preloadCriticalNamespaces || ['common']
  
  // Preload in background without blocking
  Promise.all(
    criticalNamespaces.map((namespace: TranslationNamespace) =>
      loadNamespace(locale, namespace).catch((err: unknown) =>
        console.warn(`Failed to preload ${namespace}:`, err)
      )
    )
  )
}

/**
 * Clear namespace cache (useful for development/testing)
 */
export function clearNamespaceCache() {
  loadedNamespaces.clear()
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats() {
  return {
    size: loadedNamespaces.size,
    keys: Array.from(loadedNamespaces.keys())
  }
}
