# @nextsparkjs/core

The complete SaaS framework for Next.js. Build SaaS applications with authentication, teams and permissions, entities with a generated API, a page builder, billing, i18n and more, on Next.js 16 and PostgreSQL.

> **Stability.** NextSpark is in beta (`0.1.0-beta`). The generated host, entities and the `/api/v1` API, authentication (email one-time code, Google OAuth, API keys), teams, permissions and RLS, `definePlugin` and the `starter` template are labeled stable; billing (Stripe, Polar), the MCP server, the page builder dashboard editor, the media library, scheduled actions, the first-party plugins and the `blog`, `crm` and `productivity` templates are experimental. [Stability](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/01-stability.md) has the full list, and [Public API](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/05-public-api.md) says which subpaths of this package you can build on.

## Installation

Most projects get this package from `create-nextspark-app`, which installs it with `@nextsparkjs/cli` and writes the project:

```bash
pnpm create nextspark-app my-app
cd my-app
# set DATABASE_URL in .env (BETTER_AUTH_SECRET is already generated)
pnpm db:migrate
pnpm dev
```

With lifecycle scripts disabled (`pnpm install --frozen-lockfile --ignore-scripts`) nothing else is needed: `nextspark dev`, `build` and `prepare` generate `src/app` and the registries. Only Cypress needs `pnpm exec cypress install` before `pnpm cy:run`.

To add NextSpark to an existing project, install `@nextsparkjs/core` and `@nextsparkjs/cli` with `pnpm add` and run `pnpm exec nextspark init`.

## Requirements

- Node.js 22.14.0 or later
- Next.js `~16.4.2` and React `^19.2.0` (peer dependencies)
- Standard PostgreSQL 15, 16, 17 or 18
- Linux x64 or macOS arm64. Windows is not supported.
- pnpm 10 (10.34.6 or later), 11 or 12. npm, yarn and bun are not supported.

The [support matrix](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/02-support-matrix.md) lists what each version is tested with.

## Features

- **Authentication**: passwordless by default (email one-time codes and Google OAuth) with Better Auth; email and password and API keys are available
- **Payments** *(experimental)*: Stripe and Polar with subscriptions, usage billing and a customer portal
- **Teams**: multi-tenant team management with roles and invitations
- **Permissions**: granular role-based access control, with row-level security in the database
- **Entities**: dynamic CRUD with automatic API generation and validation
- **Page Builder**: block-based pages; the public rendering is stable and the dashboard editor is experimental
- **Project templates**: `starter` (stable), `blog`, `crm` and `productivity` (experimental); after creation the source is yours
- **Plugins**: a plugin system (`definePlugin`, stable) and six first-party plugins (experimental)
- **i18n**: internationalization with next-intl
- **UI components**: 50+ components based on shadcn/ui
- **Testing**: Jest and Cypress setup included

## Documentation

- [NextSpark documentation](https://www.nextspark.dev/docs)
- [Quick start](https://www.nextspark.dev/docs/getting-started/quick-start)
- [Stability and support](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/00-index.md)
- [Changelog](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/CHANGELOG.md)

## License

MIT
