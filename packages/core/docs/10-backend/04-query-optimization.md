# Query Optimization

## Introduction

Query optimization is critical for application performance and scalability. This guide covers indexing strategies, query analysis, connection pooling, caching, and monitoring techniques specific to our PostgreSQL database architecture with RLS.

## Performance Targets

**Query Response Time Goals:**
- Simple queries: < 10ms
- JOIN queries: < 30ms
- Complex aggregations: < 100ms
- Paginated lists: < 50ms

**Database Metrics:**
- Connection pool utilization: < 80%
- Cache hit ratio: > 90%
- Index hit ratio: > 99%
- Active connections: < 15 (out of 20 max)

---

## Indexing Strategies

### Standard Indexes

All entity tables include standard indexes for common query patterns:

```sql
-- Primary key index (automatic)
CREATE INDEX ON "tasks" (id);

-- User ID index (for RLS filtering)
CREATE INDEX idx_tasks_user_id ON "tasks"("userId");

-- Created at index (for time-based ordering)
CREATE INDEX idx_tasks_created_at ON "tasks"("createdAt");

-- Updated at index (for recently modified)
CREATE INDEX idx_tasks_updated_at ON "tasks"("updatedAt");
```

### Composite Indexes

For queries filtering on multiple columns:

```sql
-- User + status filter
CREATE INDEX idx_tasks_user_status
ON "tasks"("userId", status);

-- User + date range queries
CREATE INDEX idx_tasks_user_created
ON "tasks"("userId", "createdAt" DESC);

-- Multi-column sorting
CREATE INDEX idx_tasks_user_priority_created
ON "tasks"("userId", priority, "createdAt" DESC);
```

**Column Order Matters:**
- Most selective column first
- Columns used in WHERE before ORDER BY
- Descending for DESC sorts

### Partial Indexes

Index only relevant subset of data:

```sql
-- Index only active tasks
CREATE INDEX idx_tasks_active
ON "tasks"("userId", "createdAt")
WHERE status != 'completed';

-- Index only public metadata
CREATE INDEX idx_user_metas_public
ON "user_metas"("metaKey")
WHERE "isPublic" = true;

-- Index only non-revoked API keys
CREATE INDEX idx_api_keys_active
ON "api_keys"("userId", "lastUsed")
WHERE revoked = false;
```

**Benefits:**
- Smaller index size
- Faster index scans
- Reduced maintenance overhead

### Expression Indexes

Index computed values:

```sql
-- Index lowercase email for case-insensitive search
CREATE INDEX idx_user_email_lower
ON "user" (LOWER(email));

-- Index extracted JSON field
CREATE INDEX idx_user_metas_value_text
ON "user_metas" ((("metaValue"->>'textValue')::text));

-- Index concatenated fields
CREATE INDEX idx_user_full_name
ON "user" ((LOWER("firstName" || ' ' || "lastName")));
```

### JSONB Indexes

For metadata and flexible fields:

```sql
-- GIN index for JSONB containment
CREATE INDEX idx_user_metas_value_gin
ON "user_metas" USING GIN ("metaValue");

-- JSON path operations
CREATE INDEX idx_user_metas_value_path
ON "user_metas" USING GIN ("metaValue" jsonb_path_ops);

-- Specific JSON key
CREATE INDEX idx_user_metas_preferences
ON "user_metas" ((("metaValue"->>'preferences')::jsonb))
WHERE "metaKey" = 'user_preferences';
```

**Usage:**
```sql
-- Containment query
SELECT * FROM "user_metas"
WHERE "metaValue" @> '{"theme": "dark"}';

-- Existence query
SELECT * FROM "user_metas"
WHERE "metaValue" ? 'theme';
```

### Text Search Indexes

For full-text search:

```sql
-- GIN index for tsvector
CREATE INDEX idx_tasks_search
ON "tasks" USING GIN (
  to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, ''))
);

-- Usage
SELECT * FROM "tasks"
WHERE to_tsvector('english', title || ' ' || description)
  @@ to_tsquery('english', 'important & urgent');
```

---

## Query Analysis with EXPLAIN

### Using EXPLAIN ANALYZE

**Basic Usage:**
```sql
EXPLAIN ANALYZE
SELECT * FROM tasks
WHERE "userId" = 'user-123'
  AND status = 'in_progress'
ORDER BY "createdAt" DESC
LIMIT 20;
```

**Output Interpretation:**
```text
Index Scan using idx_tasks_user_status on tasks
  (cost=0.42..8.44 rows=1 width=234)
  (actual time=0.015..0.016 rows=1 loops=1)
  Index Cond: (("userId" = 'user-123') AND (status = 'in_progress'))
Planning Time: 0.084 ms
Execution Time: 0.032 ms
```

**Key Metrics:**
- `cost`: Estimated query cost
- `rows`: Estimated rows returned
- `actual time`: Real execution time
- `loops`: Number of iterations

### Reading Query Plans

**Scan Types (Best to Worst):**

1. **Index Only Scan** (Best)
   ```text
   Index Only Scan using idx_tasks_user_created
   ```text
   - All data from index (no table access)
   - Fastest possible scan

2. **Index Scan**
   ```text
   Index Scan using idx_tasks_user_id
   ```text
   - Uses index to find rows
   - Then fetches from table
   - Good performance

3. **Bitmap Index Scan**
   ```text
   Bitmap Index Scan on idx_tasks_status
   ```text
   - Combines multiple indexes
   - Useful for OR conditions
   - Moderate performance

4. **Sequential Scan** (Worst)
   ```text
   Seq Scan on tasks
   ```text
   - Scans entire table
   - No index used
   - Poor performance for large tables

### Identifying Problems

**Problem: Sequential Scan**
```sql
EXPLAIN ANALYZE SELECT * FROM tasks WHERE title LIKE '%important%';
-- Seq Scan on tasks (cost=0.00..1234.56 rows=100 width=234)
```

**Solution: Add index or use tsvector**
```sql
CREATE INDEX idx_tasks_search ON tasks USING GIN (
  to_tsvector('english', title)
);
```

**Problem: Poor Selectivity**
```sql
EXPLAIN ANALYZE SELECT * FROM tasks WHERE status = 'todo';
-- Returns 90% of rows - index not helpful
```

**Solution: Use partial index or rethink query**
```sql
-- Only index completed (minority)
CREATE INDEX idx_tasks_completed ON tasks("createdAt")
WHERE status = 'completed';
```

---

## Avoiding N+1 Queries

### The N+1 Problem

**Bad: N+1 Queries**
```typescript
// Fetch users (1 query)
const users = await queryWithRLS('SELECT * FROM "user" LIMIT 10', [], adminId);

// Fetch tasks for each user (N queries)
for (const user of users) {
  user.tasks = await queryWithRLS(
    'SELECT * FROM tasks WHERE "userId" = $1',
    [user.id],
    adminId
  );
}
// Total: 1 + 10 = 11 queries!
```

### Solution 1: JOIN Queries

```typescript
// Single query with JOIN
const results = await queryWithRLS(`
  SELECT
    u.id, u.email, u.name,
    json_agg(
      json_build_object(
        'id', t.id,
        'title', t.title,
        'status', t.status
      )
    ) as tasks
  FROM "user" u
  LEFT JOIN tasks t ON t."userId" = u.id
  WHERE u.id = ANY($1)
  GROUP BY u.id
  LIMIT 10
`, [userIds], adminId);
```

### Solution 2: Batch Loading

```typescript
// Fetch all users
const users = await queryWithRLS('SELECT * FROM "user" LIMIT 10', [], adminId);
const userIds = users.map(u => u.id);

// Fetch all tasks in single query
const tasks = await queryWithRLS(
  'SELECT * FROM tasks WHERE "userId" = ANY($1)',
  [userIds],
  adminId
);

// Group tasks by user
const tasksByUser = tasks.reduce((acc, task) => {
  if (!acc[task.userId]) acc[task.userId] = [];
  acc[task.userId].push(task);
  return acc;
}, {});

// Attach tasks to users
users.forEach(user => {
  user.tasks = tasksByUser[user.id] || [];
});
```

### Solution 3: CTEs (Common Table Expressions)

```sql
WITH user_task_counts AS (
  SELECT "userId", COUNT(*) as task_count
  FROM tasks
  GROUP BY "userId"
)
SELECT
  u.id,
  u.email,
  COALESCE(utc.task_count, 0) as task_count
FROM "user" u
LEFT JOIN user_task_counts utc ON utc."userId" = u.id
WHERE u.role = 'member';
```

---

## Connection Pooling

### Pool Configuration

```typescript
// core/lib/db.ts
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // Maximum connections
  min: 2,                     // Minimum idle connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Wait 2s for available connection
});

// Monitor pool events
pool.on('connect', (client) => {
  console.log('New client connected');
});

pool.on('error', (err, client) => {
  console.error('Pool error:', err);
});

pool.on('remove', (client) => {
  console.log('Client removed from pool');
});
```

### Pool Usage Patterns

**Good: Release connections promptly**
```typescript
async function queryExample() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM tasks');
    return result.rows;
  } finally {
    client.release(); // Always release!
  }
}
```

**Bad: Connection leak**
```typescript
async function badExample() {
  const client = await pool.connect();
  const result = await client.query('SELECT * FROM tasks');
  return result.rows;
  // ❌ Connection never released!
}
```

### Monitoring Pool Health

```typescript
// Check pool status
function getPoolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    utilization: ((pool.totalCount - pool.idleCount) / pool.totalCount * 100).toFixed(1) + '%'
  };
}

// Log periodically
setInterval(() => {
  console.log('Pool stats:', getPoolStats());
}, 60000); // Every minute
```

---

## Caching Strategies

### Query Result Caching

**Application-Level Cache:**
```typescript
import { LRUCache } from 'lru-cache';

const queryCache = new LRUCache<string, any>({
  max: 500,
  ttl: 1000 * 60 * 5, // 5 minutes
});

async function getCachedQuery<T>(
  key: string,
  query: () => Promise<T>
): Promise<T> {
  // Check cache
  const cached = queryCache.get(key);
  if (cached) return cached;

  // Execute query
  const result = await query();

  // Store in cache
  queryCache.set(key, result);

  return result;
}

// Usage
const tasks = await getCachedQuery(
  `tasks:user:${userId}`,
  () => queryWithRLS('SELECT * FROM tasks', [], userId)
);
```

### TanStack Query Integration

```typescript
// Client-side caching with TanStack Query
export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: () => fetch('/api/v1/tasks').then(res => res.json()),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10,   // 10 minutes
  });
}

// Invalidate cache on mutation
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => fetch('/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
```

### Database-Level Caching

PostgreSQL automatically caches:
- Query plans (prepared statements)
- Frequently accessed data (shared buffers)
- Index pages

**Leverage with prepared statements:**
```typescript
const query = {
  name: 'fetch_user_tasks',
  text: 'SELECT * FROM tasks WHERE "userId" = $1 ORDER BY "createdAt" DESC',
  values: [userId]
};

const result = await client.query(query);
// PostgreSQL caches query plan
```

---

## Query Optimization Techniques

### SELECT Only Required Columns

**Bad:**
```typescript
// Fetches all columns (wasteful)
const tasks = await query('SELECT * FROM tasks');
```

**Good:**
```typescript
// Only needed columns
const tasks = await query(`
  SELECT id, title, status, "createdAt"
  FROM tasks
`);
```

### Use LIMIT for Large Results

```typescript
// Always paginate
const tasks = await queryWithRLS(`
  SELECT id, title, status
  FROM tasks
  WHERE "userId" = $1
  ORDER BY "createdAt" DESC
  LIMIT $2 OFFSET $3
`, [userId, limit, offset], userId);
```

### Optimize WHERE Clauses

**Bad:**
```sql
-- Function on indexed column
WHERE LOWER(email) = 'user@example.com'
-- Index on email not used!
```

**Good:**
```sql
-- Expression index
CREATE INDEX idx_user_email_lower ON "user" (LOWER(email));
WHERE LOWER(email) = 'user@example.com'
-- Now index is used
```

### Use EXISTS Instead of COUNT

**Bad:**
```sql
-- Counts all rows (slow)
SELECT COUNT(*) FROM tasks WHERE "userId" = 'user-123';
-- Just to check if any exist
```

**Good:**
```sql
-- Stops at first match (fast)
SELECT EXISTS(
  SELECT 1 FROM tasks WHERE "userId" = 'user-123'
);
```

### Avoid OR with Different Columns

**Bad:**
```sql
-- Hard to optimize
WHERE title = 'Important' OR status = 'urgent'
```

**Good:**
```sql
-- Use UNION for better index usage
SELECT * FROM tasks WHERE title = 'Important'
UNION
SELECT * FROM tasks WHERE status = 'urgent'
```

---

## Database Monitoring

### Key Performance Queries

**Slow Queries:**
```sql
SELECT
  query,
  mean_exec_time,
  calls,
  total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Table Sizes:**
```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Index Usage:**
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC
LIMIT 10;
```

**Cache Hit Ratio:**
```sql
SELECT
  sum(heap_blks_read) as heap_read,
  sum(heap_blks_hit) as heap_hit,
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
FROM pg_statio_user_tables;
-- Target: > 0.99 (99% cache hit)
```

### Performance Metrics Dashboard

```typescript
// core/lib/db/monitoring.ts
export async function getDatabaseMetrics() {
  const client = await pool.connect();

  try {
    const [
      slowQueries,
      tableSizes,
      indexUsage,
      cacheHitRatio,
    ] = await Promise.all([
      client.query(`
        SELECT query, mean_exec_time, calls
        FROM pg_stat_statements
        ORDER BY mean_exec_time DESC
        LIMIT 5
      `),
      client.query(`
        SELECT
          tablename,
          pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size('public.'||tablename) DESC
        LIMIT 5
      `),
      client.query(`
        SELECT tablename, indexname, idx_scan
        FROM pg_stat_user_indexes
        WHERE idx_scan = 0
      `),
      client.query(`
        SELECT
          sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
        FROM pg_statio_user_tables
      `),
    ]);

    return {
      slowQueries: slowQueries.rows,
      tableSizes: tableSizes.rows,
      unusedIndexes: indexUsage.rows,
      cacheHitRatio: cacheHitRatio.rows[0]?.ratio || 0,
      poolStats: getPoolStats(),
    };
  } finally {
    client.release();
  }
}
```

---

## Best Practices

### Do's ✅

**1. Index Foreign Keys**
```sql
CREATE INDEX idx_tasks_user_id ON tasks("userId");
```

**2. Use Connection Pooling**
```typescript
const client = await pool.connect();
try {
  // Query
} finally {
  client.release();
}
```

**3. Analyze Query Plans**
```sql
EXPLAIN ANALYZE SELECT ...;
```

**4. Paginate Large Results**
```sql
SELECT ... LIMIT 20 OFFSET 0;
```

**5. Monitor Performance**
```sql
SELECT * FROM pg_stat_statements;
```

### Don'ts ❌

**1. Never Use SELECT ***
```sql
-- ❌ BAD
SELECT * FROM tasks;

-- ✅ GOOD
SELECT id, title, status FROM tasks;
```

**2. Never Forget Connection Release**
```typescript
// ❌ BAD
const client = await pool.connect();
return client.query('SELECT...');

// ✅ GOOD
const client = await pool.connect();
try {
  return await client.query('SELECT...');
} finally {
  client.release();
}
```

**3. Never Create Unused Indexes**
```sql
-- Check usage before creating
SELECT * FROM pg_stat_user_indexes
WHERE idx_scan = 0;
```

**4. Never Query in Loops**
```typescript
// ❌ BAD - N+1 queries
for (const user of users) {
  await query('SELECT * FROM tasks WHERE userId = $1', [user.id]);
}

// ✅ GOOD - Single query
const tasks = await query(
  'SELECT * FROM tasks WHERE userId = ANY($1)',
  [userIds]
);
```

---

## Summary

**Key Concepts:**
- Indexing is critical for query performance
- EXPLAIN ANALYZE reveals query bottlenecks
- Avoid N+1 queries with JOINs or batch loading
- Connection pooling prevents resource exhaustion
- Caching reduces database load

**Index Types:**
- Standard B-tree indexes for equality and range
- Composite indexes for multi-column queries
- Partial indexes for subset filtering
- JSONB GIN indexes for metadata
- Text search indexes for full-text

**Optimization Techniques:**
- Select only required columns
- Use LIMIT for pagination
- Leverage prepared statements
- Monitor slow queries
- Cache frequently accessed data

**Monitoring:**
- Track slow queries
- Monitor connection pool
- Check cache hit ratios
- Identify unused indexes
- Measure query performance

**Next:** [Service Layer](./05-service-layer.md)

---

**Last Updated**: 2025-01-19
**Version**: 1.0.0
**Status**: Complete
