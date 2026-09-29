/**
 * Mock Client Plugin Registry for Jest tests
 */

export const PLUGIN_REGISTRY: Record<string, unknown> = {}

export function getPluginNavItems(_area: string): unknown[] {
  return []
}
