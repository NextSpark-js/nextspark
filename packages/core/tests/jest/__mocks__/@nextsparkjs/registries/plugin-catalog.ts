/**
 * Mock Plugin Catalog for Jest tests
 */

export type PluginCatalogCapability = 'server' | 'web' | 'build' | 'mobile'

export interface PluginCatalogEntry {
  name: string
  displayName: string
  version: string | null
  description: string | null
  enabled: boolean | null
  capabilities: PluginCatalogCapability[]
  hasAPI: boolean
  apiPath: string | null
  entities: string[]
  hasMessages: boolean
  hasAssets: boolean
}

export const PLUGIN_CATALOG: Record<string, PluginCatalogEntry> = {}
