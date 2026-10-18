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
import { useIsSuperAdmin, useCanAccessAdmin } from "@nextsparkjs/core/components/app/guards/SuperAdminGuard";

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

## Business Metrics

The top of `/superadmin` shows five numbers, computed live from Postgres on every request (no job, no cache table, no migration). The queries live in `lib/services/business-metrics.service.ts` and run on the service connection; the page is rendered only for `superadmin` and `developer` sessions (the area's server-side role check), and the service checks nothing itself, so call it only from pages under `/superadmin`.

| Metric | Definition |
|--------|------------|
| Total users | Rows of `users`. |
| Sign-ups | `users."createdAt"` per UTC day for the last 30 days (today and the 29 before), days with no sign-ups included as zero. |
| Paying teams | Teams with a paying subscription. |
| Paying users | Distinct payers of those subscriptions: the subscription's `userId`, or the team owner for a team-level subscription. Members who only use a paid team are not counted. |
| MRR | Monthly recurring revenue of the paying subscriptions, in cents, **per currency**: the plan's `priceMonthly` for monthly subscriptions, `priceYearly / 12` for yearly ones. |

A **paying subscription** has `status = 'active'` (trialing, `past_due`, paused, canceled and expired are not counted), is on a plan whose type is not `free`, belongs to a team that is not soft-deleted, and has a price above zero for its billing interval (an enterprise plan without a price counts for nothing). A subscription with `cancelAtPeriodEnd` still counts until its `currentPeriodEnd`, as a payment gateway reports MRR. The schema has no quantity, seats, discount or per-subscription price, so the plan's price is the price; MRR is computed from the `subscriptions` and `plans` tables and never calls a gateway. Plans carry their own `currency` (default `usd`): amounts in different currencies are shown side by side and never added.

The sign-ups query reads `users` once (a sequential scan: about 80 ms at 500,000 users); an index on `users("createdAt")` would make it a range scan on a much larger table, and core does not add one.

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
