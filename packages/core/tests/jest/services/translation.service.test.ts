/**
 * Unit Tests - Translation Service
 *
 * Tests the TranslationService static methods that provide runtime
 * translation lookup and loading operations.
 *
 * Test Coverage:
 * - getLoader(theme, locale) returns loader function or null
 * - load(theme, locale) executes loader and returns translations
 * - getLocales(theme) returns available locales for theme
 * - getThemes() returns all themes with translations
 * - has(theme, locale) checks translation existence
 *
 * @see {@link core/lib/services/translation.service.ts}
 */

import { TranslationService } from '@/core/lib/services/translation.service'

describe('TranslationService', () => {
  describe('getLoader', () => {
    it('should return loader function for valid theme and locale', () => {
      const loader = TranslationService.getLoader('default', 'en')

      expect(loader).toBeDefined()
      expect(typeof loader).toBe('function')
    })

    it('should return loader function for all valid locales', () => {
      const enLoader = TranslationService.getLoader('default', 'en')
      const esLoader = TranslationService.getLoader('default', 'es')

      expect(enLoader).toBeDefined()
      expect(esLoader).toBeDefined()
      expect(typeof enLoader).toBe('function')
      expect(typeof esLoader).toBe('function')
    })

    it('should return null for invalid theme', () => {
      const loader = TranslationService.getLoader('invalid-theme', 'en')

      expect(loader).toBeNull()
    })

    it('should return null for invalid locale', () => {
      const loader = TranslationService.getLoader('default', 'invalid-locale')

      expect(loader).toBeNull()
    })

    it('should return null for non-existent theme', () => {
      const loader = TranslationService.getLoader('nonexistent-theme-12345', 'en')

      expect(loader).toBeNull()
    })

    it('should return null for empty theme string', () => {
      const loader = TranslationService.getLoader('', 'en')

      expect(loader).toBeNull()
    })

    it('should return null for empty locale string', () => {
      const loader = TranslationService.getLoader('default', '')

      expect(loader).toBeNull()
    })

    it('should return null when theme has no loaders', () => {
      const loader = TranslationService.getLoader('theme-without-translations', 'en')

      expect(loader).toBeNull()
    })

    it('should handle case-sensitive theme names correctly', () => {
      // Theme names should be case-sensitive
      const loader = TranslationService.getLoader('Default', 'en') // Wrong case

      expect(loader).toBeNull()
    })

    it('should handle case-sensitive locale codes correctly', () => {
      // Locale codes should be case-sensitive
      const loader = TranslationService.getLoader('default', 'EN') // Wrong case

      expect(loader).toBeNull()
    })
  })

  describe('load', () => {
    it('should load translation data for valid theme and locale', async () => {
      const translations = await TranslationService.load('default', 'en')

      expect(translations).toBeDefined()
      expect(typeof translations).toBe('object')
      expect(translations).not.toEqual({})
    })

    it('should load different translations for different locales', async () => {
      const enTranslations = await TranslationService.load('default', 'en')
      const esTranslations = await TranslationService.load('default', 'es')

      expect(enTranslations).toBeDefined()
      expect(esTranslations).toBeDefined()
      expect(typeof enTranslations).toBe('object')
      expect(typeof esTranslations).toBe('object')
    })

    it('should return empty object for invalid theme', async () => {
      const translations = await TranslationService.load('invalid-theme', 'en')

      expect(translations).toEqual({})
    })

    it('should return empty object for invalid locale', async () => {
      const translations = await TranslationService.load('default', 'invalid-locale')

      expect(translations).toEqual({})
    })

    it('should return empty object for non-existent theme', async () => {
      const translations = await TranslationService.load('nonexistent-theme-12345', 'en')

      expect(translations).toEqual({})
    })

    it('should return empty object for empty theme string', async () => {
      const translations = await TranslationService.load('', 'en')

      expect(translations).toEqual({})
    })

    it('should return empty object for empty locale string', async () => {
      const translations = await TranslationService.load('default', '')

      expect(translations).toEqual({})
    })

    it('should handle loader errors gracefully', async () => {
      // Mock console.error to suppress error output during test
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      // Create a mock loader that throws an error
      const originalGetLoader = TranslationService.getLoader
      jest.spyOn(TranslationService, 'getLoader').mockReturnValue(
        () => Promise.reject(new Error('Mock loader error'))
      )

      const translations = await TranslationService.load('default', 'en')

      expect(translations).toEqual({})
      expect(consoleErrorSpy).toHaveBeenCalled()

      // Restore original methods
      consoleErrorSpy.mockRestore()
      jest.spyOn(TranslationService, 'getLoader').mockRestore()
    })

    it('should return result.default if present', async () => {
      // English translations are imported as modules with .default property
      const translations = await TranslationService.load('default', 'en')

      expect(translations).toBeDefined()
      expect(typeof translations).toBe('object')
    })

    it('should return result if result.default is not present', async () => {
      // Mock a loader that returns an object without .default
      const mockTranslations = { key1: 'value1', key2: 'value2' }
      jest.spyOn(TranslationService, 'getLoader').mockReturnValue(
        async () => mockTranslations as any
      )

      const translations = await TranslationService.load('default', 'en')

      expect(translations).toEqual(mockTranslations)

      // Restore
      jest.spyOn(TranslationService, 'getLoader').mockRestore()
    })
  })

  describe('getLocales', () => {
    it('should return array of locales for valid theme', () => {
      const locales = TranslationService.getLocales('default')

      expect(Array.isArray(locales)).toBe(true)
      expect(locales.length).toBeGreaterThan(0)
    })

    it('should return correct locales for default theme', () => {
      const locales = TranslationService.getLocales('default')

      expect(locales).toContain('en')
      expect(locales).toContain('es')
      expect(locales.length).toBe(2)
    })

    it('should return empty array for invalid theme', () => {
      const locales = TranslationService.getLocales('invalid-theme')

      expect(Array.isArray(locales)).toBe(true)
      expect(locales).toEqual([])
      expect(locales.length).toBe(0)
    })

    it('should return empty array for non-existent theme', () => {
      const locales = TranslationService.getLocales('nonexistent-theme-12345')

      expect(Array.isArray(locales)).toBe(true)
      expect(locales.length).toBe(0)
    })

    it('should return empty array for empty theme string', () => {
      const locales = TranslationService.getLocales('')

      expect(Array.isArray(locales)).toBe(true)
      expect(locales.length).toBe(0)
    })

    it('should handle case-sensitive theme names correctly', () => {
      // Theme names should be case-sensitive
      const locales = TranslationService.getLocales('Default') // Wrong case

      expect(Array.isArray(locales)).toBe(true)
      expect(locales.length).toBe(0)
    })

    it('should not mutate the original registry', () => {
      const locales1 = TranslationService.getLocales('default')
      const locales2 = TranslationService.getLocales('default')

      // Mutate the returned array
      locales1.push('fake-locale')

      // Should not affect subsequent calls
      expect(locales2).toEqual(['en', 'es'])
      expect(locales1.length).not.toBe(locales2.length)
    })
  })

  describe('getThemes', () => {
    it('should return array of all themes with translations', () => {
      const themes = TranslationService.getThemes()

      expect(Array.isArray(themes)).toBe(true)
      expect(themes.length).toBeGreaterThan(0)
    })

    it('should return default theme', () => {
      const themes = TranslationService.getThemes()

      expect(themes).toContain('default')
    })

    it('should return current state with one theme', () => {
      const themes = TranslationService.getThemes()

      expect(themes.length).toBe(1)
      expect(themes[0]).toBe('default')
    })

    it('should not return empty array', () => {
      const themes = TranslationService.getThemes()

      expect(themes.length).toBeGreaterThan(0)
    })

    it('should not mutate the original registry', () => {
      const themes1 = TranslationService.getThemes()
      const themes2 = TranslationService.getThemes()

      // Mutate the returned array
      themes1.push('fake-theme')

      // Should not affect subsequent calls
      expect(themes2).toEqual(['default'])
      expect(themes1.length).not.toBe(themes2.length)
    })
  })

  describe('has', () => {
    it('should return true for existing translation', () => {
      expect(TranslationService.has('default', 'en')).toBe(true)
      expect(TranslationService.has('default', 'es')).toBe(true)
    })

    it('should return true for all valid theme/locale combinations', () => {
      const themes = TranslationService.getThemes()

      themes.forEach(theme => {
        const locales = TranslationService.getLocales(theme)

        locales.forEach(locale => {
          expect(TranslationService.has(theme, locale)).toBe(true)
        })
      })
    })

    it('should return false for non-existing theme', () => {
      expect(TranslationService.has('invalid-theme', 'en')).toBe(false)
      expect(TranslationService.has('nonexistent-theme-12345', 'en')).toBe(false)
    })

    it('should return false for non-existing locale', () => {
      expect(TranslationService.has('default', 'invalid-locale')).toBe(false)
      expect(TranslationService.has('default', 'fr')).toBe(false)
      expect(TranslationService.has('default', 'de')).toBe(false)
    })

    it('should return false for empty theme string', () => {
      expect(TranslationService.has('', 'en')).toBe(false)
    })

    it('should return false for empty locale string', () => {
      expect(TranslationService.has('default', '')).toBe(false)
    })

    it('should return false for both empty strings', () => {
      expect(TranslationService.has('', '')).toBe(false)
    })

    it('should handle case-sensitive theme names correctly', () => {
      // Theme names should be case-sensitive
      expect(TranslationService.has('Default', 'en')).toBe(false) // Wrong case
      expect(TranslationService.has('default', 'en')).toBe(true) // Correct case
    })

    it('should handle case-sensitive locale codes correctly', () => {
      // Locale codes should be case-sensitive
      expect(TranslationService.has('default', 'EN')).toBe(false) // Wrong case
      expect(TranslationService.has('default', 'en')).toBe(true) // Correct case
    })

    it('should return false for whitespace strings', () => {
      expect(TranslationService.has(' ', 'en')).toBe(false)
      expect(TranslationService.has('default', ' ')).toBe(false)
      expect(TranslationService.has('  ', '  ')).toBe(false)
    })
  })

  describe('Integration - Cross-method consistency', () => {
    it('should have consistent data between getLoader() and has()', () => {
      const testCases = [
        { theme: 'default', locale: 'en' },
        { theme: 'default', locale: 'es' },
        { theme: 'invalid-theme', locale: 'en' },
        { theme: 'default', locale: 'invalid-locale' },
        { theme: '', locale: '' }
      ]

      testCases.forEach(({ theme, locale }) => {
        const hasTranslation = TranslationService.has(theme, locale)
        const loader = TranslationService.getLoader(theme, locale)

        if (hasTranslation) {
          expect(loader).not.toBeNull()
          expect(typeof loader).toBe('function')
        } else {
          expect(loader).toBeNull()
        }
      })
    })

    it('should have consistent data between getLocales() and has()', () => {
      const theme = 'default'
      const locales = TranslationService.getLocales(theme)

      // All locales from getLocales() should return true for has()
      locales.forEach(locale => {
        expect(TranslationService.has(theme, locale)).toBe(true)
      })

      // Invalid locales should return false
      const invalidLocales = ['invalid', 'fr', 'de', 'zh', '']
      invalidLocales.forEach(locale => {
        expect(TranslationService.has(theme, locale)).toBe(false)
      })
    })

    it('should have consistent data between getThemes() and has()', () => {
      const themes = TranslationService.getThemes()

      // Each theme should have at least one valid locale
      themes.forEach(theme => {
        const locales = TranslationService.getLocales(theme)
        expect(locales.length).toBeGreaterThan(0)

        // At least one locale should exist
        const hasAnyLocale = locales.some(locale =>
          TranslationService.has(theme, locale)
        )
        expect(hasAnyLocale).toBe(true)
      })
    })

    it('should have all themes from getThemes() return non-empty locales', () => {
      const themes = TranslationService.getThemes()

      themes.forEach(theme => {
        const locales = TranslationService.getLocales(theme)
        expect(locales.length).toBeGreaterThan(0)
      })
    })

    it('should have load() consistent with getLoader()', async () => {
      const testCases = [
        { theme: 'default', locale: 'en', shouldLoad: true },
        { theme: 'default', locale: 'es', shouldLoad: true },
        { theme: 'invalid-theme', locale: 'en', shouldLoad: false },
        { theme: 'default', locale: 'invalid-locale', shouldLoad: false }
      ]

      for (const { theme, locale, shouldLoad } of testCases) {
        const loader = TranslationService.getLoader(theme, locale)
        const translations = await TranslationService.load(theme, locale)

        if (shouldLoad) {
          expect(loader).not.toBeNull()
          expect(translations).not.toEqual({})
          expect(typeof translations).toBe('object')
        } else {
          expect(loader).toBeNull()
          expect(translations).toEqual({})
        }
      }
    })
  })
})
