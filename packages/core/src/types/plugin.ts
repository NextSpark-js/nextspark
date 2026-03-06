/**
 * Plugin Type Definitions
 *
 * Central type definitions for the plugin system.
 * Used across plugin registry, loaders, and components.
 */

/**
 * Plugin lifecycle hooks
 */
export interface PluginHooks {
  onLoad?: () => Promise<void>
  onActivate?: () => Promise<void>
  onDeactivate?: () => Promise<void>
  onUnload?: () => Promise<void>
}

/**
 * A single navigation item contributed by a plugin
 */
export interface PluginNavItem {
  href: string
  label: string
  description?: string
  icon?: string
  children?: PluginNavItem[]
}

/**
 * A navigation section contributed by a plugin for a specific area
 */
export interface PluginNavSection {
  sectionLabel?: string
  items: PluginNavItem[]
}

/**
 * Plugin configuration interface
 */
export interface PluginConfig {
  name: string
  displayName: string
  version: string
  description?: string
  enabled: boolean
  dependencies?: string[]
  hooks?: PluginHooks
  components?: Record<string, any>
  services?: Record<string, any>
  api?: Record<string, any>
  navigation?: {
    devtools?: PluginNavSection
    superadmin?: PluginNavSection
  }
}

/**
 * Plugin route endpoint information
 */
export interface RouteFileEndpoint {
  path: string
  filePath: string
  relativePath: string
  methods: string[]
  isRouteFile: boolean
}

/**
 * Plugin settings area (e.g. settings/devtools/, settings/superadmin/)
 */
export interface PluginSettingsArea {
  area: string
  hasMigrations: boolean
}

/**
 * Plugin registry entry with metadata
 */
export interface PluginRegistryEntry {
  name: string
  config: PluginConfig
  hasAPI: boolean
  apiPath: string | null
  routeFiles?: RouteFileEndpoint[]
  entities?: any[]
  settings?: PluginSettingsArea[]
  hasMessages?: boolean
  hasAssets?: boolean
}

/**
 * Plugin name type alias
 */
export type PluginName = string