# @nextsparkjs/plugin-marketplace-payments

Split a payment between the platform and a connected seller: the buyer pays, the platform keeps a commission and the seller receives the rest. Stripe Connect (Express accounts, destination charges) and MercadoPago (OAuth-connected sellers, `marketplace_fee`).

> **Stability: experimental, and not verified against a provider's sandbox yet.** Signatures and API calls are tested locally, with generated signatures and simulated HTTP clients; run the sandbox plan in the guide before going live. The first-party plugins are not part of the stable 1.0 surface and may change in a minor release. See [Stability](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/01-stability.md).

## What it provides

| | |
| --- | --- |
| Seller connection | Stripe Express onboarding and MercadoPago OAuth, from a seller settings page at `/dashboard/settings/marketplace` |
| Checkout | `createMarketplaceCheckout` (server code) prices nothing itself: you pass the amount, the plugin computes the commission and creates the provider checkout |
| Refunds | `refundMarketplacePayment`, whole or partial |
| Webhooks | Signature-verified and processed once, for both providers |
| Seller credentials | Tokens encrypted at rest with a rotatable keyring and renewed by a scheduled action |
| Isolation | A seller's data is isolated by row-level security |
| Admin | A superadmin overview at `/superadmin/marketplace` |

## Installation

1. Add the package and enable it:

   ```bash
   pnpm add @nextsparkjs/plugin-marketplace-payments
   ```

   ```ts
   // nextspark.config.ts
   export default defineConfig({ plugins: ['@nextsparkjs/plugin-marketplace-payments'] })
   ```

   Add the package to `transpilePackages` in your Next config; `nextspark prepare` tells you if it is missing.

2. Run `pnpm db:migrate`, set the `MARKETPLACE_*` variables, register the plugin's scheduled actions in your project and link to the seller page from your navigation. Each step, with the variables and the provider setup, is in the guide.

## Requirements

- `@nextsparkjs/core` `>=0.1.0-beta.201`, with Next.js `~16.4.2` and React `^19.2.0`
- Peer dependencies: `@tanstack/react-query` `^5.85.0`, `next-intl` `^4.3.4` and `zod` `^4.6.6`
- Node.js 22.14.0 or later
- Standard PostgreSQL 15 to 18 (see the [support matrix](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/02-support-matrix.md))
- A Stripe account with Connect, or a MercadoPago application, with test credentials for the sandbox run
- Team roles with the `team.billing.manage` permission: the seller page and its routes answer 403 without it

## Documentation

- [Marketplace payments guide](./docs/01-getting-started/01-marketplace-payments.md): installation, charging a buyer, variables, key rotation, provider setup, the sandbox run and what the plugin does not cover
- [Changelog](./CHANGELOG.md)
- [Plugin system](https://www.nextspark.dev/docs/plugin-system/introduction) in the NextSpark documentation

## Tests

```bash
pnpm --filter @nextsparkjs/plugin-marketplace-payments test
```

PostgreSQL's `initdb` and `pg_ctl` must be on the `PATH` for the RLS suite.

## License

MIT
