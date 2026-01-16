import { Pool } from 'pg';

// Track active connections for graceful shutdown
let activeConnections = 0;
let isShuttingDown = false;
let shutdownPromise: Promise<void> | null = null;

/**
 * Parse SSL mode from DATABASE_URL using proper URL parameter parsing
 * Supports: disable, allow, prefer, require, verify-ca, verify-full
 */
function parseSSLConfig(databaseUrl: string): false | { rejectUnauthorized: boolean } {
  if (!databaseUrl) {
    return { rejectUnauthorized: false };
  }

  try {
    // Parse URL to extract query parameters
    const url = new URL(databaseUrl);
    const sslmode = url.searchParams.get('sslmode');

    // Handle different SSL modes
    switch (sslmode) {
      case 'disable':
        return false;
      case 'require':
      case 'prefer':
      case 'allow':
        return { rejectUnauthorized: false };
      case 'verify-ca':
      case 'verify-full':
        return { rejectUnauthorized: true };
      default:
        // Default: use SSL with rejectUnauthorized: false for compatibility
        return { rejectUnauthorized: false };
    }
  } catch {
    // If URL parsing fails, fall back to simple check for backward compatibility
    if (databaseUrl.includes('sslmode=disable')) {
      return false;
    }
    return { rejectUnauthorized: false };
  }
}

const databaseUrl = process.env.DATABASE_URL || '';
const sslConfig = parseSSLConfig(databaseUrl);

// Create a connection pool
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: sslConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

/**
 * Acquire a client from the pool with tracking
 * @internal Use the public query functions instead
 */
async function acquireClient() {
  if (isShuttingDown) {
    throw new Error('Database pool is shutting down. Cannot acquire new connections.');
  }
  activeConnections++;
  return pool.connect();
}

/**
 * Release a client back to the pool with tracking
 * @internal
 */
function releaseClient(client: import('pg').PoolClient) {
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
  userId?: string | null
): Promise<T[]> {
  const client = await acquireClient();

  try {
    // Start transaction
    await client.query('BEGIN');

    // Set the user ID for RLS policies if provided
    if (userId) {
      // PostgreSQL doesn't accept parameters in SET LOCAL, must use string interpolation
      // This is safe because userId comes from our auth system, not user input
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
  userId?: string | null
): Promise<T | null> {
  const rows = await queryWithRLS<T>(query, params, userId);
  return rows[0] || null;
}

/**
 * Execute a mutation (INSERT, UPDATE, DELETE) with RLS context
 * Returns the affected rows
 */
export async function mutateWithRLS<T = unknown>(
  query: string,
  params: unknown[] = [],
  userId?: string | null
): Promise<{ rows: T[], rowCount: number }> {
  const client = await acquireClient();

  try {
    await client.query('BEGIN');

    if (userId) {
      // PostgreSQL doesn't accept parameters in SET LOCAL, must use string interpolation
      // This is safe because userId comes from our auth system, not user input
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
export async function getTransactionClient(userId?: string | null) {
  const client = await acquireClient();

  await client.query('BEGIN');

  if (userId) {
    // PostgreSQL doesn't accept parameters in SET LOCAL, must use string interpolation
    // This is safe because userId comes from our auth system, not user input
    await client.query(`SET LOCAL app.user_id = '${userId.replace(/'/g, "''")}'`);
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
  const result = await pool.query(text, params);
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
  const result = await pool.query(text, params);
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
  const result = await pool.query(text, params);
  return result.rows[0] || null;
}

// Export the pool for Better Auth (it needs direct access without RLS)
export { pool };

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
 */
export function isPoolHealthy(): boolean {
  return !isShuttingDown && pool.totalCount >= 0;
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
  console.log('Initiating graceful database shutdown...');

  shutdownPromise = new Promise<void>((resolve) => {
    const startTime = Date.now();

    const checkAndClose = async () => {
      const elapsed = Date.now() - startTime;

      // Check if all connections are released or timeout reached
      if (activeConnections === 0 || elapsed >= timeoutMs) {
        if (activeConnections > 0) {
          console.warn(`Shutdown timeout reached. Forcing close with ${activeConnections} active connections.`);
        } else {
          console.log('All connections released. Closing pool...');
        }

        try {
          await pool.end();
          console.log('Database pool closed successfully.');
        } catch (error) {
          console.error('Error closing database pool:', error);
        }
        resolve();
        return;
      }

      // Check again in 100ms
      setTimeout(checkAndClose, 100);
    };

    checkAndClose();
  });

  return shutdownPromise;
}

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, initiating graceful shutdown...');
  await gracefulShutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, initiating graceful shutdown...');
  await gracefulShutdown();
  process.exit(0);
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