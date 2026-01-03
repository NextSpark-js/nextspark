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
import { PLUGIN_REGISTRY, PLUGIN_METADATA, type PluginRegistryEntry, type RouteFileEndpoint, type PluginEntity, type PluginName } from '@nextsparkjs/registries/plugin-registry';
import type { PluginConfig } from '../../types/plugin';
export type { PluginRegistryEntry, RouteFileEndpoint, PluginEntity, PluginName, PluginConfig };
/**
 * Route metadata structure
 */
export interface RouteMetadata {
    plugin: string;
    methods: string[];
    filePath: string;
}
/**
 * Plugin API structure with status helpers
 */
interface PluginAPI {
    [key: string]: any;
    isAvailable: () => boolean;
    getStatus: () => {
        available: boolean;
        pluginName: string;
        hasAPI: boolean;
        functionCount?: number;
        message?: string;
    };
}
/**
 * PluginService
 *
 * Static service class for plugin system queries.
 * All methods are static - this class is not meant to be instantiated.
 */
export declare class PluginService {
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
    static getAll(): PluginConfig[];
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
    static get(name: string): PluginConfig | undefined;
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
    static getEntry(name: string): PluginRegistryEntry | undefined;
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
    static getWithAPI(): PluginRegistryEntry[];
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
    static getWithEntities(): PluginRegistryEntry[];
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
    static getAllEntities(): PluginEntity[];
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
    static getEntities(pluginName: string): PluginEntity[];
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
    static getAllRouteEndpoints(): RouteFileEndpoint[];
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
    static findRouteEndpoint(path: string): RouteFileEndpoint | undefined;
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
    static getRouteMetadata(path: string): RouteMetadata | null;
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
    static hasRoute(path: string, method?: string): boolean;
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
    static getNames(): string[];
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
    static getCount(): number;
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
    static exists(name: string): boolean;
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
    static getFunction<T = any>(pluginName: string, functionName: string): T | undefined;
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
    static getFunctions(pluginName: string): string[];
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
    static hasFunction(pluginName: string, functionName: string): boolean;
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
    static initializeAll(): Promise<void>;
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
    static getMetadata(): typeof PLUGIN_METADATA;
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
    static getPluginRouteEndpoints(): RouteFileEndpoint[];
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
    static isValid(name: string): boolean;
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
    static getRegistry(): typeof PLUGIN_REGISTRY;
}
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
export declare function usePlugin(pluginName: string): PluginAPI;
/**
 * @deprecated Use PluginService.getAll() instead
 */
export declare const getRegisteredPlugins: typeof PluginService.getAll;
/**
 * @deprecated Use PluginService.get() instead
 */
export declare const getPlugin: typeof PluginService.get;
/**
 * @deprecated Use PluginService.getWithAPI() instead
 */
export declare const getPluginsWithAPI: typeof PluginService.getWithAPI;
/**
 * @deprecated Use PluginService.getWithEntities() instead
 */
export declare const getPluginsWithEntities: typeof PluginService.getWithEntities;
/**
 * @deprecated Use PluginService.getAllEntities() instead
 */
export declare const getAllPluginEntities: typeof PluginService.getAllEntities;
/**
 * @deprecated Use PluginService.getEntities() instead
 */
export declare const getPluginEntitiesByName: typeof PluginService.getEntities;
/**
 * @deprecated Use PluginService.getAllRouteEndpoints() instead
 */
export declare const getAllRouteEndpoints: typeof PluginService.getAllRouteEndpoints;
/**
 * @deprecated Use PluginService.findRouteEndpoint() instead
 */
export declare const findRouteEndpoint: (path: string) => any;
/**
 * @deprecated Use PluginService.getPluginRouteEndpoints() instead
 */
export declare const getPluginRouteEndpoints: () => RouteFileEndpoint[];
/**
 * @deprecated Use PluginService.getFunction() instead
 */
export declare const getPluginFunction: typeof PluginService.getFunction;
/**
 * @deprecated Use PluginService.getFunctions() instead
 */
export declare const getPluginFunctions: typeof PluginService.getFunctions;
/**
 * @deprecated Use PluginService.hasFunction() instead
 */
export declare const hasPluginFunction: (pluginName: string, functionName: string) => boolean;
/**
 * @deprecated Use PluginService.getRouteMetadata() instead
 */
export declare const getRouteMetadata: typeof PluginService.getRouteMetadata;
/**
 * @deprecated Use PluginService.hasRoute() instead
 */
export declare const hasRoute: typeof PluginService.hasRoute;
/**
 * @deprecated Use PluginService.initializeAll() instead
 */
export declare const initializeAllPlugins: typeof PluginService.initializeAll;
//# sourceMappingURL=plugin.service.d.ts.map