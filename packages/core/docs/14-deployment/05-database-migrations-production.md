# Database Migrations in Production

## Introduction

Database migrations must be handled carefully in production to avoid data loss and downtime. This guide covers the current migration approach and best practices.

**Current Status:** Manual migration execution; automated migrations planned for future.

---

## Migration Strategy

### Pre-Deployment Migrations

```bash
# Run migrations BEFORE deploying new code
# This ensures database is ready for new application code

# 1. Connect to production database
# Set DATABASE_URL to production

# 2. Dry run: connects, prints the target and the pending files, writes nothing
pnpm db:migrate --dry-run --expect-database app --expect-host db.example.com

# 3. Run migrations against the same expected target
pnpm db:migrate --expect-database app --expect-host db.example.com

# 4. Inspect the affected schema with read-only queries in the database console

# 5. Deploy application code
pnpm vercel:deploy --prod
```

`--expect-database` and `--expect-host` make the run stop before its first statement, and before it connects, when the connection string resolved to another database or host. They guard against the case that is easy to miss: a `DATABASE_URL` or `MIGRATE_DATABASE_URL` that came from an unexpected place (a shell profile, a CI variable, a `.env` file), which the first sign of is migrations applied to the wrong database. `--dry-run` lists what the run would apply, in run order, so the pending files can be read before anything changes. See [Dry run and expected target](../10-backend/02-migrations.md#dry-run-and-expected-target).

---

## Running Migrations

### Migration Script

```bash
# Run all pending migrations
pnpm db:migrate

# Or first list them, and stop unless the target is the expected one
pnpm db:migrate --dry-run --expect-database app --expect-host db.example.com

# Script does:
# 1. Reads migrations from core/migrations/ directory
# 2. Executes in order (001, 002, 003...)
# 3. Tracks applied migrations
# 4. Rolls back on error
```

### Manual Migration Execution

```bash
# Connect to database via Supabase dashboard
# SQL Editor → Run migration SQL manually

# Or via psql
psql $DATABASE_URL -f core/migrations/001_migration.sql
```

---

## Migration Files

### Location

```bash
core/migrations/
├── 001_better_auth_and_functions.sql
├── 002_auth_tables.sql
├── 003_user_metas.sql
├── 004_users_sample_data.sql
├── 005_api_key.sql
├── 006_api_audit_log.sql
└── 007_api_key_sample_data.sql
```

### Creating New Migrations

```bash
# 1. Create new file with incremental number
core/migrations/008_new_feature.sql

# 2. Write migration SQL
# - Include CREATE TABLE IF NOT EXISTS
# - Include indexes
# - Include RLS policies

# 3. Test locally first
pnpm db:migrate

# 4. Inspect the affected schema with your database client
```

---

## Best Practices

### Before Migration

```typescript
const PRE_MIGRATION_CHECKLIST = [
  '✅ Backup production database',
  '✅ Test migration on staging',
  '✅ Review SQL for errors',
  '✅ Plan rollback strategy',
  '✅ Schedule during low-traffic time',
  '✅ Notify team of maintenance window',
]
```

### During Migration

```bash
# 1. Backup database
# Supabase → Database → Backups → Create backup

# 2. Run migration (after a --dry-run, with the same --expect-database and --expect-host)
pnpm db:migrate --expect-database app --expect-host db.example.com

# 3. Inspect the affected schema with read-only queries

# 4. Test critical queries
# Check that app still works
```

### After Migration

```bash
# 1. Inspect the affected tables with read-only queries

# 2. Check RLS policies
# Supabase → Database → Policies

# 3. Test application
# Visit production site, test CRUD operations

# 4. Monitor for errors
# Check Vercel logs
```

---

## Rollback Considerations

### If Migration Fails

```sql
-- Most migrations are additive and safe
-- To rollback, drop added tables/columns

-- Example rollback
DROP TABLE IF EXISTS new_table;
DROP INDEX IF EXISTS new_index;
ALTER TABLE users DROP COLUMN IF EXISTS new_column;
```

### Backup Before Migration

```bash
# Supabase automatic backups:
# - Daily backups (retained 7 days on free tier)
# - Point-in-time recovery (paid plans)

# Manual backup:
# Supabase Dashboard → Database → Backups
# Download backup or restore to specific point
```

---

## Database Verification

### Verify the Affected Schema

```bash
# Inspect with psql
psql $DATABASE_URL
\dt  # List tables
\d table_name  # Describe table structure
```

The repository's `verify-tables.mjs` diagnostic only prints Better Auth table
metadata, so it is not a general migration verifier.

---

## Quick Reference

### Commands

```bash
# Run migrations
pnpm db:migrate

# Connect to database
psql $DATABASE_URL
# Then inspect the tables changed by the migration with \dt and \d
```

### Migration Workflow

```bash
# 1. Backup production database
# 2. Test migration on staging
# 3. Dry run on production: pnpm db:migrate --dry-run --expect-database <name> --expect-host <host>
# 4. Run migration on production, with the same expected target
# 5. Verify success
# 6. Deploy application code
# 7. Monitor for issues
```

---

**Last Updated:** 2025-11-20  
**Version:** 1.0.0  
**Status:** Manual Process (Automation Planned)
