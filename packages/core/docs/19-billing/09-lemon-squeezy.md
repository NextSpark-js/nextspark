---
title: Lemon Squeezy
description: Bill subscriptions and one-time orders through Lemon Squeezy
---

# Lemon Squeezy

> **Experimental:** Billing is not part of the stable 1.0 surface and may change without a deprecation period.

`provider: 'lemonsqueezy'` bills through [Lemon Squeezy](https://www.lemonsqueezy.com). The gateway (`lib/billing/gateways/lemonsqueezy.ts`) calls Lemon Squeezy's REST API (`https://api.lemonsqueezy.com/v1`, JSON:API) with `fetch`; there is no SDK to install. The factory imports it only when it is the configured provider, so projects on Stripe or Polar do not ship it.

## Setup

### 1. Billing config

```typescript
// config/billing.config.ts
export const billingConfig: BillingConfig = {
  provider: 'lemonsqueezy',
  // ...
  plans: [
    {
      slug: 'pro',
      // ...
      providerPriceIds: {
        monthly: '123456', // Lemon Squeezy variant ids
        yearly: '123457',
      },
    },
  ],
}
```

### 2. Plans map to variants

In Lemon Squeezy a product has variants, and each variant has its own price and billing interval. Create one subscription product per plan with one variant per interval (for example "Pro" with a "Monthly" and a "Yearly" variant), and put each **variant id** in `providerPriceIds`. The id is in the dashboard (Store → Products → the variant's menu → Copy ID) or in `GET /v1/variants`.

- Checkout sells the variant of the plan and interval.
- The webhook finds the plan from the subscription's `variant_id`, so a change of variant (an upgrade in the Lemon Squeezy portal, or `updateSubscriptionPlan`) moves the team to that plan and interval.
- A free trial is a setting of the variant in Lemon Squeezy; `trialDays` in `billing.config.ts` is not sent.
- A variant that is no plan's is a one-time product (see [One-time orders](#one-time-orders)). A subscription of such a variant (a recurring add-on) is never bound to a team's row: the webhook logs it and answers `200`.

### 3. Environment variables

```env
LEMONSQUEEZY_API_KEY=        # Settings -> API; a test-mode key works on test data only
LEMONSQUEEZY_STORE_ID=       # the numeric store id (Settings -> Stores)
LEMONSQUEEZY_WEBHOOK_SECRET= # the signing secret you set on the webhook; use 16 to 40 random characters
# LEMONSQUEEZY_TEAM_TOKEN_SECRET= # optional: the key of the checkout team token; defaults to the webhook secret
# LEMONSQUEEZY_ACCEPT_TEST_MODE=true # optional: a production build on test data (staging, previews) applies test-mode events
```

The first three are required. They are checked when the factory selects the gateway (the first `getBillingGateway()` call), and a missing or malformed one fails with an error naming every such variable and never a value, for example `Lemon Squeezy billing is misconfigured: LEMONSQUEEZY_STORE_ID is missing; LEMONSQUEEZY_WEBHOOK_SECRET is missing.` A failed selection is not cached: the next call reads the environment again. Lemon Squeezy accepts a signing secret of 6 characters; one shorter than 16 is logged as a warning at selection (by name, never the value), not refused.

`LEMONSQUEEZY_TEAM_TOKEN_SECRET` keys the team token (see [How the team is bound](#how-the-team-is-bound)). Set it to a long random value so the webhook secret can be rotated without invalidating the checkouts that are open.

### 4. Webhook

In Lemon Squeezy, Settings → Webhooks → add a webhook:

- **Callback URL:** `https://<your-app>/api/v1/billing/webhooks/lemonsqueezy`
- **Signing secret:** the value of `LEMONSQUEEZY_WEBHOOK_SECRET`
- **Events:** `order_created`, `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_resumed`, `subscription_expired`, `subscription_paused`, `subscription_unpaused`, `subscription_payment_success`, `subscription_payment_failed`

## What the gateway does

| `BillingGateway` method | Lemon Squeezy API |
|---|---|
| `createCheckoutSession` | `POST /v1/checkouts` for the plan's variant, with `checkout_data.custom` = `teamId`, `planSlug`, `billingPeriod` and `teamToken`, `checkout_data.email`, and `product_options.redirect_url` = the success URL. Lemon Squeezy has no cancel URL. |
| `createOneTimeCheckout` | the same for `priceId` (a variant id), with the quantity in `variant_quantities` and the metadata in the custom data |
| `createPortalSession` | `GET /v1/customers/:id` → `urls.customer_portal`, pre-signed and valid for 24 hours; it takes no return URL |
| `getCustomer` / `createCustomer` | `GET /v1/customers/:id` / `POST /v1/customers` (name defaults to the email) |
| `updateSubscriptionPlan` | `PATCH /v1/subscriptions/:id` with `variant_id`; `prorationBehavior: 'none'` → `disable_prorations`, `'always_invoice'` → `invoice_immediately` |
| `cancelSubscriptionAtPeriodEnd` | `DELETE /v1/subscriptions/:id`: the subscription is `cancelled` and runs until `ends_at` |
| `cancelSubscriptionImmediately` | **not supported**: Lemon Squeezy always keeps the grace period, so it throws `BillingOperationNotSupportedError`, and `POST /api/v1/billing/cancel` with `immediate: true` answers `400` with `code: 'NOT_SUPPORTED'` and the message |
| `reactivateSubscription` | `PATCH /v1/subscriptions/:id` with `cancelled: false` (before `ends_at`) |
| `verifyWebhookSignature` | `X-Signature` is the hex HMAC-SHA256 of the raw body with the signing secret, compared in constant time |

API errors are thrown as `Lemon Squeezy API <METHOD> <path> failed with status <n>: <detail>`, with the detail from the JSON:API `errors` array and never the key. Requests time out after 15 seconds.

## The webhook

`POST /api/v1/billing/webhooks/lemonsqueezy` (rate limit tier `webhook`):

1. Reads the raw body and verifies `X-Signature` before parsing it. No signature, or a wrong one: `400`, and nothing is written.
2. Claims the event once in `billing_webhook_events` with `processWebhookEventOnce('lemonsqueezy', ...)` (see [Webhook Deduplication](./05-payment-integration.md#webhook-deduplication)). A replay answers `200 { status: 'duplicate' }`; a handler that fails releases the claim, rolls back its writes and answers `500`, so Lemon Squeezy retries.
3. In production (`NODE_ENV=production`), ignores a test-mode event (`meta.test_mode: true`) unless `LEMONSQUEEZY_ACCEPT_TEST_MODE=true`: it answers `200 { status: 'ignored_test_mode' }`, logs an error once per process and writes nothing, so a store's test-mode webhook pointed at production never grants entitlements for test payments.
4. Refuses with `400` an event it maps (below) that has no `data.id` or no `data.attributes.updated_at`, with an error log and nothing claimed: it can be neither keyed apart from other events nor ordered, and the 400 shows the delivery as failed in Lemon Squeezy's webhook log instead of hiding it behind a 200.
5. Ignores an event whose `data.attributes.store_id` is not `LEMONSQUEEZY_STORE_ID`.
6. Maps the event as below. An event not listed is answered `200` and recorded as processed. `order_refunded`, `subscription_payment_refunded` and `subscription_payment_recovered` are not handled: a refund changes no row and calls no extension (a refunded one-time purchase stays granted), and `recovered` always comes with `subscription_payment_success`, which is handled.

### Idempotency key

Lemon Squeezy deliveries carry no event id: `meta` has `event_name`, `custom_data`, `test_mode` and `webhook_id`, which names the webhook endpoint, not the event. The event id is derived from the event, the object it carries and the raw body:

```
<meta.event_name>:<data.type>:<data.id>:<data.attributes.updated_at>:<SHA-256 hex of the raw body>
e.g. subscription_updated:subscriptions:12345:2026-10-01T10:00:00.000000Z:9f86d08188...
```

A redelivery (a retry, or a resend from the dashboard) is byte-identical, so it has the same id and is a duplicate. `updated_at` has a resolution of one second (`.000000Z`), and Lemon Squeezy sends `subscription_updated` after nearly every change, so two changes of one subscription within a second (a plan change and its payment, a change and a cancel) share the first four parts; their bodies differ, so the hash keeps them apart and both are applied. The first four parts keep the id readable in logs. Lemon Squeezy retries a failed delivery three times (about 5, 25 and 125 seconds later), far inside the retention of processed events.

### Events

Every subscription event carries the whole subscription object, and the row is set from its current attributes: `externalSubscriptionId`, `externalCustomerId`, `paymentProvider = 'lemonsqueezy'`, `status`, `cancelAtPeriodEnd`, `canceledAt`, `currentPeriodEnd` (`ends_at`, else `renews_at`), `trialEndsAt`, and `planId` / `billingInterval` from the variant.

| Event | Subscription row | `billing_events` |
|---|---|---|
| `subscription_created` | bound to the team (see below), set from the object | `lifecycle` / `succeeded` |
| `subscription_updated` | set from the object | none |
| `subscription_cancelled` | `cancelAtPeriodEnd = true`, `canceledAt` set, status stays `active` until it expires | `lifecycle` / `succeeded` |
| `subscription_resumed` | `cancelAtPeriodEnd = false`, `canceledAt` cleared | `lifecycle` / `succeeded` |
| `subscription_expired` | `status = 'expired'` | `lifecycle` / `succeeded` |
| `subscription_paused` | `status = 'paused'` | `lifecycle` / `succeeded` |
| `subscription_unpaused` | set from the object (usually `active`) | `lifecycle` / `succeeded` |
| `subscription_payment_success` | `past_due` → `active` | `payment` / `succeeded`, amount `total`, `externalPaymentId` = invoice id, `invoiceUrl` |
| `subscription_payment_failed` | `active` or `trialing` → `past_due` | `payment` / `failed` |
| `order_created` | none | a one-time order: `payment` / `succeeded` on the team's subscription row, then the project's extension |

Lemon Squeezy statuses map to ours as `on_trial` → `trialing`, `active` → `active`, `paused` → `paused`, `past_due` and `unpaid` → `past_due`, `cancelled` → `active` (with `cancelAtPeriodEnd`), `expired` → `expired`. The `lifecycle` rows carry `{ event, lemonSqueezyEventId, lemonSqueezySubscriptionId }` in `metadata`, the `payment` rows `{ lemonSqueezyEventId, billingReason }`.

An event older than the last one applied to the row (its `updated_at` is earlier than the `metadata.lemonSqueezyUpdatedAt` of the row) does not move the row back, since Lemon Squeezy may deliver a retry after a newer event.

### How the team is bound

The webhook never trusts an id from the payload alone:

- **The team token.** Lemon Squeezy returns a checkout's custom data as `meta.custom_data`, and the payload is signed, but anyone can also put custom data in a checkout link by hand (`?checkout[custom][teamId]=...`). So the checkouts the gateway creates carry `teamToken`, an HMAC-SHA256 of the team id and the checkout's variant id, keyed by `LEMONSQUEEZY_TEAM_TOKEN_SECRET` (or the webhook secret when it is unset). The webhook trusts `custom_data.teamId` only when the token matches that team and the variant the event is about, so a token seen on one checkout cannot bind a subscription or an order of another variant.
- **Subscription events** update the row whose `externalSubscriptionId` is the Lemon Squeezy subscription id (with `paymentProvider = 'lemonsqueezy'`); such a row also takes status and period changes when its variant is no plan's (the plan is kept). Only when no row has it yet, which is `subscription_created` or an event that arrived before it, and only for a plan's variant, the event binds to the verified team: to its current row (`active`, `trialing` or `past_due`), or, when its subscription ended, to its latest row, which is then active again. A current row bound to another live subscription is not taken over, whether it is another Lemon Squeezy subscription or one of another provider. **A team switching providers cancels its old subscription first**; until it has ended, the new one is logged as an error and not applied. A row that is bound and an event whose custom data names another team: ignored. Stripe and Polar bind a new subscription by the same rule (`lib/billing/subscription-binding.ts`).
- **Payment events** update the row of their `subscription_id`. The first payment can arrive before `subscription_created` binds the subscription: when its custom data has a team token valid for one of the plan variants (an invoice names no variant), the payment is recorded on the team's row, once through the claim, and answered `200`; the row's status is left to the subscription events (the `past_due` → `active` flip is only for bound rows). Without a verified team it is ignored.
- **One-time orders** need a team token valid for the order's variant, and a team that exists.
- Anything else (no verified team, an unknown team or subscription, another store): logged and answered `200`, with no row written. Events that look like ours but cannot be applied are logged with `console.error`: a team token that does not match, a verified team with no subscription row, a second live subscription for a team, a subscription of a variant that is no plan's. Each of these may be a payment that was taken and not applied; check them.

Changing the token key (`LEMONSQUEEZY_TEAM_TOKEN_SECRET`, or the webhook secret when that is unset) makes the tokens of open checkouts invalid. Subscriptions already bound are not affected (they are found by their id); a checkout opened before the change and paid after it is not bound, and the event is logged as an error. Keep the token key when you rotate the webhook secret.

### One-time orders

An `order_created` for a paid order whose variant is no plan's is a one-time purchase. The handler logs a `payment` row on the team's latest subscription row and calls the project's extension, declared in `nextspark.config.ts` as for Stripe and Polar (see [Webhook Extensions](./05-payment-integration.md#webhook-extensions)):

```typescript
// nextspark.config.ts
export default defineConfig({
  billing: { webhookExtensions: { lemonsqueezy: './lib/billing/lemonsqueezy-webhook-extensions' } },
})

// lib/billing/lemonsqueezy-webhook-extensions.ts
import type { LemonSqueezyWebhookExtensions } from '@nextsparkjs/core/lib/billing/lemonsqueezy-webhook'

export const lemonsqueezyWebhookExtensions: LemonSqueezyWebhookExtensions = {
  onOneTimePaymentCompleted: async (order, { teamId }) => {
    // order: { id, identifier, total (cents), currency, metadata (the custom data), customerId, productId, variantId }
    if (order.metadata.type === 'credit_pack') await grantCredits(teamId, order)
  },
}
```

Orders of a plan's variant are left to the subscription events Lemon Squeezy sends with them.

## Test mode

Lemon Squeezy's test mode is per API key: a key created in test mode works on the store's test data only, and its checkouts take test cards. Use a test-mode key and a test-mode webhook in development; switch both to live mode for production. `meta.test_mode` says which mode an event came from. With `NODE_ENV=production` the handler ignores test-mode events (`200 { status: 'ignored_test_mode' }`), and the first one in each process is logged as an error naming `LEMONSQUEEZY_ACCEPT_TEST_MODE`, so a misconfigured staging is visible. A production build that runs on test data (staging, previews) opts in with `LEMONSQUEEZY_ACCEPT_TEST_MODE=true`; never set it where live payments arrive. Outside production both modes are applied the same, so a local app can run the whole flow on test data.

## Manual test plan (test mode)

The automated tests use hand-built payloads in the documented shapes, never a real store. Before relying on the integration, a person runs this once against a Lemon Squeezy test-mode store:

1. **Store.** In test mode, create a subscription product "Pro" with a monthly and a yearly variant, and a single-payment product "Credits". Put the two variant ids in `providerPriceIds` of `pro`.
2. **Environment.** Set `LEMONSQUEEZY_API_KEY` (test mode), `LEMONSQUEEZY_STORE_ID` and `LEMONSQUEEZY_WEBHOOK_SECRET`; start the app; expose it with a tunnel (for example `cloudflared tunnel --url http://localhost:3000`) and add the webhook with the tunnel URL and every event above.
3. **Misconfiguration.** Unset `LEMONSQUEEZY_STORE_ID` and open the billing page's upgrade: the server log names `LEMONSQUEEZY_STORE_ID` and no value. Restore it.
4. **Checkout.** As a team owner, upgrade to Pro monthly and pay with the test Visa card. Expected: Lemon Squeezy's webhook log shows `order_created`, `subscription_created` and `subscription_payment_success` answered `200`; the team's row has `paymentProvider = 'lemonsqueezy'`, the Lemon Squeezy subscription id, plan `pro`, `billingInterval = 'monthly'`; `billing_events` has a `lifecycle` row and a `payment` / `succeeded` row. In the webhook log, open the `subscription_payment_success` request body and record whether it carries `meta.custom_data` (the handler needs it to record a first payment that arrives before `subscription_created`).
5. **Replay.** In the webhook log, resend `subscription_created`. Expected: `200 {"received":true,"status":"duplicate"}`, no new rows.
6. **Bad signature.** `curl -X POST <url> -H 'X-Signature: 00' -d '{}'`. Expected: `400 {"error":"Invalid signature"}`.
7. **Portal.** Open "Manage billing". Expected: the Lemon Squeezy customer portal of that customer.
8. **Change plan.** Change to Pro yearly from the app. Expected: `subscription_updated`, the row's `billingInterval = 'yearly'`.
9. **Cancel and resume.** Cancel from the app (at period end). Expected: `subscription_cancelled`, `cancelAtPeriodEnd = true`, status still `active`. Reactivate. Expected: `subscription_resumed`, `cancelAtPeriodEnd = false`.
10. **Immediate cancel.** `POST /api/v1/billing/cancel` with `{"immediate": true}`. Expected: `400` with `code: 'NOT_SUPPORTED'` and a message saying Lemon Squeezy cannot cancel immediately, and the subscription is unchanged in Lemon Squeezy.
11. **Payment failure.** Subscribe a second team with the test card that fails on renewal (or use the dashboard's webhook simulation for `subscription_payment_failed`). Expected: `past_due` and a `payment` / `failed` row.
12. **Expiry and a new subscription.** Cancel and, in the dashboard, end the subscription (or simulate `subscription_expired`). Expected: `status = 'expired'`. Then upgrade the same team again. Expected: the same row is `active` on the new Lemon Squeezy subscription id.
13. **One-time order.** With an extension that logs its input, buy "Credits" through `createOneTimeCheckout`. Expected: `order_created` reaches the extension with the team id; a hand-made checkout link with `?checkout[custom][teamId]=<another team>` does not.
14. Record the webhook log, the rows and the server log of each step with the result.

## Related

- [Payment Provider Integration](./05-payment-integration.md): the gateway factory, webhook deduplication and extensions
- [Configuration](./02-configuration.md): `billing.config.ts`
