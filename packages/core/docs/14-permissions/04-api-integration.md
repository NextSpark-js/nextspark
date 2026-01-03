# API Integration Guide

**Version:** 2.0
**Last Updated:** 2025-12-26

---

## Overview

This guide shows how to integrate the permission system into API routes.

## Basic Pattern

```typescript
import { MembershipService } from '@/core/lib/services'
import { requireAuth } from '@/core/lib/api/auth'

export async function POST(req: Request) {
  // 1. Get authenticated user and team
  const { userId, teamId } = await requireAuth(req)

  // 2. Get membership context
  const membership = await MembershipService.get(userId, teamId)

  // 3. Check if action is allowed
  const result = membership.canPerformAction('entity.action')

  // 4. Return 403 if not allowed
  if (!result.allowed) {
    return Response.json({
      success: false,
      error: result.message,
      reason: result.reason,
      meta: result.meta,
    }, { status: 403 })
  }

  // 5. Proceed with business logic
  // ...
}
```

---

## Complete Examples

### Example 1: Simple Permission Check

```typescript
// app/api/v1/customers/route.ts
import { MembershipService } from '@/core/lib/services'
import { requireAuth } from '@/core/lib/api/auth'

export async function POST(req: Request) {
  const { userId, teamId } = await requireAuth(req)
  const body = await req.json()

  // Get membership and check permission
  const membership = await MembershipService.get(userId, teamId)
  const result = membership.canPerformAction('customers.create')

  if (!result.allowed) {
    return Response.json({
      success: false,
      error: result.message,
      reason: result.reason,
      meta: result.meta,
    }, { status: 403 })
  }

  // Create customer
  const customer = await CustomerService.create(teamId, body)

  return Response.json({ success: true, data: customer })
}
```

### Example 2: Hierarchy Check for Admin Actions

```typescript
// app/api/v1/teams/[teamId]/members/[memberId]/route.ts
import { MembershipService } from '@/core/lib/services'
import { requireAuth } from '@/core/lib/api/auth'

export async function DELETE(
  req: Request,
  { params }: { params: { teamId: string; memberId: string } }
) {
  const { userId } = await requireAuth(req)
  const { teamId, memberId } = params

  const membership = await MembershipService.get(userId, teamId)

  // Check if user can manage members
  const result = membership.canPerformAction('members.remove')
  if (!result.allowed) {
    return Response.json({
      success: false,
      error: result.message,
      reason: result.reason,
    }, { status: 403 })
  }

  // Check hierarchy - can't remove someone with higher role
  const targetMembership = await MembershipService.get(memberId, teamId)
  if (targetMembership.hierarchy >= membership.hierarchy) {
    return Response.json({
      success: false,
      error: 'Cannot remove a member with equal or higher role',
      reason: 'permission_denied',
    }, { status: 403 })
  }

  // Remove member
  await TeamMemberService.remove(teamId, memberId)

  return Response.json({ success: true })
}
```

### Example 3: Feature + Quota Check

```typescript
// app/api/v1/teams/[teamId]/projects/route.ts
import { MembershipService } from '@/core/lib/services'
import { requireAuth } from '@/core/lib/api/auth'

export async function POST(
  req: Request,
  { params }: { params: { teamId: string } }
) {
  const { userId } = await requireAuth(req)
  const { teamId } = params
  const body = await req.json()

  const membership = await MembershipService.get(userId, teamId)

  // 1. Check permission
  const result = membership.canPerformAction('projects.create')
  if (!result.allowed) {
    return Response.json({
      success: false,
      error: result.message,
      reason: result.reason,
      meta: result.meta,
    }, { status: 403 })
  }

  // 2. Check feature (for advanced project types)
  if (body.type === 'advanced' && !membership.hasFeature('advanced_projects')) {
    return Response.json({
      success: false,
      error: 'Advanced projects require Pro plan',
      reason: 'feature_disabled',
      meta: { requiredFeature: 'advanced_projects' },
    }, { status: 403 })
  }

  // 3. Check quota
  const quota = membership.checkQuota('projects', 1)
  if (!quota.allowed) {
    return Response.json({
      success: false,
      error: `Project limit reached (${quota.remaining} remaining)`,
      reason: 'quota_exceeded',
      meta: {
        limit: 'projects',
        remaining: quota.remaining,
      },
    }, { status: 403 })
  }

  // Create project
  const project = await ProjectService.create(teamId, body)

  return Response.json({ success: true, data: project })
}
```

### Example 4: Billing Routes

```typescript
// app/api/v1/billing/checkout/route.ts
import { MembershipService } from '@/core/lib/services'
import { requireAuth } from '@/core/lib/api/auth'

export async function POST(req: Request) {
  const { userId, teamId } = await requireAuth(req)
  const body = await req.json()

  const membership = await MembershipService.get(userId, teamId)

  // Billing requires admin hierarchy
  const result = membership.canPerformAction('billing.checkout')
  if (!result.allowed) {
    return Response.json({
      success: false,
      error: result.message,
      reason: result.reason,
      meta: result.meta,
    }, { status: 403 })
  }

  // Create Stripe checkout session
  const session = await StripeService.createCheckoutSession(
    teamId,
    body.planSlug,
    body.interval
  )

  return Response.json({ success: true, data: { url: session.url } })
}
```

---

## Error Response Format

All 403 responses should include:

```typescript
{
  success: false,
  error: string,      // Human-readable message
  reason: string,     // ActionDeniedReason
  meta?: object       // Additional context
}
```

### ActionDeniedReason Values

| Reason | When Used |
|--------|-----------|
| `not_member` | User has no role in team |
| `permission_denied` | Role lacks required permission |
| `feature_disabled` | Plan doesn't include feature |
| `quota_exceeded` | Usage limit reached |
| `subscription_inactive` | Subscription is paused/canceled/expired |

---

## Common Patterns

### Pattern 1: Owner-Only Actions

```typescript
if (!membership.hasRole('owner')) {
  return Response.json({
    error: 'Only the team owner can perform this action',
    reason: 'permission_denied',
  }, { status: 403 })
}
```

### Pattern 2: Admin or Higher

```typescript
if (!membership.hasMinHierarchy(50)) {
  return Response.json({
    error: 'Admin access required',
    reason: 'permission_denied',
  }, { status: 403 })
}
```

### Pattern 3: Multiple Permissions

```typescript
// Need ANY of these permissions
if (!membership.hasPermission('customers.create') &&
    !membership.hasPermission('customers.import')) {
  return Response.json({
    error: 'Cannot add customers',
    reason: 'permission_denied',
  }, { status: 403 })
}
```

### Pattern 4: Feature Gating

```typescript
if (!membership.hasFeature('api_access')) {
  return Response.json({
    error: 'API access requires Business plan',
    reason: 'feature_disabled',
    meta: { requiredPlan: 'business' },
  }, { status: 403 })
}
```

---

## Best Practices

1. **Always check membership first** - `canPerformAction()` handles this

2. **Use specific actions** - `customers.create` not just `customers`

3. **Include meta in errors** - Helps frontend show upgrade prompts

4. **Check hierarchy for member management** - Prevent privilege escalation

5. **Combine checks when needed** - Permission + Feature + Quota
