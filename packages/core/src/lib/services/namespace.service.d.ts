/**
 * NamespaceService - Provides runtime i18n namespace queries
 *
 * This service layer abstracts namespace-registry access, making the registry
 * a pure data structure (Data-Only pattern). All query logic lives here.
 *
 * Performance: All operations are O(1) with zero I/O.
 *
 * @example
 * ```typescript
 * import { NamespaceService } from './'
 *
 * // Get core namespaces
 * const core = NamespaceService.getCoreNamespaces()
 * // ['common', 'dashboard', 'settings', ...]
 *
 * // Detect route strategy from pathname
 * const strategy = NamespaceService.detectRouteStrategy('/dashboard/tasks')
 * // 'DASHBOARD_AUTHENTICATED'
 *
 * // Get optimized namespaces for a strategy
 * const config = NamespaceService.getOptimizedNamespaces(strategy)
 * // { core: [...], entities: [...], strategy: '...' }
 * ```
 */
import { type RouteNamespaceConfig, type NamespaceConfig } from '@nextsparkjs/registries/namespace-registry';
export type { RouteNamespaceConfig, NamespaceConfig };
/**
 * Route strategy types
 */
export type RouteStrategy = 'DASHBOARD_AUTHENTICATED' | 'AUTH_ONLY' | 'PUBLIC_INITIAL' | 'SUPERADMIN' | 'UNKNOWN_FALLBACK';
/**
 * NamespaceService
 *
 * Static service class for i18n namespace queries.
 * All methods are static - this class is not meant to be instantiated.
 */
export declare class NamespaceService {
    /**
     * Get core namespaces (excluding entity namespaces)
     *
     * @returns Array of core namespace names
     *
     * @example
     * ```typescript
     * const namespaces = NamespaceService.getCoreNamespaces()
     * // ['common', 'dashboard', 'settings', 'auth', 'public', 'validation', 'admin']
     * ```
     */
    static getCoreNamespaces(): string[];
    /**
     * Get entity namespaces
     *
     * @returns Array of entity namespace names
     *
     * @example
     * ```typescript
     * const namespaces = NamespaceService.getEntityNamespaces()
     * // [] (empty if no entity namespaces configured)
     * ```
     */
    static getEntityNamespaces(): string[];
    /**
     * Get optimized namespaces based on route strategy
     *
     * Returns the namespace configuration for a specific route strategy.
     * Falls back to UNKNOWN_FALLBACK if strategy is not found.
     *
     * @param strategy - The route strategy name
     * @returns Namespace configuration for the strategy
     *
     * @example
     * ```typescript
     * const config = NamespaceService.getOptimizedNamespaces('DASHBOARD_AUTHENTICATED')
     * // { core: ['common', 'dashboard', ...], entities: [], strategy: 'DASHBOARD_AUTHENTICATED' }
     * ```
     */
    static getOptimizedNamespaces(strategy: string): RouteNamespaceConfig;
    /**
     * Detect route strategy based on pathname
     *
     * Analyzes the pathname to determine which route strategy should be used.
     * This affects which namespaces are loaded for i18n optimization.
     *
     * @param pathname - The URL pathname to analyze
     * @returns The detected route strategy
     *
     * @example
     * ```typescript
     * NamespaceService.detectRouteStrategy('/dashboard') // 'DASHBOARD_AUTHENTICATED'
     * NamespaceService.detectRouteStrategy('/login') // 'AUTH_ONLY'
     * NamespaceService.detectRouteStrategy('/pricing') // 'PUBLIC_INITIAL'
     * NamespaceService.detectRouteStrategy('/superadmin') // 'SUPERADMIN'
     * NamespaceService.detectRouteStrategy('/unknown') // 'UNKNOWN_FALLBACK'
     * ```
     */
    static detectRouteStrategy(pathname: string): RouteStrategy;
    /**
     * Get entity paths for namespace route detection
     *
     * @returns Array of entity paths used in route detection
     *
     * @example
     * ```typescript
     * const paths = NamespaceService.getEntityPaths()
     * // [] (empty if no entity paths configured)
     * ```
     */
    static getEntityPaths(): string[];
    /**
     * Get all available route strategies
     *
     * @returns Array of all route strategy names
     *
     * @example
     * ```typescript
     * const strategies = NamespaceService.getStrategies()
     * // ['DASHBOARD_AUTHENTICATED', 'AUTH_ONLY', 'PUBLIC_INITIAL', 'SUPERADMIN', 'UNKNOWN_FALLBACK']
     * ```
     */
    static getStrategies(): string[];
    /**
     * Check if a route strategy exists
     *
     * @param strategy - The strategy name to check
     * @returns True if the strategy exists
     *
     * @example
     * ```typescript
     * NamespaceService.hasStrategy('DASHBOARD_AUTHENTICATED') // true
     * NamespaceService.hasStrategy('INVALID') // false
     * ```
     */
    static hasStrategy(strategy: string): boolean;
    /**
     * Get the full namespace configuration
     *
     * @returns The complete namespace configuration object
     *
     * @example
     * ```typescript
     * const config = NamespaceService.getConfig()
     * // { core: [...], entities: [...], routes: {...}, entityPaths: [...] }
     * ```
     */
    static getConfig(): NamespaceConfig;
}
/**
 * @deprecated Use NamespaceService.getCoreNamespaces() instead
 */
export declare const getCoreNamespaces: typeof NamespaceService.getCoreNamespaces;
/**
 * @deprecated Use NamespaceService.getEntityNamespaces() instead
 */
export declare const getEntityNamespaces: typeof NamespaceService.getEntityNamespaces;
/**
 * @deprecated Use NamespaceService.getOptimizedNamespaces() instead
 */
export declare const getOptimizedNamespaces: typeof NamespaceService.getOptimizedNamespaces;
/**
 * @deprecated Use NamespaceService.detectRouteStrategy() instead
 */
export declare const detectRouteStrategy: typeof NamespaceService.detectRouteStrategy;
/**
 * @deprecated Use NamespaceService.getEntityPaths() instead
 */
export declare const getEntityNamespacePaths: typeof NamespaceService.getEntityPaths;
//# sourceMappingURL=namespace.service.d.ts.map