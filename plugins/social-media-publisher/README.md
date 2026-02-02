# Social Media Publisher Plugin

Multi-account social media publishing plugin with OAuth integration and token encryption. **Theme-agnostic design** allows any theme to integrate social media publishing for their specific entity structure.

## Features

- ✅ **Theme-Agnostic Adapter Pattern** - Works with any entity (clients, projects, teams, etc.)
- ✅ **Multi-Account Support** - Connect multiple social media accounts per entity
- ✅ **Secure Token Storage** - AES-256-GCM encryption for OAuth tokens
- ✅ **Auto Token Refresh** - Automatic refresh before expiration
- ✅ **Audit Logging** - Complete audit trail for all actions
- ✅ **Platform Support**:
  - Instagram Business API (photos, videos, carousels, insights)
  - Facebook Pages API (posts, photos, carousels, links, insights)
  - Extensible for Twitter, LinkedIn, TikTok, YouTube, and more

## Architecture

### Two-Level Token Architecture

This plugin uses a **"Connect Once, Link Anywhere"** architecture:

```
┌────────────────────────────────────────────────────────────────┐
│ PLUGIN LEVEL: social_accounts (User-owned tokens)              │
│ ─────────────────────────────────────────────────              │
│ • OAuth tokens stored here (encrypted)                         │
│ • One token per platform per user                              │
│ • Reusable across multiple entities                            │
└────────────────────────────────────────────────────────────────┘
              ↓ socialAccountId (FK)
┌────────────────────────────────────────────────────────────────┐
│ THEME LEVEL: {entity}_social_platforms (Entity assignments)    │
│ ─────────────────────────────────────────────────────────────  │
│ • Links entities to social accounts (no token storage)         │
│ • Theme controls: table name, entity type, permissions         │
│ • Examples: clients_social_platforms, projects_social_media    │
└────────────────────────────────────────────────────────────────┘
```

### Theme Integration via Adapter Pattern

The plugin is **entity-agnostic**. Themes provide an **Adapter** that tells the plugin:
- Which entity type to work with (e.g., `clients`, `projects`, `teams`)
- Which table stores assignments (e.g., `clients_social_platforms`)
- How to verify user permissions (team-based, owner-based, or custom)

---

## 🔌 Theme Integration Guide

### Step 1: Create the Adapter Class

Create a class that extends `SocialPlatformAdapter`:

```typescript
// contents/themes/{your-theme}/lib/social-media/my-adapter.ts
import {
  SocialPlatformAdapter,
  type SocialPlatformAdapterConfig,
  type AssignmentData,
  type SocialPlatformAssignment,
  type EntityAccessResult,
  type SaveAssignmentResult
} from '@/plugins/social-media-publisher/lib/adapter'
import { queryWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db'

const CONFIG: SocialPlatformAdapterConfig = {
  entitySlug: 'projects',                    // Your entity name
  tableName: 'projects_social_platforms',    // Your assignment table
  parentIdColumn: 'projectId',               // FK column to parent entity
  permissionCheck: 'team'                    // 'team' | 'owner' | 'custom'
}

export class ProjectsSocialPlatformAdapter extends SocialPlatformAdapter {
  constructor() {
    super(CONFIG)
  }

  async checkEntityAccess(userId: string, entityId: string): Promise<EntityAccessResult> {
    // Implement: Return { hasAccess: true/false, teamId?, reason? }
  }

  async getAssignments(entityId: string, userId: string): Promise<SocialPlatformAssignment[]> {
    // Implement: Return array of assignments with tokens from social_accounts JOIN
  }

  async getAssignedPlatformIds(entityId: string, userId: string): Promise<Set<string>> {
    // Implement: Return Set of platformAccountIds already assigned
  }

  async saveAssignment(data: AssignmentData, userId: string): Promise<SaveAssignmentResult> {
    // Implement: Upsert assignment, return { id, isNew }
  }

  async removeAssignment(assignmentId: string, userId: string): Promise<void> {
    // Implement: Soft-delete (set isActive = false)
  }
}
```

### Step 2: Export via Factory Function

Create the module index that the plugin auto-discovers:

```typescript
// contents/themes/{your-theme}/lib/social-media/index.ts
import { ProjectsSocialPlatformAdapter } from './my-adapter'
import type { SocialPlatformAdapter } from '@/plugins/social-media-publisher/lib/adapter'

// Re-export for direct usage
export { ProjectsSocialPlatformAdapter } from './my-adapter'

/**
 * Factory function - REQUIRED for plugin auto-discovery.
 * The plugin looks for this function in:
 * `contents/themes/{NEXT_PUBLIC_ACTIVE_THEME}/lib/social-media/index.ts`
 */
export function createAdapter(): SocialPlatformAdapter {
  return new ProjectsSocialPlatformAdapter()
}
```

### Step 3: Create the Assignment Table Migration

```sql
-- contents/themes/{your-theme}/migrations/XXX_projects_social_platforms.sql

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
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE("projectId", "platformAccountId") WHERE "platformAccountId" IS NOT NULL
);

-- Add indexes and RLS as needed
```

### Auto-Discovery Convention

The plugin automatically discovers your adapter using:

```
NEXT_PUBLIC_ACTIVE_THEME → contents/themes/{theme}/lib/social-media/index.ts
                                                          ↓
                                              createAdapter() → Your adapter instance
```

**Fallback options** (in order of priority):
1. `createAdapter()` factory function ✅ Recommended
2. Default export (instance or class)
3. `SocialPlatformAdapterImpl` named export

---

## Supported Platforms

| Platform | Status | OAuth Provider |
|----------|--------|----------------|
| Instagram Business | ✅ Implemented | Meta (Facebook) |
| Facebook Pages | ✅ Implemented | Meta (Facebook) |
| Twitter/X | 🔜 Planned | Twitter |
| LinkedIn | 🔜 Planned | LinkedIn |
| YouTube | 🔜 Planned | Google |
| TikTok | 🔜 Planned | TikTok |
| Pinterest | 🔜 Planned | Pinterest |
| Threads | 🔜 Planned | Meta |
| Bluesky | 🔜 Planned | Bluesky |
| Mastodon | 🔜 Planned | Instance-specific |

---

## Legacy: Per-Client Architecture (Content-Buddy Example)

The content-buddy theme uses this plugin with clients as the parent entity:

## Directory Structure

```
contents/plugins/social-media-publisher/
├── plugin.config.ts              # Plugin metadata
├── types/
│   └── social.types.ts          # TypeScript interfaces
├── entities/
│   └── audit-logs/
│       └── config.ts            # Immutable audit trail
├── lib/
│   ├── providers/
│   │   ├── facebook.ts          # Facebook Graph API wrapper
│   │   ├── instagram.ts         # Instagram Business API wrapper
│   │   └── index.ts             # Exports
│   ├── oauth-helper.ts          # OAuth flow utilities
│   └── validation.ts            # Zod schemas
└── api/
    └── social/
        └── connect/
            └── callback/route.ts  # OAuth callback handler
```

Note: Social platform accounts are managed through the `social-platforms` child entity in the theme, not in this plugin.

## Database Schema

### `clients_social_platforms` Table (Child Entity)

Stores OAuth-connected social media accounts as a child entity of clients.

```sql
CREATE TABLE "clients_social_platforms" (
  id                    UUID PRIMARY KEY,
  "parentId"            UUID NOT NULL REFERENCES "clients"(id), -- Client owner
  platform              TEXT NOT NULL, -- 'instagram_business' | 'facebook_page'
  "platformAccountId"   TEXT,
  "platformAccountName" TEXT NOT NULL,
  "accessToken"         TEXT NOT NULL, -- Encrypted (format: encrypted:iv:keyId)
  "tokenExpiresAt"      TIMESTAMPTZ NOT NULL,
  permissions           JSONB DEFAULT '[]',
  "accountMetadata"     JSONB DEFAULT '{}',
  "isActive"            BOOLEAN DEFAULT true,
  "createdAt"           TIMESTAMPTZ DEFAULT now(),
  "updatedAt"           TIMESTAMPTZ DEFAULT now(),
  UNIQUE("parentId", "platformAccountId") WHERE "platformAccountId" IS NOT NULL
);
```

**Key Features:**
- ✅ Multiple accounts per client per platform
- ✅ Encrypted tokens (AES-256-GCM with format: encrypted:iv:keyId)
- ✅ Tracks which user connected the account (audit trail)
- ✅ Soft delete via `isActive` flag
- ✅ JSONB metadata for flexibility
- ✅ Unique constraint per client to prevent duplicate connections

### `audit_logs` Table

Immutable audit trail for compliance.

```sql
CREATE TABLE "audit_logs" (
  id          UUID PRIMARY KEY,
  "userId"    TEXT NOT NULL REFERENCES "users"(id),
  "accountId" UUID REFERENCES "clients_social_platforms"(id),
  action      TEXT NOT NULL, -- 'account_connected', 'post_published', etc.
  details     JSONB DEFAULT '{}',
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT now()
);
```

## API Endpoints

### 1. OAuth Callback (Connect Social Account)

```http
GET /api/v1/plugin/social-media-publisher/social/connect/callback
```

This endpoint receives the OAuth redirect from Facebook/Instagram and:
1. Validates the authorization code
2. Exchanges code for access token
3. Fetches connected accounts (Instagram Business or Facebook Pages)
4. Encrypts tokens and stores them in `clients_social_platforms` table
5. Returns HTML page that sends postMessage to opener window

**Query Parameters:**
```
code: Authorization code from Facebook
state: CSRF protection (format: {randomState}&platform={platform}&clientId={clientId})
error: (optional) Error if user denied permission
error_description: (optional) Error description
```

**Success Response:**
Returns HTML page with:
- Success message showing number of connected accounts
- JavaScript that sends postMessage to parent window
- Auto-closes popup after 2 seconds

**Popup Message:**
```javascript
{
  type: 'oauth-success',
  platform: 'instagram_business',
  connectedCount: 2
}
```

### 2. Initiate OAuth Flow

```http
GET /api/v1/plugin/social-media-publisher/social/connect
```

**Query Parameters:**
```
platform: 'instagram_business' | 'facebook_page'
clientId: UUID of the client to connect accounts to
```

This endpoint generates the OAuth authorization URL and redirects the user to Facebook/Instagram for authorization. The state parameter includes the clientId to maintain context during the OAuth flow.

## Usage in Theme

### Connecting Social Accounts (Per-Client)

Social accounts are managed within the client context. The OAuth flow is initiated from the client's social platforms page:

```typescript
'use client'

import { useRouter } from 'next/navigation'

export function SocialPlatformOAuthForm({ clientId }: { clientId: string }) {
  const router = useRouter()

  const handleConnect = (platform: 'instagram_business' | 'facebook_page') => {
    // Build OAuth URL with clientId in state
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    const oauthUrl = `${baseUrl}/api/v1/plugin/social-media-publisher/social/connect?platform=${platform}&clientId=${clientId}`

    // Open OAuth popup
    const popup = window.open(
      oauthUrl,
      'oauth-popup',
      'width=600,height=700'
    )

    // Listen for success message from popup
    window.addEventListener('message', (event) => {
      if (event.origin !== window.location.origin) return

      if (event.data.type === 'oauth-success') {
        console.log(`Connected ${event.data.connectedCount} ${event.data.platform} account(s)`)
        router.refresh() // Refresh to show newly connected accounts
      }
    })
  }

  return (
    <div>
      <button onClick={() => handleConnect('instagram_business')}>
        Connect Instagram Business
      </button>
      <button onClick={() => handleConnect('facebook_page')}>
        Connect Facebook Page
      </button>
    </div>
  )
}
```

### Fetching Connected Accounts

Connected accounts are fetched through the standard entity API as a child entity:

```typescript
// Server Component
import { query } from '@/core/lib/db'

async function getClientSocialPlatforms(clientId: string) {
  const result = await query(
    `SELECT * FROM "clients_social_platforms"
     WHERE "parentId" = $1 AND "isActive" = true`,
    [clientId]
  )
  return result.rows
}

// Or use the dynamic entity API:
// GET /api/v1/entity/clients/{clientId}/social-platforms
```

### Publishing to Social Media

```typescript
import { FacebookAPI, InstagramAPI } from '@/contents/plugins/social-media-publisher/lib/providers'
import { TokenEncryption } from '@/core/lib/oauth/encryption'

async function publishToInstagram(account: any, imageUrl: string, caption: string) {
  // Decrypt token
  const [encrypted, iv, keyId] = account.accessToken.split(':')
  const decryptedToken = await TokenEncryption.decrypt(encrypted, iv, keyId)

  // Publish to Instagram
  const result = await InstagramAPI.publishPhoto({
    igAccountId: account.platformAccountId,
    accessToken: decryptedToken,
    imageUrl,
    caption
  })

  if (result.success) {
    console.log(`Posted: ${result.postUrl}`)
  }

  return result
}
```

## Environment Variables

### ⭐ Plugin-Level Environment Configuration (Recommended)

The Social Media Publisher plugin supports **plugin-level `.env` files** that take priority over root environment variables.

#### Setup

1. **Copy the example file:**
   ```bash
   cp contents/plugins/social-media-publisher/.env.example contents/plugins/social-media-publisher/.env
   ```

2. **Configure your credentials:**
   ```env
   # Facebook/Meta OAuth
   FACEBOOK_CLIENT_ID="your-facebook-app-id"
   FACEBOOK_CLIENT_SECRET="your-facebook-app-secret"

   # Cron Job Authentication
   CRON_SECRET="your-cron-secret-key-here"
   ```

#### Priority System

The plugin environment loader uses this priority:

1. **Plugin `.env`** (`contents/plugins/social-media-publisher/.env`) - Highest priority
2. **Root `.env`** (`/.env`) - Fallback for variables not in plugin .env
3. **Built-in defaults** - Lowest priority

#### Benefits

- ✅ **Isolation**: OAuth credentials isolated to the plugin
- ✅ **Security**: Sensitive keys scoped to specific plugins
- ✅ **Modularity**: Each plugin manages its own secrets
- ✅ **Flexibility**: Different configs per environment

### Root Environment Variables (Alternative)

You can also configure credentials in the root `.env`:

```env
# Facebook App Credentials (same as Better Auth)
FACEBOOK_CLIENT_ID=your_app_id
FACEBOOK_CLIENT_SECRET=your_app_secret

# OAuth Encryption Key (32 bytes hex)
OAUTH_ENCRYPTION_KEY=generate_with_crypto_random_bytes_32

# App URL
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Generate Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## OAuth Scopes

### Facebook Pages
```typescript
[
  'pages_show_list',          // List user's pages
  'pages_manage_posts',       // Create/edit posts
  'pages_read_engagement',    // Read likes/comments
  'read_insights'             // Read analytics
]
```

### Instagram Business
```typescript
[
  'pages_show_list',                 // Required to get IG account from page
  'instagram_basic',                 // Read profile info
  'instagram_content_publish',       // Publish posts
  'instagram_manage_insights'        // Read analytics
]
```

## Security Features

### Token Encryption

All OAuth tokens are encrypted using AES-256-GCM before storage:

```typescript
const encrypted = await TokenEncryption.encrypt(accessToken)
// Returns: { encrypted: string, iv: string, keyId: string }
// Stored as: "encrypted:iv:keyId"
```

### Row-Level Security (RLS)

```sql
-- Users can only access social platforms for clients they own
CREATE POLICY "clients_social_platforms_select_own"
  ON "clients_social_platforms" FOR SELECT
  USING (
    "parentId" IN (
      SELECT id FROM "clients"
      WHERE "userId" = current_setting('app.current_user_id', true)
    )
  );
```

### Audit Trail

Every action creates an immutable audit log:

```typescript
{
  userId: 'user_id',
  accountId: 'account_id',
  action: 'post_published',
  details: {
    platform: 'instagram_business',
    success: true,
    postId: '17899618652010220'
  },
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  createdAt: '2025-10-20T10:30:00Z'
}
```

## Database Setup

The `clients_social_platforms` table is created as part of the social-platforms child entity migration in the theme. The `audit_logs` table is created as part of the plugin's entity configuration.

## Dependencies

### Core
- `core/lib/oauth/encryption.ts` - Token encryption
- `core/lib/oauth/token-refresh.ts` - Token refresh
- `core/lib/api/auth/dual-auth.ts` - Authentication

### External
- Facebook Graph API v18.0
- Instagram Business API (via Graph API)

## Testing

### Manual Testing Checklist

- [ ] Navigate to client detail page
- [ ] Click "Add Social Platform" button
- [ ] Select Instagram Business platform
- [ ] Complete OAuth flow in popup
- [ ] Verify popup closes and accounts appear in list
- [ ] Connect Facebook Page for same client
- [ ] Verify tokens are encrypted in `clients_social_platforms` table (format: encrypted:iv:keyId)
- [ ] Verify audit logs are created with correct accountId
- [ ] Verify RLS policies (user can only see their own clients' social platforms)
- [ ] Test connecting duplicate account (should update existing record)

### Unit Tests (TODO)

```bash
npm test contents/plugins/social-media-publisher
```

## Troubleshooting

### "No Instagram Business Accounts found"

**Cause**: Your Facebook Pages don't have linked Instagram Business Accounts.

**Solution**:
1. Go to Facebook Page settings
2. Navigate to Instagram section
3. Connect an Instagram Business Account
4. Try again

### "Token exchange failed"

**Cause**: Invalid OAuth credentials or redirect URI mismatch.

**Solution**:
1. Verify `FACEBOOK_CLIENT_ID` and `FACEBOOK_CLIENT_SECRET`
2. Check redirect URI in Facebook App settings matches your callback URL
3. Ensure app is not in Development Mode (for production)

### "Encryption key validation failed"

**Cause**: Missing or invalid `OAUTH_ENCRYPTION_KEY`.

**Solution**:
```bash
# Generate new key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env
OAUTH_ENCRYPTION_KEY=<generated_key>
```

## Roadmap

- [ ] Token auto-refresh cron job
- [ ] Video publishing support
- [ ] Carousel posts (multiple images)
- [ ] Story publishing
- [ ] Scheduled posts
- [ ] Analytics dashboard
- [ ] Bulk publishing
- [ ] Cross-posting (publish to multiple accounts at once)

## License

Same as parent project.
