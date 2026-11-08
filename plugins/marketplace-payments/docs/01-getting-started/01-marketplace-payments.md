# Marketplace Payments

Split a payment between the platform and a connected seller: the buyer pays, the platform keeps a commission and the seller receives the rest.

| Provider | Seller connection | Split |
| --- | --- | --- |
| Stripe Connect | Express account | Destination charge with `application_fee_amount` |
| MercadoPago | OAuth | Checkout preference created with the seller's token, with `marketplace_fee` |

**Status: not verified against a provider's sandbox yet.** Signatures and API calls are tested locally, with generated signatures and simulated HTTP clients. Run the [sandbox plan](#sandbox-run) before going live.

## Installation

1. Add the package and enable it:

   ```bash
   pnpm add @nextsparkjs/plugin-marketplace-payments
   ```

   ```ts
   // nextspark.config.ts
   export default defineConfig({ plugins: ['@nextsparkjs/plugin-marketplace-payments'] })
   ```

   Add the package to `transpilePackages` in your Next config. `nextspark prepare` tells you if it is missing.

2. Run the migration: `pnpm db:migrate`. It adds `marketplace_accounts`, `marketplace_seller_credentials`, `marketplace_payments` and `marketplace_oauth_states`.

3. Set the [variables](#variables).

4. Register the scheduled actions in your project's scheduled-actions module:

   ```ts
   import { registerMarketplacePaymentsActions, scheduleMarketplacePaymentsActions } from '@nextsparkjs/plugin-marketplace-payments/lib/scheduled-actions'

   export function registerAllHandlers() {
     registerMarketplacePaymentsActions()
   }

   export async function registerRecurringActions() {
     await scheduleMarketplacePaymentsActions()
   }
   ```

5. Link to the seller page, `/dashboard/settings/marketplace`, from your navigation: core's settings sidebar only lists its own pages. The superadmin page, `/superadmin/marketplace`, adds itself to the superadmin sidebar.

## Charging a buyer

No route of the plugin takes an amount. Your server code prices what is sold and calls `createMarketplaceCheckout`; the commission is computed there, from the variables below or from the `commission` you pass from server code:

```ts
// api/orders/[id]/checkout/route.ts in your project
import { createMarketplaceCheckout } from '@nextsparkjs/plugin-marketplace-payments/lib/checkout'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // authenticate, then load the order from YOUR database: never read the price from the request
  const order = await loadOrder((await params).id)
  const { checkoutUrl } = await createMarketplaceCheckout({
    sellerTeamId: order.sellerTeamId,
    provider: 'stripe',
    amountCents: order.totalCents,
    currency: order.currency,
    description: order.title,
    successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/orders/${order.id}`,
    cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/orders/${order.id}`,
  })
  return Response.json({ checkoutUrl })
}
```

`refundMarketplacePayment` (same module) refunds a payment whole or in part. Stripe reverses the transfer and returns the fee in proportion. The status changes when the provider's webhook arrives.

Rounding: the percentage rounds half up to a whole cent, then the fixed part, the minimum and the maximum apply, and the commission never exceeds the amount.

## Variables

| Variable | Required | Notes |
| --- | --- | --- |
| `MARKETPLACE_COMMISSION_BPS` | To charge | Basis points: `1000` is 10%. There is no default |
| `MARKETPLACE_COMMISSION_FIXED_CENTS`, `_MIN_CENTS`, `_MAX_CENTS` | No | Minor units |
| `MARKETPLACE_STRIPE_SECRET_KEY` | Stripe | |
| `MARKETPLACE_STRIPE_WEBHOOK_SECRETS` | Stripe | Comma-separated: the platform endpoint's and the connected-accounts endpoint's |
| `MARKETPLACE_MERCADOPAGO_CLIENT_ID`, `_CLIENT_SECRET` | MercadoPago | From the MercadoPago application |
| `MARKETPLACE_MERCADOPAGO_WEBHOOK_SECRETS` | MercadoPago | The application's webhook signature secret, comma-separated |
| `MARKETPLACE_MERCADOPAGO_SANDBOX` | No | `true` sends buyers to `sandbox_init_point` |
| `MARKETPLACE_TOKEN_KEYS` | MercadoPago | `<id>:<base64 of 32 bytes>`, comma-separated; the first one encrypts |

Without a webhook secret, every webhook of that provider is refused.

### Rotating the token key

1. Put a new key first: `MARKETPLACE_TOKEN_KEYS=k2:<new>,k1:<old>`, and deploy.
2. The daily action `marketplace-payments:rotate-token-keys` re-encrypts the rows; a seller's row with a problem is reported by the action and left as it was.
3. When no row is on the old key, remove it.

## Provider setup

**Stripe.** Create two webhook endpoints, both at `https://<your-domain>/api/plugins/marketplace-payments/webhooks/stripe`, with the API version in `lib/stripe/api-version.ts`:

- *Your account*: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`.
- *Connected accounts*: `account.updated`, `account.application.deauthorized`.

Put both signing secrets in `MARKETPLACE_STRIPE_WEBHOOK_SECRETS`.

**MercadoPago.** In the application:

- Redirect URL: `https://<your-domain>/api/plugins/marketplace-payments/oauth/mercadopago/callback`.
- Enable webhooks to get the signature secret. Each checkout sets its own notification URL, so the URL configured in the application is not used for payments.

## Sandbox run

Needs the variables above with test credentials, and a public HTTPS URL for the app (a tunnel works).

**Stripe**

1. In test mode, as a team owner, open `/dashboard/settings/marketplace` and connect Stripe. Complete onboarding with test data. The account becomes *Active* when `account.updated` arrives.
2. Call a route of yours with `createMarketplaceCheckout` for that team, and pay with `4242 4242 4242 4242`.
3. Check: the payment is *Paid* in the history; in Stripe the payment has the expected application fee and the transfer goes to the seller.
4. Refund it from Stripe and check it becomes *Refunded*. Resend an event from the Stripe dashboard and check nothing changes.

**MercadoPago**

1. Create test users for the seller and the buyer. As a team owner, sign in to MercadoPago as the seller and connect it from the settings page.
2. Create a checkout for that team, and pay as the buyer with a test card.
3. Check: the payment is *Paid*, and the `application_fee` the plugin compares (`fee_details`) is on the payment as this plugin expects. If `init_point` is refused for test users, set `MARKETPLACE_MERCADOPAGO_SANDBOX=true`.
4. Check that a request from MercadoPago carries `x-signature` and `x-request-id` (the handler refuses it otherwise). Check that `marketplace-payments:refresh-mercadopago-tokens` renews a token: set its `expiresAt` close in a test database.

## What it does not cover

- Sandbox or production runs against the real providers (see above).
- A route that takes an amount, by design; a shopping cart or order model.
- Tiered commissions or per-seller rates stored by the plugin. Pass `commission` from your server code.
- Payouts schedules, or the balance of a seller. The provider's dashboard shows them.
- A refund button in the UI: `refundMarketplacePayment` is for your server code.
- A seller's MercadoPago deauthorization is noticed at the next token refresh, not when it happens, because the request's body is not signed.
- Deleting a team deletes its marketplace rows, like its other data.
- MercadoPago's signature has no timestamp window here: a replay only makes the handler re-read the payment from the API.
