# Database Performance

## Introduction

Database performance is **critical for application responsiveness**. Slow queries cascade into poor user experience, regardless of frontend optimization. This guide covers PostgreSQL-specific optimization strategies, indexing patterns, RLS performance, and connection management with Supabase.

**Core Principle:** Optimize queries at the database level before adding application-level caching.

---

## Performance Targets

### Query Response Time Goals

```typescript
const QUERY_TARGETS = {
  simple: '< 10ms',          // Single row by ID
  list: '< 50ms',            // Paginated lists with filters
  join: '< 30ms',            // Simple JOIN operations
  aggregate: '< 100ms',      // COUNT, SUM, AVG queries
  search: '< 150ms',         // Full-text search
  complex: '< 200ms',        // Multi-JOIN with aggregations
} as const
```

### Database Health Metrics

| Metric | Target | Impact |
|--------|--------|--------|
| **Connection Pool Utilization** | < 80% | Available connections |
| **Cache Hit Ratio** | > 90% | PostgreSQL shared buffers |
| **Index Hit Ratio** | > 99% | Index usage vs seq scans |
| **Active Connections** | < 15 | Out of 20 max (Supabase free tier) |
| **Average Query Time** | < 50ms | Overall responsiveness |

---

## Indexing Strategies

### Standard Indexes for Every Entity

All entity tables include these **mandatory indexes**:

```sql
-- Primary key index (automatic with PRIMARY KEY)
CREATE TABLE "tasks" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  -- ... other fields
);

-- User ID index (critical for RLS performance)
CREATE INDEX idx_tasks_user_id ON "tasks"("userId");

-- Timestamp indexes (for sorting and filtering)
CREATE INDEX idx_tasks_created_at ON "tasks"("createdAt" DESC);
CREATE INDEX idx_tasks_updated_at ON "tasks"("updatedAt" DESC);
```

**Why These Indexes:**
- `userId` - RLS policies filter by user, this index is **essential**
- `createdAt` - Most lists sort by creation date
- `updatedAt` - "Recently modified" queries are common

---

## Composite Indexes

### Multi-Column Query Optimization

When queries filter on multiple columns, **composite indexes** dramatically improve performance:

```sql
-- ❌ WITHOUT composite index (slow)
-- Query: SELECT * FROM tasks WHERE "userId" = $1 AND status = 'active'
-- Performance: Seq Scan → 150ms

-- ✅ WITH composite index (fast)
CREATE INDEX idx_tasks_user_status
ON "tasks"("userId", status);
-- Performance: Index Scan → 8ms

-- User + date range queries
CREATE INDEX idx_tasks_user_created
ON "tasks"("userId", "createdAt" DESC);

-- Multi-column sorting
CREATE INDEX idx_tasks_user_priority_created
ON "tasks"("userId", priority DESC, "createdAt" DESC);
```

### Column Order Matters

```sql
-- ❌ WRONG - Less selective column first
CREATE INDEX idx_tasks_status_user ON "tasks"(status, "userId");
-- status has ~3 unique values (active, completed, archived)
-- userId has ~1000 unique values

-- ✅ CORRECT - Most selective column first
CREATE INDEX idx_tasks_user_status ON "tasks"("userId", status);
-- PostgreSQL can efficiently filter by userId, then status

-- Rule: Put WHERE clause columns before ORDER BY columns
CREATE INDEX idx_tasks_user_priority_date
ON "tasks"(
  "userId",      -- WHERE filter (most selective)
  priority,      -- WHERE filter
  "createdAt"    -- ORDER BY
);
```

---

## Partial Indexes

### Index Only Relevant Data

**Partial indexes** reduce index size and improve performance by indexing only a subset of rows:

```sql
-- ✅ Index only active tasks (most common query)
CREATE INDEX idx_tasks_active
ON "tasks"("userId", "createdAt" DESC)
WHERE status != 'completed';
-- Benefits:
-- - 60% smaller index (completed tasks excluded)
-- - Faster index scans
-- - Reduced maintenance overhead

-- ✅ Index only public metadata
CREATE INDEX idx_user_metas_public
ON "user_metas"("userId", "metaKey")
WHERE "isPublic" = true;

-- ✅ Index only active API keys
CREATE INDEX idx_api_keys_active
ON "api_keys"("userId", "lastUsed" DESC)
WHERE revoked = false;

-- Usage
SELECT * FROM tasks
WHERE "userId" = $1
  AND status != 'completed'  -- Must match index condition
ORDER BY "createdAt" DESC;
```

**When to Use Partial Indexes:**
- When queries frequently filter on the same condition
- When the condition significantly reduces row count (>50%)
- For boolean fields where one value is rare (e.g., `WHERE deleted = false`)

---

## Expression Indexes

### Index Computed Values

**Expression indexes** allow indexing function results or computed values:

```sql
-- ✅ Case-insensitive email lookup
CREATE INDEX idx_user_email_lower
ON "user" (LOWER(email));

-- Usage
SELECT * FROM "user"
WHERE LOWER(email) = LOWER($1);  -- Uses index

-- ✅ JSON field extraction
CREATE INDEX idx_user_metas_text_value
ON "user_metas" ((("metaValue"->>'textValue')::text))
WHERE "metaKey" = 'bio';

-- ✅ Full-name search
CREATE INDEX idx_user_full_name
ON "user" (LOWER("firstName" || ' ' || "lastName"));

-- Usage
SELECT * FROM "user"
WHERE LOWER("firstName" || ' ' || "lastName") LIKE LOWER($1 || '%');
```

---

## JSONB Indexes

### Metadata Field Optimization

Our metadata system uses JSONB for flexible fields. **GIN indexes** enable fast JSONB queries:

```sql
-- ✅ GIN index for JSONB containment queries
CREATE INDEX idx_user_metas_value_gin
ON "user_metas" USING GIN ("metaValue");

-- Usage examples

-- 1. Containment (@>)
SELECT * FROM "user_metas"
WHERE "userId" = $1
  AND "metaValue" @> '{"theme": "dark"}';  -- Uses GIN index

-- 2. Key existence (?)
SELECT * FROM "user_metas"
WHERE "userId" = $1
  AND "metaValue" ? 'preferences';  -- Uses GIN index

-- 3. Any key exists (?|)
SELECT * FROM "user_metas"
WHERE "userId" = $1
  AND "metaValue" ?| array['theme', 'language'];

-- ✅ jsonb_path_ops for better performance (containment only)
CREATE INDEX idx_user_metas_value_path
ON "user_metas" USING GIN ("metaValue" jsonb_path_ops);
-- Smaller, faster, but only supports @> operator
```

**GIN vs GIN with jsonb_path_ops:**

| Feature | GIN | GIN jsonb_path_ops |
|---------|-----|-------------------|
| **Size** | Larger | ~30% smaller |
| **Operations** | @>, ?, ?&, ?| | Only @> |
| **Performance** | Good | Better for containment |
| **Use case** | General JSONB | Known containment queries |

---

## Full-Text Search Indexes

### Efficient Text Search

For searching task titles, descriptions, or user content:

```sql
-- ✅ GIN index for full-text search
CREATE INDEX idx_tasks_search
ON "tasks" USING GIN (
  to_tsvector('english',
    COALESCE(title, '') || ' ' || COALESCE(description, '')
  )
);

-- Usage
SELECT * FROM "tasks"
WHERE "userId" = $1
  AND to_tsvector('english', title || ' ' || description)
      @@ to_tsquery('english', $2)  -- Uses GIN index
ORDER BY "createdAt" DESC
LIMIT 20;

-- ✅ Better: Add generated column for faster queries
ALTER TABLE "tasks"
ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
  to_tsvector('english',
    COALESCE(title, '') || ' ' || COALESCE(description, '')
  )
) STORED;

CREATE INDEX idx_tasks_search_vector
ON "tasks" USING GIN (search_vector);

-- Simpler query
SELECT * FROM "tasks"
WHERE "userId" = $1
  AND search_vector @@ to_tsquery('english', $2);
```

---

## RLS Performance Optimization

### The RLS Challenge

**Row-Level Security (RLS)** is excellent for security but can impact performance if not optimized:

```sql
-- RLS policy (applied to every query)
CREATE POLICY "Users can view own tasks"
ON "tasks" FOR SELECT
USING ("userId" = get_auth_user_id());

-- Every query becomes:
SELECT * FROM "tasks"
WHERE "userId" = get_auth_user_id()  -- Added by RLS
  AND status = 'active'              -- Your filter
ORDER BY "createdAt" DESC;
```

### Critical: Index on RLS Column

```sql
-- ⚠️ WITHOUT userId index (catastrophic performance)
-- RLS forces full table scan
EXPLAIN ANALYZE SELECT * FROM tasks WHERE status = 'active';
-- Seq Scan on tasks (cost=0.00..1234.56 rows=10 width=...)
-- Execution time: 450ms

-- ✅ WITH userId index (fast)
CREATE INDEX idx_tasks_user_id ON "tasks"("userId");

EXPLAIN ANALYZE SELECT * FROM tasks WHERE status = 'active';
-- Index Scan using idx_tasks_user_id (cost=0.42..12.45 rows=10 width=...)
-- Execution time: 12ms
```

**Rule:** Always index columns used in RLS policies (typically `userId`).

### Composite Indexes with RLS

```sql
-- Since RLS always filters by userId, start indexes with it
CREATE INDEX idx_tasks_user_status
ON "tasks"("userId", status);

CREATE INDEX idx_tasks_user_created
ON "tasks"("userId", "createdAt" DESC);

-- ✅ Query optimization
SELECT * FROM tasks
WHERE status = 'active'  -- RLS adds userId automatically
ORDER BY "createdAt" DESC
LIMIT 20;

-- Actual executed query (with RLS):
-- WHERE "userId" = 'user-123' AND status = 'active'
-- PostgreSQL uses idx_tasks_user_status efficiently
```

---

## Avoiding N+1 Queries

### The N+1 Problem

```typescript
// ❌ BAD - N+1 query problem
async function getTasksWithClients(userId: string) {
  // Query 1: Fetch tasks
  const tasks = await queryWithRLS(
    'SELECT * FROM tasks WHERE "userId" = $1',
    [userId],
    userId
  )
  
  // Query 2, 3, 4... N+1: Fetch client for each task
  for (const task of tasks) {
    task.client = await query(
      'SELECT * FROM clients WHERE id = $1',
      [task.clientId]
    )
  }
  
  return tasks
  // Result: 1 + 100 = 101 queries for 100 tasks!
}
```

### Solution 1: JOIN Queries

```typescript
// ✅ GOOD - Single query with JOIN
async function getTasksWithClients(userId: string) {
  const tasks = await queryWithRLS(
    `
    SELECT 
      t.*,
      jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'email', c.email
      ) as client
    FROM tasks t
    LEFT JOIN clients c ON t."clientId" = c.id
    WHERE t."userId" = $1
    ORDER BY t."createdAt" DESC
    LIMIT 20
    `,
    [userId],
    userId
  )
  
  return tasks
  // Result: 1 query total!
}
```

### Solution 2: Batch Loading

```typescript
// ✅ GOOD - Batch load related data
async function getTasksWithClients(userId: string) {
  // Query 1: Fetch tasks
  const tasks = await queryWithRLS(
    'SELECT * FROM tasks WHERE "userId" = $1',
    [userId],
    userId
  )
  
  // Query 2: Batch fetch all clients
  const clientIds = tasks.map(t => t.clientId).filter(Boolean)
  const clients = await query(
    'SELECT * FROM clients WHERE id = ANY($1)',
    [clientIds]
  )
  
  // Map in memory
  const clientMap = Object.fromEntries(
    clients.map(c => [c.id, c])
  )
  
  return tasks.map(t => ({
    ...t,
    client: clientMap[t.clientId] || null
  }))
  
  // Result: 2 queries total (regardless of task count)
}
```

---

## Query Analysis with EXPLAIN

### Using EXPLAIN ANALYZE

```sql
-- ✅ Analyze query performance
EXPLAIN ANALYZE
SELECT *
FROM tasks
WHERE "userId" = 'user-123'
  AND status = 'active'
ORDER BY "createdAt" DESC
LIMIT 20;
```

### Reading EXPLAIN Output

```text
Index Scan using idx_tasks_user_status on tasks
  (cost=0.42..12.45 rows=10 width=584)
  (actual time=0.023..0.156 rows=10 loops=1)
  Index Cond: (("userId" = 'user-123') AND (status = 'active'))
  Buffers: shared hit=8
Planning Time: 0.089 ms
Execution Time: 0.198 ms
```

**Key Metrics:**
- **cost** - Estimated query cost (lower is better)
- **actual time** - Real execution time in milliseconds
- **rows** - Number of rows returned
- **Index Scan** - Using an index (good) vs Seq Scan (bad)
- **Buffers: shared hit** - Data found in cache (good)

### Red Flags in EXPLAIN

```sql
-- ❌ RED FLAG 1: Sequential Scan
Seq Scan on tasks (cost=0.00..1234.56 rows=10000 width=584)
-- Solution: Add index on filtered columns

-- ❌ RED FLAG 2: High actual time
actual time=450.123..850.456
-- Solution: Add indexes, reduce data scanned

-- ❌ RED FLAG 3: Large rows count
rows=50000 width=584
-- Solution: Add LIMIT, improve WHERE conditions

-- ❌ RED FLAG 4: Nested Loop with many iterations
Nested Loop (actual time=... rows=1000 loops=1000)
-- Solution: Improve JOIN conditions, add indexes
```

---

## Connection Pooling

### Supabase Connection Management

```typescript
// core/lib/db.ts
import { Pool } from 'pg'

// ✅ Connection pool configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                  // Maximum connections (Supabase free tier limit)
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Fail fast if no connection available
})

// ✅ Always release connections
export async function query<T = any>(
  text: string,
  params: any[] = []
): Promise<T[]> {
  const client = await pool.connect()
  try {
    const result = await client.query(text, params)
    return result.rows
  } finally {
    client.release()  // Critical: return to pool
  }
}
```

### Monitoring Connection Pool

```typescript
// Check pool health
const poolStats = {
  totalConnections: pool.totalCount,
  idleConnections: pool.idleCount,
  waitingClients: pool.waitingCount,
}

console.log('Pool stats:', poolStats)

// ⚠️ Warning signs:
// - totalCount === max (pool exhausted)
// - waitingCount > 0 (requests queued)
// - idleCount === 0 (all connections busy)
```

---

## Prepared Statements

### Prevent SQL Injection AND Improve Performance

```typescript
// ✅ ALWAYS use parameterized queries
async function getTaskById(taskId: string, userId: string) {
  // PostgreSQL caches the execution plan
  return await queryWithRLS(
    'SELECT * FROM tasks WHERE id = $1',
    [taskId],
    userId
  )
}

// ❌ NEVER concatenate SQL (SQL injection risk!)
async function getTaskByIdWrong(taskId: string, userId: string) {
  return await queryWithRLS(
    `SELECT * FROM tasks WHERE id = '${taskId}'`,  // Vulnerable!
    [],
    userId
  )
}
```

---

## Query Optimization Checklist

### Before Deploying Queries

```typescript
const QUERY_CHECKLIST = {
  performance: [
    '✅ EXPLAIN ANALYZE shows Index Scan (not Seq Scan)',
    '✅ Query time < target (simple: 10ms, list: 50ms)',
    '✅ Indexed columns used in WHERE and ORDER BY',
    '✅ JOIN queries use indexed foreign keys',
    '✅ No N+1 queries (batch load or JOIN)',
  ],
  
  security: [
    '✅ Using parameterized queries ($1, $2)',
    '✅ Using queryWithRLS() for user data',
    '✅ RLS enabled on all tables',
    '✅ No raw user input in SQL',
  ],
  
  efficiency: [
    '✅ SELECT only needed columns (not SELECT *)',
    '✅ LIMIT applied to list queries',
    '✅ Connection released in finally block',
    '✅ Transactions used for multi-query operations',
  ],
}
```

---

## Real-world Query Patterns

### Pattern 1: Efficient Entity List

```typescript
// ✅ Optimized entity list query
async function getEntityList(
  entityType: string,
  userId: string,
  filters: any = {},
  pagination: { limit: number; offset: number }
) {
  const { limit = 20, offset = 0 } = pagination
  
  return await queryWithRLS(
    `
    SELECT 
      e.*,
      -- Aggregate metadata in single query
      jsonb_object_agg(
        m."metaKey",
        m."metaValue"
      ) FILTER (WHERE m."metaKey" IS NOT NULL) as metadata
    FROM "${entityType}" e
    LEFT JOIN "${entityType}_metas" m
      ON e.id = m."${entityType}Id"
    WHERE e."userId" = $1
    GROUP BY e.id
    ORDER BY e."createdAt" DESC
    LIMIT $2 OFFSET $3
    `,
    [userId, limit, offset],
    userId
  )
  
  // Single query fetches entity + all metadata
}
```

### Pattern 2: Efficient Search

```typescript
// ✅ Optimized search with full-text index
async function searchTasks(
  userId: string,
  searchTerm: string,
  limit: number = 20
) {
  return await queryWithRLS(
    `
    SELECT *
    FROM tasks
    WHERE "userId" = $1
      AND search_vector @@ plainto_tsquery('english', $2)
    ORDER BY ts_rank(search_vector, plainto_tsquery('english', $2)) DESC
    LIMIT $3
    `,
    [userId, searchTerm, limit],
    userId
  )
}
```

---

## Monitoring Database Performance

### Key Queries to Monitor

```sql
-- Check slow queries
SELECT 
  query,
  calls,
  total_exec_time / 1000 as total_seconds,
  mean_exec_time as avg_ms
FROM pg_stat_statements
WHERE mean_exec_time > 50  -- Queries averaging >50ms
ORDER BY total_exec_time DESC
LIMIT 20;

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0  -- Unused indexes
ORDER BY pg_relation_size(indexrelid) DESC;

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Best Practices Summary

### ✅ DO

```typescript
// Use queryWithRLS for user data
const tasks = await queryWithRLS(query, params, userId)

// Use parameterized queries
const task = await query('SELECT * FROM tasks WHERE id = $1', [taskId])

// Index RLS columns
CREATE INDEX idx_tasks_user_id ON "tasks"("userId");

// Use EXPLAIN ANALYZE to verify performance
EXPLAIN ANALYZE SELECT ...

// Release connections
try { /* query */ } finally { client.release() }

// Batch related queries
const clients = await query('SELECT * FROM clients WHERE id = ANY($1)', [ids])
```

### ❌ DON'T

```typescript
// Use string concatenation in SQL
const query = `SELECT * FROM tasks WHERE id = '${taskId}'`  // SQL injection!

// Forget to index RLS columns
// Performance disaster with RLS enabled

// Make N+1 queries
for (const task of tasks) {
  task.client = await query('SELECT * FROM clients WHERE id = $1', [task.clientId])
}

// Ignore EXPLAIN warnings
// Seq Scan on tasks → Add index!

// Use SELECT * in production
// Select only needed columns
```

---

## Next Steps

- **Profile queries:** Use EXPLAIN ANALYZE on slow endpoints
- **Add indexes:** Focus on RLS columns and common filters
- **Monitor pool:** Check connection utilization in Supabase dashboard
- **Learn more:** See [Caching Strategies](./05-caching-strategies.md) for next-level optimization

**Related Documentation:**
- [Database Overview](../10-backend/01-database-overview.md) - Architecture and setup
- [RLS Policies](../10-backend/03-rls-policies.md) - Security patterns
- [Query Optimization](../10-backend/04-query-optimization.md) - Advanced techniques

---

**Last Updated:** 2025-11-20  
**Version:** 1.0.0  
**Status:** Complete  
**Database:** PostgreSQL (Supabase)  
**Key Optimizations:** Indexes, RLS, Connection Pooling
