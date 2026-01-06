# Per-Client Architecture

## Overview

The Social Media Publisher plugin implements a **per-client architecture** where social media accounts are managed as **child entities** of clients. This pattern provides clear ownership, better organization for agencies, and scalable multi-client management.

**Key Concept:** Social accounts belong to **clients**, not directly to users. Users access social accounts through their client relationships.

## Architecture Pattern

### Entity Hierarchy

```
User (parent)
  └── Client (child of user)
      └── Social Platform (child of client)
          ├── Instagram Business Account #1
          ├── Instagram Business Account #2
          ├── Facebook Page #1
          └── Facebook Page #2
```

**Example:**
```
User: john@agency.com
  └── Client: "Acme Corp"
      ├── Instagram: @acmecorp
      ├── Instagram: @acmeproducts
      └── Facebook: "Acme Official"
  └── Client: "Widget Co"
      ├── Instagram: @widgetco
      └── Facebook: "Widget Company"
```

## Database Schema

### Core Tables

**clients (Parent Entity):**
```sql
CREATE TABLE "clients" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,        -- Owner user
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  email TEXT,
  status TEXT DEFAULT 'active',
  "createdAt" TIMESTAMPTZ DEFAULT now(),
  "updatedAt" TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX "idx_clients_userId" ON "clients"("userId");
```

**clients_social_platforms (Child Entity):**
```sql
CREATE TABLE "clients_social_platforms" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "parentId" UUID NOT NULL REFERENCES "clients"(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,                     -- 'instagram_business' | 'facebook_page'
  "platformAccountId" TEXT,                   -- Instagram ID or Facebook Page ID
  "platformAccountName" TEXT NOT NULL,        -- @username or Page name
  "accessToken" TEXT NOT NULL,                -- Encrypted: 'encrypted:iv:keyId'
  "tokenExpiresAt" TIMESTAMPTZ NOT NULL,
  permissions JSONB DEFAULT '[]',
  "accountMetadata" JSONB DEFAULT '{}',
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMPTZ DEFAULT now(),
  "updatedAt" TIMESTAMPTZ DEFAULT now(),
  
  -- Prevent duplicate connections per client
  UNIQUE("parentId", "platformAccountId") 
    WHERE "platformAccountId" IS NOT NULL
);

CREATE INDEX "idx_social_platforms_parentId" 
  ON "clients_social_platforms"("parentId");
  
CREATE INDEX "idx_social_platforms_platform" 
  ON "clients_social_platforms"(platform);
```

### Relationships

**Parent-Child Relationship:**
```sql
-- Cascading delete: Remove social accounts when client deleted
"parentId" UUID NOT NULL REFERENCES "clients"(id) ON DELETE CASCADE
```

**User-Client Relationship:**
```sql
-- User owns multiple clients
SELECT c.* FROM "clients" c WHERE c."userId" = $1
```

**Client-Social Platform Relationship:**
```sql
-- Client has multiple social platforms
SELECT csp.* FROM "clients_social_platforms" csp WHERE csp."parentId" = $1
```

## Row-Level Security (RLS)

### Security Policies

**Purpose:** Ensure users can only access social platforms for clients they own.

**clients Table Policies:**
```sql
-- Enable RLS
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;

-- Users can only see their own clients
CREATE POLICY "clients_select_own"
  ON "clients" FOR SELECT
  USING ("userId" = current_setting('app.current_user_id', true));

-- Users can only insert clients for themselves
CREATE POLICY "clients_insert_own"
  ON "clients" FOR INSERT
  WITH CHECK ("userId" = current_setting('app.current_user_id', true));

-- Users can only update their own clients
CREATE POLICY "clients_update_own"
  ON "clients" FOR UPDATE
  USING ("userId" = current_setting('app.current_user_id', true));

-- Users can only delete their own clients
CREATE POLICY "clients_delete_own"
  ON "clients" FOR DELETE
  USING ("userId" = current_setting('app.current_user_id', true));
```

**clients_social_platforms Table Policies:**
```sql
-- Enable RLS
ALTER TABLE "clients_social_platforms" ENABLE ROW LEVEL SECURITY;

-- Users can only see social platforms for their clients
CREATE POLICY "social_platforms_select_own"
  ON "clients_social_platforms" FOR SELECT
  USING (
    "parentId" IN (
      SELECT id FROM "clients"
      WHERE "userId" = current_setting('app.current_user_id', true)
    )
  );

-- Users can only insert social platforms for their clients
CREATE POLICY "social_platforms_insert_own"
  ON "clients_social_platforms" FOR INSERT
  WITH CHECK (
    "parentId" IN (
      SELECT id FROM "clients"
      WHERE "userId" = current_setting('app.current_user_id', true)
    )
  );

-- Users can only update social platforms for their clients
CREATE POLICY "social_platforms_update_own"
  ON "clients_social_platforms" FOR UPDATE
  USING (
    "parentId" IN (
      SELECT id FROM "clients"
      WHERE "userId" = current_setting('app.current_user_id', true)
    )
  );

-- Users can only delete social platforms for their clients
CREATE POLICY "social_platforms_delete_own"
  ON "clients_social_platforms" FOR DELETE
  USING (
    "parentId" IN (
      SELECT id FROM "clients"
      WHERE "userId" = current_setting('app.current_user_id', true)
    )
  );
```

### RLS Enforcement

**Setting User Context:**
```typescript
import { query } from '@/core/lib/db'

async function queryWithRLS<T>(
  sql: string,
  params: any[],
  userId: string
): Promise<T> {
  // Set user context for RLS
  await query(`SET LOCAL app.current_user_id = $1`, [userId])
  
  // Execute query (RLS automatically enforced)
  const result = await query(sql, params)
  
  return result.rows as T
}
```

**Example Usage:**
```typescript
// Get client's social platforms (RLS enforced)
const platforms = await queryWithRLS(
  `SELECT * FROM "clients_social_platforms" WHERE "parentId" = $1`,
  [clientId],
  userId  // Current user ID
)

// If user doesn't own the client, no results returned
```

## Entity API Endpoints

### Dynamic Entity API

The plugin leverages the boilerplate's dynamic entity system:

**Base Pattern:**
```
/api/v1/entity/clients/{clientId}/social-platforms
```

**Available Endpoints:**

**1. List Social Platforms for Client:**
```
GET /api/v1/entity/clients/{clientId}/social-platforms
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "parentId": "client-uuid",
      "platform": "instagram_business",
      "platformAccountId": "17841401234567890",
      "platformAccountName": "@brandname",
      "tokenExpiresAt": "2024-03-15T10:30:00Z",
      "isActive": true,
      "accountMetadata": {
        "profilePictureUrl": "https://...",
        "followersCount": 10500
      }
    }
  ],
  "total": 1
}
```

**2. Get Single Social Platform:**
```
GET /api/v1/entity/clients/{clientId}/social-platforms/{platformId}
```

**3. Update Social Platform:**
```
PATCH /api/v1/entity/clients/{clientId}/social-platforms/{platformId}
{
  "isActive": false
}
```

**4. Delete Social Platform:**
```
DELETE /api/v1/entity/clients/{clientId}/social-platforms/{platformId}
```

## Data Access Patterns

### Get Client's Social Accounts

```typescript
async function getClientSocialAccounts(
  clientId: string,
  userId: string
): Promise<SocialAccount[]> {
  const result = await query(`
    SELECT csp.*
    FROM "clients_social_platforms" csp
    JOIN "clients" c ON c.id = csp."parentId"
    WHERE csp."parentId" = $1
    AND c."userId" = $2
    AND csp."isActive" = true
    ORDER BY csp."createdAt" DESC
  `, [clientId, userId])
  
  return result.rows
}
```

### Get All Clients with Social Account Counts

```typescript
async function getClientsWithSocialCounts(
  userId: string
): Promise<ClientWithCounts[]> {
  const result = await query(`
    SELECT 
      c.*,
      COUNT(csp.id) FILTER (WHERE csp.platform = 'instagram_business') as instagram_count,
      COUNT(csp.id) FILTER (WHERE csp.platform = 'facebook_page') as facebook_count,
      COUNT(csp.id) as total_accounts
    FROM "clients" c
    LEFT JOIN "clients_social_platforms" csp 
      ON csp."parentId" = c.id AND csp."isActive" = true
    WHERE c."userId" = $1
    GROUP BY c.id
    ORDER BY c.name
  `, [userId])
  
  return result.rows
}
```

### Get Account with Client Context

```typescript
async function getAccountWithClient(
  accountId: string,
  userId: string
): Promise<AccountWithClient | null> {
  const result = await query(`
    SELECT 
      csp.*,
      c.id as "clientId",
      c.name as "clientName",
      c.slug as "clientSlug"
    FROM "clients_social_platforms" csp
    JOIN "clients" c ON c.id = csp."parentId"
    WHERE csp.id = $1
    AND c."userId" = $2
    AND csp."isActive" = true
  `, [accountId, userId])
  
  return result.rows[0] || null
}
```

## OAuth Flow with Per-Client Context

### Initiating OAuth

**Include clientId in OAuth state:**
```typescript
// Generate OAuth URL with clientId
const state = `${randomString}&platform=${platform}&clientId=${clientId}`

const oauthUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
  `client_id=${FACEBOOK_CLIENT_ID}&` +
  `redirect_uri=${callbackUrl}&` +
  `state=${encodeURIComponent(state)}&` +
  `scope=${scopes.join(',')}`

// Redirect to Facebook
```

### OAuth Callback

**Extract clientId from state and save accounts:**
```typescript
// Parse state parameter
const [randomState, platformParam, clientIdParam] = state.split('&')
const platform = platformParam.split('=')[1]
const clientId = clientIdParam.split('=')[1]

// Verify user owns client
const client = await query(`
  SELECT * FROM "clients"
  WHERE id = $1 AND "userId" = $2
`, [clientId, userId])

if (client.rowCount === 0) {
  return NextResponse.json({ error: 'Client not found' }, { status: 404 })
}

// Save social accounts under this client
for (const account of connectedAccounts) {
  await query(`
    INSERT INTO "clients_social_platforms" (
      "parentId",  -- Link to client
      platform,
      "platformAccountId",
      "platformAccountName",
      "accessToken",
      "tokenExpiresAt",
      permissions
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT ("parentId", "platformAccountId")
    DO UPDATE SET
      "accessToken" = EXCLUDED."accessToken",
      "tokenExpiresAt" = EXCLUDED."tokenExpiresAt",
      permissions = EXCLUDED.permissions,
      "isActive" = true,
      "updatedAt" = NOW()
  `, [
    clientId,  // Parent client ID
    platform,
    account.id,
    account.username || account.name,
    encryptedToken,
    expiresAt,
    JSON.stringify(permissions)
  ])
}
```

## Multi-Client Management

### Benefits of Per-Client Architecture

**1. Clear Ownership:**
- Social accounts belong to clients, not users
- Easy to understand "who owns what"
- Natural organization for agencies

**2. Scalability:**
```typescript
// Agency with 100 clients, each with 5 social accounts
// = 500 social accounts, clearly organized by client
```

**3. Easy Onboarding/Offboarding:**
```typescript
// Delete client = all social accounts cascade deleted
await query(`DELETE FROM "clients" WHERE id = $1`, [clientId])
// All social platforms automatically removed
```

**4. Team Collaboration:**
```typescript
// Multiple users can manage same client's social accounts
// (requires role/permission system)
await query(`
  INSERT INTO "client_collaborators" 
  ("clientId", "userId", role)
  VALUES ($1, $2, 'editor')
`, [clientId, collaboratorUserId])
```

### Example: Agency Dashboard

```typescript
// Get overview of all clients and their social accounts
async function getAgencyDashboard(userId: string) {
  const clients = await query(`
    SELECT 
      c.id,
      c.name,
      c.slug,
      json_agg(
        json_build_object(
          'id', csp.id,
          'platform', csp.platform,
          'accountName', csp."platformAccountName",
          'isActive', csp."isActive",
          'tokenExpiresAt', csp."tokenExpiresAt"
        ) ORDER BY csp."createdAt" DESC
      ) FILTER (WHERE csp.id IS NOT NULL) as social_accounts
    FROM "clients" c
    LEFT JOIN "clients_social_platforms" csp ON csp."parentId" = c.id
    WHERE c."userId" = $1
    GROUP BY c.id
    ORDER BY c.name
  `, [userId])
  
  return clients.rows.map(client => ({
    ...client,
    totalAccounts: client.social_accounts?.length || 0,
    activeAccounts: client.social_accounts?.filter(a => a.isActive).length || 0,
    expiringTokens: client.social_accounts?.filter(a => 
      new Date(a.tokenExpiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    ).length || 0
  }))
}
```

## Migration from User-Based to Client-Based

If you have existing social accounts tied to users, migrate to client-based:

```sql
-- Create default client for each user
INSERT INTO "clients" (id, "userId", name, slug)
SELECT 
  gen_random_uuid(),
  "userId",
  'Default Client',
  CONCAT('default-', "userId")
FROM "old_social_accounts"
GROUP BY "userId";

-- Migrate social accounts to clients
UPDATE "clients_social_platforms" csp
SET "parentId" = c.id
FROM "clients" c
WHERE c."userId" = csp."userId"  -- Old column
AND c.name = 'Default Client';

-- Drop old userId column
ALTER TABLE "clients_social_platforms" DROP COLUMN "userId";
```

## Best Practices

### Do's ✅

**1. Always Use RLS:**
```typescript
// Set user context for all queries
await query(`SET LOCAL app.current_user_id = $1`, [userId])
```

**2. Validate Client Ownership:**
```typescript
// Verify user owns client before operations
const client = await query(`
  SELECT * FROM "clients"
  WHERE id = $1 AND "userId" = $2
`, [clientId, userId])

if (client.rowCount === 0) {
  throw new Error('Client not found')
}
```

**3. Use Cascading Deletes:**
```sql
-- Let database handle cleanup
REFERENCES "clients"(id) ON DELETE CASCADE
```

**4. Include Client Context in Audit Logs:**
```typescript
await logAudit('post_published', {
  accountId,
  clientId: account.parentId,
  clientName: client.name,
  ...
})
```

### Don'ts ❌

**1. Don't Query Without Client Context:**
```typescript
// ❌ Bad: Direct social platform query
SELECT * FROM "clients_social_platforms" WHERE id = $1

// ✅ Good: Join with clients for ownership check
SELECT csp.* 
FROM "clients_social_platforms" csp
JOIN "clients" c ON c.id = csp."parentId"
WHERE csp.id = $1 AND c."userId" = $2
```

**2. Don't Skip RLS:**
```typescript
// ❌ Bad: Raw query without user context
await query(`SELECT * FROM "clients_social_platforms"`)

// ✅ Good: Set user context first
await query(`SET LOCAL app.current_user_id = $1`, [userId])
await query(`SELECT * FROM "clients_social_platforms"`)
```

## Next Steps

- **[OAuth Integration](../02-core-features/01-oauth-integration.md)** - OAuth with client context
- **[Custom Integrations](./02-custom-integrations.md)** - Build custom features
- **[Agency Management](../04-use-cases/01-agency-management.md)** - Real-world agency use case
