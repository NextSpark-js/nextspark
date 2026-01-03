---
title: Payment Integration
description: Stripe integration for subscription payments
---

# Payment Integration

The billing system integrates with Stripe for payment processing using Hosted Checkout (no embedded forms, simpler PCI compliance).

## Architecture

```
User → Checkout Button → API → Stripe Checkout → Webhook → Database
         ↓                        ↓                    ↓
    Creates session         Payment processed    Subscription updated
```

## Setup

### 1. Stripe Account

1. Create a [Stripe account](https://stripe.com)
2. Get your API keys from the [Dashboard](https://dashboard.stripe.com/apikeys)
3. Create products and prices

### 2. Environment Variables

```env
# Required for payments
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Required for webhooks
STRIPE_WEBHOOK_SECRET=whsec_...

# Required for lifecycle cron
CRON_SECRET=your-secure-secret
```

### 3. Products and Prices

Create products in Stripe Dashboard:

1. Go to **Products** → **Add Product**
2. Name: "Pro Plan"
3. Add **Recurring Prices**:
   - Monthly: $29.00/month
   - Yearly: $290.00/year
4. Copy Price IDs (starts with `price_`)

### 4. Configure billing.config.ts

```typescript
plans: [
  {
    slug: 'pro',
    name: 'billing.plans.pro.name',
    price: { monthly: 2900, yearly: 29000 },
    // Add Stripe Price IDs
    stripePriceIdMonthly: 'price_1ABC123monthly',
    stripePriceIdYearly: 'price_1ABC123yearly',
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
        // Redirect to Stripe Checkout
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
// core/lib/billing/gateways/stripe.ts

export async function createCheckoutSession(
  params: CreateCheckoutParams
): Promise<Stripe.Checkout.Session> {
  const { teamId, planSlug, billingPeriod, successUrl, cancelUrl } = params

  // Get price ID from config
  const planConfig = BILLING_REGISTRY.plans.find(p => p.slug === planSlug)
  const priceId = billingPeriod === 'yearly'
    ? planConfig.stripePriceIdYearly
    : planConfig.stripePriceIdMonthly

  return getStripe().checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { teamId, planSlug, billingPeriod },
    client_reference_id: teamId,
    // Add trial if configured
    subscription_data: planConfig.trialDays > 0
      ? { trial_period_days: planConfig.trialDays }
      : undefined
  })
}
```

## Webhooks

### Webhook Endpoint

```typescript
// app/api/v1/billing/webhooks/stripe/route.ts

export async function POST(request: NextRequest) {
  const payload = await request.text()
  const signature = request.headers.get('stripe-signature')

  // MANDATORY: Verify signature
  let event: Stripe.Event
  try {
    event = verifyWebhookSignature(payload, signature)
  } catch (error) {
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Handle events
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

### Key Webhook Handlers

#### checkout.session.completed

User completed payment:

```typescript
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const teamId = session.metadata?.teamId
  const subscriptionId = session.subscription as string
  const customerId = session.customer as string

  // Update subscription with Stripe IDs
  await db.query(`
    UPDATE subscriptions
    SET "externalSubscriptionId" = $1,
        "externalCustomerId" = $2,
        "paymentProvider" = 'stripe',
        status = 'active'
    WHERE "teamId" = $3
  `, [subscriptionId, customerId, teamId])
}
```

#### invoice.payment_failed

Payment failed:

```typescript
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription

  await db.query(`
    UPDATE subscriptions
    SET status = 'past_due'
    WHERE "externalSubscriptionId" = $1
  `, [subscriptionId])
}
```

### Webhook Setup

**Local Development:**

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Forward webhooks
stripe listen --forward-to localhost:5173/api/v1/billing/webhooks/stripe
```

Copy the webhook signing secret (starts with `whsec_`).

**Production:**

1. Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://your-app.com/api/v1/billing/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy signing secret to `STRIPE_WEBHOOK_SECRET`

## Plan Changes (Upgrade/Downgrade)

Handle plan upgrades and downgrades with automatic proration:

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
        // Refresh subscription context
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

Stripe handles proration automatically:
- **Upgrade:** User is charged the prorated difference immediately
- **Downgrade:** Credit is applied to the next invoice
- No manual calculation needed - Stripe's `proration_behavior: 'create_prorations'` handles everything

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
// core/lib/billing/gateways/stripe.ts

export async function createPortalSession(
  params: CreatePortalParams
): Promise<Stripe.BillingPortal.Session> {
  return getStripe().billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl
  })
}
```

---

## Subscription Cancellation

Handle subscription cancellation directly (without Stripe Portal):

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

1. **Expire Trials:** Subscriptions where `trialEndsAt < now` → status = `expired`
2. **Handle Past Due:** Subscriptions `past_due` > 3 days → status = `expired`
3. **Reset Usage:** Archive previous month's usage (1st of each month)

## Status Mapping

| Stripe Status | Our Status |
|---------------|------------|
| `trialing` | `trialing` |
| `active` | `active` |
| `past_due` | `past_due` |
| `canceled` | `canceled` |
| `unpaid` | `past_due` |
| `incomplete` | `past_due` |
| `incomplete_expired` | `expired` |
| `paused` | `paused` |

## Security

### Webhook Signature Verification

**Always verify webhook signatures:**

```typescript
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET not configured')
  }
  return getStripe().webhooks.constructEvent(payload, signature, webhookSecret)
}
```

### Idempotency

Handle duplicate webhook events:

```typescript
// Check if event already processed
const existing = await db.query(
  `SELECT id FROM "billingEvents"
   WHERE metadata->>'stripeEventId' = $1`,
  [event.id]
)

if (existing.length > 0) {
  return { received: true, status: 'duplicate' }
}
```

### Lazy Loading

Stripe SDK is lazy-loaded to avoid initialization during build:

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

## Testing

### Test Mode

Use Stripe test mode (API keys starting with `sk_test_` and `pk_test_`).

### Test Cards

| Card | Result |
|------|--------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0341` | Declined |
| `4000 0000 0000 9995` | Insufficient funds |

### Webhook Testing

```bash
# Trigger test event
stripe trigger checkout.session.completed

# View webhook logs
stripe logs tail
```

## Related

- [Configuration](./02-configuration.md) - Stripe Price IDs
- [API Reference](./04-api-reference.md) - Endpoints
- [Lifecycle Management](./06-usage-tracking.md#lifecycle-jobs) - Cron jobs
