import { Pool, type PoolClient } from 'pg';
import { isValidUUID } from './api/helpers';

// Track active connections for graceful shutdown
let activeConnections = 0;
let isShuttingDown = false;
let shutdownPromise: Promise<void> | null = null;

/**
 * Strip SSL-related parameters from DATABASE_URL to prevent pg-connection-string
 * from overriding our explicit ssl config.
 *
 * pg v8+ treats sslmode=require as verify-full internally, which breaks connections
 * to providers like Supabase that use self-signed certs in the chain.
 * By removing sslmode from the connection string and handling it via the explicit
 * `ssl` Pool option, we maintain full control over SSL behavior.
 */
export function stripSSLParams(databaseUrl: string): string {
  if (!databaseUrl) return databaseUrl;
  try {
    const url = new URL(databaseUrl);
    url.searchParams.delete('sslmode');
    url.searchParams.delete('uselibpqcompat');
    return url.toString();
  } catch {
    // Fallback: regex strip if URL parsing fails
    return databaseUrl
      .replace(/[?&]sslmode=[^&]*/g, '')
      .replace(/[?&]uselibpqcompat=[^&]*/g, '')
      .replace(/\?&/, '?')
      .replace(/\?$/, '');
  }
}

/**
 * Parse SSL mode from DATABASE_URL using proper URL parameter parsing
 * Supports: disable, allow, prefer, require, verify-ca, verify-full
 *
 * Security behavior:
 * - Production: Defaults to rejectUnauthorized: true (validates certificates)
 * - Development: Defaults to no SSL (localhost doesn't need it)
 * - Explicit sslmode in URL always takes precedence
 */
export function parseSSLConfig(databaseUrl: string): false | { rejectUnauthorized: boolean } {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!databaseUrl) {
    // No URL: production requires SSL with validation, dev doesn't need SSL
    return isProduction ? { rejectUnauthorized: true } : false;
  }

  try {
    // Parse URL to extract query parameters
    const url = new URL(databaseUrl);
    // Normalize sslmode: trim whitespace and convert to lowercase for robustness
    const sslmode = url.searchParams.get('sslmode')?.trim().toLowerCase();

    // Explicit sslmode in URL takes precedence
    if (sslmode) {
      switch (sslmode) {
        case 'disable':
          if (isProduction) {
            console.warn('[DB] WARNING: SSL disabled in production environment. This is insecure!');
          }
          return false;
        case 'require':
        case 'prefer':
        case 'allow':
          // These modes use SSL but don't validate certificates
          return { rejectUnauthorized: false };
        case 'verify-ca':
        case 'verify-full':
          // These modes require certificate validation
          return { rejectUnauthorized: true };
        default:
          // Unknown sslmode value - log warning and fall through to environment defaults
          console.warn(`[DB] Unknown sslmode value: "${sslmode}". Using environment defaults.`);
      }
    }

    // No explicit sslmode: use environment-based defaults
    // Production: SSL enabled with certificate validation
    // Development: No SSL needed for localhost
    return isProduction ? { rejectUnauthorized: true } : false;
  } catch {
    // If URL parsing fails, fall back to simple check
    if (databaseUrl.includes('sslmode=disable')) {
      return false;
    }
    // Production requires secure defaults even on parse failure
    return isProduction ? { rejectUnauthorized: true } : false;
  }
}

const databaseUrl = process.env.DATABASE_URL || '';
const sslConfig = parseSSLConfig(databaseUrl);

// Create a connection pool
// Strip sslmode from connectionString to prevent pg-connection-string from
// overriding our explicit ssl config (pg v8+ treats require as verify-full)
const pool = new Pool({
  connectionString: stripSSLParams(databaseUrl),
  ssl: sslConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

/**
 * Service connection pool (RLS bypass for system operations).
 *
 * After the runtime cutover the app connects DATABASE_URL as the non-owner role
 * `nextspark_app` (RLS evaluated). System operations that legitimately run
 * WITHOUT a user context — Better Auth login/verification, the in-request
 * scheduler, the scheduled-actions processor, payment-provider webhooks, the
 * superadmin/developer bypass check, and the privileged team/subscription
 * bootstrap — must run on a connection that bypasses RLS. That connection is
 * chosen by CREDENTIAL (DATABASE_SERVICE_URL), never by a GUC derivable from
 * request input: on Supabase the `service_role` connection string (BYPASSRLS of
 * factory); on self-hosted Postgres a dedicated owner/bypass role.
 *
 * Backward-compatible: if DATABASE_SERVICE_URL is unset it falls back to
 * DATABASE_URL and reuses the same `pool` — so before the cutover (where
 * DATABASE_URL is still the owner) nothing changes.
 */
const serviceDatabaseUrl = process.env.DATABASE_SERVICE_URL || databaseUrl;
const servicePool: Pool =
  serviceDatabaseUrl === databaseUrl
    ? pool
    : new Pool({
        connectionString: stripSSLParams(serviceDatabaseUrl),
        ssl: parseSSLConfig(serviceDatabaseUrl),
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

/**
 * Validate userId format to prevent SQL injection in SET LOCAL commands
 *
 * Security behavior:
 * - Production: Requires valid UUID format (RFC 4122 compliant)
 * - Development: Allows test IDs but validates against SQL injection
 *
 * Valid test ID patterns (development only):
 * - Alphanumeric characters: a-z, A-Z, 0-9
 * - Hyphens and underscores: -, _
 * - Examples: "test-superadmin-001", "dev_user_123"
 *
 * Blocked in ALL environments:
 * - SQL injection characters: ' " \ ;
 * - Control characters: 0x00-0x1F
 * - Values exceeding 255 characters
 *
 * @security SEC-003 - SQL injection prevention in SET LOCAL commands
 * @internal Exported for testing only
 */
export function validateUserId(userId: string): void {
  const isProduction = process.env.NODE_ENV === 'production';

  // SEC-003: Validate userId to prevent SQL injection in SET LOCAL commands
  // Better Auth generates nanoid IDs (alphanumeric, 32 chars) by default,
  // so we accept both UUID and safe alphanumeric formats in all environments.

  // Reject dangerous characters that could be used for SQL injection
  if (userId.includes("'") || userId.includes('"') || userId.includes('\\') || userId.includes(';')) {
    throw new Error('Invalid userId format: contains dangerous characters');
  }
  // Reject control characters and null bytes
  if (/[\x00-\x1f]/.test(userId)) {
    throw new Error('Invalid userId format: contains control characters');
  }
  // Reject excessively long values
  if (userId.length > 255) {
    throw new Error('Invalid userId format: too long');
  }
  // In production, require either UUID or alphanumeric (nanoid) format
  if (isProduction && !isValidUUID(userId) && !/^[a-zA-Z0-9_-]+$/.test(userId)) {
    throw new Error('Invalid userId format - must be valid UUID or alphanumeric');
  }
}

/**
 * Acquire a client from the pool with tracking
 * @internal Use the public query functions instead
 *
 * Note: Counter is incremented AFTER successful connection to avoid drift
 * if pool.connect() fails.
 */
async function acquireClient(useService = false) {
  if (isShuttingDown) {
    throw new Error('Database pool is shutting down. Cannot acquire new connections.');
  }
  // FIX: Increment counter AFTER successful connection to prevent drift on failure
  const client = await (useService ? servicePool : pool).connect();
  activeConnections++;
  return client;
}

/**
 * Decide whether a *WithRLS call should run on the service (bypass) pool.
 *
 * Rule: a call with NO userId is a system read/write by definition → service.
 * A call with a userId runs on the app pool with the GUC → RLS evaluated.
 * `options.service === true` FORCES the service pool even when a userId is
 * present — used by privileged system bootstraps (e.g. team/subscription
 * creation) that carry a userId but must bypass RLS.
 */
function shouldUseService(userId?: string | null, options?: { service?: boolean }): boolean {
  return options?.service === true || !userId;
}

export interface RLSOptions {
  /** Force the service (RLS-bypass) pool even if a userId is provided. */
  service?: boolean;
}

/**
 * Release a client back to the pool with tracking
 * @internal
 */
function releaseClient(client: PoolClient) {
  activeConnections = Math.max(0, activeConnections - 1);
  client.release();
}

/**
 * Execute a query with RLS context
 * Sets the current user ID for Row Level Security policies via app.user_id
 *
 * @param query - SQL query string
 * @param params - Query parameters
 * @param userId - User ID for RLS context (optional - if not provided, runs without RLS context)
 * @returns Query result rows
 */
export async function queryWithRLS<T = unknown>(
  query: string,
  params: unknown[] = [],
  userId?: string | null,
  options?: RLSOptions
): Promise<T[]> {
  const useService = shouldUseService(userId, options);
  const client = await acquireClient(useService);

  try {
    // Start transaction
    await client.query('BEGIN');

    // Set the user ID for RLS policies only on the app pool. On the service pool
    // RLS is bypassed, so the GUC is irrelevant (and must not gate the query).
    if (userId && !useService) {
      // Validate userId format before using in SET LOCAL
      validateUserId(userId);
      // PostgreSQL doesn't accept parameters in SET LOCAL, must use string interpolation
      // Safe: userId is validated above and comes from our auth system
      await client.query(`SET LOCAL app.user_id = '${userId.replace(/'/g, "''")}'`);
    }

    // Execute the actual query
    const result = await client.query(query, params);

    // Commit transaction
    await client.query('COMMIT');

    return result.rows;
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    throw error;
  } finally {
    // Release connection back to pool
    releaseClient(client);
  }
}

/**
 * Execute a single query and return the first row
 * Useful for queries that return a single result
 */
export async function queryOneWithRLS<T = unknown>(
  query: string,
  params: unknown[] = [],
  userId?: string | null,
  options?: RLSOptions
): Promise<T | null> {
  const rows = await queryWithRLS<T>(query, params, userId, options);
  return rows[0] || null;
}

/**
 * Execute a mutation (INSERT, UPDATE, DELETE) with RLS context
 * Returns the affected rows
 */
export async function mutateWithRLS<T = unknown>(
  query: string,
  params: unknown[] = [],
  userId?: string | null,
  options?: RLSOptions
): Promise<{ rows: T[], rowCount: number }> {
  const useService = shouldUseService(userId, options);
  const client = await acquireClient(useService);

  try {
    await client.query('BEGIN');

    if (userId && !useService) {
      // Validate userId format before using in SET LOCAL
      validateUserId(userId);
      // PostgreSQL doesn't accept parameters in SET LOCAL, must use string interpolation
      // Safe: userId is validated above and comes from our auth system
      await client.query(`SET LOCAL app.user_id = '${userId.replace(/'/g, "''")}'`);
    }

    const result = await client.query(query, params);

    await client.query('COMMIT');

    return {
      rows: result.rows,
      rowCount: result.rowCount || 0
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    releaseClient(client);
  }
}

/**
 * Get a transaction client for multiple operations
 * Useful when you need to run multiple queries in the same RLS context
 *
 * @example
 * const tx = await getTransactionClient(userId);
 * try {
 *   await tx.query('INSERT INTO ...');
 *   await tx.query('UPDATE ...');
 *   await tx.commit();
 * } catch (error) {
 *   await tx.rollback();
 *   throw error;
 * }
 */
export async function getTransactionClient(userId?: string | null, options?: RLSOptions) {
  const useService = shouldUseService(userId, options);
  const client = await acquireClient(useService);

  // FIX: Wrap BEGIN/SET LOCAL in try-catch to release client on failure
  try {
    await client.query('BEGIN');

    if (userId && !useService) {
      // Validate userId format before using in SET LOCAL
      validateUserId(userId);
      // PostgreSQL doesn't accept parameters in SET LOCAL, must use string interpolation
      // Safe: userId is validated above and comes from our auth system
      await client.query(`SET LOCAL app.user_id = '${userId.replace(/'/g, "''")}'`);
    }
  } catch (error) {
    // Release client if transaction setup fails to prevent connection leak
    releaseClient(client);
    throw error;
  }

  return {
    query: <T = unknown>(query: string, params: unknown[] = []) =>
      client.query(query, params).then(r => r.rows as T[]),
    queryOne: <T = unknown>(query: string, params: unknown[] = []) =>
      client.query(query, params).then(r => (r.rows[0] || null) as T | null),
    mutate: <T = unknown>(query: string, params: unknown[] = []) =>
      client.query(query, params).then(r => ({ rows: r.rows as T[], rowCount: r.rowCount || 0 })),
    commit: async () => {
      await client.query('COMMIT');
      releaseClient(client);
    },
    rollback: async () => {
      await client.query('ROLLBACK');
      releaseClient(client);
    },
  };
}

/**
 * Get a transaction client on the SERVICE (RLS-bypass) pool.
 *
 * Use for privileged system bootstraps that carry a userId but must bypass RLS
 * because they create the FIRST membership/subscription of a brand-new team
 * (which no membership-based policy can satisfy). Authorization for these
 * operations is enforced at the API/action layer, not by RLS.
 */
export function getServiceTransactionClient() {
  return getTransactionClient(null, { service: true });
}

// Direct query functions (without RLS) for Better Auth tables
/**
 * Execute a direct query without RLS context
 * Use this for Better Auth tables (user, session, account, verification)
 * 
 * @param text - SQL query string
 * @param params - Query parameters
 * @returns Query result
 */
export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> {
  // No-RLS-context calls are system operations by definition → service pool
  // (bypass). Pre-cutover this is the same target as `pool` (owner).
  const result = await servicePool.query(text, params);
  return {
    rows: result.rows,
    rowCount: result.rowCount || 0
  };
}

/**
 * Execute a direct query and return only the rows
 * Convenience function for SELECT queries
 */
export async function queryRows<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await servicePool.query(text, params);
  return result.rows;
}

/**
 * Execute a direct query and return the first row
 * Useful for queries that return a single result
 */
export async function queryOne<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await servicePool.query(text, params);
  return result.rows[0] || null;
}

// Export the pools. `pool` = app (RLS) pool; `servicePool` = service (bypass)
// pool. Better Auth and other system paths use the service connection.
export { pool, servicePool };

/**
 * Get the shared database pool
 * Use this instead of creating new Pool instances
 *
 * @throws Error if the pool is shutting down or has been closed
 */
export function getPool(): Pool {
  if (isShuttingDown) {
    throw new Error('Database pool is shutting down. Cannot acquire new connections.');
  }
  return pool;
}

/**
 * Check if the pool is healthy and accepting connections
 *
 * Checks:
 * - Pool is not shutting down
 * - Pool has available capacity (not at max with all busy)
 * - No excessive waiting queue
 */
export function isPoolHealthy(): boolean {
  // Pool is shutting down - not healthy
  if (isShuttingDown) {
    console.warn('[DB] Pool health check failed: shutting down');
    return false;
  }

  // Check if pool is completely exhausted (all connections busy + waiting queue)
  const maxConnections = pool.options.max || 20;
  const isExhausted = pool.totalCount >= maxConnections &&
                      pool.idleCount === 0 &&
                      pool.waitingCount > 10; // Allow some waiting, but not excessive

  if (isExhausted) {
    console.warn('[DB] Pool health check failed: pool exhausted', {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    });
    return false;
  }

  return true;
}

/**
 * Get pool statistics for monitoring
 */
export function getPoolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    activeConnections,
    isShuttingDown,
  };
}

/**
 * Gracefully shutdown the database pool
 * Waits for all active connections to complete before closing
 *
 * @param timeoutMs Maximum time to wait for connections to finish (default: 30s)
 */
export async function gracefulShutdown(timeoutMs: number = 30000): Promise<void> {
  // Prevent multiple shutdown attempts
  if (shutdownPromise) {
    return shutdownPromise;
  }

  isShuttingDown = true;
  console.log('[DB] Initiating graceful database shutdown...');

  shutdownPromise = new Promise<void>((resolve) => {
    const startTime = Date.now();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const checkAndClose = async () => {
      const elapsed = Date.now() - startTime;

      // Check if all connections are released or timeout reached
      if (activeConnections === 0 || elapsed >= timeoutMs) {
        // FIX: Clear any pending timeout to prevent memory leak
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        if (activeConnections > 0) {
          console.warn(`[DB] Shutdown timeout reached. Forcing close with ${activeConnections} active connections.`);
        } else {
          console.log('[DB] All connections released. Closing pool...');
        }

        try {
          await pool.end();
          // Close the service pool too when it's a distinct instance.
          if (servicePool !== pool) {
            await servicePool.end();
          }
          console.log('[DB] Database pool closed successfully.');
        } catch (error) {
          console.error('[DB] Error closing database pool:', error);
        }
        resolve();
        return;
      }

      // Check again in 100ms - store reference for cleanup
      // Note: The early return above prevents scheduling after resolution
      timeoutId = setTimeout(checkAndClose, 100);
    };

    checkAndClose();
  });

  return shutdownPromise;
}

// Graceful shutdown handlers
// FIX: Don't call process.exit() - let the shutdown complete naturally
// Next.js and other frameworks handle process termination after async cleanup
process.on('SIGTERM', async () => {
  console.log('[DB] SIGTERM received, initiating graceful shutdown...');
  await gracefulShutdown();
  // Note: Don't call process.exit() here - let the event loop drain naturally
  // The process will exit when all handlers complete
});

process.on('SIGINT', async () => {
  console.log('[DB] SIGINT received, initiating graceful shutdown...');
  await gracefulShutdown();
  // Note: Don't call process.exit() here - let the event loop drain naturally
});

// Export a helper to check database connection
export async function checkDatabaseConnection(): Promise<boolean> {
  if (isShuttingDown) {
    return false;
  }

  try {
    const client = await acquireClient();
    await client.query('SELECT 1');
    releaseClient(client);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}