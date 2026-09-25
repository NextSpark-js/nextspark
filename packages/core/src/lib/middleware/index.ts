/**
 * Edge-Compatible Middleware Module
 *
 * This module provides middleware utilities that are compatible with Edge Runtime.
 * It exports functions that don't depend on Node.js-only modules like 'pg' or 'crypto'.
 *
 * IMPORTANT: This module must remain edge-compatible. Do NOT import from:
 * - ./services (barrel export that includes database services)
 * - ./db
 * - ./auth (full auth module)
 * - Any module that uses 'pg', 'crypto', or other Node.js modules
 *
 * SAFE TO IMPORT:
 * - @nextsparkjs/registries/* (pure data, no Node.js dependencies)
 * - next/server
 * - @better-fetch/fetch
 */

import { NextRequest, NextResponse } from 'next/server'
import { withBasePath } from '../base-path'

// Import directly from registry (edge-compatible, pure data)
import {
  MIDDLEWARE_REGISTRY,
  type MiddlewareRegistryEntry,
  type ThemeName
} from '@nextsparkjs/registries/middleware-registry'

import {
  THEME_REGISTRY,
} from '@nextsparkjs/registries/theme-registry'

// Re-export types
export type { MiddlewareRegistryEntry, ThemeName }

// ============== Session Type (minimal, no auth import) ==============

/**
 * Minimal session user type for middleware headers
 * This avoids importing the full auth module which has Node.js dependencies
 */
export interface SessionUser {
  id: string
  email?: string
  role?: string
  [key: string]: unknown
}

// ============== Theme Middleware Functions ==============

/** Check whether the current root-first project contributes a request hook. */
export function hasProjectMiddleware(): boolean {
  return Object.values(MIDDLEWARE_REGISTRY).some(entry => entry.exists)
}

/** Execute the sole current project's request hook, when present. */
export async function executeProjectMiddleware(
  request: NextRequest,
  coreSession?: Parameters<MiddlewareRegistryEntry['middleware']>[1]
): Promise<NextResponse | null> {
  const entry = Object.values(MIDDLEWARE_REGISTRY).find(candidate => candidate.exists)
  if (!entry) return null
  try {
    return await entry.middleware(request, coreSession)
  } catch (error) {
    console.error('Error executing the project request hook:', error)
    return null
  }
}

// ============== Theme Config Functions ==============

/** Get the app config contributed by the current root-first project. */
export function getProjectAppConfig(): any | undefined {
  return Object.values(THEME_REGISTRY)[0]?.appConfig
}

// ============== Middleware Helper Functions ==============

/**
 * Redirect to login with callback URL
 * Use for unauthenticated users trying to access protected routes
 * @complexity O(1)
 */
export function redirectWithoutSession(
  request: NextRequest,
  targetPath: string = '/login'
): NextResponse {
  const { pathname } = request.nextUrl
  const loginUrl = new URL(withBasePath(targetPath), request.url)
  loginUrl.searchParams.set('callbackUrl', pathname)
  return NextResponse.redirect(loginUrl)
}

/**
 * Redirect authenticated user to target path
 * Use for authenticated users trying to access login/signup pages
 * @complexity O(1)
 */
export function redirectWithSession(
  request: NextRequest,
  targetPath: string = '/dashboard'
): NextResponse {
  return NextResponse.redirect(new URL(withBasePath(targetPath), request.url))
}

/**
 * Add user headers to request for downstream processing
 * Adds x-user-id, x-user-email, and x-pathname headers
 * @complexity O(1)
 */
export function addUserHeaders(
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

  // Add pathname for downstream use
  requestHeaders.set('x-pathname', request.nextUrl.pathname)

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}
