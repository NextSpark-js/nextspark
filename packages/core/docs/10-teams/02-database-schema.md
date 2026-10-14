---
title: Database Schema
description: Teams database tables, RLS policies, and migrations
---

# Database Schema

The Teams system uses three main tables with PostgreSQL Row Level Security (RLS) for data isolation.

## Migration Files

The schema is split across four migration files:

| File | Description |
|------|-------------|
| `007_teams_table.sql` | ENUMs, teams table, indexes, triggers |
| `008_team_members_table.sql` | Team members junction table |
| `009_team_invitations_table.sql` | Invitation system |
| `010_teams_functions_triggers.sql` | Helper functions and RLS policies |

## Roles & ENUM Types

> **Changed in beta.167:** team roles are stored as **`TEXT`**, not a Postgres ENUM.
> Themes extend team roles purely via config (`availableTeamRoles` in `app.config.ts` +
> `permissions.config.ts`) — no `ALTER TYPE`. No privilege boundary is lost: RLS policies
> compare against explicit literals (`'owner'`, `'admin'`, …) and an unknown role fails
> closed. Value integrity is enforced at the app layer (zod + the permissions registry),
> so no DB `CHECK` constraint is added (it would block theme roles). The base roles are
> `'owner'`, `'admin'`, `'member'`, `'viewer'`.

```sql
-- Team member roles: stored as TEXT (see note above). NOT a Postgres ENUM.
-- team_members.role / team_invitations.role are: TEXT NOT NULL DEFAULT 'member'

-- Invitation status lifecycle (still an ENUM)
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined', 'expired');
```

## Teams Table

```sql
CREATE TABLE IF NOT EXISTS public."teams" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  "ownerId" TEXT NOT NULL REFERENCES public."users"(id) ON DELETE RESTRICT,
  "avatarUrl" TEXT,
  settings JSONB DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT name_length CHECK (length(name) >= 2 AND length(name) <= 100)
);
```

### Indexes

```sql
CREATE INDEX idx_teams_owner ON public."teams"("ownerId");
CREATE INDEX idx_teams_slug ON public."teams"(slug);
CREATE INDEX idx_teams_created ON public."teams"("createdAt" DESC);
```

### Triggers

| Trigger | Description |
|---------|-------------|
| `teams_set_updated_at` | Auto-update `updatedAt` on row changes |

## Team Members Table

```sql
CREATE TABLE IF NOT EXISTS public."team_members" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "teamId" TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES public."users"(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',  -- TEXT (not ENUM); themes extend roles via config
  "invitedBy" TEXT REFERENCES public."users"(id),
  "joinedAt" TIMESTAMPTZ DEFAULT now(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A user can only have one role per team
  UNIQUE("teamId", "userId")
);
```

### Indexes

```sql
CREATE INDEX idx_team_members_team ON public."team_members"("teamId");
CREATE INDEX idx_team_members_user ON public."team_members"("userId");
CREATE INDEX idx_team_members_role ON public."team_members"(role);
CREATE INDEX idx_team_members_joined ON public."team_members"("joinedAt");

-- Composite index for common queries
CREATE INDEX idx_team_members_user_role ON public."team_members"("userId", role);
```

## Team Invitations Table

```sql
CREATE TABLE IF NOT EXISTS public."team_invitations" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "teamId" TEXT NOT NULL REFERENCES public."teams"(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',  -- TEXT (not ENUM); themes extend roles via config
  status invitation_status NOT NULL DEFAULT 'pending',
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  "invitedBy" TEXT NOT NULL REFERENCES public."users"(id),
  "expiresAt" TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  "acceptedAt" TIMESTAMPTZ,
  "declinedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Validation: email format
  CONSTRAINT valid_email CHECK (
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  ),

  -- Only one pending invitation per email and team
  CONSTRAINT unique_pending_invitation UNIQUE ("teamId", email, status)
    DEFERRABLE INITIALLY DEFERRED
);
```

### Indexes

```sql
CREATE INDEX idx_invitations_team ON public."team_invitations"("teamId");
CREATE INDEX idx_invitations_email ON public."team_invitations"(email);
CREATE INDEX idx_invitations_token ON public."team_invitations"(token);
CREATE INDEX idx_invitations_status ON public."team_invitations"(status);
CREATE INDEX idx_invitations_expires ON public."team_invitations"("expiresAt")
  WHERE status = 'pending';

-- Partial unique index for pending invitations only
CREATE UNIQUE INDEX idx_unique_pending_invitation
  ON public."team_invitations" ("teamId", email)
  WHERE status = 'pending';
```

## Helper Functions

### get_user_team_ids()

Returns an array of team IDs the current user belongs to:

```sql
CREATE OR REPLACE FUNCTION public.get_user_team_ids()
RETURNS TEXT[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT "teamId"
    FROM public."team_members"
    WHERE "userId" = public.get_auth_user_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

### is_superadmin()

Checks if the current user is a superadmin:

```sql
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public."users"
    WHERE id = public.get_auth_user_id()
    AND role = 'superadmin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

## Row Level Security (RLS) Policies

### Teams Policies

```sql
-- Users can see teams they are members of
CREATE POLICY "teams_select_policy" ON public."teams"
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT "teamId" FROM public."team_members"
      WHERE "userId" = public.get_auth_user_id()
    )
  );

-- Any authenticated user can create teams (becomes owner)
CREATE POLICY "teams_insert_policy" ON public."teams"
  FOR INSERT TO authenticated
  WITH CHECK (
    "ownerId" = public.get_auth_user_id()
  );

-- Only owners and admins can update teams (migration 035)
CREATE POLICY "teams_update_policy" ON public."teams"
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR "ownerId" = public.get_auth_user_id()
    OR public.auth_team_role(id) IN ('owner', 'admin')
  )
  WITH CHECK (
    public.is_superadmin()
    OR "ownerId" = public.get_auth_user_id()
    OR public.auth_team_role(id) IN ('owner', 'admin')
  );
-- The teams_rls_update_limits trigger: on the RLS connection an admin changes only name, slug, description,
-- "avatarUrl" and settings, and only a superadmin or a developer (can_bypass_rls()) changes "ownerId" (an ownership transfer runs on the
-- service connection).

-- Only owners can delete teams
CREATE POLICY "teams_delete_policy" ON public."teams"
  FOR DELETE TO authenticated
  USING (
    "ownerId" = public.get_auth_user_id()
    OR public.is_superadmin()
  );
```

### Team Members Policies

```sql
-- A user sees their own memberships and the members of their teams (migration 032)
CREATE POLICY "team_members_select_policy" ON public."team_members"
  FOR SELECT TO authenticated
  USING (
    "userId" = public.get_auth_user_id()
    OR "teamId" IN (SELECT public.get_user_team_ids(public.get_auth_user_id()))
  );

-- Self-join (the role of a pending invitation, or the owner of an empty team they own: migration 032),
-- or the owner or an admin adding a role below their own (migration 039)
CREATE POLICY "team_members_insert_policy" ON public."team_members"
  FOR INSERT TO authenticated
  WITH CHECK (
    ("userId" = public.get_auth_user_id() AND public.auth_can_join_team("teamId", role))
    OR public.auth_can_manage_member("teamId", role)
  );

-- The owner changes any row but the owner's, an admin a row that is neither owner nor admin (migration 033)
CREATE POLICY "team_members_update_policy" ON public."team_members"
  FOR UPDATE TO authenticated
  USING (public.auth_can_manage_member("teamId", role))
  WITH CHECK (public.auth_can_manage_member("teamId", role));

-- The same hierarchy removes members; anyone but the owner leaves on their own (migration 033)
CREATE POLICY "team_members_delete_policy" ON public."team_members"
  FOR DELETE TO authenticated
  USING (
    public.auth_can_manage_member("teamId", role)
    OR ("userId" = public.get_auth_user_id() AND role <> 'owner')
  );
```

`auth_can_manage_member(team, role)` is true when `role` is not `owner` and the caller is the team's owner, or its admin and `role` is not `admin`. A `SELECT ... FOR SHARE` or `FOR UPDATE` on `team_members` also has to pass the UPDATE policy, so on the `nextspark_app` connection it returns no row the caller cannot manage.

### Team Invitations Policies

```sql
-- Invitations visible to invitee or team members
CREATE POLICY "invitations_select_policy" ON public."team_invitations"
  FOR SELECT TO authenticated
  USING (
    email = (SELECT email FROM public."users" WHERE id = public.get_auth_user_id())
    OR
    "teamId" IN (
      SELECT "teamId" FROM public."team_members"
      WHERE "userId" = public.get_auth_user_id()
    )
  );

-- Owners and admins can create invitations
CREATE POLICY "invitations_insert_policy" ON public."team_invitations"
  FOR INSERT TO authenticated
  WITH CHECK (
    "teamId" IN (
      SELECT "teamId" FROM public."team_members"
      WHERE "userId" = public.get_auth_user_id()
      AND role IN ('owner', 'admin')
    )
    AND "invitedBy" = public.get_auth_user_id()
    AND status = 'pending'
  );
```

## Adding Team Isolation to Entities

To add team isolation to an entity, add a `teamId` column with RLS:

```sql
-- Add teamId column to your entity table
ALTER TABLE public."your_entity"
ADD COLUMN IF NOT EXISTS "teamId" TEXT REFERENCES public."teams"(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_your_entity_team ON public."your_entity"("teamId");

-- Enable RLS
ALTER TABLE public."your_entity" ENABLE ROW LEVEL SECURITY;

-- RLS policy for team isolation
CREATE POLICY "your_entity_team_isolation" ON public."your_entity"
  FOR ALL TO authenticated
  USING (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  )
  WITH CHECK (
    "teamId" = ANY(public.get_user_team_ids())
    OR public.is_superadmin()
  );
```

## Running Migrations

```bash
# Run all pending migrations
pnpm db:migrate

# Inspect the affected team tables with your database client
```

The repository's `verify-tables.mjs` diagnostic only inspects Better Auth
tables; it does not verify the teams schema.

## Related Documentation

- [Entity Integration](./07-entity-integration.md) - Adding teamId to entities
- [API Reference](./03-api-reference.md) - Team endpoints
- [Permissions System](./06-permissions.md) - Role-based access control
