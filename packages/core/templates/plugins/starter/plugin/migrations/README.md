# {{PLUGIN_DISPLAY_NAME}} - Database Migrations

This directory contains database migrations specific to the {{PLUGIN_DISPLAY_NAME}} plugin.

## Migration Naming Convention

Migrations should be named following the pattern:

```
NNN_description.sql
```

Where:
- `NNN` is a 3-digit sequence number (001, 002, etc.)
- `description` is a brief description of the migration

Once a migration is applied (and above all once the plugin is published), do not edit it: the migration ledger
records its hash. Change the schema with a new file.

## Table Names

Every table of the plugin is named `{{PLUGIN_TABLE_PREFIX}}_<table>`: the prefix is the first segment of the plugin's
name (`{{PLUGIN_SLUG}}` -> `{{PLUGIN_TABLE_PREFIX}}`), followed by an underscore. A plugin cannot then take a table name
the project or another plugin uses. An entity of the plugin declares that name as its `tableName`.

## Example Migration

Create a file `001_initial_schema.sql`:

```sql
-- ============================================
-- {{PLUGIN_DISPLAY_NAME}} - Initial Schema
-- ============================================

-- Create main table
CREATE TABLE IF NOT EXISTS public."{{PLUGIN_TABLE_PREFIX}}_items" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES public."users"("id") ON DELETE CASCADE,
  "teamId" TEXT NOT NULL REFERENCES public."teams"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "data" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index
CREATE INDEX IF NOT EXISTS "idx_{{PLUGIN_TABLE_PREFIX}}_items_teamId"
  ON public."{{PLUGIN_TABLE_PREFIX}}_items"("teamId");

-- Enable RLS
ALTER TABLE public."{{PLUGIN_TABLE_PREFIX}}_items" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: members of the row's team (a superadmin bypasses)
DROP POLICY IF EXISTS "{{PLUGIN_TABLE_PREFIX}}_items_team" ON public."{{PLUGIN_TABLE_PREFIX}}_items";
CREATE POLICY "{{PLUGIN_TABLE_PREFIX}}_items_team"
  ON public."{{PLUGIN_TABLE_PREFIX}}_items"
  FOR ALL TO authenticated
  USING ((SELECT public.is_superadmin()) OR "teamId" = ANY ((SELECT public.get_user_team_ids())::text[]))
  WITH CHECK ((SELECT public.is_superadmin()) OR "teamId" = ANY ((SELECT public.get_user_team_ids())::text[]));
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
