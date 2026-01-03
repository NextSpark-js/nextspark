# Permission System Overview

**Version:** 2.0
**Last Updated:** 2025-12-26

---

## Introduction

The Permission System provides a unified approach to authorization that combines:

1. **Role-Based Access Control (RBAC)** - Permission matrix based on team roles
2. **Subscription Features** - Plan-based feature access
3. **Quota Management** - Usage limits per plan
4. **Hierarchy Checks** - Role comparison for administrative actions

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Route                                 │
│  const membership = await MembershipService.get(userId, teamId) │
│  const result = membership.canPerformAction('entity.action')    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MembershipService                             │
│  Combines data from multiple sources into TeamMembership         │
└─────────────────────────────────────────────────────────────────┘
           │              │              │              │
           ▼              ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ TeamMember   │ │ Subscription │ │ Permission   │ │ APP_CONFIG   │
│ Service      │ │ Service      │ │ Service      │ │ (hierarchy)  │
│ (role)       │ │ (plan, quota)│ │ (matrix)     │ │              │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

## Core Components

### 1. MembershipService

Static service that builds complete membership context.

```typescript
const membership = await MembershipService.get(userId, teamId)
```

**Returns:** `TeamMembership` object with all authorization data.

### 2. TeamMembership Class

Value object with helper methods for authorization checks.

```typescript
class TeamMembership {
  readonly userId: string
  readonly teamId: string
  readonly role: string | null
  readonly hierarchy: number
  readonly permissions: Permission[]
  readonly subscription: MembershipSubscription | null
  readonly features: string[]
  readonly quotas: Record<string, QuotaState>

  // Methods
  hasMinHierarchy(level: number): boolean
  hasRole(role: string): boolean
  hasAnyRole(roles: string[]): boolean
  hasPermission(permission: Permission): boolean
  hasFeature(feature: string): boolean
  checkQuota(limitSlug: string, increment?: number): QuotaResult
  canPerformAction(action: string, options?): ActionResult
}
```

### 3. PermissionService

Static service for permission matrix lookups (uses pre-computed registry).

```typescript
PermissionService.hasPermission('admin', 'customers.create') // true
PermissionService.getRolePermissions('member') // Permission[]
```

### 4. ActionResult Type

Discriminated union for action check results:

```typescript
type ActionResult =
  | { allowed: true }
  | {
      allowed: false
      reason: ActionDeniedReason
      message: string
      meta?: Record<string, unknown>
    }
```

## ActionDeniedReason Values

| Reason | Description | HTTP Status |
|--------|-------------|-------------|
| `not_member` | User is not a team member | 403 |
| `permission_denied` | Role lacks required permission | 403 |
| `feature_disabled` | Plan doesn't include feature | 403 |
| `quota_exceeded` | Usage limit reached | 403 |
| `subscription_inactive` | Subscription not active/trialing | 403 |

## Role Hierarchy

Default hierarchy levels (configurable in `teamRoles.hierarchy`):

| Role | Hierarchy Level |
|------|-----------------|
| owner | 100 |
| admin | 50 |
| member | 10 |
| viewer | 1 |

Usage:

```typescript
// Check if user can manage another user
if (membership.hasMinHierarchy(50)) {
  // User is admin or higher
}
```

## Flow: Complete Authorization Check

```
1. API receives request with userId, teamId
                    │
                    ▼
2. MembershipService.get(userId, teamId)
   - Fetch team member (role)
   - Fetch subscription (plan, features, quotas)
   - Get permissions from PermissionService
   - Get hierarchy from config
                    │
                    ▼
3. membership.canPerformAction('entity.action')
   - Check membership (role != null)
   - Check subscription status (active/trialing)
   - Check permission (RBAC)
   - Check feature (plan-based)
   - Check quota (usage limits)
                    │
                    ▼
4. Return ActionResult
   - { allowed: true } or
   - { allowed: false, reason, message, meta }
```

## File Locations

| File | Purpose |
|------|---------|
| `core/lib/services/membership.service.ts` | MembershipService + TeamMembership |
| `core/lib/services/permission.service.ts` | PermissionService |
| `core/lib/permissions/types.ts` | TypeScript types |
| `core/lib/registries/permissions-registry.ts` | Pre-computed permission matrix |
| `core/lib/permissions/core.permissions.ts` | Core permission definitions |

## Next Steps

- [MembershipService Reference](./02-membership-service.md)
- [PermissionService Reference](./03-permission-service.md)
- [API Integration Guide](./04-api-integration.md)
- [Migration Guide](./05-migration-guide.md)
