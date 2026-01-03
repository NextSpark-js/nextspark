# Audit Logging

## Overview

The Social Media Publisher plugin implements a comprehensive, **immutable audit trail** that logs every significant action performed through the system. This provides complete visibility for compliance, debugging, billing, and security monitoring.

**Key Characteristics:**
- **Immutable** - Logs cannot be modified or deleted
- **Complete** - Every action logged with full context
- **Attributed** - User, account, IP, and User-Agent tracking
- **Timestamped** - Precise timestamp for all events
- **GDPR-Compliant** - Personal data handling follows regulations

## Audit Logs Entity

### Database Schema

```sql
CREATE TABLE "audit_logs" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,                    -- Who performed the action
  "accountId" UUID,                          -- Which social account (optional)
  action TEXT NOT NULL,                      -- What happened
  details JSONB DEFAULT '{}',                -- Full context
  "ipAddress" TEXT,                          -- IP address of request
  "userAgent" TEXT,                          -- Browser/client info
  "createdAt" TIMESTAMPTZ DEFAULT now()      -- When it happened
);

-- Indexes for common queries
CREATE INDEX "idx_audit_logs_userId" ON "audit_logs"("userId");
CREATE INDEX "idx_audit_logs_accountId" ON "audit_logs"("accountId");
CREATE INDEX "idx_audit_logs_action" ON "audit_logs"(action);
CREATE INDEX "idx_audit_logs_createdAt" ON "audit_logs"("createdAt" DESC);
```

### Field Descriptions

**id** (UUID)
- Unique identifier for log entry
- Auto-generated
- Used for reference and deduplication

**userId** (TEXT)
- User who performed the action
- References `users.id`
- Never null (system user for automated actions)

**accountId** (UUID, nullable)
- Social media account involved
- References `clients_social_platforms.id`
- Null for actions not tied to specific account

**action** (TEXT)
- Type of action performed
- Standardized enum values
- Used for filtering and reporting

**details** (JSONB)
- Full context of the action
- Flexible structure
- Includes relevant metadata

**ipAddress** (TEXT, nullable)
- IP address of request origin
- Useful for security monitoring
- Null for system-initiated actions

**userAgent** (TEXT, nullable)
- Browser/client information
- Helps identify automation vs human
- Null for backend processes

**createdAt** (TIMESTAMPTZ)
- Timestamp of action
- Automatically set
- Used for chronological sorting and retention

## Tracked Actions

### Account Management Actions

#### `account_connected`

**When:** User successfully connects social media account via OAuth

**Details Structure:**
```json
{
  "platform": "instagram_business",
  "accountName": "@brandname",
  "accountId": "17841401234567890",
  "clientId": "550e8400-e29b-41d4-a716-446655440000",
  "permissions": ["pages_show_list", "instagram_basic", "instagram_content_publish"],
  "tokenExpiresAt": "2024-03-15T10:30:00Z"
}
```

**Example:**
```typescript
await query(`
  INSERT INTO "audit_logs" (
    "userId", "accountId", action, details, "ipAddress", "userAgent"
  ) VALUES ($1, $2, $3, $4, $5, $6)
`, [
  userId,
  accountId,
  'account_connected',
  JSON.stringify({
    platform: 'instagram_business',
    accountName: '@brandname',
    clientId: clientId
  }),
  request.headers.get('x-forwarded-for'),
  request.headers.get('user-agent')
])
```

#### `account_disconnected`

**When:** User removes social media account

**Details Structure:**
```json
{
  "platform": "facebook_page",
  "accountName": "My Business Page",
  "reason": "user_requested",
  "hadActiveTokens": true
}
```

### Publishing Actions

#### `post_published`

**When:** Content successfully published to social platform

**Details Structure:**
```json
{
  "platform": "instagram_business",
  "accountName": "@brandname",
  "postId": "17899618652010220",
  "postUrl": "https://www.instagram.com/p/ABC123",
  "imageUrl": "https://cdn.example.com/image.jpg",
  "caption": "My awesome post! #instagram",
  "captionLength": 35,
  "publishedAt": "2024-01-15T14:30:00Z",
  "success": true
}
```

**Example:**
```typescript
await query(`
  INSERT INTO "audit_logs" (
    "userId", "accountId", action, details, "ipAddress", "userAgent"
  ) VALUES ($1, $2::uuid, $3, $4, $5, $6)
`, [
  userId,
  accountId,
  'post_published',
  JSON.stringify({
    platform: 'instagram_business',
    accountName: account.platformAccountName,
    postId: result.postId,
    postUrl: result.postUrl,
    imageUrl: imageUrl,
    caption: caption || '',
    publishedAt: new Date().toISOString(),
    success: true
  }),
  request.headers.get('x-forwarded-for'),
  request.headers.get('user-agent')
])
```

#### `post_failed`

**When:** Publishing attempt fails

**Details Structure:**
```json
{
  "platform": "facebook_page",
  "accountName": "My Business Page",
  "error": "Invalid parameter",
  "errorCode": 100,
  "errorDetails": {
    "message": "Image URL must be publicly accessible",
    "type": "OAuthException"
  },
  "imageUrl": "https://private.example.com/image.jpg",
  "caption": "Failed post caption",
  "attemptedAt": "2024-01-15T14:30:00Z"
}
```

### Token Management Actions

#### `token_refreshed`

**When:** OAuth token automatically refreshed

**Details Structure:**
```json
{
  "platform": "instagram_business",
  "accountName": "@brandname",
  "oldTokenExpiresAt": "2024-01-20T10:30:00Z",
  "newTokenExpiresAt": "2024-03-21T10:30:00Z",
  "minutesBeforeExpiry": 8,
  "refreshMethod": "automatic"
}
```

**Example:**
```typescript
await query(`
  INSERT INTO "audit_logs" (
    "userId", "accountId", action, details
  ) VALUES ($1, $2, $3, $4)
`, [
  'system',  // Automated action
  accountId,
  'token_refreshed',
  JSON.stringify({
    platform: account.platform,
    accountName: account.platformAccountName,
    oldTokenExpiresAt: oldExpiresAt,
    newTokenExpiresAt: newExpiresAt,
    minutesBeforeExpiry: minutesLeft,
    refreshMethod: 'automatic'
  })
])
```

#### `token_refresh_failed`

**When:** Token refresh attempt fails

**Details Structure:**
```json
{
  "platform": "facebook_page",
  "accountName": "My Business Page",
  "error": "Invalid OAuth 2.0 Access Token",
  "tokenExpiresAt": "2024-01-15T10:30:00Z",
  "minutesBeforeExpiry": 5,
  "requiresReconnection": true
}
```

## Querying Audit Logs

### Get User's Activity

```typescript
async function getUserActivity(
  userId: string,
  limit: number = 50
): Promise<AuditLog[]> {
  const result = await query(`
    SELECT * FROM "audit_logs"
    WHERE "userId" = $1
    ORDER BY "createdAt" DESC
    LIMIT $2
  `, [userId, limit])
  
  return result.rows
}
```

### Get Account Activity

```typescript
async function getAccountActivity(
  accountId: string
): Promise<AuditLog[]> {
  const result = await query(`
    SELECT * FROM "audit_logs"
    WHERE "accountId" = $1
    ORDER BY "createdAt" DESC
  `, [accountId])
  
  return result.rows
}
```

### Get Failed Publish Attempts

```typescript
async function getFailedPublishAttempts(
  userId: string,
  days: number = 30
): Promise<AuditLog[]> {
  const result = await query(`
    SELECT * FROM "audit_logs"
    WHERE "userId" = $1
    AND action = 'post_failed'
    AND "createdAt" > NOW() - INTERVAL '${days} days'
    ORDER BY "createdAt" DESC
  `, [userId])
  
  return result.rows
}
```

### Get Token Refresh History

```typescript
async function getTokenRefreshHistory(
  accountId: string
): Promise<AuditLog[]> {
  const result = await query(`
    SELECT * FROM "audit_logs"
    WHERE "accountId" = $1
    AND action IN ('token_refreshed', 'token_refresh_failed')
    ORDER BY "createdAt" DESC
  `, [accountId])
  
  return result.rows
}
```

### Activity By Action Type

```typescript
async function getActivityByAction(
  userId: string,
  action: string,
  startDate: Date,
  endDate: Date
): Promise<AuditLog[]> {
  const result = await query(`
    SELECT * FROM "audit_logs"
    WHERE "userId" = $1
    AND action = $2
    AND "createdAt" BETWEEN $3 AND $4
    ORDER BY "createdAt" DESC
  `, [userId, action, startDate, endDate])
  
  return result.rows
}
```

## Reporting and Analytics

### Publishing Success Rate

```sql
SELECT 
  DATE("createdAt") as date,
  COUNT(*) FILTER (WHERE action = 'post_published') as successful,
  COUNT(*) FILTER (WHERE action = 'post_failed') as failed,
  ROUND(
    COUNT(*) FILTER (WHERE action = 'post_published')::decimal / 
    NULLIF(COUNT(*), 0) * 100, 
    2
  ) as success_rate
FROM "audit_logs"
WHERE action IN ('post_published', 'post_failed')
AND "createdAt" > NOW() - INTERVAL '30 days'
GROUP BY DATE("createdAt")
ORDER BY date DESC;
```

### Most Active Users

```sql
SELECT 
  "userId",
  COUNT(*) FILTER (WHERE action = 'post_published') as posts_published,
  COUNT(*) FILTER (WHERE action = 'account_connected') as accounts_connected,
  COUNT(*) as total_actions
FROM "audit_logs"
WHERE "createdAt" > NOW() - INTERVAL '30 days'
GROUP BY "userId"
ORDER BY total_actions DESC
LIMIT 10;
```

### Platform Distribution

```sql
SELECT 
  details->>'platform' as platform,
  COUNT(*) as publish_count
FROM "audit_logs"
WHERE action = 'post_published'
AND "createdAt" > NOW() - INTERVAL '30 days'
GROUP BY details->>'platform'
ORDER BY publish_count DESC;
```

### Error Analysis

```sql
SELECT 
  details->>'error' as error_message,
  details->>'platform' as platform,
  COUNT(*) as occurrence_count,
  MAX("createdAt") as last_occurred
FROM "audit_logs"
WHERE action = 'post_failed'
AND "createdAt" > NOW() - INTERVAL '7 days'
GROUP BY details->>'error', details->>'platform'
ORDER BY occurrence_count DESC;
```

## Compliance and Retention

### GDPR Compliance

**Right to Access:**
```typescript
async function exportUserAuditLogs(userId: string): Promise<AuditLog[]> {
  const result = await query(`
    SELECT * FROM "audit_logs"
    WHERE "userId" = $1
    ORDER BY "createdAt" DESC
  `, [userId])
  
  return result.rows
}
```

**Right to Erasure:**
```typescript
async function anonymizeUserAuditLogs(userId: string): Promise<void> {
  // Anonymize personal data while keeping audit trail
  await query(`
    UPDATE "audit_logs"
    SET "userId" = 'anonymized',
        "ipAddress" = NULL,
        "userAgent" = NULL,
        details = jsonb_set(
          details,
          '{userId}',
          '"anonymized"'
        )
    WHERE "userId" = $1
  `, [userId])
}
```

### Retention Policy

**Recommended Policy:**
- **Active Logs:** Keep 1 year online
- **Archive:** Move to cold storage after 1 year
- **Deletion:** Delete after 7 years (or per regulations)

**Archive Implementation:**
```sql
-- Create archive table
CREATE TABLE "audit_logs_archive" (
  LIKE "audit_logs" INCLUDING ALL
);

-- Move old logs to archive
INSERT INTO "audit_logs_archive"
SELECT * FROM "audit_logs"
WHERE "createdAt" < NOW() - INTERVAL '1 year';

-- Delete from main table
DELETE FROM "audit_logs"
WHERE "createdAt" < NOW() - INTERVAL '1 year';
```

**Automated Retention:**
```typescript
// Run monthly via cron
async function enforceRetentionPolicy(): Promise<void> {
  // Archive logs older than 1 year
  await query(`
    INSERT INTO "audit_logs_archive"
    SELECT * FROM "audit_logs"
    WHERE "createdAt" < NOW() - INTERVAL '1 year'
  `)
  
  // Delete archived logs
  await query(`
    DELETE FROM "audit_logs"
    WHERE "createdAt" < NOW() - INTERVAL '1 year'
  `)
  
  // Delete archive logs older than 7 years
  await query(`
    DELETE FROM "audit_logs_archive"
    WHERE "createdAt" < NOW() - INTERVAL '7 years'
  `)
}
```

## Monitoring and Alerting

### Key Metrics to Monitor

**1. Failed Publish Rate:**
```sql
SELECT 
  ROUND(
    COUNT(*) FILTER (WHERE action = 'post_failed')::decimal / 
    NULLIF(COUNT(*), 0) * 100, 
    2
  ) as failed_rate
FROM "audit_logs"
WHERE action IN ('post_published', 'post_failed')
AND "createdAt" > NOW() - INTERVAL '1 hour';
```

**Alert If:** Failed rate > 10%

**2. Token Refresh Failures:**
```sql
SELECT COUNT(*) as failures
FROM "audit_logs"
WHERE action = 'token_refresh_failed'
AND "createdAt" > NOW() - INTERVAL '1 day';
```

**Alert If:** > 5 failures per day

**3. Unusual Activity:**
```sql
-- Detect accounts with unusually high publish volume
SELECT 
  "accountId",
  COUNT(*) as publish_count
FROM "audit_logs"
WHERE action = 'post_published'
AND "createdAt" > NOW() - INTERVAL '1 hour'
GROUP BY "accountId"
HAVING COUNT(*) > 10;  -- More than 10 posts per hour
```

**Alert If:** Unusual spikes detected (possible abuse)

### Alerting Implementation

```typescript
async function checkAuditAlertsAndNotify(): Promise<void> {
  // Check failed publish rate
  const failedRate = await getFailedPublishRate()
  if (failedRate > 10) {
    await sendAlert('high-failed-rate', { rate: failedRate })
  }
  
  // Check token refresh failures
  const tokenFailures = await getTokenRefreshFailures()
  if (tokenFailures > 5) {
    await sendAlert('token-refresh-failures', { count: tokenFailures })
  }
  
  // Check for unusual activity
  const unusualAccounts = await getUnusualActivity()
  if (unusualAccounts.length > 0) {
    await sendAlert('unusual-activity', { accounts: unusualAccounts })
  }
}
```

## Best Practices

### Do's ✅

**1. Always Log Critical Actions:**
```typescript
// ✅ Good: Log every publish attempt
await logAudit('post_published', { ... })
```

**2. Include Full Context:**
```typescript
// ✅ Good: Rich details
details: {
  platform: 'instagram',
  accountName: '@brand',
  postId: '123',
  imageUrl: 'https://...',
  caption: '...',
  success: true
}

// ❌ Bad: Minimal details
details: { success: true }
```

**3. Capture IP and User-Agent:**
```typescript
// ✅ Good
ipAddress: request.headers.get('x-forwarded-for'),
userAgent: request.headers.get('user-agent')
```

**4. Use Consistent Action Names:**
```typescript
// ✅ Good: Standardized
'account_connected', 'post_published', 'token_refreshed'

// ❌ Bad: Inconsistent
'ACCOUNT_CONNECTED', 'post-published', 'Token Refreshed'
```

### Don'ts ❌

**1. Don't Log Sensitive Data:**
```typescript
// ❌ Bad: Logs token
details: { token: decryptedToken }

// ✅ Good: Never log tokens
details: { tokenRefreshed: true }
```

**2. Don't Allow Log Deletion:**
```sql
-- ❌ Bad: DELETE operations allowed
DELETE FROM "audit_logs" WHERE id = $1;

-- ✅ Good: No DELETE, only INSERT
-- Enforce via database permissions
```

**3. Don't Skip Error Logging:**
```typescript
// ❌ Bad
if (error) {
  console.error(error)
  return  // No audit log
}

// ✅ Good
if (error) {
  await logAudit('post_failed', { error: error.message })
  return
}
```

## Next Steps

- **[Publishing](./02-publishing.md)** - See how audit logging integrates with publishing
- **[Token Management](./03-token-management.md)** - Token refresh audit logs
- **[Per-Client Architecture](../03-advanced-usage/03-per-client-architecture.md)** - Understand data model
