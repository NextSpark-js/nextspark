---
title: API Reference
description: Billing API endpoints and server actions
---

# API Reference

This document covers all billing-related API endpoints and server actions.

## API Endpoints

### Check Action Permission

Verify if a user can perform an action (RBAC + Feature + Quota).

```
POST /api/v1/billing/check-action
```

**Request:**

```json
{
  "action": "projects.create",
  "teamId": "optional-team-id"
}
```

**Response (Success):**

```json
{
  "success": true,
  "data": {
    "allowed": true,
    "quota": {
      "allowed": true,
      "current": 12,
      "max": 50,
      "remaining": 38,
      "percentUsed": 24
    }
  }
}
```

**Response (Denied):**

```json
{
  "success": true,
  "data": {
    "allowed": false,
    "reason": "quota_exceeded",
    "quota": {
      "allowed": false,
      "current": 50,
      "max": 50,
      "remaining": 0,
      "percentUsed": 100
    }
  }
}
```

**Denial Reasons:**
- `no_permission` - RBAC check failed
- `feature_not_in_plan` - Plan doesn't include required feature
- `quota_exceeded` - Usage limit reached

---

### Get Team Subscription

Get active subscription for a team.

```
GET /api/v1/teams/{teamId}/subscription
```

**Response:**

```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "sub_123",
      "teamId": "team_456",
      "status": "active",
      "currentPeriodStart": "2024-01-01T00:00:00Z",
      "currentPeriodEnd": "2024-02-01T00:00:00Z",
      "plan": {
        "id": "plan_789",
        "slug": "pro",
        "name": "Pro Plan",
        "features": ["basic_analytics", "advanced_analytics"],
        "limits": { "projects": 50, "team_members": 10 }
      }
    }
  }
}
```

---

### Get Team Usage

Get usage statistics for a limit.

```
GET /api/v1/teams/{teamId}/usage/{limitSlug}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "allowed": true,
    "current": 12,
    "max": 50,
    "remaining": 38,
    "percentUsed": 24
  }
}
```

---

### Create Checkout Session (Stripe)

Create a Stripe Checkout session for upgrading.

```
POST /api/v1/billing/checkout
```

**Headers:**
- `x-team-id` (optional) - Team ID, defaults to user's default team

**Request:**

```json
{
  "planSlug": "pro",
  "billingPeriod": "monthly"
}
```

> **Note:** Success and cancel URLs are generated server-side based on `NEXT_PUBLIC_APP_URL`.

**Response:**

```json
{
  "success": true,
  "data": {
    "url": "https://checkout.stripe.com/c/pay/cs_test_...",
    "sessionId": "cs_test_..."
  }
}
```

---

### Get Available Plans

Get all public plans for display.

```
GET /api/v1/billing/plans
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "slug": "free",
      "name": "Free",
      "type": "free",
      "price": { "monthly": 0, "yearly": 0 },
      "features": ["basic_analytics"],
      "limits": { "team_members": 3, "projects": 5 }
    },
    {
      "slug": "pro",
      "name": "Pro",
      "type": "paid",
      "price": { "monthly": 2900, "yearly": 29000 },
      "features": ["basic_analytics", "advanced_analytics", "api_access"],
      "limits": { "team_members": 10, "projects": 50 }
    }
  ]
}
```

---

### Create Customer Portal Session

Create a Stripe Customer Portal session for billing management.

```
POST /api/v1/billing/portal
```

**Headers:**
- `x-team-id` (optional) - Team ID, defaults to user's default team

**Request Body:** None required (return URL generated server-side)

**Response:**

```json
{
  "success": true,
  "data": {
    "url": "https://billing.stripe.com/p/session/..."
  }
}
```

**Errors:**
- `400` - No billing account found (team hasn't subscribed yet)
- `403` - Insufficient permissions (requires `team.billing.manage` - owner only)

---

### Cancel Subscription

Cancel the team's subscription (soft cancel at period end or immediate).

```
POST /api/v1/billing/cancel
```

**Headers:**
- `x-team-id` (optional) - Team ID, defaults to user's default team

**Request (Cancel):**

```json
{
  "immediate": false,
  "reason": "Optional cancellation reason"
}
```

**Request (Reactivate):**

```json
{
  "action": "reactivate"
}
```

**Response (Cancel):**

```json
{
  "success": true,
  "data": {
    "canceledAt": null,
    "cancelAtPeriodEnd": true,
    "periodEnd": "2024-02-01T00:00:00.000Z",
    "message": "Subscription will cancel at the end of the current billing period"
  }
}
```

**Response (Reactivate):**

```json
{
  "success": true,
  "data": {
    "reactivated": true,
    "message": "Subscription reactivated successfully"
  }
}
```

**Errors:**
- `403` - Insufficient permissions (requires `team.billing.manage` - owner only)
- `404` - No active subscription found
- `400` - Subscription is not scheduled for cancellation (reactivate only)

---

### Change Plan

Upgrade or downgrade the team's subscription plan with proration.

```
POST /api/v1/billing/change-plan
```

**Headers:**
- `x-team-id` (optional) - Team ID, defaults to user's default team

**Request:**

```json
{
  "planSlug": "pro",
  "billingInterval": "monthly"
}
```

**Response (Success):**

```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "sub_123",
      "planId": "plan_456",
      "status": "active",
      "plan": { "slug": "pro", "name": "Pro Plan" }
    },
    "warnings": ["You have 150 contacts but new plan allows 100. Excess will be read-only."]
  }
}
```

**Behavior:**
- **Upgrade:** Immediate access to new features, prorated charge
- **Downgrade:** Allowed with warnings (soft limit policy), prorated credit
- Stripe handles proration automatically (`proration_behavior: 'create_prorations'`)

**Errors:**
- `403` - Insufficient permissions (requires `team.billing.manage` - owner only)
- `400` - No active subscription / Plan not found / No Stripe price configured

---

### Stripe Webhooks

Handle Stripe webhook events.

```
POST /api/v1/billing/webhooks/stripe
```

**Headers:**
- `stripe-signature` - Webhook signature for verification

**Handled Events:**
- `checkout.session.completed` - Subscription created
- `invoice.paid` - Payment successful
- `invoice.payment_failed` - Payment failed
- `customer.subscription.updated` - Subscription changed
- `customer.subscription.deleted` - Subscription canceled

---

### Billing Lifecycle Cron

Scheduled job for subscription lifecycle management.

```
GET /api/cron/billing/lifecycle
```

**Headers:**
- `Authorization: Bearer {CRON_SECRET}`

**Tasks:**
- Expire trials past `trialEndsAt`
- Handle `past_due` grace period (3 days)
- Reset monthly usage counters (1st of month)

**Response:**

```json
{
  "success": true,
  "processed": 5,
  "errors": [],
  "details": {
    "expireTrials": { "processed": 2, "errors": [] },
    "pastDueGrace": { "processed": 1, "errors": [] },
    "resetUsage": { "processed": 2, "errors": [] }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Server-Side Services

The billing system uses a service layer for all server-side operations. Import from `@/core/lib/services`.

### MembershipService

Unified membership context combining role, subscription, features, and quotas.

```typescript
import { MembershipService } from '@/core/lib/services'

// Get complete membership context
const membership = await MembershipService.get(userId, teamId)

// Check role hierarchy
membership.hasMinHierarchy(50)  // Admin or higher

// Check specific role
membership.hasRole('admin')

// Check permission (RBAC)
membership.hasPermission('customers.delete')

// Check feature (plan-based)
membership.hasFeature('api_access')

// Check quota
const quota = membership.checkQuota('projects')
// { allowed: boolean, remaining: number }

// Unified action check (RBAC + Feature + Quota + Subscription status)
const result = membership.canPerformAction('projects.create')
// {
//   allowed: boolean,
//   reason?: 'not_member' | 'subscription_inactive' | 'permission_denied' | ...
//   message?: string,
//   meta?: { requiredPermission, userRole, ... }
// }
```

### SubscriptionService

Subscription management operations.

```typescript
import { SubscriptionService } from '@/core/lib/services'

// Get active subscription
const subscription = await SubscriptionService.getActive(teamId)

// Check feature
const hasAPI = await SubscriptionService.hasFeature(teamId, 'api_access')

// Check quota
const quota = await SubscriptionService.checkQuota(teamId, 'projects')

// Change plan
const result = await SubscriptionService.changePlan(teamId, 'pro', 'monthly')
// { success, subscription?, downgradeWarnings?, error? }
```

### PlanService

Plan configuration and queries.

```typescript
import { PlanService } from '@/core/lib/services'

// Get all public plans
const plans = await PlanService.list()

// Get plan by slug
const plan = await PlanService.getBySlug('pro')

// Get plan config from registry
const config = PlanService.getConfig('pro')
```

### UsageService

Usage tracking and reporting.

```typescript
import { UsageService } from '@/core/lib/services'

// Track usage
await UsageService.track({
  teamId: 'team_123',
  userId: 'user_456',
  limitSlug: 'projects',
  delta: 1,  // +1 for create, -1 for delete
  action: 'projects.create',
  resourceType: 'project',
  resourceId: 'proj_789'
})

// Get team usage summary
const summary = await UsageService.getTeamSummary(teamId, '2024-01')

// Get top consumers
const top = await UsageService.getTopConsumers(teamId, 'api_calls', '2024-01', 5)
```

---

## Types

### QuotaInfo

```typescript
interface QuotaInfo {
  allowed: boolean      // Can perform action
  current: number       // Current usage
  max: number           // Maximum allowed (-1 = unlimited)
  remaining: number     // max - current
  percentUsed: number   // 0-100
}
```

### CanPerformActionResult

```typescript
interface CanPerformActionResult {
  allowed: boolean
  reason?: 'no_permission' | 'feature_not_in_plan' | 'quota_exceeded'
  quota?: QuotaInfo
}
```

### SubscriptionStatus

```typescript
type SubscriptionStatus =
  | 'trialing'   // In trial period
  | 'active'     // Paid and active
  | 'past_due'   // Payment failed
  | 'canceled'   // User canceled
  | 'paused'     // Temporarily paused
  | 'expired'    // Trial ended without payment
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message"
}
```

**HTTP Status Codes:**
- `400` - Bad request (validation error)
- `401` - Unauthorized (no auth)
- `403` - Forbidden (insufficient permissions)
- `404` - Not found
- `500` - Server error

---

## Authentication

All billing endpoints use [Dual Authentication](../05-api/):

- **Session Auth:** For browser requests (cookies)
- **API Key Auth:** For programmatic access (`Authorization: Bearer sk_...`)

```typescript
// Both work
fetch('/api/v1/billing/check-action', {
  method: 'POST',
  credentials: 'include',  // Session auth
  body: JSON.stringify({ action: 'projects.create' })
})

fetch('/api/v1/billing/check-action', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_live_...'  // API key auth
  },
  body: JSON.stringify({ action: 'projects.create' })
})
```

## Related

- [Payment Integration](./05-payment-integration.md) - Stripe setup
- [Usage Tracking](./06-usage-tracking.md) - Tracking usage
- [Hooks & Context](./03-hooks-context.md) - Frontend integration
