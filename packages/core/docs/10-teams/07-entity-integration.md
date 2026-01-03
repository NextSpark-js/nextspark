---
title: Entity Integration
description: Adding team isolation to entities
---

# Entity Integration

This guide explains how to add team isolation to entities, enabling multi-tenant data separation.

## Overview

Team isolation ensures that:
1. Users can only see data from teams they belong to
2. Data created in one team is invisible to other teams
3. Superadmins can access all data across teams

## Adding Team Isolation to an Entity

### Step 1: Database Migration

Add a `teamId` column to your entity table:

```sql
-- migrations/XXX_add_team_to_your_entity.sql

-- Add teamId column
ALTER TABLE public."your_entity"
ADD COLUMN IF NOT EXISTS "teamId" TEXT REFERENCES public."teams"(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_your_entity_team
ON public."your_entity"("teamId");

-- Enable RLS if not already enabled
ALTER TABLE public."your_entity" ENABLE ROW LEVEL SECURITY;

-- Create team isolation policy
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

### Step 2: Update Entity Schema

Add `teamId` to your Zod schema:

```typescript
// entities/your-entity/schema.ts
import { z } from 'zod'

export const yourEntitySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  // ... other fields

  // Team isolation
  teamId: z.string(),

  // Audit fields
  createdBy: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const createYourEntitySchema = yourEntitySchema.omit({
  id: true,
  teamId: true, // Set automatically from context
  createdBy: true,
  createdAt: true,
  updatedAt: true,
})
```

### Step 3: Update Entity Config

Configure team isolation in your entity config:

```typescript
// entities/your-entity/config.ts
import { EntityConfig } from '@/core/lib/entities/types'

export const yourEntityConfig: EntityConfig = {
  slug: 'your-entity',
  name: {
    singular: 'Item',
    plural: 'Items',
  },

  // Enable team isolation
  features: {
    teamIsolation: true,
  },

  // Configure sharing behavior
  access: {
    // true = all team members see all records
    // false = users only see their own records
    shared: true,
  },

  fields: [
    // ... your fields
  ],
}
```

### Step 4: API Handler Updates

The generic API handler automatically handles team isolation when configured:

```typescript
// For custom endpoints, include teamId in queries

// GET - Filter by team
const items = await queryWithRLS(
  `SELECT * FROM "your_entity"
   WHERE "teamId" = $1
   ORDER BY "createdAt" DESC`,
  [teamId],
  userId
)

// POST - Include teamId in insert
const teamId = req.headers.get('x-team-id')

const [item] = await queryWithRLS(
  `INSERT INTO "your_entity" (name, "teamId", "createdBy")
   VALUES ($1, $2, $3)
   RETURNING *`,
  [name, teamId, userId],
  userId
)
```

## Two-Layer Security Model

### Layer 1: RLS (Team Isolation)

RLS policies filter by team membership:

```sql
-- User can only access records from their teams
CREATE POLICY "team_isolation" ON public."your_entity"
  FOR ALL TO authenticated
  USING (
    "teamId" = ANY(public.get_user_team_ids())
  );
```

### Layer 2: Application (User Isolation)

The `access.shared` config adds user-level filtering:

```typescript
// In API handler
if (!entityConfig.access.shared) {
  // Add user filter for non-shared entities
  whereClause += ` AND "createdBy" = $${paramIndex++}`
  params.push(userId)
}
```

### Combined Effect

| Entity Config | RLS Effect | App Effect |
|---------------|------------|------------|
| `shared: true` | Filter by teamId | Show all team records |
| `shared: false` | Filter by teamId | Show only user's records |

## Example: Tasks Entity

### Migration

```sql
-- migrations/XXX_add_team_to_tasks.sql

ALTER TABLE public."tasks"
ADD COLUMN IF NOT EXISTS "teamId" TEXT REFERENCES public."teams"(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tasks_team ON public."tasks"("teamId");

ALTER TABLE public."tasks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_team_isolation" ON public."tasks"
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

### Entity Config

```typescript
export const tasksConfig: EntityConfig = {
  slug: 'tasks',
  name: { singular: 'Task', plural: 'Tasks' },

  features: {
    teamIsolation: true,
  },

  access: {
    shared: false, // Users only see their own tasks
  },

  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'status', type: 'select', options: ['pending', 'done'] },
    { name: 'assignee', type: 'relation', target: 'users' },
  ],
}
```

## Handling Existing Data

When adding team isolation to an existing entity:

### Option 1: Assign to User's Team

```sql
-- Assign existing records to users' teams
UPDATE public."your_entity" e
SET "teamId" = (
  SELECT t.id FROM public."teams" t
  WHERE t."ownerId" = e."createdBy"
  LIMIT 1
)
WHERE e."teamId" IS NULL;
```

### Option 2: Create Migration Script

```javascript
// scripts/migrate-entities-to-teams.mjs
import { query } from '../core/lib/db.js'

async function migrateToTeams() {
  // Get all records without teamId
  const orphanedRecords = await query(
    `SELECT * FROM "your_entity" WHERE "teamId" IS NULL`
  )

  for (const record of orphanedRecords) {
    // Find user's team (the one they own)
    const [userTeam] = await query(
      `SELECT id FROM "teams"
       WHERE "ownerId" = $1
       ORDER BY "createdAt" ASC
       LIMIT 1`,
      [record.createdBy]
    )

    if (userTeam) {
      await query(
        `UPDATE "your_entity" SET "teamId" = $1 WHERE id = $2`,
        [userTeam.id, record.id]
      )
    }
  }

  console.log(`Migrated ${orphanedRecords.length} records`)
}

migrateToTeams()
```

### Option 3: Make teamId Required After Migration

```sql
-- After migrating existing data, make teamId required
ALTER TABLE public."your_entity"
ALTER COLUMN "teamId" SET NOT NULL;
```

## Frontend Considerations

### Include Team Context in Requests

The middleware automatically adds `x-team-id` header:

```typescript
// middleware.ts adds this header
headers.set('x-team-id', activeTeamId)
```

For client-side requests, the team context is included automatically by the fetch wrapper.

### Create Forms

When creating records, teamId is set automatically:

```typescript
// In API handler
const teamId = req.headers.get('x-team-id')

// Or from auth context
const teamId = authResult.activeTeamId
```

### Data Fetching

TanStack Query automatically refetches when team changes:

```typescript
// useYourEntity hook
const { data } = useQuery({
  queryKey: ['your-entity', teamId],
  queryFn: () => fetchYourEntity(teamId),
})

// TeamContext clears cache on team switch
// Data is refetched automatically
```

## Testing Team Isolation

### Unit Test Pattern

```typescript
describe('Team Isolation', () => {
  it('should only return records from user teams', async () => {
    // Create two teams
    const team1 = await createTeam('Team 1', user1.id)
    const team2 = await createTeam('Team 2', user2.id)

    // Create records in each team
    await createRecord({ teamId: team1.id })
    await createRecord({ teamId: team2.id })

    // User1 should only see team1 records
    const records = await getRecordsForUser(user1.id)
    expect(records).toHaveLength(1)
    expect(records[0].teamId).toBe(team1.id)
  })
})
```

### E2E Test Pattern

```typescript
// cypress/e2e/team-isolation.cy.ts
describe('Team Isolation', () => {
  it('switches team and sees different data', () => {
    cy.login()

    // Create record in Team 1
    cy.switchTeam('team-1')
    cy.createRecord({ name: 'Team 1 Record' })

    // Switch to Team 2
    cy.switchTeam('team-2')

    // Should not see Team 1 record
    cy.get('[data-cy="record-list"]')
      .should('not.contain', 'Team 1 Record')
  })
})
```

## Related Documentation

- [Database Schema](./02-database-schema.md) - RLS policies
- [Permissions System](./06-permissions.md) - Access control
- [API Reference](./03-api-reference.md) - Endpoints
