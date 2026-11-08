# Marketplace Payments

Split a payment between the platform and a connected seller, with Stripe Connect (Express accounts, destination charges) and MercadoPago (OAuth-connected sellers, `marketplace_fee`).

Installation, variables, the sandbox run and what it does not cover: [docs/01-getting-started/01-marketplace-payments.md](docs/01-getting-started/01-marketplace-payments.md).

Tests: `pnpm --filter @nextsparkjs/plugin-marketplace-payments test` (PostgreSQL's `initdb` and `pg_ctl` on the PATH for the RLS suite).
