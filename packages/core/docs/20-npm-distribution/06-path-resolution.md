# Path Resolution

This document explains how paths are resolved in the `packages/core/` structure.

## The Problem

When `core/` was moved to `packages/core/`, all scripts needed their path calculations updated. The number of directory levels to reach the project root changed.

## Path Pattern

All build scripts use this pattern to resolve the project root:

```javascript
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Number of levels depends on script location
const ROOT_DIR = join(__dirname, '../../../..')  // Adjust per file
```

## Level Reference Table

| Script Location | Levels Up | Path String |
|-----------------|-----------|-------------|
| `packages/core/scripts/build/*.mjs` | 4 | `'..', '..', '..', '..'` |
| `packages/core/scripts/build/registry/config.mjs` | 5 | `'..', '..', '..', '..', '..'` |
| `packages/core/scripts/build/registry/discovery/*.mjs` | 6 | `'../../../../../..'` |
| `packages/core/scripts/build/registry/generators/*.mjs` | 6 | `'../../../../../..'` |
| `packages/core/scripts/build/registry/post-build/*.mjs` | 6 | `'../../../../../..'` |
| `packages/core/scripts/setup/*.mjs` | 4 | `'..', '..', '..', '..'` |
| `packages/core/scripts/db/*.mjs` | 4 | `'..', '..', '..', '..'` |
| `packages/core/scripts/test/*.mjs` | 4 | `'..', '..', '..', '..'` |
| `packages/core/scripts/deploy/*.mjs` | 4 | `'..', '..', '..', '..'` |

## Visualization

```
project-root/                    ← ROOT_DIR
├── packages/                    ← 1 level up
│   └── core/                    ← 2 levels up
│       └── scripts/             ← 3 levels up
│           └── build/           ← 4 levels up (build/*.mjs)
│               └── registry/    ← 5 levels up (config.mjs)
│                   └── generators/  ← 6 levels up (*.mjs)
├── contents/
├── app/
└── nextspark.config.ts
```

## Examples

### 4 Levels Up (build/*.mjs)

```javascript
// packages/core/scripts/build/registry.mjs
const __dirname = dirname(fileURLToPath(import.meta.url))
// packages/core/scripts/build/ → project root = 4 levels
const ROOT_DIR = join(__dirname, '..', '..', '..', '..')
```

### 5 Levels Up (registry/config.mjs)

```javascript
// packages/core/scripts/build/registry/config.mjs
const __dirname = dirname(fileURLToPath(import.meta.url))
// packages/core/scripts/build/registry/ → project root = 5 levels
const ROOT_DIR = join(__dirname, '..', '..', '..', '..', '..')
```

### 6 Levels Up (generators/*.mjs)

```javascript
// packages/core/scripts/build/registry/generators/entity-registry.mjs
const __dirname = dirname(fileURLToPath(import.meta.url))
// packages/core/scripts/build/registry/generators/ → project root = 6 levels
const ROOT_DIR = join(__dirname, '../../../../../..')
```

## Path Aliases vs Relative Imports

### For Source Code (src/)

**IMPORTANT:** Source code inside `packages/core/src/` now uses **relative imports** instead of path aliases. This is required for npm distribution.

```typescript
// ❌ OLD - Path aliases (don't work in npm consumers)
import { cn } from '@/core/lib/utils'
import { Button } from '@/core/components/ui/button'

// ✅ NEW - Relative imports (work everywhere)
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
```

A conversion script is provided:
```bash
cd packages/core
node scripts/convert-to-relative-imports.mjs
```

### For Consumer Projects

Consumers still use the package name:
```typescript
// Works in consumer projects
import { Button } from '@nextspark/core/components/ui/button'
import { cn } from '@nextspark/core/lib/utils'
```

### For the Main App (outside packages/)

The main application can still use `@/core/*` via tsconfig paths:

```json
// tsconfig.json (project root)
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@/core/*": ["./packages/core/src/*"]
    }
  }
}
```

Note: Points to `src/` not the root of packages/core.

## Alias Resolution in Scripts

Build scripts need to resolve `@/core/*` aliases to filesystem paths:

```javascript
// packages/core/scripts/build/registry/generators/permissions-registry.mjs

const resolveAliasPath = (aliasPath) => {
  if (aliasPath.startsWith('@/contents/')) {
    return join(rootDir, aliasPath.replace('@/contents/', 'contents/') + '.ts')
  }
  if (aliasPath.startsWith('@/core/')) {
    // CRITICAL: Must use packages/core/, not core/
    return join(rootDir, aliasPath.replace('@/core/', 'packages/core/') + '.ts')
  }
  return aliasPath
}
```

## Common Mistakes

### Wrong Level Count

```javascript
// ❌ WRONG: Only 3 levels (missing one)
const ROOT_DIR = join(__dirname, '..', '..', '..')

// ✅ CORRECT: 4 levels for scripts/build/*.mjs
const ROOT_DIR = join(__dirname, '..', '..', '..', '..')
```

### Using Old Path

```javascript
// ❌ WRONG: Old path without packages/
const scriptsDir = join(ROOT_DIR, 'core/scripts/build')

// ✅ CORRECT: New path with packages/
const scriptsDir = join(ROOT_DIR, 'packages/core/scripts/build')
```

### Inconsistent Separators

```javascript
// ❌ WRONG: Mixed separators
const ROOT_DIR = join(__dirname, '..\\..\\..\\..') // Windows style

// ✅ CORRECT: Forward slashes (works on all platforms)
const ROOT_DIR = join(__dirname, '..', '..', '..', '..')
```

## Debugging Tips

### Print Resolved Paths

```javascript
console.log('Script location:', __dirname)
console.log('Resolved ROOT_DIR:', ROOT_DIR)
console.log('Config path:', join(ROOT_DIR, 'nextspark.config.ts'))
console.log('Exists:', existsSync(join(ROOT_DIR, 'nextspark.config.ts')))
```

### Verify Directory Structure

```javascript
import { readdirSync } from 'fs'

// Should see: app, contents, packages, etc.
console.log('Root contents:', readdirSync(ROOT_DIR))

// Should see: core
console.log('Packages contents:', readdirSync(join(ROOT_DIR, 'packages')))
```

## Migration Checklist

When adding new scripts, verify:

1. [ ] Correct level count calculated
2. [ ] Comment explaining the path calculation
3. [ ] Test that paths resolve correctly
4. [ ] Works on both Unix and Windows

## Related

- [03-build-scripts.md](./03-build-scripts.md) - Build scripts
- [01-overview.md](./01-overview.md) - Package structure
