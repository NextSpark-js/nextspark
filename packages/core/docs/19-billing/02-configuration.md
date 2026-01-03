---
title: Billing Configuration
description: How to configure plans, features, limits, and action mappings
---

# Billing Configuration

The billing system is configured via a `billing.config.ts` file in your theme directory.

## Configuration File Location

```
contents/themes/{your-theme}/config/billing.config.ts
```

## Configuration Interface

```typescript
// core/lib/billing/config-types.ts

interface BillingConfig {
  /** Payment provider: stripe, paddle, lemonsqueezy */
  provider: PaymentProvider

  /** Default currency (ISO 4217) */
  currency: string

  /** Default plan slug for new teams */
  defaultPlan: string

  /** Feature definitions */
  features: Record<string, FeatureDefinition>

  /** Limit definitions */
  limits: Record<string, LimitDefinition>

  /** Plan definitions */
  plans: PlanDefinition[]

  /** Action to feature/limit mappings */
  actionMappings: ActionMappings
}
```

## Complete Example

```typescript
// contents/themes/default/config/billing.config.ts

import type { BillingConfig } from '@/core/lib/billing/config-types'

export const billingConfig: BillingConfig = {
  provider: 'stripe',
  currency: 'usd',
  defaultPlan: 'free',

  // ===========================================
  // FEATURE DEFINITIONS
  // ===========================================
  features: {
    basic_analytics: {
      name: 'billing.features.basic_analytics',
      description: 'billing.features.basic_analytics_description',
    },
    advanced_analytics: {
      name: 'billing.features.advanced_analytics',
      description: 'billing.features.advanced_analytics_description',
    },
    api_access: {
      name: 'billing.features.api_access',
      description: 'billing.features.api_access_description',
    },
    custom_branding: {
      name: 'billing.features.custom_branding',
      description: 'billing.features.custom_branding_description',
    },
    sso: {
      name: 'billing.features.sso',
      description: 'billing.features.sso_description',
    },
    priority_support: {
      name: 'billing.features.priority_support',
      description: 'billing.features.priority_support_description',
    },
  },

  // ===========================================
  // LIMIT DEFINITIONS
  // ===========================================
  limits: {
    team_members: {
      name: 'billing.limits.team_members',
      unit: 'count',
      resetPeriod: 'never',  // Permanent limit
    },
    projects: {
      name: 'billing.limits.projects',
      unit: 'count',
      resetPeriod: 'never',
    },
    api_calls: {
      name: 'billing.limits.api_calls',
      unit: 'calls',
      resetPeriod: 'monthly',  // Resets each month
    },
    storage_gb: {
      name: 'billing.limits.storage',
      unit: 'bytes',
      resetPeriod: 'never',
    },
  },

  // ===========================================
  // PLAN DEFINITIONS
  // ===========================================
  plans: [
    {
      slug: 'free',
      name: 'billing.plans.free.name',
      description: 'billing.plans.free.description',
      type: 'free',
      visibility: 'public',
      price: { monthly: 0, yearly: 0 },
      trialDays: 0,
      features: ['basic_analytics'],
      limits: {
        team_members: 3,
        projects: 5,
        api_calls: 1000,
        storage_gb: 1,
      },
      stripePriceIdMonthly: null,
      stripePriceIdYearly: null,
    },
    {
      slug: 'pro',
      name: 'billing.plans.pro.name',
      description: 'billing.plans.pro.description',
      type: 'paid',
      visibility: 'public',
      price: {
        monthly: 2900,   // $29.00
        yearly: 29000,   // $290.00
      },
      trialDays: 14,
      features: [
        'basic_analytics',
        'advanced_analytics',
        'api_access',
        'custom_branding',
      ],
      limits: {
        team_members: 10,
        projects: 50,
        api_calls: 100000,
        storage_gb: 50,
      },
      stripePriceIdMonthly: 'price_1234_monthly',
      stripePriceIdYearly: 'price_1234_yearly',
    },
    {
      slug: 'enterprise',
      name: 'billing.plans.enterprise.name',
      description: 'billing.plans.enterprise.description',
      type: 'enterprise',
      visibility: 'hidden',  // Contact sales
      trialDays: 30,
      features: ['*'],  // All features
      limits: {
        team_members: -1,   // Unlimited
        projects: -1,
        api_calls: -1,
        storage_gb: -1,
      },
      stripePriceIdMonthly: null,  // Custom pricing
      stripePriceIdYearly: null,
    },
  ],

  // ===========================================
  // ACTION MAPPINGS
  // ===========================================
  actionMappings: {
    // RBAC permissions (optional)
    permissions: {
      'team.members.invite': 'team.members.invite',
      'team.settings.edit': 'team.settings.edit',
      'team.billing.manage': 'team.billing.manage',
    },

    // Feature requirements per action
    features: {
      'analytics.view_advanced': 'advanced_analytics',
      'api.generate_key': 'api_access',
      'branding.customize': 'custom_branding',
      'auth.configure_sso': 'sso',
      'support.priority_access': 'priority_support',
    },

    // Limit consumption per action
    limits: {
      'team.members.invite': 'team_members',
      'projects.create': 'projects',
      'api.call': 'api_calls',
      'files.upload': 'storage_gb',
    },
  },
}
```

## Feature Definitions

Features are boolean capabilities that plans can include or exclude.

```typescript
interface FeatureDefinition {
  /** i18n key for feature name */
  name: string
  /** i18n key for description (optional) */
  description?: string
}
```

**Best Practices:**
- Use i18n keys for all strings
- Keep feature slugs lowercase with underscores
- Use descriptive names that explain the capability

## Limit Definitions

Limits are numeric quotas that can reset periodically.

```typescript
interface LimitDefinition {
  /** i18n key for limit name */
  name: string
  /** Unit type for display */
  unit: 'count' | 'bytes' | 'calls'
  /** Reset period for usage tracking */
  resetPeriod: 'never' | 'daily' | 'monthly' | 'yearly'
}
```

### Reset Periods

| Period | Behavior | Use Case |
|--------|----------|----------|
| `never` | Usage accumulates forever | Resources (projects, storage) |
| `daily` | Resets at midnight UTC | Rate limiting |
| `monthly` | Resets on 1st of month | API calls, bandwidth |
| `yearly` | Resets on Jan 1st | Annual quotas |

## Plan Definitions

```typescript
interface PlanDefinition {
  slug: string
  name: string  // i18n key
  description?: string  // i18n key
  type: 'free' | 'paid' | 'enterprise'
  visibility?: 'public' | 'hidden' | 'invite_only'
  price?: {
    monthly: number  // in cents
    yearly: number   // in cents
  }
  trialDays?: number
  features: string[]  // ['*'] for all features
  limits: Record<string, number>  // -1 for unlimited
  stripePriceIdMonthly?: string | null
  stripePriceIdYearly?: string | null
}
```

### Plan Types

| Type | Description |
|------|-------------|
| `free` | No payment required |
| `paid` | Requires payment |
| `enterprise` | Custom pricing, contact sales |

### Plan Visibility

| Visibility | Description |
|------------|-------------|
| `public` | Shown on pricing page |
| `hidden` | Not shown, but accessible via direct link |
| `invite_only` | Requires invitation code |

### Special Values

- **`features: ['*']`** - Plan has access to ALL features
- **`limits: { resource: -1 }`** - Unlimited quota for this limit

## Action Mappings

Action mappings define the relationship between user actions and billing requirements.

### Structure

```typescript
interface ActionMappings {
  permissions?: Record<string, string>  // action → RBAC permission
  features: Record<string, string>      // action → required feature
  limits: Record<string, string>        // action → consumed limit
}
```

### How Mappings Work

When a user performs an action (e.g., `'projects.create'`):

1. **Permission Check:** If `permissions['projects.create']` exists, verify RBAC
2. **Feature Check:** If `features['projects.create']` exists, verify plan feature
3. **Quota Check:** If `limits['projects.create']` exists, verify available quota

### Mapping Examples

```typescript
actionMappings: {
  // Action requires RBAC permission
  permissions: {
    'team.members.invite': 'team.members.invite',
  },

  // Action requires plan feature
  features: {
    'api.generate_key': 'api_access',
  },

  // Action consumes quota
  limits: {
    'projects.create': 'projects',
  },

  // Action can require multiple checks
  // (permission + feature + limit are all checked)
}
```

## Environment Variables

Configure payment provider credentials:

```env
# Stripe (required for paid plans)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cron job protection
CRON_SECRET=your-secure-cron-secret
```

## Stripe Price IDs

Get Price IDs from the Stripe Dashboard:

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/products)
2. Create a Product for each plan
3. Add recurring prices (monthly/yearly)
4. Copy the Price ID (starts with `price_`)

```typescript
{
  slug: 'pro',
  // ...
  stripePriceIdMonthly: 'price_1ABC123monthly',
  stripePriceIdYearly: 'price_1ABC123yearly',
}
```

## Regenerating the Registry

After modifying `billing.config.ts`, regenerate the registry:

```bash
node core/scripts/build/registry.mjs
```

> **Note:** Currently, the billing registry imports directly from the theme. Full build-time generation is planned for a future update.

## Related

- [Pricing Strategies](./07-pricing-strategies.md) - SaaS pricing examples
- [Payment Integration](./05-payment-integration.md) - Stripe setup
- [Registry System](../03-registry-system/) - Build-time configuration
