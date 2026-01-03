---
title: Billing System Overview
description: Plans, subscriptions, and usage-based billing for SaaS monetization
---

# Billing System Overview

The Billing System provides comprehensive infrastructure for SaaS monetization, including plans, subscriptions, feature gating, usage tracking, and payment provider integration.

## Core Concepts

### Three-Layer Permission Model

The billing system integrates with the existing RBAC (Role-Based Access Control) to create a **three-layer permission model**:

```
RESULT = Permission (RBAC) AND Feature (Plan) AND Quota (Limits)
```

| Layer | Source | Description |
|-------|--------|-------------|
| **Permission** | Team Role (RBAC) | Does the user's role allow this action? |
| **Feature** | Subscription Plan | Does the plan include this feature? |
| **Quota** | Usage Tracking | Is there available quota for this action? |

**Important:** These three layers are **complementary**, not alternatives. An action is only allowed if ALL three conditions are met. See [Teams Permissions](../10-teams/06-permissions.md) for RBAC details.

### Plans

A **Plan** defines what a team can access:

- **Features:** Boolean capabilities (e.g., "advanced_analytics", "api_access")
- **Limits:** Numeric quotas with optional reset periods (e.g., "5 projects", "1000 API calls/month")
- **Pricing:** Monthly and yearly prices in cents
- **Trial:** Optional trial period in days

```typescript
// Example plan structure
{
  slug: 'pro',
  name: 'Pro Plan',
  type: 'paid',
  features: ['basic_analytics', 'advanced_analytics', 'api_access'],
  limits: {
    team_members: 10,
    projects: 50,
    api_calls: 100000  // monthly reset
  },
  price: {
    monthly: 2900,  // $29.00
    yearly: 29000   // $290.00
  },
  trialDays: 14
}
```

### Subscriptions

A **Subscription** links a team to a plan:

- Always **team-based** (even B2C: 1 user = 1 team)
- One active subscription per team
- Status lifecycle: `trialing` → `active` → `past_due` → `canceled`/`expired`
- Period tracking for billing cycles

### Usage Tracking

The system uses a **hybrid 2-table model**:

| Table | Purpose | Performance |
|-------|---------|-------------|
| `usage` | Aggregate counters for fast checks | O(1) lookup |
| `usageEvents` | Detailed per-user audit trail | Historical data |

This design enables:
- Fast quota checks (< 10ms)
- Detailed usage reports per user
- Usage timeline and analytics

### Action Mappings

Actions are mapped to permissions, features, and limits:

```typescript
actionMappings: {
  // RBAC permissions (optional)
  permissions: {
    'team.members.invite': 'team.members.invite',
    'team.billing.manage': 'team.billing.manage'
  },

  // Feature requirements
  features: {
    'analytics.view_advanced': 'advanced_analytics',
    'api.generate_key': 'api_access'
  },

  // Limit consumption
  limits: {
    'team.members.invite': 'team_members',
    'projects.create': 'projects',
    'api.call': 'api_calls'
  }
}
```

## Architecture

### Core/Theme Separation

The billing system follows the framework's Core/Theme separation:

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **Core** | `core/lib/billing/` | Infrastructure (actions, hooks, types) |
| **Theme** | `contents/themes/*/billing/` | Configuration (plans, features, limits) |

**Core provides:**
- Database schema and actions
- React hooks and context
- API endpoints
- Payment gateway integration
- Lifecycle management

**Theme provides:**
- Plan definitions
- Feature and limit definitions
- Action mappings
- Stripe Price IDs

### Registry Pattern

Configuration is loaded via the registry pattern (no dynamic imports):

```typescript
// Generated at build time
import { BILLING_REGISTRY } from '@/core/lib/registries/billing-registry'

// Access configuration
const plans = BILLING_REGISTRY.plans
const limits = BILLING_REGISTRY.limits
const features = BILLING_REGISTRY.features
```

### Database Schema

Five tables support the billing system:

```
plans ──────────────── subscriptions ──────────────── teams
                            │
                            ├─────── usage
                            ├─────── usageEvents
                            └─────── billingEvents
```

| Table | Purpose |
|-------|---------|
| `plans` | Plan definitions (synced from config) |
| `subscriptions` | Team-to-plan relationships |
| `usage` | Aggregate quota counters |
| `usageEvents` | Detailed usage audit trail |
| `billingEvents` | Payment history and receipts |

## Key Features

### Feature Gating

Control access to features based on plan:

```tsx
// React component
<FeatureGate feature="advanced_analytics">
  <AdvancedAnalyticsChart />
</FeatureGate>

// Hook
const hasAdvanced = useFeature('advanced_analytics')

// Server-side
const hasFeature = await checkFeature(teamId, 'advanced_analytics')
```

### Quota Enforcement

Track and limit resource consumption:

```typescript
// Check before action
const quota = await checkQuota(teamId, 'projects')
if (!quota.allowed) {
  throw new Error('Project limit exceeded')
}

// Track usage
await trackUsage({
  teamId,
  userId,
  limitSlug: 'projects',
  delta: 1,
  action: 'projects.create',
  resourceId: newProject.id
})
```

### Unified Permission Check

The `canPerformAction` function combines all three layers:

```typescript
const result = await canPerformAction(userId, teamId, 'projects.create')

if (!result.allowed) {
  switch (result.reason) {
    case 'no_permission':
      // User lacks RBAC permission
      break
    case 'feature_not_in_plan':
      // Plan doesn't include this feature
      break
    case 'quota_exceeded':
      // Usage limit reached
      break
  }
}
```

### Payment Integration

Stripe integration for real payments:

- **Hosted Checkout:** Redirect to Stripe for payment
- **Customer Portal:** Self-service billing management
- **Webhooks:** Automatic subscription updates
- **Lifecycle Jobs:** Trial expiration, grace periods

## Next Steps

- [Configuration Guide](./02-configuration.md) - Theme billing configuration
- [Hooks & Context](./03-hooks-context.md) - React integration
- [API Reference](./04-api-reference.md) - Endpoint documentation
- [Payment Integration](./05-payment-integration.md) - Stripe setup
- [Usage Tracking](./06-usage-tracking.md) - Quota management
- [Pricing Strategies](./07-pricing-strategies.md) - SaaS examples
- [Technical Reference](./08-technical-reference.md) - File structure

## Related Documentation

- [Teams Permissions](../10-teams/06-permissions.md) - RBAC layer (Layer 1)
- [Registry System](../03-registry-system/) - Configuration loading
- [API Authentication](../05-api/) - Dual auth pattern
