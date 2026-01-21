/**
 * Patterns Entity Exports
 *
 * Core entity for reusable block compositions in the builder system.
 */

// Configuration
export { patternsEntityConfig } from './patterns.config'

// Fields
export { patternsFields } from './patterns.fields'

// Types
export type {
  Pattern,
  PatternStatus,
  CreatePatternInput,
  UpdatePatternInput,
  PatternReference,
  PatternListOptions,
  PatternListResult
} from './patterns.types'

export { isPatternReference } from './patterns.types'

// Service
export { PatternsService } from './patterns.service'
