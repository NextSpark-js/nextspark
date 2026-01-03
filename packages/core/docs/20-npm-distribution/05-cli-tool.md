# CLI Tool

NextSpark provides a CLI tool for common development tasks.

## Current Status

> **⚠️ CLI Status: Basic Implementation**
>
> The CLI exists in `bin/nextspark.mjs` but is currently in basic form.
> For v0.2.0, the postinstall hook handles most setup automatically.
>
> **Missing:** `npx create-nextspark` scaffolding tool is NOT implemented yet.

## What Works Now

### Postinstall Hook (Automatic)

When you run `pnpm install @nextspark/core`, the postinstall hook automatically:

1. Generates `.nextspark/registries/`
2. Builds theme CSS
3. Updates tsconfig.json with @nextspark/* aliases

### Manual Commands

```bash
# Registry generation
node node_modules/@nextspark/core/scripts/build/registry.mjs

# Theme compilation
node node_modules/@nextspark/core/scripts/build/theme.mjs

# TSConfig update
node node_modules/@nextspark/core/scripts/build/update-tsconfig.mjs

# Database migrations
node node_modules/@nextspark/core/scripts/db/run-migrations.mjs
```

## Planned CLI Commands

The `npx nextspark` CLI is planned to support:

```bash
nextspark <command>

Commands:
  init          Initialize NextSpark in existing project
  dev           Start development server with watchers
  build         Build for production
  generate      Regenerate app structure from templates
  migrate       Run database migrations

Options:
  -h, --help    Show help message
  --version     Show version
```

### Planned: create-nextspark

A separate `create-nextspark` package for scaffolding:

```bash
# NOT YET IMPLEMENTED
npx create-nextspark my-saas-app
```

## Current CLI Implementation

**File:** `packages/core/bin/nextspark.mjs`

```javascript
#!/usr/bin/env node

import { spawn } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const command = process.argv[2]
const projectRoot = process.cwd()

async function dev() {
  console.log('🚀 Starting NextSpark development...')

  // Initial build
  const { buildRegistries } = await import('../scripts/build/registry.mjs')
  const { buildTheme } = await import('../scripts/build/theme.mjs')

  await buildRegistries(projectRoot)
  await buildTheme(projectRoot)

  // Start Next.js dev server
  spawn('npx', ['next', 'dev'], { stdio: 'inherit', shell: true })
}

async function build() {
  console.log('🔨 Building NextSpark for production...')

  const { buildRegistries } = await import('../scripts/build/registry.mjs')
  const { buildTheme } = await import('../scripts/build/theme.mjs')

  await buildRegistries(projectRoot)
  await buildTheme(projectRoot)

  spawn('npx', ['next', 'build'], { stdio: 'inherit', shell: true })
}

// Command router
switch (command) {
  case 'dev':
    dev()
    break
  case 'build':
    build()
    break
  default:
    console.log('Available commands: dev, build')
}
```

## Using in package.json

For consumer projects, add these scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "build:registries": "node node_modules/@nextspark/core/scripts/build/registry.mjs",
    "build:theme": "node node_modules/@nextspark/core/scripts/build/theme.mjs",
    "db:migrate": "node node_modules/@nextspark/core/scripts/db/run-migrations.mjs"
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_ACTIVE_THEME` | `default` | Active theme |
| `NEXTSPARK_DEBUG` | - | Enable debug output |

## Roadmap

### v0.3.0 - CLI Improvements
- [ ] `npx nextspark init` - Initialize in existing project
- [ ] `npx nextspark dev` - Dev with watch mode
- [ ] `npx nextspark build` - Production build

### v0.4.0 - create-nextspark
- [ ] `npx create-nextspark` - Full project scaffolding
- [ ] Interactive prompts for theme selection
- [ ] Database provider selection (Supabase, Neon, etc.)

## Troubleshooting

### Command Not Found

The CLI requires the package to be installed:

```bash
pnpm add @nextspark/core
```

### Permission Denied

On Unix systems:

```bash
chmod +x node_modules/@nextspark/core/bin/nextspark.mjs
```

### Config Not Found

Ensure `nextspark.config.ts` exists in your project root.

## Related

- [03-build-scripts.md](./03-build-scripts.md) - Build scripts
- [04-config-system.md](./04-config-system.md) - Configuration
- [00-getting-started.md](./00-getting-started.md) - Setup guide
