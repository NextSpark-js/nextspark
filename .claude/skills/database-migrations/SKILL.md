---
name: database-migrations
description: |
  PostgreSQL migration patterns: writing RLS policy SQL, Better Auth integration, and TIMESTAMPTZ.
  Covers main tables, meta tables, child entities, and sample data.
  Use this skill when creating migrations, validating SQL, or generating sample data.
  For the RUNTIME RLS model (service pool, nextspark_app cutover, fail-closed) see rls-enforcement.
allowed-tools: Read, Glob, Grep, Bash(python:*)
version: 1.2.0
---

# Database Migrations Skill

Patterns and tools for PostgreSQL database migrations with RLS, Better Auth, and strict conventions.

## Architecture Overview

```
core/migrations/
├── 001_better_auth_and_functions.sql  # Base auth (DO NOT MODIFY)
├── 002_auth_tables.sql                # Auth tables (DO NOT MODIFY)
├── XXX_[entity]_table.sql             # Main entity table
├── XXX_[entity]_metas.sql             # Meta table (optional)
├── XXX_[entity]_sample_data.sql       # Sample data (optional)
└── XXX_[parent]_[child]_table.sql     # Child entities
```

> **📍 Context-Aware Paths:** Paths shown assume monorepo development. In consumer projects,
> create migrations in `migrations/` instead (use sequence 1001+). Core is read-only.
> See `core-theme-responsibilities` skill for complete rules.

## When to Use This Skill

- Creating new entity migrations
- Adding meta tables for entities
- Creating child entity relationships
- Validating migration conventions
- Generating sample data

## Core Principles

### 1. Better Auth Integration

**Better Auth uses TEXT for IDs, not UUID type:**

```sql
-- ✅ CORRECT
id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
"userId" TEXT NOT NULL REFERENCES public."users"(id) ON DELETE CASCADE,

-- ❌ WRONG
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
```

**Use existing functions (NEVER redefine):**
- `get_auth_user_id()` - Get current authenticated user ID
- `set_updated_at()` - Auto-update timestamp trigger

### 2. Field Ordering (MANDATORY)

Fields MUST follow this exact order:

```sql
CREATE TABLE IF NOT EXISTS public."EntityName" (
  -- 1. Primary Key (always first)
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- 2. Relational Fields (foreign keys)
  "userId"      TEXT NOT NULL REFERENCES public."users"(id) ON DELETE CASCADE,
  "teamId"      TEXT REFERENCES public."teams"(id) ON DELETE CASCADE,

  -- 3. Entity-specific Fields (business logic)
  title         TEXT NOT NULL,
  description   TEXT,
  content       JSONB,
  priority      INTEGER DEFAULT 0,

  -- 4. System Fields (always last)
  status        TEXT DEFAULT 'draft',
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3. TIMESTAMPTZ Requirement (CRITICAL)

**ALL timestamps MUST use `TIMESTAMPTZ`, never plain `TIMESTAMP`:**

```sql
-- ✅ CORRECT
"createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
"updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
"expiresAt"  TIMESTAMPTZ,

-- ❌ FORBIDDEN
"createdAt"  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
```

### 4. CASCADE Rules

```sql
-- ✅ Main entity tables - ALWAYS use CASCADE
DROP TABLE IF EXISTS public."EntityName" CASCADE;

-- ✅ Meta tables - NO DROP (removed by parent CASCADE)
CREATE TABLE IF NOT EXISTS public."EntityName_metas" (...);

-- ✅ Foreign Keys - Use CASCADE for parent-child
REFERENCES public."Parent"(id) ON DELETE CASCADE
```

## RLS Patterns (4 Cases)

> **Before writing core-table policies (beta.167):**
> - RLS primitives (`can_bypass_rls`, `auth_user_can_see_user`, `is_superadmin`) live in
>   migration **`001`** — a policy on an early table (e.g. `002`) that references a function
>   or table defined later fails at `CREATE POLICY` time. Wrap forward-dependent logic in a
>   `SECURITY DEFINER` helper in `001` (table refs resolve at call time).
> - **`team_role` is `TEXT`** (not an ENUM): `role TEXT NOT NULL DEFAULT 'member'`. Never
>   `ALTER TYPE team_role`.
> - For the runtime model (service pool, `nextspark_app`, cutover) see the **rls-enforcement** skill.
> - **Your own helper functions go in a sub-select too:** `id = ANY ((SELECT public.my_ids())::text[])`, not
>   `id = ANY (public.my_ids())`, which runs once per row (migration 043 rewrites only core's four helpers). Inside the
>   function, compare with `(SELECT public.get_auth_user_id())`: the bare call is `VOLATILE` and keeps the index unused.
>   A function that takes a column of the row cannot be wrapped: return the whole set once instead. See "Your own helper
>   functions" in `docs/10-backend/03-rls-policies.md`.

### Case 1: Private to Owner
```sql
CREATE POLICY "Entity owner can do all"
ON public."Entity"
FOR ALL TO authenticated
USING ("userId" = (SELECT public.get_auth_user_id()))
WITH CHECK ("userId" = (SELECT public.get_auth_user_id()));
```

### Case 2: Team-Based Access
```sql
CREATE POLICY "Entity team can do all"
ON public."Entity"
FOR ALL TO authenticated
USING (
  "teamId" IN (
    SELECT "teamId" FROM public."members"
    WHERE "userId" = (SELECT public.get_auth_user_id())
  )
)
WITH CHECK (...);
```

### Case 3: Shared Among Authenticated
```sql
CREATE POLICY "Entity any auth can do all"
ON public."Entity"
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);
```

### Case 4: Public Read with Auth Write
```sql
-- Authenticated can manage all
CREATE POLICY "Entity auth can do all"
ON public."Entity"
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- (Supabase Data API ONLY) anonymous can read published rows
CREATE POLICY "Entity public can select"
ON public."Entity"
FOR SELECT TO anon
USING (published = TRUE);
```
> ⚠️ The **app does NOT use the `anon` role**. Public/unauthenticated reads enter with
> `userId = null` → **service pool (bypass)** and are filtered in SQL by the handler
> (e.g. `published = TRUE`). The `TO anon` policy above only matters if you expose the
> **Supabase PostgREST / Data API** (migration `022` revokes `anon` as defense for that
> surface). Don't rely on it for the app's public-read path.

## Meta Tables Pattern

**CRITICAL: Always use `"entityId"` for foreign key (never `"postId"`, `"userId"`, etc.)**

```sql
CREATE TABLE IF NOT EXISTS public."EntityName_metas" (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "entityId"     TEXT NOT NULL REFERENCES public."EntityName"(id) ON DELETE CASCADE,
  "metaKey"      TEXT NOT NULL,
  "metaValue"    JSONB NOT NULL DEFAULT '{}'::jsonb,
  "dataType"     TEXT,
  "isPublic"     BOOLEAN NOT NULL DEFAULT FALSE,
  "isSearchable" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT entity_metas_unique_key UNIQUE ("entityId", "metaKey")
);
```

## Child Entities Pattern

**CRITICAL: Always use `"parentId"` for foreign key (never `"clientId"`, `"orderId"`, etc.)**

```sql
CREATE TABLE IF NOT EXISTS public."parent_children" (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "parentId"      TEXT NOT NULL REFERENCES public."parent"(id) ON DELETE CASCADE,

  -- Child-specific fields (NO userId - inherited via parent)
  name            TEXT NOT NULL,
  description     TEXT,

  -- System fields
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS inherits parent access
CREATE POLICY "Child inherit parent access"
ON public."parent_children"
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."parent" p
    WHERE p.id = "parentId"
      AND p."userId" = (SELECT public.get_auth_user_id())
  )
)
WITH CHECK (...);
```

## Scripts

### Validate Migration Conventions
```bash
# Validate a specific migration file
python3 .claude/skills/database-migrations/scripts/validate-migration.py \
  --file core/migrations/017_scheduled_actions_table.sql

# Validate all migrations
python3 .claude/skills/database-migrations/scripts/validate-migration.py \
  --path core/migrations/

# Strict mode (exit with error if issues found)
python3 .claude/skills/database-migrations/scripts/validate-migration.py \
  --path core/migrations/ \
  --strict
```

### Generate Sample Data
```bash
# Generate sample data for an entity
python3 .claude/skills/database-migrations/scripts/generate-sample-data.py \
  --entity posts \
  --count 20

# With custom team and user IDs
python3 .claude/skills/database-migrations/scripts/generate-sample-data.py \
  --entity tasks \
  --count 10 \
  --user-id "user-sample-1" \
  --team-id "team-tmt-001"

# Preview without writing
python3 .claude/skills/database-migrations/scripts/generate-sample-data.py \
  --entity products \
  --dry-run
```

## Required Indexes

```sql
-- ============================================
-- INDEXES
-- ============================================
-- Primary relationships
CREATE INDEX IF NOT EXISTS idx_entity_user_id          ON public."entity"("userId");
CREATE INDEX IF NOT EXISTS idx_entity_team_id          ON public."entity"("teamId");

-- Common query patterns
CREATE INDEX IF NOT EXISTS idx_entity_status           ON public."entity"(status);
CREATE INDEX IF NOT EXISTS idx_entity_created_at       ON public."entity"("createdAt" DESC);

-- Conditional indexes
CREATE INDEX IF NOT EXISTS idx_entity_published        ON public."entity"(published) WHERE published = TRUE;

-- JSONB indexes
CREATE INDEX IF NOT EXISTS idx_entity_payload_gin      ON public."entity" USING GIN (payload);
```

## Trigger Pattern

**Always use existing Better Auth function:**

```sql
-- ============================================
-- TRIGGER updatedAt (uses Better Auth function)
-- ============================================
DROP TRIGGER IF EXISTS entity_set_updated_at ON public."entity";
CREATE TRIGGER entity_set_updated_at
BEFORE UPDATE ON public."entity"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

## Authorization Invariants as Triggers (the lesson of migration 048)

`packages/core/migrations/048_oauth_provider.sql` adds the tables of the OAuth authorization server behind MCP
browser sign-in (see the `mcp-server` skill). Those rows are written by a library, Better Auth, from several of
its own endpoints and in separate statements (a token renewal reads the old token, marks it replaced, then
writes the new one). Core's code is not on those paths.

**Rule: when a library writes the rows, an authorization invariant over them is a trigger with a row lock, not
application code.** A check in a service or a route holds only for the paths you wrote. Examples from 048:

| Invariant | How |
|-----------|-----|
| A refresh token exists only while its connection's consent does, and holds no more than it | `BEFORE INSERT` trigger that reads the consent row `FOR SHARE`: raises when there is none, cuts `NEW.scopes` down otherwise |
| A consent that loses a scope takes it from the live tokens and refuses what was issued | `AFTER UPDATE OF scopes` trigger |
| A consent removed ends its connection for good | `AFTER DELETE` trigger that records a revocation and deletes the tokens |
| A changed password or a suspension ends every connection of the user | `AFTER UPDATE OF password` on `account`, `AFTER UPDATE OF role` on `users`, each with a `WHEN` clause |
| One consent per connection | Unique index `uq_oauth_consent_connection` on `("userId", "clientId", "referenceId")` |

What makes it correct under concurrency is the **lock**, not the trigger alone: the insert's `FOR SHARE` on the
consent row and the delete or update of that same row wait for each other, so a renewal in flight and a
disconnection can only happen in one order or the other. Decide which row orders the two writers and lock it
in both.

How to write one:

```sql
-- Idempotent: the file can be applied again without effect
CREATE OR REPLACE FUNCTION public.require_oauth_consent_for_refresh_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER              -- runs whatever role wrote the row
SET search_path = public      -- always with SECURITY DEFINER
AS $$ ... $$;

DROP TRIGGER IF EXISTS oauth_refresh_token_requires_consent ON public."oauthRefreshToken";
CREATE TRIGGER oauth_refresh_token_requires_consent
  BEFORE INSERT ON public."oauthRefreshToken"
  FOR EACH ROW
  EXECUTE FUNCTION public.require_oauth_consent_for_refresh_token();
```

- `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`,
  `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`, `DROP POLICY IF EXISTS` + `CREATE POLICY`.
- Narrow the trigger with `UPDATE OF <column>` and a `WHEN (...)` clause so it does not fire on unrelated writes.
- Know how the library reacts to a raised exception before you raise: 048 cuts a token down instead of refusing
  it because refusing after the old token was marked replaced would leave the connection with no token.
- **Service-only RLS on library-owned tables.** The library reads and writes them with no user context, so every
  policy is `FOR ALL TO authenticated USING (public.can_bypass_rls()) WITH CHECK (public.can_bypass_rls())`.
  Core reads them on the service connection (see `rls-enforcement`).
- **Test it against a real PostgreSQL**, with two connections to prove the lock ordering
  (`packages/core/tests/node/oauth-connections-pg.test.ts`, see `jest-unit`). A unit test with mocked queries runs
  no trigger.

### One migration file per feature, until it is published

While a feature is unreleased, everything it needs stays in its one migration file: 048 changed in several
commits of its branch, and the branch adds no other migration and changes no existing one. Once a migration is published
(merged and released, so projects may have applied it), **never edit it**: a change goes in a new migration.
Editing a published file changes nothing on databases that already ran it.

## Naming Conventions

| Convention | Example |
|------------|---------|
| Table names | camelCase: `"scheduledActions"` |
| Column names | camelCase: `"createdAt"`, `"userId"` |
| Index names | snake_case: `idx_entity_user_id` |
| Policy names | "Entity action description" |
| Constraint names | snake_case: `entity_metas_unique_key` |

## Anti-Patterns

```sql
-- ❌ NEVER: Plain TIMESTAMP
"createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP

-- ❌ NEVER: UUID type (Better Auth uses TEXT)
id UUID PRIMARY KEY DEFAULT gen_random_uuid()

-- ❌ NEVER: Redefine auth functions
CREATE OR REPLACE FUNCTION public.get_auth_user_id()...

-- ❌ NEVER: Wrong meta FK naming
"postId" TEXT NOT NULL REFERENCES public."posts"(id)
-- ✅ CORRECT: "entityId"

-- ❌ NEVER: Wrong child FK naming
"clientId" TEXT NOT NULL REFERENCES public."clients"(id)
-- ✅ CORRECT: "parentId"

-- ❌ NEVER: Business logic in DB triggers
CREATE FUNCTION calculate_order_totals()...
-- (An authorization invariant over rows a library writes is not business logic: it belongs in a trigger.
--  See "Authorization Invariants as Triggers".)

-- ❌ NEVER: Edit a published migration
-- ✅ CORRECT: A new migration file

-- ❌ NEVER: CREATE TRIGGER without DROP TRIGGER IF EXISTS, or CREATE FUNCTION without OR REPLACE
```

## Checklist

Before finalizing a migration:

- [ ] Uses TEXT for all ID fields (not UUID type)
- [ ] References `public."users"` for user relationships
- [ ] Uses `get_auth_user_id()` in RLS (not redefined)
- [ ] Uses `set_updated_at()` in triggers (not redefined)
- [ ] ALL timestamps use `TIMESTAMPTZ` (not `TIMESTAMP`)
- [ ] Uses `now()` (not `CURRENT_TIMESTAMP`)
- [ ] Fields follow strict ordering (id → FK → business → system)
- [ ] Main tables use `DROP ... CASCADE`
- [ ] Meta tables use `"entityId"` (not entity-specific name)
- [ ] Child tables use `"parentId"` (not parent-specific name)
- [ ] Appropriate RLS policies for access pattern
- [ ] Required indexes created
- [ ] Sample data uses `ON CONFLICT` clause
- [ ] The file can be applied twice without error or effect (`IF NOT EXISTS`, `OR REPLACE`, `DROP ... IF EXISTS`)
- [ ] An invariant over rows a library writes is a trigger with a row lock, tested against a real PostgreSQL
- [ ] Library-owned tables have service-only RLS policies
- [ ] No published migration was edited; an unpublished feature keeps a single migration file
