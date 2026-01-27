// Main entry point for @nextsparkjs/core
// This file re-exports commonly used utilities, types, and components

// Utilities
export { cn } from './lib/utils'

// Types
export type * from './types'

// Hooks
export * from './hooks'

// Contexts
export * from './contexts'

// Providers
export * from './providers'

// API Authentication (commonly used in API routes)
export { authenticateRequest } from './lib/api/auth/dual-auth'
export type { DualAuthResult } from './lib/api/auth/dual-auth'

// Security utilities (commonly used for input sanitization)
export {
  sanitizeUserInput,
  sanitizeRefinementInstruction,
  sanitizeContentInput
} from './lib/security/input-sanitizer'

// UI Components - re-exported from components/ui for convenience
export * from './components/ui'

// App Components - commonly used across themes
export { ThemeToggle } from './components/app/misc/ThemeToggle'

// Testing utilities - re-exported from @nextsparkjs/testing for convenience
export { createTestId, createCyId, sel } from '@nextsparkjs/testing'

// Test utils - commonly used in components
export { createAriaLabel } from './lib/test/utils'

// Note: For specific imports use:
// - @nextsparkjs/core/lib/auth for auth utilities
// - @nextsparkjs/core/lib/db for database utilities
// - @nextsparkjs/core/components/ui/button for individual UI components
// - @nextsparkjs/core/next for Next.js utilities
// - @nextsparkjs/core/i18n for i18n utilities
