# API Authentication

**API keys • Sessions • OAuth access tokens for MCP • Scope system • Security**

---

## Table of Contents

- [Overview](#overview)
- [Authentication Methods](#authentication-methods)
- [API Key Authentication](#api-key-authentication)
- [Session Authentication](#session-authentication)
- [OAuth Access Token Authentication (`/api/mcp` only)](#oauth-access-token-authentication-apimcp-only)
- [Dual Authentication Flow](#dual-authentication-flow)
- [Scope System](#scope-system)
- [Scope Enforcement Fails Closed](#scope-enforcement-fails-closed)
- [Generating API Keys](#generating-api-keys)
- [Using API Keys](#using-api-keys)
- [Using Sessions](#using-sessions)
- [Permission Validation](#permission-validation)
- [Security Best Practices](#security-best-practices)
- [Rate Limiting](#rate-limiting)
- [Troubleshooting](#troubleshooting)

---

## Overview

The API accepts three credentials. Where each one is accepted matters:

| Credential | Accepted at | Presented as |
|---|---|---|
| **API key** | `/api/v1/*` and `/api/mcp` | `Authorization: Bearer sk_...` or `x-api-key` |
| **Session** | `/api/v1/*` and the app's own routes | The session cookie |
| **OAuth access token** | `/api/mcp` only, and only when the project turns on [MCP browser sign-in](../06-authentication/14-mcp-browser-sign-in.md) | `Authorization: Bearer <JWT>` |

For **`/api/v1`** the description of this document as "dual authentication" is exact: an endpoint takes an API key
or a session, and nothing else. An OAuth access token presented to `/api/v1` is not accepted. It is issued for
`/api/mcp`, verified there once, and from there on travels to the entity handlers as an in-process principal; see
[OAuth Access Token Authentication](#oauth-access-token-authentication-apimcp-only).

**Key Features:**
- ✅ **Dual Authentication on `/api/v1`** - API Keys OR Sessions in single endpoint
- ✅ **Scope-Based Permissions** - Granular access control, the same scopes for API keys and OAuth access tokens
- ✅ **Secure by Default** - SHA-256 hashed keys, HttpOnly cookies
- ✅ **Automatic Fallback** - API key first, then session
- ✅ **Rate Limiting** - Per client address by tier, plus a per-credential limit for API keys and MCP connections
- ✅ **Type-Safe** - Full TypeScript support

**Authentication Sources:**
```typescript
core/lib/api/auth/dual-auth.ts             // authenticateRequest: API key, session, in-process principal
core/lib/api/keys.ts                       // API key management
core/lib/auth.ts                           // Session authentication (Better Auth)
core/lib/mcp/oauth/resource-server.ts      // OAuth access tokens at /api/mcp
core/lib/api/auth/in-process-principal.ts  // How a verified OAuth call reaches the entity handlers
```

---

## Authentication Methods

### Comparison

| Feature | API Keys | Sessions | OAuth access tokens |
|---------|----------|----------|---------------------|
| **Accepted at** | `/api/v1/*`, `/api/mcp` | `/api/v1/*`, the app's own routes | `/api/mcp` only |
| **Use Case** | External integrations, mobile apps, scripts | Dashboard users | An MCP client the user connects from its own interface |
| **Header** | `Authorization: Bearer sk_xxx` | Cookie (automatic) | `Authorization: Bearer <JWT>` |
| **Permissions** | Scope-based | Role-based + Scopes | Scope-based: the consent, cut down to the user's role on every request |
| **Team** | Named per request (`x-team-id`), or the user's default team | The active team of the session | One team, fixed when the application is authorized |
| **Rate Limiting** | The tier of the route per client address, plus the `credential` tier per key | The tier of the route per client address (no per-user counter) | The `api` tier per client address, plus the `credential` tier per connection |
| **Expiration** | None by default; `expiresAt` is optional when the key is created | Session-based | 10 minutes; the client renews it with a rotating refresh token |
| **Revocation** | Revoke key in dashboard | Logout | Disconnect in Settings > Security |
| **Best For** | Server-to-server, third-party | Browser-based apps | AI assistants and other MCP applications |

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

**Use an OAuth access token (MCP browser sign-in) when:**
- ✅ The client is an MCP application such as Claude or ChatGPT
- ✅ The user should approve, per team, what the application may do
- ✅ No long-lived secret should be copied into the client

It is not a general API credential: it works at `/api/mcp` and nowhere else.

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

## OAuth Access Token Authentication (`/api/mcp` only)

With `features: { mcpOAuth: true }` the app is the OAuth 2.1 authorization server of its own MCP endpoint, and
`/api/mcp` accepts the access tokens it issues. This section describes how such a request is authenticated. The
feature itself — turning it on, the consent, teams, connected applications — is documented in
[MCP Browser Sign-in](../06-authentication/14-mcp-browser-sign-in.md).

### Scope of the credential

- The token is a JWT issued for the resource `/api/mcp`. It is valid for 10 minutes.
- It is accepted **at `/api/mcp` only**. `authenticateRequest` does not read it: a route under `/api/v1` that
  receives it finds no API key and no session and answers `401`.
- `/api/mcp` accepts an API key or an access token, never both in one request.

### How the request is authenticated

```text
1. Client sends POST /api/mcp with Authorization: Bearer <JWT>
   ↓
2. The token is verified in process (requireMcpAuth)
   ↓
   signature, issuer, audience (the MCP resource, exactly), expiry
   ↓
3. The principal is resolved from the database, on every request (principalFromClaims)
   ↓
   user is active · team exists and the user is a member · application is accepted
   connection was not revoked · consent exists
   ↓
4. Effective scopes
   ↓
   token scopes ∩ consent scopes, cut down to what the user's role in the team allows now
   ↓
5. Per-credential rate limit (credentialRateLimitResponse)
   ↓
6. Scopes the call needs and the connection lacks → 403 insufficient_scope, before anything runs
   ↓
7. The tool runs: the entity handler is called in process with the principal attached
```

### The in-process principal

An MCP tool runs by calling the real entity handler with a request the server builds. On the API key path that
request carries the caller's `Authorization` header and the handler authenticates it again. On the OAuth path the
request carries **no credential**: the verified principal is attached to the request object
(`attachInProcessPrincipal` in `lib/api/auth/in-process-principal.ts`) and `authenticateRequest` reads it back
before it looks for anything else.

```typescript
// core/lib/api/auth/dual-auth.ts
const injected = inProcessPrincipal(request)
if (injected) {
  // the same scope enforcement as an API key, and the per-credential limit
  // ...
  return injected
}
```

- The principals are kept in a `WeakMap` keyed by the request object. It never leaves the process, so nothing sent
  over HTTP can set or imitate it.
- The access token is never presented to another route.
- The principal is a `DualAuthResult` of **type `'api-key'`** with an extra field:

  ```typescript
  {
    success: true,
    type: 'api-key',
    oauth: { clientId, tokenId },   // set for an OAuth call; absent for a real API key
    user: { id, email, role, name, defaultTeamId },
    scopes: [...],                   // effective scopes, see step 4
  }
  ```

`type` stays `'api-key'` so that every check written for an API key (the declared scope, `access.api`, the rules
for external callers) applies to an OAuth call as it is. It does not mean there is a row in `api_key`: `keyId` is
not set. A route that branches on `type === 'api-key'` treats an OAuth connection as a key; a route that needs to
tell them apart reads `authResult.oauth`. This is a bridge, not the final model.

---

## Dual Authentication Flow

This is the flow of `/api/v1` and of every route that calls `authenticateRequest`.

### Priority Order

The authentication system tries methods in this order:

**0. In-process principal**

A principal the server attached itself, for an MCP tool call made with an OAuth access token (see the previous
section). It is never present on a request that arrived over HTTP.

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
export async function authenticateRequest(
  request: NextRequest,
  options: AuthenticateOptions = {}
): Promise<DualAuthResult> {
  // A principal the server attached itself (an MCP tool call made with an
  // OAuth access token): the same scope enforcement and per-credential limit
  // as an API key, and no other credential on the request is read.
  const injected = inProcessPrincipal(request)
  if (injected) {
    const failure = resolveApiKeyScopeFailure(injected.scopes, options, describeRoute(request))
    if (failure) return { ...injected, success: false, error: failure }
    // ...per-credential rate limit (credentialRateLimitResponse)...
    return injected
  }

  // First try API Key authentication
  const apiKeyResult = await tryApiKeyAuth(request)
  if (apiKeyResult.success) {
    // Fail-closed scope enforcement (#93) — see "Scope Enforcement Fails
    // Closed" below. A key that doesn't hold `options.requiredScope` (or
    // whose route passed neither `requiredScope` nor `allowAnyScope`) is
    // rejected here, before the caller sees it as authenticated.
    const failure = resolveApiKeyScopeFailure(apiKeyResult.scopes, options, describeRoute(request))
    if (failure) {
      return { success: false, type: 'api-key', user: apiKeyResult.user, scopes: apiKeyResult.scopes, keyId: apiKeyResult.keyId, error: failure }
    }
    // ...per-credential rate limit (credentialRateLimitResponse): a key over
    // its limit gets `rateLimitResponse` and the error RATE_LIMIT_EXCEEDED...
    return apiKeyResult
  }

  // Then try Session authentication (never gated by scope)
  const sessionResult = await trySessionAuth(request)
  if (sessionResult.success) {
    return sessionResult
  }

  // Neither credential was usable
  return {
    success: false,
    type: 'none',
    user: null,
    error: authenticationFailed() // 401 AUTHENTICATION_FAILED
  }
}
```

### Using in Endpoints

```typescript
// packages/core/src/routes/api/v1/[entity]/route.ts
import { authenticateRequest, createAuthFailureResponse } from '@nextsparkjs/core/lib/api/auth/dual-auth'

export async function GET(request: NextRequest) {
  // Authenticate (API Key OR Session) and declare the scope this route
  // needs. A key without it is rejected inside authenticateRequest — see
  // "Scope Enforcement Fails Closed" below.
  const authResult = await authenticateRequest(request, { requiredScope: 'products:read' })

  if (!authResult.success) {
    return createAuthFailureResponse(authResult)
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

  // Teams
  'teams:read': 'Read team information and membership',
  'teams:write': 'Create and update teams',
  'teams:delete': 'Delete teams',

  // Billing
  'billing:read': 'Read billing and subscription information',
  'billing:write': 'Manage billing and subscriptions',

  // Administration
  'admin:api-keys': 'Manage API keys',
  'admin:users': 'Full user administration',
  'admin:devtools': 'Access developer tools endpoints',

  // Wildcard (superadmin or developer only)
  '*': 'Full access (superadmin or developer only)'
}
```

A project declares its own scopes under `api.scopes` in `config/app.config.ts`, and a plugin
declares the ones its routes require with `apiScopes` in its `plugin.config.ts` (the `ai`, `langchain`
and `social-media-publisher` plugins add `ai:read`, `ai:write`, `social:read`, `social:write`
this way, so enabling them needs nothing in the project) — see [Scope Enforcement Fails
Closed](#scope-enforcement-fails-closed).

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
  teams: {
    name: 'Teams',
    description: 'Team management',
    scopes: ['teams:read', 'teams:write', 'teams:delete']
  },
  billing: {
    name: 'Billing',
    description: 'Billing and subscriptions',
    scopes: ['billing:read', 'billing:write']
  },
  admin: {
    name: 'Administration',
    description: 'Administrative functions',
    scopes: ['admin:api-keys', 'admin:users', 'admin:devtools']
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
export function hasRequiredScope(authResult: DualAuthResult, requiredScope: string | string[]): boolean {
  // Sessions have full access
  if (authResult.type === 'session') {
    return true
  }

  // API Keys check scopes — an array is satisfied by any one entry
  if (authResult.type === 'api-key') {
    return scopesSatisfy(authResult.scopes, requiredScope)
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

## Scope Enforcement Fails Closed

Every route that authenticates via `authenticateRequest` (or
`validateAndAuthenticateRequest`) must say, up front, which API-key scope it
needs. This is enforced by `authenticateRequest` itself, not left to each
handler to remember (#93):

- **`{ requiredScope: 'products:read' }`** — the key must hold that scope
  (or the wildcard `*`). Pass an array to accept any one of several scopes,
  e.g. `{ requiredScope: ['products:read', 'products:write'] }`.
- **`{ allowAnyScope: true }`** — explicit opt-out for routes that are
  genuinely scope-agnostic (a public route that only *enriches* its response
  for authenticated callers, an MCP transport whose tools enforce scopes
  themselves). Use this only with a one-line comment explaining why.
- **Neither option passed** — the key is rejected with `SCOPE_NOT_DECLARED`
  and the route is named in the server log, so a forgotten declaration shows
  up as a visible 403 on an integration instead of a silently
  over-privileged credential.

**Session authentication is never gated by this rule** — sessions always
carry full access, exactly as before.

**An OAuth access token is gated exactly as an API key is.** Its principal has `type: 'api-key'`, so the scope a
route declares is checked against the connection's effective scopes.

**Failure responses:**

| Situation | `type` | `code` | Status |
|---|---|---|---|
| No credential at all | `'none'` | `AUTHENTICATION_FAILED` | 401 |
| Valid key, missing the declared scope | `'api-key'` | `INSUFFICIENT_SCOPE` | 403 |
| Valid key, route declared no scope | `'api-key'` | `SCOPE_NOT_DECLARED` | 403 |
| Valid key or MCP connection over its per-credential limit | `'api-key'` | `RATE_LIMIT_EXCEEDED` | 429 |

Use `createAuthFailureResponse(authResult)` in the `!authResult.success`
branch — it reads `authResult.error` and returns the right status and code,
so scope rejections are never mislabeled as a generic 401:

```typescript
import { authenticateRequest, createAuthFailureResponse } from '@nextsparkjs/core/lib/api/auth/dual-auth'

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request, { requiredScope: 'products:read' })
  if (!authResult.success) {
    return createAuthFailureResponse(authResult)
  }
  // ...
}
```

`hasRequiredScope(authResult, scope)` still exists for a *second*, finer
check inside a handler (for example, branching between a read-only and a
read-write code path after the entry point already required
`products:read`). It's optional and secondary — don't re-check the exact
scope the route already declared in `requiredScope`, that check is always
true by construction.

New core scopes added for this: `teams:read`, `teams:write`, `teams:delete`,
`billing:read`, `billing:write`, `admin:devtools` (see [Available
Scopes](#scope-system) above). A project can add its own scopes
under `api.scopes` in `config/app.config.ts`, and a plugin with `apiScopes` in its `plugin.config.ts`
(`ai:read`, `ai:write`, `social:read`, `social:write` come from the plugins that use them).

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
import { ApiKeyManager } from '@nextsparkjs/core/lib/api/keys'
import { mutateOne } from '@nextsparkjs/core/lib/db'

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
// templates/dashboard/products/page.tsx
import { auth } from '@nextsparkjs/core/lib/auth'
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

import { auth } from '@nextsparkjs/core/lib/auth'
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

The route declares the scope it needs at the entry point; `authenticateRequest`
enforces it and fails closed, so there's nothing left to re-check by hand
(see [Scope Enforcement Fails Closed](#scope-enforcement-fails-closed)):

```typescript
// api/products/route.ts
import { authenticateRequest, createAuthFailureResponse } from '@nextsparkjs/core/lib/api/auth/dual-auth'

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request, { requiredScope: 'products:read' })

  if (!authResult.success) {
    return createAuthFailureResponse(authResult)
  }

  // Process request...
}
```

### Multiple Scope Check

`hasRequiredScope` is still useful for a *second*, finer check inside a
handler — for example, branching between two code paths that need different
scopes beyond the one already required at the entry point:

```typescript
function hasAnyScope(authResult: DualAuthResult, scopes: string[]): boolean {
  return scopes.some(scope => hasRequiredScope(authResult, scope))
}

function hasAllScopes(authResult: DualAuthResult, scopes: string[]): boolean {
  return scopes.every(scope => hasRequiredScope(authResult, scope))
}

// Usage:
if (!hasAnyScope(authResult, ['products:read', '*'])) {
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
    ipAddress: getRecordedClientIp(request.headers) // @nextsparkjs/core/lib/api/client-ip
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

Authentication does not set the limit of a request by its scopes. Two limits apply, and they are independent:

| Limit | Counted by | Default |
|---|---|---|
| The tier of the route (`withRateLimitTier`) | Client address | `read`: 200 per minute, `write`: 50 per minute on `/api/v1/{entity}`; `api`: 100 per minute on `/api/mcp` |
| The `credential` tier (`credentialRateLimitResponse`) | The API key, or the MCP connection | 1000 charges per minute: one charge for the request and one more for each API handler a tool calls in process |

- A request authenticated with a **session** is limited by the tier of the route only. There is no per-user
  counter.
- A request authenticated with an **API key** or an **OAuth access token** is also counted against that
  credential. `authenticateRequest` does it: a credential over its limit comes back with `success: false`,
  `error.code = 'RATE_LIMIT_EXCEEDED'` and a `rateLimitResponse` ready to return, which
  `createAuthFailureResponse(authResult)` sends.
- The per-credential count is shared between instances only when Redis is configured
  (`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`); otherwise each process counts on its own.

`RATE_LIMITS` in `core/lib/api/keys.ts` (limits by scope) is not what authentication uses. It belongs to the older
`withRateLimit` wrapper, which none of core's routes use.

See [Rate Limiting](./07-rate-limiting.md) for the tiers, the headers and the configuration.

### Rate Limit Headers

```bash
# Responses of a rate-limited route describe its per-address bucket
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 199
X-RateLimit-Reset: 1767225660000   # Unix timestamp in milliseconds
```

### 429 Response

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Too many requests for this credential. Limit: 1000 charges per minute: one per request, and one more for each API call an MCP tool makes",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

A `429` always carries a `Retry-After` header, in seconds.

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

**Symptoms — key doesn't hold the scope the route requires:**
```json
{
  "success": false,
  "error": "API key lacks required scope 'products:write'",
  "code": "INSUFFICIENT_SCOPE"
}
```

**Symptoms — route declared no scope at all (a bug on the server side, not
the caller's):**
```json
{
  "success": false,
  "error": "API key access is not enabled for this route: it declares no required scope",
  "code": "SCOPE_NOT_DECLARED"
}
```
If you see `SCOPE_NOT_DECLARED`, the fix is on the route: add
`{ requiredScope: '<scope>' }` (or `{ allowAnyScope: true }` if the route is
genuinely scope-agnostic) to its `authenticateRequest` call — see [Scope
Enforcement Fails Closed](#scope-enforcement-fails-closed). Check the server
log too; the route is named there.

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

**Solution:** Add the calling origin to the allowed origins: `api.cors.allowedOrigins` (per environment) in the app config, or the
`CORS_ADDITIONAL_ORIGINS` environment variable (comma-separated). Core's API routes answer CORS per request from that list (`addCorsHeaders`),
with credentials for a listed origin and no grant for any other: `withRateLimitTier` adds it to every response of the routes it wraps, and
those routes export `OPTIONS` (`corsPreflight` from `@nextsparkjs/core/lib/api/cors-response`) for the preflight. A route of your own does
the same. Do not set `Access-Control-*` headers in `next.config.mjs`: they apply on top of the route's and replace its per-origin answer.

The admin and developer areas (`/api/superadmin/*`, `/api/devtools/*`, `/api/v1/devtools/*`) answer CORS only to the app's own origin
(`NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL`), never to another listed origin: a front end on another origin cannot call them with
credentials, and a cookie-authenticated write there from another listed origin gets 403 `ORIGIN_NOT_ALLOWED`. This is fixed in core,
with no option. The preflight allows `Content-Type`, `Authorization`, `X-API-Key` and the headers
core's clients send (`x-team-id`, `x-builder-source`, `x-signup-intent`, `x-verify-from-ui`).

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
- ✅ **Dual Authentication** - API Keys + Sessions in single endpoint, on `/api/v1`
- ✅ **OAuth access tokens** - A third credential, at `/api/mcp` only, when MCP browser sign-in is on
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
- [MCP Server](./20-mcp-server.md) - The endpoint that accepts API keys and OAuth access tokens
- [MCP Browser Sign-in](../06-authentication/14-mcp-browser-sign-in.md) - The OAuth 2.1 authorization server

**Documentation:** `core/docs/05-api/02-authentication.md`
