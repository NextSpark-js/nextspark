# Database Overview

## Introduction

The application uses **PostgreSQL** as its relational database, hosted on **Supabase**. The database architecture implements multi-tenancy through Row-Level Security (RLS), provides dual database separation for application and authentication data, and supports flexible metadata storage for dynamic entity fields.

## Database Provider

### Supabase PostgreSQL

**Why Supabase?**
- Fully managed PostgreSQL database
- Built-in Row-Level Security (RLS) support
- Real-time subscriptions (optional)
- Automatic backups and point-in-time recovery
- Connection pooling via PgBouncer
- REST API auto-generation (not used in favor of custom API v1)

**Version:** PostgreSQL 15+

**Connection:** Uses standard PostgreSQL client (`pg` package) for maximum control and performance.

---

## Database Architecture

### Dual Database Separation

The application maintains a conceptual separation between two types of data:

**1. Authentication Data (Better Auth)**
- Managed entirely by Better Auth library
- Tables: `user`, `session`, `account`, `verification`
- Permissive RLS policies (Better Auth handles its own security)
- Direct access via Better Auth API only

**2. Application Data**
- Business logic tables and entities
- Tables: `user_metas`, dynamic entity tables
- Restrictive RLS policies (user-scoped data isolation)
- Accessed via services layer with RLS context

**Benefits of Separation:**
```text
┌─────────────────────────────────────────┐
│ Better Auth Tables (Permissive RLS)    │
│ ├─ user                                 │
│ ├─ session                              │
│ ├─ account                              │
│ └─ verification                         │
├─────────────────────────────────────────┤
│ Application Tables (Restrictive RLS)   │
│ ├─ user_metas (metadata system)        │
│ ├─ api_keys (API authentication)       │
│ ├─ api_audit_logs (audit trail)        │
│ └─ [entity tables] (dynamic entities)  │
└─────────────────────────────────────────┘
```

- Clear security boundaries
- Authentication concerns isolated from business logic
- Better Auth can operate independently
- Application data always user-scoped via RLS

---

## Database Schema Design

### Core Tables

#### 1. User Table (Better Auth)
```sql
CREATE TABLE "user" (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  name TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  role TEXT DEFAULT 'member',
  banned BOOLEAN DEFAULT false,
  "banReason" TEXT,
  "banExpires" TIMESTAMP
);
```

**Purpose:** Core user authentication and profile data.

**RLS:** Permissive policies (Better Auth managed).

#### 2. Session Table (Better Auth)
```sql
CREATE TABLE "session" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "expiresAt" TIMESTAMP NOT NULL,
  token TEXT NOT NULL UNIQUE,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Active user sessions for dashboard access.

**RLS:** Permissive policies (Better Auth managed).

#### 3. User Metadata Table
```sql
CREATE TABLE "user_metas" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "metaKey" TEXT NOT NULL,
  "metaValue" TEXT NOT NULL,
  "dataType" TEXT NOT NULL DEFAULT 'text',
  "isPublic" BOOLEAN DEFAULT false,
  "isSearchable" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("userId", "metaKey")
);

-- Automatic timestamp update trigger
CREATE TRIGGER update_user_metas_updated_at
  BEFORE UPDATE ON "user_metas"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Purpose:** Flexible key-value storage for user preferences, feature flags, and custom fields without schema migrations.

**RLS:** Restrictive policies (user can only access their own metadata).

**Use Cases:**
- User preferences: `{ "theme": "dark", "language": "es" }`
- Feature flags: `{ "beta_features": "true" }`
- Custom user fields: `{ "company": "Acme Corp" }`

#### 4. API Keys Table
```sql
CREATE TABLE "api_keys" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key TEXT UNIQUE NOT NULL,
  prefix TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  "lastUsed" TIMESTAMP,
  "expiresAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked BOOLEAN DEFAULT false
);

CREATE INDEX idx_api_keys_user_id ON "api_keys"("userId");
CREATE INDEX idx_api_keys_key ON "api_keys"(key);
CREATE INDEX idx_api_keys_prefix ON "api_keys"(prefix);
```

**Purpose:** API key authentication for external clients accessing API v1.

**RLS:** User can only manage their own API keys.

**Key Features:**
- Scope-based permissions
- Expiration support
- Revocation capability
- Usage tracking

#### 5. API Audit Logs Table
```sql
CREATE TABLE "api_audit_logs" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "apiKeyId" TEXT REFERENCES "api_keys"(id) ON DELETE SET NULL,
  "userId" TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "responseTime" INTEGER,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_audit_logs_api_key_id ON "api_audit_logs"("apiKeyId");
CREATE INDEX idx_api_audit_logs_user_id ON "api_audit_logs"("userId");
CREATE INDEX idx_api_audit_logs_created_at ON "api_audit_logs"("createdAt");
```

**Purpose:** Complete audit trail of all API requests for security and monitoring.

**Retention:** Configurable (default: 90 days).

---

### Dynamic Entity Tables

Entity tables are created dynamically based on entity configurations. All entity tables follow this pattern:

```sql
CREATE TABLE "entity_name" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  -- Entity-specific fields defined in config
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Standard indexes
CREATE INDEX idx_entity_name_user_id ON "entity_name"("userId");
CREATE INDEX idx_entity_name_created_at ON "entity_name"("createdAt");

-- Automatic timestamp update trigger
CREATE TRIGGER update_entity_name_updated_at
  BEFORE UPDATE ON "entity_name"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS policies (user-scoped)
ALTER TABLE "entity_name" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own records" ON "entity_name"
  FOR SELECT USING ("userId" = public.get_auth_user_id());

CREATE POLICY "Users can create own records" ON "entity_name"
  FOR INSERT WITH CHECK ("userId" = public.get_auth_user_id());

CREATE POLICY "Users can update own records" ON "entity_name"
  FOR UPDATE USING ("userId" = public.get_auth_user_id());

CREATE POLICY "Users can delete own records" ON "entity_name"
  FOR DELETE USING ("userId" = public.get_auth_user_id());
```

**Standard Fields:**
- `id` - Primary key (UUID)
- `userId` - Foreign key to user (owner)
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

**Standard Indexes:**
- `userId` - For RLS and user queries
- `createdAt` - For time-based ordering

**Standard Triggers:**
- `update_updated_at_column()` - Auto-update `updatedAt`

---

## Connection Management

### Connection Pooling

**Pooler:** PgBouncer (provided by Supabase)

**Connection String Format:**
```bash
# Pooled connection (recommended for app)
DATABASE_URL=postgresql://user:pass@host:6543/database?pgbouncer=true

# Direct connection (for migrations)
DIRECT_DATABASE_URL=postgresql://user:pass@host:5432/database
```

**Pool Configuration:**
```typescript
// core/lib/db.ts
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})
```

**Best Practices:**
- Use pooled connection for application queries
- Use direct connection for migrations and schema changes
- Monitor connection usage in production
- Adjust pool size based on load (default: 20)

---

## Database Functions

### 1. User Context Function

```sql
CREATE OR REPLACE FUNCTION public.get_auth_user_id()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.user_id', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Purpose:** Retrieves the current user ID from the transaction context for RLS policies.

**How it works:**
1. Application sets `app.user_id` via `SET LOCAL` in transaction
2. RLS policies call `get_auth_user_id()` to get the user context
3. Database automatically filters rows based on user ID

### 2. Updated At Trigger Function

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Purpose:** Automatically updates the `updatedAt` column on row updates.

**Usage:** Applied to all tables via triggers.

---

## Indexes and Performance

### Standard Indexes

All entity tables include these standard indexes:

1. **Primary Key Index** (automatic)
   ```sql
   PRIMARY KEY (id)
   ```

2. **User ID Index** (for RLS and filtering)
   ```sql
   CREATE INDEX idx_[entity]_user_id ON "[entity]"("userId");
   ```

3. **Created At Index** (for time-based queries)
   ```sql
   CREATE INDEX idx_[entity]_created_at ON "[entity]"("createdAt");
   ```

### Custom Indexes

Add custom indexes for frequently queried fields:

```sql
-- Example: Index on email for user lookups
CREATE INDEX idx_user_email ON "user"(email);

-- Example: Composite index for common filter
CREATE INDEX idx_api_keys_user_active
ON "api_keys"("userId", revoked)
WHERE revoked = false;
```

**Indexing Guidelines:**
- Index foreign keys used in JOINs
- Index columns used in WHERE clauses
- Use partial indexes for common filters
- Avoid over-indexing (impacts write performance)
- Monitor index usage with `pg_stat_user_indexes`

---

## Data Types and Conventions

### Naming Conventions

**Tables:** PascalCase wrapped in quotes or snake_case
```sql
"user"          -- Better Auth convention
"userMetas"     -- Camel case (legacy)
"user_metas"    -- Snake case (preferred)
```

**Columns:** camelCase wrapped in quotes
```sql
"userId"        -- Camel case
"createdAt"     -- Camel case
"emailVerified" -- Camel case
```

**Indexes:** `idx_[table]_[column(s)]`
```sql
idx_user_metas_user_id
idx_api_keys_user_active
```

**Triggers:** `[operation]_[table]_[purpose]`
```sql
update_user_metas_updated_at
```

### Common Data Types

| Type | Usage | Example |
|------|-------|---------|
| `TEXT` | Primary keys, IDs, strings | `id TEXT PRIMARY KEY` |
| `TEXT` | Emails, names, descriptions | `email TEXT` |
| `BOOLEAN` | Flags | `emailVerified BOOLEAN` |
| `TIMESTAMP` | Dates and times | `createdAt TIMESTAMP` |
| `INTEGER` | Counts, numeric IDs | `statusCode INTEGER` |
| `TEXT[]` | Arrays | `scopes TEXT[]` |
| `JSONB` | Structured data | `metadata JSONB` |

---

## Multi-Tenancy via RLS

The application uses PostgreSQL Row-Level Security (RLS) for multi-tenancy:

**User Isolation Model:**
```text
┌──────────────────────────────────────┐
│ User A's Data                        │
│ WHERE userId = 'user-a'              │
├──────────────────────────────────────┤
│ User B's Data                        │
│ WHERE userId = 'user-b'              │
├──────────────────────────────────────┤
│ User C's Data                        │
│ WHERE userId = 'user-c'              │
└──────────────────────────────────────┘

All isolated at database level via RLS
```

**Security Layers:**
1. **Middleware** - Validates JWT session
2. **API Routes** - Check user permissions
3. **Database RLS** - Filters rows automatically

**See:** [RLS Policies Documentation](./03-rls-policies.md)

---

## Metadata System

### User Metadata

Flexible key-value storage without schema migrations:

```typescript
// Store user preference
await MetaService.createMeta({
  userId: 'user-123',
  metaKey: 'theme',
  metaValue: 'dark',
  dataType: 'string'
})

// Retrieve metadata
const theme = await MetaService.getUserMeta('user-123', 'theme')
// Returns: { metaKey: 'theme', metaValue: 'dark', dataType: 'string' }
```

### Entity Metadata

Attach custom data to any entity:

```typescript
// Merge priority: User > Entity > Global
const metadata = await MetaService.getMergedMeta('task-123', 'user-456')
// Returns merged metadata from all levels
```

**Use Cases:**
- User preferences and settings
- Feature flags per user
- Custom entity fields
- A/B testing configuration
- Third-party integration data

**See:** [Entity Metadata Documentation](../04-entities/07-metadata-system.md)

---

## Backup and Recovery

### Automatic Backups (Supabase)

**Daily Backups:**
- Full database backups every 24 hours
- Retained for 7 days (Pro plan: 30 days)
- Point-in-time recovery available

**Access Backups:**
1. Go to Supabase Dashboard
2. Navigate to Database > Backups
3. Select backup and restore point

### Manual Backups

```bash
# Export entire database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Export specific tables
pg_dump $DATABASE_URL -t user -t user_metas > backup_users.sql

# Restore from backup
psql $DATABASE_URL < backup_20250119.sql
```

### Point-in-Time Recovery

Supabase Pro provides PITR:
- Restore to any point in the last 7 days
- Granularity: 2 minutes
- Zero data loss recovery

---

## Database Monitoring

### Key Metrics

**Query Performance:**
```sql
-- Slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Connection Usage:**
```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity
WHERE state = 'active';

-- Connections by database
SELECT datname, count(*)
FROM pg_stat_activity
GROUP BY datname;
```

**Index Usage:**
```sql
-- Unused indexes
SELECT schemaname, tablename, indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0;
```

**Table Sizes:**
```sql
-- Largest tables
SELECT schemaname, tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
```

### Supabase Dashboard

Monitor database health via Supabase Dashboard:
- Database size and usage
- Active connections
- Query performance
- Table statistics
- Index recommendations

---

## Best Practices

### Schema Design

1. **Always include standard fields**
   ```sql
   id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
   "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
   "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   ```

2. **Use foreign keys with cascade**
   ```sql
   REFERENCES "user"(id) ON DELETE CASCADE
   ```

3. **Add automatic timestamp updates**
   ```sql
   CREATE TRIGGER update_[table]_updated_at
     BEFORE UPDATE ON "[table]"
     FOR EACH ROW
     EXECUTE FUNCTION update_updated_at_column();
   ```

4. **Enable RLS on all application tables**
   ```sql
   ALTER TABLE "[table]" ENABLE ROW LEVEL SECURITY;
   ```

### Query Optimization

1. **Use indexed columns in WHERE clauses**
2. **Avoid SELECT * in production queries**
3. **Use EXPLAIN ANALYZE for slow queries**
4. **Leverage connection pooling**
5. **Use prepared statements for repeated queries**

### Security

1. **Never bypass RLS in application code**
2. **Use `queryWithRLS()` for application data**
3. **Validate all user input before queries**
4. **Use parameterized queries (prevent SQL injection)**
5. **Audit access to sensitive tables**

---

## Common Patterns

### Pattern 1: Query with RLS

```typescript
import { queryWithRLS } from '@/core/lib/db'

// Automatically filtered by userId
const userTasks = await queryWithRLS(
  'SELECT * FROM tasks ORDER BY "createdAt" DESC',
  [],
  userId // Sets RLS context
)
```

### Pattern 2: Transaction with RLS

```typescript
import { getTransactionClient } from '@/core/lib/db'

const client = await getTransactionClient(userId)
try {
  await client.query('BEGIN')

  // Multiple queries in same RLS context
  await client.query('INSERT INTO tasks ...')
  await client.query('UPDATE user_metas ...')

  await client.query('COMMIT')
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
}
```

### Pattern 3: Metadata Storage

```typescript
import { MetaService } from '@/core/lib/services/meta.service'

// Store flexible data without migrations
await MetaService.createMeta({
  entityId: 'task-123',
  key: 'priority',
  value: 'high',
  userId: 'user-456'
})
```

---

## Summary

**Key Concepts:**
- PostgreSQL on Supabase with connection pooling
- Dual database separation (auth vs application)
- Row-Level Security for multi-tenancy
- Flexible metadata system
- Standard schema patterns for all entities

**Core Tables:**
- `user`, `session`, `account`, `verification` (Better Auth)
- `user_metas` (flexible metadata)
- `api_keys` (external authentication)
- `api_audit_logs` (audit trail)
- Dynamic entity tables (config-driven)

**Security Features:**
- RLS for data isolation
- Audit logging for compliance
- Connection pooling for performance
- Automatic backups and PITR

**Next:** [Database Migrations](./02-migrations.md)

---

**Last Updated**: 2025-01-19
**Version**: 1.0.0
**Status**: Complete
