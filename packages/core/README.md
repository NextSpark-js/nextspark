# @nextsparkjs/core

The complete SaaS framework for Next.js. Build production-ready SaaS applications with authentication, payments, teams, and more.

## Installation

```bash
pnpm add @nextsparkjs/core
```

## Quick Start

```bash
# Create a new NextSpark project
npx create-nextspark-app my-app
cd my-app
# set DATABASE_URL in .env (BETTER_AUTH_SECRET is already generated)
pnpm db:migrate
pnpm dev
```

With lifecycle scripts disabled (`pnpm install --frozen-lockfile --ignore-scripts`) nothing else is needed: `nextspark dev`, `build` and `prepare` generate `src/app` and the registries. Only Cypress needs `pnpm exec cypress install` before `pnpm cy:run`.

Or initialize in an existing project:

```bash
npx nextspark init
```

## Features

- **Authentication** - Email/password, Google OAuth, magic links with Better Auth
- **Payments** - Stripe integration with subscriptions and usage billing
- **Teams** - Multi-tenant team management with roles and permissions
- **Database** - PostgreSQL with migrations and type-safe queries
- **UI Components** - 50+ components based on shadcn/ui
- **Entities** - Dynamic CRUD with automatic API generation
- **Page Builder** - Block-based page builder with drag and drop
- **Project templates** - Start from starter, blog, CRM or productivity; after creation the source is yours
- **Plugins** - Extensible plugin system
- **i18n** - Full internationalization with next-intl
- **Testing** - Jest + Cypress setup included

## Documentation

Visit [nextspark.dev/docs](https://nextspark.dev/docs) for full documentation.

## License

MIT
