# Getting Started with @nextsparkjs/core

> **Registry commands in this guide** run in a generated project, from its root. In the NextSpark monorepo, run `cd apps/dev && node ../../packages/core/scripts/build/registry.mjs` (add `--watch` to watch).

This guide walks you through creating a new project with NextSpark from scratch.

## Prerequisites

- Node.js 22.13+
- pnpm 9.0.0 (the repository's declared package-manager version)
- PostgreSQL database (Supabase, Neon, or local)

## Quick Start

### 1. Create New Project

```bash
# Create a new Next.js 15 project
pnpm create next-app my-saas-app --typescript --tailwind --eslint --app --src-dir=false

cd my-saas-app
```

### 2. Install the NextSpark packages

```bash
pnpm add @nextsparkjs/core @nextsparkjs/cli
```

### 3. Create Configuration Files

**nextspark.config.ts** (project root):
```typescript
import { defineConfig } from '@nextsparkjs/core/lib/config'

export default defineConfig({
  theme: 'default',
  features: {
    billing: true,
    teams: true,
    superadmin: true,
    aiChat: false
  }
})
```

**tsconfig.base.json** (project root):
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    },
    "noImplicitAny": false
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "baseExclude": ["node_modules"]
}
```

### 4. Configure Next.js

**next.config.ts**:
```typescript
import type { NextConfig } from "next";
import path from 'path';

const nextConfig: NextConfig = {
  transpilePackages: ['@nextsparkjs/core'],
  turbopack: {
    resolveAlias: {
      '@nextsparkjs/core/lib/registries/*': './.nextspark/registries/*',
      '@nextsparkjs/registries/*': './.nextspark/registries/*',
    }
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        path: false,
        os: false,
      }
    }

    config.resolve.alias = {
      ...config.resolve.alias,
      'pg-native': false,
      '@nextsparkjs/core/lib/registries': path.resolve(__dirname, '.nextspark/registries'),
      '@nextsparkjs/registries': path.resolve(__dirname, '.nextspark/registries'),
      '@/core': path.resolve(__dirname, 'node_modules/@nextsparkjs/core/dist'),
      '@/themes': path.resolve(__dirname, 'contents/themes'),
      '@/plugins': path.resolve(__dirname, 'contents/plugins'),
    }

    return config
  },
};

export default nextConfig;
```

### 5. Create Contents Directory

```bash
mkdir -p contents/themes/default
```

**contents/themes/default/theme.config.ts**:
```typescript
import { defineTheme } from '@nextsparkjs/core/lib/config'

export default defineTheme({
  name: 'default',
  displayName: 'My SaaS Theme',
  plugins: []
})
```

### 6. Configure Environment

**.env**:
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mydb

# Authentication
BETTER_AUTH_SECRET=your-secret-here-at-least-32-characters
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Theme
NEXT_PUBLIC_ACTIVE_THEME=default
```

### 7. Run Setup

The postinstall hook runs automatically, but you can trigger it manually:

```bash
# Reinstall to trigger postinstall
pnpm install

# Or run scripts directly
pnpm build:registries
```

### 8. Run Database Migrations

```bash
pnpm db:migrate
# or
node node_modules/@nextsparkjs/core/scripts/db/run-migrations.mjs
```

### 9. Start Development

```bash
pnpm dev
```

Visit http://localhost:3000

---

## Project Structure After Setup

```
my-saas-app/
├── .nextspark/              # Auto-generated (gitignored)
│   └── registries/          # Theme/entity registries
├── app/                     # Next.js app router
│   ├── (auth)/              # Auth routes
│   ├── (public)/            # Public routes
│   ├── dashboard/           # Protected dashboard
│   └── api/                 # API routes
├── contents/                # Your customizations
│   └── themes/
│       └── default/         # Your theme
│           ├── theme.config.ts
│           ├── entities/    # Custom entities
│           └── templates/   # Page overrides
├── node_modules/
│   └── @nextspark/
│       └── core/            # The package
│           ├── dist/        # Compiled code
│           ├── scripts/     # Build scripts
│           └── migrations/  # DB migrations
├── nextspark.config.ts      # Project configuration
├── tsconfig.json            # Auto-generated from base
├── tsconfig.base.json       # Your base config
└── next.config.ts           # Next.js config
```

---

## What Gets Generated

### .nextspark/registries/

Auto-generated TypeScript files that index your themes, entities, and plugins:

| File | Purpose |
|------|---------|
| `entity-registry.ts` | Entity CRUD configurations |
| `template-registry.ts` | Page/layout overrides |
| `template-registry.client.ts` | Client-safe templates |
| `plugin-registry.ts` | Active plugins |
| `theme-registry.ts` | Theme configuration |
| `permissions-registry.ts` | Role/permission mapping |
| `block-registry.ts` | Page builder blocks |
| `route-handlers.ts` | API route handlers |

### tsconfig.json

Auto-generated from `tsconfig.base.json` with:
- Dynamic exclusions for inactive themes/plugins
- @nextspark/* path aliases for registry resolution

---

## Common Commands

```bash
# Development
pnpm dev                    # Start dev server

# Build
pnpm build                  # Production build

# Registry regeneration
pnpm build:registries

# Database
pnpm db:migrate             # Run migrations
node node_modules/@nextsparkjs/core/scripts/db/verify-tables.mjs              # Inspect Better Auth tables
```

---

## Troubleshooting

### "Cannot find module '@nextsparkjs/registries/...'"

The registries haven't been generated. Run:
```bash
pnpm build:registries
```

### "Module not found: @nextsparkjs/core/..."

Check that `transpilePackages` includes `@nextsparkjs/core` in next.config.ts.

### TypeScript errors in node_modules

Add to tsconfig.json:
```json
{
  "compilerOptions": {
    "skipLibCheck": true
  }
}
```

### Postinstall not running

Ensure `nextspark.config.ts` exists in your project root before installing.

---

## Next Steps

- [01-overview.md](./01-overview.md) - Architecture overview
- [11-alias-system.md](./11-alias-system.md) - How path resolution works
- [04-config-system.md](./04-config-system.md) - Configuration options
