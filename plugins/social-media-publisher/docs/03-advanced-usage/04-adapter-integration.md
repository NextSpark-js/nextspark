# Adapter Integration

The plugin is entity-agnostic. It connects a social account once per user (the OAuth tokens live, encrypted, in `social_accounts`), and your project decides which of its own entities (a client, a project, a team) uses that account. The project tells the plugin how through an **adapter**: a class that extends `SocialPlatformAdapter`.

```text
PLUGIN LEVEL   social_accounts                      OAuth tokens, encrypted, one per platform account of a user
                    ↑ socialAccountId
PROJECT LEVEL  {entity}_social_platforms            Links an entity to a social account; stores no tokens
```

The plugin's routes need an adapter. Without one they throw `No adapter registered`: the plugin does not look for the adapter on its own, so the project registers it at application startup.

## 1. Create the adapter

```typescript
// lib/social-media/projects-adapter.ts
import {
  SocialPlatformAdapter,
  type SocialPlatformAdapterConfig,
  type AssignmentData,
  type SocialPlatformAssignment,
  type EntityAccessResult,
  type SaveAssignmentResult,
  type AccountLookupResult,
} from '@nextsparkjs/plugin-social-media-publisher/lib/adapter'

const CONFIG: SocialPlatformAdapterConfig = {
  entitySlug: 'projects',                  // your entity
  tableName: 'projects_social_platforms',  // your assignment table
  parentIdColumn: 'projectId',             // foreign key to the entity
  permissionCheck: 'team',                 // 'team' | 'owner' | 'custom'
}

export class ProjectsSocialPlatformAdapter extends SocialPlatformAdapter {
  constructor() {
    super(CONFIG)
  }

  async checkEntityAccess(userId: string, entityId: string): Promise<EntityAccessResult> {
    // Return { hasAccess, teamId?, reason? }.
    // teamId is the entity's team, one the user belongs to: the audit row of the action is recorded in it
    // (another team is ignored and the request's team is used).
  }

  async getAssignments(entityId: string, userId: string): Promise<SocialPlatformAssignment[]> {
    // The entity's assignments, with the tokens from a join on social_accounts
  }

  async getAssignedPlatformIds(entityId: string, userId: string): Promise<Set<string>> {
    // The platformAccountId values already assigned to the entity
  }

  async saveAssignment(data: AssignmentData, userId: string): Promise<SaveAssignmentResult> {
    // Upsert by entityId + platformAccountId; return { id, isNew }
  }

  async removeAssignment(assignmentId: string, userId: string): Promise<void> {
    // Soft delete: set isActive = false
  }

  async getAccountById(accountId: string, platform: string, userId: string): Promise<AccountLookupResult | null> {
    // A light lookup by assignment id and platform that returns the parent entity id (no tokens);
    // the publish route uses it to find the account and check access
  }
}
```

Run your queries with the user's id (`queryWithRLS` and `mutateWithRLS` from `@nextsparkjs/core/lib/db`) so row-level security applies.

## 2. Register it

Register an instance once, when the application starts, before any of the plugin's routes runs:

```typescript
import { registerSocialPlatformAdapter } from '@nextsparkjs/plugin-social-media-publisher/lib/adapter'
import { ProjectsSocialPlatformAdapter } from './projects-adapter'

registerSocialPlatformAdapter(new ProjectsSocialPlatformAdapter())
```

The module also exports `getSocialPlatformAdapter`, `hasAdapter`, `ensureAdapter`, `clearAdapter` and `getAdapterInfo`.

## 3. Create the assignment table

A migration of your project:

```sql
CREATE TABLE IF NOT EXISTS "projects_social_platforms" (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "projectId"         TEXT NOT NULL REFERENCES "projects"(id) ON DELETE CASCADE,
  platform            TEXT NOT NULL,
  "platformAccountId" TEXT,
  "username"          TEXT,
  "socialAccountId"   UUID REFERENCES "social_accounts"(id) ON DELETE SET NULL,
  permissions         JSONB DEFAULT '[]'::jsonb,
  "accountMetadata"   JSONB DEFAULT '{}'::jsonb,
  "isActive"          BOOLEAN DEFAULT true,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "projects_social_platforms_account_key"
  ON "projects_social_platforms" ("projectId", "platformAccountId")
  WHERE "platformAccountId" IS NOT NULL;
```

Add the indexes and the row-level security policies your entity needs.
