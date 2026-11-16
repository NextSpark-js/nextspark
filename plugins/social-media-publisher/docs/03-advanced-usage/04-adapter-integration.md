# Adapter Integration

The plugin is entity-agnostic. It connects a social account once per user (the OAuth tokens live, encrypted, in `social_accounts`), and your project decides which of its own entities (a client, a project, a team) uses that account. The project tells the plugin how through an **adapter**: a class that extends `SocialPlatformAdapter`.

```text
PLUGIN LEVEL   social_accounts                      OAuth tokens, encrypted, one per platform account of a user
                    ↑ socialAccountId
PROJECT LEVEL  {entity}_social_platforms            Links an entity to a social account; stores no tokens
```

The plugin does not look for the adapter on its own: the project registers it when the server starts (step 2). What needs it, and what works without it:

| Route | Without an adapter |
| --- | --- |
| `GET .../social/accounts` | Lists the user's connected accounts (`alreadyAssignedToEntity: false`, `connectedClients: []`, `entitySlug: null`). With `?entityId=` it answers 501 |
| `POST .../social/assign`, `POST .../social/publish` | 501 |
| `GET .../social/connect/callback` | The OAuth popup shows an error saying the project has not registered its adapter |
| `GET .../social/connect`, `POST .../social/disconnect`, `GET /api/v1/audit-logs` | Work: they use only the plugin's tables |

The 501 body says what is missing and links here:

```json
{
  "error": "No social platform adapter is registered. The project registers one with registerSocialPlatformAdapter() from the register() of its src/instrumentation.ts.",
  "code": "SOCIAL_ADAPTER_NOT_REGISTERED",
  "guide": "https://github.com/NextSpark-js/nextspark/blob/main/plugins/social-media-publisher/docs/03-advanced-usage/04-adapter-integration.md"
}
```

The plugin's routes query only the plugin's tables (`social_accounts`, `social_audit_logs`). Everything about your entities (access, assignments, which entities use an account, where a published post is recorded) goes through the adapter.

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
  type ConnectedEntity,
  type PublishedPost,
} from '@/plugins/social-media-publisher/lib/adapter'

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

  // Optional (the default returns an empty map): the entities that use each platform account the user can see,
  // keyed by platformAccountId. The accounts route shows them as `connectedClients` on each account.
  async getConnectedEntities(userId: string): Promise<Map<string, ConnectedEntity[]>> {
    // e.g. SELECT "platformAccountId", p.id, p.name FROM projects_social_platforms JOIN projects p ...
  }

  // Optional (the default does nothing): called after a successful post when the publish request names an
  // `entityId` (your content record), to store post.postId, post.postUrl and post.publishedAt on it. A failure is
  // logged and does not fail the request.
  async recordPublishedPost(post: PublishedPost, userId: string): Promise<void> {
    // e.g. UPDATE your content table SET the post's reference WHERE id = post.entityId
  }
}
```

The import path above is the copy of the plugin in your project's `plugins/` (what `create-nextspark-app --plugins` and `nextspark add:plugin` leave). With the package installed in `node_modules` instead, import from `@nextsparkjs/plugin-social-media-publisher/lib/adapter`.

Run your queries with the user's id (`queryWithRLS` and `mutateWithRLS` from `@nextsparkjs/core/lib/db`) so row-level security applies.

## 2. Register it

Register an instance once, when the server starts, from the `register()` of your project's `src/instrumentation.ts`: Next.js runs it once at startup, before any route, in development and production, and core's own startup runs from the same function. The project owns this file; it starts as a re-export of core's `register()`, so replace that line with your own `register()` that calls core's first:

```typescript
// src/instrumentation.ts
import { register as registerNextSpark } from '@nextsparkjs/core/instrumentation'

export async function register() {
  await registerNextSpark()

  // Node.js only: the adapter queries the database, which the edge runtime cannot
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerSocialPlatformAdapter } = await import('@/plugins/social-media-publisher/lib/adapter')
    const { ProjectsSocialPlatformAdapter } = await import('@/lib/social-media/projects-adapter')
    registerSocialPlatformAdapter(new ProjectsSocialPlatformAdapter())
  }
}
```

The server logs `[social-media-publisher] Adapter registered for entity: projects` at startup. `register()` runs once per server start: under `next dev`, a change to the adapter or to this file takes effect when you restart the server, not on a hot reload. The registration lives on `globalThis`, so the routes see it even though Next.js bundles them apart from `instrumentation.ts`.

The module also exports `getSocialPlatformAdapter`, `hasAdapter`, `ensureAdapter`, `clearAdapter` and `getAdapterInfo`, and `adapterRequiredResponse()`, the 501 above, for your own routes that need the adapter.

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
