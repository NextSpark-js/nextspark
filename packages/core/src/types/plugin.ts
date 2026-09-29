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
 * The surfaces a plugin can contribute to. The compiler takes only what a plugin declares (#203):
 * - `server`: API routes, entities, settings, server pages and the server registries
 * - `web`:    templates (routes/layouts of the web host), messages, assets and the client registry
 * - `mobile`: the `mobile/` entry; it can never reach server code
 * - `build`:  the `build/` directory; it never enters a runtime bundle
 */
export const PLUGIN_CAPABILITIES = ['server', 'web', 'build', 'mobile'] as const

export type PluginCapability = (typeof PLUGIN_CAPABILITIES)[number]

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
  /**
   * Declared surfaces. Written as a literal array inside `definePlugin({...})`: the registry build
   * reads it statically. A config that declares none is a legacy plugin: it is treated as
   * `['server', 'web', 'build']` (everything but mobile) until it is migrated to `definePlugin`.
   */
  capabilities?: readonly PluginCapability[]
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
 * What `definePlugin` takes: a `PluginConfig` whose descriptive fields have defaults.
 * `capabilities` is required and must list at least one capability.
 */
export type PluginDefinition = Omit<PluginConfig, 'displayName' | 'version' | 'enabled' | 'capabilities'> &
  Partial<Pick<PluginConfig, 'displayName' | 'version' | 'enabled'>> & {
    capabilities: readonly PluginCapability[]
  }

/**
 * Declare a NextSpark runtime plugin and the surfaces it contributes to.
 *
 * ```ts
 * export const examplePluginConfig = definePlugin({
 *   name: 'example',
 *   capabilities: ['server', 'web'],
 * })
 * export default examplePluginConfig
 * ```
 *
 * The `capabilities` array must be a literal: the registry build reads it from the source, without
 * running it, and fails generation when the plugin contributes to a surface it did not declare.
 * The result is a regular `PluginConfig`.
 */
export function definePlugin(definition: PluginDefinition): PluginConfig & { capabilities: readonly PluginCapability[] } {
  const { capabilities } = definition
  if (!Array.isArray(capabilities) || capabilities.length === 0) {
    throw new Error(`definePlugin("${definition.name}"): capabilities must list at least one of ${PLUGIN_CAPABILITIES.join(', ')}`)
  }
  for (const capability of capabilities) {
    if (!(PLUGIN_CAPABILITIES as readonly string[]).includes(capability)) {
      throw new Error(`definePlugin("${definition.name}"): unknown capability "${capability}"; expected ${PLUGIN_CAPABILITIES.join(', ')}`)
    }
  }
  return {
    ...definition,
    displayName: definition.displayName ?? definition.name,
    version: definition.version ?? '0.0.0',
    enabled: definition.enabled ?? true,
    capabilities: [...new Set(capabilities)],
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