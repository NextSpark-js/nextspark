# Social Media Publisher Plugin Introduction

## Overview

The **Social Media Publisher Plugin** is a comprehensive OAuth-based solution for publishing content to Instagram Business and Facebook Pages. Built with enterprise-grade security and multi-client management in mind, it enables agencies and businesses to manage social media publishing for multiple clients from a single platform.

**Key Characteristics:**
- **Per-Client Management** - Social accounts belong to clients, not users
- **Secure by Design** - AES-256-GCM encryption for all OAuth tokens
- **Auto Token Refresh** - Automatic token renewal before expiration
- **Complete Audit Trail** - Immutable logging for compliance
- **Production-Ready** - Battle-tested OAuth implementation

## Purpose

### Primary Use Case: Agency Social Media Management

The plugin is specifically designed for **agencies and businesses managing social media for multiple clients**. Unlike traditional social media management tools where accounts belong to individual users, this plugin implements a **per-client architecture** where social media accounts are child entities of client records.

**This means:**
- Each client can have multiple Instagram Business or Facebook Page accounts
- Social accounts are managed within the client context
- Users manage social platforms through client relationships
- Perfect for agencies serving multiple brands

## Key Features

### 1. Per-Client Multi-Account Support

**Child Entity Architecture:**
- Social platforms stored as `clients_social_platforms` (child entity)
- Multiple Instagram Business accounts per client
- Multiple Facebook Page accounts per client
- Isolated per client (no cross-contamination)

**Benefits:**
- Clear client-account ownership
- Easy client offboarding (delete client = delete accounts)
- Organized multi-client management
- Scalable for agencies with hundreds of clients

### 2. Dual Platform Support

**Instagram Business API:**
- Photo publishing (2-step container process)
- Video publishing (with processing wait)
- Account insights and analytics
- Media performance tracking
- Follower statistics

**Facebook Pages API:**
- Text posts
- Photo posts
- Link posts with previews
- Page insights and analytics
- Fan count and engagement metrics

**Both Platforms:**
- Managed through single unified interface
- Consistent API patterns
- Shared OAuth flow (Facebook OAuth)
- Same security model

### 3. Secure Token Storage

**AES-256-GCM Encryption:**
```
Token Format: encrypted:iv:keyId
Example: a3f9b2...c8d1:9f7e3a...b5c2:key_2024_01
```

**Security Features:**
- Never store tokens in plain text
- Unique IV (Initialization Vector) per token
- Key versioning for rotation
- Encrypted at rest in database
- Decrypted only when needed for API calls

**Encryption Process:**
1. OAuth token received from Facebook
2. Encrypted with AES-256-GCM algorithm
3. IV and keyId stored alongside encrypted data
4. Format: `encrypted:iv:keyId`
5. Stored in `clients_social_platforms.accessToken`

### 4. Automatic Token Refresh

**Proactive Refresh Strategy:**
- Tokens checked before every publish operation
- Auto-refresh if < 10 minutes until expiration
- Uses Meta's token exchange endpoint
- Re-encrypts refreshed tokens
- Updates database automatically
- Zero downtime for users

**Refresh Flow:**
```
1. Check token expiration
2. If < 10 min → trigger refresh
3. Call Meta token exchange API
4. Receive new long-lived token (60 days)
5. Encrypt new token
6. Update database
7. Continue with publish operation
```

**Benefits:**
- Prevents publish failures due to expired tokens
- No manual token management needed
- Transparent to end users
- Automatic for all connected accounts

### 5. Complete Audit Trail

**Immutable Audit Logs:**
- Every action logged permanently
- Cannot be modified or deleted
- Full user attribution
- IP address and User-Agent tracking
- Timestamp for all events

**Actions Tracked:**
- `account_connected` - OAuth connection completed
- `account_disconnected` - Account removed
- `post_published` - Content successfully published
- `post_failed` - Publish attempt failed
- `token_refreshed` - Automatic token renewal

**Audit Log Schema:**
```sql
id          UUID
userId      TEXT (who performed action)
accountId   UUID (which social account)
action      TEXT (what happened)
details     JSONB (full context)
ipAddress   TEXT
userAgent   TEXT
createdAt   TIMESTAMPTZ
```

**Use Cases:**
- Compliance reporting
- Client billing
- Error investigation
- Usage analytics
- Security auditing

## Architecture Overview

### Per-Client Social Platform Management

```
Client (Parent Entity)
  └── Social Platforms (Child Entity)
      ├── Instagram Business Account #1
      ├── Instagram Business Account #2
      ├── Facebook Page #1
      └── Facebook Page #2
```

**Database Structure:**
```sql
clients
  id UUID PRIMARY KEY

clients_social_platforms
  id UUID PRIMARY KEY
  parentId UUID → clients(id)  -- Client owner
  platform TEXT                 -- 'instagram_business' | 'facebook_page'
  platformAccountId TEXT        -- Instagram/Facebook account ID
  platformAccountName TEXT      -- @username or Page name
  accessToken TEXT              -- Encrypted token
  tokenExpiresAt TIMESTAMPTZ   -- Expiration date
  permissions JSONB             -- OAuth scopes granted
  accountMetadata JSONB         -- Profile pic, follower count, etc.
  isActive BOOLEAN              -- Soft delete flag
```

### OAuth Flow Architecture

**1. Initiate OAuth:**
```
User clicks "Connect Instagram"
  ↓
/api/v1/plugin/social-media-publisher/social/connect?platform=instagram_business&clientId={uuid}
  ↓
Redirect to Facebook OAuth with state parameter
```

**2. User Authorization:**
```
Facebook/Instagram authorization page
  ↓
User grants permissions
  ↓
Facebook redirects to callback URL
```

**3. Callback Processing:**
```
/api/v1/plugin/social-media-publisher/social/connect/callback?code={code}&state={state}
  ↓
Exchange code for access token
  ↓
Fetch connected Instagram/Facebook accounts
  ↓
Encrypt tokens (AES-256-GCM)
  ↓
Store in clients_social_platforms table
  ↓
Return success HTML with postMessage
```

**4. Client Updates:**
```
Popup sends postMessage to parent window
  ↓
Parent window receives success message
  ↓
Refresh page to show newly connected accounts
  ↓
Popup auto-closes after 2 seconds
```

### Publishing Architecture

**Publishing Flow:**
```
1. User selects client
2. User chooses social account (from client's accounts)
3. User uploads image and writes caption
4. POST /api/v1/plugin/social-media-publisher/social/publish
5. Plugin checks token expiration
6. Auto-refresh if needed (< 10 min)
7. Decrypt token
8. Call Instagram/Facebook API
9. Handle 2-step container process (Instagram)
10. Create audit log
11. Return result
```

**Token Security Flow:**
```
Database (encrypted)
  ↓
Read encrypted token
  ↓
Decrypt with AES-256-GCM
  ↓
Use in API call
  ↓
Never logged or stored in plain text
```

## Use Cases

### 1. Social Media Agency

**Scenario:** Agency managing social media for 50+ clients

**Implementation:**
- Each client record in system
- Clients connect their Instagram/Facebook accounts
- Agency team publishes on behalf of clients
- Audit logs for billing and compliance
- Token refresh happens automatically
- No manual token management

**Benefits:**
- Organized multi-client structure
- Clear account ownership
- Easy client onboarding/offboarding
- Complete audit trail for billing

### 2. Multi-Brand Business

**Scenario:** Company with 10 different brands, each with social presence

**Implementation:**
- Each brand as a "client" in system
- Brand managers connect brand accounts
- Centralized publishing platform
- Consistent security and audit
- Shared publishing workflows

**Benefits:**
- Unified management interface
- Brand isolation (no cross-posting accidents)
- Consistent branding per client
- Enterprise security

### 3. White-Label Social Media Platform

**Scenario:** SaaS platform offering social media management to end users

**Implementation:**
- End users = "clients" in system
- Users connect their own accounts
- Platform provides publishing interface
- Token encryption built-in
- Audit logs for platform analytics

**Benefits:**
- Production-ready OAuth
- Security out of the box
- Scalable architecture
- Compliance-ready

## Real-World Benefits

### For Agencies

✅ **Client Management** - Clear per-client account organization  
✅ **Security** - Enterprise-grade token encryption  
✅ **Compliance** - Complete audit trail  
✅ **Reliability** - Auto token refresh prevents failures  
✅ **Scalability** - Handle hundreds of clients  

### For Developers

✅ **OAuth Handled** - Complete OAuth flow implemented  
✅ **Token Security** - Encryption library included  
✅ **API Wrappers** - Facebook/Instagram APIs abstracted  
✅ **Type Safety** - Full TypeScript support  
✅ **Extensible** - Build custom features on top  

### For End Users

✅ **Simple Connection** - One-click OAuth popup  
✅ **Reliable Publishing** - Auto token refresh  
✅ **Multiple Accounts** - Connect unlimited accounts per client  
✅ **Secure** - Tokens never exposed  
✅ **Transparent** - Clear success/error messages  

## Technology Stack

### OAuth & APIs

**Facebook OAuth 2.0:**
- Authorization Code flow
- Long-lived tokens (60 days)
- Token exchange for refresh
- Popup-based authorization

**Instagram Business API:**
- Instagram Graph API (via Facebook)
- Requires Facebook Page connection
- 2-step container publishing
- Insights and analytics

**Facebook Pages API:**
- Facebook Graph API
- Direct page publishing
- Page insights
- Fan engagement metrics

### Security

**Encryption:**
- AES-256-GCM algorithm
- Unique IV per token
- Key versioning support
- NIST-approved cryptography

**Access Control:**
- Row-Level Security (RLS) policies
- User can only see own clients' accounts
- Postgres RLS enforcement
- Session-based authentication

**Audit:**
- Immutable logs
- Full attribution
- IP and User-Agent tracking
- GDPR-compliant logging

### Database

**PostgreSQL:**
- Parent-child entity relationships
- JSONB for flexible metadata
- RLS for access control
- Timestamptz for accurate time tracking

**Tables:**
- `clients` - Parent entity
- `clients_social_platforms` - Child entity (social accounts)
- `audit_logs` - Immutable audit trail

## Getting Started

### Quick Setup

1. **Create Facebook App** - Get OAuth credentials
2. **Configure Environment** - Add credentials and encryption key
3. **Enable Plugin** - Activate in theme config
4. **Connect Accounts** - OAuth flow via popup
5. **Start Publishing** - Use publish endpoint

### Next Steps

- **[Installation](./02-installation.md)** - Detailed setup guide
- **[Configuration](./03-configuration.md)** - Environment variables and OAuth setup
- **[OAuth Integration](../02-core-features/01-oauth-integration.md)** - Understanding the OAuth flow
- **[Publishing](../02-core-features/02-publishing.md)** - Start publishing content

## Key Concepts

### Per-Client Architecture

Social accounts are **child entities** of clients, not global user accounts. This means:
- Accounts belong to clients
- Users access via client relationship
- Clean separation of concerns
- Scalable for agencies

### Token Lifecycle

Tokens go through a managed lifecycle:
1. **Received** - From OAuth
2. **Encrypted** - AES-256-GCM
3. **Stored** - In database
4. **Decrypted** - Only when needed
5. **Refreshed** - Before expiration
6. **Re-encrypted** - After refresh

### Popup OAuth Pattern

OAuth uses popup window pattern:
- Main window stays open
- Popup opens for authorization
- User grants permissions
- Popup sends postMessage
- Main window refreshes
- Popup auto-closes

**Benefits:**
- No full-page redirects
- Preserves application state
- Better user experience
- Standard OAuth pattern

## Philosophy

This plugin is designed with these principles:

**Security First:**
- Never store plain text tokens
- Encryption at rest
- Access control via RLS
- Audit everything

**Agency-Focused:**
- Per-client management
- Multi-account support
- Scalable architecture
- Clear ownership

**Production-Ready:**
- Auto token refresh
- Comprehensive error handling
- Battle-tested OAuth
- Type-safe APIs

**Extensible:**
- Provider API wrappers
- TypeScript types
- Clear interfaces
- Easy to build on

The plugin provides the foundation; you build the features your business needs on top.
