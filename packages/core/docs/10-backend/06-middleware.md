# Middleware

## Introduction

Next.js middleware provides powerful request/response transformation capabilities. Our middleware implementation handles authentication, route protection, theme overrides, and documentation access control.

## Middleware Architecture

### Request Flow

```text
┌─────────────────────────────────────────┐
│ Incoming Request                        │
├─────────────────────────────────────────┤
│ 1. Theme Middleware Check               │
│    └─ Execute theme override if exists  │
├─────────────────────────────────────────┤
│ 2. Docs URL Redirect                    │
│    └─ Old 2-level → New 3-level         │
├─────────────────────────────────────────┤
│ 3. Documentation Access Control         │
│    └─ Check if docs require auth        │
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

### Main Middleware

Location: `middleware.ts`

```typescript
import { betterFetch } from "@better-fetch/fetch";
import type { auth } from "@/core/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  hasThemeMiddleware,
  executeThemeMiddleware
} from "@/core/lib/registries/middleware-registry";
import { getThemeAppConfig } from "@/core/lib/registries/theme-registry";

type Session = typeof auth.$Infer.Session;

const publicPaths = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/terms",
  "/privacy",
  "/api/auth",
  "/api/test-auth",
  "/auth-test",
  "/auth/callback",
] as const;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Check for theme middleware override
  const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME;
  if (activeTheme && hasThemeMiddleware(activeTheme)) {
    const themeResponse = await executeThemeMiddleware(activeTheme, request);
    if (themeResponse) return themeResponse;
  }

  // 2. Redirect old docs URLs to new structure
  const oldDocsPattern = /^\/docs\/([^\/]+)\/([^\/]+)$/;
  const oldDocsMatch = pathname.match(oldDocsPattern);

  if (oldDocsMatch) {
    const [, sectionSlug, pageSlug] = oldDocsMatch;
    const themeSections = ['theme-overview', 'theme-features'];
    const category = themeSections.includes(sectionSlug) ? 'theme' : 'core';
    const cleanSection = sectionSlug.replace(/^theme-/, '');

    const newUrl = request.nextUrl.clone();
    newUrl.pathname = `/docs/${category}/${cleanSection}/${pageSlug}`;
    return NextResponse.redirect(newUrl, 301);
  }

  // 3. Documentation access control
  if (pathname.startsWith("/docs")) {
    const appConfig = getThemeAppConfig(activeTheme as any);

    if (appConfig?.docs?.public === false) {
      try {
        const { data: session } = await betterFetch<Session>(
          "/api/auth/get-session",
          {
            baseURL: request.nextUrl.origin,
            headers: { cookie: request.headers.get("cookie") || "" },
          }
        );

        if (!session) {
          const loginUrl = new URL("/login", request.url);
          loginUrl.searchParams.set("redirect", pathname);
          return NextResponse.redirect(loginUrl);
        }
      } catch (error) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(loginUrl);
      }
    }
    return NextResponse.next();
  }

  // 4. Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // 5. API v1 routes handle their own dual authentication
  if (pathname.startsWith("/api/v1")) {
    return NextResponse.next();
  }

  // 6. Protected routes
  const isAdminRoute = pathname.startsWith("/admin");
  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/update-password") ||
    isAdminRoute;

  if (isProtectedRoute) {
    try {
      const { data: session } = await betterFetch<Session>(
        "/api/auth/get-session",
        {
          baseURL: request.nextUrl.origin,
          headers: { cookie: request.headers.get("cookie") || "" },
        }
      );

      if (!session) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Admin Panel superadmin-only check
      if (isAdminRoute) {
        if (!session.user?.role || session.user.role !== 'superadmin') {
          const dashboardUrl = new URL("/dashboard", request.url);
          dashboardUrl.searchParams.set("error", "access_denied");
          return NextResponse.redirect(dashboardUrl);
        }
      }

      // Inject user headers for downstream use
      const requestHeaders = new Headers(request.headers);
      if (session.user?.id) {
        requestHeaders.set("x-user-id", session.user.id);
      }
      if (session.user?.email) {
        requestHeaders.set("x-user-email", session.user.email);
      }
      requestHeaders.set("x-pathname", pathname);

      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    } catch (error) {
      console.error('Middleware error:', error);
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

---

## Key Features

### 1. Theme Middleware Override

Allows themes to provide custom middleware logic:

```typescript
// Theme can override middleware
const themeResponse = await executeThemeMiddleware(activeTheme, request);
if (themeResponse) return themeResponse;
```

**Use Cases:**
- Custom authentication flows
- Theme-specific redirects
- Special route handling

### 2. Documentation Access Control

Controls public/private documentation access:

```typescript
if (appConfig?.docs?.public === false) {
  // Require authentication for docs
  if (!session) {
    return NextResponse.redirect(loginUrl);
  }
}
```

**Configuration:**
```typescript
// contents/themes/[theme]/app.config.ts
export const appConfig = {
  docs: {
    public: false // Require auth for docs
  }
};
```

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
