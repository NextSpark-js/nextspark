---
title: Custom gateway and no-gateway mode
description: Bill through your own payment gateway, or run billing without one
---

# Custom gateway and no-gateway mode

> **Experimental:** Billing is not part of the stable 1.0 surface and may change without a deprecation period.

`provider` in `billing.config.ts` takes one of the built-in gateways (`stripe`, `polar`, `lemonsqueezy`, `paddle`), `'none'`, or the name of a gateway your project registers. The four built-in gateways behave exactly as before when you do nothing.

## Register your own gateway

A gateway is an object that implements `BillingGateway` (`@nextsparkjs/core/lib/billing/gateways/custom` exports the interface and the parameter types). Register it once, at server startup, under a name, and use that name as the provider:

```typescript
// instrumentation.ts
import { register as registerCore } from '@nextsparkjs/core/instrumentation'

export async function register() {
  await registerCore()
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerBillingGateway } = await import('@nextsparkjs/core/lib/billing/gateways/custom')
    // The factory runs on first use; the dynamic import keeps the gateway out of other bundles
    registerBillingGateway('acme', async () => (await import('./lib/billing/acme-gateway')).createAcmeGateway())
  }
}
```

```typescript
// config/billing.config.ts
export const billingConfig: BillingConfig = {
  provider: 'acme',
  // plans, features, limits ...
}
```

- A name is 2 to 32 lowercase letters, digits, `-` or `_`, starting with a letter. `none` is reserved.
- A registered name is resolved before the built-in list, so registering `stripe` replaces the built-in Stripe gateway. Registering a name again replaces the earlier registration. Replacing a built-in name logs one warning.
- Register from server code only. `billing.config.ts` is read by client components: keep the gateway, its keys and its SDK out of it.
- An unregistered name still fails with `Unsupported billing provider: "<name>". Supported providers: stripe, polar, lemonsqueezy, paddle...` (the registered names are added to that list).

### The contract

When the gateway loads (the first time something asks for it), core checks that every member below is a function and refuses the gateway with `InvalidBillingGatewayError` (exported from the same entry), naming the missing members, before any call reaches it. A malformed gateway therefore fails when it loads, not in the middle of a charge.

| Member | What it does |
| --- | --- |
| `createCheckoutSession(params)` | Starts a subscription checkout; returns `{ id, url }`. |
| `createOneTimeCheckout(params)` | Starts a one-time payment checkout. |
| `createPortalSession(params)` | Opens the provider's self-service portal for a customer. |
| `getCustomer(id)`, `createCustomer(params)` | Read and create the provider's customer. |
| `updateSubscriptionPlan(params)` | Moves a subscription to another price. |
| `cancelSubscriptionAtPeriodEnd(id)`, `cancelSubscriptionImmediately(id)`, `reactivateSubscription(id)` | Cancellation and its undo. Throw `BillingOperationNotSupportedError` for what the provider cannot do (the route answers 400 `NOT_SUPPORTED`). |
| `getProviderName()` | The human-readable name. |
| `getResourceHintDomains()` | `{ preconnect, dnsPrefetch }` origins for the page head; return empty lists if there are none. |
| `getSubscriptionDashboardUrl(id)` | A link to the subscription in the provider's dashboard, or `null`. |
| `verifyWebhookSignature(payload, headers)` | Verifies the signature of a webhook and returns `{ id, type, data }`. **Required.** It must throw when the signature is missing or wrong. |

`verifyWebhookSignature` is part of the contract on purpose: a gateway that does not verify webhooks is refused.

### Webhooks

Core adds no webhook endpoint for a custom gateway, and its four built-in webhook routes answer `404` whenever the provider is not one of the four built-ins (a registered gateway named `stripe` keeps the Stripe route). Add the route to your project and start it with `verifyBillingWebhook`, which reads the raw body, hands the body and all headers to your gateway's `verifyWebhookSignature`, and answers 400 `Invalid signature` before anything else runs:

```typescript
// src/app/api/billing/acme-webhook/route.ts
import { verifyBillingWebhook } from '@nextsparkjs/core/lib/billing/gateways/custom'

export async function POST(request: Request) {
  const verified = await verifyBillingWebhook(request)
  if (!verified.ok) return verified.response

  const { id, type, data } = verified.event
  // apply the event to your subscriptions here (idempotently, keyed by `id`)
  return Response.json({ received: true })
}
```

The log line of a failed verification carries the error name only, never its message. Keep your own logs free of secrets and signatures too. The `subscriptions.paymentProvider` column accepts only the built-in provider names, so a custom gateway's handler leaves it unset.

## No gateway

`provider: 'none'` runs billing without a payment gateway. Core still manages plans, limits, entitlements and usage: plans are assigned by an administrator or by your own code, and `useSubscription`, `useFeature`, `useQuota` and the limit checks work as usual.

What changes:

| Surface | Without a gateway |
| --- | --- |
| `POST /api/v1/billing/checkout`, `portal`, `cancel`, `change-plan` | After authentication, `501` with `code: "BILLING_GATEWAY_DISABLED"` and the message `Billing is not available: this project runs without a payment gateway.` Anonymous callers still get `401`; nothing is read or written. |
| `/api/v1/billing/webhooks/*` | `404` (also with a custom gateway). |
| Pricing table and upgrade modal | The plans are listed with their features and limits, with no select button. |
| Manage billing button | Not rendered. |
| Page head | No `preconnect` or `dns-prefetch` hints. |
| Superadmin subscription views | `providerName` and `providerDashboardUrl` are `null`. |
| Bundle | No gateway module or SDK is loaded. |

`GET /api/v1/billing/plans` and `check-action` are unchanged.
