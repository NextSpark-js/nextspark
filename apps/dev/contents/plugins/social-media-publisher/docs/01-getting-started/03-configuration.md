# Configuration

## Overview

The Social Media Publisher plugin requires specific configuration for Facebook OAuth, token encryption, and security settings. This guide covers all configuration options and best practices.

## Environment Variables

### Required Variables

```bash
# ==============================================
# FACEBOOK OAUTH
# ==============================================

# Facebook App ID
FACEBOOK_CLIENT_ID=your_app_id

# Facebook App Secret
FACEBOOK_CLIENT_SECRET=your_app_secret

# ==============================================
# APPLICATION
# ==============================================

# Base URL (used for OAuth redirects)
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# ==============================================
# SECURITY
# ==============================================

# 32-byte encryption key for tokens (64 hex characters)
OAUTH_ENCRYPTION_KEY=your_encryption_key_here
```

### Variable Details

#### `FACEBOOK_CLIENT_ID`

**Purpose:** Facebook App ID for OAuth authentication

**Where to Find:**
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Select your app
3. Settings → Basic
4. Copy "App ID"

**Example:**
```bash
FACEBOOK_CLIENT_ID=123456789012345
```

**Notes:**
- Same app can be used for Facebook Pages and Instagram Business
- No quotes needed
- Numeric string

#### `FACEBOOK_CLIENT_SECRET`

**Purpose:** Facebook App Secret for token exchange

**Where to Find:**
1. Same location as App ID
2. Settings → Basic
3. Click "Show" next to "App Secret"
4. Copy the secret

**Example:**
```bash
FACEBOOK_CLIENT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

**Security:**
- ⚠️ **Never commit to version control**
- ⚠️ **Never expose in client-side code**
- ⚠️ **Never log or display**
- ✅ Store in environment variables
- ✅ Use secrets manager in production (AWS Secrets Manager, etc.)
- ✅ Rotate periodically

#### `NEXT_PUBLIC_APP_URL`

**Purpose:** Base URL for OAuth redirect URIs

**Format:** `https://domain.com` (no trailing slash)

**Examples:**
```bash
# Development
NEXT_PUBLIC_APP_URL=http://localhost:5173

# Production
NEXT_PUBLIC_APP_URL=https://yourapp.com
```

**Important:**
- Must match exactly the URL configured in Facebook App
- No trailing slash
- Include protocol (`http://` or `https://`)
- Port number if using non-standard ports

#### `OAUTH_ENCRYPTION_KEY`

**Purpose:** Encrypt OAuth tokens before storing in database

**Format:** 64 hexadecimal characters (32 bytes)

**Generate:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example:**
```bash
OAUTH_ENCRYPTION_KEY=a7f9b2c8d1e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9
```

**Security:**
- ✅ Must be exactly 64 hex characters
- ✅ Generate unique key per environment
- ✅ Never commit to git
- ✅ Store securely
- ⚠️ Changing key invalidates all existing tokens (users must reconnect)

## OAuth Scopes

### Instagram Business Permissions

```typescript
[
  'pages_show_list',              // Required: List Facebook Pages
  'instagram_basic',              // Required: Read Instagram profile
  'instagram_content_publish',    // Required: Publish to Instagram
  'instagram_manage_insights'     // Optional: Read analytics
]
```

**What Each Permission Does:**

**`pages_show_list`** (Required)
- Lists Facebook Pages user manages
- Needed to find Pages with Instagram accounts
- Prerequisite for Instagram access

**`instagram_basic`** (Required)
- Read Instagram Business Account profile
- Get account ID, username, follower count
- Required even for publishing

**`instagram_content_publish`** (Required)
- Create and publish Instagram posts
- Photos and videos
- Cannot publish without this

**`instagram_manage_insights`** (Optional)
- Read Instagram analytics
- Post performance metrics
- Account insights
- Not required for publishing

### Facebook Pages Permissions

```typescript
[
  'pages_show_list',          // Required: List Pages
  'pages_manage_posts',       // Required: Create/publish posts
  'pages_read_engagement',    // Optional: Read likes/comments
  'read_insights'             // Optional: Read analytics
]
```

**What Each Permission Does:**

**`pages_show_list`** (Required)
- Lists Facebook Pages user manages
- Required to fetch Pages

**`pages_manage_posts`** (Required)
- Create posts on Pages
- Edit posts
- Delete posts
- Required for publishing

**`pages_read_engagement`** (Optional)
- Read post reactions
- Read comments
- Track engagement
- Not required for publishing

**`read_insights`** (Optional)
- Page analytics
- Visitor demographics
- Performance metrics
- Not required for publishing

## Facebook App Configuration

### OAuth Settings

**Location:** Facebook App → Products → Facebook Login → Settings

**Valid OAuth Redirect URIs:**
```
Development:
http://localhost:5173/api/v1/plugin/social-media-publisher/social/connect/callback

Staging:
https://staging.yourapp.com/api/v1/plugin/social-media-publisher/social/connect/callback

Production:
https://yourapp.com/api/v1/plugin/social-media-publisher/social/connect/callback
```

**Client OAuth Login:** ON  
**Web OAuth Login:** ON  
**Force Web OAuth Reauthentication:** OFF  
**Embedded Browser OAuth Login:** OFF  

### App Domains

**Location:** Settings → Basic → App Domains

Add your domains:
```
localhost (for development)
yourapp.com (for production)
staging.yourapp.com (for staging)
```

### Privacy and Terms URLs

**Required for Live Mode:**

**Privacy Policy URL:**
```
https://yourapp.com/privacy
```

**Terms of Service URL:**
```
https://yourapp.com/terms
```

### App Review (Production)

**For Production Use:** Submit app for review to use permissions with non-admin users.

**Checklist:**
- [ ] App icon uploaded (1024x1024px)
- [ ] Category selected (e.g., "Business and Pages")
- [ ] Privacy policy URL added
- [ ] Terms of service URL added
- [ ] Detailed description of how you use each permission
- [ ] Screen recording showing OAuth flow
- [ ] Screenshots of publishing interface
- [ ] Business verification completed (for certain permissions)

## Security Configuration

### Token Encryption

**Algorithm:** AES-256-GCM  
**Key Size:** 256 bits (32 bytes)  
**IV:** Unique per token (96 bits)  
**Tag:** 128 bits (for authentication)

**Storage Format:**
```
encrypted:iv:keyId

Example:
a3f9b2c8d1e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2:9f7e3ab5c2:key_2024_01
```

**Key Rotation:**

If you need to rotate encryption keys:

1. Generate new key
2. Set new `OAUTH_ENCRYPTION_KEY`
3. All existing tokens become invalid
4. Users must reconnect accounts
5. Consider migration script for seamless transition

**Migration Script Example:**
```typescript
// Decrypt with old key, re-encrypt with new key
const oldKey = process.env.OLD_OAUTH_ENCRYPTION_KEY
const newKey = process.env.OAUTH_ENCRYPTION_KEY

// ... migration logic
```

### Row-Level Security (RLS)

**Purpose:** Ensure users can only access social platforms for clients they own.

**Policy:**
```sql
-- Users can only SELECT social platforms for their clients
CREATE POLICY "clients_social_platforms_select_own"
  ON "clients_social_platforms" FOR SELECT
  USING (
    "parentId" IN (
      SELECT id FROM "clients"
      WHERE "userId" = current_setting('app.current_user_id', true)
    )
  );

-- Users can only INSERT social platforms for their clients
CREATE POLICY "clients_social_platforms_insert_own"
  ON "clients_social_platforms" FOR INSERT
  WITH CHECK (
    "parentId" IN (
      SELECT id FROM "clients"
      WHERE "userId" = current_setting('app.current_user_id', true)
    )
  );

-- Similar policies for UPDATE and DELETE
```

**Verify RLS is Active:**
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'clients_social_platforms';

-- Should return: rowsecurity = true
```

### Audit Configuration

**Retention:** Audit logs are **immutable** and never deleted automatically.

**Recommended Retention Policy:**
```sql
-- Archive logs older than 1 year
CREATE TABLE "audit_logs_archive" (
  LIKE "audit_logs" INCLUDING ALL
);

-- Move old logs
INSERT INTO "audit_logs_archive"
SELECT * FROM "audit_logs"
WHERE "createdAt" < NOW() - INTERVAL '1 year';

-- Optionally delete from main table
DELETE FROM "audit_logs"
WHERE "createdAt" < NOW() - INTERVAL '1 year';
```

## Token Refresh Configuration

### Automatic Refresh Settings

**Refresh Threshold:** 10 minutes before expiration  
**Token Lifetime:** 60 days (long-lived Facebook tokens)  
**Retry Logic:** None (fail fast if refresh fails)

**Threshold Configuration:**

Currently hardcoded in publish endpoint:
```typescript
const REFRESH_THRESHOLD_MINUTES = 10
```

To customize, edit:
```typescript
// contents/plugins/social-media-publisher/api/social/publish/route.ts
const REFRESH_THRESHOLD_MINUTES = 60 // Refresh 1 hour before expiration
```

**Trade-offs:**
- Lower threshold (10 min): More last-minute refreshes
- Higher threshold (60 min): More proactive, but more refresh API calls

### Refresh Endpoint

**Meta Token Exchange:**
```
GET https://graph.facebook.com/v18.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id={app_id}
  &client_secret={app_secret}
  &fb_exchange_token={current_token}
```

**Response:**
```json
{
  "access_token": "new_long_lived_token",
  "token_type": "bearer",
  "expires_in": 5184000  // 60 days in seconds
}
```

## Environment-Specific Configuration

### Development

```bash
# .env.development
FACEBOOK_CLIENT_ID=dev_app_id
FACEBOOK_CLIENT_SECRET=dev_app_secret
NEXT_PUBLIC_APP_URL=http://localhost:5173
OAUTH_ENCRYPTION_KEY=dev_key_here
```

**Notes:**
- Use test Facebook App
- Can use same account for testing
- Admins/Developers/Testers can test without App Review

### Staging

```bash
# .env.staging
FACEBOOK_CLIENT_ID=staging_app_id
FACEBOOK_CLIENT_SECRET=staging_app_secret
NEXT_PUBLIC_APP_URL=https://staging.yourapp.com
OAUTH_ENCRYPTION_KEY=staging_key_here
```

**Notes:**
- Separate Facebook App recommended
- Use different encryption key
- Test App Review process

### Production

```bash
# .env.production
FACEBOOK_CLIENT_ID=prod_app_id
FACEBOOK_CLIENT_SECRET=prod_app_secret
NEXT_PUBLIC_APP_URL=https://yourapp.com
OAUTH_ENCRYPTION_KEY=prod_key_here
```

**Notes:**
- App must be in Live mode
- Permissions approved via App Review
- Unique encryption key
- Use secrets manager for credential storage

## Troubleshooting Configuration

### Invalid Redirect URI Error

**Check:**
1. `NEXT_PUBLIC_APP_URL` matches Facebook App settings exactly
2. No trailing slash in URL
3. Protocol (http/https) correct
4. Port number included if non-standard

### Token Encryption Failures

**Check:**
1. `OAUTH_ENCRYPTION_KEY` is exactly 64 hex characters
2. Key hasn't changed since accounts were connected
3. Key is valid hexadecimal

**Validate Key:**
```bash
# Should output 32
echo -n "your_key_here" | wc -c | awk '{print $1/2}'
```

### Permission Errors

**Check:**
1. Permissions requested in OAuth URL match Facebook App config
2. App has permissions approved (if in Live mode)
3. User granted all requested permissions
4. Permissions still valid (not revoked by user)

## Best Practices

### Security

✅ **Use Secrets Manager** in production (AWS, Vercel, etc.)  
✅ **Rotate secrets** periodically (quarterly recommended)  
✅ **Separate keys per environment**  
✅ **Never commit** secrets to git  
✅ **Audit access** to environment variables  

### OAuth

✅ **Request minimum permissions** needed  
✅ **Handle permission denials** gracefully  
✅ **Show clear permission justifications** to users  
✅ **Test OAuth flow** in all environments  
✅ **Monitor token refresh** success rates  

### Token Management

✅ **Encrypt all tokens** before storage  
✅ **Refresh proactively** (10+ min threshold)  
✅ **Handle refresh failures** gracefully  
✅ **Log refresh events** for monitoring  
✅ **Never log** decrypted tokens  

## Next Steps

✅ Configuration complete  
✅ Environment variables set  
✅ Facebook App configured  
✅ Security enabled

**Continue to:**
- **[OAuth Integration](../02-core-features/01-oauth-integration.md)** - Connect accounts
- **[Publishing](../02-core-features/02-publishing.md)** - Start publishing
- **[Token Management](../02-core-features/03-token-management.md)** - Understand token lifecycle
