---
name: billing-subscriptions
description: |
  Billing and subscription system for this Next.js application.
  Covers Stripe integration, plans configuration, checkout flow, customer portal, webhooks, and usage tracking.
  Use this skill when implementing billing features or working with subscription management.
allowed-tools: Read, Glob, Grep
version: 1.0.0
---

# Billing & Subscriptions Skill

Patterns for working with the Stripe-based billing system, subscription management, and usage tracking.

## Architecture Overview

```
BILLING ARCHITECTURE:

Configuration Layer:
contents/themes/{theme}/config/billing.config.ts
├── provider: 'stripe' | 'paddle' | 'lemonsqueezy'
├── currency: 'usd' | 'eur' | ...
├── defaultPlan: 'free'
├── features: { featureSlug: FeatureDefinition }
├── limits: { limitSlug: LimitDefinition }
├── plans: PlanDefinition[]
└── actionMappings: ActionMappings

Core Library:
core/lib/billing/
├── config-types.ts      # BillingConfig interface
├── types.ts             # PlanType, SubscriptionStatus, etc.
├── schema.ts            # Zod validation schemas
├── gateways/
│   └── stripe.ts        # Stripe SDK wrapper
├── queries.ts           # Database queries
├── enforcement.ts       # Limit/feature enforcement
├── helpers.ts           # Utility functions
└── jobs.ts              # Background jobs

Services Layer:
core/lib/services/
├── subscription.service.ts  # Subscription CRUD
├── plan.service.ts          # Plan management
└── usage.service.ts         # Usage tracking

API Endpoints:
app/api/v1/billing/
├── checkout/route.ts    # Create Stripe checkout session
├── portal/route.ts      # Customer portal access
├── plans/route.ts       # List available plans
├── cancel/route.ts      # Cancel subscription
├── change-plan/route.ts # Upgrade/downgrade
├── check-action/route.ts # Permission check
└── webhooks/stripe/route.ts # Stripe webhooks
```

## When to Use This Skill

- Implementing billing features
- Working with subscription management
- Configuring plans and features
- Setting up Stripe webhooks
- Implementing usage limits
- Testing billing flows

## Three-Layer Permission Model

The billing system uses a three-layer model:

```
RESULT = Permission (RBAC) AND Feature (Plan) AND Quota (Limits)
```

### Layer 1: RBAC Permissions

```typescript
// Team role-based access
actionMappings: {
  permissions: {
    'team.billing.manage': 'team.billing.manage',
    'team.settings.edit': 'team.settings.edit',
  }
}
```

### Layer 2: Plan Features

```typescript
// Feature access based on subscription plan
features: {
  advanced_analytics: {
    name: 'billing.features.advanced_analytics',
    description: 'billing.features.advanced_analytics_description',
  },
  api_access: {
    name: 'billing.features.api_access',
  },
}

// Feature requirements per action
actionMappings: {
  features: {
    'analytics.view_advanced': 'advanced_analytics',
    'api.generate_key': 'api_access',
  }
}
```

### Layer 3: Usage Limits (Quotas)

```typescript
// Limit definitions
limits: {
  team_members: {
    name: 'billing.limits.team_members',
    unit: 'count',
    resetPeriod: 'never',
  },
  api_calls: {
    name: 'billing.limits.api_calls',
    unit: 'calls',
    resetPeriod: 'monthly',
  },
}

// Limit consumption per action
actionMappings: {
  limits: {
    'team.members.invite': 'team_members',
    'api.call': 'api_calls',
  }
}
```

## Plans Configuration

### Plan Definition Structure

```typescript
// contents/themes/default/config/billing.config.ts
import type { BillingConfig } from '@/core/lib/billing/config-types'

export const billingConfig: BillingConfig = {
  provider: 'stripe',
  currency: 'usd',
  defaultPlan: 'free',

  plans: [
    {
      slug: 'free',
      name: 'billing.plans.free.name',         // i18n key
      description: 'billing.plans.free.description',
      type: 'free',
      visibility: 'public',
      price: { monthly: 0, yearly: 0 },        // in cents
      trialDays: 0,
      features: ['basic_analytics'],
      limits: {
        team_members: 3,
        tasks: 50,
        api_calls: 1000,
      },
      stripePriceIdMonthly: null,
      stripePriceIdYearly: null,
    },
    {
      slug: 'pro',
      name: 'billing.plans.pro.name',
      type: 'paid',
      visibility: 'public',
      price: {
        monthly: 2900,   // $29.00
        yearly: 29000,   // $290.00 (16% savings)
      },
      trialDays: 14,
      features: [
        'basic_analytics',
        'advanced_analytics',
        'api_access',
        'priority_support',
      ],
      limits: {
        team_members: 15,
        tasks: 1000,
        api_calls: 100000,
      },
      stripePriceIdMonthly: 'price_pro_monthly',
      stripePriceIdYearly: 'price_pro_yearly',
    },
    {
      slug: 'enterprise',
      name: 'billing.plans.enterprise.name',
      type: 'enterprise',
      visibility: 'hidden',
      features: ['*'],                          // All features
      limits: {
        team_members: -1,                       // Unlimited
        tasks: -1,
        api_calls: -1,
      },
    },
  ],
}
```

### Plan Types

```typescript
type PlanType = 'free' | 'paid' | 'enterprise'
type PlanVisibility = 'public' | 'hidden'
```

## Team-Based Subscriptions

Subscriptions are tied to teams, not users:

```typescript
// Database schema: subscriptions table
{
  id: string
  teamId: string           // Subscription belongs to team
  planId: string           // Current plan
  status: SubscriptionStatus
  billingInterval: 'monthly' | 'yearly'
  externalSubscriptionId?: string  // Stripe subscription ID
  externalCustomerId?: string      // Stripe customer ID
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
}

// Status values
type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | 'paused'
```

## Checkout Flow

### Create Checkout Session

```typescript
// app/api/v1/billing/checkout/route.ts
import { createCheckoutSession } from '@/core/lib/billing/gateways/stripe'

export async function POST(request: NextRequest) {
  // 1. Authenticate request
  const authResult = await authenticateRequest(request)

  // 2. Validate request body
  const { planSlug, billingPeriod } = checkoutSchema.parse(body)

  // 3. Check permissions (team.billing.manage)
  const membership = await MembershipService.get(userId, teamId)
  const actionResult = membership.canPerformAction('billing.checkout')

  if (!actionResult.allowed) {
    return Response.json({ error: actionResult.message }, { status: 403 })
  }

  // 4. Create Stripe checkout session
  const session = await createCheckoutSession({
    teamId,
    planSlug,
    billingPeriod,
    successUrl: `${appUrl}/dashboard/settings/billing?success=true`,
    cancelUrl: `${appUrl}/dashboard/settings/billing?canceled=true`,
    customerEmail: user.email,
    customerId: existingCustomerId,
  })

  return Response.json({
    success: true,
    data: { url: session.url, sessionId: session.id }
  })
}
```

### Stripe Checkout Session

```typescript
// core/lib/billing/gateways/stripe.ts
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function createCheckoutSession(params: CheckoutParams) {
  const { teamId, planSlug, billingPeriod, successUrl, cancelUrl } = params

  // Get plan from registry
  const plan = BILLING_REGISTRY.getPlan(planSlug)
  const priceId = billingPeriod === 'yearly'
    ? plan.stripePriceIdYearly
    : plan.stripePriceIdMonthly

  return stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: teamId,
    metadata: { teamId, planSlug, billingPeriod },
  })
}
```

## Customer Portal

```typescript
// app/api/v1/billing/portal/route.ts
import { createPortalSession } from '@/core/lib/billing/gateways/stripe'

export async function POST(request: NextRequest) {
  // 1. Authenticate and get team subscription
  const subscription = await SubscriptionService.getActive(teamId)

  // 2. Create portal session
  const portalSession = await createPortalSession({
    customerId: subscription.externalCustomerId,
    returnUrl: `${appUrl}/dashboard/settings/billing`,
  })

  return Response.json({
    success: true,
    data: { url: portalSession.url }
  })
}
```

## Webhook Handling

### Stripe Webhook Endpoint

```typescript
// app/api/v1/billing/webhooks/stripe/route.ts
import { verifyWebhookSignature } from '@/core/lib/billing/gateways/stripe'

export async function POST(request: NextRequest) {
  // 1. Verify webhook signature (MANDATORY)
  const payload = await request.text()
  const signature = request.headers.get('stripe-signature')
  const event = verifyWebhookSignature(payload, signature!)

  // 2. Check for duplicate events (idempotency)
  const existing = await queryOne(
    `SELECT id FROM billing_events WHERE metadata->>'stripeEventId' = $1`,
    [event.id]
  )
  if (existing) return Response.json({ received: true, status: 'duplicate' })

  // 3. Handle events
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object)
      break
    case 'invoice.paid':
      await handleInvoicePaid(event.data.object)
      break
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object)
      break
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object)
      break
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object)
      break
  }

  return Response.json({ received: true })
}
```

### Key Webhook Events

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create/update subscription with Stripe IDs |
| `invoice.paid` | Update period dates, sync invoice |
| `invoice.payment_failed` | Mark subscription as `past_due` |
| `customer.subscription.updated` | Sync status and plan changes |
| `customer.subscription.deleted` | Mark subscription as `canceled` |

### Webhook Security

```typescript
// CRITICAL: Always verify webhook signatures
export function verifyWebhookSignature(
  payload: string,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret)
}

// NOTE: Webhooks bypass RLS (no user context)
// Use direct query() calls, not queryWithRLS()
```

## Usage Tracking

### Usage Service

```typescript
// core/lib/services/usage.service.ts
export class UsageService {
  static async trackUsage(
    teamId: string,
    limitSlug: string,
    amount: number = 1
  ): Promise<void> {
    await query(
      `INSERT INTO billing_usage (team_id, limit_slug, amount, period)
       VALUES ($1, $2, $3, date_trunc('month', NOW()))
       ON CONFLICT (team_id, limit_slug, period)
       DO UPDATE SET amount = billing_usage.amount + $3`,
      [teamId, limitSlug, amount]
    )
  }

  static async getUsage(teamId: string, limitSlug: string): Promise<number> {
    const result = await queryOne<{ amount: number }>(
      `SELECT COALESCE(SUM(amount), 0) as amount
       FROM billing_usage
       WHERE team_id = $1 AND limit_slug = $2
         AND period = date_trunc('month', NOW())`,
      [teamId, limitSlug]
    )
    return result?.amount || 0
  }

  static async checkLimit(
    teamId: string,
    limitSlug: string
  ): Promise<{ allowed: boolean; current: number; limit: number }> {
    const current = await this.getUsage(teamId, limitSlug)
    const limit = await this.getLimitForTeam(teamId, limitSlug)

    return {
      allowed: limit === -1 || current < limit,  // -1 = unlimited
      current,
      limit,
    }
  }
}
```

### Check Action Before Performing

```typescript
// app/api/v1/billing/check-action/route.ts
export async function POST(request: NextRequest) {
  const { action } = await request.json()

  const membership = await MembershipService.get(userId, teamId)
  const result = membership.canPerformAction(action)

  return Response.json({
    success: true,
    data: {
      allowed: result.allowed,
      reason: result.reason,
      meta: result.meta,  // { current, limit, limitSlug }
    }
  })
}
```

## Database Schema

### Why Plans/Subscriptions Use Inline JSONB (NOT Separate Meta Tables)

Unlike regular entities that use `{entity}_metas` tables, billing entities store metadata **inline** as JSONB columns:

| Entity Pattern | Storage | Why |
|----------------|---------|-----|
| Regular entities (`products`, `tasks`) | Separate `{entity}_metas` table | Dynamic, user-extensible, plugin-specific data |
| `plans` | Inline `features JSONB`, `limits JSONB` | Fixed structure, defined in config, read-heavy |
| `subscriptions` | No metas needed | All data is structured and predefined |

**Reasons for inline JSONB in billing:**

1. **Performance:** Plan lookups are extremely frequent (every permission check). Separate table = extra JOIN.
2. **Fixed schema:** Features/limits are defined in `billing.config.ts`, not user-extensible.
3. **Config-driven:** Plans are synced from config to DB, not created dynamically.
4. **Read-heavy:** Plans are read thousands of times per write. Inline is 10x faster.

```typescript
// CORRECT for plans: Inline JSONB
features: JSONB DEFAULT '[]'    // Array of feature slugs
limits: JSONB DEFAULT '{}'      // { limitSlug: value }

// WRONG for plans: Separate meta table
// plans_metas table would add unnecessary complexity
```

**When to use separate metas vs inline JSONB:**

| Use Separate `{entity}_metas` | Use Inline JSONB |
|-------------------------------|------------------|
| User can add arbitrary keys | Fixed, known keys |
| Plugins need to store data | Core-only data |
| Searchable by meta key/value | Rarely searched by meta |
| Low read frequency | Very high read frequency |

### Migrations

```sql
-- 012_billing_plans.sql
CREATE TABLE plans (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type plan_type NOT NULL DEFAULT 'free',
  visibility plan_visibility NOT NULL DEFAULT 'public',
  "priceMonthly" INTEGER DEFAULT 0,
  "priceYearly" INTEGER DEFAULT 0,
  "trialDays" INTEGER DEFAULT 0,
  features JSONB DEFAULT '[]',       -- Inline meta: array of feature slugs
  limits JSONB DEFAULT '{}',         -- Inline meta: { limitSlug: number }
  "stripePriceIdMonthly" TEXT,
  "stripePriceIdYearly" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 013_billing_subscriptions.sql
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "teamId" TEXT REFERENCES teams(id) ON DELETE CASCADE,
  "planId" TEXT REFERENCES plans(id),
  status subscription_status NOT NULL DEFAULT 'active',
  "billingInterval" TEXT DEFAULT 'monthly',
  "externalSubscriptionId" TEXT,
  "externalCustomerId" TEXT,
  "currentPeriodStart" TIMESTAMPTZ,
  "currentPeriodEnd" TIMESTAMPTZ,
  "cancelAtPeriodEnd" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);
-- NOTE: No subscriptions_metas table - all data is structured

-- 014_billing_usage.sql
CREATE TABLE billing_usage (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "teamId" TEXT REFERENCES teams(id) ON DELETE CASCADE,
  "limitSlug" TEXT NOT NULL,
  amount INTEGER DEFAULT 0,
  period DATE NOT NULL,
  UNIQUE("teamId", "limitSlug", period)
);
```

## Environment Variables

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (from billing.config.ts)
# These are set in the plan definitions, not env vars
```

## Registry Integration

```typescript
// core/lib/registries/billing-registry.ts
// Auto-generated - DO NOT EDIT

export const BILLING_REGISTRY = {
  config: billingConfig,

  getPlan(slug: string): PlanDefinition | undefined,
  getFeature(slug: string): FeatureDefinition | undefined,
  getLimit(slug: string): LimitDefinition | undefined,

  // Pre-computed matrices for O(1) lookups
  planFeatureMatrix: Map<string, Set<string>>,
  planLimitMatrix: Map<string, Map<string, number>>,
}
```

## Anti-Patterns

```typescript
// NEVER: Hardcode plan prices in frontend
const price = '$29.00'

// CORRECT: Use plan config
const plan = BILLING_REGISTRY.getPlan('pro')
const price = formatCurrency(plan.price.monthly / 100)

// NEVER: Check plan features manually
if (plan.slug === 'pro' || plan.slug === 'business')

// CORRECT: Use feature checks
const hasFeature = membership.hasFeature('advanced_analytics')

// NEVER: Skip webhook signature verification
const event = JSON.parse(payload)  // UNSAFE!

// CORRECT: Always verify signatures
const event = verifyWebhookSignature(payload, signature)

// NEVER: Use RLS queries in webhooks (no user context)
await queryWithRLS(userId, teamId, sql)

// CORRECT: Use direct queries in webhooks
await query(sql, params)

// NEVER: Store prices in dollars (use cents)
price: { monthly: 29.00 }  // Wrong!

// CORRECT: Store prices in cents
price: { monthly: 2900 }   // $29.00

// NEVER: Forget to handle -1 (unlimited)
if (current >= limit) return false

// CORRECT: Check for unlimited
if (limit === -1) return true
if (current >= limit) return false
```

## Checklist

Before finalizing billing implementation:

- [ ] Stripe API keys configured in environment
- [ ] Webhook endpoint configured in Stripe dashboard
- [ ] Webhook secret configured in environment
- [ ] Plans defined in `billing.config.ts` with Stripe price IDs
- [ ] Features and limits defined
- [ ] Action mappings configured (permissions, features, limits)
- [ ] Team-based subscription created on team creation
- [ ] Checkout flow tested (monthly and yearly)
- [ ] Portal flow tested
- [ ] All webhook events handled and tested
- [ ] Usage tracking implemented for metered limits
- [ ] Limit enforcement working
- [ ] Invoice sync working
- [ ] Translations added for plan names/descriptions
- [ ] Error handling for failed payments

## Related Skills

- `permissions-system` - RBAC integration
- `entity-api` - API patterns for billing endpoints
- `service-layer` - Service class patterns
- `database-migrations` - Billing table migrations
