/**
 * Mock Namespace Registry for Jest tests
 */

export const NAMESPACE_REGISTRY: Record<string, any> = {}

export interface RouteNamespaceConfig {
  namespace: string
  basePath: string
}

export interface NamespaceConfig {
  name: string
  path: string
}
