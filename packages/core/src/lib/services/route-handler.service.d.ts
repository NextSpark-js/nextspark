/**
 * RouteHandlerService
 *
 * Service layer for route handler queries.
 * Provides O(1) lookups for theme and plugin route handlers.
 *
 * @example
 * import { RouteHandlerService } from './route-handler.service'
 *
 * // Get a theme route handler
 * const handler = RouteHandlerService.getThemeHandler('default/custom', 'GET')
 *
 * // Get a plugin route handler
 * const handler = RouteHandlerService.getPluginHandler('ai/generate', 'POST')
 *
 * // Check if route exists
 * if (RouteHandlerService.hasPluginRoute('ai/generate', 'POST')) {
 *   // Route exists
 * }
 */
import { THEME_ROUTE_HANDLERS, PLUGIN_ROUTE_HANDLERS, type RouteHandler } from '@nextsparkjs/registries/route-handlers';
export type { RouteHandler } from '@nextsparkjs/registries/route-handlers';
/**
 * RouteHandlerService
 *
 * Service layer for route handler queries.
 * All methods are static for consistency with other services.
 */
export declare class RouteHandlerService {
    /**
     * Get theme route handler by route key and HTTP method
     *
     * @param routeKey - Route key in format 'theme-name/route-path'
     * @param method - HTTP method (GET, POST, PUT, DELETE, PATCH)
     * @returns RouteHandler function or null if not found
     *
     * @example
     * const handler = RouteHandlerService.getThemeHandler('default/custom', 'GET')
     * if (handler) {
     *   const response = await handler(request, { params: Promise.resolve({}) })
     * }
     */
    static getThemeHandler(routeKey: string, method: string): RouteHandler | null;
    /**
     * Get all registered theme route keys
     *
     * @returns Array of route keys
     *
     * @example
     * const keys = RouteHandlerService.getThemeKeys()
     * // ['default/custom', 'default/webhook', ...]
     */
    static getThemeKeys(): string[];
    /**
     * Check if a theme route exists
     *
     * @param routeKey - Route key in format 'theme-name/route-path'
     * @param method - Optional HTTP method to check
     * @returns true if route (and optionally method) exists
     *
     * @example
     * // Check if route exists (any method)
     * RouteHandlerService.hasThemeRoute('default/custom') // true
     *
     * // Check if route exists with specific method
     * RouteHandlerService.hasThemeRoute('default/custom', 'POST') // false
     */
    static hasThemeRoute(routeKey: string, method?: string): boolean;
    /**
     * Get count of registered theme routes
     *
     * @returns Number of theme route keys
     */
    static getThemeCount(): number;
    /**
     * Get all theme handlers (full registry)
     *
     * @returns The complete THEME_ROUTE_HANDLERS registry
     */
    static getAllThemeHandlers(): typeof THEME_ROUTE_HANDLERS;
    /**
     * Get plugin route handler by route key and HTTP method
     *
     * @param routeKey - Route key in format 'plugin-name/route-path'
     * @param method - HTTP method (GET, POST, PUT, DELETE, PATCH)
     * @returns RouteHandler function or null if not found
     *
     * @example
     * const handler = RouteHandlerService.getPluginHandler('ai/generate', 'POST')
     * if (handler) {
     *   const response = await handler(request, { params: Promise.resolve({}) })
     * }
     */
    static getPluginHandler(routeKey: string, method: string): RouteHandler | null;
    /**
     * Get all registered plugin route keys
     *
     * @returns Array of route keys
     *
     * @example
     * const keys = RouteHandlerService.getPluginKeys()
     * // ['ai/generate', 'ai/embeddings', ...]
     */
    static getPluginKeys(): string[];
    /**
     * Check if a plugin route exists
     *
     * @param routeKey - Route key in format 'plugin-name/route-path'
     * @param method - Optional HTTP method to check
     * @returns true if route (and optionally method) exists
     *
     * @example
     * // Check if route exists (any method)
     * RouteHandlerService.hasPluginRoute('ai/generate') // true
     *
     * // Check if route exists with specific method
     * RouteHandlerService.hasPluginRoute('ai/generate', 'POST') // true
     */
    static hasPluginRoute(routeKey: string, method?: string): boolean;
    /**
     * Get count of registered plugin routes
     *
     * @returns Number of plugin route keys
     */
    static getPluginCount(): number;
    /**
     * Get all plugin handlers (full registry)
     *
     * @returns The complete PLUGIN_ROUTE_HANDLERS registry
     */
    static getAllPluginHandlers(): typeof PLUGIN_ROUTE_HANDLERS;
    /**
     * Get total count of all registered routes (theme + plugin)
     *
     * @returns Total number of route keys
     */
    static getTotalCount(): number;
}
/**
 * @deprecated Use RouteHandlerService.getThemeHandler instead
 */
export declare const getThemeRouteHandler: typeof RouteHandlerService.getThemeHandler;
/**
 * @deprecated Use RouteHandlerService.getPluginHandler instead
 */
export declare const getPluginRouteHandler: typeof RouteHandlerService.getPluginHandler;
/**
 * @deprecated Use RouteHandlerService.getThemeKeys instead
 */
export declare const getThemeRouteKeys: typeof RouteHandlerService.getThemeKeys;
/**
 * @deprecated Use RouteHandlerService.getPluginKeys instead
 */
export declare const getPluginRouteKeys: typeof RouteHandlerService.getPluginKeys;
//# sourceMappingURL=route-handler.service.d.ts.map