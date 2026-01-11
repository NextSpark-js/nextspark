/**
 * Next-intl Integration for Dynamic Translations
 *
 * Integrates with next-intl using TranslationService for dynamic entity translations
 */

import { TranslationService } from '../services/translation.service'
import { loadMergedTranslations } from './registry'
import { getAllEntityConfigs, ensureInitialized } from '../entities/registry'
import type { SupportedLocale } from '../entities/types'

/**
 * Load all translations for next-intl configuration
 * Uses loadMergedTranslations which handles core + theme + entity merge
 */
export async function loadAllI18nTranslations(locale: SupportedLocale): Promise<Record<string, unknown>> {
  try {
    // Ensure entities are initialized before loading translations
    await ensureEntitiesInitialized()

    // Get all enabled entities
    const entities = getAllEntityConfigs().filter(entity => entity.enabled)

    console.log(`[i18n-integration] Loading translations for ${entities.length} entities:`, entities.map(e => e.slug))

    // Load core + theme + entity translations (merge priority: core < theme < entity)
    return await loadMergedTranslations(locale)
  } catch (error) {
    // Single fallback: registry already handles locale chain internally
    // If it fails completely, gracefully degrade to empty messages
    console.error(`[i18n-integration] Failed to load translations for ${locale}:`, error)
    return {}
  }
}

/**
 * Ensure entities are initialized
 */
async function ensureEntitiesInitialized(): Promise<void> {
  try {
    await ensureInitialized()
  } catch (error) {
    console.warn('[i18n-integration] Failed to initialize entities:', error)
  }
}

/**
 * Get core namespaces (excluding entity namespaces)
 */
export function getCoreNamespaces(): string[] {
  try {
    const { getCoreNamespaces } = require('@nextsparkjs/registries/namespace-registry')
    return getCoreNamespaces()
  } catch (error) {
    console.warn('Failed to load core namespaces from registry:', error)
    // Fallback to hardcoded namespaces during registry migration
    return ['common', 'dashboard', 'settings', 'auth', 'public', 'validation', 'admin', 'teams']
  }
}

/**
 * Get optimized namespaces based on route
 */
export function getOptimizedNamespaces(pathname: string): {
  core: string[]
  entities: string[]
  strategy: string
} {
  console.log(`[i18n-integration] 🔍 Analyzing pathname: "${pathname}"`)

  try {
    const { detectRouteStrategy, getOptimizedNamespaces } = require('@nextsparkjs/registries/namespace-registry')
    const strategy = detectRouteStrategy(pathname)
    const namespaceConfig = getOptimizedNamespaces(strategy)

    console.log(`[i18n-integration] 📋 Registry strategy: ${strategy}`)
    return namespaceConfig
  } catch (error) {
    console.warn('Failed to load optimized namespaces from registry:', error)

    // Fallback to hardcoded logic during registry migration
    // Core namespaces for dashboard pages
    if (pathname.startsWith('/dashboard')) {
      console.log(`[i18n-integration] 📱 Dashboard detected → Loading authenticated user namespaces`)
      return {
        core: ['common', 'dashboard', 'settings', 'public', 'validation', 'teams', 'admin'],
        entities: [], // Entities will be loaded dynamically
        strategy: 'DASHBOARD_AUTHENTICATED'
      }
    }

    // Auth pages
    const isAuthPage = pathname.startsWith('/auth') ||
                       pathname === '/login' ||
                       pathname === '/signup' ||
                       pathname === '/forgot-password' ||
                       pathname === '/reset-password' ||
                       pathname === '/verify-email'

    if (isAuthPage) {
      console.log(`[i18n-integration] 🔐 Auth page detected → Loading auth-only namespaces`)
      return {
        core: ['common', 'auth', 'validation'],
        entities: [],
        strategy: 'AUTH_ONLY'
      }
    }

    // Public pages
    if (pathname === '/' || pathname.startsWith('/pricing') || pathname.startsWith('/docs') ||
        pathname.startsWith('/support') || pathname.startsWith('/features') || pathname.startsWith('/products')) {
      console.log(`[i18n-integration] 🌐 Public page detected → Loading public + auth namespaces`)
      return {
        core: ['common', 'public', 'auth'],
        entities: [], // Some public pages might show entities
        strategy: 'PUBLIC_INITIAL'
      }
    }

    // Superadmin panel pages
    if (pathname.startsWith('/superadmin')) {
      console.log(`[i18n-integration] 🛠️ Superadmin panel detected → Loading superadmin namespaces`)
      return {
        core: ['common', 'superadmin', 'dashboard'],
        entities: [],
        strategy: 'SUPERADMIN'
      }
    }

    // Default to public
    console.log(`[i18n-integration] 🔄 Unknown route → Loading public as fallback`)
    return {
      core: ['common', 'public'],
      entities: [],
      strategy: 'UNKNOWN_FALLBACK'
    }
  }
}

/**
 * Load optimized translations based on route
 * Uses TranslationService for registry-based loading
 */
export async function loadOptimizedTranslations(
  locale: SupportedLocale,
  pathname: string = ''
): Promise<Record<string, unknown>> {
  const { core, strategy } = getOptimizedNamespaces(pathname)

  try {
    // Load all merged translations (core + theme + entities)
    const allTranslations = await loadMergedTranslations(locale)

    // Filter to only include needed namespaces based on route strategy
    const optimizedTranslations: Record<string, unknown> = {}

    // Include core namespaces
    for (const namespace of core) {
      if (allTranslations[namespace]) {
        optimizedTranslations[namespace] = allTranslations[namespace]
      }
    }

    // For dashboard and entity pages, also include entity translations
    if (strategy === 'DASHBOARD_AUTHENTICATED' || pathname.includes('[entity]')) {
      const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default'
      const entityTranslations = await TranslationService.loadAllEntities(activeTheme, locale)

      for (const [entityName, translations] of Object.entries(entityTranslations)) {
        if (Object.keys(translations).length > 0) {
          optimizedTranslations[entityName] = translations
        }
      }
    }

    console.log(`[i18n-integration] Loaded optimized translations for ${locale} (${strategy}):`, {
      namespaces: Object.keys(optimizedTranslations)
    })

    return optimizedTranslations
  } catch (error) {
    // Single fallback: gracefully degrade to empty messages
    console.error(`[i18n-integration] Failed to load optimized translations for ${locale}:`, error)
    return {}
  }
}
