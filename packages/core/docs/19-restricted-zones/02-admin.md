# Admin Panel - Super Admin Area

> System administration zone for superadmins and developers.

## Overview

Admin Panel is the system administration area accessible at `/admin`. It provides tools for managing users, teams, and system-wide settings across all tenants.

**Route**: `/admin/*`
**Access**: `superadmin`, `developer`
**Guard**: `SuperAdminGuard`
**Color Scheme**: Red (`bg-red-*`, `text-red-*`)

## Access Control

### SuperAdminGuard

Located at `core/components/app/guards/SuperAdminGuard.tsx`

```typescript
// Access check
if (session.user?.role !== 'superadmin' && session.user?.role !== 'developer') {
  // Show access denied or redirect
}
```

### Helper Hooks

```typescript
import { useIsSuperAdmin, useCanAccessAdmin } from "@/core/components/app/guards/SuperAdminGuard";

// Check if user is specifically superadmin
const isSuperAdmin = useIsSuperAdmin();

// Check if user can access Admin Panel (superadmin OR developer)
const canAccess = useCanAccessAdmin();
```

## Available Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/admin` | `page.tsx` | Dashboard/landing page |
| `/admin/users` | `users/page.tsx` | User management list |
| `/admin/users/[userId]` | `users/[userId]/page.tsx` | Individual user details |
| `/admin/teams` | `teams/page.tsx` | Team management list |
| `/admin/teams/[teamId]` | `teams/[teamId]/page.tsx` | Individual team details |

## Layout Structure

```text
/admin (layout.tsx)
├── SuperAdminGuard
│   └── div.flex.h-screen.bg-background
│       ├── AdminSidebar (hidden lg:block)
│       ├── div.flex-1.flex.flex-col
│       │   ├── Mobile Header (lg:hidden)
│       │   └── main.flex-1.overflow-y-auto
│       │       └── div.container.mx-auto.p-6.max-w-7xl
│       │           └── {children}
```

## Sidebar Navigation

Located at `core/components/admin/layouts/AdminSidebar.tsx`

The sidebar provides:
- Logo and branding with red color scheme
- Navigation links to Admin Panel pages
- Active state highlighting
- User menu with logout option

## Recommended Uses

### User Management
- View all users across all teams
- Edit user roles and permissions
- Deactivate or delete user accounts
- View user activity history

### Team Management
- Create and configure teams
- Assign users to teams
- Set team-level permissions
- View team statistics

### System Configuration
- Global application settings
- Feature flags management
- Integration configurations
- Audit logs review

## Security Considerations

1. **No Client-Side Data Exposure**: Admin Panel pages should never expose sensitive data in JavaScript bundles
2. **API Authorization**: All API endpoints must independently verify superadmin/developer access
3. **Audit Logging**: Consider logging all Admin Panel actions for security audit
4. **Rate Limiting**: Apply stricter rate limits to prevent abuse

## Visual Branding

Admin Panel uses a red color palette to clearly distinguish it from other areas:

```css
/* Primary colors */
bg-red-100, bg-red-600
text-red-600, text-red-400 (dark mode)
border-red-*

/* Example button */
<Button className="bg-red-600 hover:bg-red-700">
```

## Related Files

- Layout: `app/admin/layout.tsx`
- Guard: `core/components/app/guards/SuperAdminGuard.tsx`
- Sidebar: `core/components/admin/layouts/AdminSidebar.tsx`
- User Types: `core/types/user.types.ts`
