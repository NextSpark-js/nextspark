# Token Management

## Overview

The Social Media Publisher plugin implements a comprehensive token management system that ensures OAuth tokens are securely encrypted, automatically refreshed, and never exposed. This system is critical for maintaining continuous publishing capabilities without user intervention.

**Key Features:**
- AES-256-GCM encryption for all tokens
- Automatic refresh before expiration
- Versioned encryption keys
- Immutable audit trail
- Zero downtime token rotation

## Token Lifecycle

### 1. Token Acquisition (OAuth)

**When:** User connects account via OAuth  
**Process:** Facebook returns access token  
**Token Type:** Long-lived (60 days)

```typescript
// OAuth callback receives token
const { access_token, expires_in } = await exchangeCodeForToken(authCode)

// Calculate expiration
const expiresAt = new Date(Date.now() + expires_in * 1000)
// Result: 60 days from now
```

### 2. Token Encryption

**When:** Immediately after acquisition  
**Process:** Encrypt with AES-256-GCM  
**Storage Format:** `encrypted:iv:keyId`

```typescript
import { TokenEncryption } from '@/core/lib/oauth/encryption'

// Plain text token from Facebook
const accessToken = "EAABwzLixnjYBAA..."

// Encrypt
const { encrypted, iv, keyId } = await TokenEncryption.encrypt(accessToken)

// Format for storage
const storedToken = `${encrypted}:${iv}:${keyId}`
// Example: a3f9b2c8...d4e5:9f7e3a...b5c2:key_2024_01
```

**Encryption Details:**
- **Algorithm:** AES-256-GCM (Advanced Encryption Standard)
- **Key Size:** 256 bits (32 bytes)
- **IV (Initialization Vector):** 96 bits, unique per token
- **Authentication Tag:** 128 bits (prevents tampering)
- **Key Derivation:** Direct from `OAUTH_ENCRYPTION_KEY` environment variable

### 3. Token Storage

**Where:** `clients_social_platforms` table  
**Column:** `accessToken` (TEXT)  
**Format:** `encrypted:iv:keyId`

```sql
INSERT INTO "clients_social_platforms" (
  "parentId",
  platform,
  "platformAccountId",
  "platformAccountName",
  "accessToken",
  "tokenExpiresAt"
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'instagram_business',
  '17841401234567890',
  '@brandname',
  'a3f9b2c8d1e3f4a5b6c7d8e9f0a1b2c3:9f7e3ab5c2:key_2024_01',
  '2024-03-15 10:30:00+00'
);
```

**Security:**
- ✅ Never stored in plain text
- ✅ Unique IV per token (prevents pattern analysis)
- ✅ Key versioning (allows key rotation)
- ✅ At-rest encryption
- ✅ RLS policies restrict access

### 4. Token Decryption (On Use)

**When:** Before making API calls  
**Process:** Decrypt in memory only  
**Lifetime:** Exists only during request

```typescript
// Read encrypted token from database
const account = await query(`
  SELECT "accessToken" FROM "clients_social_platforms"
  WHERE id = $1
`, [accountId])

// Decrypt
const [encrypted, iv, keyId] = account.accessToken.split(':')
const decryptedToken = await TokenEncryption.decrypt(encrypted, iv, keyId)

// Use for API call
await InstagramAPI.publishPhoto({
  accessToken: decryptedToken,  // Used here
  // ...
})

// Token discarded after request (not stored)
```

**Security:**
- ✅ Decrypted only when needed
- ✅ Never logged
- ✅ Never sent to client
- ✅ Exists only in server memory
- ✅ Garbage collected after use

### 5. Token Refresh

**When:** < 10 minutes until expiration  
**Trigger:** Automatic before publish operation  
**Process:** Exchange old token for new long-lived token

```typescript
// Check if refresh needed
const now = new Date()
const expiresAt = new Date(account.tokenExpiresAt)
const minutesUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60)

if (minutesUntilExpiry < 10) {
  console.log('🔄 Token expiring soon, refreshing...')
  
  // Call Meta token exchange endpoint
  const response = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?` +
    `grant_type=fb_exchange_token&` +
    `client_id=${FACEBOOK_CLIENT_ID}&` +
    `client_secret=${FACEBOOK_CLIENT_SECRET}&` +
    `fb_exchange_token=${currentToken}`
  )
  
  const { access_token, expires_in } = await response.json()
  
  // Re-encrypt new token
  const { encrypted, iv, keyId } = await TokenEncryption.encrypt(access_token)
  const newEncryptedToken = `${encrypted}:${iv}:${keyId}`
  const newExpiresAt = new Date(Date.now() + expires_in * 1000)
  
  // Update database
  await query(`
    UPDATE "clients_social_platforms"
    SET "accessToken" = $1,
        "tokenExpiresAt" = $2,
        "updatedAt" = NOW()
    WHERE id = $3
  `, [newEncryptedToken, newExpiresAt, accountId])
  
  // Create audit log
  await query(`
    INSERT INTO "audit_logs" ("userId", "accountId", action, details)
    VALUES ($1, $2, 'token_refreshed', $3)
  `, [userId, accountId, { oldExpiry: expiresAt, newExpiry: newExpiresAt }])
  
  console.log('✅ Token refreshed successfully')
}
```

### 6. Token Expiration

**Expiration Time:** 60 days (5,184,000 seconds)  
**Warning Threshold:** 10 minutes before expiration  
**Action:** Automatic refresh or require reconnection

**If Refresh Fails:**
```typescript
// Publish endpoint blocks operation
return NextResponse.json({
  error: 'Token expired and refresh failed',
  details: 'OAuth token could not be refreshed',
  suggestion: 'Please reconnect your social media account'
}, { status: 403 })
```

**User Must:**
1. Go to client social platforms page
2. Disconnect expired account
3. Reconnect via OAuth
4. New 60-day token issued

## Token Encryption Deep Dive

### AES-256-GCM Algorithm

**Why GCM (Galois/Counter Mode)?**
- ✅ **Authenticated Encryption** - Prevents tampering
- ✅ **Performance** - Faster than CBC mode
- ✅ **Parallel Processing** - Can decrypt in parallel
- ✅ **NIST Approved** - Industry standard

**Encryption Process:**
```typescript
import crypto from 'crypto'

export class TokenEncryption {
  static async encrypt(plainText: string): Promise<{
    encrypted: string
    iv: string
    keyId: string
  }> {
    // Get encryption key from environment
    const encryptionKey = Buffer.from(process.env.OAUTH_ENCRYPTION_KEY!, 'hex')
    
    // Generate random IV (96 bits)
    const iv = crypto.randomBytes(12)
    
    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv)
    
    // Encrypt
    let encrypted = cipher.update(plainText, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    // Get authentication tag
    const authTag = cipher.getAuthTag()
    
    // Combine encrypted + authTag
    const combined = encrypted + authTag.toString('hex')
    
    return {
      encrypted: combined,
      iv: iv.toString('hex'),
      keyId: 'key_2024_01'  // Version identifier
    }
  }
  
  static async decrypt(
    encryptedWithTag: string,
    ivHex: string,
    keyId: string
  ): Promise<string> {
    // Get encryption key
    const encryptionKey = Buffer.from(process.env.OAUTH_ENCRYPTION_KEY!, 'hex')
    
    // Separate encrypted data and auth tag
    const authTag = Buffer.from(encryptedWithTag.slice(-32), 'hex')
    const encrypted = encryptedWithTag.slice(0, -32)
    
    // Create decipher
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      encryptionKey,
      Buffer.from(ivHex, 'hex')
    )
    
    // Set auth tag
    decipher.setAuthTag(authTag)
    
    // Decrypt
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }
}
```

### Token Format Breakdown

```
Format: encrypted:iv:keyId

Example:
a3f9b2c8d1e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9:9f7e3ab5c2d4e6:key_2024_01

Part 1: encrypted (variable length)
  - Encrypted token + authentication tag
  - Hex encoded
  - Length depends on token length

Part 2: iv (24 hex characters)
  - Initialization Vector (96 bits)
  - Unique per encryption
  - Required for decryption

Part 3: keyId (version identifier)
  - Identifies which encryption key was used
  - Allows key rotation
  - Example: key_2024_01, key_2024_02
```

## Token Refresh Mechanism

### Refresh Triggers

**1. Pre-Publish Check (Primary)**
```typescript
// Every publish operation checks token expiration
if (minutesUntilExpiry < 10) {
  await refreshToken()
}
```

**2. Scheduled Cron Job (Recommended - Not Implemented)**
```typescript
// Run daily at 2 AM
// Refresh all tokens expiring within 7 days
async function refreshExpiringTokens() {
  const expiringAccounts = await query(`
    SELECT * FROM "clients_social_platforms"
    WHERE "tokenExpiresAt" < NOW() + INTERVAL '7 days'
    AND "isActive" = true
  `)
  
  for (const account of expiringAccounts) {
    await refreshAccountToken(account.id)
  }
}
```

### Meta Token Exchange API

**Endpoint:**
```
GET https://graph.facebook.com/v18.0/oauth/access_token
```

**Parameters:**
```typescript
{
  grant_type: 'fb_exchange_token',
  client_id: FACEBOOK_CLIENT_ID,
  client_secret: FACEBOOK_CLIENT_SECRET,
  fb_exchange_token: currentToken  // Old token
}
```

**Response:**
```json
{
  "access_token": "EAABwzLixnjY...",  // New token
  "token_type": "bearer",
  "expires_in": 5184000  // 60 days (seconds)
}
```

**Token Characteristics:**
- **Old Token:** Remains valid for ~24 hours after exchange
- **New Token:** Valid for 60 days from exchange
- **Limit:** Can exchange once per day per token
- **Rate Limit:** Subject to app rate limits

### Refresh Threshold Configuration

**Current Setting:** 10 minutes

**Why 10 Minutes?**
- ✅ Prevents last-second failures
- ✅ Allows time for retry if refresh fails
- ✅ Minimal unnecessary refreshes
- ✅ User unaware of refresh process

**Alternative Thresholds:**

```typescript
// Conservative (1 hour)
const REFRESH_THRESHOLD_MINUTES = 60
// More API calls, but very safe

// Balanced (10 minutes) - Default
const REFRESH_THRESHOLD_MINUTES = 10

// Aggressive (1 minute)
const REFRESH_THRESHOLD_MINUTES = 1
// Riskier, might miss some edge cases
```

### Refresh Failure Handling

**If Refresh Fails:**

1. **Block Publish Operation:**
   ```typescript
   return NextResponse.json({
     error: 'Token expired and refresh failed',
     details: refreshError,
     suggestion: 'Please reconnect your social media account'
   }, { status: 403 })
   ```

2. **Create Audit Log:**
   ```typescript
   await query(`
     INSERT INTO "audit_logs" 
     ("userId", "accountId", action, details)
     VALUES ($1, $2, 'token_refresh_failed', $3)
   `, [userId, accountId, { error: refreshError }])
   ```

3. **Optional: Deactivate Account:**
   ```typescript
   // Mark account as inactive (requires reconnection)
   await query(`
     UPDATE "clients_social_platforms"
     SET "isActive" = false
     WHERE id = $1
   `, [accountId])
   ```

4. **Notify User:**
   ```typescript
   // Send notification (email, in-app)
   await sendNotification(userId, {
     type: 'token_expired',
     message: 'Social media account needs reconnection',
     accountName: account.platformAccountName
   })
   ```

## Token Versioning & Key Rotation

### Key Versioning

**Purpose:** Allow encryption key rotation without invalidating existing tokens

**Implementation:**
```typescript
// Store key version with encrypted token
const keyId = 'key_2024_01'

// During decryption, use appropriate key
const decryptionKey = getKeyById(keyId)
```

**Key Rotation Process:**

1. **Generate New Key:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Add to Environment:**
   ```bash
   # Keep old key
   OAUTH_ENCRYPTION_KEY_2024_01=old_key_here
   
   # Add new key
   OAUTH_ENCRYPTION_KEY=new_key_here
   OAUTH_ENCRYPTION_KEY_ID=key_2024_02
   ```

3. **Update Encryption Function:**
   ```typescript
   static async encrypt(plainText: string) {
     const keyId = process.env.OAUTH_ENCRYPTION_KEY_ID || 'key_2024_02'
     const encryptionKey = process.env.OAUTH_ENCRYPTION_KEY
     // ... rest of encryption
   }
   ```

4. **Update Decryption Function:**
   ```typescript
   static async decrypt(encrypted: string, iv: string, keyId: string) {
     // Get key based on keyId
     const keyEnvVar = keyId === 'key_2024_01' 
       ? 'OAUTH_ENCRYPTION_KEY_2024_01'
       : 'OAUTH_ENCRYPTION_KEY'
     
     const encryptionKey = process.env[keyEnvVar]
     // ... rest of decryption
   }
   ```

5. **Gradual Migration:**
   ```typescript
   // Migrate old tokens to new key
   async function migrateTokens() {
     const oldTokens = await query(`
       SELECT * FROM "clients_social_platforms"
       WHERE "accessToken" LIKE '%:key_2024_01'
     `)
     
     for (const account of oldTokens) {
       // Decrypt with old key
       const [encrypted, iv, oldKeyId] = account.accessToken.split(':')
       const plainToken = await TokenEncryption.decryptWithKey(
         encrypted, iv, oldKeyId
       )
       
       // Re-encrypt with new key
       const { encrypted: newEncrypted, iv: newIv, keyId: newKeyId } 
         = await TokenEncryption.encrypt(plainToken)
       
       // Update database
       await query(`
         UPDATE "clients_social_platforms"
         SET "accessToken" = $1
         WHERE id = $2
       `, [`${newEncrypted}:${newIv}:${newKeyId}`, account.id])
     }
   }
   ```

## Security Best Practices

### Do's ✅

**1. Never Log Decrypted Tokens:**
```typescript
// ✅ Good
console.log('Using token for API call')

// ❌ Bad
console.log('Token:', decryptedToken)
```

**2. Decrypt Only When Needed:**
```typescript
// ✅ Good
const token = await decrypt(...)
await makeAPICall(token)
// Token discarded

// ❌ Bad
const token = await decrypt(...)
this.token = token  // Stored in memory
```

**3. Validate Before Decryption:**
```typescript
// ✅ Good
if (!account.accessToken.includes(':')) {
  throw new Error('Invalid token format')
}

// ❌ Bad
const token = await decrypt(account.accessToken)  // Might fail
```

**4. Use RLS Policies:**
```sql
-- ✅ Good: Users can only access own clients' tokens
CREATE POLICY "rls_social_platforms"
ON "clients_social_platforms"
USING ("parentId" IN (
  SELECT id FROM "clients" WHERE "userId" = current_user_id()
));
```

**5. Rotate Keys Periodically:**
```
Every 6-12 months:
1. Generate new key
2. Deploy with both keys
3. Migrate tokens
4. Remove old key
```

### Don'ts ❌

**1. Don't Store Plain Text Tokens:**
```typescript
// ❌ Bad
await query(`INSERT INTO accounts VALUES ($1)`, [plainTextToken])

// ✅ Good
const encrypted = await encrypt(plainTextToken)
await query(`INSERT INTO accounts VALUES ($1)`, [encrypted])
```

**2. Don't Send Tokens to Client:**
```typescript
// ❌ Bad
return NextResponse.json({ token: decryptedToken })

// ✅ Good
// Never send to client - use on server only
```

**3. Don't Reuse IVs:**
```typescript
// ❌ Bad
const iv = Buffer.from('same_iv_always')

// ✅ Good
const iv = crypto.randomBytes(12)  // Unique each time
```

**4. Don't Skip Token Validation:**
```typescript
// ❌ Bad
const token = await decrypt(dbToken)

// ✅ Good
if (isTokenExpired(expiresAt)) {
  await refreshToken()
}
const token = await decrypt(dbToken)
```

## Monitoring & Alerts

### Key Metrics to Track

**1. Token Refresh Success Rate:**
```sql
SELECT 
  COUNT(*) FILTER (WHERE action = 'token_refreshed') as successful,
  COUNT(*) FILTER (WHERE action = 'token_refresh_failed') as failed,
  ROUND(
    COUNT(*) FILTER (WHERE action = 'token_refreshed')::decimal / 
    NULLIF(COUNT(*), 0) * 100, 
    2
  ) as success_rate
FROM "audit_logs"
WHERE action IN ('token_refreshed', 'token_refresh_failed')
AND "createdAt" > NOW() - INTERVAL '30 days';
```

**2. Token Expiration Distribution:**
```sql
SELECT 
  CASE
    WHEN "tokenExpiresAt" < NOW() THEN 'Expired'
    WHEN "tokenExpiresAt" < NOW() + INTERVAL '7 days' THEN 'Expiring Soon'
    WHEN "tokenExpiresAt" < NOW() + INTERVAL '30 days' THEN 'Expiring This Month'
    ELSE 'Healthy'
  END as status,
  COUNT(*) as count
FROM "clients_social_platforms"
WHERE "isActive" = true
GROUP BY status;
```

**3. Failed Publish Attempts Due to Token Issues:**
```sql
SELECT DATE("createdAt") as date, COUNT(*) as failures
FROM "audit_logs"
WHERE action = 'post_failed'
AND details->>'error' LIKE '%token%'
GROUP BY DATE("createdAt")
ORDER BY date DESC
LIMIT 30;
```

### Alerting Rules

**Alert if:**
- Token refresh failure rate > 5%
- More than 10 tokens expire without refresh
- Encryption/decryption errors
- API rate limits hit

## Next Steps

- **[Audit Logging](./04-audit-logging.md)** - Track all token operations
- **[Provider APIs](../03-advanced-usage/01-provider-apis.md)** - Use tokens in API calls
- **[Publishing](./02-publishing.md)** - Token usage in publishing
