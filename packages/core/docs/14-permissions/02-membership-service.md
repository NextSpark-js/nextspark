# MembershipService Reference

**Version:** 2.0
**Last Updated:** 2025-12-26

---

## Overview

`MembershipService` provides unified team membership context by combining data from multiple sources into a single `TeamMembership` object.

## Import

```typescript
import { MembershipService, TeamMembership } from '@/core/lib/services'
```

---

## MembershipService

### `get(userId, teamId)`

Builds complete membership context for a user in a team.

```typescript
static async get(userId: string, teamId: string): Promise<TeamMembership>
```

**Parameters:**
- `userId` - User ID
- `teamId` - Team ID

**Returns:** `TeamMembership` object

**Example:**

```typescript
const membership = await MembershipService.get(userId, teamId)

if (!membership.role) {
  // User is not a member
  return Response.json({ error: 'Not a member' }, { status: 403 })
}
```

**Data Sources:**
- `TeamMemberService` - role, joinedAt
- `SubscriptionService` - plan, status, features
- `PermissionService` - permissions array
- `APP_CONFIG_MERGED` - hierarchy levels
- `UsageService` - quota states

---

## TeamMembership Class

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `userId` | `string` | User ID |
| `teamId` | `string` | Team ID |
| `role` | `string \| null` | Team role (null if not member) |
| `hierarchy` | `number` | Role hierarchy level |
| `permissions` | `Permission[]` | Array of permissions |
| `subscription` | `MembershipSubscription \| null` | Subscription info |
| `features` | `string[]` | Plan features |
| `quotas` | `Record<string, QuotaState>` | Quota states by limit |

### Methods

#### `hasMinHierarchy(level)`

Check if user has minimum hierarchy level.

```typescript
hasMinHierarchy(level: number): boolean
```

**Example:**

```typescript
// Check if admin or higher (hierarchy >= 50)
if (membership.hasMinHierarchy(50)) {
  // Can perform admin actions
}

// Hierarchy levels:
// owner: 100, admin: 50, member: 10, viewer: 1
```

#### `hasRole(role)`

Check if user has specific role.

```typescript
hasRole(role: string): boolean
```

**Example:**

```typescript
if (membership.hasRole('owner')) {
  // User is the team owner
}
```

#### `hasAnyRole(roles)`

Check if user has any of the specified roles.

```typescript
hasAnyRole(roles: string[]): boolean
```

**Example:**

```typescript
if (membership.hasAnyRole(['owner', 'admin'])) {
  // User is owner OR admin
}
```

#### `hasPermission(permission)`

Check if user has specific permission.

```typescript
hasPermission(permission: Permission): boolean
```

**Example:**

```typescript
if (membership.hasPermission('customers.delete')) {
  // User can delete customers
}
```

#### `hasFeature(feature)`

Check if plan includes specific feature.

```typescript
hasFeature(feature: string): boolean
```

**Example:**

```typescript
if (membership.hasFeature('advanced_analytics')) {
  // Plan includes advanced analytics
}
```

#### `checkQuota(limitSlug, increment?)`

Check quota for a specific limit.

```typescript
checkQuota(limitSlug: string, increment?: number): {
  allowed: boolean
  remaining: number
}
```

**Example:**

```typescript
const quota = membership.checkQuota('projects', 1)
if (!quota.allowed) {
  // Quota would be exceeded
  console.log(`Only ${quota.remaining} projects remaining`)
}
```

#### `canPerformAction(action, options?)`

Comprehensive authorization check.

```typescript
canPerformAction(
  action: string,
  options?: { incrementQuota?: number }
): ActionResult
```

**Checks performed (in order):**
1. Membership - user has a role
2. Subscription status - active or trialing
3. Permission - RBAC check
4. Feature - plan-based (if mapped)
5. Quota - usage limits (if mapped)

**Example:**

```typescript
const result = membership.canPerformAction('customers.create')

if (!result.allowed) {
  return Response.json({
    error: result.message,
    reason: result.reason,
    meta: result.meta,
  }, { status: 403 })
}

// Proceed with action
```

---

## Types

### MembershipSubscription

```typescript
interface MembershipSubscription {
  id: string
  planSlug: string
  planName: string
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused' | 'expired'
  trialEndsAt: Date | null
  currentPeriodEnd: Date | null
}
```

### QuotaState

```typescript
interface QuotaState {
  used: number
  limit: number
  unlimited: boolean
  remaining: number
}
```

### ActionResult

```typescript
type ActionResult =
  | { allowed: true }
  | {
      allowed: false
      reason: ActionDeniedReason
      message: string
      meta?: Record<string, unknown>
    }

type ActionDeniedReason =
  | 'not_member'
  | 'permission_denied'
  | 'feature_disabled'
  | 'quota_exceeded'
  | 'subscription_inactive'
```

---

## Complete Example

```typescript
import { MembershipService } from '@/core/lib/services'

export async function POST(req: Request) {
  const { userId, teamId } = await getAuthContext(req)

  // Get membership context
  const membership = await MembershipService.get(userId, teamId)

  // Check if action is allowed
  const result = membership.canPerformAction('customers.create')

  if (!result.allowed) {
    return Response.json({
      success: false,
      error: result.message,
      reason: result.reason,
      meta: result.meta,
    }, { status: 403 })
  }

  // Check specific quota (optional)
  const quota = membership.checkQuota('customers', 1)
  if (!quota.allowed) {
    return Response.json({
      success: false,
      error: 'Customer limit reached',
      reason: 'quota_exceeded',
      meta: { remaining: quota.remaining },
    }, { status: 403 })
  }

  // Proceed with creation
  const customer = await createCustomer(data)

  return Response.json({ success: true, data: customer })
}
```
