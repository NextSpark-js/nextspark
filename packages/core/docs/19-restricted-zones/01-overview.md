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

- **Route Guards**: Client-side protection via `SuperAdminGuard` and `DeveloperGuard` components
- **Middleware Protection**: Server-side route protection
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
