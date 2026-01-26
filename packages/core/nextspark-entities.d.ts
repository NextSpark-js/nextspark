/**
 * Ambient type declarations for @nextsparkjs/core entity configs
 *
 * These declarations provide TypeScript with type information for
 * deep imports to entity config files when DTS generation is disabled.
 *
 * NOTE: This file must NOT have any imports to work as global declarations.
 */

// EntityConfig type for reference (simplified version for ambient declarations)
interface AmbientEntityConfig {
  slug: string
  enabled: boolean
  names: {
    singular: string
    plural: string
  }
  icon?: unknown
  access?: {
    public?: boolean
    api?: boolean
    metadata?: boolean
    shared?: boolean
    basePath?: string
  }
  ui?: {
    dashboard?: {
      showInMenu?: boolean
      showInTopbar?: boolean
    }
    public?: {
      hasArchivePage?: boolean
      hasSinglePage?: boolean
    }
    features?: {
      searchable?: boolean
      sortable?: boolean
      filterable?: boolean
      bulkOperations?: boolean
    }
  }
  table?: {
    name?: string
    columns?: unknown[]
    relations?: unknown
  }
  schemas?: {
    create?: unknown
    update?: unknown
  }
  fields?: unknown[]
}

// Core entity: patterns
declare module '@nextsparkjs/core/entities/patterns/patterns.config' {
  export const patternsEntityConfig: AmbientEntityConfig
}

// Add more core entities here as needed
