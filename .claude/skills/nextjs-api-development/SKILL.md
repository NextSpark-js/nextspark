---
name: nextjs-api-development
description: |
  REST API development with Next.js 15 App Router.
  Dual authentication (API Key + Session), dynamic entities, metadata system.
  Use this skill to create endpoints, validate APIs, or understand API patterns.
allowed-tools: Read, Glob, Grep, Bash(python:*)
version: 1.3.0
---

# Next.js API Development Skill

Patterns and tools for REST API development with Next.js 15 App Router.

## Architecture Overview

```
Core (read-only, @nextsparkjs/core/routes/api/v1/, served at /api/v1/**)
├── [entity]/              # Dynamic CRUD (auto-generated from registry)
│   ├── route.ts          # GET (list) / POST (create)
│   └── [id]/route.ts     # GET (read) / PATCH (update) / DELETE
├── users/                # Core endpoints (not dynamic)
├── api-keys/             # API key management
├── auth/                 # Authentication endpoints
├── billing/              # Billing & subscriptions
└── teams/                # Team management

Project (yours)
├── api/<path>/route.ts             # served at /api/<path>
├── templates/api/v1/<path>/route.ts  # replaces a core handler that exists
└── plugins/<name>/api/<path>/route.ts  # served at /api/plugins/<name>/<path>
```

> **📍 Context-Aware Paths:** Core API routes (`/api/v1/**`) are read-only in consumer projects.
> Create custom endpoints in the project's `api/` (served at `/api/<path>`); a project route under `/api/v1/**` is refused, and a deliberate override of a core handler goes in `templates/api/v1/<path>/route.ts`. `src/app` is generated: never edit it.
> See `core-theme-responsibilities` skill for complete rules.

## When to Use This Skill

- Creating new API endpoints
- Implementing dual authentication
- Adding custom business logic to entities
- Debugging API issues
- Testing API endpoints
- Understanding API patterns

## Core Patterns

### Route Handler Pattern (MANDATORY)

All routes MUST use `withApiLogging` wrapper and `addCorsHeaders`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { queryWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db'
import {
  createApiResponse,
  createApiError,
  createPaginationMeta,
  parsePaginationParams,
  withApiLogging,
  handleCorsPreflightRequest,
  addCorsHeaders,
} from '@nextsparkjs/core/lib/api/helpers'
import { authenticateRequest, createAuthFailureResponse } from '@nextsparkjs/core/lib/api/auth/dual-auth'

// Handle CORS preflight
export async function OPTIONS() {
  return handleCorsPreflightRequest()
}

// GET /api/v1/[endpoint] - List resources
export const GET = withApiLogging(async (req: NextRequest): Promise<NextResponse> => {
  try {
    // 1. Authenticate (API Key OR Session). Declare the scope this route
    // needs — e.g. '<entity>:read' — an API key without it is rejected
    // here (fails closed, #93). See the `better-auth` skill for the full
    // scope-enforcement contract.
    const authResult = await authenticateRequest(req, { requiredScope: '<entity>:read' })

    if (!authResult.success) {
      return createAuthFailureResponse(authResult)
    }

    if (authResult.rateLimitResponse) {
      return authResult.rateLimitResponse as NextResponse
    }

    // 2. Parse pagination
    const { page, limit, offset } = parsePaginationParams(req)

    // 3. Fetch data with RLS
    const data = await queryWithRLS(
      `SELECT * FROM "table" WHERE 1=1 ORDER BY "createdAt" DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
      authResult.user!.id
    )

    // 4. Create response with pagination
    const paginationMeta = createPaginationMeta(page, limit, total)
    const response = createApiResponse(data, paginationMeta)
    return addCorsHeaders(response)
  } catch (error) {
    console.error('[ENDPOINT] Error:', error)
    const response = createApiError('Failed to fetch data', 500)
    return addCorsHeaders(response)
  }
})
```

> **Three credentials, not two.** `/api/v1/**` accepts a session or an API key over HTTP. The third credential,
> the OAuth access token of MCP browser sign-in, is accepted by `/api/mcp` only. The MCP server then calls the
> generic entity handlers in process with the verified principal attached to the request, and
> `authenticateRequest` returns it as `type: 'api-key'` with `oauth: { clientId, tokenId }`: the same
> `requiredScope` rule applies, and there is no `api_key` row behind it. See the `mcp-server` skill.

### Response Helpers (MANDATORY)

```typescript
import { createApiResponse, createApiError } from '@nextsparkjs/core/lib/api/helpers'

// Success responses - always wrap with addCorsHeaders
const response = createApiResponse(data)
return addCorsHeaders(response)

const response = createApiResponse(data, { created: true }, 201)
return addCorsHeaders(response)

const response = createApiResponse(data, paginationMeta)
return addCorsHeaders(response)

// Error responses - always wrap with addCorsHeaders
const response = createApiError('Not found', 404)
return addCorsHeaders(response)

const response = createApiError('Validation error', 400, zodError.issues, 'VALIDATION_ERROR')
return addCorsHeaders(response)
```

### Response Format

```typescript
// Success
{
  "success": true,
  "data": { /* entity data */ },
  "info": {
    "timestamp": "2024-01-17T10:30:00Z",
    "pagination": { /* if applicable */ }
  }
}

// Error
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { /* optional */ },
  "info": {
    "timestamp": "2024-01-17T10:30:00Z"
  }
}
```

## Route Types

### 1. Dynamic Entity Routes

For standard CRUD operations. Automatically generated from EntityRegistry.

```
GET  /api/v1/products     → List products
POST /api/v1/products     → Create product
GET  /api/v1/products/123 → Read product
PATCH /api/v1/products/123 → Update product
DELETE /api/v1/products/123 → Delete product
```

**When to use:** Standard CRUD, basic validation, standard pagination.

### 2. Custom Routes

For special business logic beyond CRUD, add an endpoint in `api/<path>/route.ts` (served at `/api/<path>`). `/api/v1/**` is core's: a deliberate override of a core handler that exists goes in `templates/api/v1/<path>/route.ts`, but an entity has no per-entity handler to override.

```typescript
// api/tasks-admin/route.ts
export const POST = withApiLogging(async (req: NextRequest): Promise<NextResponse> => {
  const authResult = await authenticateRequest(req, { requiredScope: 'tasks:write' })
  if (!authResult.success) {
    return createAuthFailureResponse(authResult)
  }

  // Custom logic: Admin can create for other users
  if (authResult.user?.role === 'admin' && body.userId) {
    task.userId = body.userId
  } else {
    task.userId = authResult.user!.id
  }

  // ... rest of implementation
  const response = createApiResponse(data, { created: true }, 201)
  return addCorsHeaders(response)
})
```

**When to use:** Complex validation, admin-level operations, external integrations.

### 3. Core Endpoints

System endpoints that cannot be overridden.

- `/api/v1/users` - User management
- `/api/v1/api-keys` - API key management
- `/api/v1/auth` - Authentication

### 4. Session-Only Internal Routes

A route that backs one of the app's own screens and must never be driven by an API key or by an MCP
connection does not use `authenticateRequest`. It reads the browser session and nothing else:

```typescript
// packages/core/src/routes/api/internal/oauth-connections/route.ts (shape)
import { createApiError, readJsonObject } from '@nextsparkjs/core/lib/api/error-response'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'
import { getAuthorizationSession } from '@nextsparkjs/core/lib/auth/authorization-session'
import { isMcpOAuthEnabled } from '@nextsparkjs/core/lib/mcp/oauth/config'

export const GET = withRateLimitTier(async (request: NextRequest) => {
  if (!isMcpOAuthEnabled()) return createApiError('Not found', 404, undefined, 'NOT_FOUND')
  const session = await getAuthorizationSession(request.headers)
  if (!session) return createApiError('Authentication required', 401, undefined, 'AUTHENTICATION_FAILED')
  // ... session.user.id, session.user.role, session.session.id
}, 'read')

export const OPTIONS = corsPreflight
```

- `/api/internal/oauth-team` (GET, POST) and `/api/internal/oauth-connections` (GET, PATCH, DELETE) are the two
  such routes of MCP browser sign-in; `/api/superadmin/**` follows the same rule.
- There is no scope to declare: no scoped credential is accepted. The subject of every statement is the
  session's user; another user's row is touched only after a permission check done where the write happens
  (`disconnectManaged`).
- Answer a row the caller may not see as the one that is not there (404), not 403.

### 5. Routes That Exist Only When a Feature Is On

A core route that belongs to an opt-in feature is generated into the host only when the project turns the
feature on. For MCP browser sign-in (`features: { mcpOAuth: true }` in `nextspark.config.ts`):

1. **`packages/core/src/routes/manifest.json`** lists the route (`kind`, `target`, `specifier`), like every
   core route.
2. **`OPT_IN_CORE_ROUTES`** in `packages/core/scripts/build/registry/host/features.mjs` holds the patterns of
   the feature's targets: `nextspark prepare` leaves them out unless the flag is exactly `true`
   (`omittingFeature`). The opposite list, `OMITTED_CORE_ROUTES`, leaves routes out when a flag is `false`
   (`billing`, `superadmin`). A new route of an opt-in feature must match a pattern there, or it ships to
   every project.
3. **The handler still answers 404 while the feature is off at runtime** (`MCP_OAUTH_ENABLED=false`, or MCP
   itself off): first line, before reading the session, `if (!isMcpOAuthEnabled()) return notFound()`. Pages
   of the feature are rewritten to a 404 in `packages/core/src/proxy/index.ts` (a `notFound()` in the page
   arrives after the layout began streaming a 200).

A host built without the feature has none of these routes, so a project's own routes at those paths are its own.

## Input Validation

```typescript
import * as z from 'zod'

const CreateProductSchema = z.object({
  title: z.string().min(1).max(255),
  price: z.number().positive(),
  status: z.enum(['active', 'inactive']).default('active'),
})

export const POST = withApiLogging(async (req: NextRequest): Promise<NextResponse> => {
  try {
    const body = CreateProductSchema.parse(await req.json())
    // Validated body ready to use
  } catch (error) {
    if (error instanceof z.ZodError) {
      const response = createApiError('Validation error', 400, error.issues, 'VALIDATION_ERROR')
      return addCorsHeaders(response)
    }
    throw error
  }
})
```

## Scripts

### Scaffold New Endpoint
```bash
# Basic endpoint
python .claude/skills/nextjs-api-development/scripts/scaffold-endpoint.py \
  --name products \
  --methods GET,POST \
  --auth required

# With [id] route for single resource operations
python .claude/skills/nextjs-api-development/scripts/scaffold-endpoint.py \
  --name products \
  --methods GET,POST \
  --auth required \
  --with-id

# Preview without creating files
python .claude/skills/nextjs-api-development/scripts/scaffold-endpoint.py \
  --name products \
  --dry-run
```

### Generate CRUD Tests
```bash
# Generate test file only
python .claude/skills/nextjs-api-development/scripts/generate-crud-tests.py \
  --entity products

# Also generate API Controller
python .claude/skills/nextjs-api-development/scripts/generate-crud-tests.py \
  --entity products \
  --with-controller

# Preview
python .claude/skills/nextjs-api-development/scripts/generate-crud-tests.py \
  --entity products \
  --dry-run
```

### Validate API Structure
```bash
python .claude/skills/nextjs-api-development/scripts/validate-api.py \
  --path api/

# Strict mode (exit with error if violations found)
python .claude/skills/nextjs-api-development/scripts/validate-api.py \
  --path api/ \
  --strict
```

## Testing Pattern

Tests use API Controllers that extend `BaseAPIController`:

```typescript
// In test file
const ProductsAPIController = require('../../../src/controllers/ProductsAPIController.js')

describe('Products API - CRUD Operations', {
  tags: ['@api', '@feat-products', '@crud', '@regression']
}, () => {
  let productsAPI: any

  const SUPERADMIN_API_KEY = Cypress.env('SUPERADMIN_API_KEY')
  const TEAM_ID = Cypress.env('TEAM_ID')

  before(() => {
    productsAPI = new ProductsAPIController(BASE_URL, SUPERADMIN_API_KEY, TEAM_ID)
  })

  it('should list products', () => {
    productsAPI.getProducts().then((response: any) => {
      productsAPI.validateSuccessResponse(response, 200)
      expect(response.body.data).to.be.an('array')
    })
  })
})
```

## Security Best Practices

### SQL Injection Prevention

> **RLS routing (beta.167):** `queryWithRLS(..., userId)` runs on the app pool (RLS evaluated).
> The bare `query()`/`queryOne()` family routes to the **service pool (bypass)** — never use it
> for a user-scoped read. See the **rls-enforcement** skill for the service-pool model and the
> LIST/READ fail-closed enforcement now applied in the generic handler.

```typescript
// ✅ CORRECT - Parameterized queries with queryWithRLS
const result = await queryWithRLS(
  `SELECT * FROM products WHERE "userId" = $1 AND status = $2 LIMIT $3`,
  [userId, status, limit],
  authResult.user!.id
)

// ❌ NEVER - String concatenation
const query = `SELECT * FROM products WHERE userId = '${userId}'`
```

## Anti-Patterns

```typescript
// ❌ NEVER: Use export async function instead of withApiLogging
export async function GET(request: NextRequest) { }

// ❌ NEVER: Return response without addCorsHeaders
return createApiResponse(data)

// ❌ NEVER: Use raw NextResponse.json
return NextResponse.json({ data })

// ❌ NEVER: Skip authentication
export async function GET(request: NextRequest) {
  const data = await db.query('SELECT * FROM products')
  return createApiResponse(data)
}

// ✅ CORRECT: Full pattern
export const GET = withApiLogging(async (req: NextRequest): Promise<NextResponse> => {
  const authResult = await authenticateRequest(req, { requiredScope: 'products:read' })
  // ...
  const response = createApiResponse(data)
  return addCorsHeaders(response)
})
```

## Checklist for New Endpoint

- [ ] Uses `withApiLogging` wrapper
- [ ] Has `OPTIONS` handler using `handleCorsPreflightRequest()`
- [ ] All responses wrapped with `addCorsHeaders()`
- [ ] Dual authentication implemented (or, for a route behind one of the app's own screens: session only, with `getAuthorizationSession`)
- [ ] A route of an opt-in feature is in `manifest.json`, matches `OPT_IN_CORE_ROUTES`, and answers 404 while the feature is off
- [ ] `authenticateRequest` call declares `{ requiredScope }` (or `{ allowAnyScope: true }` with a comment) — undeclared routes reject API keys with 403 `SCOPE_NOT_DECLARED` (#93)
- [ ] Input validation with Zod schema
- [ ] Response helpers used (`createApiResponse`, `createApiError`)
- [ ] Proper error handling with try/catch
- [ ] Pagination for list endpoints using `parsePaginationParams`
- [ ] API scopes added to `core/lib/api/keys.ts`
- [ ] Cypress tests created with API Controller pattern
