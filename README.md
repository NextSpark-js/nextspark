<p align="center">
  <a href="https://www.nextspark.dev">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./.github/assets/logo-dark.svg">
      <img src="./.github/assets/logo-light.svg" height="80" alt="NextSpark">
    </picture>
  </a>
</p>

<p align="center">
  <strong>The complete SaaS framework for Next.js</strong>
</p>

<p align="center">
  Build SaaS applications on Next.js in days, not months.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@nextsparkjs/core"><img src="https://img.shields.io/npm/v/@nextsparkjs/core.svg?style=flat&colorA=000000&colorB=000000" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@nextsparkjs/core"><img src="https://img.shields.io/npm/dm/@nextsparkjs/core.svg?style=flat&colorA=000000&colorB=000000" alt="npm downloads"></a>
  <a href="https://github.com/NextSpark-js/nextspark/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@nextsparkjs/core.svg?style=flat&colorA=000000&colorB=000000" alt="license"></a>
</p>

<p align="center">
  <a href="https://www.nextspark.dev/docs">Documentation</a> ·
  <a href="https://www.nextspark.dev/docs/getting-started/quick-start">Getting Started</a> ·
  <a href="https://github.com/NextSpark-js/nextspark/issues">Issues</a> ·
  <a href="https://github.com/NextSpark-js/nextspark/discussions">Discussions</a>
</p>

---

## What is NextSpark?

NextSpark is a SaaS framework built on Next.js 16. It provides everything you need to launch a SaaS product: authentication, payments, teams, permissions, entities, project templates, and more—all pre-configured and ready to customize.

> **Stability:** NextSpark is in beta (`0.1.0-beta`). The [stability page](./packages/core/docs/22-stability-and-support/01-stability.md) labels each surface; some stable labels there depend on review gates.
>
> - **Stable:** the generated host, entities and the `/api/v1` REST API, authentication (email one-time code, Google OAuth, API keys), teams, permissions and RLS, `definePlugin`, the `starter` template, the public rendering of the page builder, `next start`, and standalone output (a `standalone` job in CI builds and runs it on Linux).
> - **Experimental** (no deprecation promise): billing (Stripe, Polar), the MCP server, the page builder dashboard editor, the media library, scheduled actions, mobile (Expo SDK 58, until a sign-in from a simulator is verified), the six first-party plugins, the `blog`, `crm` and `productivity` templates, Vercel deployment, `nextspark skills`, and the `add:theme`, `add:plugin`, `add:mobile`, `setup:ai` and `sync:ai` helpers.
>
> See also the [support matrix](./packages/core/docs/22-stability-and-support/02-support-matrix.md) and the [versioning policy](./packages/core/docs/22-stability-and-support/03-versioning-policy.md).

## Features

- **Authentication** — Passwordless by default (email one-time codes and Google OAuth) with [Better Auth](https://better-auth.com); email and password and API keys are available
- **Payments** *(experimental)* — Stripe and Polar integration with subscriptions, usage billing, and customer portal
- **Teams** — Multi-tenant team management with roles and invitations
- **Permissions** — Granular role-based access control system
- **Entities** — Dynamic CRUD with automatic API generation and validation
- **MCP Server** *(experimental)* — Every API-exposed entity gets LLM tool-calling (Claude, etc.) for free via the Model Context Protocol
- **Project templates** — Start from starter (stable), or blog, CRM or productivity *(experimental)*; after creation the source is yours
- **Plugins** — `definePlugin` is stable; the six first-party plugins (ai, amplitude, langchain, marketplace-payments, social-media-publisher, walkme) are *(experimental)*
- **i18n** — Full internationalization with [next-intl](https://next-intl-docs.vercel.app/)
- **UI Components** — 50+ components based on [shadcn/ui](https://ui.shadcn.com/)
- **Database** — PostgreSQL with SQL migrations and row-level security
- **Testing** — Jest + Cypress setup included
- **TypeScript** — Full type safety across the entire stack

## Quick Start

```bash
# Create a new project (installs dependencies and generates .env)
pnpm create nextspark-app my-saas

# Navigate to project
cd my-saas

# Configure environment variables
# Edit .env and set DATABASE_URL for your PostgreSQL database

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

When the development server starts, Next.js prints its local URL (port 3000 by default). `pnpm dlx create-nextspark-app my-saas` does the same.

## Test a Production Build Locally

`pnpm build` stops with `Production auth readiness failed` until a sign-in provider can work in production, and a local PostgreSQL without SSL needs `sslmode=disable` in `DATABASE_URL`. The steps, variables and ports are in [Test a production build locally](./packages/core/docs/14-deployment/01-deployment-overview.md#test-a-production-build-locally).

## Packages

This monorepo publishes 13 packages to npm.

| Package | Version | Description |
|---------|---------|-------------|
| [`@nextsparkjs/core`](./packages/core) | [![npm](https://img.shields.io/npm/v/@nextsparkjs/core.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@nextsparkjs/core) | The framework: components, hooks, services, migrations and project templates |
| [`@nextsparkjs/ui`](./packages/ui) | [![npm](https://img.shields.io/npm/v/@nextsparkjs/ui.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@nextsparkjs/ui) | Shared UI components for web and React Native |
| [`@nextsparkjs/cli`](./packages/cli) | [![npm](https://img.shields.io/npm/v/@nextsparkjs/cli.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@nextsparkjs/cli) | The `nextspark` CLI for the development workflow |
| [`create-nextspark-app`](./packages/create-nextspark-app) | [![npm](https://img.shields.io/npm/v/create-nextspark-app.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/create-nextspark-app) | Project scaffolding tool |
| [`@nextsparkjs/testing`](./packages/testing) *(experimental)* | [![npm](https://img.shields.io/npm/v/@nextsparkjs/testing.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@nextsparkjs/testing) | Selectors, page objects and Cypress helpers |
| [`@nextsparkjs/mobile`](./packages/mobile) *(experimental)* | [![npm](https://img.shields.io/npm/v/@nextsparkjs/mobile.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@nextsparkjs/mobile) | API client, providers and utilities for Expo apps |
| [`@nextsparkjs/ai-workflow`](./packages/ai-workflow) *(experimental)* | [![npm](https://img.shields.io/npm/v/@nextsparkjs/ai-workflow.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@nextsparkjs/ai-workflow) | Claude Code and Cursor workflow templates |
| [`@nextsparkjs/plugin-ai`](./plugins/ai) *(experimental)* | [![npm](https://img.shields.io/npm/v/@nextsparkjs/plugin-ai.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@nextsparkjs/plugin-ai) | Text generation and embeddings endpoints for Anthropic, OpenAI and Ollama |
| [`@nextsparkjs/plugin-amplitude`](./plugins/amplitude) *(experimental)* | [![npm](https://img.shields.io/npm/v/@nextsparkjs/plugin-amplitude.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@nextsparkjs/plugin-amplitude) | Amplitude hooks, consent and experiments (the Amplitude client is simulated for now) |
| [`@nextsparkjs/plugin-langchain`](./plugins/langchain) *(experimental)* | [![npm](https://img.shields.io/npm/v/@nextsparkjs/plugin-langchain.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@nextsparkjs/plugin-langchain) | LangChain agents with memory, orchestration and observability |
| [`@nextsparkjs/plugin-marketplace-payments`](./plugins/marketplace-payments) *(experimental)* | [![npm](https://img.shields.io/npm/v/@nextsparkjs/plugin-marketplace-payments.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@nextsparkjs/plugin-marketplace-payments) | Split payments between the platform and connected sellers |
| [`@nextsparkjs/plugin-social-media-publisher`](./plugins/social-media-publisher) *(experimental)* | [![npm](https://img.shields.io/npm/v/@nextsparkjs/plugin-social-media-publisher.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@nextsparkjs/plugin-social-media-publisher) | Publish to Instagram Business and Facebook Pages |
| [`@nextsparkjs/plugin-walkme`](./plugins/walkme) *(experimental)* | [![npm](https://img.shields.io/npm/v/@nextsparkjs/plugin-walkme.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@nextsparkjs/plugin-walkme) | Guided tours and onboarding |

## Documentation

Visit [nextspark.dev/docs](https://www.nextspark.dev/docs) for the full documentation:

- [Getting Started](https://www.nextspark.dev/docs/getting-started/quick-start) — Create your first project
- [Authentication](https://www.nextspark.dev/docs/authentication/overview) — Configure auth providers
- [Billing](https://www.nextspark.dev/docs/billing/overview) — Set up Stripe or Polar billing
- [Teams](https://www.nextspark.dev/docs/teams/overview) — Multi-tenant architecture
- [Entities](https://www.nextspark.dev/docs/entities/introduction) — Dynamic data management
- [Theme system](https://www.nextspark.dev/docs/theme-system/introduction) — Customize the look and feel
- [Deployment](https://www.nextspark.dev/docs/deployment/deployment-overview) — Deploy to production

Stability, versions and support are documented in the repository: [Stability and support](./packages/core/docs/22-stability-and-support/00-index.md).

## Requirements

- Node.js 22.14 or later in the 22.x line, or 24.x
- Linux x64 or macOS arm64. Windows is not supported.
- Standard PostgreSQL 15, 16, 17 or 18, with the [written requirements](./packages/core/docs/22-stability-and-support/04-postgresql-requirements.md). Neon, Supabase and Amazon RDS are not verified.
- pnpm 10 (10.34.6 or later), 11 or 12. pnpm 9 is only for contributing to this repository; npm, yarn and bun are not supported.
  Corepack bundled with Node.js 22.x cannot install pnpm 12: update Corepack first (`npm install --global corepack@latest`) or install pnpm standalone (`curl -fsSL https://get.pnpm.io/install.sh | sh -`); Node.js 24 ships a Corepack that can. The floor is 10.34.6 because pnpm 10.16 fails on a warm store cache with `ERR_PNPM_MISSING_TIME`.

## Tech Stack

NextSpark is built with modern technologies:

| Category | Technology |
|----------|------------|
| Framework | [Next.js 16](https://nextjs.org/) with App Router and Turbopack by default |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) |
| Components | [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) |
| Authentication | [Better Auth](https://better-auth.com/) |
| Database | [PostgreSQL](https://www.postgresql.org/) |
| Payments | [Stripe](https://stripe.com/) + [Polar](https://polar.sh/) |
| Email | [Resend](https://resend.com/) |
| i18n | [next-intl](https://next-intl-docs.vercel.app/) |
| Validation | [Zod](https://zod.dev/) |
| State | [TanStack Query](https://tanstack.com/query) |

## Development

```bash
# Clone the repository
git clone https://github.com/NextSpark-js/nextspark.git
cd nextspark

# Install dependencies
pnpm install

# Setup Claude Code (optional, for AI-assisted development)
pnpm setup:claude

# Build the core package (builds ui first)
pnpm build:core

# Start development
pnpm dev
```

## Contributing

We welcome contributions! Please read our [Contributing Guide](./CONTRIBUTING.md) before submitting a Pull Request.

- [Open an issue](https://github.com/NextSpark-js/nextspark/issues) for bugs or feature requests
- [Start a discussion](https://github.com/NextSpark-js/nextspark/discussions) for questions

## Community

- [GitHub Discussions](https://github.com/NextSpark-js/nextspark/discussions) — Ask questions and share ideas

## Trademark

"NextSpark" is a trademark. See our [Trademark Policy](./TRADEMARK.md) for usage guidelines.

## License

NextSpark is open source software licensed under the [MIT License](./LICENSE).

---

<p align="center">
  <sub>Built with ❤️ for the developer community</sub>
</p>
