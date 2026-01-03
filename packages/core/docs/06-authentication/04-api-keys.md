# API Key Management

API keys provide programmatic access to your application's external APIs, enabling secure machine-to-machine authentication with scope-based permissions.

## Overview

API keys are an alternative authentication method designed for:
- External API clients
- Third-party integrations
- Automated scripts and services
- Mobile applications (with caution)

## API Key Structure

### Format

```text
your_api_key_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3
└───┘ └──┘ └───────────────────────────────────────────────────┘
  │    │                       │
Prefix  │                   Key Body (40 chars)
     Environment
```

**Components:**
- **sk** - Secret key prefix
- **live/test** - Environment indicator
- **Key body** - 40-character random string

### Storage

API keys are never stored in plaintext:

```typescript
// Key generation
const apiKey = generateApiKey() // sk_live_...
const keyHash = await hashKey(apiKey) // SHA-256 hash
const keyPrefix = apiKey.substring(0, 12) // For identification

// Database storage
{
  keyHash: "sha256_hash_here",  // Hashed key
  keyPrefix: "sk_live_a1b2", // For display only
  scopes: ["tasks:read", "tasks:write"],
  status: "active"
}
```

**Security Features:**
- Keys are hashed using SHA-256
- Only prefix stored for identification
- Full key shown only once during creation
- Constant-time comparison prevents timing attacks

## Scope-Based Permissions

### Scope Format

Scopes follow the pattern: `entity:action`

```text
tasks:read       // Read tasks
tasks:write      // Create and update tasks
tasks:delete     // Delete tasks
users:read       // Read user information
*                // Full access (admin only)
```

### Wildcard Scopes

```typescript
// Entity-level wildcard
"tasks:*"        // All operations on tasks

// Global wildcard
"*"              // All operations on all entities (superadmin)
```

### Scope Hierarchy

```text
* (highest)
  └─ entity:* (all operations on entity)
      └─ entity:write (create + update)
      └─ entity:read (view only)
      └─ entity:delete (delete only)
```

## Creating API Keys

### Via API Endpoint

**Endpoint**: `POST /api/v1/api-keys`

```typescript
const response = await fetch('/api/v1/api-keys', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // Requires session authentication
  },
  body: JSON.stringify({
    name: 'Production API Client',
    scopes: ['tasks:read', 'tasks:write', 'users:read'],
    expiresAt: '2025-12-31T23:59:59Z' // Optional
  })
})

const { data } = await response.json()
console.log('API Key (save this!):', data.key)
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "key-uuid-123",
    "keyPrefix": "sk_live_a1b2",
    "name": "Production API Client",
    "scopes": ["tasks:read", "tasks:write", "users:read"],
    "status": "active",
    "expiresAt": "2025-12-31T23:59:59Z",
    "key": "your_api_key_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t"
  }
}
```

> ⚠️ **Important**: The full `key` is only returned during creation. Save it immediately!

### Programmatic Creation

```typescript
// core/lib/api/keys.ts
import { ApiKeyManager } from '@/core/lib/api/keys'

const result = await ApiKeyManager.createKey({
  userId: 'user-id',
  name: 'Development Key',
  scopes: ['tasks:read'],
  expiresAt: new Date('2024-12-31')
})

console.log('New API Key:', result.key)
```

## Using API Keys

### In HTTP Requests

**Authorization Header (Preferred):**

```bash
curl https://api.yourapp.com/v1/tasks \
  -H "Authorization: Bearer sk_live_a1b2c3d4e5f6g7h8i9j0..." \
  -H "Content-Type: application/json"
```

**Alternative: X-API-Key Header:**

```bash
curl https://api.yourapp.com/v1/tasks \
  -H "X-API-Key: sk_live_a1b2c3d4e5f6g7h8i9j0..." \
  -H "Content-Type: application/json"
```

### In JavaScript/TypeScript

```typescript
const API_KEY = 'sk_live_a1b2c3d4e5f6g7h8i9j0...'

async function getTasks() {
  const response = await fetch('https://api.yourapp.com/v1/tasks', {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    }
  })
  
  return response.json()
}
```

### In Python

```python
import requests

API_KEY = 'sk_live_a1b2c3d4e5f6g7h8i9j0...'

response = requests.get(
    'https://api.yourapp.com/v1/tasks',
    headers={
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    }
)

tasks = response.json()
```

## API Key Validation Flow

```text
1. Extract API key from Authorization header
   ↓
2. Validate key format
   ↓
3. Extract prefix and hash the key
   ↓
4. Check cache for key data (5-minute TTL)
   ↓
5. If not cached, query database
   ↓
6. Verify key status (active/inactive/expired)
   ↓
7. Check expiration date
   ↓
8. Verify required scopes
   ↓
9. Update lastUsedAt (async, non-blocking)
   ↓
10. Grant access with user context
```

### Constant-Time Comparison

The validation uses constant-time delays to prevent timing attacks:

```typescript
async function validateApiKey(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // ... validation logic ...
    
    if (!valid) {
      await constantTimeDelay(startTime) // Always wait minimum time
      return null
    }
    
    return auth
  } catch (error) {
    await constantTimeDelay(startTime) // Same delay on error
    return null
  }
}

async function constantTimeDelay(startTime: number) {
  const minDelay = 100 // 100ms
  const elapsed = Date.now() - startTime
  const remaining = Math.max(0, minDelay - elapsed)
  if (remaining > 0) {
    await new Promise(resolve => setTimeout(resolve, remaining))
  }
}
```

**Security Benefit**: Attackers cannot determine if a key exists by measuring response time.

## Dual Authentication System

APIs support both session-based and API key authentication:

```typescript
// core/lib/api/auth/dual-auth.ts
export async function authenticateRequest(request: NextRequest) {
  // Try session authentication first
  const sessionAuth = await trySessionAuth(request)
  if (sessionAuth.success) {
    return sessionAuth
  }
  
  // Fall back to API key authentication
  const apiKeyAuth = await tryApiKeyAuth(request)
  if (apiKeyAuth.success) {
    return apiKeyAuth
  }
  
  // No valid authentication
  return { success: false, type: 'none' }
}
```

**Use Cases:**
- **Dashboard**: Uses session authentication
- **External APIs**: Uses API key authentication
- **Hybrid**: Some endpoints support both

## Managing API Keys

### List Keys

```bash
GET /api/v1/api-keys
```

```json
{
  "success": true,
  "data": [
    {
      "id": "key-123",
      "keyPrefix": "sk_live_a1b2",
      "name": "Production API",
      "scopes": ["tasks:read", "tasks:write"],
      "status": "active",
      "lastUsedAt": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Get Key Details

```bash
GET /api/v1/api-keys/{id}
```

### Revoke Key

```bash
DELETE /api/v1/api-keys/{id}
```

**Effect**: Key is immediately invalidated and cannot be used.

## Key Rotation

### Manual Rotation

1. Create new API key with same scopes
2. Update client applications with new key
3. Verify new key works
4. Delete old key

### Automatic Expiration

Set expiration during creation:

```typescript
{
  name: 'Temporary Integration',
  scopes: ['tasks:read'],
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
}
```

## Rate Limiting

API keys have per-key rate limits:

```typescript
// Per key, per minute
const rateLimits = {
  'tasks:read': 1000,
  'tasks:write': 500,
  'tasks:delete': 100,
  '*': 10000 // Full access keys
}
```

**Response when rate limited:**

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

## Security Best Practices

### Key Generation

```typescript
// Generate cryptographically secure random keys
import { randomBytes } from 'crypto'

function generateSecureKey(): string {
  const randomPart = randomBytes(30).toString('base64url')
  return `sk_live_${randomPart}`
}
```

### Key Storage (Client-Side)

**✅ Good:**
- Environment variables (`.env` files)
- Secure secret management (AWS Secrets Manager, Vault)
- Encrypted configuration files

**❌ Bad:**
- Hardcoded in source code
- Committed to version control
- Stored in frontend JavaScript
- Logged in plaintext

### Scope Principle

Always use least privilege:

```typescript
// ✅ Good: Minimal scopes
{
  name: 'Read-only Dashboard',
  scopes: ['tasks:read', 'users:read']
}

// ❌ Bad: Excessive permissions
{
  name: 'Read-only Dashboard',
  scopes: ['*'] // Way too much!
}
```

## Monitoring and Auditing

### Track Usage

```typescript
// Automatically tracked per key
{
  lastUsedAt: "2024-01-15T10:30:00Z",
  totalRequests: 1250,
  requestsLast24h: 45
}
```

### Audit Log

All API key operations are logged:

```sql
CREATE TABLE "api_audit_log" (
  "id" TEXT PRIMARY KEY,
  "keyId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "timestamp" TIMESTAMP DEFAULT NOW()
);
```

## Troubleshooting

### Common Issues

**Issue**: "Invalid API key"

```typescript
// Check key format
const isValid = /^sk_(live|test)_[A-Za-z0-9_-]{40}$/.test(apiKey)
```

**Issue**: "Insufficient permissions"

```typescript
// Verify scopes
const hasScope = auth.scopes.includes('tasks:write')
```

**Issue**: "API key expired"

```typescript
// Check expiration
const isExpired = expiresAt && new Date(expiresAt) < new Date()
```

## Next Steps

1. **[Session Management](./05-session-management.md)** - Alternative authentication method
2. **[Permissions and Roles](./06-permissions-and-roles.md)** - Understanding scopes
3. **[Security Best Practices](./07-security-best-practices.md)** - API key security

---

> 💡 **Tip**: Use different API keys for development, staging, and production. Rotate keys regularly and revoke unused keys immediately.
