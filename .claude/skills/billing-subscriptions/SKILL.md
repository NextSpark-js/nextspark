---
name: billing-subscriptions
description: |
  Multi-provider billing and subscription system for this Next.js application.
  Covers Gateway Factory pattern, Stripe integration, Polar.sh integration, Better Auth plugin,
  plans configuration, checkout flow, customer portal, webhooks, and usage tracking.
  Use this skill when implementing billing features or working with subscription management.
allowed-tools: Read, Glob, Grep
version: 3.0.0
---

# Billing & Subscriptions Skill

Multi-provider billing system with Gateway Factory pattern. Supports Stripe, Polar.sh, and future providers through a unified interface.

## Architecture Overview

```
Configuration Layer:
contents/themes/{theme}/config/billing.config.ts
├── provider: 'stripe' | 'polar' | 'paddle' | 'lemonsqueezy'
├── currency, defaultPlan, features, limits, plans, actionMappings

Core Library:
core/lib/billing/
├── config-types.ts      # BillingConfig, PlanDefinition interfaces
├── types.ts             # PlanType, SubscriptionStatus, PaymentProvider
├── schema.ts            # Zod validation schemas
├── gateways/
│   ├── interface.ts     # BillingGateway interface (contract)
│   ├── factory.ts       # getBillingGateway() factory
│   ├── stripe.ts        # StripeGateway implements BillingGateway
│   └── polar.ts         # PolarGateway implements BillingGateway
├── queries.ts, enforcement.ts, helpers.ts, jobs.ts

Services: subscription.service.ts, plan.service.ts, usage.service.ts

API Endpoints: app/api/v1/billing/
├── checkout, portal, plans, cancel, change-plan, check-action
└── webhooks/stripe/, webhooks/polar/
```

## Gateway Factory Pattern

**Key Principle:** Consumers never import from a specific provider. Use `getBillingGateway()` which returns the correct implementation.

### BillingGateway Interface

```typescript
export interface BillingGateway {
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult>
  createPortalSession(params: CreatePortalParams): Promise<PortalSessionResult>
  getCustomer(customerId: string): Promise<CustomerResult>
  createCustomer(params: CreateCustomerParams): Promise<CustomerResult>
  updateSubscriptionPlan(params: UpdateSubscriptionParams): Promise<SubscriptionResult>
  cancelSubscriptionAtPeriodEnd(subscriptionId: string): Promise<SubscriptionResult>
  cancelSubscriptionImmediately(subscriptionId: string): Promise<SubscriptionResult>
  reactivateSubscription(subscriptionId: string): Promise<SubscriptionResult>
  verifyWebhookSignature(payload: string | Buffer, signatureOrHeaders: string | Record<string, string>): WebhookEventResult
}
```

### Provider-Agnostic Return Types

All gateway methods return simple types (`CheckoutSessionResult`, `PortalSessionResult`, `SubscriptionResult`, `CustomerResult`, `WebhookEventResult`) — NO provider-specific types (no `Stripe.*` or `Polar.*`).

### Factory Usage

```typescript
import { getBillingGateway } from '@nextsparkjs/core/lib/billing/gateways/factory'

const session = await getBillingGateway().createCheckoutSession(params)
const portal = await getBillingGateway().createPortalSession(params)
await getBillingGateway().cancelSubscriptionAtPeriodEnd(subId)
```

### Plan Price IDs

Plans support generic + provider-specific price IDs:

```typescript
{
  slug: 'pro',
  providerPriceIds: { monthly: 'price_xxx_monthly', yearly: 'price_xxx_yearly' },  // Generic (preferred)
  stripePriceIdMonthly: 'price_pro_monthly',  // Stripe-specific (fallback)
}
// PlanService.getPriceId() checks providerPriceIds first, falls back to stripe-specific
```

## Provider: Stripe

**Package:** `stripe` | **Env:** `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`

StripeGateway maps to: `stripe.checkout.sessions.create()`, `stripe.billingPortal.sessions.create()`, `stripe.subscriptions.update/cancel()`, `stripe.webhooks.constructEvent()`.

### Stripe Webhook Events

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create/update subscription |
| `invoice.paid` | Update period dates |
| `invoice.payment_failed` | Mark `past_due` |
| `customer.subscription.updated` | Sync status/plan |
| `customer.subscription.deleted` | Mark `canceled` |

Webhook routes are provider-specific by design (need raw provider types for type narrowing). Use `getStripeInstance().webhooks.constructEvent(payload, signature, secret)`.

## Provider: Polar.sh

**Packages:** `@polar-sh/sdk`, optionally `@polar-sh/nextjs` (pre-built routes), `@polar-sh/better-auth` (auth plugin)

**Env:** `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_SERVER` (sandbox|production)

### Integration Path A: PolarGateway (via factory)

Primary path — consistent with Stripe. PolarGateway maps to: `polar.checkouts.create()`, `polar.customerSessions.create()`, `polar.subscriptions.update/revoke()`, `validateEvent(payload, headers, secret)`.

### Integration Path B: Better Auth Plugin

For Polar-only projects. Auto-creates customers on signup, provides `authClient.checkout()`, `authClient.customer.portal()`, `authClient.usage.ingest()`.

| | Path A: PolarGateway | Path B: Better Auth Plugin |
|---|---|---|
| **Use when** | Multi-provider needed | Polar-only project |
| **Architecture** | Goes through factory | Auth-integrated, bypasses factory |
| **Recommended for** | NextSpark core | Theme-specific Polar apps |

### Polar Webhook Events

| Event | Action |
|-------|--------|
| `order.paid` | Payment confirmed — create/update subscription |
| `subscription.active/canceled/revoked/uncanceled` | Sync status |
| `customer.created/state_changed` | Customer sync |

Use `validateEvent(payload, headers, secret)` from `@polar-sh/sdk/webhooks`.

## Provider Comparison

| Operation | Stripe | Polar |
|-----------|--------|-------|
| SDK init | `new Stripe(secretKey)` | `new Polar({ accessToken })` |
| Checkout | `stripe.checkout.sessions.create()` | `polar.checkouts.create()` |
| Portal | `stripe.billingPortal.sessions.create()` | `polar.customerSessions.create()` |
| Soft cancel | `subscriptions.update({ cancel_at_period_end })` | `subscriptions.update({ cancelAtPeriodEnd })` |
| Hard cancel | `subscriptions.cancel()` | `subscriptions.revoke()` |
| Verify webhook | `constructEvent(body, signature, secret)` | `validateEvent(body, headers, secret)` |

**Key differences:** Stripe validates single `stripe-signature` header; Polar validates ALL headers. Polar supports `externalId` for customer mapping. Polar has first-party Better Auth plugin.

## Three-Layer Permission Model

```
RESULT = Permission (RBAC) AND Feature (Plan) AND Quota (Limits)
```

- **Layer 1 (RBAC):** `actionMappings.permissions` — team role checks
- **Layer 2 (Features):** `actionMappings.features` — plan-gated capabilities
- **Layer 3 (Quotas):** `actionMappings.limits` — usage limits with `resetPeriod` (monthly/never)

## Plans Configuration

```typescript
export const billingConfig: BillingConfig = {
  provider: 'stripe',
  currency: 'usd',
  defaultPlan: 'free',
  plans: [
    { slug: 'free', type: 'free', price: { monthly: 0, yearly: 0 }, features: ['basic_analytics'], limits: { team_members: 3 } },
    { slug: 'pro', type: 'paid', price: { monthly: 2900, yearly: 29000 }, trialDays: 14,
      features: ['basic_analytics', 'advanced_analytics', 'api_access'],
      limits: { team_members: 15, tasks: 1000, api_calls: 100000 },
      providerPriceIds: { monthly: 'price_pro_monthly', yearly: 'price_pro_yearly' } },
    { slug: 'enterprise', type: 'enterprise', visibility: 'hidden', features: ['*'], limits: { team_members: -1 } },
  ],
}
```

## Team-Based Subscriptions

Subscriptions are tied to teams, not users. Key fields: `teamId`, `planId`, `status` (active|trialing|past_due|canceled|expired|paused), `billingInterval`, `paymentProvider`, `externalSubscriptionId`, `externalCustomerId`, `cancelAtPeriodEnd`.

## Database Schema

Plans use inline JSONB (`features JSONB`, `limits JSONB`) instead of separate meta tables — fixed structure, read-heavy. Subscriptions use `"paymentProvider" TEXT` for provider-agnostic storage.

**Price storage:** Always in cents (`2900` not `29.00`).

## Anti-Patterns

```typescript
// ❌ Import from specific provider
import { createCheckoutSession } from '.../gateways/stripe'
// ✅ Use factory
await getBillingGateway().createCheckoutSession(params)

// ❌ Provider-specific types in consumer code
const session: Stripe.Checkout.Session = ...
// ✅ Provider-agnostic types
const session: CheckoutSessionResult = ...

// ❌ Hardcode plan features
if (plan.slug === 'pro' || plan.slug === 'business')
// ✅ Feature checks
const hasFeature = membership.hasFeature('advanced_analytics')

// ❌ Skip webhook signature verification
// ❌ Store prices in dollars (use cents)
// ❌ Forget to handle -1 (unlimited) in limit checks
```

## Environment Variables

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Polar
POLAR_ACCESS_TOKEN=pat_...
POLAR_WEBHOOK_SECRET=whsec_...
POLAR_SERVER=sandbox
```

## Testing

```
packages/core/tests/jest/lib/billing/
├── stripe.test.ts    # 38 tests
├── polar.test.ts     # 26 tests
```

Mock pattern: Mock provider SDK + `PlanService` + `BILLING_REGISTRY` before importing gateway.

```bash
cd packages/core && npx jest --config jest.config.cjs tests/jest/lib/billing/
```

## Checklist

### General
- [ ] Provider selected in `billing.config.ts`
- [ ] Plans defined with price IDs
- [ ] Features, limits, action mappings configured
- [ ] Checkout + portal flows tested
- [ ] Webhook endpoint configured in provider dashboard
- [ ] All webhook events handled
- [ ] Usage tracking + limit enforcement working
- [ ] Translations for plan names/descriptions

### Stripe-specific
- [ ] `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` configured
- [ ] Invoice sync working

### Polar-specific
- [ ] `POLAR_ACCESS_TOKEN` + `POLAR_WEBHOOK_SECRET` configured
- [ ] Customer `externalId` mapping working
- [ ] (Optional) Better Auth plugin for auto customer creation

## Related Skills

- `permissions-system` — RBAC integration
- `better-auth` — Authentication (Polar Better Auth plugin)
- `entity-api` — API patterns
- `service-layer` — Service class patterns
- `database-migrations` — Billing table migrations
