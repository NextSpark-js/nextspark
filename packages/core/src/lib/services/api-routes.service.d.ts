/**
 * ApiRoutesService
 *
 * Service layer for API routes metadata queries.
 * Provides O(1) lookups and filtering for all registered API endpoints.
 *
 * @example
 * import { ApiRoutesService } from './api-routes.service'
 *
 * // Get all routes
 * const routes = ApiRoutesService.getAllRoutes()
 *
 * // Get routes by category
 * const coreRoutes = ApiRoutesService.getCoreRoutes()
 * const entityRoutes = ApiRoutesService.getEntityRoutes()
 *
 * // Get summary stats
 * const summary = ApiRoutesService.getSummary()
 */
import { API_ROUTES_SUMMARY, type ApiRouteEntry } from '@nextsparkjs/registries/route-handlers';
export type { ApiRouteEntry } from '@nextsparkjs/registries/route-handlers';
/**
 * Route category types
 */
export type RouteCategory = 'core' | 'entity' | 'theme' | 'plugin';
/**
 * ApiRoutesService
 *
 * Service layer for API routes metadata queries.
 * All methods are static for consistency with other services.
 */
export declare class ApiRoutesService {
    /**
     * Get all registered API routes across all categories
     *
     * @returns Array of all API route entries
     *
     * @example
     * const allRoutes = ApiRoutesService.getAllRoutes()
     * console.log(`Total: ${allRoutes.length} routes`)
     */
    static getAllRoutes(): ApiRouteEntry[];
    /**
     * Get routes filtered by category
     *
     * @param category - The category to filter by
     * @returns Array of routes in that category
     *
     * @example
     * const entityRoutes = ApiRoutesService.getRoutesByCategory('entity')
     */
    static getRoutesByCategory(category: RouteCategory): ApiRouteEntry[];
    /**
     * Get all core API routes
     *
     * @returns Array of core route entries
     */
    static getCoreRoutes(): ApiRouteEntry[];
    /**
     * Get all entity-based API routes
     *
     * @returns Array of entity route entries
     */
    static getEntityRoutes(): ApiRouteEntry[];
    /**
     * Get all theme custom API routes
     *
     * @returns Array of theme route entries
     */
    static getThemeRoutes(): ApiRouteEntry[];
    /**
     * Get all plugin API routes
     *
     * @returns Array of plugin route entries
     */
    static getPluginRoutes(): ApiRouteEntry[];
    /**
     * Get routes that support a specific HTTP method
     *
     * @param method - HTTP method to filter by (GET, POST, PATCH, DELETE, etc.)
     * @returns Array of routes supporting that method
     *
     * @example
     * const postRoutes = ApiRoutesService.getRoutesByMethod('POST')
     */
    static getRoutesByMethod(method: string): ApiRouteEntry[];
    /**
     * Get routes by source (entity name, theme name, or plugin name)
     *
     * @param source - The source to filter by
     * @returns Array of routes from that source
     *
     * @example
     * const customerRoutes = ApiRoutesService.getRoutesBySource('customers')
     * const aiRoutes = ApiRoutesService.getRoutesBySource('ai')
     */
    static getRoutesBySource(source: string): ApiRouteEntry[];
    /**
     * Search routes by path pattern
     *
     * @param pattern - String to search for in route paths
     * @returns Array of matching routes
     *
     * @example
     * const teamRoutes = ApiRoutesService.searchRoutes('team')
     */
    static searchRoutes(pattern: string): ApiRouteEntry[];
    /**
     * Get summary statistics about all API routes
     *
     * @returns Summary object with counts and generation timestamp
     *
     * @example
     * const summary = ApiRoutesService.getSummary()
     * console.log(`Total routes: ${summary.totalRoutes}`)
     */
    static getSummary(): typeof API_ROUTES_SUMMARY;
    /**
     * Get total count of all registered routes
     *
     * @returns Number of total routes
     */
    static getTotalCount(): number;
    /**
     * Get count of routes by category
     *
     * @returns Object with counts per category
     */
    static getCountByCategory(): typeof API_ROUTES_SUMMARY.byCategory;
    /**
     * Get the timestamp when the registry was generated
     *
     * @returns ISO 8601 timestamp string
     */
    static getGeneratedAt(): string;
    /**
     * Check if a specific path exists in the registry
     *
     * @param path - The API path to check
     * @returns true if the path is registered
     *
     * @example
     * if (ApiRoutesService.hasRoute('/api/v1/users')) {
     *   // Route exists
     * }
     */
    static hasRoute(path: string): boolean;
    /**
     * Get a specific route by its path
     *
     * @param path - The API path to look up
     * @returns The route entry or undefined if not found
     *
     * @example
     * const route = ApiRoutesService.getRoute('/api/v1/users')
     * if (route) {
     *   console.log(route.methods)
     * }
     */
    static getRoute(path: string): ApiRouteEntry | undefined;
    /**
     * Get all unique sources (entity names, plugin names, etc.)
     *
     * @returns Array of unique source names
     */
    static getAllSources(): string[];
    /**
     * Group routes by their category
     *
     * @returns Object with routes grouped by category
     */
    static getRoutesGroupedByCategory(): Record<RouteCategory, ApiRouteEntry[]>;
}
//# sourceMappingURL=api-routes.service.d.ts.map