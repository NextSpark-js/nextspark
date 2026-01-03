# Migration Guide: Legacy to MembershipService

**Version:** 2.0
**Last Updated:** 2025-12-26

---

## Overview

This guide helps migrate from legacy permission patterns to the new unified `MembershipService` approach.

## Why Migrate?

| Legacy Pattern | Issue |
|----------------|-------|
| Multiple service calls | Performance overhead |
| Inconsistent error handling | Different 403 formats |
| No subscription checks | Missing feature/quota validation |
| `isOwner()` / `isAdminOrOwner()` | Boolean only, no context |

| New Pattern | Benefit |
|-------------|---------|
| Single `MembershipService.get()` | One call, all context |
| Unified `ActionResult` | Consistent error format |
| Full authorization | Permission + Feature + Quota |
| Hierarchy checks | Flexible role comparison |

---

## Migration Table

### TeamMemberService Methods

| Legacy | New |
|--------|-----|
| `TeamMemberService.getRole(teamId, userId)` | `membership.role` |
| `TeamMemberService.isOwner(teamId, userId)` | `membership.hasRole('owner')` |
| `TeamMemberService.isAdminOrOwner(teamId, userId)` | `membership.hasMinHierarchy(50)` |
| `TeamMemberService.isMember(teamId, userId)` | `membership.role !== null` |
| `TeamMemberService.hasPermission(teamId, userId, roles)` | `membership.hasAnyRole(roles)` |

### SubscriptionService Methods

| Legacy | New |
|--------|-----|
| `SubscriptionService.hasFeature(teamId, feature)` | `membership.hasFeature(feature)` |
| `SubscriptionService.checkQuota(teamId, limit)` | `membership.checkQuota(limit)` |
| `SubscriptionService.getActive(teamId)` | `membership.subscription` |
| `SubscriptionService.canPerformAction(userId, teamId, action)` | `membership.canPerformAction(action)` |

---

## Before/After Examples

### Example 1: Admin Check

**Before:**

```typescript
import { TeamMemberService } from '@/core/lib/services'

const isAdmin = await TeamMemberService.isAdminOrOwner(teamId, userId)
if (!isAdmin) {
  return Response.json({ error: 'Forbidden' }, { status: 403 })
}
```

**After:**

```typescript
import { MembershipService } from '@/core/lib/services'

const membership = await MembershipService.get(userId, teamId)
const result = membership.canPerformAction('teams.update')
if (!result.allowed) {
  return Response.json({
    error: result.message,
    reason: result.reason,
    meta: result.meta,
  }, { status: 403 })
}
```

### Example 2: Role Check

**Before:**

```typescript
const role = await TeamMemberService.getRole(teamId, userId)
if (!role) {
  return Response.json({ error: 'Not a member' }, { status: 403 })
}
if (role !== 'owner') {
  return Response.json({ error: 'Owner only' }, { status: 403 })
}
```

**After:**

```typescript
const membership = await MembershipService.get(userId, teamId)
if (!membership.hasRole('owner')) {
  return Response.json({
    error: 'Only the team owner can perform this action',
    reason: 'permission_denied',
  }, { status: 403 })
}
```

### Example 3: Feature Check

**Before:**

```typescript
const subscription = await SubscriptionService.getActive(teamId)
const hasFeature = subscription && hasFeatureHelper(subscription, 'advanced_reports')
if (!hasFeature) {
  return Response.json({ error: 'Upgrade required' }, { status: 403 })
}
```

**After:**

```typescript
const membership = await MembershipService.get(userId, teamId)
if (!membership.hasFeature('advanced_reports')) {
  return Response.json({
    error: 'Advanced reports require Pro plan',
    reason: 'feature_disabled',
    meta: { requiredFeature: 'advanced_reports' },
  }, { status: 403 })
}
```

### Example 4: Quota Check

**Before:**

```typescript
const quota = await SubscriptionService.checkQuota(teamId, 'projects')
if (!quota.allowed) {
  return Response.json({
    error: 'Quota exceeded',
    remaining: quota.remaining
  }, { status: 403 })
}
```

**After:**

```typescript
const membership = await MembershipService.get(userId, teamId)
const quota = membership.checkQuota('projects', 1)
if (!quota.allowed) {
  return Response.json({
    error: 'Project limit reached',
    reason: 'quota_exceeded',
    meta: { remaining: quota.remaining },
  }, { status: 403 })
}
```

### Example 5: Combined Checks

**Before:**

```typescript
// Multiple service calls
const role = await TeamMemberService.getRole(teamId, userId)
const subscription = await SubscriptionService.getActive(teamId)
const isAdmin = role === 'admin' || role === 'owner'
const hasFeature = subscription && hasFeatureHelper(subscription, 'api_access')

if (!role) {
  return Response.json({ error: 'Not a member' }, { status: 403 })
}
if (!isAdmin) {
  return Response.json({ error: 'Admin required' }, { status: 403 })
}
if (!hasFeature) {
  return Response.json({ error: 'Feature not available' }, { status: 403 })
}
```

**After:**

```typescript
// Single service call with comprehensive checks
const membership = await MembershipService.get(userId, teamId)
const result = membership.canPerformAction('api.access')
if (!result.allowed) {
  return Response.json({
    error: result.message,
    reason: result.reason,
    meta: result.meta,
  }, { status: 403 })
}
```

---

## Step-by-Step Migration

### Step 1: Update Imports

```typescript
// Remove
import { TeamMemberService, SubscriptionService } from '@/core/lib/services'

// Add
import { MembershipService } from '@/core/lib/services'
```

### Step 2: Get Membership Context

```typescript
// Replace multiple calls
const role = await TeamMemberService.getRole(teamId, userId)
const subscription = await SubscriptionService.getActive(teamId)

// With single call
const membership = await MembershipService.get(userId, teamId)
```

### Step 3: Update Permission Checks

```typescript
// Replace boolean checks
if (!isAdmin) { /* ... */ }

// With ActionResult checks
const result = membership.canPerformAction('entity.action')
if (!result.allowed) {
  return Response.json({
    error: result.message,
    reason: result.reason,
    meta: result.meta,
  }, { status: 403 })
}
```

### Step 4: Update Error Responses

```typescript
// Replace simple errors
return Response.json({ error: 'Forbidden' }, { status: 403 })

// With structured errors
return Response.json({
  success: false,
  error: result.message,
  reason: result.reason,
  meta: result.meta,
}, { status: 403 })
```

---

## Removed Methods

These methods have been removed from `TeamMemberService`:

| Removed Method | Replacement |
|----------------|-------------|
| `isOwner(teamId, userId)` | `membership.hasRole('owner')` |
| `isAdminOrOwner(teamId, userId)` | `membership.hasMinHierarchy(50)` |

**Note:** `getRole()` and `isMember()` still exist in TeamMemberService for internal use, but prefer MembershipService for API routes.

---

## Hierarchy Reference

| Role | Hierarchy | Check |
|------|-----------|-------|
| owner | 100 | `hasMinHierarchy(100)` |
| admin | 50 | `hasMinHierarchy(50)` |
| member | 10 | `hasMinHierarchy(10)` |
| viewer | 1 | `hasMinHierarchy(1)` |

---

## Checklist

Before completing migration:

- [ ] All `TeamMemberService.isOwner()` calls replaced
- [ ] All `TeamMemberService.isAdminOrOwner()` calls replaced
- [ ] All subscription checks use membership context
- [ ] All 403 responses use `{ error, reason, meta }` format
- [ ] TypeScript compiles without errors
- [ ] API tests pass

---

## Verification

Run these commands to verify migration:

```bash
# Check for legacy patterns
grep -r "isOwner\|isAdminOrOwner" app/api/
# Should return 0 results

# Check MembershipService usage
grep -r "MembershipService.get" app/api/
# Should show all migrated routes

# Verify build
pnpm build

# Run tests
pnpm test
```
