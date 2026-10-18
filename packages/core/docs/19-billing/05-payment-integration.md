---
title: Payment Provider Integration
description: Multi-provider payment integration for subscription payments
---

# Payment Provider Integration

> **Experimental:** Billing (Stripe and Polar) is not part of the stable 1.0 surface and may change without a deprecation period.

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

  // Dashboard & Metadata
  getProviderName(): string
  getSubscriptionDashboardUrl(externalSubscriptionId: string | null | undefined): string | null
  getResourceHintDomains(): { preconnect: string[]; dnsPrefetch: string[] }
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
import { Button } from '@nextsparkjs/core/components/ui/button'
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
// packages/core/src/routes/api/v1/billing/checkout/route.ts
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
// packages/core/src/routes/api/v1/billing/webhooks/stripe/route.ts
import { handleStripeWebhook } from '@nextsparkjs/core/lib/billing/stripe-webhook'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

// Extensions are optional — loaded dynamically with fallback
async function loadExtensions() {
  try {
    const mod = await import('@/lib/billing/stripe-webhook-extensions')
    return mod.stripeWebhookExtensions
  } catch {
    return {}
  }
}

export const POST = withRateLimitTier(
  async (request) => handleStripeWebhook(request, await loadExtensions()),
  'webhook'
)

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

  // Claim the event and handle it once (see "Webhook Deduplication" below)
  try {
    const outcome = await processWebhookEventOnce('stripe', event.id, event.type, async () => {
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
    })
    return webhookOutcomeResponse(outcome)
  } catch {
    return Response.json({ error: 'Handler failed' }, { status: 500 })
  }
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
// packages/core/src/routes/api/v1/billing/webhooks/polar/route.ts
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import type { PolarWebhookExtensions } from '@nextsparkjs/core/lib/billing/polar-webhook'

// Extensions are optional — loaded dynamically with fallback
async function loadExtensions(): Promise<PolarWebhookExtensions> {
  try {
    const mod = await import('@/lib/billing/polar-webhook-extensions')
    return mod.polarWebhookExtensions
  } catch {
    return {}
  }
}

export const POST = withRateLimitTier(handlePolarWebhook, 'webhook')

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

  // Claim the event and handle it once (see "Webhook Deduplication" below)
  const eventId = event.id || headers['webhook-id']
  try {
    const outcome = await processWebhookEventOnce('polar', eventId, event.type, async () => {
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
    })
    return webhookOutcomeResponse(outcome)
  } catch {
    return Response.json({ error: 'Handler failed' }, { status: 500 })
  }
}
```

**Polar Webhook Setup:**

1. Go to your Polar organization settings → Webhooks
2. Add endpoint: `https://your-app.com/api/v1/billing/webhooks/polar`
3. Select events: `checkout.updated`, `order.paid`, `subscription.created`, `subscription.updated`, `subscription.canceled`
4. Copy the webhook secret to `POLAR_WEBHOOK_SECRET`

### Webhook Deduplication

Gateways deliver an event more than once: retries after a timeout or an error, and sometimes two deliveries at the same time. Each event is processed once through one table and one helper.

**The table.** `billing_webhook_events` (migration `040_billing_webhook_events.sql`) holds one row per event, with `UNIQUE (gateway, "eventId")`. `status` is `processing` while a delivery handles the event and `processed` once it succeeded; `"claimedAt"` is when the delivery claimed it. RLS is on with no policy: only the service connection, which webhooks use, reads and writes it.

**The helper.** `processWebhookEventOnce(gateway, eventId, eventType, handle)` from `@nextsparkjs/core/lib/billing/webhook-events` claims the event with an `INSERT ... ON CONFLICT` on that constraint, so of two concurrent deliveries only one gets the row back, and runs `handle` only for that one. It returns:

| Outcome | When | `webhookOutcomeResponse(outcome)` |
|---------|------|-----------------------------------|
| `processed` | this delivery claimed the event and `handle` succeeded | 200 `{ received: true }` |
| `duplicate` | an earlier delivery already processed it | 200 `{ received: true, status: 'duplicate' }` |
| `in_progress` | another delivery is processing it right now, or took this delivery's claim over while it ran | 409, so the gateway retries later |

**One transaction.** The claim commits on its own connection first, so a concurrent delivery sees it. Then `handle` and the update that marks the event `processed` run in one transaction on the service connection (`withServiceTransaction` from `@nextsparkjs/core/lib/db`):

- `handle` throws: every row it wrote rolls back, the claim is deleted and the error rethrown. Answer 500; the gateway's retry processes the event from a clean state, so an audit row is not written twice.
- The final update matches no claim, because the lease ran out and a retry took the event over: everything rolls back and the outcome is `in_progress`. The newer delivery owns the event.
- The process dies while handling: the transaction rolls back with the connection, and the claim stays `processing`. After `WEBHOOK_CLAIM_LEASE_SECONDS` (5 minutes) the next retry takes it over.

Inside `handle`, `query`, `queryRows` and `queryOne` from `@nextsparkjs/core/lib/db` use that transaction, and so do `queryWithRLS`, `queryOneWithRLS` and `mutateWithRLS` when they run on the service connection (no `userId`, or `{ service: true }`). Two kinds of call open their own connection and commit on their own, so a failed delivery keeps what they wrote and the retry writes it again: a `*WithRLS` call with a `userId`, and `getTransactionClient()` / `getServiceTransactionClient()`. A statement that fails inside the transaction aborts it: catching the error and going on makes every later statement fail, and the delivery is retried.

What `handle` does outside Postgres does not roll back. Core's Stripe and Polar handlers do nothing outside Postgres (they only log). A project's `onOneTimePaymentCompleted` runs inside `handle`, as its last step. If it sends an email or calls an API and the delivery then fails, the retry does it again: when the extension itself throws after the call, when the final update or the commit fails, or when another delivery took the claim over. Make such calls idempotent (an idempotency key, or a check of your own), or accept that they can repeat.

**A new gateway.** Verify the signature, then wrap all event handling in the helper, with the gateway's name and its own event id:

```typescript
import { processWebhookEventOnce, webhookOutcomeResponse } from '@nextsparkjs/core/lib/billing/webhook-events'

const event = gateway.verifyWebhookSignature(payload, signature)
try {
  const outcome = await processWebhookEventOnce('paddle', event.id, event.type, () => handlePaddleEvent(event))
  return webhookOutcomeResponse(outcome)
} catch {
  return Response.json({ error: 'Handler failed' }, { status: 500 })
}
```

In `handle`, write to the database with the db helpers above, so the writes join the transaction. Call other services (email, a gateway's API, outbound webhooks) after the helper returns `processed` when you can: by then the transaction has committed. A call that has to happen inside `handle` repeats when the delivery is retried. Keep the transaction short: no network calls inside it that you can move out.

The claim, and its release after a failure, always run on their own pool connection, outside any transaction of the caller.

**Cleanup.** A processed row only matters while the gateway may still redeliver its event, so processed rows are deleted after a retention period, with no cron:

- After an event is processed, at most once every 10 minutes per process, the helper deletes up to 1000 `processed` rows whose `"processedAt"` is older than the retention. Rows in `processing` are never deleted: the lease handles them.
- The DELETE is not awaited, and an error is logged and swallowed, so the cleanup never changes or delays the webhook's answer. A batch that did not finish, or a process that stopped before it ran, is caught up by the next run. The partial index on `"processedAt"` (migration `042_billing_webhook_events_processed_at_index.sql`) serves it.
- The retention is `webhookEventRetentionDays` in `config/billing.config.ts`, 30 days by default (`WEBHOOK_EVENT_RETENTION_DAYS`). A value that is not a finite number uses the default. The floor is 3 days (`WEBHOOK_EVENT_RETENTION_MIN_DAYS`): a lower value is raised to 3, with one warning per process naming the value set.
- Keep it longer than any gateway redelivers an event. Stripe retries automatically for up to 3 days in live mode, and an event can be resent by hand for up to 15 days from the Dashboard and 30 days from the Stripe CLI. Polar retries up to 10 times with exponential backoff (it does not publish the total window) and lets you trigger a redelivery from its dashboard. An event redelivered after its row was deleted is processed again.

---

## Webhook Extensions

The extension pattern lets project code handle one-time payment events without modifying the core webhook handler. Both Stripe and Polar support this pattern.

### Extension Files

These files are **optional**. Without them, webhooks work normally without one-time payment handling. Create them only when you need to handle one-time purchases (credit packs, LTD, upsells):

```
lib/billing/
├── stripe-webhook-extensions.ts   # Handles Stripe one-time checkout.session.completed
└── polar-webhook-extensions.ts    # Handles Polar one-time order.paid
```

Declare each module in `nextspark.config.ts`. The generated `src/app` (`nextspark prepare`) then writes the webhook route as a
composed facade that imports your module statically and hands it to core's handler; nothing is loaded by a path chosen at
runtime, and a project without the setting keeps core's route with no extensions:

```typescript
// nextspark.config.ts
export default defineConfig({
  billing: {
    webhookExtensions: {
      stripe: './lib/billing/stripe-webhook-extensions', // must export `stripeWebhookExtensions`
      polar: './lib/billing/polar-webhook-extensions',   // must export `polarWebhookExtensions`
    },
  },
})
```

The generated route is `export const POST = createStripeWebhookRoute(stripeWebhookExtensions)` (or `createPolarWebhookRoute`).
The dynamic-import routes shown above are the form of apps that committed their own `src/app` before beta.192; `nextspark migrate` replaces them with this declaration.

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
import { ManageBillingButton } from '@nextsparkjs/core/components/billing/ManageBillingButton'

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
// packages/core/src/routes/api/v1/billing/portal/route.ts
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

Payment providers retry webhooks, so each handler claims the event with `processWebhookEventOnce` right after verifying the signature. See [Webhook Deduplication](#webhook-deduplication).

## Dashboard & Metadata Methods

### getProviderName()

Returns the display name of the active payment provider (e.g., `"Stripe"`, `"Polar"`). Used by the superadmin API to show which provider is configured without exposing internal implementation details.

```typescript
const gateway = getBillingGateway()
const name = gateway.getProviderName()
// "Stripe" or "Polar"
```

### getSubscriptionDashboardUrl()

Returns a direct URL to the subscription in the provider's dashboard, or `null` if the subscription ID is missing. Used by superadmin APIs to give administrators one-click access to the provider's management interface.

```typescript
const gateway = getBillingGateway()

const url = gateway.getSubscriptionDashboardUrl('sub_1ABC123')
// Stripe: "https://dashboard.stripe.com/subscriptions/sub_1ABC123"
// Polar:  "https://dashboard.polar.sh/sales/subscriptions/sub_1ABC123"

const noUrl = gateway.getSubscriptionDashboardUrl(null)
// null
```

### getResourceHintDomains()

Returns domain lists for `<link rel="preconnect">` and `<link rel="dns-prefetch">` tags. The root `layout.tsx` calls this method (via `getBillingResourceHints()` from the factory) to automatically inject resource hints into the HTML `<head>`.

```typescript
const gateway = getBillingGateway()
const hints = gateway.getResourceHintDomains()
// Stripe example:
// {
//   preconnect: ['https://js.stripe.com'],
//   dnsPrefetch: ['https://api.stripe.com']
// }
```

---

## Resource Hints

The framework automatically generates `<link rel="preconnect">` and `<link rel="dns-prefetch">` tags in the root `layout.tsx` based on the active payment provider. This eliminates cold-start latency for provider SDK loading without hardcoding provider-specific domains.

### How It Works

1. `layout.tsx` calls `getBillingResourceHints()` from the gateway factory
2. The factory delegates to the active gateway's `getResourceHintDomains()`
3. The returned domains are rendered as `<link>` tags in `<head>`

```tsx
// In layout.tsx (simplified)
const billingHints = getBillingResourceHints()

<head>
  {billingHints.preconnect.map(href => (
    <link key={href} rel="preconnect" href={href} />
  ))}
  {billingHints.dnsPrefetch.map(href => (
    <link key={href} rel="dns-prefetch" href={href} />
  ))}
</head>
```

### preconnect vs dns-prefetch

| Hint Type | Purpose | When to Use |
|-----------|---------|-------------|
| `preconnect` | Full connection setup (DNS + TCP + TLS) | Domains loaded on page render (e.g., SDK scripts) |
| `dns-prefetch` | DNS resolution only | Domains used after user interaction (e.g., API calls after form fill) |

**Why the distinction matters:** `preconnect` opens a full socket, which expires after ~10 seconds of idle time. If the connection is not used quickly (e.g., an API domain that is only called after the user fills a form), the socket is wasted. `dns-prefetch` is cheaper — it resolves the domain name early without holding a socket open.

### Stripe Example

```typescript
// StripeGateway.getResourceHintDomains()
{
  preconnect: ['https://js.stripe.com'],    // SDK loaded on render → full connection
  dnsPrefetch: ['https://api.stripe.com']   // API called after form fill → DNS only
}
```

- `js.stripe.com` gets **preconnect** because Stripe.js is loaded immediately when the page renders
- `api.stripe.com` gets **dns-prefetch** only because it is called after the user fills in payment details — by that time a preconnect socket would have expired

### Adding Hints for New Providers

New payment providers just implement `getResourceHintDomains()` in their gateway class. The layout picks up the hints automatically — no changes to `layout.tsx` needed:

```typescript
class MyProviderGateway implements BillingGateway {
  getResourceHintDomains() {
    return {
      preconnect: ['https://sdk.myprovider.com'],
      dnsPrefetch: ['https://api.myprovider.com']
    }
  }
  // ...
}
```

---

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
