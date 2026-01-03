# NPM Distribution - Overview

This section documents the `@nextspark/core` package architecture and how it works as an npm package.

## What is @nextspark/core?

`@nextspark/core` is the heart of NextSpark - a complete SaaS framework for Next.js. It contains:

- **Components**: Pre-built UI components (shadcn/ui based)
- **Entity System**: Dynamic CRUD with zero boilerplate
- **Registry System**: Build-time optimization for zero runtime I/O
- **Authentication**: Better Auth integration with session + API key support
- **Build Scripts**: Registry generation, theme compilation
- **Templates**: EJS templates for app generation
- **Migrations**: Database schema migrations

## Dual-Mode Architecture

NextSpark operates in two modes:

### Monorepo Mode (Development)

Used during development in the sass-boilerplate monorepo:

```
sass-boilerplate/
├── packages/
│   └── core/                    # @nextspark/core source
│       └── src/lib/registries/  # Registries generated here
├── contents/
│   └── themes/default/          # Theme source
└── app/                         # Next.js app
```

### NPM Mode (Consumer Projects)

Used when @nextspark/core is installed as a package:

```
my-saas-app/
├── node_modules/
│   └── @nextspark/core/         # Compiled package
│       └── dist/                # Pre-built code
├── .nextspark/
│   └── registries/              # Registries generated here
├── contents/
│   └── themes/default/          # User's theme
└── app/                         # Generated/user app
```

## Key Components

### 1. Compiled Package (dist/)

Source code in `src/` is compiled by tsup to `dist/`:

```
packages/core/
├── src/                    # Source TypeScript
│   ├── components/
│   ├── lib/
│   ├── hooks/
│   └── ...
└── dist/                   # Compiled output
    ├── components/
    ├── lib/
    ├── hooks/
    └── ...
```

See [10-tsup-build.md](./10-tsup-build.md) for build details.

### 2. Registry System

Registries are auto-generated TypeScript files that index your content:

| Registry | Purpose |
|----------|---------|
| `entity-registry.ts` | Entity CRUD configurations |
| `template-registry.ts` | Page/layout overrides |
| `permissions-registry.ts` | Role/permission mapping |
| `plugin-registry.ts` | Active plugins |
| `theme-registry.ts` | Theme configuration |
| `block-registry.ts` | Page builder blocks |

**Location differs by mode:**
- Monorepo: `packages/core/src/lib/registries/`
- NPM: `.nextspark/registries/`

### 3. Alias Resolution

The package uses a dual-alias system for imports:

```typescript
// In compiled package code
import { ENTITY_REGISTRY } from '@nextspark/registries/entity-registry'

// Resolved by consumer project:
// - Turbopack: via turbopack.resolveAlias
// - Webpack: via webpack.resolve.alias
// - TypeScript: via tsconfig paths
```

See [11-alias-system.md](./11-alias-system.md) for complete alias documentation.

### 4. Postinstall Hook

When installed, the package runs:

1. **Registry Generation** - Creates `.nextspark/registries/`
2. **Theme Build** - Compiles theme CSS
3. **TSConfig Generation** - Adds @nextspark/* paths

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                     Consumer Project                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────┐   ┌─────────────────────────────────┐│
│  │   contents/themes/     │   │   .nextspark/registries/        ││
│  │   └── default/         │   │   ├── entity-registry.ts        ││
│  │       ├── entities/    │   │   ├── template-registry.ts      ││
│  │       ├── templates/   │   │   ├── permissions-registry.ts   ││
│  │       └── theme.config │   │   └── ...                       ││
│  └───────────┬────────────┘   └───────────────┬─────────────────┘│
│              │                                │                   │
│              │    ┌───── Generates ──────────┘                   │
│              │    │                                              │
│              ▼    ▼                                              │
│  ┌───────────────────────────────────────────────────────────────┐│
│  │              node_modules/@nextspark/core                      ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐ ││
│  │  │    dist/        │  │    scripts/     │  │   migrations/  │ ││
│  │  │ (compiled code) │  │ (build scripts) │  │ (DB schemas)   │ ││
│  │  └─────────────────┘  └─────────────────┘  └────────────────┘ ││
│  └───────────────────────────────────────────────────────────────┘│
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

## Build Pipeline

```
1. tsup compiles src/ → dist/
   ├── Transpiles TypeScript to ESM
   ├── Resolves relative imports
   └── Marks @nextspark/registries/* as external

2. postinstall runs in consumer project
   ├── Generates .nextspark/registries/
   ├── Builds theme CSS
   └── Updates tsconfig.json

3. Consumer's bundler (Turbopack/webpack)
   ├── Resolves @nextspark/registries/* → .nextspark/registries/
   └── Bundles application
```

## Version History

| Version | Changes |
|---------|---------|
| 0.1.0 | Initial npm package structure |
| 0.2.0 | **NPM Distribution v4** - Dual-mode alias system, external registries |

## Related Documentation

- [00-getting-started.md](./00-getting-started.md) - New project setup
- [02-package-json.md](./02-package-json.md) - Package configuration
- [03-build-scripts.md](./03-build-scripts.md) - Registry build scripts
- [10-tsup-build.md](./10-tsup-build.md) - tsup build system
- [11-alias-system.md](./11-alias-system.md) - Path alias resolution
