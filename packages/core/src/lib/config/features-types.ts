/**
 * Feature & Flow Configuration Types
 *
 * Types for defining application features and user flows/journeys.
 * These are used to generate the feature-registry at build time.
 */

// =============================================================================
// FEATURE TYPES
// =============================================================================

/**
 * Feature categories for organization
 */
export type FeatureCategory =
  | 'core'       // Core platform features (auth, teams, settings)
  | 'entities'   // Entity CRUD features
  | 'content'    // Content management features (page builder, blocks)
  | 'settings'   // User/team settings features
  | 'admin'      // Admin/superadmin features

/**
 * Feature definition in configuration
 */
export interface FeatureDefinition {
  /** Display name of the feature */
  name: string

  /** Brief description of what the feature does */
  description: string

  /** Category for grouping features */
  category: FeatureCategory

  /** Icon name (lucide icon) */
  icon?: string

  /**
   * Related entity slugs
   * Will be enriched with entity metadata from entity-registry
   */
  entities?: string[]

  /**
   * Related permission patterns (glob supported)
   * Examples: 'customers.*', 'pages.create', 'blocks.*'
   */
  permissions?: string[]

  /**
   * Related documentation paths (glob supported)
   * Examples: '06-authentication/*', '04-entities/customers.md'
   */
  docs?: string[]
}

/**
 * Features configuration map
 * Key is the feature slug (used to generate @feat-{slug} tag)
 */
export type FeaturesConfig = Record<string, FeatureDefinition>

// =============================================================================
// FLOW TYPES
// =============================================================================

/**
 * Flow categories for organization
 */
export type FlowCategory =
  | 'acquisition'  // User acquisition flows (onboarding, signup)
  | 'navigation'   // Navigation flows (team switch, context change)
  | 'content'      // Content creation flows (publish, edit)
  | 'admin'        // Administrative flows
  | 'settings'     // Settings/configuration flows

/**
 * A step in a user flow/journey
 */
export interface FlowStep {
  /** Feature this step belongs to */
  feature: string

  /** Action within the feature */
  action: string

  /** Human-readable description of this step */
  description: string

  /** Optional: marks this step as optional in the flow */
  optional?: boolean
}

/**
 * Flow/Journey definition in configuration
 */
export interface FlowDefinition {
  /** Display name of the flow */
  name: string

  /** Brief description of the user journey */
  description: string

  /** Category for grouping flows */
  category: FlowCategory

  /** Icon name (lucide icon) */
  icon?: string

  /**
   * Steps that compose this flow
   * Order matters - represents the journey sequence
   */
  steps: FlowStep[]

  /**
   * Features involved in this flow
   * Can be auto-derived from steps, but can also be explicit
   */
  features?: string[]

  /**
   * Marks this flow as critical path
   * Critical flows should have smoke tests
   */
  criticalPath?: boolean
}

/**
 * Flows configuration map
 * Key is the flow slug (used to generate @flow-{slug} tag)
 */
export type FlowsConfig = Record<string, FlowDefinition>

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Type-safe helper to define features configuration
 */
export function defineFeatures<T extends FeaturesConfig>(config: T): T {
  return config
}

/**
 * Type-safe helper to define flows configuration
 */
export function defineFlows<T extends FlowsConfig>(config: T): T {
  return config
}
