# {{PLUGIN_DISPLAY_NAME}} - Database Migrations

This directory contains database migrations specific to the {{PLUGIN_DISPLAY_NAME}} plugin.

## Migration Naming Convention

Migrations should be named following the pattern:

```
NNN_{{PLUGIN_SLUG}}_description.sql
```

Where:
- `NNN` is a 3-digit sequence number (001, 002, etc.)
- `{{PLUGIN_SLUG}}` is the plugin identifier
- `description` is a brief description of the migration

## Example Migration

Create a file `001_{{PLUGIN_SLUG}}_initial_schema.sql`:

```sql
-- ============================================
-- {{PLUGIN_DISPLAY_NAME}} - Initial Schema
-- ============================================

-- Create main table
CREATE TABLE IF NOT EXISTS "{{PLUGIN_SLUG}}_items" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name" VARCHAR(255) NOT NULL,
  "data" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index
CREATE INDEX IF NOT EXISTS "idx_{{PLUGIN_SLUG}}_items_userId"
  ON "{{PLUGIN_SLUG}}_items"("userId");

-- Enable RLS
ALTER TABLE "{{PLUGIN_SLUG}}_items" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own items
CREATE POLICY "{{PLUGIN_SLUG}}_items_user_access"
  ON "{{PLUGIN_SLUG}}_items"
  FOR ALL
  USING ("userId" = auth.uid());
```

## Running Migrations

Migrations are automatically run when you execute:

```bash
pnpm db:migrate
```

## Important Notes

1. Always use `camelCase` for field names (not `snake_case`)
2. Include proper foreign key constraints
3. Enable Row Level Security (RLS) for user data
4. Create appropriate indexes for query performance
5. Use `JSONB` for flexible data storage
