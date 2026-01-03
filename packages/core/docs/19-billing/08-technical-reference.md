---
title: Technical Reference
description: File structure, responsibilities, and implementation details
---

# Technical Reference

This document provides a comprehensive overview of the billing system's file structure and each file's responsibilities.

## File Structure

```
core/
├── lib/
│   └── billing/
│       ├── types.ts           # TypeScript types
│       ├── config-types.ts    # Theme configuration interface
│       ├── schema.ts          # Zod validation schemas
│       ├── helpers.ts         # Pure utility functions
│       ├── actions.ts         # Server-side business logic
│       ├── usage.ts           # Usage tracking functions
│       ├── enforcement.ts     # Downgrade policy enforcement
│       ├── jobs.ts            # Lifecycle cron jobs
│       └── gateways/
│           └── stripe.ts      # Stripe SDK wrapper
│
├── hooks/
│   ├── useSubscription.ts     # Subscription context hook
│   ├── useFeature.ts          # Feature check hook
│   ├── useQuota.ts            # Quota check hook (async)
│   └── useMembership.ts       # Unified billing hook
│
├── contexts/
│   └── SubscriptionContext.tsx  # React context provider
│
├── components/
│   └── billing/
│       ├── FeatureGate.tsx        # Conditional rendering
│       ├── UsageBar.tsx           # Progress bar component
│       ├── UsageDashboard.tsx     # Usage overview
│       ├── PricingTable.tsx       # Plan comparison
│       ├── UpgradeModal.tsx       # Upgrade flow
│       ├── DowngradeWarning.tsx   # Downgrade notice
│       ├── ManageBillingButton.tsx # Portal link
│       ├── SubscriptionStatus.tsx # Status display
│       ├── InvoicesTable.tsx      # Invoice list
│       ├── InvoiceStatusBadge.tsx # Status badge
│       ├── InvoicesEmptyState.tsx # Empty state
│       └── InvoicesPagination.tsx # Pagination
│
├── lib/billing/
│   ├── queries.ts            # Query functions for billing data
│   ├── config-types.ts       # Type definitions for billing config
│   ├── enforcement.ts        # Usage enforcement
│   └── gateways/
│       └── stripe.ts         # Stripe integration
│
└── lib/registries/
    └── billing-registry.ts   # Generated data-only registry

contents/themes/{theme}/
└── billing/
    └── billing.config.ts      # Theme configuration

app/api/
├── v1/billing/
│   ├── check-action/route.ts  # Permission check endpoint
│   ├── checkout/route.ts      # Create checkout session
│   ├── portal/route.ts        # Create portal session
│   ├── cancel/route.ts        # Cancel/reactivate subscription
│   ├── change-plan/route.ts   # Upgrade/downgrade plan
│   ├── plans/route.ts         # List available plans
│   └── webhooks/
│       └── stripe/route.ts    # Stripe webhook handler
│
├── v1/teams/[teamId]/
│   ├── subscription/route.ts  # Get team subscription
│   └── usage/[limitSlug]/route.ts  # Get usage
│
└── cron/billing/
    └── lifecycle/route.ts     # Scheduled lifecycle job
```

---

## Service Layer (Recommended)

> **Migration Note:** Billing logic is being consolidated into the service layer located in `core/lib/services/`. The service layer provides a cleaner, more testable API for all billing operations.

| Service | Purpose | Documentation |
|---------|---------|---------------|
| **PlanService** | Plan queries, registry helpers | [Service Layer](../10-backend/05-service-layer.md#planservice) |
| **SubscriptionService** | Subscriptions, features, quotas | [Service Layer](../10-backend/05-service-layer.md#subscriptionservice) |
| **UsageService** | Usage tracking, trends | [Service Layer](../10-backend/05-service-layer.md#usageservice) |
| **InvoiceService** | Invoice management | [Service Layer](../10-backend/05-service-layer.md#invoiceservice) |

**Example Usage:**

```typescript
import {
  PlanService,
  SubscriptionService,
  UsageService,
  InvoiceService
} from '@/core/lib/services'

// Get subscription with plan
const subscription = await SubscriptionService.getByTeamId(teamId)

// Check feature access
const hasFeature = await SubscriptionService.hasFeature(teamId, 'analytics')

// Check quota
const quota = await SubscriptionService.checkQuota(teamId, 'projects')

// Track usage
await UsageService.increment(subscriptionId, 'api_calls')

// List invoices
const invoices = await InvoiceService.listByTeam(teamId)
```

---

## Billing Queries

Query functions for accessing billing configuration data. These operate on the pre-computed data in `billing-registry.ts`.

**Location:** `core/lib/billing/queries.ts`

**Import:**

```typescript
import {
  planHasFeature,
  getPlanLimit,
  getPlanFeatures,
  getPlanLimits,
  getFullBillingMatrix,
  getPlan,
  getPublicPlans
} from '@/core/lib/billing/queries'
```

**Functions:**

| Function | Description | Complexity |
|----------|-------------|------------|
| `planHasFeature(planSlug, featureSlug)` | Check if plan has a feature | O(1) |
| `getPlanLimit(planSlug, limitSlug)` | Get limit value for a plan | O(1) |
| `getPlanFeatures(planSlug)` | Get all features for a plan | O(n) |
| `getPlanLimits(planSlug)` | Get all limits for a plan | O(n) |
| `getFullBillingMatrix()` | Get complete billing matrix | O(1) |
| `getPlan(slug)` | Get plan by slug | O(n) |
| `getPublicPlans()` | Get public visibility plans | O(1) |

**Example:**

```typescript
import { planHasFeature, getPlanLimit, getPublicPlans } from '@/core/lib/billing/queries'

// Check feature access
const hasAnalytics = planHasFeature('pro', 'analytics')  // true

// Get limit value
const projectLimit = getPlanLimit('pro', 'projects')     // 10

// Get public plans for pricing page
const plans = getPublicPlans()
```

> **Note:** For data-only access (BILLING_REGISTRY, BILLING_MATRIX, etc.), import directly from the registry:
> ```typescript
> import { BILLING_REGISTRY } from '@/core/lib/registries/billing-registry'
> ```

---

## Core Library Files

### types.ts

**Purpose:** TypeScript type definitions for the entire billing system.

**Exports:**

| Type | Description |
|------|-------------|
| `PlanType` | `'free' \| 'paid' \| 'enterprise'` |
| `PlanVisibility` | `'public' \| 'hidden' \| 'invite_only'` |
| `Plan` | Plan entity interface |
| `SubscriptionStatus` | Subscription lifecycle states |
| `Subscription` | Subscription entity interface |
| `SubscriptionWithPlan` | Subscription with joined plan |
| `Usage` | Aggregate usage record |
| `UsageEvent` | Detailed usage event |
| `QuotaInfo` | Quota check result |
| `CanPerformActionResult` | Unified permission result |

**Usage:**

```typescript
import type { Plan, Subscription, QuotaInfo } from '@/core/lib/billing/types'
```

---

### config-types.ts

**Purpose:** Interface that themes must implement for billing configuration.

**Exports:**

| Type | Description |
|------|-------------|
| `FeatureDefinition` | Feature with i18n keys |
| `LimitDefinition` | Limit with reset period |
| `PlanDefinition` | Complete plan configuration |
| `ActionMappings` | Action to permission/feature/limit maps |
| `BillingConfig` | Main configuration interface |

**Usage:**

```typescript
import type { BillingConfig } from '@/core/lib/billing/config-types'

export const billingConfig: BillingConfig = { ... }
```

---

### schema.ts

**Purpose:** Zod schemas for API request validation.

**Exports:**

| Schema | Used For |
|--------|----------|
| `planTypeSchema` | Plan type validation |
| `subscriptionStatusSchema` | Status enum |
| `createPlanSchema` | Creating plans |
| `updatePlanSchema` | Updating plans |
| `createSubscriptionSchema` | Creating subscriptions |
| `trackUsageSchema` | Tracking usage |

**Usage:**

```typescript
import { trackUsageSchema } from '@/core/lib/billing/schema'

const validated = trackUsageSchema.parse(body)
```

---

### helpers.ts

**Purpose:** Pure utility functions with no side effects.

**Exports:**

| Function | Description |
|----------|-------------|
| `getPeriodKey(resetPeriod)` | Generate period key (e.g., '2024-01') |
| `getNextResetDate(resetPeriod)` | Calculate next reset date |
| `calculatePercentUsed(current, max)` | Calculate usage percentage |
| `calculateRemaining(current, max)` | Calculate remaining quota |
| `isSubscriptionActive(status)` | Check if subscription is usable |
| `isInTrial(trialEndsAt)` | Check trial status |
| `getTrialDaysRemaining(trialEndsAt)` | Days left in trial |
| `hasFeature(features, slug)` | Check feature array |
| `formatPrice(cents, currency)` | Format price for display |
| `calculateYearlySavings(monthly, yearly)` | Calculate discount |

**Characteristics:**
- No database calls
- No external dependencies
- Fully testable
- Can be used client or server side

---

### actions.ts

**Purpose:** Server-side business logic for billing operations.

**Exports:**

| Function | Description |
|----------|-------------|
| `getActiveSubscription(teamId)` | Get team's active subscription |
| `getUserSubscription(userId)` | Get user's subscription (B2C) |
| `checkFeature(teamId, featureSlug)` | Check feature access |
| `checkQuota(teamId, limitSlug)` | Check quota availability |
| `canPerformAction(userId, teamId, action)` | Unified 3-layer check |
| `changePlan(teamId, planSlug, interval)` | Upgrade/downgrade plan with proration |
| `getPlans(includeHidden)` | List plans |
| `getPlanBySlug(slug)` | Get plan by slug |
| `getPlanById(id)` | Get plan by ID |

**Key Implementation - canPerformAction:**

```typescript
export async function canPerformAction(
  userId: string,
  teamId: string,
  action: string
): Promise<CanPerformActionResult> {
  // 1. RBAC Check
  const requiredPermission = BILLING_REGISTRY.actionMappings.permissions?.[action]
  if (requiredPermission) {
    const hasPermission = checkTeamPermission(...)
    if (!hasPermission) return { allowed: false, reason: 'no_permission' }
  }

  // 2. Feature Check
  const requiredFeature = BILLING_REGISTRY.actionMappings.features[action]
  if (requiredFeature) {
    const hasFeature = await checkFeature(teamId, requiredFeature)
    if (!hasFeature) return { allowed: false, reason: 'feature_not_in_plan' }
  }

  // 3. Quota Check
  const consumedLimit = BILLING_REGISTRY.actionMappings.limits[action]
  if (consumedLimit) {
    const quota = await checkQuota(teamId, consumedLimit)
    if (!quota.allowed) return { allowed: false, reason: 'quota_exceeded', quota }
    return { allowed: true, quota }
  }

  return { allowed: true }
}
```

---

### usage.ts

**Purpose:** Usage tracking and reporting functions.

**Exports:**

| Function | Description |
|----------|-------------|
| `trackUsage(params)` | Record usage (atomic) |
| `getTeamUsageByUser(teamId, period)` | Usage breakdown by user |
| `getTopConsumers(teamId, limit, period)` | Top users by consumption |
| `getUserUsageTimeline(userId, options)` | User's usage history |
| `getTeamUsageSummary(teamId, period)` | Comprehensive report |

**Transaction Pattern:**

```typescript
export async function trackUsage(params) {
  const tx = await getTransactionClient()
  try {
    await tx.query(`INSERT INTO "usageEvents" ...`)
    await tx.query(`INSERT INTO usage ... ON CONFLICT DO UPDATE`)
    await tx.commit()
  } catch (error) {
    await tx.rollback()
    throw error
  }
}
```

---

### enforcement.ts

**Purpose:** Downgrade policy and quota enforcement.

**Exports:**

| Function | Description |
|----------|-------------|
| `checkDowngrade(teamId, targetPlan)` | Check downgrade impact |
| `checkQuotaWithEnforcement(teamId, limit)` | Enhanced quota with policy |

**Policy:** Soft limit - downgrade always allowed, new resources blocked.

---

### jobs.ts

**Purpose:** Scheduled lifecycle management tasks.

**Exports:**

| Function | Description |
|----------|-------------|
| `expireTrials()` | Expire trials past end date |
| `handlePastDueGracePeriod()` | Handle past_due after grace |
| `resetMonthlyUsage()` | Archive previous month usage |

---

### gateways/stripe.ts

**Purpose:** Stripe SDK wrapper with lazy loading.

**Exports:**

| Function | Description |
|----------|-------------|
| `createCheckoutSession(params)` | Create Stripe Checkout |
| `createPortalSession(params)` | Create Customer Portal |
| `cancelSubscriptionAtPeriodEnd(id)` | Soft cancel at period end |
| `cancelSubscriptionImmediately(id)` | Hard cancel now |
| `reactivateSubscription(id)` | Reverse soft cancel |
| `updateSubscriptionPlan(params)` | Change plan with proration |
| `verifyWebhookSignature(payload, sig)` | Verify webhook |
| `getCustomer(customerId)` | Get Stripe customer |
| `createCustomer(params)` | Create Stripe customer |
| `getStripeInstance()` | Get Stripe SDK |

**Lazy Loading Pattern:**

```typescript
let stripeInstance: Stripe | null = null

function getStripe(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-08-27.basil'
    })
  }
  return stripeInstance
}
```

---

## React Hooks

### useSubscription.ts

Thin wrapper around SubscriptionContext:

```typescript
export function useSubscription() {
  return useSubscriptionContext()
}
```

### useFeature.ts

Check single feature:

```typescript
export function useFeature(featureSlug: string): boolean {
  const { plan, isLoading } = useSubscription()

  if (isLoading || !plan) return false
  if (plan.features.includes('*')) return true

  return plan.features.includes(featureSlug)
}
```

### useQuota.ts

Async quota check with TanStack Query:

```typescript
export function useQuota(limitSlug: string) {
  const { team } = useTeam()

  const { data, isLoading, error, refetch } = useQuery<QuotaInfo>({
    queryKey: ['quota', team?.id, limitSlug],
    queryFn: async () => {
      const response = await fetch(`/api/v1/teams/${team.id}/usage/${limitSlug}`)
      return (await response.json()).data
    },
    enabled: !!team && !!limitSlug,
    staleTime: 1 * 60 * 1000  // 1 minute
  })

  return { ...data, isLoading, error, refetch }
}
```

### useMembership.ts

Unified hook with all billing functionality:

```typescript
export function useMembership() {
  const ctx = useSubscription()

  return {
    // Subscription info
    plan: ctx.plan,
    subscription: ctx.subscription,
    // ...status helpers

    // Sync feature check (cached)
    hasFeature: (slug: string) => ctx.features.includes(slug) || ctx.features.includes('*'),

    // Sync quota info (cached)
    getQuota: (slug: string) => ctx.limits[slug] || null,

    // Async full quota (API call)
    getQuotaAsync: async (slug: string) => { /* fetch */ },

    // Unified permission check
    canDo: async (action: string) => { /* fetch check-action */ },

    refetch: ctx.refetch
  }
}
```

---

## Context Provider

### SubscriptionContext.tsx

```typescript
export function SubscriptionProvider({ children }) {
  const { team } = useTeam()

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscription', team?.id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/teams/${team.id}/subscription`)
      return res.json()
    },
    enabled: !!team,
    staleTime: 5 * 60 * 1000
  })

  // Pre-compute features and limits for sync access
  const features = useMemo(() => {
    const planConfig = BILLING_REGISTRY.plans.find(p => p.slug === subscription?.plan.slug)
    return planConfig?.features ?? []
  }, [subscription])

  const limits = useMemo(() => { /* ... */ }, [subscription])

  return (
    <SubscriptionContext.Provider value={{ subscription, features, limits, ... }}>
      {children}
    </SubscriptionContext.Provider>
  )
}
```

---

## API Routes

### /api/v1/billing/check-action

Unified permission check endpoint:

```typescript
export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request)
  const { action, teamId } = await request.json()

  const result = await canPerformAction(
    authResult.user.id,
    teamId || authResult.user.defaultTeamId,
    action
  )

  return Response.json({ success: true, data: result })
}
```

### /api/v1/billing/webhooks/stripe

Webhook handler with signature verification:

```typescript
export async function POST(request: NextRequest) {
  const payload = await request.text()
  const signature = request.headers.get('stripe-signature')

  // MANDATORY signature verification
  const event = verifyWebhookSignature(payload, signature)

  // Idempotency check
  const existing = await db.query(`SELECT ... WHERE stripeEventId = $1`)
  if (existing) return { received: true, status: 'duplicate' }

  // Handle events
  switch (event.type) { /* ... */ }
}
```

### /api/cron/billing/lifecycle

Protected cron endpoint:

```typescript
export async function GET(request: NextRequest) {
  // MANDATORY secret verification
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = {
    expireTrials: await expireTrials(),
    pastDueGrace: await handlePastDueGracePeriod(),
    resetUsage: today.getDate() === 1 ? await resetMonthlyUsage() : null
  }

  return Response.json({ success: true, ...results })
}
```

---

## Database Tables

### plans

```sql
CREATE TABLE plans (
  id UUID PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL,  -- free, paid, enterprise
  visibility VARCHAR(20) DEFAULT 'public',
  "priceMonthly" INTEGER,
  "priceYearly" INTEGER,
  currency VARCHAR(3) DEFAULT 'usd',
  "trialDays" INTEGER DEFAULT 0,
  features JSONB DEFAULT '[]',
  limits JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  "sortOrder" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
```

### subscriptions

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  "teamId" UUID NOT NULL REFERENCES teams(id),
  "userId" UUID REFERENCES users(id),  -- Optional, B2C optimization
  "planId" UUID NOT NULL REFERENCES plans(id),
  status VARCHAR(20) NOT NULL,
  "currentPeriodStart" TIMESTAMP NOT NULL,
  "currentPeriodEnd" TIMESTAMP NOT NULL,
  "trialEndsAt" TIMESTAMP,
  "canceledAt" TIMESTAMP,
  "cancelAtPeriodEnd" BOOLEAN DEFAULT FALSE,
  "paymentProvider" VARCHAR(20),
  "externalSubscriptionId" VARCHAR(255),
  "externalCustomerId" VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
```

### usage

```sql
CREATE TABLE usage (
  id UUID PRIMARY KEY,
  "subscriptionId" UUID NOT NULL REFERENCES subscriptions(id),
  "limitSlug" VARCHAR(50) NOT NULL,
  "periodKey" VARCHAR(20) NOT NULL,
  "currentValue" INTEGER NOT NULL DEFAULT 0,
  "lastIncrementAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),

  UNIQUE ("subscriptionId", "limitSlug", "periodKey")
);
```

### usageEvents

```sql
CREATE TABLE "usageEvents" (
  id UUID PRIMARY KEY,
  "subscriptionId" UUID NOT NULL REFERENCES subscriptions(id),
  "userId" UUID REFERENCES users(id),
  "teamId" UUID NOT NULL REFERENCES teams(id),
  "limitSlug" VARCHAR(50) NOT NULL,
  delta INTEGER NOT NULL,
  action VARCHAR(100),
  "resourceType" VARCHAR(50),
  "resourceId" UUID,
  "periodKey" VARCHAR(20) NOT NULL,
  metadata JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP DEFAULT NOW()
);
```

### billingEvents

```sql
CREATE TABLE "billingEvents" (
  id UUID PRIMARY KEY,
  "subscriptionId" UUID NOT NULL REFERENCES subscriptions(id),
  type VARCHAR(20) NOT NULL,  -- payment, refund, invoice, credit
  status VARCHAR(20) NOT NULL,  -- pending, succeeded, failed
  amount INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'usd',
  "externalPaymentId" VARCHAR(255),
  "invoiceUrl" TEXT,
  "receiptUrl" TEXT,
  metadata JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP DEFAULT NOW()
);
```

---

## Related

- [Overview](./01-overview.md) - System architecture
- [Configuration](./02-configuration.md) - Theme setup
- [API Reference](./04-api-reference.md) - Endpoints
