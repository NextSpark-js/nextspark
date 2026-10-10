---
name: rate-limiting
description: |
  Rate limiting patterns for all API endpoints in this Next.js application.
  Covers distributed rate limiting with Redis, tier selection, HOC patterns, and security best practices.
  Use this skill when creating new API endpoints or reviewing rate limiting implementation.
allowed-tools: Read, Glob, Grep
version: 1.0.0
---

# Rate Limiting Skill

Rate limiting patterns and best practices for protecting API endpoints from abuse and DDoS attacks.

## Architecture Overview

```
core/lib/
├── api/
│   └── rate-limit.ts          # withRateLimitTier HOC, checkDistributedRateLimit
└── rate-limit-redis.ts        # Redis/Upstash distributed rate limiting

packages/core/src/routes/api/  # All template routes use rate limiting
plugins/*/api/                    # Plugin API routes
api/                              # Project API routes
```

## When to Use This Skill

- **ALWAYS** when creating new API endpoints
- Reviewing existing endpoints for rate limiting coverage
- Debugging rate limit responses (429 errors)
- Configuring Redis for distributed rate limiting
- Choosing appropriate rate limit tiers

## MANDATORY RULE: All Endpoints Must Have Rate Limiting

**CRITICAL:** Every core `route.ts` file (`packages/core/src/routes/api/**`) that exports HTTP handlers
(GET, POST, PUT, PATCH, DELETE) MUST use the `withRateLimitTier` HOC wrapper.

**Project and plugin routes are limited by default (#226).** `nextspark prepare` wraps every method of a
Route Handler under a project's `api/` or a plugin's `api/` in the generated facade
(`packages/core/scripts/build/registry/host/rate-limit.mjs`, wrappers in
`packages/core/src/routes/_internal/route-rate-limit.ts`):

```typescript
// src/app/api/intake/route.ts (generated)
import { GET as NextSparkGET, POST as NextSparkPOST } from "@/api/intake/route"
import { withReadRateLimit, withWriteRateLimit } from "@nextsparkjs/core/routes/_internal/route-rate-limit"
export const GET = withReadRateLimit(NextSparkGET)    // GET, HEAD: 'read'
export const POST = withWriteRateLimit(NextSparkPOST) // POST, PUT, PATCH, DELETE: 'write'; OPTIONS never
```

- The default is the per-address limit only (`withAddressRateLimit`): no CORS, no origin check.
- A method declared as core's `withRateLimitTier(...)` (imported from `@nextsparkjs/core/lib/api/rate-limit` or
  `@nextsparkjs/core/lib/api`; directly, in the wrapper chain around the handler, or through one constant) is
  left alone: that is how a route chooses another tier (`export const POST = withRateLimitTier(handler, 'strict')`).
  `withRateLimit` does NOT count: it only limits API-key requests. A call inside a function body is not seen
  (double count): declare the method as the call.
- `prepare` prints the opted-out routes as `Info: [NS_HOST_RATE_LIMIT_OPT_OUT]`. Opt out `dynamic = 'force-static'` routes.
- `export const rateLimit = false` opts the whole route out (webhooks with their own limits). Only the
  literal `false`; anything else is `NS_HOST_INVALID_RATE_LIMIT`.
- `DISABLE_RATE_LIMITING=true` turns it off with the rest.

So in a project or plugin route, do not add `withRateLimitTier` just to get `read`/`write`: the default
does it. Add it to choose another tier or to get core's CORS and origin check.

**Only exceptions (core routes):**
- `/api/auth/**` - Better Auth handles its own rate limiting
- `/api/cron/**` - Protected by Vercel cron signatures
- `/api/webhooks/**` - Protected by webhook signatures

## Rate Limit Tiers

| Tier | Limit | Window | Use Case |
|------|-------|--------|----------|
| `auth` | 5 | 15 min | Authentication endpoints (login, register, reset password) |
| `read` | 200 | 1 min | GET requests, read-only operations |
| `write` | 50 | 1 min | POST, PUT, PATCH, DELETE operations |
| `api` | 100 | 1 min | General API (default tier) |
| `strict` | 10 | 1 hr | Sensitive operations (bulk delete, admin actions) |

## How to Apply Rate Limiting

### Basic Usage

```typescript
// route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit';

// For GET (read operations)
export const GET = withRateLimitTier(async (request: NextRequest) => {
  // Your handler logic
  return NextResponse.json({ data: [] });
}, 'read');

// For POST (write operations)
export const POST = withRateLimitTier(async (request: NextRequest) => {
  // Your handler logic
  return NextResponse.json({ created: true }, { status: 201 });
}, 'write');

// For PUT/PATCH (update operations)
export const PUT = withRateLimitTier(async (request: NextRequest) => {
  // Your handler logic
  return NextResponse.json({ updated: true });
}, 'write');

// For DELETE
export const DELETE = withRateLimitTier(async (request: NextRequest) => {
  // Your handler logic
  return NextResponse.json({ deleted: true });
}, 'write');
```

### With Dynamic Routes

```typescript
// [id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit';

// Handler receives route params as second argument
export const GET = withRateLimitTier(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  return NextResponse.json({ id });
}, 'read');
```

### For Sensitive Operations

```typescript
// Use 'strict' tier for operations like bulk delete, admin actions
export const DELETE = withRateLimitTier(async (request: NextRequest) => {
  // Bulk delete or sensitive operation
  return NextResponse.json({ deleted: true });
}, 'strict');
```

## Tier Selection Guidelines

### Use 'read' tier for:
- All GET requests
- Search endpoints
- List/pagination endpoints
- Public data endpoints
- Status/health check endpoints

### Use 'write' tier for:
- POST (create) operations
- PUT/PATCH (update) operations
- DELETE (remove) operations
- Form submissions
- File uploads

### Use 'strict' tier for:
- Bulk operations (delete all, import, export)
- Admin-only operations
- Superadmin endpoints
- Operations with significant server load
- AI/LLM endpoints with high compute cost

### Use 'auth' tier for:
- Login attempts
- Registration
- Password reset requests
- Email verification resends
- Any authentication-related endpoint

### Use 'api' tier for:
- General-purpose API endpoints
- When unsure (default fallback)
- Mixed read/write operations

## Response Headers

All rate-limited responses include these headers:

```
X-RateLimit-Limit: 200        # Max requests in window
X-RateLimit-Remaining: 150    # Requests remaining
X-RateLimit-Reset: 1705432100 # Unix timestamp when window resets
```

When limit is exceeded (429 response):

```
Retry-After: 45              # Seconds until retry allowed
```

## 429 Response Format

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "meta": {
    "limit": 200,
    "remaining": 0,
    "resetTime": "2024-01-16T12:00:00.000Z",
    "retryAfter": 45
  }
}
```

## Rate Limiting Strategy

The system uses a **per-tier global limit** strategy (NOT per-endpoint):

```
User makes requests:
  GET /api/v1/products      → counts against 'read' tier
  GET /api/v1/orders        → counts against 'read' tier
  GET /api/v1/customers     → counts against 'read' tier

All 3 requests count toward the SAME 200/min 'read' limit
```

**Why global per-tier?**
- Prevents attackers from hitting multiple endpoints to bypass limits
- Simpler mental model for users
- More effective DDoS protection

## Identifier Strategy

`withRateLimitTier` tracks every request by client address: `{tier}:ip:{clientIp}`. The address comes from
`getClientIp(headers)` (`@nextsparkjs/core/lib/api/client-ip`), which reads the source `NEXTSPARK_CLIENT_IP_SOURCE` names
(see `docs/14-deployment/10-client-address.md`). Never read `x-forwarded-for` or similar headers yourself: use the helper.

It runs before the route authenticates anything, so no credential header (`x-api-key` included) picks the bucket.
A request authenticated with an API key (`authenticateRequest`, `validateAndAuthenticateRequest`, `validateAndAuthenticateApiRequest`)
is also limited per key (`apiKeyRateLimitResponse`, counted once per request), on top of the per-address limit. With
`authenticateRequest`, a key over its limit comes back as `success: false` with `rateLimitResponse` (429); `createAuthFailureResponse`
returns it. The per-key limit is a safety cap and stays on with `DISABLE_RATE_LIMITING=true`, which only turns off the
per-address limit and Better Auth's own limiter. On that 429 the wrapper keeps the handler's own `X-RateLimit-*` headers.

`withRateLimitTier` also adds core's CORS to every response it returns (route, 429, origin-check 403), except in the `webhook`
tier. Export `OPTIONS = corsPreflight` (`@nextsparkjs/core/lib/api/cors-response`) from every wrapped route so its preflight matches.

## Redis Configuration (Production)

For distributed rate limiting across multiple instances, configure Redis:

```env
# Upstash Redis (recommended for Vercel)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Or standard Redis
REDIS_URL=redis://localhost:6379
```

Without Redis, the system falls back to in-memory rate limiting (single-instance only).

## Disabling Rate Limiting (Development/Testing)

To disable rate limiting completely (useful for development, testing, or debugging):

```env
# .env.local or .env
DISABLE_RATE_LIMITING=true
```

When disabled:
- The per-address checks (`withRateLimitTier`, `checkDistributedRateLimit`) are bypassed
- Better Auth's own limiter is off too (`rateLimit.enabled: false` in `lib/auth.ts`): sign-in, sign-up and the
  email OTP rules (3 per minute per address) no longer answer 429
- The per-API-key limit (`checkRateLimit` by key id) stays on: it is a per-key cap, not per address
- A warning is logged once: `[RateLimit] WARNING: Rate limiting is DISABLED...`
- Handlers execute without rate limit headers

Any value other than `true` leaves everything on, Better Auth included (its default: on when `NODE_ENV=production`).

**WARNING:** Never disable rate limiting in production environments! Only for QA/preview deploys and tests.

**Use cases for disabling:**
- Local development when hitting limits during testing
- Running automated tests that make many requests
- Debugging API behavior without rate limit interference
- Load testing (measure true capacity without limits)

## Anti-Patterns

```typescript
// NEVER (core routes): Skip rate limiting on public endpoints
// (a project or plugin route under api/ gets the default limit from the generated host)
export const GET = async (request: NextRequest) => {
  // Missing withRateLimitTier - VULNERABLE TO DDOS!
  return NextResponse.json({ data: [] });
};

// NEVER: Use wrong tier (read tier for write operations)
export const POST = withRateLimitTier(async (request: NextRequest) => {
  await createEntity(data);  // Write operation
  return NextResponse.json({ created: true });
}, 'read');  // WRONG! Should be 'write'

// NEVER: Hardcode rate limits in handlers
export const GET = async (request: NextRequest) => {
  const ip = request.headers.get('x-forwarded-for');
  if (requestCount[ip] > 100) {  // Custom implementation - DON'T
    return NextResponse.json({ error: 'Too many' }, { status: 429 });
  }
  // ...
};

// CORRECT: Always use the HOC
export const GET = withRateLimitTier(async (request: NextRequest) => {
  return NextResponse.json({ data: [] });
}, 'read');
```

## Checklist for New Endpoints

Before finalizing any API endpoint:

- [ ] Core route: handler is wrapped with `withRateLimitTier`
- [ ] Project/plugin route: the default `read`/`write` fits, or the method wraps itself with another tier,
      or the route exports `rateLimit = false` for a documented reason (webhook)
- [ ] Appropriate tier selected based on operation type
- [ ] GET operations use 'read' tier
- [ ] POST/PUT/PATCH/DELETE use 'write' tier
- [ ] Sensitive operations use 'strict' tier
- [ ] Auth operations use 'auth' tier
- [ ] Import statement added: `import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'`

## Verification Commands

```bash
# Check if a route has rate limiting
grep -l "withRateLimitTier" packages/core/src/routes/api/**/route.ts

# Find routes WITHOUT rate limiting (potential vulnerabilities)
grep -L "withRateLimitTier" packages/core/src/routes/api/**/route.ts

# Count rate-limited vs unprotected routes
echo "Protected:"; grep -l "withRateLimitTier" packages/core/src/routes/api/**/route.ts | wc -l
echo "Unprotected:"; grep -L "withRateLimitTier" packages/core/src/routes/api/**/route.ts | wc -l
```

## Testing Rate Limits

```typescript
// Cypress test example
describe('Rate Limiting', () => {
  it('should return 429 after exceeding limit', () => {
    // Make requests up to the limit
    for (let i = 0; i < 210; i++) {
      cy.request({
        method: 'GET',
        url: '/api/v1/products',
        headers: { 'x-api-key': Cypress.env('API_KEY') },
        failOnStatusCode: false
      });
    }

    // Next request should be rate limited
    cy.request({
      method: 'GET',
      url: '/api/v1/products',
      headers: { 'x-api-key': Cypress.env('API_KEY') },
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(429);
      expect(response.body.code).to.eq('RATE_LIMIT_EXCEEDED');
      expect(response.headers).to.have.property('retry-after');
    });
  });
});
```

## Related Skills

- `better-auth` - Authentication patterns (auth tier integration)
- `nextjs-api-development` - API route development patterns
- `cypress-api` - API testing with rate limit considerations
