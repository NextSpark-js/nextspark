/**
 * Core Configuration System
 *
 * Re-export all core configuration types and utilities.
 * This provides the foundational configuration system without project-specific values.
 */

// Types and interfaces
export type * from './config-types'
export type * from './dashboard-types'

// Utility functions
export * from './config-utils'

// Core configuration loader
export * from './config-loader'

// Synchronous configuration access (for types and constants)
export * from './config-sync'

// NPM Distribution configuration (nextspark.config.ts)
export { defineConfig } from './nextspark-types'
export type { NextSparkConfig } from './nextspark-types'

// NOTE: loadConfig is now in core/scripts/build/config-loader.mjs
// It's a build-time utility (uses dynamic imports), not a runtime export
// Import it directly from the build scripts directory if needed
