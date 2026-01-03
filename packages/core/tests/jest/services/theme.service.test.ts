/**
 * Unit Tests - Theme Service
 *
 * Tests the ThemeService static methods that provide theme registry
 * operations and queries.
 *
 * Test Coverage:
 * - getAll() - returns all registered themes
 * - getByName() - retrieves theme by name
 * - getEntry() - retrieves full registry entry
 * - getDashboardConfig() - retrieves dashboard config
 * - getAppConfig() - retrieves app config
 * - getWithEntities() - filters themes with entities
 * - getWithRoutes() - filters themes with routes
 * - getUsingPlugin() - filters themes using plugin
 * - getPluginUsage() - gets plugin usage statistics
 * - exists() - checks theme existence
 * - getNames() - returns theme names
 * - getCount() - returns total count
 * - getMetadata() - returns metadata object
 * - Backward compatibility exports
 */

import { ThemeService } from '@/core/lib/services/theme.service'
import {
  getRegisteredThemes,
  getTheme,
  getThemeDashboardConfig,
  getThemeAppConfig,
  getThemesWithEntities,
  getThemesWithRoutes,
  getThemesUsingPlugin,
  getPluginUsage
} from '@/core/lib/services/theme.service'
import type { ThemeConfig } from '@/core/types/theme'
import type { ThemeRegistryEntry } from '@/core/lib/registries/theme-registry'

// Mock module to test plugin usage
jest.mock('@/core/lib/registries/theme-registry', () => {
  const actual = jest.requireActual('@/core/lib/registries/theme-registry')

  // Create a mock theme with plugins for testing
  const mockThemeWithPlugin: ThemeRegistryEntry = {
    name: 'test-theme-with-plugin',
    config: {
      name: 'test-theme-with-plugin',
      displayName: 'Test Theme',
      version: '1.0.0',
      description: 'Theme for testing plugins',
      plugins: ['test-plugin']
    },
    hasComponents: false,
    hasStyles: false,
    hasAssets: false,
    hasMessages: false,
    hasDashboardConfig: false,
    dashboardConfig: null,
    hasAppConfig: false,
    appConfig: null,
    componentsPath: null,
    stylesPath: null,
    assetsPath: null,
    messagesPath: null,
    entities: [
      {
        name: 'test-entity',
        exportName: 'testEntityConfig',
        configPath: '@/test/entity',
        actualConfigFile: 'entity.config.ts',
        relativePath: 'test',
        depth: 0,
        parent: null,
        children: [],
        hasComponents: false,
        hasHooks: false,
        hasMigrations: false,
        hasMessages: false,
        hasAssets: false,
        messagesPath: '',
        pluginContext: null,
        themeContext: { themeName: 'test-theme-with-plugin' },
        source: 'theme'
      }
    ],
    routeFiles: [
      {
        path: '/api/test',
        filePath: 'test/route.ts',
        relativePath: 'test',
        methods: ['GET'],
        isRouteFile: true,
        theme: 'test-theme-with-plugin'
      }
    ],
    plugins: ['test-plugin']
  }

  return {
    ...actual,
    THEME_REGISTRY: {
      ...actual.THEME_REGISTRY,
      'test-theme-with-plugin': mockThemeWithPlugin
    },
    THEME_METADATA: {
      ...actual.THEME_METADATA,
      totalThemes: actual.THEME_METADATA.totalThemes + 1,
      themesUsingPlugins: 1,
      themesWithEntities: actual.THEME_METADATA.themesWithEntities + 1, // Mock has entities
      themesWithRoutes: actual.THEME_METADATA.themesWithRoutes + 1, // Mock has routes
      totalThemeEntities: actual.THEME_METADATA.totalThemeEntities + 1, // +1 entity
      totalThemeRoutes: actual.THEME_METADATA.totalThemeRoutes + 1, // +1 route
      themes: [...actual.THEME_METADATA.themes, 'test-theme-with-plugin']
    }
  }
})

describe('ThemeService', () => {
  describe('getAll', () => {
    it('should return array of ThemeConfig', () => {
      const themes = ThemeService.getAll()

      expect(Array.isArray(themes)).toBe(true)
      expect(themes.length).toBeGreaterThan(0)
    })

    it('should return correct number of themes', () => {
      const themes = ThemeService.getAll()
      const count = ThemeService.getCount()

      expect(themes.length).toBe(count)
    })

    it('should have expected properties on each theme', () => {
      const themes = ThemeService.getAll()

      themes.forEach(theme => {
        expect(theme).toHaveProperty('name')
        expect(theme).toHaveProperty('displayName')
        expect(theme).toHaveProperty('version')
        expect(typeof theme.name).toBe('string')
        expect(typeof theme.displayName).toBe('string')
        expect(typeof theme.version).toBe('string')
      })
    })

    it('should contain default theme', () => {
      const themes = ThemeService.getAll()
      const hasDefault = themes.some(theme => theme.name === 'default')

      expect(hasDefault).toBe(true)
    })
  })

  describe('getByName', () => {
    it('should return ThemeConfig for valid theme', () => {
      const theme = ThemeService.getByName('default')

      expect(theme).toBeDefined()
      expect(theme?.name).toBe('default')
      expect(theme?.displayName).toBeDefined()
    })

    it('should return undefined for invalid theme', () => {
      const theme = ThemeService.getByName('non-existent-theme')

      expect(theme).toBeUndefined()
    })

    it('should return undefined for empty string', () => {
      const theme = ThemeService.getByName('')

      expect(theme).toBeUndefined()
    })

    it('should return ThemeConfig with correct structure', () => {
      const theme = ThemeService.getByName('default')

      expect(theme).toBeDefined()
      if (theme) {
        expect(typeof theme.name).toBe('string')
        expect(typeof theme.displayName).toBe('string')
        expect(typeof theme.version).toBe('string')
      }
    })
  })

  describe('getEntry', () => {
    it('should return full ThemeRegistryEntry for valid theme', () => {
      const entry = ThemeService.getEntry('default')

      expect(entry).toBeDefined()
      expect(entry?.name).toBe('default')
      expect(entry?.config).toBeDefined()
      expect(entry).toHaveProperty('hasComponents')
      expect(entry).toHaveProperty('hasStyles')
      expect(entry).toHaveProperty('hasAssets')
      expect(entry).toHaveProperty('hasMessages')
      expect(entry).toHaveProperty('hasDashboardConfig')
      expect(entry).toHaveProperty('hasAppConfig')
      expect(entry).toHaveProperty('entities')
      expect(entry).toHaveProperty('routeFiles')
      expect(entry).toHaveProperty('plugins')
    })

    it('should return undefined for invalid theme', () => {
      const entry = ThemeService.getEntry('non-existent-theme')

      expect(entry).toBeUndefined()
    })

    it('should include entities array in entry', () => {
      const entry = ThemeService.getEntry('default')

      expect(entry?.entities).toBeDefined()
      expect(Array.isArray(entry?.entities)).toBe(true)
    })

    it('should include routeFiles array in entry', () => {
      const entry = ThemeService.getEntry('default')

      expect(entry?.routeFiles).toBeDefined()
      expect(Array.isArray(entry?.routeFiles)).toBe(true)
    })

    it('should include plugins array in entry', () => {
      const entry = ThemeService.getEntry('default')

      expect(entry?.plugins).toBeDefined()
      expect(Array.isArray(entry?.plugins)).toBe(true)
    })
  })

  describe('getDashboardConfig', () => {
    it('should return dashboard config for valid theme', () => {
      const config = ThemeService.getDashboardConfig('default')

      // Default theme has dashboard config
      expect(config).toBeDefined()
    })

    it('should return undefined for invalid theme', () => {
      const config = ThemeService.getDashboardConfig('non-existent-theme')

      expect(config).toBeUndefined()
    })

    it('should match hasDashboardConfig flag', () => {
      const entry = ThemeService.getEntry('default')
      const config = ThemeService.getDashboardConfig('default')

      if (entry?.hasDashboardConfig) {
        expect(config).toBeDefined()
      } else {
        expect(config).toBeNull()
      }
    })
  })

  describe('getAppConfig', () => {
    it('should return app config for valid theme', () => {
      const config = ThemeService.getAppConfig('default')

      // Default theme has app config
      expect(config).toBeDefined()
    })

    it('should return undefined for invalid theme', () => {
      const config = ThemeService.getAppConfig('non-existent-theme')

      expect(config).toBeUndefined()
    })

    it('should match hasAppConfig flag', () => {
      const entry = ThemeService.getEntry('default')
      const config = ThemeService.getAppConfig('default')

      if (entry?.hasAppConfig) {
        expect(config).toBeDefined()
      } else {
        expect(config).toBeNull()
      }
    })
  })

  describe('getWithEntities', () => {
    it('should return array of ThemeRegistryEntry', () => {
      const themes = ThemeService.getWithEntities()

      expect(Array.isArray(themes)).toBe(true)
    })

    it('should only include themes with entities', () => {
      const themes = ThemeService.getWithEntities()

      themes.forEach(theme => {
        expect(theme.entities).toBeDefined()
        expect(Array.isArray(theme.entities)).toBe(true)
        expect(theme.entities.length).toBeGreaterThan(0)
      })
    })

    it('should include default theme if it has entities', () => {
      const defaultEntry = ThemeService.getEntry('default')
      const themesWithEntities = ThemeService.getWithEntities()

      if (defaultEntry?.entities && defaultEntry.entities.length > 0) {
        const hasDefault = themesWithEntities.some(theme => theme.name === 'default')
        expect(hasDefault).toBe(true)
      }
    })

    it('should have entities.length > 0 for each result', () => {
      const themes = ThemeService.getWithEntities()

      themes.forEach(theme => {
        expect(theme.entities.length).toBeGreaterThan(0)
      })
    })
  })

  describe('getWithRoutes', () => {
    it('should return array of ThemeRegistryEntry', () => {
      const themes = ThemeService.getWithRoutes()

      expect(Array.isArray(themes)).toBe(true)
    })

    it('should only include themes with route files', () => {
      const themes = ThemeService.getWithRoutes()

      themes.forEach(theme => {
        expect(theme.routeFiles).toBeDefined()
        expect(Array.isArray(theme.routeFiles)).toBe(true)
        expect(theme.routeFiles.length).toBeGreaterThan(0)
      })
    })

    it('should filter themes with routes correctly', () => {
      const themes = ThemeService.getWithRoutes()
      const metadata = ThemeService.getMetadata()

      // With mock, we have at least one theme with routes
      expect(themes.length).toBe(metadata.themesWithRoutes)

      // Verify all returned themes actually have routes
      themes.forEach(theme => {
        expect(theme.routeFiles.length).toBeGreaterThan(0)
      })
    })
  })

  describe('getUsingPlugin', () => {
    it('should return array of ThemeRegistryEntry', () => {
      const themes = ThemeService.getUsingPlugin('some-plugin')

      expect(Array.isArray(themes)).toBe(true)
    })

    it('should return empty array for unknown plugin', () => {
      const themes = ThemeService.getUsingPlugin('non-existent-plugin')

      expect(themes.length).toBe(0)
    })

    it('should return empty array for empty string', () => {
      const themes = ThemeService.getUsingPlugin('')

      expect(themes.length).toBe(0)
    })

    it('should only include themes that use the plugin', () => {
      const pluginName = 'test-plugin'
      const themes = ThemeService.getUsingPlugin(pluginName)

      themes.forEach(theme => {
        expect(theme.plugins).toBeDefined()
        expect(Array.isArray(theme.plugins)).toBe(true)
        expect(theme.plugins).toContain(pluginName)
      })
    })

    it('should return themes using test-plugin from mock', () => {
      const themes = ThemeService.getUsingPlugin('test-plugin')

      expect(themes.length).toBeGreaterThan(0)
      const testTheme = themes.find(t => t.name === 'test-theme-with-plugin')
      expect(testTheme).toBeDefined()
      expect(testTheme?.plugins).toContain('test-plugin')
    })
  })

  describe('getPluginUsage', () => {
    it('should return array with correct shape', () => {
      const usage = ThemeService.getPluginUsage('some-plugin')

      expect(Array.isArray(usage)).toBe(true)

      usage.forEach(item => {
        expect(item).toHaveProperty('theme')
        expect(item).toHaveProperty('entities')
        expect(item).toHaveProperty('routes')
        expect(typeof item.theme).toBe('string')
        expect(typeof item.entities).toBe('number')
        expect(typeof item.routes).toBe('number')
      })
    })

    it('should return empty array for unknown plugin', () => {
      const usage = ThemeService.getPluginUsage('non-existent-plugin')

      expect(usage.length).toBe(0)
    })

    it('should include entity and route counts', () => {
      const usage = ThemeService.getPluginUsage('test-plugin')

      usage.forEach(item => {
        expect(item.entities).toBeGreaterThanOrEqual(0)
        expect(item.routes).toBeGreaterThanOrEqual(0)
      })
    })

    it('should match themes from getUsingPlugin', () => {
      const pluginName = 'test-plugin'
      const themes = ThemeService.getUsingPlugin(pluginName)
      const usage = ThemeService.getPluginUsage(pluginName)

      expect(usage.length).toBe(themes.length)

      const themeNames = themes.map(t => t.name)
      const usageNames = usage.map(u => u.theme)

      expect(usageNames.sort()).toEqual(themeNames.sort())
    })

    it('should return usage stats for test-plugin from mock', () => {
      const usage = ThemeService.getPluginUsage('test-plugin')

      expect(usage.length).toBeGreaterThan(0)

      const testThemeUsage = usage.find(u => u.theme === 'test-theme-with-plugin')
      expect(testThemeUsage).toBeDefined()

      if (testThemeUsage) {
        expect(testThemeUsage.theme).toBe('test-theme-with-plugin')
        expect(testThemeUsage.entities).toBe(1) // Mock has 1 entity
        expect(testThemeUsage.routes).toBe(1) // Mock has 1 route
      }
    })

    it('should correctly map entity and route counts', () => {
      const usage = ThemeService.getPluginUsage('test-plugin')

      // Verify that the counts match the actual registry entry
      const testEntry = ThemeService.getEntry('test-theme-with-plugin')
      const testUsage = usage.find(u => u.theme === 'test-theme-with-plugin')

      if (testEntry && testUsage) {
        expect(testUsage.entities).toBe(testEntry.entities.length)
        expect(testUsage.routes).toBe(testEntry.routeFiles.length)
      }
    })
  })

  describe('exists', () => {
    it('should return true for existing theme', () => {
      expect(ThemeService.exists('default')).toBe(true)
    })

    it('should return false for non-existent theme', () => {
      expect(ThemeService.exists('non-existent-theme')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(ThemeService.exists('')).toBe(false)
    })

    it('should be consistent with getByName', () => {
      const themeName = 'default'
      const exists = ThemeService.exists(themeName)
      const theme = ThemeService.getByName(themeName)

      if (exists) {
        expect(theme).toBeDefined()
      } else {
        expect(theme).toBeUndefined()
      }
    })
  })

  describe('getNames', () => {
    it('should return array of theme names', () => {
      const names = ThemeService.getNames()

      expect(Array.isArray(names)).toBe(true)
      expect(names.length).toBeGreaterThan(0)
    })

    it('should contain default theme', () => {
      const names = ThemeService.getNames()

      expect(names).toContain('default')
    })

    it('should match total theme count', () => {
      const names = ThemeService.getNames()
      const count = ThemeService.getCount()

      expect(names.length).toBe(count)
    })

    it('should only contain strings', () => {
      const names = ThemeService.getNames()

      names.forEach(name => {
        expect(typeof name).toBe('string')
      })
    })
  })

  describe('getCount', () => {
    it('should return number >= 1', () => {
      const count = ThemeService.getCount()

      expect(typeof count).toBe('number')
      expect(count).toBeGreaterThanOrEqual(1)
    })

    it('should match number of themes from getAll', () => {
      const count = ThemeService.getCount()
      const themes = ThemeService.getAll()

      expect(count).toBe(themes.length)
    })

    it('should match metadata totalThemes', () => {
      const count = ThemeService.getCount()
      const metadata = ThemeService.getMetadata()

      expect(count).toBe(metadata.totalThemes)
    })
  })

  describe('getMetadata', () => {
    it('should return metadata object', () => {
      const metadata = ThemeService.getMetadata()

      expect(metadata).toBeDefined()
      expect(typeof metadata).toBe('object')
    })

    it('should have expected keys', () => {
      const metadata = ThemeService.getMetadata()

      expect(metadata).toHaveProperty('totalThemes')
      expect(metadata).toHaveProperty('themesWithComponents')
      expect(metadata).toHaveProperty('themesWithStyles')
      expect(metadata).toHaveProperty('themesWithAssets')
      expect(metadata).toHaveProperty('themesWithMessages')
      expect(metadata).toHaveProperty('themesWithDashboardConfig')
      expect(metadata).toHaveProperty('themesWithEntities')
      expect(metadata).toHaveProperty('themesWithRoutes')
      expect(metadata).toHaveProperty('themesUsingPlugins')
      expect(metadata).toHaveProperty('totalThemeEntities')
      expect(metadata).toHaveProperty('totalThemeRoutes')
      expect(metadata).toHaveProperty('generatedAt')
      expect(metadata).toHaveProperty('themes')
    })

    it('should have correct types', () => {
      const metadata = ThemeService.getMetadata()

      expect(typeof metadata.totalThemes).toBe('number')
      expect(typeof metadata.themesWithComponents).toBe('number')
      expect(typeof metadata.themesWithStyles).toBe('number')
      expect(typeof metadata.themesWithAssets).toBe('number')
      expect(typeof metadata.themesWithMessages).toBe('number')
      expect(typeof metadata.themesWithDashboardConfig).toBe('number')
      expect(typeof metadata.themesWithEntities).toBe('number')
      expect(typeof metadata.themesWithRoutes).toBe('number')
      expect(typeof metadata.themesUsingPlugins).toBe('number')
      expect(typeof metadata.totalThemeEntities).toBe('number')
      expect(typeof metadata.totalThemeRoutes).toBe('number')
      expect(typeof metadata.generatedAt).toBe('string')
      expect(Array.isArray(metadata.themes)).toBe(true)
    })

    it('should have totalThemes >= 1', () => {
      const metadata = ThemeService.getMetadata()

      expect(metadata.totalThemes).toBeGreaterThanOrEqual(1)
    })

    it('should have themes array with at least one element', () => {
      const metadata = ThemeService.getMetadata()

      expect(metadata.themes.length).toBeGreaterThanOrEqual(1)
    })

    it('should have consistent counts', () => {
      const metadata = ThemeService.getMetadata()

      expect(metadata.themes.length).toBe(metadata.totalThemes)
    })
  })

  describe('Backward Compatibility Exports', () => {
    describe('getRegisteredThemes', () => {
      it('should be an alias for ThemeService.getAll', () => {
        const resultService = ThemeService.getAll()
        const resultExport = getRegisteredThemes()

        expect(resultExport).toEqual(resultService)
      })

      it('should return array of ThemeConfig', () => {
        const themes = getRegisteredThemes()

        expect(Array.isArray(themes)).toBe(true)
        expect(themes.length).toBeGreaterThan(0)
      })
    })

    describe('getTheme', () => {
      it('should be an alias for ThemeService.getByName', () => {
        const resultService = ThemeService.getByName('default')
        const resultExport = getTheme('default')

        expect(resultExport).toEqual(resultService)
      })

      it('should return theme for valid name', () => {
        const theme = getTheme('default')

        expect(theme).toBeDefined()
      })

      it('should return undefined for invalid name', () => {
        const theme = getTheme('non-existent-theme')

        expect(theme).toBeUndefined()
      })
    })

    describe('getThemeDashboardConfig', () => {
      it('should be an alias for ThemeService.getDashboardConfig', () => {
        const resultService = ThemeService.getDashboardConfig('default')
        const resultExport = getThemeDashboardConfig('default')

        expect(resultExport).toEqual(resultService)
      })

      it('should return dashboard config for valid theme', () => {
        const config = getThemeDashboardConfig('default')

        expect(config).toBeDefined()
      })

      it('should return undefined for invalid theme', () => {
        const config = getThemeDashboardConfig('non-existent-theme')

        expect(config).toBeUndefined()
      })
    })

    describe('getThemeAppConfig', () => {
      it('should be an alias for ThemeService.getAppConfig', () => {
        const resultService = ThemeService.getAppConfig('default')
        const resultExport = getThemeAppConfig('default')

        expect(resultExport).toEqual(resultService)
      })

      it('should return app config for valid theme', () => {
        const config = getThemeAppConfig('default')

        expect(config).toBeDefined()
      })

      it('should return undefined for invalid theme', () => {
        const config = getThemeAppConfig('non-existent-theme')

        expect(config).toBeUndefined()
      })
    })

    describe('getThemesWithEntities', () => {
      it('should be an alias for ThemeService.getWithEntities', () => {
        const resultService = ThemeService.getWithEntities()
        const resultExport = getThemesWithEntities()

        expect(resultExport).toEqual(resultService)
      })

      it('should return array of themes with entities', () => {
        const themes = getThemesWithEntities()

        expect(Array.isArray(themes)).toBe(true)
        themes.forEach(theme => {
          expect(theme.entities.length).toBeGreaterThan(0)
        })
      })
    })

    describe('getThemesWithRoutes', () => {
      it('should be an alias for ThemeService.getWithRoutes', () => {
        const resultService = ThemeService.getWithRoutes()
        const resultExport = getThemesWithRoutes()

        expect(resultExport).toEqual(resultService)
      })

      it('should return array of themes with routes', () => {
        const themes = getThemesWithRoutes()

        expect(Array.isArray(themes)).toBe(true)
      })
    })

    describe('getThemesUsingPlugin', () => {
      it('should be an alias for ThemeService.getUsingPlugin', () => {
        const resultService = ThemeService.getUsingPlugin('test-plugin')
        const resultExport = getThemesUsingPlugin('test-plugin')

        expect(resultExport).toEqual(resultService)
      })

      it('should return array for valid plugin', () => {
        const themes = getThemesUsingPlugin('test-plugin')

        expect(Array.isArray(themes)).toBe(true)
      })

      it('should return empty array for unknown plugin', () => {
        const themes = getThemesUsingPlugin('non-existent-plugin')

        expect(themes.length).toBe(0)
      })
    })

    describe('getPluginUsage', () => {
      it('should be an alias for ThemeService.getPluginUsage', () => {
        const resultService = ThemeService.getPluginUsage('test-plugin')
        const resultExport = getPluginUsage('test-plugin')

        expect(resultExport).toEqual(resultService)
      })

      it('should return array with correct shape', () => {
        const usage = getPluginUsage('test-plugin')

        expect(Array.isArray(usage)).toBe(true)
        usage.forEach(item => {
          expect(item).toHaveProperty('theme')
          expect(item).toHaveProperty('entities')
          expect(item).toHaveProperty('routes')
        })
      })

      it('should return empty array for unknown plugin', () => {
        const usage = getPluginUsage('non-existent-plugin')

        expect(usage.length).toBe(0)
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty string in getByName', () => {
      const theme = ThemeService.getByName('')

      expect(theme).toBeUndefined()
    })

    it('should handle empty string in getEntry', () => {
      const entry = ThemeService.getEntry('')

      expect(entry).toBeUndefined()
    })

    it('should handle empty string in getDashboardConfig', () => {
      const config = ThemeService.getDashboardConfig('')

      expect(config).toBeUndefined()
    })

    it('should handle empty string in getAppConfig', () => {
      const config = ThemeService.getAppConfig('')

      expect(config).toBeUndefined()
    })

    it('should handle whitespace-only string in exists', () => {
      expect(ThemeService.exists('   ')).toBe(false)
    })

    it('should handle special characters in theme name lookup', () => {
      expect(ThemeService.exists('theme-with-dashes')).toBe(false)
      expect(ThemeService.getByName('theme.with.dots')).toBeUndefined()
    })
  })

  describe('Data Consistency', () => {
    it('should have consistent entity counts in metadata', () => {
      const metadata = ThemeService.getMetadata()
      const themesWithEntities = ThemeService.getWithEntities()

      // Verify metadata matches actual data
      expect(themesWithEntities.length).toBeGreaterThan(0)

      // Count should be at least as many themes as we have with entities
      expect(metadata.themesWithEntities).toBeGreaterThanOrEqual(themesWithEntities.length)
    })

    it('should have consistent route counts in metadata', () => {
      const metadata = ThemeService.getMetadata()
      const themesWithRoutes = ThemeService.getWithRoutes()

      // Verify metadata matches actual data
      // With mock, we have routes
      expect(themesWithRoutes.length).toBeGreaterThan(0)

      // Count should match
      expect(metadata.themesWithRoutes).toBe(themesWithRoutes.length)
    })

    it('should have consistent themes in getNames and getAll', () => {
      const names = ThemeService.getNames()
      const themes = ThemeService.getAll()

      expect(names.length).toBe(themes.length)

      names.forEach(name => {
        const theme = themes.find(t => t.name === name)
        expect(theme).toBeDefined()
      })
    })

    it('should have all themes from getNames exist', () => {
      const names = ThemeService.getNames()

      names.forEach(name => {
        expect(ThemeService.exists(name)).toBe(true)
      })
    })
  })
})
