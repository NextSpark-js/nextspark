# API Authentication

**Dual authentication • API keys • Sessions • Scope system • Security**

---

## Table of Contents

- [Overview](#overview)
- [Authentication Methods](#authentication-methods)
- [API Key Authentication](#api-key-authentication)
- [Session Authentication](#session-authentication)
- [Dual Authentication Flow](#dual-authentication-flow)
- [Scope System](#scope-system)
- [Generating API Keys](#generating-api-keys)
- [Using API Keys](#using-api-keys)
- [Using Sessions](#using-sessions)
- [Permission Validation](#permission-validation)
- [Security Best Practices](#security-best-practices)
- [Rate Limiting](#rate-limiting)
- [Troubleshooting](#troubleshooting)

---

## Overview

The API v1 authentication system supports **two authentication methods** that work seamlessly together:

**Key Features:**
- ✅ **Dual Authentication** - API Keys OR Sessions in single endpoint
- ✅ **Scope-Based Permissions** - Granular access control
- ✅ **Secure by Default** - SHA-256 hashed keys, HttpOnly cookies
- ✅ **Automatic Fallback** - Session first, then API Key
- ✅ **Rate Limiting** - Per-key/per-user limits
- ✅ **Type-Safe** - Full TypeScript support

**Authentication Sources:**
```typescript
core/lib/api/auth/dual-auth.ts   // Dual authentication system
core/lib/api/keys.ts             // API key management
core/lib/auth.ts                 // Session authentication (Better Auth)
```

---

## Authentication Methods

### Comparison

| Feature | API Keys | Sessions |
|---------|----------|----------|
| **Use Case** | External integrations, mobile apps, scripts | Dashboard users |
| **Header** | `Authorization: Bearer sk_xxx` | Cookie (automatic) |
| **Permissions** | Scope-based | Role-based + Scopes |
| **Rate Limiting** | Per-key limits | Per-user limits |
| **Expiration** | 365 days (configurable) | Session-based |
| **Revocation** | Delete key in dashboard | Logout |
| **Best For** | Server-to-server, third-party | Browser-based apps |

### When to Use Each

**Use API Keys when:**
- ✅ Building mobile applications
- ✅ Third-party service integration
- ✅ Server-to-server communication
- ✅ Automated scripts/cron jobs
- ✅ Need specific scope restrictions
- ✅ External developers need access

**Use Sessions when:**
- ✅ User is logged into dashboard
- ✅ Browser-based JavaScript applications
- ✅ Need full user context (role, flags, etc.)
- ✅ SSR with Next.js Server Components
- ✅ Want automatic authentication

---

## API Key Authentication

### API Key Format

```typescript
// Format: sk_{environment}_{random}
sk_live_abc123def456...   // Production key (72 chars total)
your_test_api_key_here...   // Development key

// Breakdown:
// - sk_         : Prefix (secret key)
// - live/test   : Environment
// - [64 chars]  : Random hex (32 bytes)
```

### How API Key Auth Works

**Flow Diagram:**

```text
1. Client sends request with Authorization header
   ↓
   Header: Authorization: Bearer sk_live_abc123...
   ↓
2. Server extracts key from header
   ↓
   key = "sk_live_abc123..."
   ↓
3. Hash the provided key (SHA-256)
   ↓
   hash = sha256(key)
   ↓
4. Query database for matching hash
   ↓
   SELECT * FROM api_keys WHERE key_hash = $1
   ↓
5. Validate key is active and not expired
   ↓
   IF key.active && key.expiresAt > now()
   ↓
6. Load user and scopes
   ↓
   user = get user by key.userId
   scopes = key.scopes
   ↓
7. Return auth result
   ↓
   { success: true, type: 'api-key', user, scopes }
```

### Code Implementation

```typescript
// core/lib/api/auth/dual-auth.ts
async function tryApiKeyAuth(request: NextRequest): Promise<DualAuthResult> {
  try {
    // 1. Check for API Key in headers
    const authHeader = request.headers.get('authorization')
    const apiKeyHeader = request.headers.get('x-api-key')

    if (!authHeader?.startsWith('Bearer ') && !apiKeyHeader) {
      return { success: false, type: 'none', user: null }
    }

    // 2. Validate API Key
    const apiAuth = await validateApiKey(request)

    if (!apiAuth) {
      return { success: false, type: 'none', user: null }
    }

    // 3. Get user information
    const userInfo = await queryOne<{ email: string; role: string }>(
      'SELECT email, role FROM "users" WHERE id = $1',
      [apiAuth.userId]
    )

    // 4. Return successful auth with scopes
    return {
      success: true,
      type: 'api-key',
      user: {
        id: apiAuth.userId,
        email: userInfo?.email || '',
        role: userInfo?.role || 'user'
      },
      scopes: apiAuth.scopes || []
    }
  } catch (error) {
    console.error('API Key auth failed:', error)
    return { success: false, type: 'none', user: null }
  }
}
```

---

## Session Authentication

### How Session Auth Works

**Flow Diagram:**

```text
1. Client sends request with cookies
   ↓
   Cookie: session=eyJhbGc...
   ↓
2. Server reads session from cookie
   ↓
   session = auth.api.getSession({ headers })
   ↓
3. Validate session is active
   ↓
   IF session && session.user
   ↓
4. Generate scopes from user role
   ↓
   scopes = generateScopesForRole(user.role, user.flags)
   ↓
5. Return auth result with full access
   ↓
   { success: true, type: 'session', user, scopes: ['all'] }
```

### Code Implementation

```typescript
// core/lib/api/auth/dual-auth.ts
async function trySessionAuth(request: NextRequest): Promise<DualAuthResult> {
  try {
    console.log('[dual-auth] Attempting session authentication...')

    // 1. Get session from Better Auth
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user) {
      console.log('[dual-auth] No session.user found')
      return { success: false, type: 'none', user: null }
    }

    // 2. Return successful auth (sessions have full access)
    console.log('[dual-auth] Session auth successful for user:', session.user.id)
    return {
      success: true,
      type: 'session',
      user: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role || 'user'
      },
      scopes: ['all'] // Sessions have full access
    }
  } catch (error) {
    console.error('[dual-auth] Session auth failed:', error)
    return { success: false, type: 'none', user: null }
  }
}
```

### Session Scope Generation

```typescript
// core/lib/api/helpers.ts (lines 72-92)
function generateScopesForRole(role: string, flags: UserFlag[] = []): string[] {
  // Base scopes - loaded from registry-based config
  const baseScopes = getBaseScopesFromRegistry()
  let scopes = [...baseScopes]

  // Role-based scopes
  const roleScopes = getRoleScopesFromRegistry(role)
  scopes = [...scopes, ...roleScopes]

  // Flag-based scopes
  for (const flag of flags) {
    const flagScopes = getFlagScopesFromRegistry(flag)
    scopes = [...scopes, ...flagScopes]
  }

  // Apply restrictions
  scopes = applyRestrictionRulesFromRegistry(scopes, flags)

  return scopes
}
```

---

## Dual Authentication Flow

### Priority Order

The authentication system tries methods in this order:

**1. API Key (First Priority)**
```typescript
// Check Authorization header or X-API-Key header
const authHeader = request.headers.get('authorization')
const apiKeyHeader = request.headers.get('x-api-key')

if (authHeader?.startsWith('Bearer ') || apiKeyHeader) {
  // Try API Key authentication
  const result = await tryApiKeyAuth(request)
  if (result.success) return result
}
```

**2. Session (Fallback)**
```typescript
// Check session cookie
const session = await auth.api.getSession({ headers: request.headers })

if (session?.user) {
  // Use session authentication
  return { success: true, type: 'session', user: session.user, scopes: ['all'] }
}
```

**3. Unauthorized (Both Failed)**
```typescript
// Neither API Key nor Session found
return { success: false, type: 'none', user: null }
```

### Complete Flow

```typescript
// core/lib/api/auth/dual-auth.ts
export async function authenticateRequest(request: NextRequest): Promise<DualAuthResult> {
  // First try API Key authentication
  const apiKeyResult = await tryApiKeyAuth(request)
  if (apiKeyResult.success) {
    return apiKeyResult
  }

  // Then try Session authentication
  const sessionResult = await trySessionAuth(request)
  if (sessionResult.success) {
    return sessionResult
  }

  // Both failed
  return {
    success: false,
    type: 'none',
    user: null
  }
}
```

### Using in Endpoints

```typescript
// app/api/v1/[entity]/route.ts
import { authenticateRequest, createAuthError, hasRequiredScope } from '@/core/lib/api/auth/dual-auth'

export async function GET(request: NextRequest) {
  // Authenticate (API Key OR Session)
  const authResult = await authenticateRequest(request)

  if (!authResult.success) {
    return createAuthError('Authentication required', 401)
  }

  // Check permissions
  if (!hasRequiredScope(authResult, 'products:read')) {
    return createAuthError('Insufficient permissions', 403)
  }

  // Use auth info
  console.log(`Request by: ${authResult.user?.email} (${authResult.type})`)

  // Process request...
}
```

---

## Scope System

### Available Scopes

```typescript
// core/lib/api/keys.ts
export const API_SCOPES = {
  // User management
  'users:read': 'Read user information',
  'users:write': 'Create and update users',
  'users:delete': 'Delete users',

  // Tasks
  'tasks:read': 'Read tasks',
  'tasks:write': 'Create and update tasks',
  'tasks:delete': 'Delete tasks',

  // Media (files, images, videos)
  'media:read': 'Read file and media information',
  'media:write': 'Upload and update files',
  'media:delete': 'Delete files',

  // Administration
  'admin:api-keys': 'Manage API keys',
  'admin:users': 'Full user administration',

  // Wildcard (superadmin only)
  '*': 'Full access (superadmin only)'
}
```

### Scope Categories

```typescript
export const SCOPE_CATEGORIES = {
  users: {
    name: 'Users',
    description: 'User management',
    scopes: ['users:read', 'users:write', 'users:delete']
  },
  tasks: {
    name: 'Tasks',
    description: 'Task and TODO management',
    scopes: ['tasks:read', 'tasks:write', 'tasks:delete']
  },
  admin: {
    name: 'Administration',
    description: 'Administrative functions',
    scopes: ['admin:api-keys', 'admin:users']
  },
  system: {
    name: 'System',
    description: 'Full system access',
    scopes: ['*']
  }
}
```

### Scope Patterns

**Read-Write-Delete Pattern:**
```text
{entity}:read    - View/list resources
{entity}:write   - Create/update resources
{entity}:delete  - Remove resources
```

**Examples:**
```typescript
'products:read'    // GET /api/v1/products, GET /api/v1/products/:id
'products:write'   // POST /api/v1/products, PATCH /api/v1/products/:id
'products:delete'  // DELETE /api/v1/products/:id
```

### Checking Scopes

```typescript
// core/lib/api/auth/dual-auth.ts
export function hasRequiredScope(authResult: DualAuthResult, requiredScope: string): boolean {
  // Sessions have full access
  if (authResult.type === 'session') {
    return true
  }

  // API Keys check scopes
  if (authResult.type === 'api-key' && authResult.scopes) {
    return authResult.scopes.includes(requiredScope) ||
           authResult.scopes.includes('admin:all') ||
           authResult.scopes.includes('*')
  }

  return false
}
```

### Scope Validation

```typescript
// core/lib/api/keys.ts
export class ApiKeyManager {
  static validateScopes(scopes: string[]): { valid: boolean; invalidScopes: string[] } {
    const validScopes = Object.keys(API_SCOPES)
    const invalidScopes = scopes.filter(scope => !validScopes.includes(scope))

    return {
      valid: invalidScopes.length === 0,
      invalidScopes
    }
  }
}

// Usage:
const validation = ApiKeyManager.validateScopes(['products:read', 'invalid:scope'])
// { valid: false, invalidScopes: ['invalid:scope'] }
```

---

## Generating API Keys

### From Dashboard (UI)

**Steps:**
1. Navigate to **Settings → API Keys**
2. Click **"Create New API Key"**
3. Enter key name (e.g., "Mobile App Integration")
4. Select scopes:
   - ☑️ `products:read`
   - ☑️ `products:write`
   - ☐ `products:delete` (unchecked)
5. Click **"Generate Key"**
6. **Copy key immediately** (only shown once!)
   ```text
   sk_live_abc123def456...
   ```text
7. Store key securely (environment variable, secrets manager)

### Programmatically (Code)

```typescript
// Generate API key
import { ApiKeyManager } from '@/core/lib/api/keys'
import { mutateOne } from '@/core/lib/db'

async function createApiKey(userId: string, name: string, scopes: string[]) {
  // 1. Generate secure key
  const { key, hash, prefix } = await ApiKeyManager.generateApiKey()

  // 2. Validate scopes
  const validation = ApiKeyManager.validateScopes(scopes)
  if (!validation.valid) {
    throw new Error(`Invalid scopes: ${validation.invalidScopes.join(', ')}`)
  }

  // 3. Store in database (hash only, not raw key)
  await mutateOne(
    `INSERT INTO api_keys (user_id, name, key_hash, key_prefix, scopes, active, expires_at)
     VALUES ($1, $2, $3, $4, $5, true, NOW() + INTERVAL '365 days')
     RETURNING id`,
    [userId, name, hash, prefix, scopes]
  )

  // 4. Return key to user (ONLY TIME IT'S SHOWN)
  return { key, prefix }
}

// Usage:
const { key } = await createApiKey(
  'user-id-123',
  'Mobile App Integration',
  ['products:read', 'products:write']
)

console.log('API Key (save this!):', key)
// sk_live_abc123def456...
```

### Key Generation Details

```typescript
// core/lib/api/keys.ts (lines 9-32)
export class ApiKeyManager {
  static async generateApiKey(): Promise<{ key: string; hash: string; prefix: string }> {
    // 1. Determine environment
    const environment = process.env.NODE_ENV === 'production' ? 'live' : 'test'

    // 2. Generate 32 random bytes using Web Crypto API
    const randomBytes = new Uint8Array(32)
    crypto.getRandomValues(randomBytes)
    const randomHex = Array.from(randomBytes, byte =>
      byte.toString(16).padStart(2, '0')
    ).join('')

    // 3. Create prefix (first 8 chars of random + environment)
    const prefix = `sk_${environment}_${randomHex.substring(0, 8)}`

    // 4. Create complete key
    const key = `${prefix}${randomHex.substring(8)}`

    // 5. Hash with SHA-256 for secure storage
    const encoder = new TextEncoder()
    const data = encoder.encode(key)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = new Uint8Array(hashBuffer)
    const hash = Array.from(hashArray, byte =>
      byte.toString(16).padStart(2, '0')
    ).join('')

    return { key, hash, prefix }
  }
}
```

**Security Note:**
- ✅ **Raw key** returned ONCE at generation
- ✅ **Only hash** stored in database
- ✅ **Cannot recover** original key if lost

---

## Using API Keys

### cURL Examples

```bash
# Using Authorization header (recommended)
curl https://api.example.com/api/v1/products \
  -H "Authorization: Bearer sk_live_abc123def456..."

# Using X-API-Key header (alternative)
curl https://api.example.com/api/v1/products \
  -H "X-API-Key: sk_live_abc123def456..."
```

### JavaScript/TypeScript (fetch)

```typescript
const API_KEY = process.env.API_KEY

async function fetchProducts() {
  const response = await fetch('https://api.example.com/api/v1/products', {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid API key')
    }
    if (response.status === 403) {
      throw new Error('Insufficient permissions')
    }
    throw new Error(`API error: ${response.status}`)
  }

  const result = await response.json()
  return result.data
}
```

### Python (requests)

```python
import os
import requests

API_KEY = os.getenv('API_KEY')
BASE_URL = 'https://api.example.com/api/v1'

headers = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json'
}

# List products
response = requests.get(f'{BASE_URL}/products', headers=headers)

if response.status_code == 401:
    raise Exception('Invalid API key')
elif response.status_code == 403:
    raise Exception('Insufficient permissions')
elif not response.ok:
    raise Exception(f'API error: {response.status_code}')

products = response.json()['data']
```

### Node.js (axios)

```typescript
import axios from 'axios'

const apiClient = axios.create({
  baseURL: 'https://api.example.com/api/v1',
  headers: {
    'Authorization': `Bearer ${process.env.API_KEY}`,
    'Content-Type': 'application/json'
  }
})

// Interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('Invalid API key')
    } else if (error.response?.status === 403) {
      console.error('Insufficient permissions')
    }
    return Promise.reject(error)
  }
)

// Usage
const { data } = await apiClient.get('/products')
console.log(data.data) // Product list
```

---

## Using Sessions

### Browser (Automatic)

```typescript
// React component using TanStack Query
import { useQuery } from '@tanstack/react-query'

function ProductList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      // Session cookie sent automatically
      const response = await fetch('/api/v1/products', {
        credentials: 'include' // Important: include cookies
      })

      if (!response.ok) {
        throw new Error('Failed to fetch products')
      }

      const result = await response.json()
      return result.data
    }
  })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      {data?.map(product => (
        <ProductCard key={product.id} {...product} />
      ))}
    </div>
  )
}
```

### Next.js Server Component

```typescript
// app/dashboard/products/page.tsx
import { auth } from '@/core/lib/auth'
import { headers } from 'next/headers'

export default async function ProductsPage() {
  // Get session on server
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user) {
    redirect('/login')
  }

  // Fetch using internal API (session automatically available)
  const response = await fetch('http://localhost:3000/api/v1/products', {
    headers: {
      cookie: (await headers()).get('cookie') || ''
    }
  })

  const result = await response.json()

  return (
    <div>
      <h1>Products (User: {session.user.email})</h1>
      <ProductList products={result.data} />
    </div>
  )
}
```

### Server Actions

```typescript
'use server'

import { auth } from '@/core/lib/auth'
import { headers } from 'next/headers'

export async function createProduct(formData: FormData) {
  // Session automatically available in server actions
  const response = await fetch('http://localhost:3000/api/v1/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: (await headers()).get('cookie') || ''
    },
    body: JSON.stringify({
      name: formData.get('name'),
      price: parseFloat(formData.get('price') as string)
    })
  })

  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error)
  }

  return result.data
}
```

---

## Permission Validation

### Basic Permission Check

```typescript
// app/api/v1/products/route.ts
import { authenticateRequest, hasRequiredScope, createAuthError } from '@/core/lib/api/auth/dual-auth'

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request)

  if (!authResult.success) {
    return createAuthError('Authentication required', 401)
  }

  // Check read permission
  if (!hasRequiredScope(authResult, 'products:read')) {
    return createAuthError('Missing required scope: products:read', 403)
  }

  // Process request...
}
```

### Multiple Scope Check

```typescript
function hasAnyScope(authResult: DualAuthResult, scopes: string[]): boolean {
  return scopes.some(scope => hasRequiredScope(authResult, scope))
}

function hasAllScopes(authResult: DualAuthResult, scopes: string[]): boolean {
  return scopes.every(scope => hasRequiredScope(authResult, scope))
}

// Usage:
if (!hasAnyScope(authResult, ['products:read', 'admin:all'])) {
  return createAuthError('Insufficient permissions', 403)
}

if (!hasAllScopes(authResult, ['products:read', 'products:write'])) {
  return createAuthError('Need both read and write permissions', 403)
}
```

### Role-Based Checks

```typescript
function isAdmin(authResult: DualAuthResult): boolean {
  return authResult.user?.role === 'admin' ||
         hasRequiredScope(authResult, '*')
}

function isSuperAdmin(authResult: DualAuthResult): boolean {
  return hasRequiredScope(authResult, '*')
}

// Usage:
if (!isAdmin(authResult)) {
  return createAuthError('Admin access required', 403)
}
```

---

## Security Best Practices

### 1. API Key Storage

**✅ DO:**
```typescript
// Store in environment variables
const API_KEY = process.env.API_KEY

// Use secrets management (AWS Secrets Manager, Vault)
const API_KEY = await getSecretValue('app/api-key')

// Encrypt in database
const encryptedKey = encrypt(API_KEY, ENCRYPTION_KEY)
```

**❌ DON'T:**
```typescript
// Hardcode in source code
const API_KEY = 'sk_live_abc123...'  // ❌ Never!

// Commit to git
git add .env  // ❌ Never!

// Store in client-side code
const apiKey = 'sk_live_...'  // ❌ Exposed to users!

// Log in plain text
console.log('API Key:', apiKey)  // ❌ Sensitive data!
```

### 2. HTTPS Only

```typescript
// Always use HTTPS in production
if (process.env.NODE_ENV === 'production' && !request.url.startsWith('https')) {
  return createAuthError('HTTPS required', 403)
}
```

### 3. Key Rotation

```typescript
// Rotate keys periodically (every 90-365 days)
const KEY_EXPIRATION_DAYS = 365

async function rotateApiKey(oldKeyId: string) {
  // 1. Generate new key
  const { key, hash, prefix } = await ApiKeyManager.generateApiKey()

  // 2. Get old key's scopes
  const oldKey = await getApiKey(oldKeyId)

  // 3. Create new key with same scopes
  const newKeyId = await createApiKey(oldKey.userId, oldKey.name, oldKey.scopes)

  // 4. Return new key
  return { key, newKeyId, oldKeyId }
}

// Grace period: Keep old key active for 7 days
// Then delete old key
```

### 4. Scope Principle of Least Privilege

```typescript
// ✅ Good - Minimal scopes needed
const scopes = ['products:read']  // Only read access

// ❌ Bad - Excessive permissions
const scopes = ['*']  // Full access when only read needed
```

### 5. Audit Logging

```typescript
// Log all API key usage
async function logApiKeyUsage(authResult: DualAuthResult, endpoint: string) {
  await insertAuditLog({
    userId: authResult.user?.id,
    authType: authResult.type,
    endpoint,
    timestamp: new Date(),
    ipAddress: request.headers.get('x-forwarded-for')
  })
}
```

### 6. Rate Limiting

```typescript
// See Rate Limiting section below
// Protect against brute force and abuse
```

---

## Rate Limiting

### Default Limits

```typescript
// core/lib/api/keys.ts
export const RATE_LIMITS = {
  default: { requests: 1000, windowMs: 60000 },       // 1000 req/min
  'users:write': { requests: 100, windowMs: 60000 },  // 100 req/min
  'users:delete': { requests: 10, windowMs: 60000 },  // 10 req/min
  'tasks:write': { requests: 500, windowMs: 60000 },  // 500 req/min
  '*': { requests: 5000, windowMs: 60000 }            // 5000 req/min
}
```

### Rate Limit Headers

```bash
# API responses include rate limit headers
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642435200
```

### 429 Response

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

### Handling Rate Limits

```typescript
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options)

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60')
      console.log(`Rate limited. Retrying after ${retryAfter}s...`)
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
      continue
    }

    return response
  }

  throw new Error('Max retries exceeded')
}
```

---

## Troubleshooting

### Issue 1: "Authentication required" (401)

**Symptoms:**
```json
{
  "success": false,
  "error": "Authentication required",
  "code": "AUTHENTICATION_FAILED"
}
```

**Causes & Solutions:**

**1. Missing Authorization Header**
```bash
# ❌ Wrong
curl https://api.example.com/api/v1/products

# ✅ Correct
curl https://api.example.com/api/v1/products \
  -H "Authorization: Bearer sk_live_abc123..."
```

**2. Invalid API Key Format**
```typescript
// ✅ Correct format
const key = 'sk_live_abc123def456...'  // 72 chars

// ❌ Wrong format
const key = 'abc123'  // Too short
const key = 'pk_live_...'  // Wrong prefix (pk vs sk)
```

**3. Expired or Revoked Key**
```sql
-- Check key status
SELECT active, expires_at FROM api_keys WHERE key_prefix = 'sk_live_abc12345';
```

**4. Session Expired**
```typescript
// Check session
const session = await auth.api.getSession({ headers })
console.log('Session:', session)  // null = expired
```

### Issue 2: "Insufficient permissions" (403)

**Symptoms:**
```json
{
  "success": false,
  "error": "Insufficient permissions",
  "code": "FORBIDDEN"
}
```

**Causes & Solutions:**

**1. Missing Required Scope**
```typescript
// Check key scopes
SELECT scopes FROM api_keys WHERE key_prefix = 'sk_live_abc12345';
// ['products:read']

// Need products:write for POST
// Solution: Create new key with products:write scope
```

**2. Wrong Endpoint for Scopes**
```bash
# ❌ Wrong - Key has 'products:read', trying to write
curl -X POST https://api.example.com/api/v1/products \
  -H "Authorization: Bearer sk_live_abc123..."

# ✅ Correct - Use key with 'products:write'
curl -X POST https://api.example.com/api/v1/products \
  -H "Authorization: Bearer sk_live_xyz789..."  # Has products:write
```

### Issue 3: Session Not Working in API

**Symptoms:** Session auth works in dashboard but not in API calls.

**Solution:**
```typescript
// Include credentials in fetch
fetch('/api/v1/products', {
  credentials: 'include'  // ✅ Important!
})

// Or manually include cookie header
fetch('/api/v1/products', {
  headers: {
    'Cookie': document.cookie
  }
})
```

### Issue 4: CORS Errors

**Symptoms:**
```text
Access to fetch at 'https://api.example.com' from origin 'https://app.example.com'
has been blocked by CORS policy
```

**Solution:** Configure CORS in API route:
```typescript
// app/api/v1/[entity]/route.ts
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key',
      'Access-Control-Allow-Credentials': 'true'
    }
  })
}
```

### Debug Checklist

**API Key Authentication:**
- [ ] API key format is correct (`sk_{env}_{64 hex chars}`)
- [ ] Authorization header present (`Authorization: Bearer sk_...`)
- [ ] Key exists in database
- [ ] Key is active (`active = true`)
- [ ] Key not expired (`expires_at > now()`)
- [ ] Key has required scopes
- [ ] Rate limit not exceeded

**Session Authentication:**
- [ ] User is logged in
- [ ] Session cookie present in request
- [ ] Session not expired
- [ ] `credentials: 'include'` in fetch (browser)
- [ ] Cookie header included (server-to-server)
- [ ] CORS configured if cross-origin

**General:**
- [ ] Using HTTPS in production
- [ ] Correct environment (test vs live keys)
- [ ] No typos in API key or endpoint URL
- [ ] Check server logs for detailed error messages

---

## Summary

**Authentication System provides:**
- ✅ **Dual Authentication** - API Keys + Sessions in single endpoint
- ✅ **Scope-Based Permissions** - Granular access control
- ✅ **Secure by Default** - SHA-256 hashing, HTTPS required
- ✅ **Flexible** - Works for dashboards, mobile apps, integrations
- ✅ **Rate Limited** - Protection against abuse
- ✅ **Type-Safe** - Full TypeScript support

**Best Practices:**
- Store API keys in environment variables
- Use HTTPS only in production
- Apply principle of least privilege (minimal scopes)
- Rotate keys periodically
- Monitor and audit API key usage
- Handle rate limits gracefully

**Next Steps:**
- [Dynamic Endpoints](./03-dynamic-endpoints.md) - Auto-generated CRUD APIs
- [Custom Endpoints](./04-custom-endpoints.md) - Creating custom route handlers
- [Rate Limiting](./07-rate-limiting.md) - Detailed rate limiting configuration
- [Error Handling](./08-error-handling.md) - Comprehensive error codes

**Documentation:** `core/docs/05-api/02-authentication.md`
