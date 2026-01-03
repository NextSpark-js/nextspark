/**
 * Entity Configuration System Types
 * 
 * This file defines the complete type system for the WordPress-like Entity System.
 * It provides interfaces for config-driven architecture with comprehensive feature support.
 */

import type { LucideIcon } from 'lucide-react'
import type { ZodSchema } from 'zod'

// =============================================================================
// CORE ENTITY TYPES
// =============================================================================

/**
 * Plan types available in the application
 */
export type PlanType = 'free' | 'starter' | 'premium'

/**
 * User flags for granular access control
 */
export type UserFlag = 
  | 'beta_tester' 
  | 'early_adopter' 
  | 'limited_access' 
  | 'vip' 
  | 'restricted'
  | 'experimental'

/**
 * CRUD operations for permission system
 */
export type CRUDOperation = 'read' | 'create' | 'update' | 'delete'

/**
 * Core team roles (base roles)
 */
export type CoreTeamRole = 'owner' | 'admin' | 'member' | 'viewer'

/**
 * Team roles for granular permissions - supports custom roles from theme config
 */
export type TeamRole = CoreTeamRole | (string & {})

/**
 * Granular permission action configuration
 * Used for defining fine-grained permissions per entity action
 */
export interface EntityPermissionAction {
  /** Action identifier (e.g., 'create', 'read', 'publish', 'archive') */
  action: string
  /** Human-readable label for the permission */
  label: string
  /** Detailed description of what this permission allows */
  description?: string
  /** Team roles that have this permission */
  roles: TeamRole[]
  /** Whether this is a dangerous/destructive action */
  dangerous?: boolean
}

/**
 * Supported locales for translations
 */
export type SupportedLocale = 'en' | 'es'

/**
 * Translation loader function type
 */
export type TranslationLoader = () => Promise<Record<string, unknown>>

/**
 * Field types supported in entity configuration
 */
export type EntityFieldType = 
  // Basic types
  | 'text'           // Input de texto básico (antes 'string')
  | 'textarea'       // Textarea (antes 'text')
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'datetime'
  | 'email' 
  | 'url' 
  | 'json'
  
  // Selection types
  | 'select'
  | 'multiselect'
  | 'radio'          // RadioGroup component
  | 'buttongroup'    // Button group (radio con mejor estilo)
  | 'tags'           // Input con chips/tags dinámicos
  | 'combobox'       // Select con búsqueda
  
  // Media types
  | 'file'           // File upload
  | 'image'          // Image upload con preview
  | 'video'          // Video upload
  | 'audio'          // Audio upload
  
  // Specialized inputs
  | 'phone'          // Input de teléfono con validación
  | 'rating'         // Sistema de estrellas/rating
  | 'range'          // Slider para rangos numéricos
  | 'doublerange'    // Slider doble para rangos numéricos
  
  // Text editors
  | 'markdown'       // Editor de markdown
  | 'richtext'       // Editor WYSIWYG
  | 'code'           // Editor de código con syntax highlighting
  
  // Location & data selectors
  | 'timezone'       // Selector de zona horaria
  | 'currency'       // Selector de moneda
  | 'country'        // Selector de país
  | 'address'        // Input de dirección completa
  
  // Relationship types
  | 'relation'       // Relación simple con otra entidad (devuelve ID)
  | 'relation-multi' // Relación múltiple con otra entidad (devuelve array de IDs)
  | 'relation-prop'  // Relación basada en propiedad de entidad (devuelve valor de prop)
  | 'relation-prop-multi' // Relación múltiple basada en propiedad de entidad (devuelve array de valores)
  | 'reference'      // Alias for relation (foreign key reference to another entity)
  | 'user'           // Selector de usuario específico

// =============================================================================
// ENTITY CONFIGURATION INTERFACES
// =============================================================================

/**
 * Main Entity Configuration interface - REFACTORED
 * Defines complete behavior and characteristics of an entity
 *
 * NEW STRUCTURE: 5 logical sections with automatic derivations from slug
 */
export interface EntityConfig {
  // ==========================================
  // 1. BASIC IDENTIFICATION
  // ==========================================
  /** URL slug for routes, endpoints, and URLs - SINGLE SOURCE OF TRUTH */
  slug: string

  /** Whether entity is enabled/disabled completely */
  enabled: boolean

  /** Human-readable names */
  names: {
    /** Singular form (e.g., 'task') */
    singular: string
    /** Plural form (e.g., 'Tasks') */
    plural: string
  }

  /** Lucide icon for UI display */
  icon: LucideIcon

  /** Database table name (optional - defaults to slug with underscores) */
  tableName?: string

  // ==========================================
  // 2. ACCESS AND SCOPE CONFIGURATION
  // ==========================================
  access: {
    /** If accessible without authentication, requires RLS (anon can select) */
    public: boolean
    /** If has external API via API key */
    api: boolean
    /** If supports metadata system */
    metadata: boolean
    /** If shared among all authenticated users (CASE 2 RLS - no userId filter in queries) - REQUIRED since Phase 3 */
    shared: boolean
    /**
     * Base path for public URLs (builder-enabled entities only)
     * Examples: '/' for pages (renders at /[slug]), '/blog' for posts (renders at /blog/[slug])
     * Used by the catch-all route to dynamically resolve entity URLs
     */
    basePath?: string
  }

  // ==========================================
  // 3. UI/UX FEATURES
  // ==========================================
  ui: {
    dashboard: {
      /** Show in navigation menu */
      showInMenu: boolean
      /** Show in topbar quick create dropdown */
      showInTopbar: boolean
      /** Filter configurations for list view (optional) */
      filters?: EntityFilterConfig[]
    }
    public: {
      /** Has public archive/list page */
      hasArchivePage: boolean
      /** Has public single/detail page */
      hasSinglePage: boolean
    }
    features: {
      /** Include in global search */
      searchable: boolean
      /** Enable sorting functionality */
      sortable: boolean
      /** Enable filtering functionality */
      filterable: boolean
      /** Enable bulk operations */
      bulkOperations: boolean
      /** Enable import/export functionality */
      importExport: boolean
    }
  }

  // ==========================================
  // 4. PERMISSIONS SYSTEM (OPTIONAL)
  // ==========================================
  /**
   * Entity permissions - NOW OPTIONAL
   * Permissions can be defined in entity.config.ts (legacy) or centralized in
   * permissions.config.ts -> entities (recommended).
   *
   * When using centralized permissions, this property can be omitted.
   * See: contents/themes/[theme]/permissions.config.ts
   */
  permissions?: {
    /**
     * Granular permission actions (PRIMARY SYSTEM)
     * Defines which TeamRoles can perform each action on this entity.
     * Standard actions: create, read, list, update, delete
     */
    actions: EntityPermissionAction[]
    /**
     * Custom actions specific to this entity
     * Examples: publish, archive, assign, convert, complete
     */
    customActions?: EntityPermissionAction[]
  }

  // ==========================================
  // 5. INTERNATIONALIZATION
  // ==========================================
  i18n: {
    /** Default fallback locale */
    fallbackLocale: SupportedLocale
    /** Translation loaders for each supported locale */
    loaders: Record<SupportedLocale, TranslationLoader>
  }

  // ==========================================
  // FIELDS (imported from separate file)
  // ==========================================
  /** Entity field definitions */
  fields: EntityField[]

  // ==========================================
  // BACKWARD COMPATIBILITY & METADATA
  // ==========================================
  /** Core entity flag - true for system fundamental entities that cannot be overridden */
  isCore?: boolean
  /** Entity origin - tracks where the entity was defined */
  source?: 'core' | 'theme' | 'plugin'
  /** Child entities configuration (optional) */
  childEntities?: ChildEntityConfig

  /** ID generation strategy configuration */
  idStrategy?: {
    /** Type of ID: 'uuid' (default) or 'serial' (auto-increment integer) */
    type: 'uuid' | 'serial'
    /** Whether to auto-generate ID (default: true) */
    autoGenerate?: boolean
  }

  // ==========================================
  // 6. BUILDER CONFIGURATION (Page Builder Support)
  // ==========================================
  /** Page builder configuration (optional) */
  builder?: BuilderConfig

  // ==========================================
  // 7. TAXONOMIES CONFIGURATION (Generic Categorization)
  // ==========================================
  /** Taxonomies configuration (optional) */
  taxonomies?: TaxonomiesConfig

  // ==========================================
  // AUTOMATIC SYSTEM DERIVATIONS
  // ==========================================
  // The following properties are automatically derived from the slug:
  // - tableName: slug (e.g., 'tasks')
  // - metaTableName: slug + '_metas' (e.g., 'tasks_metas')
  // - apiPath: '/api/v1/' + slug (e.g., '/api/v1/tasks')
  // - i18nNamespace: slug (e.g., 'tasks')
  // - foreignKey in metadata: 'entityId' (generic for all entities)
}

// =============================================================================
// BUILDER CONFIGURATION (Page Builder Support)
// =============================================================================

/**
 * Builder configuration for entities with page builder support
 * Enables WordPress/Webflow-style block editing
 *
 * When builder.enabled is true:
 * - Dashboard renders BuilderEditorView instead of EntityFormView
 * - Entity must have required fields: title, slug, status
 * - The 'blocks' field is managed by the builder view (JSONB in DB, not in fields[])
 */
export interface BuilderConfig {
  /** Enable page builder for this entity */
  enabled: boolean

  /**
   * Fields to show in sidebar while editing
   * These are regular entity fields that appear alongside the block editor
   * Examples: 'excerpt', 'featuredImage', 'categories'
   */
  sidebarFields?: string[]

  /**
   * @deprecated Use access.basePath instead. Will be removed in v2.0.
   * Public route configuration
   */
  public?: {
    /**
     * @deprecated Use access.basePath instead. Will be removed in v2.0.
     * Base path for public URLs
     * Examples: '/' for pages (renders at /[slug]), '/blog' for posts (renders at /blog/[slug])
     */
    basePath: string
  }

  /** Enable SEO fields panel in editor */
  seo?: boolean
}

// =============================================================================
// TAXONOMIES CONFIGURATION (Generic Categorization)
// =============================================================================

/**
 * Taxonomy type definition for an entity
 * Defines how taxonomies are associated with an entity
 */
export interface TaxonomyTypeConfig {
  /** Taxonomy type identifier (e.g., 'post_category', 'tag') */
  type: string

  /** Field name in the entity form (e.g., 'categories', 'tags') */
  field: string

  /** Allow multiple selections */
  multiple: boolean

  /** Display label in UI */
  label?: string
}

/**
 * Taxonomies configuration for entities
 * Enables generic categorization system using entity_taxonomy_relations table
 */
export interface TaxonomiesConfig {
  /** Enable taxonomies for this entity */
  enabled: boolean

  /** Taxonomy types associated with this entity */
  types: TaxonomyTypeConfig[]
}

/**
 * Entity features and capabilities configuration
 */
export interface EntityFeatures {
  /** Whether entity is enabled/disabled completely */
  enabled: boolean
  
  /** Show in navigation menu */
  showInMenu: boolean
  
  /** Include in global search */
  searchable: boolean
  
  /** Allow search operations */
  allowSearch: boolean
  
  /** Generate external API endpoints */
  hasExternalAPI: boolean
  
  /** Support metadata system */
  supportsMetas: boolean
  
  /** Enable sorting functionality */
  sortable: boolean
  
  /** Enable filtering functionality */
  filterable: boolean
  
  /** Enable bulk operations */
  supportsBulkOperations: boolean
  
  /** Enable import/export functionality */
  supportsImportExport: boolean
  
  /** Show in topbar quick create dropdown */
  showInTopbar?: boolean
  
  /** Allow creating new records */
  canCreate?: boolean
  
  /** Allow editing existing records */
  canEdit?: boolean
  
  /** Allow deleting records */
  canDelete?: boolean
}

/**
 * Entity field definition
 */
export interface EntityField {
  /** Field name (database column) */
  name: string

  /** Field data type */
  type: EntityFieldType

  /** Whether field is required */
  required: boolean

  /** Default value (optional) */
  defaultValue?: unknown

  /** Validation schema (optional) */
  validation?: ZodSchema

  /** Display configuration */
  display: FieldDisplay

  /** API configuration */
  api: FieldAPI

  /** Options for select/multiselect fields */
  options?: FieldOption[]

  /** Referenced entity slug (shorthand for relation.entity, used with type: 'reference') */
  referenceEntity?: string

  /** Relation configuration (for relation and relation-multi fields) */
  relation?: {
    /** Entity type for the relation */
    entity: string
    /** Field to use as title/label from the related entity (required for relation/relation-multi) */
    titleField?: string
    /** Parent field name for child entity relations (e.g., 'clientId') */
    parentId?: string
    /** Property to select from the related entity (for relation-prop fields) */
    prop?: string
    /** Value-label mapping for dynamic options (for relation-prop fields) */
    options?: FieldOption[]
    /** Filter results by current user (default: true for most entities) */
    userFiltered?: boolean
  }
}

/**
 * Field display configuration
 */
export interface FieldDisplay {
  /** Display label */
  label: string
  
  /** Help text/description */
  description?: string
  
  /** Placeholder text */
  placeholder?: string
  
  /** Show in list view */
  showInList: boolean
  
  /** Show in detail view */
  showInDetail: boolean
  
  /** Show in form */
  showInForm: boolean
  
  /** Field order in forms */
  order: number
  
  /** Column width in lists (1-12 scale) */
  columnWidth?: number
  
  /** Custom CSS classes */
  className?: string
}

/**
 * Field API configuration
 */
export interface FieldAPI {
  /** Include in search queries */
  searchable: boolean

  /** Allow sorting by this field */
  sortable: boolean

  /** Allow filtering by this field */
  filterable?: boolean

  /** Field is read-only via API */
  readOnly: boolean
}

/**
 * Field option for select/multiselect fields
 */
export interface FieldOption {
  /** Option value */
  value: string | number
  
  /** Display label */
  label: string
  
  /** Option description */
  description?: string
  
  /** Option is disabled */
  disabled?: boolean
  
  /** Option color/variant */
  color?: string
}

/**
 * Entity permissions configuration
 */
export interface EntityPermissions {
  /** Roles that can read/view the entity */
  read: TeamRole[]

  /** Roles that can create new records */
  create: TeamRole[]

  /** Roles that can update existing records */
  update: TeamRole[]

  /** Roles that can delete records */
  delete: TeamRole[]
}

/**
 * Entity plan limits configuration
 */
export interface EntityPlanLimits {
  /** Plans that can access this entity */
  availableInPlans: PlanType[]
  
  /** Specific limits per plan */
  limits: PlanLimits
}

/**
 * Limits configuration per plan
 */
export interface PlanLimits {
  free?: EntityLimits
  starter?: EntityLimits
  premium?: EntityLimits
}

/**
 * Specific limits for an entity
 */
export interface EntityLimits {
  /** Maximum number of records */
  maxRecords: number | 'unlimited'
  
  /** Maximum storage in MB (for file uploads) */
  maxStorage?: number | 'unlimited'
  
  /** Maximum API calls per month */
  maxApiCalls?: number | 'unlimited'
  
  /** Available features for this plan */
  features?: string[] | ['*'] // '*' means all features
}

/**
 * Entity flag access configuration
 */
export interface EntityFlagAccess {
  /** Flags that grant additional access */
  availableInFlags?: UserFlag[]
  
  /** Flags that block access */
  excludedFlags?: UserFlag[]
  
  /** Specific limits override per flag */
  flagLimits?: FlagBasedLimits
}

/**
 * Flag-based limits override
 */
export interface FlagBasedLimits {
  [flagName: string]: EntityLimits
}

// =============================================================================
// CHILD ENTITY SYSTEM
// =============================================================================

/**
 * Child entities configuration
 */
export interface ChildEntityConfig {
  [childName: string]: ChildEntityDefinition
}

/**
 * Child entity definition
 */
export interface ChildEntityDefinition {
  /** Database table name */
  table: string

  /** Child entity fields */
  fields: ChildEntityField[]

  /** Show in parent view */
  showInParentView: boolean

  /** Has independent routes */
  hasOwnRoutes: boolean

  /** Independent permissions (optional) */
  permissions?: EntityPermissions

  /** Child-specific hooks */
  hooks?: ChildEntityHooks

  /** Display configuration */
  display: ChildEntityDisplay

  /** ID generation strategy configuration */
  idStrategy?: {
    /** Type of ID: 'uuid' (default) or 'serial' (auto-increment integer) */
    type: 'uuid' | 'serial'
    /** Whether to auto-generate ID (default: true) */
    autoGenerate?: boolean
  }
}

/**
 * Child entity field definition
 */
export interface ChildEntityField {
  /** Field name */
  name: string
  
  /** Field type */
  type: EntityFieldType
  
  /** Required field */
  required: boolean
  
  /** Default value */
  defaultValue?: unknown
  
  /** Validation schema */
  validation?: ZodSchema
  
  /** Options for select/multiselect fields */
  options?: FieldOption[]
  
  /** Display configuration */
  display?: FieldDisplay
}

/**
 * Child entity display configuration
 */
export interface ChildEntityDisplay {
  /** Section title in parent view */
  title: string
  
  /** Section description */
  description?: string
  
  /** Display mode (table, cards, list) */
  mode: 'table' | 'cards' | 'list'
}

// =============================================================================
// ROUTES AND HOOKS
// =============================================================================

/**
 * Entity routes configuration
 */
export interface EntityRoutes {
  /** List/archive page route */
  list: string
  
  /** Detail/single page route */
  detail: string
  
  /** Create page route (optional) */
  create?: string
  
  /** Edit page route (optional) */
  edit?: string
}

/**
 * Entity lifecycle hooks
 */
export interface EntityHooks {
  /** Before creating entity */
  beforeCreate?: HookFunction[]
  
  /** After creating entity */
  afterCreate?: HookFunction[]
  
  /** Before updating entity */
  beforeUpdate?: HookFunction[]
  
  /** After updating entity */
  afterUpdate?: HookFunction[]
  
  /** Before deleting entity */
  beforeDelete?: HookFunction[]
  
  /** After deleting entity */
  afterDelete?: HookFunction[]
  
  /** Before querying entities */
  beforeQuery?: HookFunction[]
  
  /** After querying entities */
  afterQuery?: HookFunction[]
  
  /** When plan limit is reached */
  onPlanLimitReached?: HookFunction[]
  
  /** When plan upgrade is required */
  onPlanUpgradeRequired?: HookFunction[]
  
  /** On flag conflict */
  onFlagConflict?: HookFunction[]
  
  /** When flag grants access */
  onFlagAccessGranted?: HookFunction[]
  
  /** When flag denies access */
  onFlagAccessDenied?: HookFunction[]
  
  /** Before creating child entity */
  beforeChildCreate?: HookFunction[]
  
  /** After creating child entity */
  afterChildCreate?: HookFunction[]
  
  /** Before updating child entity */
  beforeChildUpdate?: HookFunction[]
  
  /** After updating child entity */
  afterChildUpdate?: HookFunction[]
  
  /** Before deleting child entity */
  beforeChildDelete?: HookFunction[]
  
  /** After deleting child entity */
  afterChildDelete?: HookFunction[]
  
  /** During child entity validation */
  onChildValidation?: HookFunction[]
}

/**
 * Child entity specific hooks
 */
export interface ChildEntityHooks {
  /** Before child creation */
  beforeChildCreate?: HookFunction[]
  
  /** After child creation */
  afterChildCreate?: HookFunction[]
  
  /** Before child update */
  beforeChildUpdate?: HookFunction[]
  
  /** After child update */
  afterChildUpdate?: HookFunction[]
  
  /** Before child deletion */
  beforeChildDelete?: HookFunction[]
  
  /** After child deletion */
  afterChildDelete?: HookFunction[]
  
  /** During child validation */
  onChildValidation?: HookFunction[]
}

/**
 * Hook function signature
 */
export type HookFunction = (context: HookContext) => Promise<void | HookResult>

/**
 * Hook execution context
 */
export interface HookContext {
  /** Entity name */
  entityName: string
  
  /** Operation being performed */
  operation: CRUDOperation | 'query'
  
  /** Data being processed */
  data?: unknown
  
  /** Previous data (for updates) */
  previousData?: unknown
  
  /** User performing the operation */
  user: {
    id: string
    role: TeamRole  // TeamRole for entity operations (owner, admin, member, viewer)
    flags?: UserFlag[]
    plan?: PlanType
  }
  
  /** Request metadata */
  meta?: Record<string, unknown>
  
  /** Child entity context (if applicable) */
  childContext?: {
    childName: string
    parentId: string
  }
}

/**
 * Hook execution result
 */
export interface HookResult {
  /** Continue with operation */
  continue: boolean
  
  /** Modified data (for before hooks) */
  data?: unknown
  
  /** Error message (if operation should stop) */
  error?: string
  
  /** Additional metadata */
  meta?: Record<string, unknown>
}

// =============================================================================
// DATABASE AND API CONFIGURATION
// =============================================================================

/**
 * Entity database configuration
 */
export interface EntityDatabaseConfig {
  /** Main table name */
  tableName: string
  
  /** Primary key field name */
  primaryKey: string
  
  /** Enable timestamps (created_at, updated_at) */
  timestamps: boolean
  
  /** Soft delete enabled */
  softDelete: boolean
  
  /** Meta table name (if supportsMetas is true) */
  metaTableName?: string
  
  /** ID column name in meta table */
  idColumn?: string
  
  /** Enable Row Level Security */
  enableRLS?: boolean
  
  /** Custom indexes */
  indexes?: string[]
}

/**
 * Entity API configuration
 */
export interface EntityAPIConfig {
  /** API path base (e.g., 'users', 'tasks') - Optional, defaults to 'v1/{slug}' */
  apiPath?: string

  /** API enabled */
  enabled: boolean

  /** Rate limiting configuration */
  rateLimit?: {
    requests: number
    windowMs: number
  }
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Entity configuration validation result
 */
export interface EntityConfigValidation {
  /** Validation successful */
  valid: boolean
  
  /** Validation errors */
  errors: string[]
  
  /** Validation warnings */
  warnings: string[]
}

/**
 * Entity access result
 */
export interface EntityAccessResult {
  /** Access granted */
  allowed: boolean
  
  /** Reason for denial (if access denied) */
  reason?: string
  
  /** Effective limits for the user */
  limits?: EntityLimits
  
  /** Available features */
  features?: string[]
}

/**
 * Entity usage statistics
 */
export interface EntityUsageStats {
  /** Current record count */
  currentRecords: number
  
  /** Storage used in MB */
  storageUsed?: number
  
  /** API calls this month */
  apiCalls?: number
  
  /** Last updated */
  lastUpdated: Date
}

/**
 * Bulk operation result
 */
export interface BulkOperationResult<T = unknown> {
  /** Operation successful */
  success: boolean
  
  /** Number of records processed */
  processed: number
  
  /** Number of records failed */
  failed: number
  
  /** Processed records data */
  data: T[]
  
  /** Error details */
  errors: Array<{
    index: number
    error: string
    data?: unknown
  }>
}

// =============================================================================
// TRANSLATION TYPES
// =============================================================================

/**
 * Entity translation configuration
 */
export interface EntityTranslations {
  /** Translation loaders for each supported locale */
  loaders: Record<SupportedLocale, TranslationLoader>

  /** Default fallback locale */
  fallbackLocale?: SupportedLocale

  /** Namespace for the entity translations */
  namespace?: string
}

// =============================================================================
// FILTER CONFIGURATION
// =============================================================================

/**
 * Filter configuration for entity list views
 * Used in ui.dashboard.filters to define which fields appear as filters
 */
export interface EntityFilterConfig {
  /** Field name (must exist in entity.fields and typically have options) */
  field: string

  /** Type of filter UI */
  type: 'multiSelect' | 'singleSelect' | 'dateRange' | 'numberRange'

  /** Label override (default: field.display.label) */
  label?: string

  /** URL param override (default: field.name) */
  urlParam?: string
}