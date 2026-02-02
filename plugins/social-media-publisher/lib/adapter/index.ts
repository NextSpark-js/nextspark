/**
 * Social Media Publisher Plugin - Adapter Exports
 *
 * This module exports everything themes need to integrate
 * with the social-media-publisher plugin.
 *
 * Usage:
 * ```typescript
 * import {
 *   SocialPlatformAdapter,
 *   registerSocialPlatformAdapter,
 *   type AssignmentData
 * } from '@/plugins/social-media-publisher/lib/adapter'
 * ```
 */

// Abstract adapter class for themes to extend
export { SocialPlatformAdapter } from './abstract-adapter'

// Registry functions
export {
  registerSocialPlatformAdapter,
  getSocialPlatformAdapter,
  getAdapter,
  hasAdapter,
  ensureAdapter,
  clearAdapter,
  getAdapterInfo
} from './registry'

// Type exports
export type {
  SocialPlatformAdapterConfig,
  AssignmentData,
  SocialPlatformAssignment,
  EntityAccessResult,
  SaveAssignmentResult,
  AccountLookupResult
} from '../../types/adapter.types'
