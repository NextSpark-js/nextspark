# Stability

> **Status:** these are the stability decisions recorded for 1.0 (issue [#204](https://github.com/NextSpark-js/nextspark/issues/204), G0). Recording a decision does not certify it: a surface is stable only once its release gate has linked evidence and an independent review. Until 1.0.0 is released, every surface carries only the guarantees of the current `0.1.0-beta` line.

This page lists which parts of NextSpark are **stable**, **experimental** or **deferred** for 1.0. The rules each label implies are in [Stability and versioning policy](./03-versioning-policy.md). Supported versions of Node, Next.js, Better Auth, pnpm and PostgreSQL are in [Support matrix](./02-support-matrix.md).

| Label | Meaning |
| --- | --- |
| **Stable** | Covered by the SemVer policy after 1.0: breaking changes only in a major, with one minor of deprecation notice. |
| **Stable, conditional** | Stable if the named condition is met before the release candidate. If it is not, the surface is experimental. |
| **Experimental** | No guarantee. May change in a minor, with a changelog note. |
| **Deprecated** | Announced for removal in the next major. |
| **Deferred** | Not part of 1.0. No promise and no timeline. |

## Stable

| Surface | Notes |
| --- | --- |
| Generated host: root-first layout, generated and git-ignored `src/app`, facades of `@nextsparkjs/core/routes/*` | The only host. The host conformance suite runs in CI. |
| Cache Components with PPR | The default rendering mode. In a project with a catch-all page (a `[slug]` route), an unknown public URL answers `200` with `noindex`; a 404 is available as a project recipe. |
| Entities: config, generated CRUD, `/api/v1`, metadata, child entities | Conditional on the security review gate (G1). |
| Auth: email one-time code, Google OAuth, API keys | Conditional on G1 and G2. The one-time code prints to the console only in development. Built on Better Auth 1.7 (`~1.7.7`, see [Support matrix](./02-support-matrix.md)). |
| Teams, RLS, permissions | Conditional on G1. |
| Page builder: block structure and public rendering | The dashboard editor is experimental, see below. |
| `definePlugin` and the plugin system | The first-party plugins are experimental, see below. |
| `starter` template | The other templates are experimental. |
| Web app, `saas` preset | The default preset of `create-nextspark-app`. |
| `nextspark migrate` from 0.x | Supported from `0.1.0-beta.183`, which a weekly CI job upgrades (`upgrade-183.yml`) and which is run by hand at each release candidate. Availability window in [Stability and versioning policy](./03-versioning-policy.md#upgrading-from-0x). |
| Email (Resend) and i18n | |
| Superadmin and devtools | Stable as protected areas. |
| Stable CLI: `create-nextspark-app`; `nextspark` `dev`, `build`, `prepare`, `db:*`, `doctor`, `migrate`; and `update-core` (a bin of `@nextsparkjs/core`, run as `pnpm update-core`) | No programmatic API. |
| `next start` | |
| Deployment behind a TLS reverse proxy | Stable with the documented settings: `NEXTSPARK_CLIENT_IP_SOURCE` and `NEXTSPARK_TRUSTED_PROXY_HOPS` (see [Client address](../14-deployment/10-client-address.md)), and a proxy that sets `X-Forwarded-Proto`. The `X-Forwarded-Proto` requirement is not documented in a guide yet. |

## Stable, conditional

| Surface | Condition |
| --- | --- |
| Web and mobile (Expo SDK 58, React Native 0.88) | A real sign-in from the app passes in an iOS or Android simulator before the release candidate. Without it, mobile is experimental. |
| Standalone output (`output: 'standalone'`) | A Linux job for it in CI before the release candidate. That job exists and passes: the `standalone` job of the *Generated projects* workflow runs `scripts/deploy/verify-standalone.sh` on every push to `main`. |

## Supported, not default

| Surface | Notes |
| --- | --- |
| Legacy ISR (`cacheComponents` off) | Supported. It has its own job in CI. |

## Experimental

| Surface | Notes |
| --- | --- |
| Page builder dashboard editor | Becomes stable when it has an end-to-end test. See [Block editor](../18-page-builder/05-block-editor.md). |
| Media library | See [Media library](../21-media-library/01-introduction.md). |
| Scheduled actions | See [Scheduled actions](../20-scheduled-actions/01-overview.md). |
| `nextspark skills` | The offline skill catalog of the CLI. |
| Billing (Stripe, Polar) | The create flow defaults to the `free` plan. See [Billing](../19-billing/01-overview.md). |
| MCP server | MCP enabled by default in every web project is not part of 1.0. See [MCP server](../05-api/20-mcp-server.md). |
| First-party plugins: `ai`, `amplitude`, `langchain`, `social-media-publisher`, `walkme` | `definePlugin` itself is stable. |
| Templates `blog`, `crm`, `productivity` | See [Project themes](../07-theme-system/01-introduction.md). |
| AI workflow: `@nextsparkjs/ai-workflow`, `setup:ai`, `sync:ai` | Legacy, opt-in. |
| CLI: `add:theme`, `add:plugin`, `add:mobile`, and `@nextsparkjs/testing` | |
| Vercel deployment | See [Vercel deployment](../14-deployment/03-vercel-deployment.md). |

## Plugins in CI

The first-party plugins stay experimental; the plugin system itself is checked on every push to `main` by the `plugin-matrix` job of the *Generated projects* workflow (`scripts/plugins/verify-plugin-matrix.mjs`), on a starter made from the packed packages:

- a local plugin and a packaged plugin (`@nextsparkjs/plugin-walkme`) are both enabled, the project builds, both are in the generated registries, and the local plugin's API route answers from `next start`;
- two packaged plugins that declare the same `nextspark.name` make `nextspark prepare` stop, naming both packages and the plugin name;
- a packaged plugin whose `@nextsparkjs/core` peer range cannot be met is reported by the package manager at install; the CLI has no check of its own (`add:plugin` only reports a missing peer);
- removing both plugins, and the packages, leaves exactly the generated files (`.nextspark`, `src`) the untouched starter has, after `prepare` and after a build;
- the order of the `plugins` list is the order of the registries, the catalog is sorted by name, and a cycle in plugins' `dependencies` is not an error: nothing orders plugins by `dependencies` (unit tests in `packages/core/scripts/build/registry/__tests__/plugin-ordering.test.mjs`).

A packaged plugin ships its TypeScript source, which Next compiles only for the packages in `transpilePackages`: add the plugin's package name next to `@nextsparkjs/core` in `next.config.mjs`, or the build stops with "Unknown module type" on the plugin's `plugin.config.ts`. Local plugins need nothing.

## Deprecated

| Surface | Notes |
| --- | --- |
| `@nextsparkjs/theme-*` packages | Replaced by install-once project templates. |

## Deferred

| Surface | Notes |
| --- | --- |
| Mobile against an external API or headless | |
| Seed Engine ([#116](https://github.com/NextSpark-js/nextspark/issues/116)) | |
| Webpack as a supported bundler | Turbopack is the supported bundler. |
| Per-route JavaScript budgets for `blog`, `crm` and `productivity` | Planned for 1.1. |

## What "stable" does not cover

The public API is a list, not everything that can be imported. A subpath of `@nextsparkjs/core` that is not on that list can change in a minor, even though it resolves. The list is in the [Public API](./05-public-api.md) page; everything else in the package export map is internal.

The generated `src/app` is not public. Closing the export map to the public list is a 2.0 change.

## Accessibility and performance targets

These are targets for 1.0, not guarantees:

- Accessibility: WCAG 2.2 AA, see [Accessibility](../09-frontend/07-accessibility.md). An axe scan of the starter runs in CI and fails on serious or critical findings; the keyboard and focus pass is manual.
- Performance: LCP of 2.5 s or less on the reference environment, and per-route client JavaScript within the ceilings in `scripts/performance/starter-route-js-budget.json`.
