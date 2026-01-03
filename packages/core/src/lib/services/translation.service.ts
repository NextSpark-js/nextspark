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
}
