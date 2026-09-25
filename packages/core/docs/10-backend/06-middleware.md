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

### Shipped Proxy Template

Location: `packages/core/templates/proxy.ts` (generated projects receive it as
`proxy.ts` on Next.js 16 or `middleware.ts` on Next.js 15).

The core proxy owns the security boundary. An project may extend request
handling, but its result is composed with the core checks rather than returned
before them:

```typescript
const sanitizedRequest = requestForTheme(
  request,
  sanitizeRequestHeaders(request)
)
const themeResponse = await executeProjectMiddleware(sanitizedRequest, null)

// The proxy then applies core docs/session/role checks before honoring a
// continuation, same-origin rewrite, or protected terminal response.
```

The implementation keeps the session lookup in the core proxy and injects
`x-user-id`, `x-user-email`, and `x-active-team-id` only from that verified
session. Layout guards remain defense in depth; they are not the route access
boundary.

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

Controls public/private documentation access. `docs.publicAccess` decides it,
read through `isDocsPublic()` from `@nextsparkjs/core/lib/docs/access`:

```typescript
if (!isDocsPublic(appConfig?.docs)) {
  // Require authentication for docs
  if (!session) {
    return NextResponse.redirect(loginUrl);
  }
}
```

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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**Excludes:**
- Static files (`_next/static`)
- Image optimization (`_next/image`)
- Favicon
- Images (svg, png, jpg, jpeg, gif, webp)

**Includes:**
- All other routes (pages, API routes, etc.)

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
  const session = await betterFetch(...);
} catch (error) {
  console.error('Auth error:', error);
  return NextResponse.redirect(loginUrl);
}
```

**3. Use Specific Matchers**
```typescript
// Exclude static assets for performance
matcher: ["/((?!_next/static|...).*"])
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

// ✅ GOOD - Quick session check only
const session = await betterFetch('/api/auth/get-session');
```

**2. Never Block Static Assets**
```typescript
// ❌ BAD - Runs on every static file
matcher: ["/*"]

// ✅ GOOD - Excludes static assets
matcher: ["/((?!_next/static|...).*"]
```

**3. Never Skip Error Handling**
```typescript
// ❌ BAD - No error handling
const session = await betterFetch(...);

// ✅ GOOD - Try/catch
try {
  const session = await betterFetch(...);
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
