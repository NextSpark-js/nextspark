/**
 * Core Entities
 *
 * Exports all core entity configurations, services, and types.
 * These entities are fundamental to the NextSpark framework.
 */

// Patterns Entity
export {
  patternsEntityConfig,
  patternsFields,
  isPatternReference,
  PatternsService
} from './patterns'

export type {
  Pattern,
  PatternStatus,
  CreatePatternInput,
  UpdatePatternInput,
  PatternReference,
  PatternListOptions,
  PatternListResult
} from './patterns'
