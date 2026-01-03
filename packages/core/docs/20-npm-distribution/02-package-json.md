# Package Configuration

The `packages/core/package.json` defines how `@nextspark/core` is structured for npm distribution.

## Full Configuration

```json
{
  "name": "@nextspark/core",
  "version": "0.2.0",
  "description": "NextSpark - The complete SaaS framework for Next.js",
  "type": "module",
  "main": "./lib/index.ts",
  "exports": {
    ".": "./lib/index.ts",
    "./next": "./next.ts",
    "./config": "./lib/config/index.ts",
    "./lib/*": "./lib/*",
    "./components/*": "./components/*",
    "./hooks/*": "./hooks/*",
    "./providers/*": "./providers/*"
  },
  "bin": {
    "nextspark": "./bin/nextspark.mjs"
  },
  "scripts": {
    "build:registries": "node scripts/build/registry.mjs",
    "build:theme": "node scripts/build/theme.mjs",
    "postinstall": "node scripts/setup/npm-postinstall.mjs"
  },
  "peerDependencies": {
    "next": ">=14.0.0",
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  }
}
```

## Configuration Explained

### Package Identity

```json
{
  "name": "@nextspark/core",
  "version": "0.2.0",
  "description": "NextSpark - The complete SaaS framework for Next.js"
}
```

- **name**: Scoped npm package (`@nextspark/core`)
- **version**: Semantic versioning
- **description**: Package description for npm

### Module System

```json
{
  "type": "module",
  "main": "./lib/index.ts"
}
```

- **type**: ES Modules (ESM)
- **main**: Entry point for TypeScript projects

### Exports Map

The `exports` field defines subpath imports:

```json
{
  "exports": {
    ".": "./lib/index.ts",
    "./next": "./next.ts",
    "./config": "./lib/config/index.ts",
    "./lib/*": "./lib/*",
    "./components/*": "./components/*",
    "./hooks/*": "./hooks/*",
    "./providers/*": "./providers/*"
  }
}
```

**Usage Examples:**

```typescript
// Main export
import { EntityRegistry } from '@nextspark/core'

// Config utilities
import { defineConfig } from '@nextspark/core/config'

// Components
import { Button } from '@nextspark/core/components/ui/button'

// Hooks
import { useAuth } from '@nextspark/core/hooks/useAuth'
```

### CLI Binary

```json
{
  "bin": {
    "nextspark": "./bin/nextspark.mjs"
  }
}
```

After installation, the CLI is available:

```bash
npx nextspark --help
npx nextspark generate:app
```

### Build Scripts

```json
{
  "scripts": {
    "build:registries": "node scripts/build/registry.mjs",
    "build:theme": "node scripts/build/theme.mjs",
    "postinstall": "node scripts/setup/npm-postinstall.mjs"
  }
}
```

- **build:registries**: Generate all registries
- **build:theme**: Compile theme CSS
- **postinstall**: Run after `npm install`

### Peer Dependencies

```json
{
  "peerDependencies": {
    "next": ">=14.0.0",
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  }
}
```

Users must have these installed in their project.

## Version History

| Version | Changes |
|---------|---------|
| 0.2.0 | Physical migration to packages/core/, config props functional |
| 0.1.3 | Initial release, templates EJS, CLI |

## Related

- [03-build-scripts.md](./03-build-scripts.md) - Build system details
- [05-cli-tool.md](./05-cli-tool.md) - CLI documentation
