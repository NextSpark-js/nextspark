/**
 * Mock Route-Scoped Server Template Registry for Jest tests
 *
 * No theme overrides a page in tests, so every page renders its default.
 */

export const TEMPLATE_REGISTRY: Record<string, any> = {}

export function hasTemplateOverride(_appPath: string): boolean {
  return false
}

export function getTemplateComponent(_appPath: string): any | null {
  return null
}

export function getTemplateOrDefault<T>(_appPath: string, defaultComponent: T): T {
  return defaultComponent
}

export function getMetadataOrDefault<T>(_appPath: string, defaultMetadata: T): T {
  return defaultMetadata
}
