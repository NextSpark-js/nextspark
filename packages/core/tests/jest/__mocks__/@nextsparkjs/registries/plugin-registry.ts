/**
 * Mock Plugin Registry for Jest tests
 */

export const PLUGIN_REGISTRY: Record<string, any> = {}

export const PLUGIN_METADATA = {
  generated: new Date().toISOString(),
  totalPlugins: 0,
}

export type PluginName = string

export interface PluginRegistryEntry {
  name: string
  version: string
  entities: any[]
  routes: any[]
}

export interface RouteFileEndpoint {
  path: string
  method: string
}

export interface PluginEntity {
  name: string
  config: any
}
