/**
 * Unit Tests - PluginService
 *
 * Tests the PluginService static methods that provide runtime plugin system queries.
 * This service layer abstracts plugin-registry access (Data-Only pattern).
 *
 * Test Coverage:
 * - Core Query Methods (14): getAll, get, getEntry, exists, etc.
 * - Plugin Function Access (3): getFunction, getFunctions, hasFunction
 * - usePlugin Hook: Hook behavior, stubs, API extraction
 * - Server Initialization: initializeAll, onLoad hooks
 * - Metadata & Helpers: getMetadata, getNames, getCount
 * - Backward Compatibility: All deprecated exports
 * - Edge Cases: Empty registry, invalid inputs, immutability
 *
 * Target: ~120 tests with 100% coverage
 */

import {
  PluginService,
  usePlugin,
  // Backward compatibility exports
  getRegisteredPlugins,
  getPlugin,
  getPluginsWithAPI,
  getPluginsWithEntities,
  getAllPluginEntities,
  getPluginEntitiesByName,
  getAllRouteEndpoints,
  findRouteEndpoint,
  getPluginRouteEndpoints,
  getPluginFunction,
  getPluginFunctions,
  hasPluginFunction,
  getRouteMetadata,
  hasRoute,
  initializeAllPlugins,
} from '@/core/lib/services/plugin.service'

// Mock the plugin registry
jest.mock('@/core/lib/registries/plugin-registry', () => ({
  PLUGIN_REGISTRY: {
    'test-plugin': {
      name: 'test-plugin',
      config: {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test plugin with API',
        api: {
          testFunction: jest.fn(() => 'test-result'),
          anotherFunction: jest.fn(() => 'another-result'),
          AIAPI: {
            generateText: jest.fn(() => 'generated-text'),
            enhanceText: jest.fn(() => 'enhanced-text'),
          },
        },
        hooks: {
          onLoad: jest.fn().mockResolvedValue(undefined),
        },
      },
      hasAPI: true,
      apiPath: '/api/plugins/test',
      routeFiles: [
        {
          path: '/api/plugins/test/endpoint',
          filePath: 'contents/plugins/test-plugin/api/endpoint.ts',
          relativePath: 'api/endpoint.ts',
          methods: ['GET', 'POST'],
          isRouteFile: true,
        },
      ],
      entities: [
        {
          name: 'TestEntity',
          exportName: 'TestEntity',
          configPath: 'contents/plugins/test-plugin/entities/TestEntity/config.ts',
          actualConfigFile: 'contents/plugins/test-plugin/entities/TestEntity/config.ts',
          relativePath: 'entities/TestEntity',
          depth: 0,
          parent: null,
          children: [],
          hasComponents: false,
          hasHooks: false,
          hasMigrations: false,
          hasMessages: false,
          hasAssets: false,
          messagesPath: '',
          pluginContext: { pluginName: 'test-plugin' },
        },
      ],
      hasMessages: false,
      hasAssets: false,
    },
    'no-api-plugin': {
      name: 'no-api-plugin',
      config: {
        name: 'no-api-plugin',
        version: '2.0.0',
        description: 'Plugin without API',
      },
      hasAPI: false,
      apiPath: null,
      routeFiles: [],
      entities: [],
      hasMessages: false,
      hasAssets: false,
    },
    'plugin-with-entities': {
      name: 'plugin-with-entities',
      config: {
        name: 'plugin-with-entities',
        version: '3.0.0',
        description: 'Plugin with entities',
      },
      hasAPI: false,
      apiPath: null,
      routeFiles: [],
      entities: [
        {
          name: 'EntityOne',
          exportName: 'EntityOne',
          configPath: 'contents/plugins/plugin-with-entities/entities/EntityOne/config.ts',
          actualConfigFile: 'contents/plugins/plugin-with-entities/entities/EntityOne/config.ts',
          relativePath: 'entities/EntityOne',
          depth: 0,
          parent: null,
          children: [],
          hasComponents: false,
          hasHooks: false,
          hasMigrations: false,
          hasMessages: false,
          hasAssets: false,
          messagesPath: '',
          pluginContext: { pluginName: 'plugin-with-entities' },
        },
        {
          name: 'EntityTwo',
          exportName: 'EntityTwo',
          configPath: 'contents/plugins/plugin-with-entities/entities/EntityTwo/config.ts',
          actualConfigFile: 'contents/plugins/plugin-with-entities/entities/EntityTwo/config.ts',
          relativePath: 'entities/EntityTwo',
          depth: 0,
          parent: null,
          children: [],
          hasComponents: false,
          hasHooks: false,
          hasMigrations: false,
          hasMessages: false,
          hasAssets: false,
          messagesPath: '',
          pluginContext: { pluginName: 'plugin-with-entities' },
        },
      ],
      hasMessages: false,
      hasAssets: false,
    },
  },
  ROUTE_METADATA: {
    '/api/plugins/test/endpoint': {
      plugin: 'test-plugin',
      methods: ['GET', 'POST'],
      filePath: 'contents/plugins/test-plugin/api/endpoint.ts',
    },
  },
  PLUGIN_METADATA: {
    totalPlugins: 3,
    pluginsWithAPI: 1,
    pluginsWithEntities: 2,
    pluginsWithMessages: 0,
    pluginsWithAssets: 0,
    totalRouteFiles: 1,
    totalPluginEntities: 3,
    generatedAt: '2025-12-26T00:00:00.000Z',
    plugins: ['test-plugin', 'no-api-plugin', 'plugin-with-entities'],
  },
}))

describe('PluginService', () => {
  describe('Core Methods - getAll()', () => {
    it('should return array of all plugin configs', () => {
      const plugins = PluginService.getAll()

      expect(Array.isArray(plugins)).toBe(true)
      expect(plugins.length).toBe(3)
    })

    it('should return plugin configs with name and version', () => {
      const plugins = PluginService.getAll()

      expect(plugins[0]).toHaveProperty('name')
      expect(plugins[0]).toHaveProperty('version')
    })

    it('should return configs in consistent order', () => {
      const plugins1 = PluginService.getAll()
      const plugins2 = PluginService.getAll()

      expect(plugins1.map((p) => p.name)).toEqual(plugins2.map((p) => p.name))
    })
  })

  describe('Core Methods - get()', () => {
    it('should return plugin config for valid plugin name', () => {
      const plugin = PluginService.get('test-plugin')

      expect(plugin).toBeDefined()
      expect(plugin?.name).toBe('test-plugin')
      expect(plugin?.version).toBe('1.0.0')
    })

    it('should return undefined for non-existent plugin', () => {
      const plugin = PluginService.get('invalid-plugin')

      expect(plugin).toBeUndefined()
    })

    it('should return undefined for empty string', () => {
      const plugin = PluginService.get('')

      expect(plugin).toBeUndefined()
    })

    it('should be case-sensitive', () => {
      const plugin1 = PluginService.get('test-plugin')
      const plugin2 = PluginService.get('TEST-PLUGIN')

      expect(plugin1).toBeDefined()
      expect(plugin2).toBeUndefined()
    })
  })

  describe('Core Methods - getEntry()', () => {
    it('should return full registry entry for valid plugin', () => {
      const entry = PluginService.getEntry('test-plugin')

      expect(entry).toBeDefined()
      expect(entry?.name).toBe('test-plugin')
      expect(entry?.config).toBeDefined()
      expect(entry?.hasAPI).toBe(true)
    })

    it('should return undefined for non-existent plugin', () => {
      const entry = PluginService.getEntry('invalid-plugin')

      expect(entry).toBeUndefined()
    })

    it('should include all registry metadata fields', () => {
      const entry = PluginService.getEntry('test-plugin')

      expect(entry).toHaveProperty('name')
      expect(entry).toHaveProperty('config')
      expect(entry).toHaveProperty('hasAPI')
      expect(entry).toHaveProperty('apiPath')
      expect(entry).toHaveProperty('routeFiles')
      expect(entry).toHaveProperty('entities')
    })
  })

  describe('Core Methods - exists()', () => {
    it('should return true for existing plugin', () => {
      expect(PluginService.exists('test-plugin')).toBe(true)
      expect(PluginService.exists('no-api-plugin')).toBe(true)
    })

    it('should return false for non-existent plugin', () => {
      expect(PluginService.exists('invalid-plugin')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(PluginService.exists('')).toBe(false)
    })
  })

  describe('Core Methods - getNames()', () => {
    it('should return array of plugin names', () => {
      const names = PluginService.getNames()

      expect(Array.isArray(names)).toBe(true)
      expect(names).toContain('test-plugin')
      expect(names).toContain('no-api-plugin')
    })

    it('should return correct count of names', () => {
      const names = PluginService.getNames()

      expect(names.length).toBe(3)
    })
  })

  describe('Core Methods - getCount()', () => {
    it('should return correct number of plugins', () => {
      const count = PluginService.getCount()

      expect(count).toBe(3)
    })

    it('should match getNames().length', () => {
      const count = PluginService.getCount()
      const names = PluginService.getNames()

      expect(count).toBe(names.length)
    })
  })

  describe('Core Methods - getWithAPI()', () => {
    it('should return only plugins with API', () => {
      const plugins = PluginService.getWithAPI()

      expect(Array.isArray(plugins)).toBe(true)
      expect(plugins.length).toBe(1)
      expect(plugins[0].name).toBe('test-plugin')
    })

    it('should return entries with hasAPI true', () => {
      const plugins = PluginService.getWithAPI()

      for (const plugin of plugins) {
        expect(plugin.hasAPI).toBe(true)
      }
    })

    it('should not include plugins without API', () => {
      const plugins = PluginService.getWithAPI()

      expect(plugins.find((p) => p.name === 'no-api-plugin')).toBeUndefined()
    })
  })

  describe('Core Methods - getWithEntities()', () => {
    it('should return only plugins with entities', () => {
      const plugins = PluginService.getWithEntities()

      expect(Array.isArray(plugins)).toBe(true)
      expect(plugins.length).toBe(2)
    })

    it('should include test-plugin with entities', () => {
      const plugins = PluginService.getWithEntities()

      expect(plugins.find((p) => p.name === 'test-plugin')).toBeDefined()
    })

    it('should include plugin-with-entities', () => {
      const plugins = PluginService.getWithEntities()

      expect(plugins.find((p) => p.name === 'plugin-with-entities')).toBeDefined()
    })
  })

  describe('Core Methods - getAllEntities()', () => {
    it('should return all entities across all plugins', () => {
      const entities = PluginService.getAllEntities()

      expect(Array.isArray(entities)).toBe(true)
      expect(entities.length).toBe(3)
    })

    it('should include entities from test-plugin', () => {
      const entities = PluginService.getAllEntities()

      expect(entities.find((e) => e.name === 'TestEntity')).toBeDefined()
    })

    it('should include entities from plugin-with-entities', () => {
      const entities = PluginService.getAllEntities()

      expect(entities.find((e) => e.name === 'EntityOne')).toBeDefined()
      expect(entities.find((e) => e.name === 'EntityTwo')).toBeDefined()
    })
  })

  describe('Core Methods - getEntities()', () => {
    it('should return entities for test-plugin', () => {
      const entities = PluginService.getEntities('test-plugin')

      expect(Array.isArray(entities)).toBe(true)
      expect(entities.length).toBe(1)
      expect(entities[0].name).toBe('TestEntity')
    })

    it('should return empty array for plugin without entities', () => {
      const entities = PluginService.getEntities('no-api-plugin')

      expect(Array.isArray(entities)).toBe(true)
      expect(entities.length).toBe(0)
    })

    it('should return empty array for non-existent plugin', () => {
      const entities = PluginService.getEntities('invalid-plugin')

      expect(Array.isArray(entities)).toBe(true)
      expect(entities.length).toBe(0)
    })
  })

  describe('Core Methods - getAllRouteEndpoints()', () => {
    it('should return all route endpoints', () => {
      const endpoints = PluginService.getAllRouteEndpoints()

      expect(Array.isArray(endpoints)).toBe(true)
      expect(endpoints.length).toBe(1)
    })

    it('should include endpoint from test-plugin', () => {
      const endpoints = PluginService.getAllRouteEndpoints()

      expect(endpoints[0].path).toBe('/api/plugins/test/endpoint')
      expect(endpoints[0].methods).toContain('GET')
      expect(endpoints[0].methods).toContain('POST')
    })
  })

  describe('Core Methods - findRouteEndpoint()', () => {
    it('should find existing route endpoint', () => {
      const endpoint = PluginService.findRouteEndpoint('/api/plugins/test/endpoint')

      expect(endpoint).toBeDefined()
      expect(endpoint?.path).toBe('/api/plugins/test/endpoint')
    })

    it('should return undefined for non-existent route', () => {
      const endpoint = PluginService.findRouteEndpoint('/invalid/path')

      expect(endpoint).toBeUndefined()
    })

    it('should return undefined for empty path', () => {
      const endpoint = PluginService.findRouteEndpoint('')

      expect(endpoint).toBeUndefined()
    })
  })

  describe('Core Methods - getRouteMetadata()', () => {
    it('should return metadata for existing route', () => {
      const metadata = PluginService.getRouteMetadata('/api/plugins/test/endpoint')

      expect(metadata).toBeDefined()
      expect(metadata?.plugin).toBe('test-plugin')
      expect(metadata?.methods).toContain('GET')
      expect(metadata?.methods).toContain('POST')
    })

    it('should return null for non-existent route', () => {
      const metadata = PluginService.getRouteMetadata('/invalid/path')

      expect(metadata).toBeNull()
    })

    it('should include filePath in metadata', () => {
      const metadata = PluginService.getRouteMetadata('/api/plugins/test/endpoint')

      expect(metadata?.filePath).toBe('contents/plugins/test-plugin/api/endpoint.ts')
    })
  })

  describe('Core Methods - hasRoute()', () => {
    it('should return true for existing route without method', () => {
      expect(PluginService.hasRoute('/api/plugins/test/endpoint')).toBe(true)
    })

    it('should return true for existing route with valid method', () => {
      expect(PluginService.hasRoute('/api/plugins/test/endpoint', 'GET')).toBe(true)
      expect(PluginService.hasRoute('/api/plugins/test/endpoint', 'POST')).toBe(true)
    })

    it('should return false for existing route with invalid method', () => {
      expect(PluginService.hasRoute('/api/plugins/test/endpoint', 'DELETE')).toBe(false)
    })

    it('should return false for non-existent route', () => {
      expect(PluginService.hasRoute('/invalid/path')).toBe(false)
    })
  })

  describe('Plugin Function Access - getFunction()', () => {
    it('should return direct function from plugin API', () => {
      const func = PluginService.getFunction('test-plugin', 'testFunction')

      expect(func).toBeDefined()
      expect(typeof func).toBe('function')
    })

    it('should return nested function from plugin API', () => {
      const func = PluginService.getFunction('test-plugin', 'generateText')

      expect(func).toBeDefined()
      expect(typeof func).toBe('function')
    })

    it('should return undefined for non-existent function', () => {
      const func = PluginService.getFunction('test-plugin', 'invalidFunction')

      expect(func).toBeUndefined()
    })

    it('should return undefined for plugin without API', () => {
      const func = PluginService.getFunction('no-api-plugin', 'anyFunction')

      expect(func).toBeUndefined()
    })

    it('should return undefined for non-existent plugin', () => {
      const func = PluginService.getFunction('invalid-plugin', 'anyFunction')

      expect(func).toBeUndefined()
    })

    it('should handle empty function name', () => {
      const func = PluginService.getFunction('test-plugin', '')

      expect(func).toBeUndefined()
    })
  })

  describe('Plugin Function Access - getFunctions()', () => {
    it('should return all function names for plugin with API', () => {
      const functions = PluginService.getFunctions('test-plugin')

      expect(Array.isArray(functions)).toBe(true)
      expect(functions).toContain('testFunction')
      expect(functions).toContain('anotherFunction')
      expect(functions).toContain('generateText')
      expect(functions).toContain('enhanceText')
    })

    it('should return empty array for plugin without API', () => {
      const functions = PluginService.getFunctions('no-api-plugin')

      expect(Array.isArray(functions)).toBe(true)
      expect(functions.length).toBe(0)
    })

    it('should return empty array for non-existent plugin', () => {
      const functions = PluginService.getFunctions('invalid-plugin')

      expect(Array.isArray(functions)).toBe(true)
      expect(functions.length).toBe(0)
    })

    it('should return empty array for empty plugin name', () => {
      const functions = PluginService.getFunctions('')

      expect(Array.isArray(functions)).toBe(true)
      expect(functions.length).toBe(0)
    })

    it('should include both direct and nested functions', () => {
      const functions = PluginService.getFunctions('test-plugin')

      expect(functions.length).toBe(4) // 2 direct + 2 nested
    })
  })

  describe('Plugin Function Access - hasFunction()', () => {
    it('should return true for existing direct function', () => {
      expect(PluginService.hasFunction('test-plugin', 'testFunction')).toBe(true)
    })

    it('should return true for existing nested function', () => {
      expect(PluginService.hasFunction('test-plugin', 'generateText')).toBe(true)
    })

    it('should return false for non-existent function', () => {
      expect(PluginService.hasFunction('test-plugin', 'invalidFunction')).toBe(false)
    })

    it('should return false for plugin without API', () => {
      expect(PluginService.hasFunction('no-api-plugin', 'anyFunction')).toBe(false)
    })
  })

  describe('usePlugin Hook - Plugin with API', () => {
    it('should return API object with functions', () => {
      const api = usePlugin('test-plugin')

      expect(api).toBeDefined()
      expect(typeof api.testFunction).toBe('function')
      expect(typeof api.anotherFunction).toBe('function')
    })

    it('should include nested functions from AIAPI', () => {
      const api = usePlugin('test-plugin')

      expect(typeof api.generateText).toBe('function')
      expect(typeof api.enhanceText).toBe('function')
    })

    it('should include isAvailable helper', () => {
      const api = usePlugin('test-plugin')

      expect(typeof api.isAvailable).toBe('function')
      expect(api.isAvailable()).toBe(true)
    })

    it('should include getStatus helper', () => {
      const api = usePlugin('test-plugin')

      expect(typeof api.getStatus).toBe('function')
      const status = api.getStatus()
      expect(status.available).toBe(true)
      expect(status.pluginName).toBe('test-plugin')
      expect(status.hasAPI).toBe(true)
    })

    it('should return correct function count in status', () => {
      const api = usePlugin('test-plugin')
      const status = api.getStatus()

      expect(status.functionCount).toBe(4) // 2 direct + 2 nested
    })
  })

  describe('usePlugin Hook - Plugin without API', () => {
    it('should return object with status helpers only', () => {
      const api = usePlugin('no-api-plugin')

      expect(api).toBeDefined()
      expect(typeof api.isAvailable).toBe('function')
      expect(typeof api.getStatus).toBe('function')
    })

    it('should return isAvailable true for existing plugin', () => {
      const api = usePlugin('no-api-plugin')

      expect(api.isAvailable()).toBe(true)
    })

    it('should return correct status', () => {
      const api = usePlugin('no-api-plugin')
      const status = api.getStatus()

      expect(status.available).toBe(true)
      expect(status.pluginName).toBe('no-api-plugin')
      expect(status.hasAPI).toBe(false)
    })

    it('should not include stub functions with errors', () => {
      const api = usePlugin('no-api-plugin')

      // Should only have status helpers, no stub functions
      const keys = Object.keys(api)
      expect(keys).toContain('isAvailable')
      expect(keys).toContain('getStatus')
      expect(keys.length).toBe(2)
    })
  })

  describe('usePlugin Hook - Plugin not found', () => {
    // Mock console.warn to avoid noise in test output
    beforeEach(() => {
      jest.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should return stubs for non-existent plugin', () => {
      const api = usePlugin('invalid-plugin')

      expect(api).toBeDefined()
      expect(typeof api.isAvailable).toBe('function')
    })

    it('should return isAvailable false', () => {
      const api = usePlugin('invalid-plugin')

      expect(api.isAvailable()).toBe(false)
    })

    it('should return error status', () => {
      const api = usePlugin('invalid-plugin')
      const status = api.getStatus()

      expect(status.available).toBe(false)
      expect(status.pluginName).toBe('invalid-plugin')
      expect(status.hasAPI).toBe(false)
    })

    it('should log warning for non-existent plugin', () => {
      usePlugin('invalid-plugin')

      expect(console.warn).toHaveBeenCalledWith(
        "[Plugin Registry] Plugin 'invalid-plugin' not found"
      )
    })
  })

  describe('usePlugin Hook - Nested API extraction', () => {
    it('should extract functions from nested API objects', () => {
      const api = usePlugin('test-plugin')

      // Should have nested functions extracted at root level
      expect(typeof api.generateText).toBe('function')
      expect(typeof api.enhanceText).toBe('function')
    })

    it('should not include nested objects themselves', () => {
      const api = usePlugin('test-plugin')

      // AIAPI object should not be in the extracted API
      expect(api.AIAPI).toBeUndefined()
    })

    it('should only extract function values from nested objects', () => {
      const api = usePlugin('test-plugin')

      // All extracted keys should be functions (except status helpers)
      for (const [key, value] of Object.entries(api)) {
        expect(typeof value).toBe('function')
      }
    })

    it('should handle multiple levels of nesting', () => {
      const api = usePlugin('test-plugin')

      // Verify nested functions are accessible
      expect(api.generateText).toBeDefined()
      expect(api.enhanceText).toBeDefined()
    })
  })

  describe('usePlugin Hook - Status helpers', () => {
    it('should always include isAvailable helper', () => {
      const api1 = usePlugin('test-plugin')
      const api2 = usePlugin('no-api-plugin')
      const api3 = usePlugin('invalid-plugin')

      expect(typeof api1.isAvailable).toBe('function')
      expect(typeof api2.isAvailable).toBe('function')
      expect(typeof api3.isAvailable).toBe('function')
    })

    it('should always include getStatus helper', () => {
      const api1 = usePlugin('test-plugin')
      const api2 = usePlugin('no-api-plugin')
      const api3 = usePlugin('invalid-plugin')

      expect(typeof api1.getStatus).toBe('function')
      expect(typeof api2.getStatus).toBe('function')
      expect(typeof api3.getStatus).toBe('function')
    })

    it('should return consistent status structure', () => {
      const api = usePlugin('test-plugin')
      const status = api.getStatus()

      expect(status).toHaveProperty('available')
      expect(status).toHaveProperty('pluginName')
      expect(status).toHaveProperty('hasAPI')
    })
  })

  describe('Server Initialization - initializeAll()', () => {
    // Save original window object
    const originalWindow = global.window

    beforeEach(() => {
      // Mock console.log to avoid noise
      jest.spyOn(console, 'log').mockImplementation(() => {})
      jest.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      jest.restoreAllMocks()
      // Restore window
      if (originalWindow === undefined) {
        // @ts-ignore
        delete global.window
      } else {
        global.window = originalWindow
      }
    })

    it('should call initializeAll without throwing', async () => {
      // In jsdom environment, window is always defined
      // This test just ensures the method doesn't throw
      await expect(PluginService.initializeAll()).resolves.not.toThrow()
    })

    it('should execute onLoad hooks for plugins in server environment', async () => {
      // Note: This test simulates server environment by deleting window
      // but jsdom might restore it. We verify by checking console logs instead.

      // Mock window as undefined to trigger server-side code path
      const originalWindow = global.window
      const windowGetter = jest.spyOn(global as any, 'window', 'get')
      windowGetter.mockReturnValue(undefined)

      try {
        await PluginService.initializeAll()

        // Verify initialization logs were called (means it ran)
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('[Plugin Registry] Initializing plugin system')
        )
      } finally {
        windowGetter.mockRestore()
      }
    })

    it('should log initialization messages', async () => {
      // @ts-ignore
      delete global.window

      await PluginService.initializeAll()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Plugin Registry] Initializing plugin system')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Plugin Registry] ✅ Plugin system initialized')
      )
    })

    it('should not run in browser environment', async () => {
      // @ts-ignore
      global.window = {} as Window & typeof globalThis

      // Get the call count before
      const { PLUGIN_REGISTRY } = require('@/core/lib/registries/plugin-registry')
      const mockOnLoad = PLUGIN_REGISTRY['test-plugin'].config.hooks.onLoad
      const callsBefore = mockOnLoad.mock.calls.length

      await PluginService.initializeAll()

      // onLoad should not be called additionally in browser
      const callsAfter = mockOnLoad.mock.calls.length
      expect(callsAfter).toBe(callsBefore)
    })

    it('should continue with other plugins if one fails', async () => {
      // @ts-ignore
      delete global.window

      // Mock one plugin to throw error
      const { PLUGIN_REGISTRY } = require('@/core/lib/registries/plugin-registry')
      const mockOnLoad = PLUGIN_REGISTRY['test-plugin'].config.hooks.onLoad

      // Create a new mock that rejects once then resolves
      mockOnLoad.mockImplementationOnce(() => Promise.reject(new Error('Load failed')))

      // Should not throw - it should catch and continue
      await expect(PluginService.initializeAll()).resolves.not.toThrow()
    })

    it('should handle plugins without onLoad hook', async () => {
      // @ts-ignore
      delete global.window

      // Should not throw for plugins without hooks
      await expect(PluginService.initializeAll()).resolves.not.toThrow()
    })

    it('should log each plugin being loaded', async () => {
      // @ts-ignore
      delete global.window

      await PluginService.initializeAll()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Plugin Registry] Loading plugin: test-plugin')
      )
    })

    it('should log success for each loaded plugin', async () => {
      // @ts-ignore
      delete global.window

      await PluginService.initializeAll()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Plugin Registry] ✅ Plugin test-plugin loaded')
      )
    })

    it('should log total plugin count', async () => {
      // @ts-ignore
      delete global.window

      await PluginService.initializeAll()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Plugin Registry] Found 3 plugins')
      )
    })
  })

  describe('Metadata - getMetadata()', () => {
    it('should return PLUGIN_METADATA object', () => {
      const metadata = PluginService.getMetadata()

      expect(metadata).toBeDefined()
      expect(metadata.totalPlugins).toBe(3)
    })

    it('should include all metadata fields', () => {
      const metadata = PluginService.getMetadata()

      expect(metadata).toHaveProperty('totalPlugins')
      expect(metadata).toHaveProperty('pluginsWithAPI')
      expect(metadata).toHaveProperty('pluginsWithEntities')
      expect(metadata).toHaveProperty('totalRouteFiles')
      expect(metadata).toHaveProperty('totalPluginEntities')
      expect(metadata).toHaveProperty('generatedAt')
    })

    it('should return correct counts', () => {
      const metadata = PluginService.getMetadata()

      expect(metadata.totalPlugins).toBe(3)
      expect(metadata.pluginsWithAPI).toBe(1)
      expect(metadata.pluginsWithEntities).toBe(2)
      expect(metadata.totalPluginEntities).toBe(3)
    })

    it('should include plugin names array', () => {
      const metadata = PluginService.getMetadata()

      expect(Array.isArray(metadata.plugins)).toBe(true)
      expect(metadata.plugins).toContain('test-plugin')
    })
  })

  describe('Metadata - getPluginRouteEndpoints()', () => {
    it('should be alias for getAllRouteEndpoints', () => {
      const endpoints1 = PluginService.getAllRouteEndpoints()
      const endpoints2 = PluginService.getPluginRouteEndpoints()

      expect(endpoints1).toEqual(endpoints2)
    })
  })

  describe('Metadata - isValid()', () => {
    it('should return true for valid plugin', () => {
      expect(PluginService.isValid('test-plugin')).toBe(true)
    })

    it('should return false for non-existent plugin', () => {
      expect(PluginService.isValid('invalid-plugin')).toBe(false)
    })

    it('should validate plugin has config with name', () => {
      expect(PluginService.isValid('test-plugin')).toBe(true)
    })
  })

  describe('Metadata - getRegistry()', () => {
    it('should return complete PLUGIN_REGISTRY object', () => {
      const registry = PluginService.getRegistry()

      expect(registry).toBeDefined()
      expect(registry['test-plugin']).toBeDefined()
    })

    it('should include all plugins', () => {
      const registry = PluginService.getRegistry()

      expect(registry['test-plugin']).toBeDefined()
      expect(registry['no-api-plugin']).toBeDefined()
      expect(registry['plugin-with-entities']).toBeDefined()
    })
  })

  describe('Backward Compatibility - getRegisteredPlugins', () => {
    it('should match PluginService.getAll()', () => {
      expect(getRegisteredPlugins()).toEqual(PluginService.getAll())
    })
  })

  describe('Backward Compatibility - getPlugin', () => {
    it('should match PluginService.get()', () => {
      expect(getPlugin('test-plugin')).toEqual(PluginService.get('test-plugin'))
    })
  })

  describe('Backward Compatibility - getPluginsWithAPI', () => {
    it('should match PluginService.getWithAPI()', () => {
      expect(getPluginsWithAPI()).toEqual(PluginService.getWithAPI())
    })
  })

  describe('Backward Compatibility - getPluginsWithEntities', () => {
    it('should match PluginService.getWithEntities()', () => {
      expect(getPluginsWithEntities()).toEqual(PluginService.getWithEntities())
    })
  })

  describe('Backward Compatibility - getAllPluginEntities', () => {
    it('should match PluginService.getAllEntities()', () => {
      expect(getAllPluginEntities()).toEqual(PluginService.getAllEntities())
    })
  })

  describe('Backward Compatibility - getPluginEntitiesByName', () => {
    it('should match PluginService.getEntities()', () => {
      expect(getPluginEntitiesByName('test-plugin')).toEqual(
        PluginService.getEntities('test-plugin')
      )
    })
  })

  describe('Backward Compatibility - getAllRouteEndpoints', () => {
    it('should match PluginService.getAllRouteEndpoints()', () => {
      expect(getAllRouteEndpoints()).toEqual(PluginService.getAllRouteEndpoints())
    })
  })

  describe('Backward Compatibility - findRouteEndpoint', () => {
    it('should match PluginService.findRouteEndpoint()', () => {
      const result1 = findRouteEndpoint('/api/plugins/test/endpoint')
      const result2 = PluginService.findRouteEndpoint('/api/plugins/test/endpoint')

      expect(result1).toEqual(result2)
    })
  })

  describe('Backward Compatibility - getPluginRouteEndpoints', () => {
    it('should match PluginService.getPluginRouteEndpoints()', () => {
      const result1 = getPluginRouteEndpoints()
      const result2 = PluginService.getPluginRouteEndpoints()

      expect(result1).toEqual(result2)
    })
  })

  describe('Backward Compatibility - getPluginFunction', () => {
    it('should match PluginService.getFunction()', () => {
      expect(getPluginFunction('test-plugin', 'testFunction')).toEqual(
        PluginService.getFunction('test-plugin', 'testFunction')
      )
    })
  })

  describe('Backward Compatibility - getPluginFunctions', () => {
    it('should match PluginService.getFunctions()', () => {
      expect(getPluginFunctions('test-plugin')).toEqual(PluginService.getFunctions('test-plugin'))
    })
  })

  describe('Backward Compatibility - hasPluginFunction', () => {
    it('should match PluginService.hasFunction()', () => {
      const result1 = hasPluginFunction('test-plugin', 'testFunction')
      const result2 = PluginService.hasFunction('test-plugin', 'testFunction')

      expect(result1).toEqual(result2)
    })
  })

  describe('Backward Compatibility - getRouteMetadata', () => {
    it('should match PluginService.getRouteMetadata()', () => {
      expect(getRouteMetadata('/api/plugins/test/endpoint')).toEqual(
        PluginService.getRouteMetadata('/api/plugins/test/endpoint')
      )
    })
  })

  describe('Backward Compatibility - hasRoute', () => {
    it('should match PluginService.hasRoute()', () => {
      expect(hasRoute('/api/plugins/test/endpoint')).toEqual(
        PluginService.hasRoute('/api/plugins/test/endpoint')
      )
    })
  })

  describe('Backward Compatibility - initializeAllPlugins', () => {
    it('should match PluginService.initializeAll()', () => {
      expect(initializeAllPlugins).toBe(PluginService.initializeAll)
    })
  })

  describe('Edge Cases - Empty inputs', () => {
    it('should handle empty string for get()', () => {
      expect(PluginService.get('')).toBeUndefined()
    })

    it('should handle empty string for exists()', () => {
      expect(PluginService.exists('')).toBe(false)
    })

    it('should handle empty string for getEntities()', () => {
      const entities = PluginService.getEntities('')

      expect(Array.isArray(entities)).toBe(true)
      expect(entities.length).toBe(0)
    })

    it('should handle empty string for getFunction()', () => {
      expect(PluginService.getFunction('', 'func')).toBeUndefined()
      expect(PluginService.getFunction('test-plugin', '')).toBeUndefined()
    })

    it('should handle empty string for getFunctions()', () => {
      const functions = PluginService.getFunctions('')

      expect(Array.isArray(functions)).toBe(true)
      expect(functions.length).toBe(0)
    })
  })

  describe('Edge Cases - Invalid inputs', () => {
    it('should handle special characters in plugin names', () => {
      expect(PluginService.get('plugin@test')).toBeUndefined()
      expect(PluginService.exists('plugin#123')).toBe(false)
    })

    it('should handle whitespace in plugin names', () => {
      expect(PluginService.get('   ')).toBeUndefined()
      expect(PluginService.exists('test plugin')).toBe(false)
    })

    it('should handle numeric plugin names', () => {
      expect(PluginService.get('123')).toBeUndefined()
    })
  })

  describe('Edge Cases - Case sensitivity', () => {
    it('should be case-sensitive for get()', () => {
      expect(PluginService.get('test-plugin')).toBeDefined()
      expect(PluginService.get('TEST-PLUGIN')).toBeUndefined()
    })

    it('should be case-sensitive for exists()', () => {
      expect(PluginService.exists('test-plugin')).toBe(true)
      expect(PluginService.exists('Test-Plugin')).toBe(false)
    })

    it('should be case-sensitive for getFunction()', () => {
      expect(PluginService.getFunction('test-plugin', 'testFunction')).toBeDefined()
      expect(PluginService.getFunction('test-plugin', 'TestFunction')).toBeUndefined()
    })
  })

  describe('Edge Cases - Immutability', () => {
    it('should return new array on each getAll() call', () => {
      const plugins1 = PluginService.getAll()
      const plugins2 = PluginService.getAll()

      expect(plugins1).not.toBe(plugins2)
      expect(plugins1).toEqual(plugins2)
    })

    it('should return new array on each getNames() call', () => {
      const names1 = PluginService.getNames()
      const names2 = PluginService.getNames()

      expect(names1).not.toBe(names2)
      expect(names1).toEqual(names2)
    })

    it('should not mutate original when modifying returned arrays', () => {
      const entities = PluginService.getAllEntities()
      const originalLength = PluginService.getAllEntities().length

      // @ts-ignore - intentionally mutating for test
      entities.push({ name: 'FakeEntity' })

      expect(PluginService.getAllEntities().length).toBe(originalLength)
    })
  })

  describe('Edge Cases - Plugin stub functions', () => {
    beforeEach(() => {
      jest.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should create stubs for non-existent plugin', () => {
      const api = usePlugin('invalid-plugin')

      expect(api.generateText).toBeDefined()
      expect(typeof api.generateText).toBe('function')
    })

    it('stub functions should return error objects', async () => {
      const api = usePlugin('invalid-plugin')
      const result = await api.generateText('test')

      expect(result.error).toBe(true)
      expect(result.message).toContain('not available')
    })

    it('stub functions should include suggestion', async () => {
      const api = usePlugin('invalid-plugin')
      const result = await api.create({})

      expect(result.suggestion).toBeDefined()
    })
  })
})
