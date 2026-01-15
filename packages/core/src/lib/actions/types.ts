/**
 * Types for Entity Server Actions
 *
 * These types define the interface for generic CRUD operations
 * via Server Actions in NextSpark.
 */

// ============================================
// RESULT TYPES
// ============================================

/**
 * Result wrapper for all entity actions
 * Discriminated union for type-safe success/error handling
 */
export type EntityActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

/**
 * Result wrapper for void actions (delete, etc.)
 */
export type EntityActionVoidResult =
  | { success: true }
  | { success: false; error: string }

// ============================================
// INPUT TYPES
// ============================================

/**
 * Input type for creating entities
 */
export type CreateEntityInput = Record<string, unknown>

/**
 * Input type for updating entities
 */
export type UpdateEntityInput = Record<string, unknown>

// ============================================
// LIST TYPES
// ============================================

/**
 * Options for listing entities
 */
export interface ListEntityOptions {
  /** Filter conditions */
  where?: Record<string, unknown>
  /** Field to sort by */
  orderBy?: string
  /** Sort direction */
  orderDir?: 'asc' | 'desc'
  /** Number of records to return */
  limit?: number
  /** Number of records to skip */
  offset?: number
  /** Text search query */
  search?: string
}

/**
 * Result of listing entities
 */
export interface ListEntityResult<T> {
  /** Array of entities */
  data: T[]
  /** Total count (for pagination) */
  total: number
  /** Current limit */
  limit: number
  /** Current offset */
  offset: number
}

// ============================================
// ACTION CONFIG
// ============================================

/**
 * Configuration options for actions
 * Controls revalidation and redirection behavior
 */
export interface ActionConfig {
  /** Paths to revalidate after mutation (uses revalidatePath) */
  revalidatePaths?: string[]
  /** Tags to revalidate after mutation (uses revalidateTag) */
  revalidateTags?: string[]
  /** Redirect after successful mutation */
  redirectTo?: string
}

// ============================================
// AUTH CONTEXT
// ============================================

/**
 * Authentication context for actions
 * Contains user and team information
 */
export interface ActionAuthContext {
  /** Current user ID */
  userId: string
  /** Current team ID */
  teamId: string
}

// ============================================
// BATCH OPERATION TYPES
// ============================================

/**
 * Result of batch delete operation
 */
export interface BatchDeleteResult {
  /** Number of entities deleted */
  deletedCount: number
}
