import { Pool } from 'pg';

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

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
  const client = await pool.connect();
  
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
    client.release();
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
  const client = await pool.connect();
  
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
    client.release();
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
  const client = await pool.connect();
  
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
      client.release();
    },
    rollback: async () => {
      await client.query('ROLLBACK');
      client.release();
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

// Export a helper to check database connection
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}