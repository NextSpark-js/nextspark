# Database Migrations

## Introduction

The application uses a robust migration system to manage database schema changes. The system supports core migrations (system-level), theme migrations, plugin migrations, and entity-specific migrations, providing a WordPress-like architecture for extensibility.

## Migration System Architecture

### Three-Tier Migration System

```text
┌─────────────────────────────────────────┐
│ Tier 1: Core Migrations                │
│ Location: /core/migrations/             │
│ Purpose: System-level schema            │
│ Tracking: _migrations table             │
├─────────────────────────────────────────┤
│ Tier 2: Content Migrations              │
│ Location: contents/themes/[theme]/      │
│          contents/plugins/[plugin]/     │
│ Purpose: Theme/Plugin schema            │
│ Tracking: _content_migrations table     │
├─────────────────────────────────────────┤
│ Tier 3: Entity Migrations               │
│ Location: */entities/[entity]/migrations│
│ Purpose: Entity-specific schema         │
│ Tracking: _entity_migrations table      │
└─────────────────────────────────────────┘
```

**Execution Order:**
1. Core migrations (system tables, functions)
2. Theme-level migrations (theme-specific schema)
3. Plugin-level migrations (plugin-specific schema)
4. Entity migrations (entity tables from themes/plugins)

---

## Migration Files

### Location and Structure

**Core Migrations:**
```text
/core/migrations/
├── 001_better_auth_and_functions.sql  # Better Auth tables + helper functions
├── 002_auth_tables.sql                 # Additional auth tables
├── 003_user_metas.sql                  # Metadata system
├── 004_users_sample_data.sql           # Sample users (dev only)
├── 005_api_key.sql                     # API keys table
├── 006_api_audit_log.sql               # Audit logging
└── 007_api_key_sample_data.sql         # Sample API keys (dev only)
```

**Theme Migrations:**
```text
contents/themes/[theme-name]/
└── migrations/
    └── 001_theme_specific.sql
```

**Plugin Migrations:**
```text
contents/plugins/[plugin-name]/
└── migrations/
    └── 001_plugin_specific.sql
```

**Entity Migrations:**
```text
contents/themes/[theme]/entities/[entity]/
└── migrations/
    └── 001_create_table.sql

contents/plugins/[plugin]/entities/[entity]/
└── migrations/
    └── 001_create_table.sql
```

### Naming Convention

Migrations follow a strict naming pattern:

```text
[number]_[description].sql
```

**Examples:**
- `001_better_auth_and_functions.sql`
- `002_auth_tables.sql`
- `003_user_metas.sql`

**Rules:**
- Always use sequential numbers with leading zeros (001, 002, 003...)
- Use descriptive snake_case names
- Never change filenames after execution
- Never delete executed migration files

---

## Migration File Format

### Standard Structure

```sql
-- Migration: [number]_[description].sql
-- Description: Brief description of what this migration does
-- Date: YYYY-MM-DD

-- ============================================
-- TABLES
-- ============================================
CREATE TABLE IF NOT EXISTS "table_name" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  -- Custom fields
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_table_name_user_id
  ON "table_name"("userId");

CREATE INDEX IF NOT EXISTS idx_table_name_created_at
  ON "table_name"("createdAt");

-- ============================================
-- RLS (Row-Level Security)
-- ============================================
ALTER TABLE "table_name" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own" ON "table_name"
  FOR SELECT
  TO authenticated
  USING ("userId" = public.get_auth_user_id());

CREATE POLICY "users_can_create_own" ON "table_name"
  FOR INSERT
  TO authenticated
  WITH CHECK ("userId" = public.get_auth_user_id());

CREATE POLICY "users_can_update_own" ON "table_name"
  FOR UPDATE
  TO authenticated
  USING ("userId" = public.get_auth_user_id())
  WITH CHECK ("userId" = public.get_auth_user_id());

CREATE POLICY "users_can_delete_own" ON "table_name"
  FOR DELETE
  TO authenticated
  USING ("userId" = public.get_auth_user_id());

-- ============================================
-- TRIGGERS
-- ============================================
DROP TRIGGER IF EXISTS table_name_set_updated_at ON "table_name";
CREATE TRIGGER table_name_set_updated_at
  BEFORE UPDATE ON "table_name"
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
```

### Example: User Metadata Migration

```sql
-- Migration: 003_user_metas.sql
-- Description: User metadata table + indexes + RLS
-- Date: 2025-01-19

-- ============================================
-- TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS "users_metas" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  "metaKey" TEXT NOT NULL,
  "metaValue" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "dataType" TEXT,
  "isPublic" BOOLEAN NOT NULL DEFAULT FALSE,
  "isSearchable" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_metas_unique_key UNIQUE ("userId", "metaKey")
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_metas_user_id
  ON "users_metas"("userId");

CREATE INDEX IF NOT EXISTS idx_users_metas_key
  ON "users_metas"("metaKey");

CREATE INDEX IF NOT EXISTS idx_users_metas_composite
  ON "users_metas"("userId", "metaKey", "isPublic");

CREATE INDEX IF NOT EXISTS idx_users_metas_searchable
  ON "users_metas"("isSearchable")
  WHERE "isSearchable" = true;

CREATE INDEX IF NOT EXISTS idx_users_metas_value_gin
  ON "users_metas" USING GIN ("metaValue");

-- ============================================
-- RLS
-- ============================================
ALTER TABLE "users_metas" ENABLE ROW LEVEL SECURITY;

-- Owner or admin can do everything
CREATE POLICY "users_metas_owner_or_admin_all" ON "users_metas"
  FOR ALL
  TO authenticated
  USING (
    "userId" = public.get_auth_user_id()
    OR EXISTS (
      SELECT 1 FROM "user"
      WHERE id = public.get_auth_user_id()
        AND role IN ('admin', 'superadmin')
    )
  );

-- Public read for public metadata
CREATE POLICY users_metas_public_read ON "users_metas"
  FOR SELECT
  TO anon
  USING ("isPublic" = TRUE);

-- ============================================
-- TRIGGER
-- ============================================
DROP TRIGGER IF EXISTS users_metas_set_updated_at ON "users_metas";
CREATE TRIGGER users_metas_set_updated_at
  BEFORE UPDATE ON "users_metas"
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
```

---

## Running Migrations

### Prerequisites

**Environment Variables:**
```bash
# .env
DATABASE_URL=postgresql://user:pass@host:5432/database
NEXT_PUBLIC_ACTIVE_THEME=default
```

**Required:**
- PostgreSQL connection string
- Active theme configured
- Node.js installed

### Execute Migrations

**Run All Migrations:**
```bash
npm run db:migrate
# or
node core/scripts/db/run-migrations.mjs
```

**Migration Process:**
```text
🚀 Starting migration process...

📋 PHASE 1: Core migrations
✅ Connected to database

Found 7 migration file(s)

🔄 Running 001_better_auth_and_functions.sql...
✅ Successfully executed 001_better_auth_and_functions.sql

⏭️  Skipping 002_auth_tables.sql (already executed)
⏭️  Skipping 003_user_metas.sql (already executed)

📋 PHASE 2: Entity migrations
📌 Active theme: default

🎨 Theme migrations: default
  🔄 001_theme_setup.sql...
  ✅ 001_theme_setup.sql executed successfully

🎨 Theme entities: default
  📁 tasks (2 migration(s))
    🔄 001_create_tasks.sql...
    ✅ 001_create_tasks.sql executed successfully

🔌 Active plugins: ai, billing

📦 Active plugins:

🔌 Plugin entities: ai
  📁 completions (1 migration(s))
    🔄 001_create_completions.sql...
    ✅ 001_create_completions.sql executed successfully

✅ Content & Entity migrations completed!
   - Content migrations (theme/plugin): 1
   - Entity migrations: 3 (across 2 entities)

🎉 All migrations completed successfully!
```

### Migration Tracking

The system maintains three tracking tables:

#### 1. Core Migrations (`_migrations`)
```sql
CREATE TABLE "_migrations" (
  id SERIAL PRIMARY KEY,
  filename TEXT UNIQUE NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. Content Migrations (`_content_migrations`)
```sql
CREATE TABLE "_content_migrations" (
  id SERIAL PRIMARY KEY,
  source_type TEXT NOT NULL,      -- 'theme' or 'plugin'
  source_name TEXT NOT NULL,      -- Theme/plugin name
  filename TEXT NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_type, source_name, filename)
);
```

#### 3. Entity Migrations (`_entity_migrations`)
```sql
CREATE TABLE "_entity_migrations" (
  id SERIAL PRIMARY KEY,
  entity_name TEXT NOT NULL,
  source_type TEXT NOT NULL,      -- 'theme' or 'plugin'
  source_name TEXT NOT NULL,      -- Theme/plugin name
  filename TEXT NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_name, filename)
);
```

---

## Creating New Migrations

### Core Migration

**1. Create Migration File:**
```bash
# In /core/migrations/ directory
# Next number in sequence
touch core/migrations/008_my_new_feature.sql
```

**2. Write Migration:**
```sql
-- Migration: 008_my_new_feature.sql
-- Description: Add new feature table
-- Date: 2025-01-19

CREATE TABLE IF NOT EXISTS "my_feature" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes, RLS, triggers as needed
```

**3. Run Migrations:**
```bash
npm run db:migrate
```

### Theme Migration

**1. Create Theme Migrations Directory:**
```bash
mkdir -p contents/themes/default/migrations
```

**2. Create Migration File:**
```bash
touch contents/themes/default/migrations/001_theme_feature.sql
```

**3. Write Migration:**
```sql
-- Theme-specific migration
-- Runs when theme is active

CREATE TABLE IF NOT EXISTS "theme_specific_table" (
  -- Schema
);
```

### Entity Migration

**1. Create Entity Migrations Directory:**
```bash
mkdir -p contents/themes/default/entities/tasks/migrations
```

**2. Create Migration File:**
```bash
touch contents/themes/default/entities/tasks/migrations/001_create_tasks.sql
```

**3. Write Migration:**
```sql
-- Migration: 001_create_tasks.sql
-- Entity: tasks

CREATE TABLE IF NOT EXISTS "tasks" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',
  "dueDate" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Standard indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_id
  ON "tasks"("userId");

CREATE INDEX IF NOT EXISTS idx_tasks_status
  ON "tasks"(status);

-- RLS policies
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_tasks" ON "tasks"
  FOR SELECT
  TO authenticated
  USING ("userId" = public.get_auth_user_id());

-- Triggers
DROP TRIGGER IF EXISTS tasks_set_updated_at ON "tasks";
CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON "tasks"
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
```

---

## Migration Best Practices

### Do's ✅

**1. Always Use Idempotent Operations**
```sql
-- ✅ GOOD - Won't fail if table exists
CREATE TABLE IF NOT EXISTS "my_table" (...);

-- ✅ GOOD - Won't fail if index exists
CREATE INDEX IF NOT EXISTS idx_name ON "table"(column);

-- ✅ GOOD - Safe trigger creation
DROP TRIGGER IF EXISTS trigger_name ON "table";
CREATE TRIGGER trigger_name ...;
```

**2. Include All Required Elements**
- Table creation
- Indexes for performance
- RLS policies for security
- Triggers for automation
- Foreign key constraints

**3. Use Proper Data Types**
```sql
-- ✅ GOOD
"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
"userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
"metaValue" JSONB DEFAULT '{}'::jsonb
```

**4. Document Your Migrations**
```sql
-- Clear header
-- Migration: 008_feature_name.sql
-- Description: What this migration does
-- Date: YYYY-MM-DD

-- Section comments
-- ============================================
-- TABLES
-- ============================================
```

**5. Test Before Production**
```bash
# Test locally first
npm run db:migrate

# Verify changes
npm run db:verify

# Check application works
npm run dev
```

### Don'ts ❌

**1. Never Modify Executed Migrations**
```sql
-- ❌ BAD - Don't change executed migrations
-- Create a new migration instead
```

**2. Never Use Non-Idempotent Operations**
```sql
-- ❌ BAD - Will fail on re-run
CREATE TABLE "my_table" (...);

-- ✅ GOOD - Safe for re-runs
CREATE TABLE IF NOT EXISTS "my_table" (...);
```

**3. Never Delete Migration Files**
```bash
# ❌ BAD - Don't delete
rm core/migrations/001_old_migration.sql

# ✅ GOOD - Keep all migration history
```

**4. Never Skip Sequence Numbers**
```bash
# ❌ BAD
core/migrations/
├── 001_first.sql
├── 002_second.sql
└── 005_third.sql  # Skipped 003, 004

# ✅ GOOD
core/migrations/
├── 001_first.sql
├── 002_second.sql
└── 003_third.sql
```

**5. Never Hardcode User IDs or Data**
```sql
-- ❌ BAD - Hardcoded data
INSERT INTO "tasks" ("userId", title)
VALUES ('user-123', 'Hardcoded task');

-- ✅ GOOD - Sample data migrations only in dev
-- Use separate migration file: XXX_sample_data.sql
```

---

## Rollback Strategies

### Manual Rollback

PostgreSQL doesn't support automatic migration rollbacks. Use these strategies:

**1. Create Rollback Migration**
```sql
-- Migration: 009_add_column.sql
ALTER TABLE "tasks" ADD COLUMN priority TEXT;

-- Rollback: 010_remove_column.sql (if needed)
ALTER TABLE "tasks" DROP COLUMN IF EXISTS priority;
```

**2. Database Backup Before Migration**
```bash
# Before running migrations
pg_dump $DATABASE_URL > backup_before_migration.sql

# If migration fails, restore
psql $DATABASE_URL < backup_before_migration.sql
```

**3. Point-in-Time Recovery (Supabase Pro)**
- Restore to any point before migration
- Granularity: 2 minutes
- Available for last 7 days

### Emergency Rollback Process

**Step 1: Stop Application**
```bash
# Stop accepting new requests
```

**Step 2: Restore Database**
```bash
# Option A: From backup
psql $DATABASE_URL < backup_before_migration.sql

# Option B: Supabase PITR
# Use Supabase Dashboard to restore
```

**Step 3: Remove Migration Record**
```sql
-- Remove failed migration from tracking
DELETE FROM "_migrations"
WHERE filename = '008_failed_migration.sql';
```

**Step 4: Fix and Re-run**
```bash
# Fix the migration file
# Re-run migrations
npm run db:migrate
```

---

## Common Migration Patterns

### Pattern 1: Adding New Table

```sql
-- Create table with standard structure
CREATE TABLE IF NOT EXISTS "new_entity" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  -- Custom fields
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Standard indexes
CREATE INDEX IF NOT EXISTS idx_new_entity_user_id
  ON "new_entity"("userId");

-- RLS policies
ALTER TABLE "new_entity" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own" ON "new_entity"
  FOR SELECT TO authenticated
  USING ("userId" = public.get_auth_user_id());

-- Trigger
DROP TRIGGER IF EXISTS new_entity_set_updated_at ON "new_entity";
CREATE TRIGGER new_entity_set_updated_at
  BEFORE UPDATE ON "new_entity"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### Pattern 2: Adding Column

```sql
-- Add new column (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'priority'
  ) THEN
    ALTER TABLE "tasks" ADD COLUMN priority TEXT DEFAULT 'medium';
  END IF;
END $$;

-- Add index for new column
CREATE INDEX IF NOT EXISTS idx_tasks_priority
  ON "tasks"(priority);
```

### Pattern 3: Creating Function

```sql
-- Create or replace function
CREATE OR REPLACE FUNCTION public.my_function()
RETURNS TRIGGER AS $$
BEGIN
  -- Function logic
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Pattern 4: Complex RLS Policy

```sql
-- Admin or owner can access
CREATE POLICY "admin_or_owner_access" ON "tasks"
  FOR ALL
  TO authenticated
  USING (
    "userId" = public.get_auth_user_id()
    OR EXISTS (
      SELECT 1 FROM "user"
      WHERE id = public.get_auth_user_id()
        AND role IN ('admin', 'superadmin')
    )
  );
```

---

## Troubleshooting

### Migration Fails to Execute

**Error:** Migration syntax error

**Solution:**
1. Check SQL syntax locally
2. Test in Supabase SQL editor
3. Verify table/column names match database

**Error:** Table already exists

**Solution:**
```sql
-- Use IF NOT EXISTS
CREATE TABLE IF NOT EXISTS "table_name" (...);
```

**Error:** Foreign key constraint violation

**Solution:**
1. Ensure referenced table exists
2. Run migrations in correct order
3. Check core migrations run before entity migrations

### Migration Marked as Executed but Failed

**Solution:**
```sql
-- Remove from tracking table
DELETE FROM "_migrations"
WHERE filename = 'failed_migration.sql';

-- Fix migration file
-- Re-run
npm run db:migrate
```

### Entity Migrations Not Running

**Solution:**
1. Verify theme is active: `NEXT_PUBLIC_ACTIVE_THEME=default`
2. Check plugin is listed in theme config
3. Verify migrations folder exists: `entities/[entity]/migrations/`
4. Check file naming: `001_migration_name.sql`

---

## Migration Checklist

Before creating a migration:

- [ ] Migration follows naming convention
- [ ] Uses idempotent operations (`IF NOT EXISTS`)
- [ ] Includes proper documentation header
- [ ] Standard fields included (`id`, `userId`, `createdAt`, `updatedAt`)
- [ ] Foreign keys have `ON DELETE CASCADE`
- [ ] Indexes created for commonly queried columns
- [ ] RLS enabled and policies created
- [ ] Trigger for `updatedAt` added
- [ ] Tested locally before production
- [ ] Backup created before running

---

## Summary

**Key Concepts:**
- Three-tier migration system (Core → Content → Entity)
- Sequential execution with tracking tables
- WordPress-like architecture for extensibility
- Idempotent operations for safety
- Theme and plugin isolation

**Migration Types:**
- Core migrations (system-level)
- Theme migrations (theme-specific)
- Plugin migrations (plugin-specific)
- Entity migrations (entity tables)

**Best Practices:**
- Always use `IF NOT EXISTS`
- Never modify executed migrations
- Keep migration history complete
- Test before production
- Document all changes

**Execution:**
```bash
npm run db:migrate
```

**Next:** [RLS Policies](./03-rls-policies.md)

---

**Last Updated**: 2025-01-19
**Version**: 1.0.0
**Status**: Complete
