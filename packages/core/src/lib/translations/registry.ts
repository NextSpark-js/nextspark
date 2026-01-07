/**
 * Translation Registry System
 *
 * Manages dynamic loading of translations from entities, plugins, and themes.
 * Integrates with next-intl and entity system for seamless i18n.
 */

import type { SupportedLocale } from '../entities/types'
import { TranslationService } from '../services/translation.service'

// Debug flag - only log if explicitly enabled
const DEBUG_I18N = process.env.NEXTSPARK_DEBUG_I18N === 'true'

// =============================================================================
// GLOBAL CACHE - Prevents re-loading translations on each request
// =============================================================================

interface TranslationCache {
  __nextspark_translations_cache?: Map<string, Record<string, unknown>>
}

const globalCache = globalThis as unknown as TranslationCache

function getTranslationCache(): Map<string, Record<string, unknown>> {
  if (!globalCache.__nextspark_translations_cache) {
    globalCache.__nextspark_translations_cache = new Map()
  }
  return globalCache.__nextspark_translations_cache
}

/**
 * Deep merge with key preservation
 * Priority: Core < Theme < Entity (later wins)
 */
function deepMergeMessages(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target }

  for (const key of Object.keys(source)) {
    const sourceValue = source[key]
    const targetValue = result[key]

    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMergeMessages(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      )
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue
    }
  }

  return result
}

/**
 * Obtiene la cadena de fallback para un locale
 * Ejemplo: 'es-MX' → ['es-MX', 'es', 'en']
 */
function getLocaleFallbackChain(locale: string): string[] {
  const chain = [locale]

  if (locale.includes('-')) {
    chain.push(locale.split('-')[0])
  }

  if (!chain.includes('en')) {
    chain.push('en')
  }

  return chain
}

/**
 * Carga traducciones core directamente (sin clase)
 */
async function loadCoreTranslations(
  locale: SupportedLocale
): Promise<Record<string, unknown>> {
  try {
    const coreMessages = await import(`../../messages/${locale}/index.ts`)
    return coreMessages.default || coreMessages
  } catch {
    return {}
  }
}

/**
 * Theme messages registration for npm consumers
 * Consuming projects call registerThemeMessages() to provide their theme translations
 */
let registeredThemeMessages: Record<string, Record<string, unknown>> = {}

/**
 * Register theme messages for a locale
 * Call this from your project's initialization to provide theme-specific translations
 *
 * @example
 * // In your app's initialization
 * import { registerThemeMessages } from '@nextsparkjs/core/lib/translations/registry'
 * import enMessages from './contents/themes/my-theme/messages/en'
 * registerThemeMessages('en', enMessages)
 */
export function registerThemeMessages(locale: string, messages: Record<string, unknown>): void {
  registeredThemeMessages[locale] = messages
}

/**
 * Carga traducciones del theme activo
 * Uses auto-generated registry first, then falls back to registered messages (npm)
 */
async function loadThemeTranslations(
  locale: SupportedLocale
): Promise<Record<string, unknown>> {
  // Get the active theme from environment
  const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME

  if (activeTheme) {
    // Try to load from auto-generated registry first (NO runtime string interpolation)
    const registryMessages = await TranslationService.load(activeTheme, locale)
    if (Object.keys(registryMessages).length > 0) {
      return registryMessages
    }
  }

  // Fallback: check if theme messages were registered (npm install pattern)
  if (registeredThemeMessages[locale]) {
    return registeredThemeMessages[locale]
  }

  // If no registered messages, return empty (theme messages are optional)
  return {}
}

/**
 * Carga traducciones de entidades
 * Uses auto-generated registry for all entity translations
 */
async function loadEntityTranslationsFromRegistry(
  locale: SupportedLocale
): Promise<Record<string, unknown>> {
  // Get the active theme from environment
  const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default'

  try {
    // Load all entity translations from the auto-generated registry
    const entityTranslations = await TranslationService.loadAllEntities(activeTheme, locale)
    return entityTranslations
  } catch (error) {
    if (DEBUG_I18N) {
      console.warn(`[translations] Failed to load entity translations for ${locale}:`, error)
    }
    return {}
  }
}

/**
 * Carga y mergea mensajes de todas las fuentes
 * Orden: Core (base) -> Theme -> Entity (later wins)
 *
 * Merge priority ensures:
 * 1. Core translations provide the base
 * 2. Theme translations can override/extend core
 * 3. Entity translations can override/extend both (highest priority)
 *
 * Uses globalThis cache to prevent re-loading on each request
 */
export async function loadMergedTranslations(
  locale: SupportedLocale
): Promise<Record<string, unknown>> {
  // Generate cache key based on locale and theme
  const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default'
  const cacheKey = `${locale}-${activeTheme}`

  // Check cache first
  const cache = getTranslationCache()
  if (cache.has(cacheKey)) {
    if (DEBUG_I18N) {
      console.log(`[i18n] Cache hit for ${cacheKey}`)
    }
    return cache.get(cacheKey)!
  }

  if (DEBUG_I18N) {
    console.log(`[i18n] Loading translations for ${cacheKey}`)
  }

  const fallbackChain = getLocaleFallbackChain(locale)
  let mergedMessages: Record<string, unknown> = {}

  // 1. Cargar core messages con fallback (en orden inverso para que locale específico gane)
  for (const fallbackLocale of [...fallbackChain].reverse()) {
    try {
      const coreMessages = await loadCoreTranslations(fallbackLocale as SupportedLocale)
      mergedMessages = deepMergeMessages(mergedMessages, coreMessages)
    } catch {
      // Locale no existe en core, continuar
    }
  }

  // 2. Cargar theme messages (wins over core)
  try {
    const themeMessages = await loadThemeTranslations(locale)
    mergedMessages = deepMergeMessages(mergedMessages, themeMessages)
  } catch {
    if (DEBUG_I18N) {
      console.warn(`[translations] No theme messages for ${locale}`)
    }
  }

  // 3. Cargar entity messages (wins over theme and core)
  // Uses auto-generated registry for zero runtime string interpolation
  try {
    const entityMessages = await loadEntityTranslationsFromRegistry(locale)
    if (Object.keys(entityMessages).length > 0) {
      mergedMessages = deepMergeMessages(mergedMessages, entityMessages)
    }
  } catch {
    // No entity messages, ok
  }

  // Store in cache
  cache.set(cacheKey, mergedMessages)

  if (DEBUG_I18N) {
    console.log(`[i18n] Cached translations for ${cacheKey} with ${Object.keys(mergedMessages).length} namespaces`)
  }

  return mergedMessages
}
