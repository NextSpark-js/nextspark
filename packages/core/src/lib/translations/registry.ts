/**
 * Translation Registry System
 *
 * Manages dynamic loading of translations from entities, plugins, and themes.
 * Integrates with next-intl and entity system for seamless i18n.
 */

import type { SupportedLocale, EntityConfig } from '../entities/types'
import { TranslationService } from '../services/translation.service'

/**
 * Deep merge utility for translation objects
 * Allows themes to extend core namespaces without overwriting them
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: Record<string, unknown>[]
): T {
  if (!sources.length) return target
  const source = sources.shift()

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) {
          Object.assign(target, { [key]: {} })
        }
        deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>)
      } else {
        Object.assign(target, { [key]: source[key] })
      }
    }
  }

  return deepMerge(target, ...sources)
}

function isObject(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === 'object' && !Array.isArray(item)
}

/**
 * Deep merge con preservación de keys no definidas
 * Prioridad: Theme > Plugin > Core
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
 * Translation namespace data
 */
export interface TranslationNamespace {
  namespace: string
  data: Record<string, unknown>
  source: 'core' | 'entity' | 'plugin' | 'theme'
  entityName?: string
}

/**
 * Translation registry for managing all translations
 */
export class TranslationRegistry {
  private translations: Map<string, Map<SupportedLocale, Record<string, unknown>>> = new Map()
  private loadedNamespaces: Set<string> = new Set()
  private coreTranslations: Map<SupportedLocale, Record<string, unknown>> = new Map()

  /**
   * Load core translations from core/messages
   */
  async loadCoreTranslations(locale: SupportedLocale): Promise<Record<string, unknown>> {
    if (this.coreTranslations.has(locale)) {
      return this.coreTranslations.get(locale)!
    }

    try {
      const coreMessages = await import(`../../messages/${locale}/index.ts`)
      const translations = coreMessages.default
      this.coreTranslations.set(locale, translations)
      return translations
    } catch (error) {
      console.error(`[TranslationRegistry] Failed to load core translations for ${locale}:`, error)
      return {}
    }
  }

  /**
   * Load theme translations
   * Uses auto-generated registry - NO runtime string interpolation
   */
  async loadThemeTranslations(locale: SupportedLocale): Promise<Record<string, unknown>> {
    try {
      // Get the active theme from environment
      const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME

      if (!activeTheme) {
        console.warn('[TranslationRegistry] No active theme set')
        return {}
      }

      // Load from auto-generated registry (build-time validation)
      return await TranslationService.load(activeTheme, locale)
    } catch (error) {
      console.warn(`[TranslationRegistry] Failed to load theme translations for ${locale}:`, error)
      return {}
    }
  }

  /**
   * Load entity translations
   */
  async loadEntityTranslations(entity: EntityConfig, locale: SupportedLocale): Promise<Record<string, unknown>> {
    if (!entity.i18n) {
      return {}
    }

    const { loaders, fallbackLocale = 'en' } = entity.i18n
    const namespace = entity.slug
    const namespaceKey = `entity:${namespace}`

    // Check if already loaded
    if (this.translations.has(namespaceKey) && this.translations.get(namespaceKey)!.has(locale)) {
      return this.translations.get(namespaceKey)!.get(locale)!
    }

    try {
      // Try to load the requested locale
      let translations: Record<string, unknown> = {}
      
      if (loaders[locale]) {
        const result = await loaders[locale]()
        translations = (result.default || result) as Record<string, unknown>
      } else if (locale !== fallbackLocale && loaders[fallbackLocale]) {
        // Fallback to default locale
        console.warn(`[TranslationRegistry] Locale ${locale} not found for entity ${entity.slug}, using fallback ${fallbackLocale}`)
        const result = await loaders[fallbackLocale]()
        translations = (result.default || result) as Record<string, unknown>
      }

      // Store in registry
      if (!this.translations.has(namespaceKey)) {
        this.translations.set(namespaceKey, new Map())
      }
      this.translations.get(namespaceKey)!.set(locale, translations)

      return translations
    } catch (error) {
      console.error(`[TranslationRegistry] Failed to load translations for entity ${entity.slug}:`, error)
      return {}
    }
  }

  /**
   * Load all translations for a locale (core + theme + entities)
   */
  async loadAllTranslations(
    locale: SupportedLocale,
    entities: EntityConfig[] = []
  ): Promise<Record<string, unknown>> {
    // Load core translations
    const coreTranslations = await this.loadCoreTranslations(locale)

    // Load theme translations
    const themeTranslations = await this.loadThemeTranslations(locale)

    // Load entity translations
    const entityTranslations: Record<string, unknown> = {}

    for (const entity of entities) {
      if (entity.i18n) {
        const namespace = entity.slug
        const translations = await this.loadEntityTranslations(entity, locale)
        if (Object.keys(translations).length > 0) {
          entityTranslations[namespace] = translations
        }
      }
    }

    // Deep merge core, theme, and entity translations
    // Theme can extend core namespaces (e.g., add common.blog) without overwriting
    return deepMerge({}, coreTranslations, themeTranslations, entityTranslations)
  }

  /**
   * Get translation for a specific entity
   */
  async getEntityTranslation(
    _entityName: string,
    locale: SupportedLocale,
    entity?: EntityConfig
  ): Promise<Record<string, unknown>> {
    if (!entity) {
      return {}
    }
    
    return this.loadEntityTranslations(entity, locale)
  }

  /**
   * Clear translation cache
   */
  clearCache(): void {
    this.translations.clear()
    this.coreTranslations.clear()
    this.loadedNamespaces.clear()
  }

  /**
   * Clear cache for specific locale
   */
  clearLocaleCache(locale: SupportedLocale): void {
    this.coreTranslations.delete(locale)
    for (const [namespace, localeMap] of this.translations.entries()) {
      localeMap.delete(locale)
      if (localeMap.size === 0) {
        this.translations.delete(namespace)
      }
    }
  }

  /**
   * Get loaded namespaces
   */
  getLoadedNamespaces(): string[] {
    return Array.from(this.loadedNamespaces)
  }

  /**
   * Check if namespace is loaded
   */
  isNamespaceLoaded(namespace: string): boolean {
    return this.loadedNamespaces.has(namespace)
  }
}

// Global translation registry instance
export const translationRegistry = new TranslationRegistry()

/**
 * Helper function to load translations for next-intl
 */
export async function loadTranslationsForLocale(
  locale: SupportedLocale,
  entities: EntityConfig[] = []
): Promise<Record<string, unknown>> {
  return translationRegistry.loadAllTranslations(locale, entities)
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
 * Uses registered messages (for npm) or falls back to empty object
 */
async function loadThemeTranslations(
  locale: SupportedLocale
): Promise<Record<string, unknown>> {
  // First check if theme messages were registered (npm install pattern)
  if (registeredThemeMessages[locale]) {
    return registeredThemeMessages[locale]
  }

  // If no registered messages, return empty (theme messages are optional)
  // In monorepo, the consuming app should register messages at startup
  return {}
}

/**
 * Carga traducciones de entidades
 */
async function loadEntityTranslations(
  locale: SupportedLocale
): Promise<Record<string, unknown>> {
  // Las entidades se cargan a través del registry con sus configs
  // Esta función es un placeholder para el merge
  return {}
}

/**
 * Carga y mergea mensajes de todas las fuentes
 * Orden: Core (base) -> Plugin -> Theme (wins)
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

  // 3. Cargar entity messages
  try {
    const entityMessages = await loadEntityTranslations(locale)
    mergedMessages = deepMergeMessages(mergedMessages, { entities: entityMessages })
  } catch {
    // No entity messages, ok
  }

  return mergedMessages
}
