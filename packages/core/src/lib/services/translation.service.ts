/**
 * Translation Service
 *
 * Provides translation query and loading operations.
 * Uses pre-computed data from translation-registry for O(1) operations.
 *
 * @module TranslationService
 */

import {
  THEME_TRANSLATION_LOADERS,
  ENTITY_TRANSLATION_LOADERS,
  TranslationLoader
} from '@nextsparkjs/registries/translation-registry'

/**
 * Translation Service - Provides runtime translation queries
 *
 * This service layer abstracts translation registry access, making the registry
 * a pure data structure (Data-Only pattern). All query logic lives here.
 *
 * Performance: All operations are O(1) or O(n) with zero I/O.
 */
export class TranslationService {
  /**
   * Get theme translation loader function
   * Returns a lazy-loading function (doesn't load until called)
   *
   * @param theme - Theme name (e.g., 'default')
   * @param locale - Locale code (e.g., 'en', 'es')
   * @returns Lazy-loading function or null if not found
   *
   * @example
   * ```typescript
   * const loader = TranslationService.getLoader('default', 'en')
   * if (loader) {
   *   const translations = await loader()
   * }
   * ```
   */
  static getLoader(theme: string, locale: string): TranslationLoader | null {
    const themeLoaders = THEME_TRANSLATION_LOADERS[theme]
    if (!themeLoaders) return null
    return themeLoaders[locale] || null
  }

  /**
   * Load theme translation (executes the loader)
   * Convenience wrapper that calls the loader function
   *
   * @param theme - Theme name
   * @param locale - Locale code
   * @returns Translation data or empty object if not found
   *
   * @example
   * ```typescript
   * const translations = await TranslationService.load('default', 'en')
   * // Returns translation object or {} if not found
   * ```
   */
  static async load(theme: string, locale: string): Promise<Record<string, unknown>> {
    const loader = this.getLoader(theme, locale)
    if (!loader) return {} as Record<string, unknown>

    try {
      const result = await loader()
      return (result.default || result) as Record<string, unknown>
    } catch (error) {
      console.error(`[TranslationService] Failed to load theme translation for ${theme}/${locale}:`, error)
      return {} as Record<string, unknown>
    }
  }

  /**
   * Get available locales for a theme
   *
   * @param theme - Theme name
   * @returns Array of locale codes
   *
   * @example
   * ```typescript
   * const locales = TranslationService.getLocales('default')
   * // Returns ['en', 'es']
   * ```
   */
  static getLocales(theme: string): string[] {
    const themeLoaders = THEME_TRANSLATION_LOADERS[theme]
    if (!themeLoaders) return []
    return Object.keys(themeLoaders)
  }

  /**
   * Get all themes with translations
   *
   * @returns Array of theme names
   *
   * @example
   * ```typescript
   * const themes = TranslationService.getThemes()
   * // Returns ['default']
   * ```
   */
  static getThemes(): string[] {
    return Object.keys(THEME_TRANSLATION_LOADERS)
  }

  /**
   * Check if theme has translation for locale
   *
   * @param theme - Theme name
   * @param locale - Locale code
   * @returns True if translation exists
   *
   * @example
   * ```typescript
   * if (TranslationService.has('default', 'en')) {
   *   // Translation exists, safe to load
   * }
   * ```
   */
  static has(theme: string, locale: string): boolean {
    return !!this.getLoader(theme, locale)
  }

  // ============================================
  // Entity Translation Methods
  // ============================================

  /**
   * Get entity translation loader function
   * Returns a lazy-loading function (doesn't load until called)
   *
   * @param theme - Theme name (e.g., 'default')
   * @param entity - Entity name (e.g., 'products', 'blog')
   * @param locale - Locale code (e.g., 'en', 'es')
   * @returns Lazy-loading function or null if not found
   *
   * @example
   * ```typescript
   * const loader = TranslationService.getEntityLoader('default', 'products', 'en')
   * if (loader) {
   *   const translations = await loader()
   * }
   * ```
   */
  static getEntityLoader(theme: string, entity: string, locale: string): TranslationLoader | null {
    const themeEntities = ENTITY_TRANSLATION_LOADERS[theme]
    if (!themeEntities) return null

    const entityLoaders = themeEntities[entity]
    if (!entityLoaders) return null

    return entityLoaders[locale] || null
  }

  /**
   * Load entity translation (executes the loader)
   * Convenience wrapper that calls the loader function
   *
   * @param theme - Theme name
   * @param entity - Entity name
   * @param locale - Locale code
   * @returns Translation data or empty object if not found
   *
   * @example
   * ```typescript
   * const translations = await TranslationService.loadEntity('default', 'products', 'en')
   * // Returns translation object or {} if not found
   * ```
   */
  static async loadEntity(theme: string, entity: string, locale: string): Promise<Record<string, unknown>> {
    const loader = this.getEntityLoader(theme, entity, locale)
    if (!loader) return {} as Record<string, unknown>

    try {
      const result = await loader()
      return (result.default || result) as Record<string, unknown>
    } catch (error) {
      console.error(`[TranslationService] Failed to load entity translation for ${theme}/${entity}/${locale}:`, error)
      return {} as Record<string, unknown>
    }
  }

  /**
   * Get available locales for an entity in a theme
   *
   * @param theme - Theme name
   * @param entity - Entity name
   * @returns Array of locale codes
   *
   * @example
   * ```typescript
   * const locales = TranslationService.getEntityLocales('default', 'products')
   * // Returns ['en', 'es']
   * ```
   */
  static getEntityLocales(theme: string, entity: string): string[] {
    const themeEntities = ENTITY_TRANSLATION_LOADERS[theme]
    if (!themeEntities) return []

    const entityLoaders = themeEntities[entity]
    if (!entityLoaders) return []

    return Object.keys(entityLoaders)
  }

  /**
   * Get all entities with translations for a theme
   *
   * @param theme - Theme name
   * @returns Array of entity names
   *
   * @example
   * ```typescript
   * const entities = TranslationService.getEntities('default')
   * // Returns ['products', 'blog']
   * ```
   */
  static getEntities(theme: string): string[] {
    const themeEntities = ENTITY_TRANSLATION_LOADERS[theme]
    if (!themeEntities) return []
    return Object.keys(themeEntities)
  }

  /**
   * Check if entity has translation for locale
   *
   * @param theme - Theme name
   * @param entity - Entity name
   * @param locale - Locale code
   * @returns True if translation exists
   *
   * @example
   * ```typescript
   * if (TranslationService.hasEntity('default', 'products', 'en')) {
   *   // Translation exists, safe to load
   * }
   * ```
   */
  static hasEntity(theme: string, entity: string, locale: string): boolean {
    return !!this.getEntityLoader(theme, entity, locale)
  }

  /**
   * Load all entity translations for a theme and locale
   * Useful for preloading all entity translations at once
   *
   * @param theme - Theme name
   * @param locale - Locale code
   * @returns Object with entity names as keys and translations as values
   *
   * @example
   * ```typescript
   * const allEntityTranslations = await TranslationService.loadAllEntities('default', 'en')
   * // Returns { products: {...}, blog: {...} }
   * ```
   */
  static async loadAllEntities(theme: string, locale: string): Promise<Record<string, Record<string, unknown>>> {
    const entities = this.getEntities(theme)
    const result: Record<string, Record<string, unknown>> = {}

    for (const entity of entities) {
      const translations = await this.loadEntity(theme, entity, locale)
      if (Object.keys(translations).length > 0) {
        result[entity] = translations
      }
    }

    return result
  }
}
