import { Pool } from 'pg';
declare const pool: Pool;
/**
 * Execute a query with RLS context
 * Sets the current user ID for Row Level Security policies via app.user_id
 *
 * @param query - SQL query string
 * @param params - Query parameters
 * @param userId - User ID for RLS context (optional - if not provided, runs without RLS context)
 * @returns Query result rows
 */
export declare function queryWithRLS<T = unknown>(query: string, params?: unknown[], userId?: string | null): Promise<T[]>;
/**
 * Execute a single query and return the first row
 * Useful for queries that return a single result
 */
export declare function queryOneWithRLS<T = unknown>(query: string, params?: unknown[], userId?: string | null): Promise<T | null>;
/**
 * Execute a mutation (INSERT, UPDATE, DELETE) with RLS context
 * Returns the affected rows
 */
export declare function mutateWithRLS<T = unknown>(query: string, params?: unknown[], userId?: string | null): Promise<{
    rows: T[];
    rowCount: number;
}>;
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
export declare function getTransactionClient(userId?: string | null): Promise<{
    query: <T = unknown>(query: string, params?: unknown[]) => Promise<T[]>;
    queryOne: <T_1 = unknown>(query: string, params?: unknown[]) => Promise<T_1>;
    mutate: <T_2 = unknown>(query: string, params?: unknown[]) => Promise<{
        rows: T_2[];
        rowCount: number;
    }>;
    commit: () => Promise<void>;
    rollback: () => Promise<void>;
}>;
/**
 * Execute a direct query without RLS context
 * Use this for Better Auth tables (user, session, account, verification)
 *
 * @param text - SQL query string
 * @param params - Query parameters
 * @returns Query result
 */
export declare function query<T = unknown>(text: string, params?: unknown[]): Promise<{
    rows: T[];
    rowCount: number;
}>;
/**
 * Execute a direct query and return only the rows
 * Convenience function for SELECT queries
 */
export declare function queryRows<T = unknown>(text: string, params?: unknown[]): Promise<T[]>;
/**
 * Execute a direct query and return the first row
 * Useful for queries that return a single result
 */
export declare function queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null>;
export { pool };
export declare function checkDatabaseConnection(): Promise<boolean>;
//# sourceMappingURL=db.d.ts.map