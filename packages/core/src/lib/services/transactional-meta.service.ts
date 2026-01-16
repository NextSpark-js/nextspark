/**
 * Transactional Metadata Service
 *
 * Provides atomic operations on metadata with row-level locking (FOR UPDATE).
 * Critical for financial operations, inventory, counters, or any scenario
 * where concurrent updates could cause race conditions.
 *
 * Key features:
 * - SELECT FOR UPDATE row-level locking
 * - Automatic deadlock retry with exponential backoff
 * - Lock timeout protection
 * - RLS-aware (uses app.user_id)
 * - Synchronous update functions to avoid holding locks during I/O
 *
 * Usage example:
 * ```typescript
 * const newBalance = await TransactionalMetaService.updateWithLock(
 *   'user',
 *   userId,
 *   'credits',
 *   (current: CreditBalance) => ({
 *     ...current,
 *     balance: current.balance - cost
 *   }),
 *   userId
 * )
 * ```
 */

import { Pool } from 'pg'
import { getEntityMetaConfig, EntityType } from '../../types/meta.types'
import { parseSSLConfig } from '../db'

// Use the existing pool from db.ts
const databaseUrl = process.env.DATABASE_URL!;
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: parseSSLConfig(databaseUrl),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

/**
 * Options for transactional operations
 */
export interface TransactionalOptions {
  /**
   * Lock timeout in milliseconds (default: 5000ms)
   * Prevents indefinite waiting for locks
   */
  lockTimeout?: number

  /**
   * Retry on deadlock (default: true)
   * Automatically retries when PostgreSQL detects deadlock (error code 40P01)
   */
  retryOnDeadlock?: boolean

  /**
   * Maximum retry attempts (default: 3)
   */
  maxRetries?: number

  /**
   * Initial retry delay in milliseconds (default: 100ms)
   * Uses exponential backoff: delay * (2 ^ attempt)
   */
  initialRetryDelay?: number
}

/**
 * Error thrown when a transactional operation fails
 */
export class TransactionalError extends Error {
  constructor(
    message: string,
    public code?: string,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'TransactionalError'
  }
}

/**
 * Service for atomic metadata operations with row-level locking
 */
export class TransactionalMetaService {
  private static readonly DEFAULT_OPTIONS: Required<TransactionalOptions> = {
    lockTimeout: 5000,
    retryOnDeadlock: true,
    maxRetries: 3,
    initialRetryDelay: 100,
  }

  /**
   * Update metadata with row-level lock (SELECT FOR UPDATE)
   *
   * CRITICAL: updateFn MUST be synchronous to avoid holding locks during I/O operations
   *
   * @param entityType - Entity type (e.g., 'user', 'product')
   * @param entityId - Entity ID
   * @param metaKey - Metadata key
   * @param updateFn - Synchronous function to transform current value
   * @param userId - User ID for RLS context
   * @param options - Transaction options
   * @returns Updated value
   *
   * @throws TransactionalError if update fails
   * @throws Error if updateFn is async (holds lock during I/O)
   */
  static async updateWithLock<T = unknown>(
    entityType: EntityType,
    entityId: string,
    metaKey: string,
    updateFn: (current: T | null) => T,
    userId: string,
    options: TransactionalOptions = {}
  ): Promise<T> {
    // Validate updateFn is synchronous
    if (updateFn.constructor.name === 'AsyncFunction') {
      throw new Error(
        'updateFn must be synchronous to avoid holding locks during I/O operations'
      )
    }

    const opts = { ...this.DEFAULT_OPTIONS, ...options }
    const config = getEntityMetaConfig(entityType)

    if (!config) {
      throw new TransactionalError(`Entity type '${entityType}' not configured`)
    }

    // Validate metaKey
    if (!metaKey || metaKey.trim() === '') {
      throw new TransactionalError('Meta key cannot be empty')
    }

    if (metaKey.length > 100) {
      throw new TransactionalError('Meta key too long (max 100 characters)')
    }

    let lastError: Error | null = null

    // Retry loop for deadlock handling
    for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
      const client = await pool.connect()

      try {
        // Start transaction
        await client.query('BEGIN')

        // Set RLS context - MUST match existing db.ts convention
        await client.query(
          `SET LOCAL app.user_id = '${userId.replace(/'/g, "''")}'`
        )

        // Set lock timeout to prevent indefinite waiting
        await client.query(`SET LOCAL lock_timeout = '${opts.lockTimeout}ms'`)

        // SELECT FOR UPDATE - acquires row-level lock
        const selectQuery = `
          SELECT "metaValue"
          FROM "${config.metaTableName}"
          WHERE "${config.idColumn}" = $1 AND "metaKey" = $2
          FOR UPDATE
        `

        const result = await client.query(selectQuery, [entityId, metaKey])
        const currentValue = result.rows[0]?.metaValue || null

        // Execute synchronous update function
        const newValue = updateFn(currentValue as T | null)

        // Validate JSON size (max 1MB)
        const jsonString = JSON.stringify(newValue)
        if (new TextEncoder().encode(jsonString).length > 1048576) {
          throw new TransactionalError('Meta value too large (max 1MB)')
        }

        // UPSERT with new value
        const upsertQuery = `
          INSERT INTO "${config.metaTableName}"
            ("${config.idColumn}", "metaKey", "metaValue", "dataType", "isPublic", "isSearchable")
          VALUES ($1, $2, $3::jsonb, 'json', false, false)
          ON CONFLICT ("${config.idColumn}", "metaKey")
          DO UPDATE SET
            "metaValue" = EXCLUDED."metaValue",
            "updatedAt" = CURRENT_TIMESTAMP
          RETURNING "metaValue"
        `

        const upsertResult = await client.query(upsertQuery, [
          entityId,
          metaKey,
          newValue,
        ])

        // Commit transaction and release lock
        await client.query('COMMIT')
        client.release()

        return upsertResult.rows[0].metaValue as T
      } catch (error) {
        // Rollback transaction
        await client.query('ROLLBACK')
        client.release()

        const pgError = error as { code?: string; message: string }
        lastError = pgError as Error

        // Check for deadlock (PostgreSQL error code 40P01)
        if (pgError.code === '40P01' && opts.retryOnDeadlock && attempt < opts.maxRetries) {
          console.warn(
            `Deadlock detected on attempt ${attempt}/${opts.maxRetries}, retrying...`
          )

          // Exponential backoff
          const delay = opts.initialRetryDelay * Math.pow(2, attempt - 1)
          await new Promise(resolve => setTimeout(resolve, delay))

          continue // Retry
        }

        // Check for lock timeout
        if (pgError.code === '55P03') {
          throw new TransactionalError(
            `Lock timeout after ${opts.lockTimeout}ms`,
            '55P03',
            pgError as Error
          )
        }

        // Other errors - don't retry
        throw new TransactionalError(
          `Transaction failed: ${pgError.message}`,
          pgError.code,
          pgError as Error
        )
      }
    }

    // All retries exhausted
    throw new TransactionalError(
      `Transaction failed after ${opts.maxRetries} attempts`,
      lastError?.constructor.name === 'Error' ? (lastError as any).code : undefined,
      lastError || undefined
    )
  }

  /**
   * Bulk update multiple metadata keys atomically
   *
   * @param entityType - Entity type
   * @param entityId - Entity ID
   * @param updates - Object with metaKey: updateFn pairs
   * @param userId - User ID for RLS context
   * @param options - Transaction options
   * @returns Object with updated values
   */
  static async bulkUpdateWithLock<T extends Record<string, unknown>>(
    entityType: EntityType,
    entityId: string,
    updates: Record<string, (current: unknown) => unknown>,
    userId: string,
    options: TransactionalOptions = {}
  ): Promise<T> {
    const results: Record<string, unknown> = {}

    // Execute all updates sequentially within the same retry context
    for (const [metaKey, updateFn] of Object.entries(updates)) {
      results[metaKey] = await this.updateWithLock(
        entityType,
        entityId,
        metaKey,
        updateFn,
        userId,
        options
      )
    }

    return results as T
  }

  /**
   * Delete metadata with lock
   *
   * @param entityType - Entity type
   * @param entityId - Entity ID
   * @param metaKey - Metadata key to delete
   * @param userId - User ID for RLS context
   * @returns true if deleted, false if not found
   */
  static async deleteWithLock(
    entityType: EntityType,
    entityId: string,
    metaKey: string,
    userId: string
  ): Promise<boolean> {
    const config = getEntityMetaConfig(entityType)

    if (!config) {
      throw new TransactionalError(`Entity type '${entityType}' not configured`)
    }

    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      // Set RLS context - MUST match existing db.ts convention
      await client.query(
        `SET LOCAL app.user_id = '${userId.replace(/'/g, "''")}'`
      )

      // DELETE with RETURNING to check if row existed
      const deleteQuery = `
        DELETE FROM "${config.metaTableName}"
        WHERE "${config.idColumn}" = $1 AND "metaKey" = $2
        RETURNING "metaKey"
      `

      const result = await client.query(deleteQuery, [entityId, metaKey])

      await client.query('COMMIT')
      client.release()

      return (result.rowCount || 0) > 0
    } catch (error) {
      await client.query('ROLLBACK')
      client.release()

      const pgError = error as { code?: string; message: string }
      throw new TransactionalError(
        `Delete failed: ${pgError.message}`,
        pgError.code,
        pgError as Error
      )
    }
  }
}
