---
title: Paddle
description: Bill subscriptions through Paddle Billing
---

# Paddle

> **Experimental:** Billing is not part of the stable 1.0 surface and may change without a deprecation period.

`provider: 'paddle'` bills through [Paddle Billing](https://www.paddle.com/billing) (the current API, not Paddle Classic). The gateway (`lib/billing/gateways/paddle.ts`) calls Paddle's REST API with `fetch`; there is no SDK to install. The factory imports it only when it is the configured provider, so projects on another provider do not ship it.

## Setup

### 1. Billing config

```typescript
// config/billing.config.ts
export const billingConfig: BillingConfig = {
  provider: 'paddle',
  // ...
  plans: [
    {
      slug: 'pro',
      // ...
      providerPriceIds: {
        monthly: 'pri_01h...', // Paddle price ids
        yearly: 'pri_01h...',
      },
    },
  ],
}
```

### 2. Plans map to prices

In Paddle, create one product per plan (Catalog → Products) and one recurring price per interval. Put each price id (`pri_...`) in the plan's `providerPriceIds`. Sandbox and live are separate accounts, so each has its own price ids: a project keeps one set per environment (for example by reading them from the environment in `billing.config.ts`).

A webhook binds a subscription to a team only when one of its items has a plan's price. A subscription of any other price (a recurring add-on) is never applied to a team's row.

### 3. Environment variables

```bash
PADDLE_API_KEY=pdl_sdbx_apikey_...   # Developer tools → Authentication
PADDLE_WEBHOOK_SECRET=pdl_ntfset_... # the secret key of the notification destination
PADDLE_ENVIRONMENT=sandbox           # sandbox or production
# PADDLE_TEAM_TOKEN_SECRET=          # optional: the key of the checkout team token; defaults to the webhook secret
# PADDLE_WEBHOOK_TOLERANCE_SECONDS=5 # optional: the signature's timestamp window, an integer from 5 to 300 seconds
```

All three are required. They are checked when the factory selects the gateway; one error names every missing or malformed variable, never a value. An API key whose prefix names the other environment (`pdl_sdbx_` with `production`, `pdl_live_` with `sandbox`) is refused; keys made before Paddle added the prefix are accepted for either. A production build (`NODE_ENV=production`) with `PADDLE_ENVIRONMENT=sandbox` logs a warning: fine for staging, never for a live site.

The browser needs no Paddle variable from core. The payment link page (below) loads Paddle.js with a client-side token of its own, for example `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`.

### 4. Default payment link

Paddle opens a checkout on a page of your own site that loads Paddle.js. Under Paddle → Checkout → Checkout settings, set the **default payment link** to that page; the domain must be approved (Paddle → Settings → Website approval). Core ships no such page: the project owns it, with its own client-side token.

Without a default payment link Paddle creates no checkout URL: `POST /api/v1/billing/checkout` answers `500 Failed to process checkout`, and the server log shows `Paddle returned no checkout URL for transaction txn_…: set a default payment link (Paddle > Checkout > Checkout settings)`. A link to a page that does not initialise Paddle.js, or a domain that is not approved, shows up instead as a page where no checkout opens.

The gateway creates a transaction and sends the user to its `checkout.url`: the default payment link with `?_ptxn=<transaction id>`. On that page Paddle.js opens the checkout for the transaction by itself:

```html
<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
<script>
  // Paddle.Environment.set('sandbox') in the sandbox
  Paddle.Initialize({
    token: '<client-side token>',
    checkout: { settings: { successUrl: 'https://<your-app>/dashboard/settings/billing?success=true' } },
  })
</script>
```

A transaction has no success or cancel URL: the page sets them. The `successUrl` and `cancelUrl` the checkout route passes are not used by Paddle.

**Next.js App Router example.** A client page at the default payment link, for example `app/(public)/pay/page.tsx` with the link set to `https://<your-app>/pay`. It uses Paddle's loader package (`pnpm add @paddle/paddle-js`), which downloads Paddle.js from Paddle's CDN, and opens the checkout for the transaction in `?_ptxn=`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { initializePaddle } from '@paddle/paddle-js'

export default function PayPage() {
  const transactionId = useSearchParams().get('_ptxn')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
    if (!transactionId || !token) {
      setFailed(true)
      return
    }
    const id = transactionId
    initializePaddle({
      // a sandbox client-side token needs the sandbox environment
      environment: process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
      token,
      // Paddle sends the buyer here once the checkout completes
      checkout: { settings: { successUrl: `${window.location.origin}/dashboard/settings/billing?success=true` } },
    }).then((paddle) => {
      if (paddle) paddle.Checkout.open({ transactionId: id })
      else setFailed(true)
    })
  }, [transactionId])

  return <main>{failed ? <p>The checkout could not be opened.</p> : <p>Opening the checkout…</p>}</main>
}
```

- `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` is a **client-side token** (Developer tools → Authentication), never the API key. It is public by design.
- `NEXT_PUBLIC_PADDLE_ENVIRONMENT` mirrors `PADDLE_ENVIRONMENT` for the browser; a sandbox token opens no checkout in the production environment and the other way round.
- `useSearchParams` needs a `<Suspense>` boundary above it when the route is statically rendered: wrap the page's content in one, or read `searchParams` in a server page and pass the id down.
- Serve the page under a path the app's proxy lets signed-out users open if buyers can reach it without a session (Paddle's own emails link to it to update a payment method).

### 5. Webhook

Under Developer tools → Notifications, add a destination:

- URL: `https://<your-app>/api/v1/billing/webhooks/paddle`
- Events: `subscription.created`, `subscription.activated`, `subscription.updated`, `subscription.canceled`, `subscription.paused`, `subscription.resumed`, `subscription.past_due`, `subscription.trialing`, `transaction.completed`, `transaction.paid`, `transaction.payment_failed`
- Copy its secret key into `PADDLE_WEBHOOK_SECRET`.

Paddle expects a `200` within five seconds and retries a failed delivery (3 times in 15 minutes in the sandbox, 60 times over 3 days live). It also recommends accepting webhooks only from its IP addresses; that allowlist belongs in your firewall or proxy, not in the app.

## What the gateway does

| Method | Paddle call |
|---|---|
| `createCheckoutSession` | `POST /transactions` with the plan's price and the team in `custom_data`; returns the transaction id and `checkout.url` |
| `createOneTimeCheckout` | `POST /transactions` with the price, quantity and metadata in `custom_data` |
| `createPortalSession` | `POST /customers/{id}/portal-sessions`; returns `urls.general.overview` (temporary, not stored; no return URL) |
| `getCustomer` / `createCustomer` | `GET /customers/{id}` / `POST /customers` (metadata as `custom_data`) |
| `updateSubscriptionPlan` | `GET` then `PATCH /subscriptions/{id}`: the plan's price is swapped and other items (add-ons) kept, since `items` replaces the whole list. `create_prorations` → `prorated_next_billing_period`, `always_invoice` → `prorated_immediately`, `none` → `full_next_billing_period` |
| `cancelSubscriptionAtPeriodEnd` | `POST /subscriptions/{id}/cancel` with `effective_from: next_billing_period` (a scheduled change; stays active until then) |
| `cancelSubscriptionImmediately` | `POST /subscriptions/{id}/cancel` with `effective_from: immediately` |
| `reactivateSubscription` | `PATCH /subscriptions/{id}` with `scheduled_change: null` (removes the scheduled cancellation) |
| `verifyWebhookSignature` | `Paddle-Signature` (below) |

Base URL `https://sandbox-api.paddle.com` or `https://api.paddle.com` by `PADDLE_ENVIRONMENT`; `Authorization: Bearer <PADDLE_API_KEY>`, `Paddle-Version: 1`, 15 s timeout. An API error is `Paddle API <METHOD> <path> failed with status <n>: <code>: <detail>`, never the key. The team's customer id is passed to a transaction only when it is Paddle's (`ctm_...`), so a team that used another provider before starts a new Paddle customer.

## The webhook

`POST /api/v1/billing/webhooks/paddle`:

1. Reads the raw body and verifies `Paddle-Signature` before parsing anything: the header is `ts=<unix seconds>;h1=<hex>`, and `h1` is the HMAC-SHA256 of `<ts>:<raw body>` with the destination's secret. During a secret rotation Paddle sends one `h1` per secret; any one matching is enough. The comparison is constant-time, and a timestamp more than five seconds from the server's clock is refused (Paddle's SDKs use the same tolerance), so a captured delivery cannot be replayed later. A missing, malformed, wrong or stale signature answers `400` and nothing is claimed or written. Keep the server clock synchronised (NTP).

   `PADDLE_WEBHOOK_TOLERANCE_SECONDS` widens the window (an integer from 5 to 300). A value outside that range logs a warning when the gateway is selected, naming the variable, and the five-second default is used. Paddle's docs do not say whether a retry or a dashboard replay is signed again with a new `ts`; step 6 of the manual plan records it. Widen the window only if that record shows retries refused as stale, or a clock you cannot keep in sync: the wider it is, the longer a captured delivery could be replayed (a replayed event is still deduplicated by its `event_id`).
2. A handled event without `data.id` or `occurred_at` answers `400`: it can be neither bound nor ordered.
3. Claims the event once in `billing_webhook_events` (see [webhook deduplication](./05-payment-integration.md#webhook-deduplication)) and applies it.

### Idempotency key and order

The key is Paddle's `event_id` (`evt_...`). Paddle documents it as the id to deduplicate by, and documents that a replay creates a new notification for the same `event_id`; a retry is a new delivery of the same event. Each delivery has its own `notification_id`, which is not used. A redelivery answers `200 {"received":true,"status":"duplicate"}`.

Paddle does not guarantee the order of delivery. Each subscription row stores the `occurred_at` of the last event applied to it (`metadata.paddleOccurredAt`), and an older event of the same subscription does not move it back. The comparison is done in Postgres, at microsecond precision. Transaction events only record payments, so their order does not matter.

### Events

Every subscription event carries the whole subscription entity: the row is set from it (`externalSubscriptionId`, `externalCustomerId`, `paymentProvider = 'paddle'`, `status`, `cancelAtPeriodEnd`, `canceledAt`, `currentPeriodStart`/`End` from `current_billing_period`, `trialEndsAt` when trialing, `planId`/`billingInterval` from the plan's price).

| Event | Row | `billing_events` |
|---|---|---|
| `subscription.created` | bound to the team, set | lifecycle / succeeded |
| `subscription.updated` | set (a scheduled cancellation sets `cancelAtPeriodEnd`) | — |
| `subscription.activated`, `.trialing`, `.past_due`, `.paused`, `.resumed` | set | lifecycle / succeeded |
| `subscription.canceled` | `canceled`, `cancelAtPeriodEnd = false`, `canceledAt` | lifecycle / succeeded |
| `transaction.paid`, `transaction.completed` | — | payment / succeeded, once per transaction (`externalPaymentId` = transaction id, amount = `details.totals.grand_total`) |
| `transaction.payment_failed` | — | payment / failed, one per failed attempt |
| `adjustment.created`, `adjustment.updated` (refunds, credits, chargebacks) | — | not recorded: a refunded payment stays `succeeded` |
| anything else | — | — (`200`, recorded as processed) |

Status map: `active` → `active`, `trialing` → `trialing`, `past_due` → `past_due`, `paused` → `paused`, `canceled` → `canceled`. A scheduled cancellation keeps the subscription `active` with `cancelAtPeriodEnd = true` until it takes effect. Payment events do not change the status: Paddle sends `subscription.past_due` and `subscription.updated` with every status change, and those carry the order the row needs.

### How the team is bound

- Paddle copies a transaction's `custom_data` to the subscription created from it, and from the subscription to its renewals. The gateway puts `teamId` and `teamToken` there. Custom data can also come from the browser (Paddle.js `customData`), so the webhook trusts `teamId` only with a valid `teamToken`: HMAC-SHA256 of `nextspark-paddle-team:<teamId>:<priceId>` with `PADDLE_TEAM_TOKEN_SECRET` (else the webhook secret), compared in constant time. The price is the subscription's plan price, so a token from a checkout of another price does not bind a plan subscription.
- A subscription event updates the row bound to that Paddle subscription. Only when there is none, and the subscription has a plan's price and a valid token, it is bound to the team's current row, or else its latest row (a team whose previous subscription ended is activated again). A current row already bound to another live subscription, of Paddle or of another provider, is not taken over: a team switching providers cancels the old subscription first.
- A late delivery of an older subscription cannot reactivate an ended row: an unbound subscription that is `canceled` binds nothing, and an event older than the last Paddle event applied to an ended row (`metadata.paddleOccurredAt`) is ignored. Live retries run for three days, so subscription A's events can arrive after A ended and B was bound and ended too.
- A payment is recorded on the row of its `subscription_id`. A first payment that arrives before `subscription.created`, or a one-time purchase, is recorded on the team's row when its token is valid, without changing the row.
- Custom data that names another team than the bound row's: ignored.
- An event that cannot be applied answers `200` and writes nothing. When it names a team (it looks like ours), it is logged as an error: a payment may not be applied.
- Rotating `PADDLE_WEBHOOK_SECRET` invalidates the tokens of checkouts not yet paid, unless `PADDLE_TEAM_TOKEN_SECRET` is set; keep that one across rotations.

### One-time purchases

`createOneTimeCheckout` creates a transaction for any price. Its payment is recorded as `payment / succeeded` on the team's row. There is no `billing.webhookExtensions.paddle` hook yet: a project that sells credit packs through Paddle grants them from its own handler for now.

## Sandbox and production

Paddle's sandbox and live are separate accounts, each with its own API keys, notification destinations and secrets, and its own base URL. Nothing in a webhook payload says which one sent it, so the separation is by secret:

- A deployment verifies webhooks with `PADDLE_WEBHOOK_SECRET`, the secret of its own environment's destination. An event of the sandbox destination is signed with the sandbox secret and answers `400` on a production deployment.
- `PADDLE_ENVIRONMENT` has no default, and a key of the other environment is refused at selection: a production deployment cannot run on a sandbox key, and a failed selection also answers webhooks with `400`.
- Never copy the sandbox secret or key into production settings. Use separate environment files (or a separate set of secrets per deployment) for staging and production.

## Manual test plan (sandbox)

The automated tests use hand-built payloads in the documented shapes, never a real Paddle account. Before relying on the integration, a person runs this once against a Paddle sandbox account:

1. **Catalog.** In the sandbox, create a product "Pro" with a monthly and a yearly price, and a one-time price "Credits". Put the two recurring price ids in `providerPriceIds` of `pro`.
2. **Payment link page.** Add a page that loads Paddle.js as above (sandbox environment, client-side token), approve the domain (a tunnel URL, for example `cloudflared tunnel --url http://localhost:3000`) and set it as the default payment link.
3. **Environment.** Set `PADDLE_API_KEY` (sandbox), `PADDLE_WEBHOOK_SECRET`, `PADDLE_ENVIRONMENT=sandbox`; start the app; add the notification destination with the tunnel URL and the events above.
4. **Misconfiguration.** Set `PADDLE_ENVIRONMENT=production` with the sandbox key and open the upgrade: the server log names `PADDLE_API_KEY` and `PADDLE_ENVIRONMENT`, no value. Restore it.
5. **Checkout.** As a team owner, upgrade to Pro monthly and pay with Paddle's test card. Expected: the notification log shows `transaction.paid`, `subscription.created`, `subscription.activated` and `transaction.completed` answered `200`; the team's row has `paymentProvider = 'paddle'`, the `sub_...` id, plan `pro`, `billingInterval = 'monthly'`; `billing_events` has lifecycle rows and one `payment / succeeded` row for the transaction. Open the `subscription.created` payload and record that `custom_data` carries `teamId` and `teamToken`. Repeat with a price that has tax (a buyer address in a taxed country) and with a discount, and compare the payment row's `amount` (`details.totals.grand_total`) with the amount the Paddle dashboard shows as charged for that transaction; record both. If they differ, the field to use is `details.totals.total` or `payout_totals`.
6. **Replay and retry.** Replay `subscription.created` from the notification log. Expected: `200 {"received":true,"status":"duplicate"}`, no new rows. Then force a failed delivery: stop the tunnel, trigger an event (for example change the plan), wait for Paddle to log the failed attempt, start the tunnel again and wait for the automatic retry. Expected: the retry is answered `200`. For both the replay and the retry, record the `ts` of the `Paddle-Signature` header (log it temporarily, or read it in the notification log) against the time the request arrived: a `ts` close to the arrival means each delivery is signed again, and five seconds is enough; a `ts` of the first attempt means retries need `PADDLE_WEBHOOK_TOLERANCE_SECONDS`.
7. **Bad and stale signature.** `curl -X POST <url> -H 'Paddle-Signature: ts=1;h1=00' -d '{}'`. Expected: `400 {"error":"Invalid signature"}`. Resend a captured body with its original header a minute later: `400`.
8. **Portal.** Open "Manage billing". Expected: the Paddle customer portal of that customer.
9. **Change plan.** Change to Pro yearly from the app. Expected: `subscription.updated`, `billingInterval = 'yearly'`; any other item on the subscription is still there.
10. **Cancel and resume.** Cancel from the app (at period end). Expected: `subscription.updated` with a scheduled change, `cancelAtPeriodEnd = true`, status `active`. Reactivate. Expected: `cancelAtPeriodEnd = false`.
11. **Immediate cancel.** `POST /api/v1/billing/cancel` with `{"immediate": true}` on a second team. Expected: `subscription.canceled`, `status = 'canceled'`.
12. **Payment failure.** Subscribe a third team, then make a renewal fail (the sandbox's declining test card, or change the next billing date with a failing card). Expected: `transaction.payment_failed` → `payment / failed`; `subscription.past_due` → `past_due`.
13. **A new subscription after the end.** Upgrade the team of step 11 again. Expected: the same row is `active` on the new `sub_...` id.
14. **Hand-made custom data.** Open a Paddle.js checkout of the Pro price with `customData: { teamId: '<another team>' }`. Expected: the payment goes through in Paddle, the webhook logs an error naming the team, and no row changes.
15. **Sandbox into production.** Point a sandbox destination at a deployment with `PADDLE_ENVIRONMENT=production` and its live secret. Expected: every delivery `400`.
16. Record the notification log, the rows and the server log of each step with the result.

## Related

- [Payment Provider Integration](./05-payment-integration.md): the gateway factory and webhook deduplication
- [Configuration](./02-configuration.md): `billing.config.ts`
- [Lemon Squeezy](./09-lemon-squeezy.md): the same team binding, for Lemon Squeezy
