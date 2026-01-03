# NextSpark

The complete Next.js SaaS boilerplate with authentication, payments, and more.

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| `@nextsparkjs/core` | Core framework with templates and utilities | [![npm](https://img.shields.io/npm/v/@nextsparkjs/core)](https://www.npmjs.com/package/@nextsparkjs/core) |
| `@nextsparkjs/cli` | CLI for development workflow | [![npm](https://img.shields.io/npm/v/@nextsparkjs/cli)](https://www.npmjs.com/package/@nextsparkjs/cli) |
| `create-nextspark-app` | Project scaffolding tool | [![npm](https://img.shields.io/npm/v/create-nextspark-app)](https://www.npmjs.com/package/create-nextspark-app) |

## Quick Start

```bash
npx create-nextspark-app my-app
cd my-app
pnpm dev
```

## Features

- **Authentication** - Email/password, Google OAuth, magic links
- **Payments** - Stripe integration with subscriptions
- **Database** - PostgreSQL with Drizzle ORM
- **UI Components** - shadcn/ui based component library
- **Themes** - Multiple themes support
- **Plugins** - Extensible plugin system
- **i18n** - Internationalization with next-intl
- **Testing** - Jest + Cypress setup included

## Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build all packages
pnpm build:core
pnpm build:cli
```

## Documentation

Visit [nextspark.dev/docs](https://nextspark.dev/docs) for full documentation.

## License

MIT
