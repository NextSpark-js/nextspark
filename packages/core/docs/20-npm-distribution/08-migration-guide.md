# Migration Guide

This guide covers migrating from the old `core/` structure to the new `packages/core/` structure.

## Overview

In version 0.2.0, NextSpark moved from:

```
project/
├── core/           # Old location
└── ...
```

To:

```
project/
├── packages/
│   └── core/       # New location
└── ...
```

## Why the Change?

1. **NPM Distribution**: Enables publishing `@nextspark/core` to npm
2. **Monorepo Support**: Clean workspace structure with pnpm
3. **Separation**: Clear boundary between core and project files

## Migration Steps

### Step 1: Update Dependencies

Ensure you have the latest version:

```bash
pnpm update @nextspark/core
```

### Step 2: Update tsconfig.json

The path alias changed:

```json
// BEFORE
{
  "compilerOptions": {
    "paths": {
      "@/core/*": ["./core/*"]
    }
  }
}

// AFTER
{
  "compilerOptions": {
    "paths": {
      "@/core/*": ["./packages/core/*"]
    }
  }
}
```

### Step 3: Update package.json Scripts

Update all scripts that reference `core/`:

```json
// BEFORE
{
  "scripts": {
    "build:registries": "node core/scripts/build/registry.mjs",
    "db:migrate": "node core/scripts/db/run-migrations.mjs"
  }
}

// AFTER
{
  "scripts": {
    "build:registries": "node packages/core/scripts/build/registry.mjs",
    "db:migrate": "node packages/core/scripts/db/run-migrations.mjs"
  }
}
```

### Step 4: Update next.config.ts

If you have custom paths:

```typescript
// BEFORE
i18n: {
  docsPath: path.resolve(__dirname, 'core/docs')
}

// AFTER
i18n: {
  docsPath: path.resolve(__dirname, 'packages/core/docs')
}
```

### Step 5: Move Custom Core Files

If you added files directly to `core/`:

```bash
# Move any custom files
mv core/my-custom-file.ts packages/core/my-custom-file.ts
```

### Step 6: Clean Old Directory

After verifying everything works:

```bash
rm -rf core/
```

### Step 7: Regenerate Registries

```bash
pnpm build:registries
```

### Step 8: Verify Build

```bash
pnpm tsc --noEmit
pnpm build
```

## Breaking Changes

### Import Paths

No changes needed if using `@/core/*` aliases. The alias now resolves to `packages/core/` instead of `core/`.

```typescript
// This still works
import { Button } from '@/core/components/ui/button'
```

### Script Paths

All scripts moved. Update any custom scripts:

```javascript
// BEFORE
const scriptsDir = join(projectRoot, 'core/scripts')

// AFTER
const scriptsDir = join(projectRoot, 'packages/core/scripts')
```

### Config Changes

#### Removed: preserveAppPaths

```typescript
// BEFORE (no longer supported)
export default defineConfig({
  preserveAppPaths: ['app/custom-page.tsx']
})

// AFTER (use theme template overrides instead)
// Create: contents/themes/{theme}/templates/custom-page.tsx
// The registry will map it to the correct app path
```

#### Added: theme (required) and features

```typescript
export default defineConfig({
  // Theme is now required
  theme: 'default',

  // Feature flags
  features: {
    billing: true,
    teams: true,
    superadmin: true,
    aiChat: true
  }
})
```

#### Updated: plugins

Plugins now read from `nextspark.config.ts` first:

```typescript
// nextspark.config.ts (preferred)
export default defineConfig({
  theme: 'default',
  plugins: ['langchain', 'stripe']
})

// theme.config.ts (fallback for plugins only, still works)
export default {
  plugins: ['langchain']
}
```

## Troubleshooting

### "Cannot find module '@/core/...'"

1. Check `tsconfig.json` has correct path mapping
2. Verify `packages/core/` exists
3. Run `pnpm install` to refresh symlinks

### Scripts Fail with Wrong Path

Check scripts use correct level count for `ROOT_DIR`:

```javascript
// packages/core/scripts/build/*.mjs
const ROOT_DIR = join(__dirname, '..', '..', '..', '..')  // 4 levels
```

### Registry Generation Fails

1. Check `packages/core/lib/registries/` directory exists
2. Verify write permissions
3. Check for TypeScript errors in discovered entities

### Theme Not Loading

1. Verify `NEXT_PUBLIC_ACTIVE_THEME` is set
2. Check theme exists in `contents/themes/`
3. Run `pnpm build:theme`

## Rollback

If migration fails, you can rollback:

```bash
git checkout HEAD -- tsconfig.json package.json
git checkout HEAD -- core/
rm -rf packages/
```

## Version Compatibility

| NextSpark Version | Core Location | Config Support |
|-------------------|---------------|----------------|
| < 0.2.0 | `core/` | preserveAppPaths |
| >= 0.2.0 | `packages/core/` | features, plugins |

## Related

- [01-overview.md](./01-overview.md) - Package overview
- [06-path-resolution.md](./06-path-resolution.md) - Path handling
