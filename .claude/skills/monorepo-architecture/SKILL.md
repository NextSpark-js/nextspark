# NextSpark Monorepo Architecture

## Overview

NextSpark uses a pnpm monorepo with strict separation of concerns between packages.

## Directory Structure

```
repo/
├── packages/
│   ├── core/           # @nextsparkjs/core - Library only (no CLI)
│   │   └── templates/projects/ # Install-once project template catalog
│   ├── cli/            # @nextsparkjs/cli - All CLI commands, wizard
│   └── create-nextspark-app/  # Wrapper that installs CLI + runs init
├── plugins/
│   ├── ai/             # @nextsparkjs/plugin-ai
│   ├── walkme/         # @nextsparkjs/plugin-walkme
│   └── ...
└── apps/
    └── dev/            # Development app (monorepo only)
```

## Package Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│  User Project (npm install)                                     │
│  └── @nextsparkjs/cli (has wizard, commands)                   │
│      └── @nextsparkjs/core (library, components, hooks)        │
├─────────────────────────────────────────────────────────────────┤
│  Project templates ship inside @nextsparkjs/core               │
│  Plugins depend on: @nextsparkjs/core (peerDependency)         │
└─────────────────────────────────────────────────────────────────┘
```

## Dependency Management

### Decision Tree: dependencies vs peerDependencies

```
Is this dependency...?
│
├── Framework/platform shared by all (react, next, zod)?
│   └── YES → peerDependency
│
├── Core library that user's project controls (@nextsparkjs/core)?
│   └── YES → peerDependency (workspace:* in monorepo)
│
├── Something specific to this theme/plugin that users don't manage?
│   └── YES → dependencies (regular)
│
└── Already provided by core (next-themes, lucide-react, etc)?
    └── YES → DO NOT ADD - import from core instead
```

### Examples

**CORRECT - Theme package.json:**
```json
{
  "dependencies": {
    "some-markdown-library": "^1.0.0"  // Theme-specific, users don't care
  },
  "peerDependencies": {
    "@nextsparkjs/core": "workspace:*",  // Framework
    "next": "^15.0.0 || ^16.0.0",                   // Platform
    "react": "^19.0.0",                  // Platform
    "react-dom": "^19.0.0",              // Platform
    "zod": "^4.0.0"                      // Shared utility
  }
}
```

**INCORRECT:**
```json
{
  "peerDependencies": {
    "next-themes": "^0.4.0"  // WRONG! Core already has this
  }
}
```

### Key Rules

1. **Never duplicate core's dependencies** - If core has it, use core's export
2. **peerDependencies are NOT auto-installed** - Consumer must provide them
3. **dependencies ARE auto-installed** - pnpm handles hoisting
4. **apps/dev should NOT duplicate theme/plugin deps** - pnpm resolves through workspace

## Root-first compilation

The directory containing `nextspark.config.ts` is the project, host, and
source root. Registry commands search upward for that marker and never select
among sibling themes or projects. Project source is discovered from root
directories such as `entities/`, `templates/`, and `messages/`; enabled local
plugins come only from the `plugins` list in `nextspark.config.ts` and live at
`plugins/<name>/`.

## Registry Generation

Before `next build`, registries must be regenerated:

```bash
# Run from the project root
pnpm exec nextspark registry:build

# Then build
pnpm build
```

The registries are written to: `apps/dev/.nextspark/registries/`

## Version Management

| Package Type | Version Pattern | Notes |
|-------------|-----------------|-------|
| Core packages | 0.1.0-beta.X | Increment X for each release |
| Themes | 0.1.0-beta.1 | Start at beta.1, match when stable |
| Plugins | 0.1.0-beta.1 | Start at beta.1, match when stable |

## Common Mistakes to Avoid

1. **Adding deps to apps/dev for theme needs** - Theme deps should resolve through workspace
2. **Using peerDependencies for theme-specific libs** - Use regular dependencies
3. **Importing from npm when core provides it** - Always check core exports first
4. **Not regenerating registries after theme change** - Run registry script before build
5. **Hardcoding theme imports in shared code** - Use registry lookups
