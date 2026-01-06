/**
 * Mock Middleware Registry for Jest tests
 */

export const MIDDLEWARE_REGISTRY: Record<string, any> = {}

export const MIDDLEWARE_METADATA = {
  generated: new Date().toISOString(),
  totalMiddlewares: 0,
}

export interface MiddlewareRegistryEntry {
  name: string
  path: string
  priority: number
}

export type ThemeName = string
