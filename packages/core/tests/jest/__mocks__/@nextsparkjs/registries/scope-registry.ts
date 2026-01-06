/**
 * Mock Scope Registry for Jest tests
 */

export const SCOPE_REGISTRY: Record<string, any> = {}

export interface ScopeConfig {
  name: string
  description: string
}

export interface ApiConfig {
  basePath: string
  version: string
}
