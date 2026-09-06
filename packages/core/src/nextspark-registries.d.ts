/**
 * Ambient type declarations for @nextsparkjs/registries/*
 *
 * These modules are virtual: a consumer project generates their real content
 * (via `nextspark registry:build`) into `.nextspark/registries/` at build
 * time. `packages/core` imports from them in its own source but never
 * generates them itself, so it needs these ambient declarations to
 * typecheck in isolation.
 *
 * Reconciled against the actual import surface in `packages/core/src`
 * (see #131) — every module/export here is backed by a real `import` in the
 * source tree, not aspirational. If you add a new import from
 * `@nextsparkjs/registries/*`, add its shape here too.
 *
 * NOTE: This file must NOT have any imports to work as global declarations.
 */

// ============================================================================
// Billing Registry
// ============================================================================
declare module '@nextsparkjs/registries/billing-registry' {
  // Mirrors packages/core/src/lib/billing/config-types.ts exactly (not
  // imported — see permissions-registry above for why): billing/queries.ts
  // type-annotates its return values against that hand-written type.
  export type PlanType = 'free' | 'paid' | 'enterprise'
  export type PlanVisibility = 'public' | 'hidden' | 'invite_only'
  export type PaymentProvider = 'stripe' | 'polar'

  export interface FeatureDefinition {
    name: string
    description?: string
  }

  export interface LimitDefinition {
    name: string
    unit: 'count' | 'bytes' | 'calls'
    resetPeriod: 'never' | 'daily' | 'monthly' | 'yearly'
  }

  export interface PlanDefinition {
    slug: string
    name: string
    description?: string
    type: PlanType
    visibility?: PlanVisibility
    price?: { monthly: number; yearly: number }
    trialDays?: number
    features: string[]
    limits: Record<string, number>
    providerPriceIds?: { monthly?: string | null; yearly?: string | null }
  }

  export interface ActionMappings {
    permissions?: Record<string, string>
    features: Record<string, string>
    limits: Record<string, string>
  }

  export interface BillingConfig {
    provider: PaymentProvider
    currency: string
    defaultPlan: string
    plans: PlanDefinition[]
    features: Record<string, FeatureDefinition>
    limits: Record<string, LimitDefinition>
    actionMappings: ActionMappings
  }

  export const BILLING_REGISTRY: BillingConfig
  // features[featureSlug][planSlug] -> has feature; limits[limitSlug][planSlug] -> value.
  export const BILLING_MATRIX: {
    features: Record<string, Record<string, boolean>>
    limits: Record<string, Record<string, number>>
  }
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
declare module '@nextsparkjs/registries/block-registry' {
  // Mirrors packages/core/src/types/blocks.ts's BlockConfig/FieldDefinition
  // exactly (not imported — see permissions-registry above for why): core's
  // own block.service.ts type-annotates its return values against that
  // hand-written type, so registry values must be structurally identical
  // to it, not just "close enough".
  export type FieldType =
    | 'text' | 'textarea' | 'url' | 'email' | 'number' | 'color' | 'image'
    | 'media-library' | 'select' | 'checkbox' | 'radio' | 'rich-text'
    | 'array' | 'date' | 'time'
  export type FieldTab = 'content' | 'design' | 'advanced'

  export type BlockCategory =
    | 'hero' | 'content' | 'features' | 'cta' | 'testimonials' | 'media'
    | 'forms' | 'navigation' | 'footer' | 'pricing' | 'team' | 'stats'
    | 'faq' | 'newsletter' | 'other'

  export interface FieldDefinition {
    name: string
    label: string
    type: FieldType
    tab: FieldTab
    required?: boolean
    default?: unknown
    placeholder?: string
    description?: string
    helpText?: string
    minLength?: number
    maxLength?: number
    rows?: number
    min?: number
    max?: number
    step?: number
    options?: Array<{ label: string; value: string | number }>
    checkboxLabel?: string
    accept?: string
    maxSize?: number
    aspectRatio?: string
    itemType?: FieldType
    itemFields?: FieldDefinition[]
    minItems?: number
    maxItems?: number
    targetEntity?: string
    displayField?: string
    valueField?: string
    relationshipType?: 'manyToOne' | 'manyToMany'
    condition?: {
      field: string
      operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan'
      value: unknown
    }
    group?: string
    groupLabel?: string
  }

  export interface BlockExample {
    name: string
    description?: string
    props: Record<string, unknown>
  }

  export interface BlockConfig {
    slug: string
    name: string
    description: string
    category: BlockCategory
    icon?: string
    componentPath?: string
    schemaPath?: string
    fieldsPath?: string
    thumbnail?: string
    fieldDefinitions: FieldDefinition[]
    examples: BlockExample[]
    scope?: Array<'pages' | 'posts' | string>
    allowInPatterns?: boolean
    schemaType?: string
    tags?: string[]
    isCore?: boolean
    source?: 'core' | 'theme' | 'plugin'
    sourceId?: string
    version?: string
    deprecated?: boolean
    replacedBy?: string
  }

  export const BLOCK_REGISTRY: Record<string, BlockConfig>
  export const BLOCK_CATEGORIES: BlockCategory[]
  export const BLOCK_METADATA: {
    generatedAt: string
    blockCount: number
    categories: string[]
  }
  // Lazy-loaded (client) and eagerly-loaded (SSR) component maps, keyed by
  // block slug — populated by the registry generator, not by core. `any`
  // props are correct here: each block's component has its own distinct
  // props type, unifiable only as `ComponentType<any>` in a shared map.
  export const BLOCK_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType<any>> | React.ComponentType<any>>
  export const BLOCK_COMPONENTS_SSR: Record<string, React.ComponentType<any>>

  export function getBlock(name: string): BlockConfig | undefined
  export function getBlocksByCategory(category: BlockCategory): BlockConfig[]
  export function getAllBlocks(): BlockConfig[]
}

// ============================================================================
// Entity Registry (Server) — declared for completeness; no direct import
// found in packages/core/src today, but kept in case a consumer-facing
// contract still expects it.
// ============================================================================
declare module '@nextsparkjs/registries/entity-registry' {
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
declare module '@nextsparkjs/registries/entity-registry.client' {
  export interface ClientSidebarFieldConfig {
    name: string
    type: string
    label?: string
    relation?: {
      entity: string
      titleField: string
      userFiltered?: boolean
    }
    options?: Array<{ value: string; label: string }>
  }

  export interface ClientEntityConfig {
    // Matches the REAL shape apps/dev's registry:build actually generates
    // (packages/cli's entity-registry.client.ts template) — verified against
    // a live-regenerated apps/dev/.nextspark/registries/entity-registry.client.ts,
    // not guessed. A prior version of this ambient declaration invented a
    // flat slug/label/labelPlural/enabled/showInMenu shape that never existed
    // anywhere; it went uncaught because none of this package's own
    // ClientEntityConfig consumers happened to read those particular fields
    // (#131 follow-up).
    name: string
    apiPath: string
    displayName: string
    features: {
      enabled: boolean
      showInMenu?: boolean
      canCreate?: boolean
      canEdit?: boolean
      canDelete?: boolean
      searchable?: boolean
    }
    builder?: {
      enabled?: boolean
      sidebarFields?: string[]
      sidebarFieldsConfig?: ClientSidebarFieldConfig[]
      showSlug?: boolean
      seo?: boolean
      public?: { basePath: string }
    }
    taxonomies?: {
      enabled?: boolean
      types?: Array<{ type: string; label?: string; [key: string]: unknown }>
      [key: string]: unknown
    }
    access?: { basePath?: string; [key: string]: unknown }
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

  // Child-entity relation helpers (relation-display, simple-relation-select).
  // Always returns an object (never null) — callers check `.isChild`.
  export interface ParsedChildEntity {
    isChild: boolean
    parentEntity?: string
    childType?: string
    [key: string]: unknown
  }
  export function parseChildEntity(entityType: string): ParsedChildEntity

  // Metadata-system adapter object (not a factory) consumed directly by
  // lib/api/entities.ts as `clientMetaSystemAdapter.getApiPath(...)`.
  export const clientMetaSystemAdapter: {
    getApiPath(entityType: string): string | null
    getAllEntityConfigs(): Array<{
      name: string
      apiPath?: string
      features?: { enabled?: boolean; canDelete?: boolean; canEdit?: boolean; [key: string]: unknown }
      [key: string]: unknown
    }>
  }
}

// ============================================================================
// Entity Types (search/type metadata — distinct from entity-registry)
// ============================================================================
declare module '@nextsparkjs/registries/entity-types' {
  export type EntityName = string
  export type SystemSearchType = 'task' | 'page' | 'setting' | 'entity' | string
  export type SearchResultType = EntityName | SystemSearchType

  export const SEARCH_TYPE_PRIORITIES: Record<string, number>
  export const ENTITY_METADATA: {
    generatedAt: string
    entityNames: EntityName[]
    totalEntities: number
  }
}

// ============================================================================
// Theme Registry
// ============================================================================
declare module '@nextsparkjs/registries/theme-registry' {
  // Mirrors packages/core/src/types/theme.ts's ThemeConfig — its own index
  // signature (`[key: string]: any`) makes it permissive enough that only
  // the required fields need to match exactly.
  export interface ThemeConfig {
    name: string
    displayName: string
    version: string
    description?: string
    author?: string
    [key: string]: any
  }

  export interface ThemeEntity {
    slug: string
    [key: string]: unknown
  }

  export interface ThemeRouteFile {
    path: string
    [key: string]: unknown
  }

  export type ThemeName = string

  export interface ThemeRegistryEntry {
    name: string
    config: ThemeConfig
    // `any` (not `unknown`): themes extend these with arbitrary, theme-specific
    // shapes (customSidebarSections, docs.public, etc.) that core only passes
    // through — an index signature here would still force `unknown` on
    // property access and break every consumer's own narrower usage.
    dashboardConfig?: Record<string, any>
    appConfig?: Record<string, any>
    devConfig?: Record<string, any> | null
    entities?: ThemeEntity[]
    routeFiles?: ThemeRouteFile[]
    plugins?: string[]
  }

  export const THEME_REGISTRY: Record<string, ThemeRegistryEntry>

  export const THEME_METADATA: {
    generatedAt: string
    activeTheme: string
    themes: string[]
    totalThemes: number
  }
}

// ============================================================================
// Permissions Registry
//
// Real shape is entirely different from the old ambient declaration (which
// declared a single PERMISSIONS_REGISTRY object) — permission.service.ts
// imports a dozen independent pre-computed data structures directly.
// ============================================================================
declare module '@nextsparkjs/registries/permissions-registry' {
  // Inlined instead of imported: nested `import type` inside a
  // `declare module` block silently degrades every consumer's inferred
  // types to `any` in this TS setup (isolatedModules + bundler resolution),
  // which is exactly why the original file said "must not have any
  // imports". Kept structurally compatible with lib/permissions/types.ts.
  export type Permission = `${string}.${string}`
  // Consuming code re-exports/returns these as plain mutable arrays — not
  // `readonly` here, to stay assignable to those signatures.
  export interface ResolvedPermission {
    id: Permission
    label: string
    description?: string
    category: string
    roles: string[]
    dangerous?: boolean
    requires?: Permission[]
    source: 'core' | 'theme' | 'entity'
    disabled: boolean
  }

  export const ALL_PERMISSIONS: Permission[]
  export const ALL_PERMISSIONS_SET: ReadonlySet<Permission>
  export const ALL_RESOLVED_PERMISSIONS: ResolvedPermission[]
  export const PERMISSIONS_BY_ROLE: Record<string, ReadonlySet<Permission>>
  export const ROLE_PERMISSIONS_ARRAY: Record<string, Permission[]>
  export const PERMISSIONS_BY_CATEGORY: Record<string, ResolvedPermission[]>
  export const FULL_MATRIX: Record<string, Record<string, boolean>>
  export const UI_SECTIONS: {
    key: string
    label: string
    permissions: Permission[]
  }[]
  export const AVAILABLE_ROLES: string[]
  export const TEAM_PERMISSIONS_BY_ROLE: Record<string, string[]>
  export const PERMISSIONS_METADATA: {
    generatedAt: string
    permissionCount: number
  }
  export const ROLE_HIERARCHY: Record<string, number>
  export const ROLE_DISPLAY_NAMES: Record<string, string>
  export const ROLE_DESCRIPTIONS: Record<string, string>
  export const DEFAULT_TEAM_ROLE: string
}

// ============================================================================
// Plugin Registry (Server)
// ============================================================================
declare module '@nextsparkjs/registries/plugin-registry' {
  export interface RouteFileEndpoint {
    path: string
    methods: string[]
    [key: string]: unknown
  }

  export interface PluginEntity {
    slug: string
    [key: string]: unknown
  }

  export type PluginName = string

  export interface PluginRegistryEntry {
    name: string
    config: Record<string, unknown>
    enabled: boolean
    entities?: PluginEntity[]
    routes?: RouteFileEndpoint[]
    hooks?: Record<string, (...args: unknown[]) => unknown>
  }

  export const PLUGIN_REGISTRY: Record<string, PluginRegistryEntry>
  export const ROUTE_METADATA: {
    generatedAt: string
    handlerCount: number
  }
  export const PLUGIN_METADATA: {
    generatedAt: string
    pluginCount: number
    enabledCount: number
  }
}

// ============================================================================
// Plugin Registry (Client)
// ============================================================================
declare module '@nextsparkjs/registries/plugin-registry.client' {
  export interface PluginNavItem {
    label: string
    href: string
    icon?: string
    description?: string
    [key: string]: unknown
  }

  export function getPluginNavItems(context: string): PluginNavItem[]
}

// ============================================================================
// Template Registry (Server)
// ============================================================================
declare module '@nextsparkjs/registries/template-registry' {
  export type TemplatePath = string

  export interface TemplateOverride {
    themeName: string
    templateType: string
    [key: string]: unknown
  }

  export interface TemplateRegistryEntry {
    appPath: TemplatePath
    component: unknown
    template: TemplateOverride
    alternatives: TemplateOverride[]
  }

  export const TEMPLATE_REGISTRY: Record<string, TemplateRegistryEntry>
  export const TEMPLATE_METADATA: {
    generatedAt: string
    totalTemplates: number
    templateTypes: string[]
  }
}

// ============================================================================
// Testing Registry
//
// Real shape is four independent top-level exports, not a single nested
// TESTING_REGISTRY object like the old ambient declaration had.
// ============================================================================
declare module '@nextsparkjs/registries/testing-registry' {
  export type FeatureCategory = string
  export type FlowCategory = string

  export interface FeatureEntry {
    key: string
    name: string
    description: string
    category: FeatureCategory
    tag: string
    tags?: string[]
    testing: {
      testCount: number
      hasTests: boolean
      selectors?: Record<string, string>
      flows?: string[]
    }
  }

  export interface FlowEntry {
    key: string
    name: string
    description: string
    category: FlowCategory
    tag: string
    tags?: string[]
    steps?: string[]
    criticalPath?: boolean
    testing: {
      testCount: number
      hasTests: boolean
    }
  }

  export const FEATURE_REGISTRY: Record<string, FeatureEntry>
  export const FLOW_REGISTRY: Record<string, FlowEntry>
  // Keyed by fixed category names (consumers do `keyof typeof TAGS_REGISTRY`
  // and cast each category's value to their own local shape), not an index
  // signature.
  export const TAGS_REGISTRY: {
    layers: Record<string, { tag: string; testCount: number; files: string[] }>
    priorities: Record<string, { tag: string; testCount: number; files: string[] }>
    features: Record<string, { tag: string; testCount: number; files: string[] }>
    flows: Record<string, { tag: string; testCount: number; files: string[] }>
    blocks: Record<string, { tag: string; testCount: number; files: string[] }>
    roles: Record<string, { tag: string; testCount: number; files: string[] }>
    operations: Record<string, { tag: string; testCount: number; files: string[] }>
    other: Record<string, { tag: string; testCount: number; files: string[] }>
  }
  export const COVERAGE_SUMMARY: {
    features: { total: number; withTests: number; withoutTests: number }
    flows: { total: number; withTests: number; withoutTests: number }
    tags: { testFiles: number }
  }
}

// ============================================================================
// Translation Registry
//
// Real shape is three independent lazy-loader maps, not a single
// TRANSLATION_REGISTRY object like the old ambient declaration had.
// ============================================================================
declare module '@nextsparkjs/registries/translation-registry' {
  export type TranslationLoader = () => Promise<Record<string, unknown>>

  // theme -> locale -> loader
  export const THEME_TRANSLATION_LOADERS: Record<string, Record<string, TranslationLoader>>
  // theme -> entity -> locale -> loader
  export const ENTITY_TRANSLATION_LOADERS: Record<string, Record<string, Record<string, TranslationLoader>>>
  // pluginName -> entity -> locale -> loader
  export const PLUGIN_ENTITY_TRANSLATION_LOADERS: Record<string, Record<string, Record<string, TranslationLoader>>>
}

// ============================================================================
// Route Handlers Registry
//
// Real shape is API-route metadata + theme/plugin handler maps, not the
// single ROUTE_HANDLERS export the old ambient declaration had.
// ============================================================================
declare module '@nextsparkjs/registries/route-handlers' {
  export interface ApiRouteEntry {
    path: string
    methods: string[]
    source?: string
    subcategory?: string
    [key: string]: unknown
  }

  export const API_ROUTES_METADATA: {
    core: ApiRouteEntry[]
    entities: ApiRouteEntry[]
    theme: ApiRouteEntry[]
    plugins: ApiRouteEntry[]
  }
  export const API_ROUTES_SUMMARY: {
    totalRoutes: number
    byCategory: Record<'core' | 'entity' | 'theme' | 'plugin', number>
    generatedAt: string
  }

  // A single Next.js Route Handler function for one HTTP method.
  export type RouteHandler = (
    request: import('next/server').NextRequest,
    context: { params: Promise<Record<string, string>> }
  ) => Promise<Response> | Response

  // Keyed by route key, then by HTTP method.
  export const THEME_ROUTE_HANDLERS: Record<string, Record<string, RouteHandler>>
  export const PLUGIN_ROUTE_HANDLERS: Record<string, Record<string, RouteHandler>>
}

// ============================================================================
// Docs Registry
//
// DocPageMeta / DocSectionMeta / DocsRegistryStructure are real, hand-written
// types in packages/core/src/types/docs.ts — this module only supplies the
// runtime values and query functions the generator produces.
// ============================================================================
declare module '@nextsparkjs/registries/docs-registry' {
  // Inlined instead of imported (see permissions-registry above for why) —
  // kept structurally compatible with src/types/docs.ts.
  export interface DocPageMeta {
    slug: string
    title: string
    order: number
    path: string
    source: 'public' | 'superadmin'
  }

  export interface DocSectionMeta {
    title: string
    slug: string
    order: number
    pages: DocPageMeta[]
    source: 'public' | 'superadmin'
  }

  export interface DocsRegistryStructure {
    public: DocSectionMeta[]
    superadmin: DocSectionMeta[]
    all: DocSectionMeta[]
  }

  export const DOCS_REGISTRY: DocsRegistryStructure

  export function getAllDocSections(): DocSectionMeta[]
  export function getPublicDocSections(): DocSectionMeta[]
  export function getSuperadminDocSections(): DocSectionMeta[]
  export function findDocSection(slug: string): DocSectionMeta | undefined
  export function findDocSectionInCategory(
    slug: string,
    category: 'public' | 'superadmin'
  ): DocSectionMeta | undefined
  export function findDocPage(sectionSlug: string, pageSlug: string): DocPageMeta | undefined
}

// ============================================================================
// API Docs Registry
// ============================================================================
declare module '@nextsparkjs/registries/api-docs-registry' {
  // Mirrors packages/core/src/types/api-presets.ts's ApiDocEntry /
  // ApiDocsRegistryStructure exactly (not imported — see permissions-registry
  // above for why): devtools components type-annotate against that
  // hand-written file directly, not against this registry module.
  export type ApiPresetSource = 'entity' | 'route' | 'core'

  export interface ApiDocEntry {
    path: string
    title: string
    endpoint: string
    source?: ApiPresetSource
  }

  export const API_DOCS_REGISTRY: {
    docs: Record<string, ApiDocEntry>
    meta: { totalDocs: number; generatedAt: string; themeName: string }
  }

  export function getDocForEndpoint(endpoint: string): ApiDocEntry | undefined
  export function hasDoc(endpoint: string): boolean
  export function getAllDocEndpoints(): string[]
}

// ============================================================================
// API Presets Registry
// ============================================================================
declare module '@nextsparkjs/registries/api-presets-registry' {
  // Mirrors packages/core/src/types/api-presets.ts's ApiPreset /
  // ApiEndpointPresets / ApiPresetsRegistryStructure exactly (not imported —
  // see permissions-registry above for why).
  export type ApiPresetSource = 'entity' | 'route' | 'core'

  export interface PresetSessionConfig {
    crossTeam?: boolean
    teamId?: string
    authType?: 'session' | 'apiKey'
  }

  export interface ApiPreset {
    id: string
    title: string
    description?: string
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'OPTIONS'
    path?: string
    pathParams?: Record<string, string>
    params?: Record<string, string | number | boolean>
    queryParams?: Record<string, string | number | boolean>
    headers?: Record<string, string>
    payload?: Record<string, unknown>
    sessionConfig?: PresetSessionConfig
    tags?: string[]
  }

  export interface ApiEndpointPresets {
    endpoint?: string
    summary?: string
    presets: ApiPreset[]
    sourcePath?: string
    source?: ApiPresetSource
  }

  export const API_PRESETS_REGISTRY: {
    endpoints: Record<string, ApiEndpointPresets>
    meta: { totalEndpoints: number; totalPresets: number; generatedAt: string; themeName: string }
  }

  export function getPresetsForEndpoint(endpoint: string): ApiEndpointPresets | undefined
  export function getPresetsByMethod(endpoint: string, method: string): ApiPreset[]
  export function getAllPresets(): ApiEndpointPresets[]
  export function hasPresets(endpoint: string): boolean
}

// ============================================================================
// Email Registry
//
// Keyed by slug ('verify-email', 'reset-password', 'otp-verification',
// 'team-invitation', plus any consumer-defined slugs). Callers index with a
// known literal and pass their own typed `data`, so `any` here is the
// correct (and only sound) parameter type for the shared function shape.
// ============================================================================
declare module '@nextsparkjs/registries/email-registry' {
  // Mirrors packages/core/src/lib/email/types.ts's EmailContent — callers
  // in lib/email/send.ts type-check the result against that hand-written
  // type, so `unknown` here would make every call site fail.
  export interface EmailContent {
    subject: string
    html: string
    text?: string
  }

  export const EMAIL_REGISTRY: Record<
    string,
    (data: any, locale?: string) => EmailContent | Promise<EmailContent>
  >
}

// ============================================================================
// Middleware Registry
// ============================================================================
declare module '@nextsparkjs/registries/middleware-registry' {
  // Inline `import(...)` type queries instead of file-level `import type`
  // (see permissions-registry above for why) — next/server is a real,
  // stable package so referencing its types this way is exact, not a
  // structural approximation like the other inlined modules.
  export type ThemeName = string

  export interface MiddlewareRegistryEntry {
    exists: boolean
    middleware: (
      request: import('next/server').NextRequest,
      // `any`, not a shallow shape: SessionUser is a complex better-auth
      // inferred type ($Infer.Session.user & extra fields) core can't
      // reproduce structurally here without importing it.
      user?: any
    ) => Promise<import('next/server').NextResponse | null>
  }

  export const MIDDLEWARE_REGISTRY: Record<string, MiddlewareRegistryEntry>
  export const MIDDLEWARE_METADATA: {
    generatedAt: string
    middlewareCount: number
  }
}

// ============================================================================
// Namespace Registry
//
// Real export is NAMESPACE_CONFIG (singular config object), not
// NAMESPACE_REGISTRY like the old ambient declaration had.
// ============================================================================
declare module '@nextsparkjs/registries/namespace-registry' {
  export interface RouteNamespaceConfig {
    core: string[]
    entities: string[]
    strategy: string
  }

  export interface NamespaceConfig {
    core: string[]
    entities: string[]
    routes: Record<string, RouteNamespaceConfig>
    entityPaths: string[]
  }

  export const NAMESPACE_CONFIG: NamespaceConfig
}

// ============================================================================
// Scope Registry
//
// Real exports are SCOPE_CONFIG / API_CONFIG, not SCOPE_REGISTRY like the
// old ambient declaration had.
// ============================================================================
declare module '@nextsparkjs/registries/scope-registry' {
  // SCOPE_CONFIG/API_CONFIG are each a single fixed-shape object, not maps
  // keyed by scope name.
  export interface ScopeConfig {
    base: string[]
    roles: Record<string, string[]>
    flags: Record<string, string[]>
    restrictions: Record<string, { remove?: string[]; allow_only?: string[] }>
  }

  export interface ApiConfig {
    filters: { allowed: string[] }
    entityPaths: string[]
  }

  export const SCOPE_CONFIG: ScopeConfig
  export const API_CONFIG: ApiConfig
}

// ============================================================================
// Scheduled Actions Registry
//
// Keyed by theme name, not a flat array like the old ambient declaration
// had — each entry exposes registerAllHandlers() (initializer.ts).
// ============================================================================
declare module '@nextsparkjs/registries/scheduled-actions-registry' {
  export interface ScheduledActionsModule {
    registerAllHandlers: () => void
    registerRecurringActions: () => Promise<void>
  }

  export const SCHEDULED_ACTIONS_REGISTRY: Record<string, ScheduledActionsModule | undefined>
}
