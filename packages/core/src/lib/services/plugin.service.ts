/**
 * PluginService - Provides runtime plugin system queries
 *
 * This service layer abstracts plugin-registry access, making the registry
 * a pure data structure (Data-Only pattern). All query logic lives here.
 *
 * Performance: All operations are O(1) with zero I/O.
 *
 * @example
 * ```typescript
 * import { PluginService, usePlugin } from './'
 *
 * // Get all plugins
 * const plugins = PluginService.getAll()
 *
 * // Get specific plugin
 * const plugin = PluginService.get('ai')
 *
 * // Use plugin hook in React
 * const { generateText } = usePlugin('ai')
 * ```
 */

import {
  PLUGIN_REGISTRY,
  ROUTE_METADATA,
  PLUGIN_METADATA,
  type PluginRegistryEntry,
  type RouteFileEndpoint,
  type PluginEntity,
  type PluginName,
} from '@nextsparkjs/registries/plugin-registry'
import type { PluginConfig } from '../../types/plugin'

// Re-export types for convenience
export type { PluginRegistryEntry, RouteFileEndpoint, PluginEntity, PluginName, PluginConfig }

/**
 * Route metadata structure
 */
export interface RouteMetadata {
  plugin: string
  methods: string[]
  filePath: string
}

/**
 * Plugin stub structure for unavailable plugins
 */
interface PluginStubs extends PluginAPI {
  [key: string]: any
}

/**
 * Plugin API structure with status helpers
 */
interface PluginAPI {
  [key: string]: any
  isAvailable: () => boolean
  getStatus: () => {
    available: boolean
    pluginName: string
    hasAPI: boolean
    functionCount?: number
    message?: string
  }
}

/**
 * PluginService
 *
 * Static service class for plugin system queries.
 * All methods are static - this class is not meant to be instantiated.
 */
export class PluginService {
  // ============================================================================
  // Core Query Methods (14)
  // ============================================================================

  /**
   * Get all registered plugins
   *
   * @returns Array of PluginConfig objects
   *
   * @example
   * ```typescript
   * const plugins = PluginService.getAll()
   * // [{ name: 'ai', version: '1.0.0', ... }, ...]
   * ```
   */
  static getAll(): PluginConfig[] {
    return Object.values(PLUGIN_REGISTRY).map((entry: any) => entry.config)
  }

  /**
   * Get a specific plugin by name
   *
   * @param name - Plugin name
   * @returns PluginConfig or undefined if not found
   *
   * @example
   * ```typescript
   * const plugin = PluginService.get('ai')
   * // { name: 'ai', version: '1.0.0', ... }
   * ```
   */
  static get(name: string): PluginConfig | undefined {
    return (PLUGIN_REGISTRY as any)[name]?.config
  }

  /**
   * Get full plugin registry entry by name
   *
   * @param name - Plugin name
   * @returns PluginRegistryEntry or undefined if not found
   *
   * @example
   * ```typescript
   * const entry = PluginService.getEntry('ai')
   * // { name: 'ai', config: {...}, hasAPI: true, ... }
   * ```
   */
  static getEntry(name: string): PluginRegistryEntry | undefined {
    return (PLUGIN_REGISTRY as any)[name]
  }

  /**
   * Get all plugins that have API capabilities
   *
   * @returns Array of PluginRegistryEntry objects with API
   *
   * @example
   * ```typescript
   * const apiPlugins = PluginService.getWithAPI()
   * // [{ name: 'ai', hasAPI: true, ... }]
   * ```
   */
  static getWithAPI(): PluginRegistryEntry[] {
    return Object.values(PLUGIN_REGISTRY).filter((entry: any) => entry.hasAPI) as PluginRegistryEntry[]
  }

  /**
   * Get all plugins that have entities
   *
   * @returns Array of PluginRegistryEntry objects with entities
   *
   * @example
   * ```typescript
   * const pluginsWithEntities = PluginService.getWithEntities()
   * // [{ name: 'crm', entities: [...], ... }]
   * ```
   */
  static getWithEntities(): PluginRegistryEntry[] {
    return Object.values(PLUGIN_REGISTRY).filter(
      (entry: any) => entry.entities && entry.entities.length > 0
    ) as PluginRegistryEntry[]
  }

  /**
   * Get all entities across all plugins
   *
   * @returns Array of all PluginEntity objects
   *
   * @example
   * ```typescript
   * const entities = PluginService.getAllEntities()
   * // [{ name: 'Contact', pluginContext: {...}, ... }, ...]
   * ```
   */
  static getAllEntities(): PluginEntity[] {
    return Object.values(PLUGIN_REGISTRY).flatMap((entry: any) => entry.entities || [])
  }

  /**
   * Get entities for a specific plugin
   *
   * @param pluginName - Plugin name
   * @returns Array of PluginEntity objects for the plugin
   *
   * @example
   * ```typescript
   * const entities = PluginService.getEntities('crm')
   * // [{ name: 'Contact', ... }, { name: 'Deal', ... }]
   * ```
   */
  static getEntities(pluginName: string): PluginEntity[] {
    return (PLUGIN_REGISTRY as any)[pluginName]?.entities || []
  }

  /**
   * Get all route file endpoints across all plugins
   *
   * @returns Array of all RouteFileEndpoint objects
   *
   * @example
   * ```typescript
   * const endpoints = PluginService.getAllRouteEndpoints()
   * // [{ path: '/api/plugins/ai/generate', methods: ['POST'], ... }]
   * ```
   */
  static getAllRouteEndpoints(): RouteFileEndpoint[] {
    return Object.values(PLUGIN_REGISTRY).flatMap((entry: any) => entry.routeFiles || [])
  }

  /**
   * Find a specific route endpoint by path
   *
   * @param path - Route path to find
   * @returns RouteFileEndpoint or undefined if not found
   *
   * @example
   * ```typescript
   * const endpoint = PluginService.findRouteEndpoint('/api/plugins/ai/generate')
   * // { path: '/api/plugins/ai/generate', methods: ['POST'], ... }
   * ```
   */
  static findRouteEndpoint(path: string): RouteFileEndpoint | undefined {
    return this.getAllRouteEndpoints().find((endpoint) => endpoint.path === path)
  }

  /**
   * Get route metadata for a specific path
   *
   * @param path - Route path
   * @returns RouteMetadata or null if not found
   *
   * @example
   * ```typescript
   * const metadata = PluginService.getRouteMetadata('/api/plugins/ai/generate')
   * // { plugin: 'ai', methods: ['POST'], filePath: '...' }
   * ```
   */
  static getRouteMetadata(path: string): RouteMetadata | null {
    const metadata = (ROUTE_METADATA as any)[path]
    return metadata || null
  }

  /**
   * Check if a route exists (optionally with specific method)
   *
   * @param path - Route path
   * @param method - Optional HTTP method to check
   * @returns True if route exists
   *
   * @example
   * ```typescript
   * PluginService.hasRoute('/api/plugins/ai/generate') // true
   * PluginService.hasRoute('/api/plugins/ai/generate', 'POST') // true
   * PluginService.hasRoute('/api/plugins/ai/generate', 'DELETE') // false
   * ```
   */
  static hasRoute(path: string, method?: string): boolean {
    const metadata = (ROUTE_METADATA as any)[path]
    if (!metadata) return false
    return method ? metadata.methods.includes(method) : true
  }

  /**
   * Get all plugin names
   *
   * @returns Array of plugin name strings
   *
   * @example
   * ```typescript
   * const names = PluginService.getNames()
   * // ['ai', 'crm', 'analytics']
   * ```
   */
  static getNames(): string[] {
    return Object.keys(PLUGIN_REGISTRY)
  }

  /**
   * Get total plugin count
   *
   * @returns Number of registered plugins
   *
   * @example
   * ```typescript
   * const count = PluginService.getCount()
   * // 3
   * ```
   */
  static getCount(): number {
    return Object.keys(PLUGIN_REGISTRY).length
  }

  /**
   * Check if a plugin exists
   *
   * @param name - Plugin name
   * @returns True if plugin exists
   *
   * @example
   * ```typescript
   * PluginService.exists('ai') // true
   * PluginService.exists('invalid') // false
   * ```
   */
  static exists(name: string): boolean {
    return name in PLUGIN_REGISTRY
  }

  // ============================================================================
  // Plugin Function Access (3)
  // ============================================================================

  /**
   * Get a specific function from a plugin's API
   *
   * Supports nested API objects (e.g., AIAPI.generateText)
   *
   * @param pluginName - Plugin name
   * @param functionName - Function name to retrieve
   * @returns Function or undefined if not found
   *
   * @example
   * ```typescript
   * const generateText = PluginService.getFunction('ai', 'generateText')
   * if (generateText) {
   *   const result = await generateText('Hello')
   * }
   * ```
   */
  static getFunction<T = any>(pluginName: string, functionName: string): T | undefined {
    try {
      const plugin = (PLUGIN_REGISTRY as any)[pluginName]
      if (!plugin?.config?.api) return undefined

      const api = plugin.config.api

      // Direct function lookup
      if (typeof api[functionName] === 'function') {
        return api[functionName] as T
      }

      // Nested API lookup (e.g., AIAPI.generateText)
      for (const value of Object.values(api)) {
        if (typeof value === 'object' && value !== null && functionName in value) {
          const nestedFunc = (value as any)[functionName]
          if (typeof nestedFunc === 'function') {
            return nestedFunc as T
          }
        }
      }

      return undefined
    } catch {
      return undefined
    }
  }

  /**
   * Get all available function names from a plugin's API
   *
   * @param pluginName - Plugin name
   * @returns Array of function name strings
   *
   * @example
   * ```typescript
   * const functions = PluginService.getFunctions('ai')
   * // ['generateText', 'enhanceText', 'analyzeText']
   * ```
   */
  static getFunctions(pluginName: string): string[] {
    try {
      const plugin = (PLUGIN_REGISTRY as any)[pluginName]

      if (!plugin?.config?.api) {
        return []
      }

      const api = plugin.config.api
      const functions: string[] = []

      // Get direct functions
      Object.entries(api).forEach(([key, value]) => {
        if (typeof value === 'function') {
          functions.push(key)
        } else if (typeof value === 'object' && value !== null) {
          // Get nested functions
          Object.entries(value).forEach(([nestedKey, nestedValue]) => {
            if (typeof nestedValue === 'function') {
              functions.push(nestedKey)
            }
          })
        }
      })

      return functions
    } catch {
      return []
    }
  }

  /**
   * Check if a plugin has a specific function
   *
   * @param pluginName - Plugin name
   * @param functionName - Function name to check
   * @returns True if function exists
   *
   * @example
   * ```typescript
   * PluginService.hasFunction('ai', 'generateText') // true
   * PluginService.hasFunction('ai', 'invalid') // false
   * ```
   */
  static hasFunction(pluginName: string, functionName: string): boolean {
    return this.getFunction(pluginName, functionName) !== undefined
  }

  // ============================================================================
  // Server Initialization (1)
  // ============================================================================

  /**
   * Initialize all plugins by executing their onLoad hooks
   *
   * Server-side only. Executes async onLoad hooks for all plugins.
   * Continues with other plugins if one fails.
   *
   * @returns Promise that resolves when all plugins are initialized
   *
   * @example
   * ```typescript
   * // In server-side initialization code
   * await PluginService.initializeAll()
   * ```
   */
  static async initializeAll(): Promise<void> {
    if (typeof window !== 'undefined') {
      return // Only run on server side
    }

    console.log('[Plugin Registry] Initializing plugin system...')

    const pluginEntries: any = Object.values(PLUGIN_REGISTRY)
    console.log(`[Plugin Registry] Found ${pluginEntries.length} plugins to initialize`)

    for (const pluginEntry of pluginEntries) {
      try {
        const plugin = pluginEntry.config
        if (plugin.hooks?.onLoad) {
          console.log(`[Plugin Registry] Loading plugin: ${plugin.name}`)
          await plugin.hooks.onLoad()
          console.log(`[Plugin Registry] ✅ Plugin ${plugin.name} loaded successfully`)
        }
      } catch (error) {
        console.error(`[Plugin Registry] ❌ Error loading plugin ${pluginEntry.name}:`, error)
        // Continue with other plugins even if one fails
      }
    }

    console.log('[Plugin Registry] ✅ Plugin system initialized successfully')
  }

  // ============================================================================
  // Metadata & Helpers (3)
  // ============================================================================

  /**
   * Get plugin metadata
   *
   * @returns Plugin system metadata object
   *
   * @example
   * ```typescript
   * const metadata = PluginService.getMetadata()
   * // { totalPlugins: 3, pluginsWithAPI: 2, ... }
   * ```
   */
  static getMetadata(): typeof PLUGIN_METADATA {
    return PLUGIN_METADATA
  }

  /**
   * Get plugin route endpoints (alias for getAllRouteEndpoints)
   *
   * @returns Array of all RouteFileEndpoint objects
   *
   * @example
   * ```typescript
   * const endpoints = PluginService.getPluginRouteEndpoints()
   * // [{ path: '/api/plugins/ai/generate', methods: ['POST'], ... }]
   * ```
   */
  static getPluginRouteEndpoints(): RouteFileEndpoint[] {
    return this.getAllRouteEndpoints()
  }

  /**
   * Validate plugin configuration structure
   *
   * @param name - Plugin name
   * @returns True if plugin has valid configuration
   *
   * @example
   * ```typescript
   * PluginService.isValid('ai') // true
   * PluginService.isValid('invalid') // false
   * ```
   */
  static isValid(name: string): boolean {
    const plugin = (PLUGIN_REGISTRY as any)[name]
    return !!plugin && !!plugin.config && !!plugin.config.name
  }

  /**
   * Get the raw plugin registry object
   *
   * @returns The complete PLUGIN_REGISTRY object
   *
   * @example
   * ```typescript
   * const registry = PluginService.getRegistry()
   * // { ai: {...}, crm: {...}, ... }
   * ```
   */
  static getRegistry(): typeof PLUGIN_REGISTRY {
    return PLUGIN_REGISTRY
  }
}

// ============================================================================
// React Hook - Exported Directly (not a static method)
// ============================================================================

/**
 * Generic plugin hook - preferred API for React components
 *
 * Usage: const { generateText, enhanceText } = usePlugin('ai')
 *
 * Benefits over plugin-specific hooks:
 * - Single API to learn
 * - Works with dynamic plugin names
 * - Scales to any number of plugins
 * - Less generated code
 * - Graceful degradation when plugins unavailable
 *
 * @param pluginName - Plugin name
 * @returns Plugin API object with functions
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { generateText, isAvailable } = usePlugin('ai')
 *
 *   if (!isAvailable()) {
 *     return <div>AI plugin not available</div>
 *   }
 *
 *   const handleGenerate = async () => {
 *     const result = await generateText('Hello')
 *   }
 *
 *   return <button onClick={handleGenerate}>Generate</button>
 * }
 * ```
 */
export function usePlugin(pluginName: string): PluginAPI {
  const plugin = (PLUGIN_REGISTRY as any)[pluginName]

  if (!plugin) {
    console.warn(`[Plugin Registry] Plugin '${pluginName}' not found`)
    return createPluginStubs(pluginName, 'NOT_FOUND')
  }

  // No API is normal for many plugins (config, styles, components-only)
  if (!plugin.config?.api) {
    // Only log in debug, no warning - this is normal behavior
    console.debug(
      `[Plugin Registry] Plugin '${pluginName}' has no API (normal for config/style/component plugins)`
    )

    // Return empty object with status helpers, without stub functions with errors
    return {
      isAvailable: () => true, // Plugin exists, just has no API
      getStatus: () => ({
        available: true,
        pluginName,
        hasAPI: false,
        message: `Plugin '${pluginName}' is available but has no API functions`,
      }),
    }
  }

  const api = plugin.config.api
  const pluginAPI: Record<string, any> = {}

  // Extract direct functions
  Object.entries(api).forEach(([key, value]) => {
    if (typeof value === 'function') {
      pluginAPI[key] = value
    } else if (typeof value === 'object' && value !== null) {
      // Extract nested functions
      Object.entries(value).forEach(([nestedKey, nestedValue]) => {
        if (typeof nestedValue === 'function') {
          pluginAPI[nestedKey] = nestedValue
        }
      })
    }
  })

  // Add status helpers for plugins with API
  pluginAPI.isAvailable = () => true
  pluginAPI.getStatus = () => ({
    available: true,
    pluginName,
    hasAPI: true,
    functionCount:
      Object.keys(pluginAPI).filter((key) => typeof pluginAPI[key] === 'function').length - 2, // -2 for status helpers
    message: `Plugin '${pluginName}' is available with ${Object.keys(pluginAPI).length - 2} API functions`,
  })

  return pluginAPI as PluginAPI
}

// ============================================================================
// Private Helper
// ============================================================================

/**
 * Create stub functions when plugin is unavailable
 * Prevents app crashes and provides user feedback
 *
 * @param pluginName - Plugin name
 * @param reason - Reason for unavailability
 * @returns Stub object with error handlers
 */
function createPluginStubs(pluginName: string, reason: 'NOT_FOUND' | 'NO_API'): PluginStubs {
  const message =
    reason === 'NOT_FOUND'
      ? `Plugin '${pluginName}' is not available or has been disabled`
      : `Plugin '${pluginName}' has no API available`

  // Common plugin function names to stub
  const commonFunctions = [
    'generateText',
    'enhanceText',
    'analyzeText',
    'getSuggestions',
    'isContentSafe',
    'estimateRequestCost',
    'processEntity',
    'create',
    'update',
    'delete',
    'get',
    'list',
  ]

  const stubs: Record<string, Function> = {}

  commonFunctions.forEach((funcName) => {
    stubs[funcName] = async (...args: any[]) => {
      console.warn(`[Plugin '${pluginName}'] ${message}`)

      // Return user-friendly error instead of throwing
      return {
        error: true,
        message,
        pluginName,
        reason,
        suggestion:
          reason === 'NOT_FOUND'
            ? 'Verify that the plugin is installed and enabled'
            : 'Contact the system administrator',
      }
    }
  })

  // Add a status function to check plugin availability
  stubs.isAvailable = () => false
  stubs.getStatus = () => ({
    available: false,
    pluginName,
    hasAPI: false,
    reason,
    message,
  })

  return stubs as PluginStubs
}

// ============================================================================
// Backward Compatibility Exports
// ============================================================================
// These function exports maintain backward compatibility with existing code
// that imports functions directly from the registry.

/**
 * @deprecated Use PluginService.getAll() instead
 */
export const getRegisteredPlugins = PluginService.getAll

/**
 * @deprecated Use PluginService.get() instead
 */
export const getPlugin = PluginService.get

/**
 * @deprecated Use PluginService.getWithAPI() instead
 */
export const getPluginsWithAPI = PluginService.getWithAPI

/**
 * @deprecated Use PluginService.getWithEntities() instead
 */
export const getPluginsWithEntities = PluginService.getWithEntities

/**
 * @deprecated Use PluginService.getAllEntities() instead
 */
export const getAllPluginEntities = PluginService.getAllEntities

/**
 * @deprecated Use PluginService.getEntities() instead
 */
export const getPluginEntitiesByName = PluginService.getEntities

/**
 * @deprecated Use PluginService.getAllRouteEndpoints() instead
 */
export const getAllRouteEndpoints = PluginService.getAllRouteEndpoints

/**
 * @deprecated Use PluginService.findRouteEndpoint() instead
 */
export const findRouteEndpoint = (path: string) => PluginService.findRouteEndpoint(path)

/**
 * @deprecated Use PluginService.getPluginRouteEndpoints() instead
 */
export const getPluginRouteEndpoints = () => PluginService.getPluginRouteEndpoints()

/**
 * @deprecated Use PluginService.getFunction() instead
 */
export const getPluginFunction = PluginService.getFunction

/**
 * @deprecated Use PluginService.getFunctions() instead
 */
export const getPluginFunctions = PluginService.getFunctions

/**
 * @deprecated Use PluginService.hasFunction() instead
 */
export const hasPluginFunction = (pluginName: string, functionName: string) =>
  PluginService.hasFunction(pluginName, functionName)

/**
 * @deprecated Use PluginService.getRouteMetadata() instead
 */
export const getRouteMetadata = PluginService.getRouteMetadata

/**
 * @deprecated Use PluginService.hasRoute() instead
 */
export const hasRoute = PluginService.hasRoute

/**
 * @deprecated Use PluginService.initializeAll() instead
 */
export const initializeAllPlugins = PluginService.initializeAll
