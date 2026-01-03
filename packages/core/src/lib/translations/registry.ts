/**
 * Translation Registry System
 *
 * Manages dynamic loading of translations from entities, plugins, and themes.
 * Integrates with next-intl and entity system for seamless i18n.
 */

import type { SupportedLocale } from '../entities/types'
import { TranslationService } from '../services/translation.service'

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
    console.warn(`[translations] Failed to load entity translations for ${locale}:`, error)
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
 */
export async function loadMergedTranslations(
  locale: SupportedLocale
): Promise<Record<string, unknown>> {
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
    console.warn(`[translations] No theme messages for ${locale}`)
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

  return mergedMessages
}
