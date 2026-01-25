/**
 * Core Utilities
 *
 * Re-export utility functions for convenience
 */

// Re-export cn utility (explicit .js extension to avoid folder/file conflict)
export { cn } from '../utils.js'

// CORS configuration helper
export { getCorsOrigins, normalizeCorsEnvironment, normalizeOrigin, type CorsEnvironment } from './cors'

// Config merge utilities
export * from './config-merge'
