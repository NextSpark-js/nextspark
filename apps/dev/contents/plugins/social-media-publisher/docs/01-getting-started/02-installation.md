# Installation and Setup

## Prerequisites

Before installing the Social Media Publisher plugin, ensure you have:

- ✅ NextSpark project set up and running
- ✅ PostgreSQL database configured
- ✅ Active theme with plugin support
- ✅ Facebook Developer account (free)
- ✅ Instagram Business Account (for Instagram publishing)
- ✅ Facebook Page (for Instagram Business connection or Facebook publishing)

## Step 1: Create Facebook App

### 1.1 Register as Facebook Developer

1. Visit [Facebook Developers](https://developers.facebook.com/)
2. Click "Get Started" or "My Apps"
3. Complete developer registration (if needed)

### 1.2 Create New App

1. Click "Create App"
2. Select "Business" as app type
3. Fill in app details:
   - **App Name:** Your SaaS Name Social Media
   - **App Contact Email:** your@email.com
   - **Business Account:** (Optional) Select if you have one
4. Click "Create App"

### 1.3 Configure OAuth Settings

**Add Facebook Login Product:**

1. In app dashboard, click "Add Product"
2. Find "Facebook Login" → Click "Set Up"
3. Select "Web" as platform
4. Skip quick start (we'll configure manually)

**Configure OAuth Redirect URLs:**

1. Go to "Facebook Login" → "Settings"
2. Add **Valid OAuth Redirect URIs:**

```
Development:
http://localhost:5173/api/v1/plugin/social-media-publisher/social/connect/callback

Production:
https://yourdomain.com/api/v1/plugin/social-media-publisher/social/connect/callback
```

3. **Client OAuth Login:** ON
4. **Web OAuth Login:** ON
5. Save changes

### 1.4 Request Permissions

**For Instagram Business:**

1. Go to "App Review" → "Permissions and Features"
2. Request these permissions:
   - `pages_show_list` - Required
   - `pages_manage_posts` - Required
   - `pages_read_engagement` - Required
   - `instagram_basic` - Required
   - `instagram_content_publish` - Required
   - `instagram_manage_insights` - Optional (for analytics)

**For Facebook Pages:**

1. Same permissions as above
2. Already includes everything needed for Page publishing

**Note:** These permissions require App Review for production apps. During development, admins, developers, and testers can use them immediately.

### 1.5 Get App Credentials

1. Go to "Settings" → "Basic"
2. Copy your credentials:
   - **App ID** (will be `FACEBOOK_CLIENT_ID`)
   - **App Secret** (will be `FACEBOOK_CLIENT_SECRET`)
3. Keep these secure!

## Step 2: Configure Environment Variables

### 2.1 Core Environment File

Create or update your main `.env` file:

```bash
# Facebook OAuth Credentials
FACEBOOK_CLIENT_ID=your_app_id_here
FACEBOOK_CLIENT_SECRET=your_app_secret_here

# App URL (important for OAuth redirects)
NEXT_PUBLIC_APP_URL=http://localhost:5173

# OAuth Token Encryption (32-byte hex key)
OAUTH_ENCRYPTION_KEY=your_encryption_key_here
```

### 2.2 Generate Encryption Key

The `OAUTH_ENCRYPTION_KEY` is used to encrypt OAuth tokens in the database.

**Generate a secure key:**

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Output example:
# a7f9b2c8d1e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9
```

**Add to `.env`:**
```bash
OAUTH_ENCRYPTION_KEY=a7f9b2c8d1e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9
```

**Security Notes:**
- ✅ Key must be exactly 32 bytes (64 hex characters)
- ✅ Generate unique key for each environment
- ✅ Never commit to version control
- ✅ Store securely in production (e.g., AWS Secrets Manager)
- ✅ Rotate periodically (requires re-connecting accounts)

### 2.3 Environment Variable Reference

```bash
# ==============================================
# FACEBOOK OAUTH CONFIGURATION
# ==============================================

# Facebook App ID (from App Dashboard → Settings → Basic)
FACEBOOK_CLIENT_ID=123456789012345

# Facebook App Secret (from App Dashboard → Settings → Basic)
FACEBOOK_CLIENT_SECRET=abcdef123456789abcdef123456789ab

# ==============================================
# APPLICATION URL
# ==============================================

# Base URL of your application (no trailing slash)
# Development:
NEXT_PUBLIC_APP_URL=http://localhost:5173

# Production:
# NEXT_PUBLIC_APP_URL=https://yourdomain.com

# ==============================================
# SECURITY
# ==============================================

# 32-byte encryption key for OAuth tokens (64 hex chars)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
OAUTH_ENCRYPTION_KEY=your_32_byte_key_in_hex_format

# ==============================================
# DATABASE (if not already configured)
# ==============================================

DATABASE_URL=postgresql://user:password@localhost:5432/database
```

## Step 3: Enable Plugin

### 3.1 Add to Theme Configuration

Edit your theme's `theme.config.ts`:

```typescript
// contents/themes/[your-theme]/theme.config.ts
export const yourThemeConfig: ThemeConfig = {
  name: 'your-theme',
  // ... other config
  
  plugins: [
    'ai',
    'social-media-publisher'  // Add this line
  ]
}
```

### 3.2 Verify Plugin Loads

```bash
# Start development server
pnpm dev

# Check console for plugin load message:
# [Social Media Publisher] Plugin loaded - OAuth publishing ready
```

## Step 4: Database Setup

### 4.1 Run Migrations

The plugin includes migrations for the required tables:

```bash
# Apply all pending migrations
pnpm db:migrate

# Or specifically for social media publisher:
psql $DATABASE_URL -f contents/plugins/social-media-publisher/migrations/001_social_media_tables.sql
```

### 4.2 Verify Tables Created

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('clients_social_platforms', 'audit_logs');

-- Should return:
-- clients_social_platforms
-- audit_logs
```

### 4.3 Database Schema Overview

**clients_social_platforms (Child Entity):**
```sql
CREATE TABLE "clients_social_platforms" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "parentId" UUID NOT NULL REFERENCES "clients"(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  "platformAccountId" TEXT,
  "platformAccountName" TEXT NOT NULL,
  "accessToken" TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMPTZ NOT NULL,
  permissions JSONB DEFAULT '[]',
  "accountMetadata" JSONB DEFAULT '{}',
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMPTZ DEFAULT now(),
  "updatedAt" TIMESTAMPTZ DEFAULT now()
);
```

**audit_logs (Plugin Entity):**
```sql
CREATE TABLE "audit_logs" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "accountId" UUID,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT now()
);
```

## Step 5: Configure Facebook App for Production

### 5.1 App Review Process

**For Production Use:**

1. Go to "App Review" → "Permissions and Features"
2. Click "Request" next to each required permission
3. Fill out "App Questionnaire" explaining use case
4. Submit screenshots showing OAuth flow
5. Wait for approval (typically 1-3 days)

**Required Permissions:**
- `pages_show_list`
- `pages_manage_posts`
- `pages_read_engagement`
- `instagram_basic`
- `instagram_content_publish`

### 5.2 Switch to Live Mode

1. App dashboard → Top toggle
2. Switch from "Development" to "Live"
3. Confirm app is ready for public use

**Before Going Live:**
- ✅ Permissions approved
- ✅ Privacy policy URL added
- ✅ Terms of service URL added
- ✅ App icon uploaded
- ✅ Category selected
- ✅ Business verification completed

## Step 6: Connect Instagram Business Account

**Important:** Instagram Business accounts must be connected to a Facebook Page.

### 6.1 Link Instagram to Facebook Page

1. Go to your Facebook Page
2. Click "Settings"
3. In left sidebar, click "Instagram"
4. Click "Connect Account"
5. Log in to Instagram
6. Authorize connection
7. Select Instagram Business Account

**Note:** Personal Instagram accounts cannot be used. You must have an Instagram Business or Creator account.

### 6.2 Verify Connection

```bash
# Test Graph API endpoint
curl "https://graph.facebook.com/v18.0/{PAGE_ID}?fields=instagram_business_account&access_token={PAGE_TOKEN}"

# Should return:
{
  "instagram_business_account": {
    "id": "17841..." 
  },
  "id": "123456..."
}
```

## Step 7: Verification

### 7.1 Test OAuth Flow

1. Navigate to a client detail page in your app
2. Click "Add Social Platform"
3. Select "Instagram Business"
4. OAuth popup should open
5. Authorize with Facebook
6. Popup should close and accounts appear

### 7.2 Verify Database

```sql
-- Check connected accounts
SELECT 
  id, 
  "parentId", 
  platform, 
  "platformAccountName",
  "tokenExpiresAt",
  "isActive"
FROM "clients_social_platforms"
WHERE "isActive" = true;

-- Check encrypted tokens (should have format: encrypted:iv:keyId)
SELECT 
  id,
  LENGTH("accessToken") as token_length,
  "accessToken" LIKE '%:%:%' as is_encrypted
FROM "clients_social_platforms";
```

### 7.3 Test Publishing

```bash
# Test publish endpoint
curl -X POST http://localhost:5173/api/v1/plugin/social-media-publisher/social/publish \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "accountId": "social-platform-uuid",
    "platform": "instagram_business",
    "imageUrl": "https://example.com/image.jpg",
    "caption": "Test post"
  }'
```

## Troubleshooting

### Issue: "Invalid OAuth Redirect URI"

**Cause:** Redirect URI not configured in Facebook App

**Solution:**
1. Go to Facebook App → Facebook Login → Settings
2. Add exact callback URL to "Valid OAuth Redirect URIs"
3. Format: `https://yourdomain.com/api/v1/plugin/social-media-publisher/social/connect/callback`
4. Save changes

### Issue: "OAUTH_ENCRYPTION_KEY validation failed"

**Cause:** Missing or invalid encryption key

**Solution:**
```bash
# Generate new key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env (must be exactly 64 hex characters)
OAUTH_ENCRYPTION_KEY=generated_key_here

# Restart server
pnpm dev
```

### Issue: "No Instagram Business Account found"

**Cause:** Facebook Page not linked to Instagram Business Account

**Solution:**
1. Go to Facebook Page Settings
2. Click "Instagram" in sidebar
3. Connect Instagram Business Account
4. Verify connection:
   ```bash
   # Should show instagram_business_account field
   curl "https://graph.facebook.com/v18.0/{PAGE_ID}?fields=instagram_business_account&access_token={TOKEN}"
   ```

### Issue: "Permission denied" during publish

**Cause:** Missing OAuth permissions

**Solution:**
1. Disconnect and reconnect account (gets new permissions)
2. Verify permissions in Facebook App Review
3. Check RLS policies allow user to access client

### Issue: "App not set up: This app is still in development mode"

**Cause:** Using app with non-admin users while in Development mode

**Solutions:**
- Add users as "Testers" or "Developers" in App Roles
- OR Switch app to Live mode (requires App Review)

### Issue: "clients_social_platforms table does not exist"

**Cause:** Migrations not run

**Solution:**
```bash
# Run migrations
pnpm db:migrate

# Or manually:
psql $DATABASE_URL -f contents/plugins/social-media-publisher/migrations/001_social_media_tables.sql
```

## Security Checklist

Before going to production, verify:

- [ ] `FACEBOOK_CLIENT_SECRET` not committed to git
- [ ] `OAUTH_ENCRYPTION_KEY` not committed to git
- [ ] `.env` in `.gitignore`
- [ ] Unique encryption key per environment
- [ ] HTTPS enabled in production
- [ ] RLS policies active on all tables
- [ ] Audit logging enabled
- [ ] Facebook App in Live mode with permissions approved
- [ ] Token encryption verified (check database format)
- [ ] Privacy policy URL added to Facebook App
- [ ] Terms of service URL added to Facebook App

## Next Steps

✅ Plugin installed and configured  
✅ Facebook App created and approved  
✅ Database tables created  
✅ OAuth flow tested  
✅ Publishing verified

**Continue to:**
- **[Configuration](./03-configuration.md)** - Detailed configuration options
- **[OAuth Integration](../02-core-features/01-oauth-integration.md)** - Understanding OAuth flow
- **[Publishing](../02-core-features/02-publishing.md)** - Start publishing content
- **[Per-Client Architecture](../03-advanced-usage/03-per-client-architecture.md)** - Understand the data model
