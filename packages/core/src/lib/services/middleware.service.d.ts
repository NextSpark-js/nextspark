/**
 * Middleware Service
 *
 * Service layer for middleware registry operations.
 * Provides static methods for querying and executing theme middleware.
 */
import { NextRequest, NextResponse } from 'next/server';
import type { SessionUser } from '../auth';
import { MIDDLEWARE_METADATA, type MiddlewareRegistryEntry, type ThemeName } from '@nextsparkjs/registries/middleware-registry';
export type { MiddlewareRegistryEntry, ThemeName };
/**
 * MiddlewareService - Static service for middleware operations
 */
export declare class MiddlewareService {
    /**
     * Get middleware for specific theme
     * @complexity O(1)
     */
    static getByTheme(themeName: string): MiddlewareRegistryEntry | undefined;
    /**
     * Get all registered middlewares
     * @complexity O(n) where n = number of themes with middleware
     */
    static getAll(): MiddlewareRegistryEntry[];
    /**
     * Check if theme has middleware
     * @complexity O(1)
     */
    static hasMiddleware(themeName: string): boolean;
    /**
     * Get registry metadata
     * @complexity O(1)
     */
    static getMetadata(): typeof MIDDLEWARE_METADATA;
    /**
     * Execute theme middleware with error handling
     * @complexity O(1) + async execution time
     */
    static execute(themeName: string, request: NextRequest, coreSession?: SessionUser | null): Promise<NextResponse | null>;
    /**
     * Redirect to login with callback URL
     * Use for unauthenticated users trying to access protected routes
     * @complexity O(1)
     */
    static redirectWithoutSession(request: NextRequest, targetPath?: string): NextResponse;
    /**
     * Redirect authenticated user to target path
     * Use for authenticated users trying to access login/signup pages
     * @complexity O(1)
     */
    static redirectWithSession(request: NextRequest, targetPath?: string): NextResponse;
    /**
     * Add user headers to request for downstream processing
     * Adds x-user-id, x-user-email, and x-pathname headers
     * @complexity O(1)
     */
    static addUserHeaders(request: NextRequest, sessionUser: SessionUser | null): NextResponse;
}
export declare const getActiveThemeMiddleware: typeof MiddlewareService.getByTheme;
export declare const getAllMiddlewares: typeof MiddlewareService.getAll;
export declare const hasThemeMiddleware: typeof MiddlewareService.hasMiddleware;
export declare const executeThemeMiddleware: typeof MiddlewareService.execute;
export declare const redirectWithoutSessionMiddleware: typeof MiddlewareService.redirectWithoutSession;
export declare const redirectWithSessionMiddleware: typeof MiddlewareService.redirectWithSession;
export declare const addUserHeadersMiddleware: typeof MiddlewareService.addUserHeaders;
//# sourceMappingURL=middleware.service.d.ts.map