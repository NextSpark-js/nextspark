# Middleware

## Introduction

Next.js middleware provides powerful request/response transformation capabilities. Our middleware implementation handles authentication, route protection, theme overrides, and documentation access control.

## Middleware Architecture

### Request Flow

```text
┌─────────────────────────────────────────┐
│ Incoming Request                        │
├─────────────────────────────────────────┤
│ 1. Sanitize + Run Theme Extension       │
│    └─ Classify redirect/rewrite/next    │
├─────────────────────────────────────────┤
│ 2. Core Access Checks                   │
│    └─ Original + internal rewrite path  │
├─────────────────────────────────────────┤
│ 3. Docs URL Redirect / Access           │
│    └─ Legacy URL + docs visibility      │
├─────────────────────────────────────────┤
│ 4. Public Path Check                    │
│    └─ Allow unauthenticated access      │
├─────────────────────────────────────────┤
│ 5. API v1 Routes                        │
│    └─ Dual auth handled in route        │
├─────────────────────────────────────────┤
│ 6. Protected Routes                     │
│    ├─ Validate JWT session              │
│    ├─ Check role permissions            │
│    └─ Inject user headers               │
├─────────────────────────────────────────┤
│ Route Handler Execution                 │
└─────────────────────────────────────────┘
```

---

## Implementation

### The Project's `src/proxy.ts` and Core's Proxy

The proxy lives in core: `@nextsparkjs/core/proxy` exports `proxy`, the request
handler, and `createProxy`, which builds one with project options. A generated
project's `src/proxy.ts` (beside the generated `src/app`; Next ignores a
project-root proxy when the app uses `src/`) is yours and only re-exports it:

```typescript
// src/proxy.ts
export { proxy } from '@nextsparkjs/core/proxy'

export const config = {
  matcher: [
    '/((?!_next/static/|_next/image$|favicon\\.ico$).*)',
  ],
}
```

Core's proxy is updated with `@nextsparkjs/core`; the file is not. Next.js
reads `config` from this file's own source, not from its imports, so the
matcher stays written here: a `config` re-exported from a package is not seen.

### Extending It

| You want | Where |
| --- | --- |
| Redirects, same-origin rewrites, response headers or cookies, request metadata for your routes | `config/hooks/proxy.ts`, exporting `proxyHook`. Core's proxy runs it first, on a request with the identity headers removed, then applies its own checks to the original route and to any rewrite target (see below). |
| More paths that need a signed-in user | `createProxy({ authenticatedPaths: ['/account'] })` in `src/proxy.ts`. Each entry is a path prefix matched on segment boundaries (`/account` covers `/account/billing`, not `/accounts`), added to `/dashboard`, `/settings`, `/profile` and `/update-password`. No session goes to `/login?callbackUrl=...`; a session gets the page with the verified identity headers. `createProxy` throws on an entry on, under or above a path core lets through first (the public pages, such as `/terms` and `/login`; `/api/auth`; `/docs`; and `/api/v1`, which authenticates on its own): it would not be gated there. |
| An area of your own that needs a role, such as `/reports` for managers | Not in the proxy: `authenticatedPaths` only requires a session, and the hook runs without one. Check the role in the page or its layout on the server (`auth.api.getSession` from `@nextsparkjs/core/lib/auth`). |
| Paths the proxy should not run on | The `matcher` in `src/proxy.ts`. Leave out only exact paths: excluding by file extension would let a route such as `/profile/alice.png` skip the session check. |

```typescript
// src/proxy.ts
import { createProxy } from '@nextsparkjs/core/proxy'

export const proxy = createProxy({ authenticatedPaths: ['/account', '/billing'] })

export const config = {
  matcher: [
    '/((?!_next/static/|_next/image$|favicon\\.ico$).*)',
  ],
}
```

The core proxy owns the security boundary. A project may extend request
handling, but its result is composed with the core checks rather than returned
before them. The session lookup stays in core's proxy, which injects
`x-user-id`, `x-user-email`, and `x-active-team-id` only from that verified
session. Layout guards remain defense in depth; they are not the route access
boundary.

A `src/proxy.ts` that does not use `@nextsparkjs/core/proxy` (a copy of the
template from 0.1.0-beta.197 or earlier, edited, or a proxy of your own) keeps
working as written and gets none of core's changes. `nextspark prepare` and
`nextspark migrate` print `NS_PROXY_FACADE_MISSING` with the content to put in
its place; an unchanged copy of an earlier template is replaced for you.

## Key Features

### 1. Theme Middleware Extension Contract

Themes may add behavior, but cannot replace core access control. The hook
receives a `NextRequest` with inbound `x-user-id`, `x-user-email`,
`x-active-team-id`, and `x-pathname` removed; `x-pathname` is then set to the
actual request pathname.

Supported results:

- `null`: continue with the normal core proxy flow.
- `NextResponse.next()`: keep response headers/cookies and nonidentity request
  header overrides, then run the original route through core docs/session/role
  checks.
- A same-origin `NextResponse.rewrite()`: keep its destination, query,
  response headers/cookies, and nonidentity request overrides, but run both the
  original route and rewritten internal destination through core access
  checks. The destination pathname becomes the trusted `x-pathname`.
- A redirect response: return the redirect with its headers/cookies after
  removing request-override metadata.
- Another terminal response: return it only after the original route passes
  its core access check.

External, empty, malformed, and otherwise ambiguous rewrites intentionally fail
closed with `502`. Ambiguous path encodings include encoded separators,
malformed percent escapes, and a segment that remains percent-encoded after one
decode; these are not routed by guessing or repeated decoding. For access
checks, literal repeated slashes/backslashes are normalized the same way as
Next routing and ordinary encoded segments are decoded once; the original
same-origin rewrite URL and query are otherwise preserved. This prevents
alternate spellings of a protected route from skipping its gate and prevents
session cookies or core-injected identity from being forwarded to another
origin. Theme-provided request overrides can never set trusted identity
headers; those values always come from the core session lookup.

**Use Cases:**
- Locale or tenant-specific same-origin rewrites
- Theme-specific redirects
- Response cookies and headers
- Nonidentity request metadata consumed by theme routes

### 2. Documentation Access Control

Controls public/private documentation access. `docs.publicAccess` decides it:
when `/docs` is not public, a request without a session goes to
`/login?callbackUrl=...`.

**Configuration:**
```typescript
// app.config.ts
export const appConfig = {
  docs: {
    publicAccess: false // Require auth for docs
  }
};
```

`public: false`, what app configs wrote before `publicAccess` existed, still
keeps `/docs` private; see
[Who can read /docs](../15-documentation-system/02-architecture.md#who-can-read-docs).

### 3. Role-Based Access Control

Restricts access based on user roles:

```typescript
// Superadmin-only routes
if (isAdminRoute) {
  if (session.user.role !== 'superadmin') {
    return NextResponse.redirect(dashboardUrl);
  }
}
```

### 4. User Context Injection

Adds user information to request headers:

```typescript
const requestHeaders = new Headers(request.headers);
requestHeaders.set("x-user-id", session.user.id);
requestHeaders.set("x-user-email", session.user.email);
requestHeaders.set("x-pathname", pathname);

return NextResponse.next({
  request: { headers: requestHeaders },
});
```

**Usage in API Routes:**
```typescript
export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  const pathname = request.headers.get("x-pathname");
  // Use for logging, analytics, etc.
}
```

---

## Middleware Matcher

### Path Matching Configuration

```typescript
export const config = {
  matcher: [
    '/((?!_next/static/|_next/image$|favicon\\.ico$).*)',
  ],
}
```

**Excludes** only the exact paths of Next's own output: `_next/static/`, the
`_next/image` endpoint and `favicon.ico`. Files under `public/` pass through
the proxy and are served as they are.

**Why not by extension:** a matcher that skips `.png` or `.svg` would also skip
a dynamic route such as `/profile/alice.png`, which would then reach the app
without the session check and with forged identity headers intact.

---

## Best Practices

### Do's ✅

**1. Keep Middleware Fast**
```typescript
// Quick checks first
if (isPublicPath(pathname)) {
  return NextResponse.next(); // Early return
}
```

**2. Handle Errors Gracefully**
```typescript
try {
  const session = await auth.api.getSession({ headers });
} catch (error) {
  console.error('Auth error:', error);
  return NextResponse.redirect(loginUrl);
}
```

**3. Keep the Matcher Exact**
```typescript
// Exclude only Next's own output, never by file extension
matcher: ['/((?!_next/static/|_next/image$|favicon\\.ico$).*)']
```

**4. Inject Useful Headers**
```typescript
requestHeaders.set("x-user-id", userId);
requestHeaders.set("x-pathname", pathname);
```

### Don'ts ❌

**1. Never Do Heavy Processing**
```typescript
// ❌ BAD - Slow database query
const user = await db.query('SELECT * FROM users...');

// ✅ GOOD - Quick session check only, in process (never fetch your own
// /api/auth/get-session: behind a TLS-terminating proxy that URL is https
// on a plain-HTTP port and the check fails)
const session = await auth.api.getSession({ headers });
```

**2. Never Block Static Assets**
```typescript
// ❌ BAD - Runs on every static file
matcher: ["/*"]

// ✅ GOOD - Excludes Next's static output
matcher: ['/((?!_next/static/|_next/image$|favicon\\.ico$).*)']
```

**3. Never Skip Error Handling**
```typescript
// ❌ BAD - No error handling
const session = await auth.api.getSession({ headers });

// ✅ GOOD - Try/catch
try {
  const session = await auth.api.getSession({ headers });
} catch (error) {
  // Handle error
}
```

---

## Summary

**Key Features:**
- Theme middleware override support
- JWT session validation
- Role-based access control
- Documentation access control
- User context injection
- URL redirect handling

**Performance:**
- Fast path matching
- Early returns for public paths
- Excludes static assets
- Minimal processing overhead

**Security:**
- Session validation via Better Auth
- Role-based route protection
- Error handling and fallbacks
- Secure header injection

**Next:** [Background Jobs](./07-background-jobs.md)

---

**Last Updated**: 2025-01-19
**Version**: 1.0.0
**Status**: Complete
