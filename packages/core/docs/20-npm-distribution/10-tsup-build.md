# tsup Build System

This document describes the build system that compiles `@nextspark/core` for npm distribution using tsup.

## Overview

`@nextspark/core` uses **tsup** (a fast TypeScript bundler powered by esbuild) to compile the package for npm distribution. This follows the **industry standard** approach used by React, Vue, TanStack, Radix, tRPC, and Zod.

### Why Build Step?

Before the build step, consumers of `@nextspark/core` faced issues:
- **Path aliases** (`@/core/*`) didn't resolve in consumer projects
- **Turbopack** (Next.js default) doesn't support webpack aliases for node_modules
- Consumers needed complex `transpilePackages` and webpack configurations

With the build step:
- Package exports pre-compiled JavaScript
- No consumer configuration needed for the package itself
- Works with both Turbopack and webpack
- Faster build times for consumers

## Directory Structure

```
packages/core/
├── src/                    # Source TypeScript files
│   ├── components/         # UI components
│   ├── lib/                # Core libraries
│   ├── hooks/              # React hooks
│   ├── contexts/           # React contexts
│   ├── providers/          # React providers
│   └── types/              # Type definitions
├── dist/                   # Compiled output (git-ignored)
│   ├── index.js
│   ├── components/
│   ├── lib/
│   ├── hooks/
│   ├── messages/           # Copied i18n files
│   ├── presets/            # Copied presets
│   └── templates/          # Copied templates
├── tsup.config.ts          # Build configuration
├── tsconfig.build.json     # TypeScript config for build
└── package.json            # Exports point to dist/
```

## Build Configuration

### tsup.config.ts (Current)

```typescript
import { defineConfig } from 'tsup'
import { cp } from 'fs/promises'
import { join } from 'path'
import { glob } from 'glob'

export default defineConfig({
  // Glob all source files to preserve module structure
  entry: await glob('src/**/*.{ts,tsx}', {
    ignore: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      // Exclude files with duplicate names
      'src/lib/user-data-client.ts',
    ],
  }),

  // ESM format output
  format: ['esm'],

  // Disable bundling - transpile only, preserves module structure
  bundle: false,

  // Clean dist before build
  clean: true,

  // 🔑 CRITICAL: Keep registry imports external
  // These are resolved by the consumer project, not bundled
  external: [/^@nextspark\/registries\/.*/],

  // Use build-specific tsconfig
  tsconfig: './tsconfig.build.json',

  // Configure esbuild for automatic JSX transform (React 17+)
  esbuildOptions(options) {
    options.jsx = 'automatic'
    options.jsxImportSource = 'react'
  },

  // Copy non-compiled assets after build
  async onSuccess() {
    const distDir = join(process.cwd(), 'dist')

    // Copy assets that don't need compilation
    const assets = ['messages', 'presets', 'templates', 'bin', 'migrations', 'config']
    for (const asset of assets) {
      await cp(asset, join(distDir, asset), { recursive: true })
        .catch(() => {})
    }

    console.log('✅ Assets copied successfully')
  },
})
```

### Key Configuration: External Registries

The most important configuration is:

```typescript
external: [/^@nextspark\/registries\/.*/],
```

This tells tsup/esbuild to **NOT resolve** imports matching `@nextspark/registries/*`:

```typescript
// In source code (src/lib/entities/EntityListWrapper.tsx)
import { ENTITY_REGISTRY } from '@nextspark/registries/entity-registry'

// In compiled output (dist/lib/entities/EntityListWrapper.js)
import { ENTITY_REGISTRY } from '@nextspark/registries/entity-registry'
// ☝️ SAME - not resolved at compile time
```

The consumer project's bundler then resolves this import to `.nextspark/registries/`.

See [11-alias-system.md](./11-alias-system.md) for complete alias resolution details.

### tsconfig.build.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "declaration": false,
    "declarationMap": false,
    "noEmit": false,
    "baseUrl": ".",
    "paths": {
      "@nextspark/registries/*": ["./src/lib/registries/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.test.tsx"]
}
```

## Package.json Exports

```json
{
  "name": "@nextspark/core",
  "version": "0.2.0",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "exports": {
    ".": { "import": "./dist/index.js" },
    "./lib/*": { "import": "./dist/lib/*.js" },
    "./hooks/*": { "import": "./dist/hooks/*.js" },
    "./components/*": { "import": "./dist/components/*.js" },
    "./contexts/*": { "import": "./dist/contexts/*.js" },
    "./providers/*": { "import": "./dist/providers/*.js" },
    "./types/*": { "import": "./dist/types/*.js" },
    "./messages/*": "./dist/messages/*",
    "./presets/*": "./dist/presets/*",
    "./templates/*": "./dist/templates/*",
    "./migrations/*": "./dist/migrations/*",
    "./scripts/*": "./scripts/*"
  },
  "files": ["dist", "docs", "scripts", "tests", "globals.css", "theme-styles.css"],
  "bin": {
    "nextspark": "./dist/bin/nextspark.mjs"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "postinstall": "node scripts/setup/npm-postinstall.mjs"
  }
}
```

## Building the Package

### Development Build

```bash
cd packages/core
pnpm build
```

Build output:
```
CLI Building entry: src/index.ts, src/components/...
CLI tsup v8.5.1
CLI Target: es2017
CLI Cleaning output folder
ESM Build start
ESM ⚡️ Build success in 95ms
✅ Assets copied successfully
```

### Watch Mode

```bash
pnpm dev
```

Automatically rebuilds when source files change.

## Consumer Usage

### Minimal Configuration

Consumers need to configure alias resolution:

```typescript
// next.config.ts
import type { NextConfig } from "next";
import path from 'path';

const nextConfig: NextConfig = {
  transpilePackages: ['@nextspark/core'],
  turbopack: {
    resolveAlias: {
      '@nextspark/core/lib/registries/*': './.nextspark/registries/*',
      '@nextspark/registries/*': './.nextspark/registries/*',
    }
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@nextspark/core/lib/registries': path.resolve(__dirname, '.nextspark/registries'),
      '@nextspark/registries': path.resolve(__dirname, '.nextspark/registries'),
    }
    return config
  },
};

export default nextConfig;
```

### Importing Components

```typescript
// Direct imports work
import { Button } from '@nextspark/core/components/ui/button'
import { cn } from '@nextspark/core/lib/utils'
import { useAuth } from '@nextspark/core/hooks/useAuth'
```

## Technical Decisions

### Why `bundle: false`?

We use `bundle: false` to **preserve module structure**:
- Each source file becomes a corresponding `.js` file
- Deep imports work naturally (`@nextspark/core/components/ui/button`)
- Smaller bundle size (consumers only import what they need)

### Why External Registries?

Registries are project-specific:
- They index the consumer's themes/entities/plugins
- Generated at `npm install` time in the consumer project
- Cannot be bundled into the package

### Why No DTS?

Type declarations (`.d.ts`) are currently disabled due to memory issues with large codebases. Consumers can:
1. Use `noImplicitAny: false` in tsconfig
2. Or use `skipLibCheck: true`

Future versions will generate types using a separate `tsc` step.

## Troubleshooting

### "Module not found" for registries

The registries haven't been generated. Run:
```bash
node node_modules/@nextspark/core/scripts/build/registry.mjs
```

### Build Fails with Memory Error

If DTS generation causes memory issues:
1. Disable DTS in tsup.config.ts: `dts: false`
2. Generate types separately with `tsc`

### External Imports Not Working

Verify the external pattern matches:
```typescript
external: [/^@nextspark\/registries\/.*/],
```

Check compiled output:
```bash
grep -r "@nextspark/registries" dist/
```

Should show the imports preserved as-is.

## Related

- [01-overview.md](./01-overview.md) - Package overview
- [02-package-json.md](./02-package-json.md) - Package configuration
- [11-alias-system.md](./11-alias-system.md) - Alias resolution system
- [06-path-resolution.md](./06-path-resolution.md) - Path handling
