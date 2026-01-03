/**
 * Ambient type declarations for @nextspark/registries/*
 *
 * These modules are external and resolved by the consumer project's bundler.
 * The actual implementations are generated at install time in .nextspark/registries/
 *
 * This file provides TypeScript with the type information it needs for compilation.
 * NOTE: This file must NOT have any imports to work as global declarations.
 */

// ============================================================================
// Billing Registry
// ============================================================================
declare module '@nextspark/registries/billing-registry' {
  export interface PlanDefinition {
    id: string
    slug: string
    name: string
    description?: string
    price: number
    interval: 'month' | 'year'
    features: string[]
    limits?: Record<string, number>
    visibility?: 'public' | 'private'
  }

  export interface FeatureDefinition {
    key: string
    name: string
    description?: string
  }

  export interface LimitDefinition {
    key: string
    name: string
    max: number
    resetPeriod?: string
  }

  export interface BillingConfig {
    enabled: boolean
    provider: string
    plans: PlanDefinition[]
    features: FeatureDefinition[]
    limits: LimitDefinition[]
  }

  export const BILLING_REGISTRY: BillingConfig
  export const BILLING_MATRIX: Record<string, Record<string, boolean | number | string>>
  export const PUBLIC_PLANS: readonly PlanDefinition[]
  export const BILLING_METADATA: {
    generatedAt: string
    planCount: number
    featureCount: number
  }
}

// ============================================================================
// Block Registry
// ============================================================================
declare module '@nextspark/registries/block-registry' {
  export type BlockCategory = 'features' | 'cta' | 'faq' | 'content' | 'hero' | 'pricing' | 'stats' | 'testimonials' | string

  export interface FieldDefinition {
    name: string
    label: string
    type: string
    tab?: string
    required?: boolean
    defaultValue?: unknown
  }

  export interface BlockConfig {
    slug: string
    name: string
    description?: string
    category: BlockCategory
    icon?: string
    fields?: FieldDefinition[]
    examples?: Record<string, unknown>[]
  }

  export const BLOCK_REGISTRY: Record<string, BlockConfig>
  export const BLOCK_CATEGORIES: BlockCategory[]
  export const BLOCK_METADATA: {
    generatedAt: string
    blockCount: number
    categories: string[]
  }

  export function getBlock(name: string): BlockConfig | undefined
  export function getBlocksByCategory(category: BlockCategory): BlockConfig[]
  export function getAllBlocks(): BlockConfig[]
}

// ============================================================================
// Entity Registry (Server)
// ============================================================================
declare module '@nextspark/registries/entity-registry' {
  export interface EntityConfig {
    slug: string
    label: string
    labelPlural: string
    icon?: string
    enabled: boolean
    showInMenu?: boolean
    permissions?: Record<string, string[]>
    fields?: Array<{
      name: string
      label: string
      type: string
      required?: boolean
    }>
  }

  export interface EntityRegistryEntry {
    config: EntityConfig
    source: 'core' | 'theme' | 'plugin'
    pluginName?: string
  }

  export const ENTITY_REGISTRY: Record<string, EntityRegistryEntry>
  export type EntityName = string
  export const ENTITY_METADATA: {
    generatedAt: string
    entityCount: number
    sources: Record<string, number>
  }

  export function getEntity(name: string): EntityRegistryEntry | undefined
  export function getAllEntities(): EntityRegistryEntry[]
  export function getEntitiesBySource(source: 'core' | 'theme' | 'plugin'): EntityRegistryEntry[]
}

// ============================================================================
// Entity Registry (Client)
// ============================================================================
declare module '@nextspark/registries/entity-registry.client' {
  export interface ClientEntityConfig {
    slug: string
    label: string
    labelPlural: string
    icon?: string
    enabled: boolean
    showInMenu: boolean
    permissions?: Record<string, string[]>
    fields?: Array<{
      name: string
      label: string
      type: string
      tab?: string
      required?: boolean
    }>
  }

  export interface ClientEntityRegistry {
    [key: string]: ClientEntityConfig
  }

  export type EntityName = string
  export const ENTITY_REGISTRY: ClientEntityRegistry

  export function getRegisteredEntities(): ClientEntityConfig[]
  export function getEntity(name: string): ClientEntityConfig | undefined
  export function getEntityBySlug(slug: string): ClientEntityConfig | null
  export function getEntityApiPath(entityType: string): string | null
  export function hasEntity(name: string): boolean
  export function getEntityDisplayName(slug: string): string
  export function getAllEntityConfigs(): ClientEntityConfig[]
}

// ============================================================================
// Theme Registry
// ============================================================================
declare module '@nextspark/registries/theme-registry' {
  export interface ThemeConfig {
    name: string
    displayName: string
    description?: string
    version?: string
    author?: string
  }

  export interface DashboardConfig {
    sidebarCollapsible?: boolean
    showBreadcrumbs?: boolean
    defaultRoute?: string
  }

  export interface AppConfig {
    name: string
    description?: string
    url?: string
  }

  export interface DevConfig {
    debug?: boolean
    showDevTools?: boolean
  }

  export const THEME_REGISTRY: {
    active: string
    config: ThemeConfig
    dashboard: DashboardConfig
    app: AppConfig
    dev: DevConfig
  }

  export const THEME_METADATA: {
    generatedAt: string
    activeTheme: string
  }
}

// ============================================================================
// Permissions Registry
// ============================================================================
declare module '@nextspark/registries/permissions-registry' {
  export interface PermissionConfig {
    roles: Record<string, string[]>
    permissions: string[]
  }

  export const PERMISSIONS_REGISTRY: PermissionConfig
  export const PERMISSIONS_METADATA: {
    generatedAt: string
    roleCount: number
    permissionCount: number
  }

  export function getPermissionsForRole(role: string): string[]
  export function hasPermission(role: string, permission: string): boolean
  export function getAllRoles(): string[]
  export function getAllPermissions(): string[]
}

// ============================================================================
// Plugin Registry (Server)
// ============================================================================
declare module '@nextspark/registries/plugin-registry' {
  export interface PluginConfig {
    name: string
    displayName: string
    description?: string
    version?: string
    enabled: boolean
    author?: string
  }

  export interface PluginRegistryEntry {
    config: PluginConfig
    hooks?: Record<string, Function>
  }

  export const PLUGIN_REGISTRY: Record<string, PluginRegistryEntry>
  export const PLUGIN_METADATA: {
    generatedAt: string
    pluginCount: number
    enabledCount: number
  }

  export function getPlugin(name: string): PluginRegistryEntry | undefined
  export function getAllPlugins(): PluginRegistryEntry[]
  export function getEnabledPlugins(): PluginRegistryEntry[]
  export function isPluginEnabled(name: string): boolean
}

// ============================================================================
// Plugin Registry (Client)
// ============================================================================
declare module '@nextspark/registries/plugin-registry.client' {
  export interface ClientPluginConfig {
    name: string
    displayName: string
    enabled: boolean
    features?: string[]
  }

  export const PLUGIN_REGISTRY: Record<string, ClientPluginConfig>

  export function getPlugin(name: string): ClientPluginConfig | undefined
  export function getAllPlugins(): ClientPluginConfig[]
  export function isPluginEnabled(name: string): boolean
}

// ============================================================================
// Template Registry (Server)
// ============================================================================
declare module '@nextspark/registries/template-registry' {
  export interface TemplateRegistryEntry {
    path: string
    component: React.ComponentType<any>
    source: 'core' | 'theme' | 'plugin'
    metadata?: Record<string, unknown>
  }

  export const TEMPLATE_REGISTRY: Record<string, TemplateRegistryEntry>
  export const LAYOUT_REGISTRY: Record<string, TemplateRegistryEntry>
  export const TEMPLATE_METADATA: {
    generatedAt: string
    templateCount: number
    layoutCount: number
  }

  export function getTemplate(path: string): TemplateRegistryEntry | undefined
  export function getLayout(path: string): TemplateRegistryEntry | undefined
}

// ============================================================================
// Template Registry (Client)
// ============================================================================
declare module '@nextspark/registries/template-registry.client' {
  export interface ClientTemplateEntry {
    path: string
    component: React.ComponentType<any>
  }

  export const TEMPLATE_REGISTRY: Record<string, ClientTemplateEntry>

  export function getTemplate(path: string): ClientTemplateEntry | undefined
}

// ============================================================================
// Testing Registry
// ============================================================================
declare module '@nextspark/registries/testing-registry' {
  export interface TestFeature {
    key: string
    name: string
    description?: string
    category?: string
    tags?: string[]
    enabled?: boolean
    testing?: {
      selectors?: Record<string, string>
      flows?: string[]
    }
  }

  export interface TestFlow {
    key: string
    name: string
    description?: string
    steps?: string[]
    tags?: string[]
  }

  export interface TestBlock {
    slug: string
    name: string
    fields?: Array<{
      name: string
      label: string
      type: string
      tab?: string
    }>
    examples?: Record<string, unknown>[]
  }

  export const TESTING_REGISTRY: {
    features: TestFeature[]
    flows: TestFlow[]
    blocks: TestBlock[]
    selectors: Record<string, string>
  }

  export function getFeature(name: string): TestFeature | undefined
  export function getFlow(name: string): TestFlow | undefined
  export function getBlock(name: string): TestBlock | undefined
  export function getSelector(name: string): string | undefined
}

// ============================================================================
// Translation Registry
// ============================================================================
declare module '@nextspark/registries/translation-registry' {
  export type SupportedLocale = 'en' | 'es' | string

  export const TRANSLATION_REGISTRY: {
    locales: SupportedLocale[]
    defaultLocale: SupportedLocale
    messages: Record<SupportedLocale, Record<string, unknown>>
  }

  export const TRANSLATION_METADATA: {
    generatedAt: string
    localeCount: number
    defaultLocale: string
  }

  export function getMessages(locale: SupportedLocale): Record<string, unknown>
  export function getSupportedLocales(): SupportedLocale[]
}

// ============================================================================
// Route Handlers Registry
// ============================================================================
declare module '@nextspark/registries/route-handlers' {
  export interface RouteHandler {
    path: string
    methods: ('GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE')[]
    handler: Function
    source: 'core' | 'theme' | 'plugin'
  }

  export const ROUTE_HANDLERS: Record<string, RouteHandler>
  export const ROUTE_METADATA: {
    generatedAt: string
    handlerCount: number
  }
}

// ============================================================================
// Docs Registry
// ============================================================================
declare module '@nextspark/registries/docs-registry' {
  export interface DocPageMeta {
    slug: string
    title: string
    description?: string
    order?: number
  }

  export interface DocSectionMeta {
    slug: string
    title: string
    description?: string
    pages: DocPageMeta[]
    source: 'core' | 'theme' | 'plugin'
  }

  export const DOCS_REGISTRY: {
    sections: DocSectionMeta[]
  }

  export function getAllDocSections(): DocSectionMeta[]
  export function findDocSection(slug: string): DocSectionMeta | undefined
  export function findDocPage(sectionSlug: string, pageSlug: string): DocPageMeta | undefined
}

// ============================================================================
// Middleware Registry
// ============================================================================
declare module '@nextspark/registries/middleware-registry' {
  export interface MiddlewareConfig {
    name: string
    matcher: string | string[]
    handler: Function
    order?: number
  }

  export const MIDDLEWARE_REGISTRY: MiddlewareConfig[]
  export const MIDDLEWARE_METADATA: {
    generatedAt: string
    middlewareCount: number
  }
}

// ============================================================================
// Namespace Registry
// ============================================================================
declare module '@nextspark/registries/namespace-registry' {
  export interface NamespaceConfig {
    name: string
    prefix: string
    routes?: string[]
  }

  export const NAMESPACE_REGISTRY: Record<string, NamespaceConfig>
  export const NAMESPACE_METADATA: {
    generatedAt: string
    namespaceCount: number
  }
}

// ============================================================================
// Scope Registry
// ============================================================================
declare module '@nextspark/registries/scope-registry' {
  export interface ScopeConfig {
    name: string
    permissions: string[]
    description?: string
  }

  export const SCOPE_REGISTRY: Record<string, ScopeConfig>
  export const SCOPE_METADATA: {
    generatedAt: string
    scopeCount: number
  }
}

// ============================================================================
// Scheduled Actions Registry
// ============================================================================
declare module '@nextspark/registries/scheduled-actions-registry' {
  export interface ScheduledAction {
    name: string
    cron: string
    handler: Function
    enabled?: boolean
  }

  export const SCHEDULED_ACTIONS_REGISTRY: ScheduledAction[]
  export const SCHEDULED_ACTIONS_METADATA: {
    generatedAt: string
    actionCount: number
  }
}
