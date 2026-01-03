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

# 2. Run migrations
pnpm db:migrate

# 3. Verify tables
pnpm db:verify

# 4. Deploy application code
pnpm vercel:deploy --prod
```

---

## Running Migrations

### Migration Script

```bash
# Run all pending migrations
pnpm db:migrate

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

# 4. Verify changes
pnpm db:verify
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

# 2. Run migration
pnpm db:migrate

# 3. Verify success
pnpm db:verify

# 4. Test critical queries
# Check that app still works
```

### After Migration

```bash
# 1. Verify tables exist
pnpm db:verify

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

### Verify Script

```bash
# Check critical tables exist
pnpm db:verify

# Manually verify
psql $DATABASE_URL
\dt  # List tables
\d table_name  # Describe table structure
```

---

## Quick Reference

### Commands

```bash
# Run migrations
pnpm db:migrate

# Verify tables
pnpm db:verify

# Connect to database
psql $DATABASE_URL
```

### Migration Workflow

```bash
# 1. Backup production database
# 2. Test migration on staging
# 3. Run migration on production
# 4. Verify success
# 5. Deploy application code
# 6. Monitor for issues
```

---

**Last Updated:** 2025-11-20  
**Version:** 1.0.0  
**Status:** Manual Process (Automation Planned)
