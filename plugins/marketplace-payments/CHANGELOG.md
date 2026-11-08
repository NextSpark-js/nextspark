# Changelog

All notable changes to `@nextsparkjs/plugin-marketplace-payments` will be documented in this file.

## [Unreleased]

### Added

- **Marketplace payments as a plugin: split a payment between the platform and a connected seller.** Stripe Connect uses Express accounts and destination charges; MercadoPago uses sellers connected by OAuth and `marketplace_fee`. The commission is computed on the server in integer cents, with defined rounding. Webhooks from both providers are verified and processed once, sellers' tokens are encrypted at rest with a rotatable keyring, tokens are renewed by a scheduled action, and a seller's data is isolated by RLS. It adds a seller settings page with the payment history, and a superadmin overview, with texts in the six catalogs. This release has not been validated against the providers' sandboxes: #220 stays open until a split payment completes in the sandbox of each provider (#220).
