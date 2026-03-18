---
title: Payment Provider Integration
description: Multi-provider payment integration for subscription payments
---

# Payment Provider Integration

The billing system supports multiple payment providers through a **Gateway Factory** pattern. Providers are abstracted behind a unified `BillingGateway` interface, so consumer code never imports from a specific provider.

## Architecture

```
User -> Checkout Button -> API -> getBillingGateway() -> Provider SDK -> Webhook -> Database
                                       |
                            StripeGateway / PolarGateway
```

```
core/lib/billing/gateways/
├── interface.ts     # BillingGateway contract
├── types.ts         # Provider-agnostic result types
├── factory.ts       # getBillingGateway() singleton factory
├── stripe.ts        # StripeGateway implements BillingGateway
└── polar.ts         # PolarGateway implements BillingGateway
```

### Gateway Factory Pattern

Consumer code always uses the factory — never imports from a specific provider:

```typescript
import { getBillingGateway } from '@nextsparkjs/core/lib/billing/gateways/factory'

// Works with any configured provider (Stripe, Polar, etc.)
const session = await getBillingGateway().createCheckoutSession(params)
const portal = await getBillingGateway().createPortalSession(params)
await getBillingGateway().cancelSubscriptionAtPeriodEnd(subscriptionId)
```

The factory reads `BILLING_REGISTRY.provider` (from `billing.config.ts`) and instantiates the correct gateway class.

### BillingGateway Interface

All providers implement this contract:

```typescript
// core/lib/billing/gateways/interface.ts
export interface BillingGateway {
  // Recurring subscriptions
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult>
  createPortalSession(params: CreatePortalParams): Promise<PortalSessionResult>
  updateSubscriptionPlan(params: UpdateSubscriptionParams): Promise<SubscriptionResult>
  cancelSubscriptionAtPeriodEnd(subscriptionId: string): Promise<SubscriptionResult>
  cancelSubscriptionImmediately(subscriptionId: string): Promise<SubscriptionResult>
  reactivateSubscription(subscriptionId: string): Promise<SubscriptionResult>

  // One-time payments (credit packs, LTD, upsells)
  createOneTimeCheckout(params: CreateOneTimeCheckoutParams): Promise<CheckoutSessionResult>

  // Customer management
  getCustomer(customerId: string): Promise<CustomerResult>
  createCustomer(params: CreateCustomerParams): Promise<CustomerResult>

  // Webhook security
  verifyWebhookSignature(payload: string | Buffer, signatureOrHeaders: string | Record<string, string>): WebhookEventResult
}
```

Return types are provider-agnostic (no `Stripe.*` or Polar types in consumer code):

```typescript
// core/lib/billing/gateways/types.ts
export interface CheckoutSessionResult { id: string; url: string | null }
export interface PortalSessionResult { url: string }
export interface SubscriptionResult { id: string; status: string; cancelAtPeriodEnd: boolean }
export interface CustomerResult { id: string; email: string | null; name: string | null }
export interface WebhookEventResult { id: string; type: string; data: Record<string, unknown> }
```

## Setup

### 1. Choose Your Provider

Set the provider in your theme's `billing.config.ts`:

```typescript
export const billingConfig: BillingConfig = {
  provider: 'stripe',  // or 'polar'
  // ...
}
```

### 2. Environment Variables

Configure credentials for your chosen provider:

```env
# === Stripe ===
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# === Polar ===
POLAR_ACCESS_TOKEN=pat_...
POLAR_WEBHOOK_SECRET=whsec_...
POLAR_SERVER=sandbox   # 'sandbox' or 'production'

# === Cron (required for all providers) ===
CRON_SECRET=your-secure-secret
```

### 3. Configure Price IDs

Create products/prices in your provider's dashboard, then add the IDs to your plans:

```typescript
plans: [
  {
    slug: 'pro',
    name: 'billing.plans.pro.name',
    price: { monthly: 2900, yearly: 29000 },
    providerPriceIds: {
      monthly: 'price_1ABC123monthly',  // From Stripe or Polar dashboard
      yearly: 'price_1ABC123yearly',
    },
  }
]
```

## Checkout Flow

### Frontend

```tsx
import { Button } from '@/core/components/ui/button'
import { useState } from 'react'
import { toast } from 'sonner'

function UpgradeButton({ planSlug, billingPeriod }) {
  const [loading, setLoading] = useState(false)

  const handleUpgrade = async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/v1/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planSlug,
          billingPeriod,
          // Note: successUrl and cancelUrl are generated server-side
          // based on NEXT_PUBLIC_APP_URL environment variable
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Redirect to provider's hosted checkout
        window.location.href = data.data.url
      } else {
        toast.error(data.error || 'Failed to start checkout')
      }
    } catch (error) {
      toast.error('Failed to start checkout')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleUpgrade} disabled={loading}>
      {loading ? 'Loading...' : 'Upgrade Now'}
    </Button>
  )
}
```

### Backend (Checkout Session)

```typescript
// app/api/v1/billing/checkout/route.ts
import { getBillingGateway } from '@nextsparkjs/core/lib/billing/gateways/factory'

export async function POST(request: NextRequest) {
  // 1. Authenticate + validate + check permissions
  // ...

  // 2. Create checkout session via gateway (works for any provider)
  const session = await getBillingGateway().createCheckoutSession({
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

## Webhooks

Webhook routes are **provider-specific by design** — they need raw provider types for proper event handling and type narrowing. Both routes are protected with **strict rate limiting** (10 req/hour per IP) and mandatory signature verification.

### Stripe Webhooks

The Stripe webhook handler uses `StripeWebhookExtensions` to delegate one-time payment handling to project-level code:

```typescript
// app/api/v1/billing/webhooks/stripe/route.ts
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { stripeWebhookExtensions } from '@/lib/billing/stripe-webhook-extensions'

// Rate-limited: 10 requests/hour per IP (strict tier)
export const POST = withRateLimitTier(handleStripeWebhook, 'strict')

async function handleStripeWebhook(request: NextRequest) {
  const payload = await request.text()
  const signature = request.headers.get('stripe-signature')

  // Mandatory signature verification
  let event
  try {
    const gateway = getBillingGateway()
    event = gateway.verifyWebhookSignature(payload, signature!)
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Idempotency check (deduplicate retries)
  const existing = await queryOne(
    `SELECT id FROM "billing_events" WHERE metadata->>'stripeEventId' = $1`,
    [event.id]
  )
  if (existing) return Response.json({ received: true, status: 'duplicate' })

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data, event.id, stripeWebhookExtensions)
      break
    case 'invoice.paid':
      await handleInvoicePaid(event.data, event.id)
      break
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data, event.id)
      break
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data, event.id)
      break
  }

  return Response.json({ received: true })
}
```

**Stripe Webhook Setup:**

Local Development:
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/v1/billing/webhooks/stripe
```

Production:
1. Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://your-app.com/api/v1/billing/webhooks/stripe`
3. Select events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Copy signing secret to `STRIPE_WEBHOOK_SECRET`

### Polar Webhooks

Polar requires **ALL request headers** for webhook verification (not just a signature header):

```typescript
// app/api/v1/billing/webhooks/polar/route.ts
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { polarWebhookExtensions } from '@/lib/billing/polar-webhook-extensions'

// Rate-limited: 10 requests/hour per IP (strict tier)
export const POST = withRateLimitTier(handlePolarWebhook, 'strict')

async function handlePolarWebhook(request: NextRequest) {
  const payload = await request.text()
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => { headers[key] = value })

  // Polar needs all three headers for verification
  if (!headers['webhook-id'] || !headers['webhook-signature'] || !headers['webhook-timestamp']) {
    return Response.json({ error: 'Missing required webhook headers' }, { status: 400 })
  }

  // Mandatory signature verification
  let event
  try {
    const gateway = getBillingGateway()
    event = gateway.verifyWebhookSignature(payload, headers)
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Idempotency check
  const eventId = event.id || headers['webhook-id']
  const existing = await queryOne(
    `SELECT id FROM "billing_events" WHERE metadata->>'polarEventId' = $1`,
    [eventId]
  )
  if (existing) return Response.json({ received: true, status: 'duplicate' })

  switch (event.type) {
    case 'checkout.updated':
      await handleCheckoutUpdated(event.data, eventId)
      break
    case 'subscription.created':
    case 'subscription.updated':
    case 'subscription.canceled':
      await handleSubscriptionEvent(event.type, event.data, eventId)
      break
    case 'order.paid':
      // Dispatches to polarWebhookExtensions.onOneTimePaymentCompleted
      // when there's no subscriptionId (one-time purchase)
      await handleOrderPaid(event.data, eventId, polarWebhookExtensions)
      break
  }

  return Response.json({ received: true })
}
```

**Polar Webhook Setup:**

1. Go to your Polar organization settings → Webhooks
2. Add endpoint: `https://your-app.com/api/v1/billing/webhooks/polar`
3. Select events: `checkout.updated`, `order.paid`, `subscription.created`, `subscription.updated`, `subscription.canceled`
4. Copy the webhook secret to `POLAR_WEBHOOK_SECRET`

---

## Webhook Extensions

The extension pattern lets project code handle one-time payment events without modifying the core webhook handler. Both Stripe and Polar support this pattern.

### Extension Files

Two stub files are created for every new project. Override them to add handlers:

```
lib/billing/
├── stripe-webhook-extensions.ts   # Handles Stripe one-time checkout.session.completed
└── polar-webhook-extensions.ts    # Handles Polar one-time order.paid
```

### Stripe Extension

```typescript
// lib/billing/stripe-webhook-extensions.ts
import type { StripeWebhookExtensions } from '@nextsparkjs/core/lib/billing/stripe-webhook'

export const stripeWebhookExtensions: StripeWebhookExtensions = {
  /**
   * Called for checkout.session.completed where mode === 'payment'
   * (i.e., a one-time purchase, NOT a recurring subscription).
   */
  onOneTimePaymentCompleted: async (session, context) => {
    const { type } = session.metadata ?? {}

    if (type === 'credit_pack') {
      await addCreditsToTeam(context.teamId, session.amountTotal ?? 0)
    }

    if (type === 'lifetime') {
      await activateLifetimePlan(context.teamId)
    }
  }
}
```

### Polar Extension

```typescript
// lib/billing/polar-webhook-extensions.ts
import type { PolarWebhookExtensions } from '@nextsparkjs/core/lib/billing/polar-webhook'

export const polarWebhookExtensions: PolarWebhookExtensions = {
  /**
   * Called for order.paid events with no subscriptionId
   * (i.e., a one-time purchase, NOT a recurring subscription payment).
   */
  onOneTimePaymentCompleted: async (order, context) => {
    const { type, credits } = order.metadata

    if (type === 'credit_pack' && credits) {
      await addCreditsToTeam(context.teamId, parseInt(credits, 10))
    }
  }
}
```

### Extension Interfaces

```typescript
// @nextsparkjs/core/lib/billing/stripe-webhook
export interface StripeWebhookExtensions {
  onOneTimePaymentCompleted?: (
    session: StripeSessionData,
    context: OneTimePaymentContext
  ) => Promise<void>
}

// @nextsparkjs/core/lib/billing/polar-webhook
export interface PolarWebhookExtensions {
  onOneTimePaymentCompleted?: (
    order: PolarOrderData,
    context: OneTimePaymentContext
  ) => Promise<void>
}

export interface OneTimePaymentContext {
  teamId: string
  userId: string
}
```

### When Is the Extension Called?

**Stripe:** When `checkout.session.completed` fires and `session.mode === 'payment'` (one-time checkout, not subscription). Recurring subscription checkouts are handled by the core handler and do NOT trigger the extension.

**Polar:** When `order.paid` fires and the order has **no `subscriptionId`** (one-time purchase). Orders from recurring subscriptions have a `subscriptionId` and are handled by the core handler.

If no extension is configured (empty `{}`), one-time payments are acknowledged (returning 200) but not acted upon — no error is thrown.

---

## One-Time Payments

Use `createOneTimeCheckout` for credit packs, lifetime deals, upsells, or any non-recurring purchase. This is separate from recurring subscription checkout.

### Backend

```typescript
import { getBillingGateway } from '@nextsparkjs/core/lib/billing/gateways/factory'

// In your one-time purchase API route
const session = await getBillingGateway().createOneTimeCheckout({
  teamId,                        // Required: stored in checkout metadata
  priceId: 'prod_xxx',           // Your provider's product/price ID
  successUrl: `${appUrl}/dashboard/billing?purchase=success`,
  cancelUrl: `${appUrl}/dashboard/billing`,
  customerEmail: user.email,
  customerId: subscription.externalCustomerId,  // Optional: pre-fill customer
  metadata: {
    type: 'credit_pack',         // Custom metadata — available in webhook
    credits: '100',
    userId,
  },
})

return Response.json({ success: true, data: { url: session.url } })
```

**Provider notes:**
- **Stripe:** Maps to `mode: 'payment'` checkout session with `payment_method_types`
- **Polar:** Maps to `checkouts.create` with `allowTrial: false`; product type (one-time vs recurring) is configured in the Polar dashboard, not in code

### Handling the Completed Payment (Webhook Extension)

When the payment completes, the webhook fires an `order.paid` (Polar) or `checkout.session.completed` (Stripe with `mode: 'payment'`) event. Use the **webhook extension** to handle it:

```typescript
// lib/billing/polar-webhook-extensions.ts  (or stripe-webhook-extensions.ts)
import type { PolarWebhookExtensions } from '@nextsparkjs/core/lib/billing/polar-webhook'

export const polarWebhookExtensions: PolarWebhookExtensions = {
  onOneTimePaymentCompleted: async (order, context) => {
    const { type, credits, userId } = order.metadata

    if (type === 'credit_pack' && credits) {
      // Add credits to the team's balance
      await addCredits(context.teamId, parseInt(credits, 10))
    }
  }
}
```

See the [Webhook Extensions](#webhook-extensions) section for full details.

---

## Plan Changes (Upgrade/Downgrade)

### Frontend

```tsx
import { useState } from 'react'
import { toast } from 'sonner'

function ChangePlanButton({ targetPlanSlug, billingInterval = 'monthly' }) {
  const [loading, setLoading] = useState(false)

  const handleChange = async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/v1/billing/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planSlug: targetPlanSlug,
          billingInterval,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Show warnings for downgrades
        if (data.data.warnings?.length > 0) {
          data.data.warnings.forEach(warning => toast.warning(warning))
        }
        toast.success('Plan changed successfully')
      } else {
        toast.error(data.error || 'Failed to change plan')
      }
    } catch (error) {
      toast.error('Failed to change plan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleChange} disabled={loading}>
      {loading ? 'Processing...' : 'Switch Plan'}
    </Button>
  )
}
```

### Proration Behavior

The payment provider handles proration automatically:
- **Upgrade:** User is charged the prorated difference immediately
- **Downgrade:** Credit is applied to the next invoice
- No manual calculation needed

### Downgrade Warnings

When downgrading, the system checks if current usage exceeds the new plan's limits:

```json
{
  "success": true,
  "data": {
    "subscription": { ... },
    "warnings": [
      "You have 15 team members but the new plan allows 10. Excess members will become read-only.",
      "You have 75 projects but the new plan allows 50. Excess projects will become read-only."
    ]
  }
}
```

Downgrades are **always allowed** (soft limit policy) - excess resources become read-only rather than deleted.

---

## Customer Portal

Allow users to manage their billing:

### Frontend

```tsx
import { ManageBillingButton } from '@/core/components/billing/ManageBillingButton'

function BillingSettings() {
  return (
    <div>
      <h2>Billing</h2>
      <ManageBillingButton />
    </div>
  )
}
```

### Backend

```typescript
// app/api/v1/billing/portal/route.ts
import { getBillingGateway } from '@nextsparkjs/core/lib/billing/gateways/factory'

const session = await getBillingGateway().createPortalSession({
  customerId: subscription.externalCustomerId,
  returnUrl: `${appUrl}/dashboard/settings/billing`,
})

return Response.json({ success: true, data: { url: session.url } })
```

---

## Subscription Cancellation

Handle subscription cancellation directly (without provider portal):

### Frontend

```tsx
import { useState } from 'react'
import { toast } from 'sonner'

function CancelSubscriptionButton() {
  const [loading, setLoading] = useState(false)

  const handleCancel = async (immediate = false) => {
    setLoading(true)

    try {
      const response = await fetch('/api/v1/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          immediate,
          reason: 'User requested cancellation',
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(data.data.message)
      } else {
        toast.error(data.error || 'Failed to cancel subscription')
      }
    } catch (error) {
      toast.error('Failed to cancel subscription')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-x-2">
      <Button variant="outline" onClick={() => handleCancel(false)}>
        Cancel at Period End
      </Button>
      <Button variant="destructive" onClick={() => handleCancel(true)}>
        Cancel Immediately
      </Button>
    </div>
  )
}
```

### Reactivation

If a subscription is scheduled to cancel, users can reactivate:

```tsx
const handleReactivate = async () => {
  const response = await fetch('/api/v1/billing/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reactivate' }),
  })

  const data = await response.json()
  if (data.success) {
    toast.success('Subscription reactivated')
  }
}
```

### Cancellation Types

| Type | Behavior |
|------|----------|
| Soft Cancel (`immediate: false`) | User keeps access until period ends |
| Hard Cancel (`immediate: true`) | Access revoked immediately |
| Reactivate | Reverses soft cancel if still in period |

---

## Lifecycle Management

### Cron Job

Configure in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/billing/lifecycle",
      "schedule": "0 0 * * *"
    }
  ]
}
```

### Tasks

1. **Expire Trials:** Subscriptions where `trialEndsAt < now` -> status = `expired`
2. **Handle Past Due:** Subscriptions `past_due` > 3 days -> status = `expired`
3. **Reset Usage:** Archive previous month's usage (1st of each month)

## Status Mapping

| Provider Status | Our Status |
|-----------------|------------|
| `trialing` | `trialing` |
| `active` | `active` |
| `past_due` | `past_due` |
| `canceled` | `canceled` |
| `unpaid` / `incomplete` | `past_due` |
| `incomplete_expired` | `expired` |
| `paused` | `paused` |

> Stripe status mapping shown above. Each gateway normalizes its provider-specific statuses to these internal values; raw status names differ per provider (e.g., Polar uses `revoked` instead of `canceled`).

## Security

### Webhook Signature Verification

**Always verify webhook signatures regardless of provider:**

```typescript
// Via gateway (recommended — provider-agnostic)
const event = getBillingGateway().verifyWebhookSignature(payload, signatureOrHeaders)

// Stripe: verifies against a single 'stripe-signature' header
// Polar: validates against ALL request headers (webhook-id, webhook-timestamp, webhook-signature)
```

Never skip signature verification. Unsigned requests should always return 400.

### Rate Limiting on Webhook Endpoints

Both webhook routes are wrapped with `withRateLimitTier('strict')` — 10 requests per hour per IP. This defends against flood attacks while allowing legitimate webhook retries.

Signature verification is the **primary** security layer. Rate limiting is a secondary defense against denial-of-service.

```typescript
// Both webhook routes follow this pattern
export const POST = withRateLimitTier(handleWebhook, 'strict')
```

### Idempotency

Payment providers retry failed webhooks. Always check for duplicates before processing:

```typescript
// Stripe webhooks store event ID in metadata
const existing = await queryOne(
  `SELECT id FROM "billing_events" WHERE metadata->>'stripeEventId' = $1`,
  [event.id]
)

// Polar webhooks use the webhook-id header
const existing = await queryOne(
  `SELECT id FROM "billing_events" WHERE metadata->>'polarEventId' = $1`,
  [eventId]
)

if (existing) return Response.json({ received: true, status: 'duplicate' })
```

## Testing

### Test Mode

Use your provider's test/sandbox mode:
- **Stripe:** API keys starting with `sk_test_` and `pk_test_`
- **Polar:** Set `POLAR_SERVER=sandbox`

### Test Cards (Stripe-specific)

| Card | Result |
|------|--------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0341` | Declined |
| `4000 0000 0000 9995` | Insufficient funds |

### Webhook Testing

```bash
# Stripe: Trigger test event
stripe trigger checkout.session.completed
stripe logs tail
```

## Related

- [Configuration](./02-configuration.md) - Provider Price IDs
- [API Reference](./04-api-reference.md) - Endpoints
- [Lifecycle Management](./06-usage-tracking.md#lifecycle-jobs) - Cron jobs
- [Technical Reference](./08-technical-reference.md) - File structure
