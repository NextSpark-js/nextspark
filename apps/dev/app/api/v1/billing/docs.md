# Billing API

Manage subscriptions, plans, and billing operations for teams.

## Overview

The Billing API integrates with Stripe to handle subscription management, checkout sessions, plan changes, and customer portal access. All billing operations are scoped to teams.

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** header (for server-to-server requests)

The `x-team-id` header or user's default team is used for team context.

## Endpoints

### List Plans
`GET /api/v1/billing/plans`

Returns available subscription plans. Public plans visible to all, hidden plans only to superadmin.

**Example Response:**
```json
{
  "data": [
    {
      "id": "plan_123",
      "slug": "pro",
      "name": "Pro Plan",
      "description": "For growing teams",
      "priceMonthly": 29,
      "priceYearly": 290,
      "currency": "USD",
      "features": ["unlimited_projects", "api_access"],
      "limits": {
        "team_members": 10,
        "storage_gb": 100
      }
    }
  ]
}
```

### Create Checkout Session
`POST /api/v1/billing/checkout`

Creates a Stripe Checkout session for subscription upgrade. Returns a URL to redirect the user.

**Required Permission:** `billing.checkout` (team owner/admin)

**Request Body:**
```json
{
  "planSlug": "pro",
  "billingPeriod": "monthly"
}
```

**Parameters:**
- `planSlug` (string, required): The plan to subscribe to
- `billingPeriod` (string): "monthly" or "yearly" (default: "monthly")

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://checkout.stripe.com/...",
    "sessionId": "cs_live_..."
  }
}
```

### Open Customer Portal
`GET /api/v1/billing/portal`

Creates a Stripe Customer Portal session for managing payment methods and viewing invoices.

**Required Permission:** `billing.portal` (team owner/admin)

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://billing.stripe.com/..."
  }
}
```

### Change Plan
`POST /api/v1/billing/change-plan`

Change the current subscription to a different plan.

**Required Permission:** `billing.change_plan` (team owner/admin)

**Request Body:**
```json
{
  "planSlug": "enterprise",
  "billingPeriod": "yearly"
}
```

### Cancel Subscription
`POST /api/v1/billing/cancel`

Cancel the current subscription. Cancellation takes effect at the end of the billing period.

**Required Permission:** `billing.cancel` (team owner/admin)

**Response:**
```json
{
  "success": true,
  "data": {
    "canceledAt": "2024-02-01T00:00:00Z",
    "effectiveDate": "2024-02-28T23:59:59Z"
  }
}
```

### Check Action Permission
`POST /api/v1/billing/check-action`

Verify if the current user can perform a specific action based on RBAC, plan features, and quotas.

**Request Body:**
```json
{
  "action": "team.invite_member",
  "teamId": "team_123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "allowed": true,
    "reason": null
  }
}
```

Or if not allowed:
```json
{
  "success": true,
  "data": {
    "allowed": false,
    "reason": "quota_exceeded",
    "message": "Team member limit reached",
    "meta": {
      "limit": 5,
      "current": 5
    }
  }
}
```

### Stripe Webhook
`POST /api/v1/billing/webhooks/stripe`

Handles Stripe webhook events for subscription lifecycle management.

**Note:** This endpoint is called by Stripe, not by your application. It requires Stripe signature verification.

**Handled Events:**
- `checkout.session.completed` - New subscription created
- `customer.subscription.updated` - Plan changed
- `customer.subscription.deleted` - Subscription canceled
- `invoice.paid` - Payment successful
- `invoice.payment_failed` - Payment failed

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters or missing required fields |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions or plan doesn't allow action |
| 404 | Not Found - Plan or subscription not found |
| 500 | Server Error - Stripe API error or internal error |

## Billing Period Proration

When changing plans mid-cycle:
- **Upgrade:** Prorated charge for the difference
- **Downgrade:** Credit applied to next invoice
- **Same price:** No proration

## Test Mode

In development, Stripe test mode is used. Test card numbers:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

## Related APIs

- **[Teams](/api/v1/teams)** - Team subscription and usage endpoints
- **[Teams Subscription](/api/v1/teams/{teamId}/subscription)** - View team's current subscription
- **[Teams Usage](/api/v1/teams/{teamId}/usage/{limit})** - Check quota usage
- **[Teams Invoices](/api/v1/teams/{teamId}/invoices)** - View billing invoices
