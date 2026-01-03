/**
 * Middleware Service
 *
 * Service layer for middleware registry operations.
 * Provides static methods for querying and executing theme middleware.
 */

import { NextRequest, NextResponse } from 'next/server'
import type { SessionUser } from '../auth'
import {
  MIDDLEWARE_REGISTRY,
  MIDDLEWARE_METADATA,
  type MiddlewareRegistryEntry,
  type ThemeName
} from '@nextsparkjs/registries/middleware-registry'

// Re-export types for convenience
export type { MiddlewareRegistryEntry, ThemeName }

/**
 * MiddlewareService - Static service for middleware operations
 */
export class MiddlewareService {
  // ============== Lookup Methods ==============

  /**
   * Get middleware for specific theme
   * @complexity O(1)
   */
  static getByTheme(themeName: string): MiddlewareRegistryEntry | undefined {
    return MIDDLEWARE_REGISTRY[themeName]
  }

  /**
   * Get all registered middlewares
   * @complexity O(n) where n = number of themes with middleware
   */
  static getAll(): MiddlewareRegistryEntry[] {
    return Object.values(MIDDLEWARE_REGISTRY)
  }

  /**
   * Check if theme has middleware
   * @complexity O(1)
   */
  static hasMiddleware(themeName: string): boolean {
    return themeName in MIDDLEWARE_REGISTRY && MIDDLEWARE_REGISTRY[themeName].exists
  }

  /**
   * Get registry metadata
   * @complexity O(1)
   */
  static getMetadata(): typeof MIDDLEWARE_METADATA {
    return MIDDLEWARE_METADATA
  }

  // ============== Execution Methods ==============

  /**
   * Execute theme middleware with error handling
   * @complexity O(1) + async execution time
   */
  static async execute(
    themeName: string,
    request: NextRequest,
    coreSession?: SessionUser | null
  ): Promise<NextResponse | null> {
    const entry = MIDDLEWARE_REGISTRY[themeName]

    if (!entry || !entry.exists) {
      return null
    }

    try {
      return await entry.middleware(request, coreSession)
    } catch (error) {
      console.error(`Error executing middleware for theme '${themeName}':`, error)
      return null
    }
  }

  // ============== Helper Methods ==============

  /**
   * Redirect to login with callback URL
   * Use for unauthenticated users trying to access protected routes
   * @complexity O(1)
   */
  static redirectWithoutSession(
    request: NextRequest,
    targetPath: string = '/login'
  ): NextResponse {
    const { pathname } = request.nextUrl
    const loginUrl = new URL(targetPath, request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  /**
   * Redirect authenticated user to target path
   * Use for authenticated users trying to access login/signup pages
   * @complexity O(1)
   */
  static redirectWithSession(
    request: NextRequest,
    targetPath: string = '/dashboard'
  ): NextResponse {
    return NextResponse.redirect(new URL(targetPath, request.url))
  }

  /**
   * Add user headers to request for downstream processing
   * Adds x-user-id, x-user-email, and x-pathname headers
   * @complexity O(1)
   */
  static addUserHeaders(
    request: NextRequest,
    sessionUser: SessionUser | null
  ): NextResponse {
    const requestHeaders = new Headers(request.headers)

    if (sessionUser?.id) {
      requestHeaders.set('x-user-id', sessionUser.id)
    }
    if (sessionUser?.email) {
      requestHeaders.set('x-user-email', sessionUser.email)
    }

    // Add pathname for i18n optimization
    requestHeaders.set('x-pathname', request.nextUrl.pathname)

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }
}

// ============== Backward Compatibility Exports ==============

export const getActiveThemeMiddleware = MiddlewareService.getByTheme
export const getAllMiddlewares = MiddlewareService.getAll
export const hasThemeMiddleware = MiddlewareService.hasMiddleware
export const executeThemeMiddleware = MiddlewareService.execute
export const redirectWithoutSessionMiddleware = MiddlewareService.redirectWithoutSession
export const redirectWithSessionMiddleware = MiddlewareService.redirectWithSession
export const addUserHeadersMiddleware = MiddlewareService.addUserHeaders
