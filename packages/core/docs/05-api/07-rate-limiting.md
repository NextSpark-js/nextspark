# API Rate Limiting

**Tiers per client address • Per-credential limit • Redis or in-process counting • Headers • Configuration**

---

## Table of Contents

- [Overview](#overview)
- [Tiers](#tiers)
- [Per-Address Limits](#per-address-limits)
- [The per-credential limit (the `credential` tier)](#the-per-credential-limit-the-credential-tier)
- [Where the Count Is Kept](#where-the-count-is-kept)
- [Configuration](#configuration)
- [Rate Limit Headers and the 429 Response](#rate-limit-headers-and-the-429-response)
- [Disabling Rate Limiting (QA/Preview and Tests)](#disabling-rate-limiting-qapreview-and-tests)
- [What Core Does Not Do](#what-core-does-not-do)
- [Handling Rate Limits in a Client](#handling-rate-limits-in-a-client)

---

## Overview

Core limits requests in two independent ways, and a request can be counted by both:

| Limit | Counted by | Applied by | Purpose |
|---|---|---|---|
| **Tier, per client address** | The client address and the tier of the route | `withRateLimitTier` around a route, before anything is authenticated | Protects a route from one address, whoever the caller is |
| **Credential** | The API key, or the MCP connection | `credentialRateLimitResponse`, when a request authenticates with one | Caps what one credential can send, whatever addresses it comes from |

There is **no per-user counter for session requests**: a dashboard request is limited by the tier of the route it
calls, per client address, and by nothing else.

The implementation is in `lib/api/rate-limit.ts` (wrappers, the in-process counter, the credential limit) and
`lib/rate-limit-redis.ts` (tiers, the Redis counter).

---

## Tiers

A tier is a limit and a window. These are built in (`DEFAULT_TIERS` in `lib/rate-limit-redis.ts`):

| Tier | Limit | Window | Counted by | Used for |
|------|-------|--------|------------|----------|
| `auth` | 60 | 15 minutes | Client address | The sign-in `POST`s of `/api/auth/*` |
| `authIdentifier` | 5 | 15 minutes | Email | Asking for and verifying codes, password sign-in |
| `api` | 100 | 1 minute | Client address | General API endpoints; the default of `withRateLimitTier` |
| `strict` | 10 | 1 hour | Client address | Sensitive operations |
| `read` | 200 | 1 minute | Client address | Reads (`GET`) |
| `write` | 50 | 1 minute | Client address | Writes (`POST`, `PUT`, `PATCH`, `DELETE`) |
| `webhook` | 500 | 1 hour | Client address | Webhooks (the signature is the primary defence) |
| `ingest` | 1000 | 1 minute | Client address | High-volume ingestion endpoints |
| `credential` | 1000 | 1 minute | API key or MCP connection | What one credential may send |

A project can change the numbers of any tier and declare its own; see [Configuration](#configuration).

---

## Per-Address Limits

### `withRateLimitTier`

```typescript
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

export const GET = withRateLimitTier(async (request) => {
  return NextResponse.json({ data: 'hello' })
}, 'read')

export const POST = withRateLimitTier(postHandler, 'write')
```

- The counter is **per client address and tier, across all routes of that tier**, not per endpoint. Two routes in
  the `read` tier share one budget per address.
- It runs before the handler has authenticated anything, so no credential or identity header picks the bucket. An
  `x-api-key` header does not change how the request is counted here.
- It also refuses a cookie-authenticated write from an untrusted origin, and adds core's CORS headers to every
  response it returns. The `webhook` tier is the exception for CORS: webhooks are called server to server.
- The tier argument defaults to `api`.

### Core's entity routes

`/api/v1/{entity}` and `/api/v1/{entity}/{id}` use `read` for `GET` and `write` for `POST`, `PATCH` and `DELETE`.
There is no per-entity limit: every entity shares those two budgets per address.

### Your Own API Routes (Project and Plugins)

**Every Route Handler a project serves under `api/` (and a plugin under its `api/`) is rate limited by default.**
The generated host wraps each exported method when it writes the route's file in `src/app`, the way the theme and
plugin dispatchers did up to `0.1.0-beta.191`:

| Method | Tier | Limit |
|---|---|---|
| `GET`, `HEAD` | `read` | 200 requests per minute per client address |
| `POST`, `PUT`, `PATCH`, `DELETE` | `write` | 50 requests per minute per client address |
| `OPTIONS` | none | a CORS preflight is never limited |

The counters are per client address and tier, shared with every other route in that tier. A blocked request gets
`429` with `Retry-After` and the `X-RateLimit-*` headers. The default only limits: it adds no CORS headers and no
origin check, so a route keeps what it does about those itself. The 429 of the per-credential limit, which a route returns
when `authenticateRequest` or `validateAndAuthenticate*Request` reports a key over its limit, is the exception: it carries
core's CORS headers for the request, so a browser on another origin reads the 429 instead of a CORS error.

**Choose a tier for a method** by wrapping it yourself with `withRateLimitTier`, imported from
`@nextsparkjs/core/lib/api/rate-limit` (or `@nextsparkjs/core/lib/api`). The host leaves that method alone when its
declaration is that call: directly, inside other wrappers around the handler (`withLogging(withRateLimitTier(h, 'strict'))`),
or through a constant (`const h = withRateLimitTier(...); export const GET = h`). `withRateLimit`, the older per-API-key
wrapper, does not count: it only limits requests that present a key, so the method still gets the default for every caller.

```typescript
// api/intake/route.ts
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

export const POST = withRateLimitTier(postHandler, 'strict') // 10 per hour; GET below still gets 'read'
export async function GET() { /* ... */ }
```

`withRateLimitTier` also refuses a cookie-authenticated write from an untrusted origin and adds core's CORS headers.

**Opt a route out** (a webhook that verifies a signature and has its own limits) with:

```typescript
// api/webhooks/acme/route.ts
export const rateLimit = false
```

It applies to every method of that file, it must be exactly the literal `false` (any other value stops
`nextspark prepare` with `NS_HOST_INVALID_RATE_LIMIT`), and it is only read by the generator, never passed to Next.js.
A method the route re-exports from another module (`export { POST } from './handler'`) is wrapped too: if that module
already limits it, export `rateLimit = false` or wrap it in this file instead. The same goes for a call inside a function
body (`export async function GET(r) { return withRateLimitTier(h, 'read')(r) }`): the host does not look into it, so the
request is counted twice. A route with `dynamic = 'force-static'` is answered from the build, where a limit checks nothing:
opt it out. `nextspark prepare` lists the opted-out routes in one `Info: [NS_HOST_RATE_LIMIT_OPT_OUT]` line. Core's own
routes, and Route Handlers outside `api/`, are not touched.

### Sign-in routes (the `auth` and `authIdentifier` tiers)

Only the `POST`s of `/api/auth/*` that let a caller guess a password or a code, or make the server send an email, are charged.
The list is explicit (`lib/auth/auth-rate-limit.ts`): a route Better Auth adds later is free until it is listed.

| Route (after `/api/auth/`) | `auth` (per address) | `authIdentifier` (per email) |
|---|---|---|
| `email-otp/send-verification-otp`, `email-otp/request-password-reset`, `forget-password/email-otp`, `request-password-reset`, `send-verification-email`, `sign-in/magic-link` | yes | yes, budget "send" |
| `sign-in/email-otp`, `email-otp/check-verification-otp`, `email-otp/verify-email`, `email-otp/reset-password` | yes | yes, budget "verify" |
| `sign-in/email` (password) | yes | yes, budget "password" |
| `sign-up/email`, `reset-password` (token) | yes | no |
| `sign-out`, `get-session`, `update-user`, `callback/<provider>`, `sign-in/social`, and anything not listed | no | no |

The OAuth endpoints of [MCP browser sign-in](../06-authentication/14-mcp-browser-sign-in.md) (`oauth2/authorize`,
`oauth2/token` and the rest) are not on the list, so these two tiers do not charge them.

Defaults, per 15 minutes:

- `auth`: **60 requests per client address**, shared by everyone behind it (an office, a school, a mobile carrier). A sign-in with an emailed code costs 2 (send the code, then verify it).
- `authIdentifier`: **5 requests per email and budget**. The email is read from the JSON body (trimmed and lowercased, from a clone of the request) and hashed, so it is never stored or logged in the clear. The three budgets are independent: asking for codes does not use up the attempts to verify one. The email is also read from urlencoded and multipart forms. A request with a body but no readable email shares one fixed budget per route group (`unknown`), so it is not free; a request with no body is charged per address only.

A `429` answers `{ "error": "Too many requests", "code": "RATE_LIMIT_EXCEEDED", "retryAfter": <seconds> }` with a `Retry-After` header. The sign-in screens show the wait in minutes.

To change it:

- set the numbers for either tier in the `APP_CONFIG_OVERRIDES` of `app.config.ts`: `rateLimit: { tiers: { auth: { limit: 120, windowMs: 15 * 60_000 }, authIdentifier: { limit: 10, windowMs: 15 * 60_000 } } }` (a field you leave out keeps its default). Anyone who knows an email can use up that email's budgets for 15 minutes; that is the cost of limiting by identifier;
- set `NEXTSPARK_CLIENT_IP_SOURCE` so the address read is the real one (`vercel`, `cloudflare`, `xff` with
  `NEXTSPARK_TRUSTED_PROXY_HOPS`, or `header:<name>`). Without it, every person behind a proxy can look like one address.
  On Vercel (`VERCEL=1`) an unset variable means `vercel`; elsewhere it means the rightmost `X-Forwarded-For`, `x-real-ip`
  and `true-client-ip`, and never `cf-connecting-ip`, so behind Cloudflare set `cloudflare`. A set value always wins.
  `nextspark doctor` shows which source applies. See [Client address](../14-deployment/10-client-address.md).

### Core's admin routes

The tier is per client address and shared by every route in it. The reads that the superadmin pages (users, user, teams, team and
subscriptions) and the API keys page make on every load or reload are in `read` (200 per minute per address). What changes users (updating and
deleting a user, and the `POST` and `PUT` of `/api/superadmin/users`) is in `write` (50 per minute per address), so a run of role changes is
not stopped at ten. What changes credentials (creating, renaming and revoking an API key), and billing, the `POST` of plan flags, ownership
transfer and account deletion, stays in `strict`: 10 per **hour** per address, in one bucket for all of them. A page that fetches in the `strict` tier answers 429 with `Retry-After: 3600` after ten
reloads, which is why those reads are not in it. A project that wants other numbers sets them in `rateLimit.tiers` of `app.config.ts`.

### Checking a limit yourself

For a counter that is not per address (per user, per resource), call the same check the wrappers use:

```typescript
import { checkDistributedRateLimit, createRateLimitErrorResponse } from '@nextsparkjs/core/lib/api'

const result = await checkDistributedRateLimit(`export:${userId}`, 'strict')
if (!result.allowed) return createRateLimitErrorResponse(result)
```

The identifier is any string; the tier gives the limit and the window.

---

## The per-credential limit (the `credential` tier)

A request that authenticates with a scoped credential is counted against that credential, on top of the per-address
limit of the route.

- **Limit:** the `credential` tier, **1000 charges per minute** by default: a plain request is one charge and a generated MCP tool, which also calls an API handler, is two.
- **Function:** `credentialRateLimitResponse(request, auth)` in `lib/api/rate-limit.ts`. It returns a `429` ready to
  send when the credential is over its limit, and `null` otherwise.
- **Who calls it:** `authenticateRequest`, `validateAndAuthenticateRequest` and `validateAndAuthenticateApiRequest`
  for an API key, and the MCP endpoint for an OAuth access token. A route that authenticates through one of them
  gets the limit without doing anything.
- **What identifies the credential:** the id of the API key, or for an MCP connection the application and the user
  (`oauth:<clientId>:<userId>`, `oauthRateLimitKey`).
- **Counted once per request**, however many times the request is authenticated.
- **A safety cap:** `DISABLE_RATE_LIMITING=true` does not turn it off.
- **Not applied to sessions.** A request authenticated by a session cookie is not counted here.

### Counted in the process, and in Redis when configured

The limit is always counted in the process. When Redis is configured (see
[Where the Count Is Kept](#where-the-count-is-kept)) the same limit is also counted there, so every instance shares
the count. The request is refused when **either** count is over.

| Situation | Result |
|---|---|
| No Redis | Each process counts on its own. On serverless, where every instance is a process, each gives the credential its own 1000 per minute, which is close to no limit |
| Redis configured | One shared count for the credential across all instances, plus the count of each process |
| Redis configured and failing | The shared check lets the request through; the count of the process still applies |

`apiKeyRateLimitResponse(request, auth)` is the in-process half alone. It is kept for projects that call it; core's
own call sites use `credentialRateLimitResponse`.

### MCP tool calls count twice

A tool call on `/api/mcp` counts twice against the credential: once for the MCP request, and once for the API
handler the tool calls in process. This is the same for an API key and for an MCP connection. See
[MCP Server: rate limits](./20-mcp-server.md#rate-limits).

### `withRateLimit` and `RATE_LIMITS`

`withRateLimit(handler)` is an older wrapper that limits a request presenting a valid API key, with numbers that
depend on the key's scopes (`RATE_LIMITS` and `getRateLimitForScopes` in `lib/api/keys.ts`). It counts in the process
only and none of core's routes use it. It remains exported for projects that wrapped a route with it. The limit an
API key gets from authenticating is the `credential` tier described above, not `RATE_LIMITS`.

---

## Where the Count Is Kept

| | Redis (Upstash) | In process |
|---|---|---|
| **When** | Both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set | Otherwise |
| **Algorithm** | Sliding window (`Ratelimit.slidingWindow` of `@upstash/ratelimit`) | Fixed window: a counter that resets when its window ends |
| **Shared between instances** | Yes | No: each process has its own counters |
| **Survives a restart or a deploy** | Yes | No |

- **Both variables are required.** With only one set, Redis is not used.
- **Only Upstash's REST API is supported.** A Redis reached over TCP (`redis://...`) is not read; there is no
  `REDIS_URL`.
- **Vercel's Marketplace names the variables differently.** An Upstash database created from the Vercel
  Marketplace exposes `KV_REST_API_URL` and `KV_REST_API_TOKEN`. The framework reads `UPSTASH_REDIS_REST_URL` and
  `UPSTASH_REDIS_REST_TOKEN`, so add those two by hand with the same values.
- **Redis errors fail open.** If Redis is configured and a check fails, a per-address check lets the request
  through and logs the error. The per-credential limit still has its in-process count.
- **A fixed window allows a burst at its boundary:** a caller can use a full budget at the end of one window and
  another at the start of the next. The sliding window of the Redis path does not.

For anything that runs as more than one process (serverless, several containers), configure Redis: without it every
limit in this document is per process.

```bash
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-rest-token
```

---

## Configuration

`rateLimit.tiers` in `config/app.config.ts` changes the numbers of a built-in tier or declares a new one. Without
this entry every tier keeps the defaults of the [table above](#tiers).

```typescript
// app.config.ts
export const APP_CONFIG_OVERRIDES = {
  rateLimit: {
    tiers: {
      write: { limit: 120 },                        // only the limit changes; the window stays at 1 minute
      credential: { limit: 3000 },                  // what one API key or MCP connection may send per minute
      exports: { limit: 5, windowMs: 10 * 60_000 }, // a new tier: 5 requests every 10 minutes
    },
  },
}
```

```typescript
export const POST = withRateLimitTier(async (req) => { /* ... */ }, 'exports')
```

- `limit` is the number of requests per window and `windowMs` the window in milliseconds; both must be positive
  integers.
- A built-in tier accepts either field; a new tier needs both.
- The names of declared tiers are accepted by the type (`RateLimitTier`) and work the same with Redis and in process.
- An invalid or missing value never leaves an endpoint without a limit: a built-in tier keeps its default, and a new
  tier that is declared wrong is limited as `api`. The same happens with a tier name that is neither built in nor
  declared (a typo). In all three cases an error is logged once.

---

## Rate Limit Headers and the 429 Response

Only routes that go through a wrapper carry these headers. A route with no wrapper, a route opted out with
`rateLimit = false`, and a response whose headers are immutable do not.

### On a response that was allowed

A wrapped route adds the state of its **per-address** bucket:

```http
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 187
X-RateLimit-Reset: 1767225660000
```

- `X-RateLimit-Limit` - requests allowed in the window
- `X-RateLimit-Remaining` - requests left in the current window
- `X-RateLimit-Reset` - when the window ends, as a Unix timestamp in **milliseconds**

There is no `X-RateLimit-Reset-After` header. The state of the per-credential limit is not reported on allowed
responses.

### On a 429

`Retry-After` (seconds) is added to the three headers above, which then describe the limit that was hit.

**Per-address limit:**

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1767225660000
Retry-After: 42

{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "meta": {
    "limit": 200,
    "remaining": 0,
    "resetTime": "2026-01-01T00:01:00.000Z",
    "retryAfter": 42
  }
}
```

**Per-credential limit:**

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Too many requests. Limit: 1000 requests per minute",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 42
}
```

It carries the same four headers and core's CORS headers. On `/api/mcp` the same condition is answered as a
JSON-RPC error with `Retry-After`. The sign-in routes answer the shorter body shown in
[Sign-in routes](#sign-in-routes-the-auth-and-authidentifier-tiers).

The REST responses use the code `RATE_LIMIT_EXCEEDED`; `/api/mcp` answers a JSON-RPC error, whose `code` is the protocol's number, not that string. All of them send `Retry-After`: a client should read that and wait.

---

## Disabling Rate Limiting (QA/Preview and Tests)

`DISABLE_RATE_LIMITING=true` turns the per-address limits off for a whole deploy, for example a QA team testing a
Vercel Preview from one shared address:

```env
DISABLE_RATE_LIMITING=true
```

When set to exactly `true`:
- The per-address limits (`withRateLimitTier`, `checkDistributedRateLimit`, and the default limit of your own API routes) are bypassed
- Better Auth's own limiter is off too (sign-in, sign-up and the email OTP rules, 3 per minute per address)
- **The per-credential limit stays on**, for API keys and MCP connections: it is a cap per credential, not per address
- A warning is logged once: `[RateLimit] WARNING: Rate limiting is DISABLED...`

Any other value leaves everything on, Better Auth included (on by default when `NODE_ENV=production`).

**WARNING:** Never disable rate limiting in production! Only for QA/preview deploys and tests.

---

## What Core Does Not Do

Earlier versions of this document described features that core does not implement. None of the following exists in
the framework; a project that needs one builds it, for example on top of `checkDistributedRateLimit` or in its own
wrapper:

- **Limits per authentication type** (so many per hour for a key, for a session user, for an anonymous address). The
  limits are the tiers above, per address, plus the per-credential limit.
- **A per-user limit for sessions.**
- **Per-entity limits.** Every entity shares the `read` and `write` tiers.
- **Limits by subscription plan.**
- **A token bucket or a configurable burst allowance.** The algorithms are the two in
  [Where the Count Is Kept](#where-the-count-is-kept).
- **Bypass rules**: no exemption for admins, no allow-list of addresses, no higher limit for service accounts. The
  per-address wrapper counts before it knows who is calling.
- **A table of violations, analytics or alerts.** A refused request is answered `429` and not stored. What is
  stored is the activity of scoped credentials, in `api_audit_log`; for MCP tool calls see
  [MCP Server: audit trail](./20-mcp-server.md#audit-trail).

---

## Handling Rate Limits in a Client

A client should treat `429` as a signal to wait for `Retry-After` seconds and try again.

### JavaScript / TypeScript

```typescript
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options)
    if (response.status !== 429) return response

    const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10)
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
  }
  throw new Error('Rate limited: retries exhausted')
}

// Reading the per-address budget of an allowed response
const response = await fetchWithRetry('https://example.com/api/v1/tasks', {
  headers: { Authorization: `Bearer ${apiKey}` },
})
const remaining = Number(response.headers.get('X-RateLimit-Remaining'))
const resetAt = new Date(Number(response.headers.get('X-RateLimit-Reset'))) // milliseconds
```

### React (TanStack Query)

```typescript
import { useQuery } from '@tanstack/react-query'

class RateLimitedError extends Error {
  constructor(public retryAfter: number) {
    super('Rate limited')
  }
}

function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const response = await fetch('/api/v1/tasks')
      if (response.status === 429) {
        throw new RateLimitedError(parseInt(response.headers.get('Retry-After') || '60', 10))
      }
      return response.json()
    },
    retry: (failureCount, error) => error instanceof RateLimitedError && failureCount < 3,
    retryDelay: (_attempt, error) => (error instanceof RateLimitedError ? error.retryAfter * 1000 : 1000),
  })
}
```

### Python

```python
import time
import requests

def request_with_retry(url: str, api_key: str, max_retries: int = 3):
    for _ in range(max_retries):
        response = requests.get(url, headers={"Authorization": f"Bearer {api_key}"})
        if response.status_code != 429:
            response.raise_for_status()
            return response.json()
        time.sleep(int(response.headers.get("Retry-After", 60)))
    raise Exception("Rate limited: retries exhausted")
```

A client that sends many requests should also throttle itself below the limit instead of relying on `429`: with an
API key, stay under the `credential` tier and under the tier of the routes it calls from its address.

---

## Next Steps

- [Rate Limiting en NextSpark](../rate-limiting.md) - setting up Upstash, step by step (in Spanish)
- [Authentication](./02-authentication.md) - the credentials the per-credential limit counts
- [MCP Server](./20-mcp-server.md) - the two limits on `/api/mcp`
- [Client address](../14-deployment/10-client-address.md) - which address is counted behind a proxy
- [Error Handling](./08-error-handling.md) - complete error handling documentation
- [Best Practices](./11-best-practices.md) - API best practices guide

**Documentation:** `core/docs/05-api/07-rate-limiting.md`
