# Project Theme Registry

The compiler writes `.nextspark/registries/theme-registry.ts` for the project
found through `nextspark.config.ts`. The registry contains exactly one
project-owned presentation entry; it is not a catalog of selectable sibling
themes.

## Importing the registry

```ts
import {
  THEME_REGISTRY,
  THEME_METADATA,
  type ThemeRegistryEntry,
} from '@nextsparkjs/registries/theme-registry'
```

Most application code should use `ThemeService` instead of indexing the
registry by a configured name:

```ts
import { ThemeService } from '@nextsparkjs/core/lib/services'

const entry = ThemeService.getCurrentEntry()
const theme = ThemeService.getCurrent()
const dashboardConfig = ThemeService.getCurrentDashboardConfig()
const appConfig = ThemeService.getCurrentAppConfig()
```

## Generated entry

The entry records:

- `config/theme.config.ts`
- optional app, dashboard, and development configuration
- root-level components, styles, assets, and messages
- project entities and API routes
- enabled local plugin names
- optional scheduled actions and project request-hook metadata

The key is derived from the project theme configuration for compatibility with
existing registry APIs. It does not select a different project.

## Rebuilding

```bash
# Generated project
pnpm build:registries

# Repository reference project
cd apps/dev
node ../../packages/core/scripts/build/registry.mjs --build
```

Never edit `.nextspark/registries/theme-registry.ts` directly.
