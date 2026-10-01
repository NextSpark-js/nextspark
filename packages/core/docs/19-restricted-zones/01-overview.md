# Restricted Zones

> Access-controlled areas for system administration and development tools.

## Introduction

The application includes two restricted zones that are only accessible to users with specific roles. These zones provide specialized functionality that should not be available to regular users.

| Zone | Route | Access | Color Scheme | Purpose |
|------|-------|--------|--------------|---------|
| **Admin Panel** | `/admin` | superadmin, developer | Red | System administration |
| **DevTools** | `/devtools` | developer | Purple/Violet | Development tools |

## Role Hierarchy

The access control follows a role hierarchy where developers have the highest level of access:

```text
developer (hierarchy: 100) ─┬─> Can access Admin Panel
                            └─> Can access DevTools

superadmin (hierarchy: 99) ──> Can access Admin Panel only

member (hierarchy: 1) ───────> No access to restricted zones
```

**Note**: The `developer` role always has hierarchy 100 and cannot be changed. Non-developer roles are capped at hierarchy 99.

## Security Features

Both zones implement:

- **Server-side role check**: core checks the session's role on the server before anything of the zone renders, in the zone's layout and again in every page and layout under it (the generated `src/app` composes each one with `withSuperadminAccess` / `withDevtoolsAccess`, including your own pages and overrides). It does not depend on your `proxy.ts`. No session goes to `/login`, a session without the role to `/dashboard?error=access_denied`
  - Route Handlers (`route.ts`) under a zone are checked too: every method but `OPTIONS` answers 401 (no session) or 403 (wrong role) JSON before your handler runs. `OPTIONS` is forwarded unchecked (a CORS preflight carries no credentials), so an `OPTIONS` handler under a zone must not return data.
  - Status codes: with legacy ISR a refused page load gets a 307. With Cache Components (the default) Next 16.3 sends every page's prerendered shell before rendering resumes, so a refusal decided while rendering is a 200 whose redirect runs in the browser, with nothing of the zone in the body. Two things answer earlier, with a 307: the scaffold's `next.config.mjs` redirects a visitor with no session cookie to login (`redirects()`, before any rendering), and core's proxy template refuses a signed-in user without the role. `nextspark prepare` and `nextspark migrate` warn (`NS_PROXY_PROTECTED_AREA_MISSING`) when your `src/proxy.ts` does not protect a zone.
  - The DevTools APIs (`/api/v1/devtools/*`, `/api/devtools/*`) follow the DevTools rule: developer only.
  - Intercepting routes (`@modal/(.)superadmin/...`) are checked by the URL they intercept.
  - **Not checked, by design:** metadata files under a zone (`icon`, `opengraph-image`, `twitter-image`, `sitemap`, ...) are served without the role check; `nextspark prepare` prints a warning (`NS_HOST_AREA_FILE_UNGUARDED`) for each one, so keep zone data out of them or move them out of the zone. `loading`, `error` and `not-found` files must not render zone data. A Server Action is dispatched by its id, whatever page posts it, so an action that touches zone data checks the session's role itself.
- **Proxy Protection**: core's proxy template refuses the same requests before rendering, with a 307
- **Route Guards**: Client-side protection via `SuperAdminGuard` and `DeveloperGuard` components (they only decide in the browser, after the page has been served)
- **SEO Exclusion**: `robots: "noindex, nofollow"` metadata prevents search engine indexing
- **Auto-redirect**: Unauthorized users are redirected to dashboard with error message
- **Session Validation**: Guards verify session state before rendering content

## Zone-Specific Layouts

Each zone has a dedicated layout with:

- **Responsive Sidebar**: Hidden on mobile, visible on desktop (`lg:block`)
- **Mobile Header**: Compact header for mobile devices
- **Color-Coded Branding**: Visual differentiation (red for Admin Panel, purple for DevTools)
- **Scrollable Content Area**: Main content with overflow handling

## Quick Reference

### When to Use Admin Panel

- Managing system users across all teams
- Configuring global settings
- Viewing system-wide analytics
- Managing team structures

### When to Use DevTools

- Browsing test documentation
- Viewing application configuration
- Accessing style galleries and design system
- Development debugging tools

## Related Documentation

- [02 - Admin Panel](./02-admin.md)
- [03 - DevTools](./03-devtools.md)
- [04 - Test Cases Feature](./04-test-cases.md)
- [Authentication Overview](../06-authentication/01-overview.md)
- [Permissions and Roles](../06-authentication/06-permissions-and-roles.md)
