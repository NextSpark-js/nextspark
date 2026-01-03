<p align="center">
  <a href="https://nextspark.dev">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://nextspark.dev/logo-dark.svg">
      <img src="https://nextspark.dev/logo.svg" height="80" alt="NextSpark">
    </picture>
  </a>
</p>

<p align="center">
  <strong>The complete SaaS framework for Next.js</strong>
</p>

<p align="center">
  Build production-ready SaaS applications in days, not months.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@nextsparkjs/core"><img src="https://img.shields.io/npm/v/@nextsparkjs/core.svg?style=flat&colorA=000000&colorB=000000" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@nextsparkjs/core"><img src="https://img.shields.io/npm/dm/@nextsparkjs/core.svg?style=flat&colorA=000000&colorB=000000" alt="npm downloads"></a>
  <a href="https://github.com/NextSpark-js/nextspark/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@nextsparkjs/core.svg?style=flat&colorA=000000&colorB=000000" alt="license"></a>
</p>

<p align="center">
  <a href="https://nextspark.dev/docs">Documentation</a> ·
  <a href="https://nextspark.dev/docs/getting-started">Getting Started</a> ·
  <a href="https://github.com/NextSpark-js/nextspark/issues">Issues</a> ·
  <a href="https://github.com/NextSpark-js/nextspark/discussions">Discussions</a>
</p>

---

## What is NextSpark?

NextSpark is a complete, production-ready SaaS framework built on Next.js 15. It provides everything you need to launch a SaaS product: authentication, payments, teams, permissions, entities, themes, and more—all pre-configured and ready to customize.

## Features

- **Authentication** — Email/password, Google OAuth, magic links with [Better Auth](https://better-auth.com)
- **Payments** — Stripe integration with subscriptions, usage billing, and customer portal
- **Teams** — Multi-tenant team management with roles and invitations
- **Permissions** — Granular role-based access control system
- **Entities** — Dynamic CRUD with automatic API generation and validation
- **Themes** — Multiple theme support with easy customization
- **Plugins** — Extensible plugin architecture for adding features
- **i18n** — Full internationalization with [next-intl](https://next-intl-docs.vercel.app/)
- **UI Components** — 50+ components based on [shadcn/ui](https://ui.shadcn.com/)
- **Database** — PostgreSQL with migrations and type-safe queries
- **Testing** — Jest + Cypress setup included
- **TypeScript** — Full type safety across the entire stack

## Quick Start

```bash
# Create a new project
npx @nextsparkjs/create-app my-saas

# Navigate to project
cd my-saas

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see your app.

## Packages

This monorepo contains the following packages:

| Package | Version | Description |
|---------|---------|-------------|
| [`@nextsparkjs/core`](./packages/core) | [![npm](https://img.shields.io/npm/v/@nextsparkjs/core.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@nextsparkjs/core) | Core framework with components, hooks, and utilities |
| [`@nextsparkjs/cli`](./packages/cli) | [![npm](https://img.shields.io/npm/v/@nextsparkjs/cli.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@nextsparkjs/cli) | CLI for development workflow |
| [`@nextsparkjs/create-app`](./packages/create-nextspark) | [![npm](https://img.shields.io/npm/v/@nextsparkjs/create-app.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@nextsparkjs/create-app) | Project scaffolding tool |

## Documentation

Visit [nextspark.dev/docs](https://nextspark.dev/docs) for the full documentation:

- [Getting Started](https://nextspark.dev/docs/getting-started) — Create your first project
- [Authentication](https://nextspark.dev/docs/authentication) — Configure auth providers
- [Payments](https://nextspark.dev/docs/payments) — Set up Stripe billing
- [Teams](https://nextspark.dev/docs/teams) — Multi-tenant architecture
- [Entities](https://nextspark.dev/docs/entities) — Dynamic data management
- [Theming](https://nextspark.dev/docs/theming) — Customize the look and feel
- [Deployment](https://nextspark.dev/docs/deployment) — Deploy to production

## Requirements

- Node.js 18.17 or later
- PostgreSQL database
- pnpm (recommended) or npm

## Tech Stack

NextSpark is built with modern technologies:

| Category | Technology |
|----------|------------|
| Framework | [Next.js 15](https://nextjs.org/) with App Router |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) |
| Components | [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) |
| Authentication | [Better Auth](https://better-auth.com/) |
| Database | [PostgreSQL](https://www.postgresql.org/) |
| Payments | [Stripe](https://stripe.com/) |
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

# Build core package
pnpm --filter @nextsparkjs/core build

# Start development
pnpm dev
```

## Contributing

We welcome contributions! Please read our [Contributing Guide](./CONTRIBUTING.md) before submitting a Pull Request.

- [Open an issue](https://github.com/NextSpark-js/nextspark/issues) for bugs or feature requests
- [Start a discussion](https://github.com/NextSpark-js/nextspark/discussions) for questions

## Community

- [GitHub Discussions](https://github.com/NextSpark-js/nextspark/discussions) — Ask questions and share ideas
- [Twitter](https://twitter.com/nextsparkjs) — Follow for updates

## Trademark

"NextSpark" is a trademark. See our [Trademark Policy](./TRADEMARK.md) for usage guidelines.

## License

NextSpark is open source software licensed under the [MIT License](./LICENSE).

---

<p align="center">
  <sub>Built with ❤️ for the developer community</sub>
</p>
