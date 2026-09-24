# Project Theme Registry

> **Registry commands in this guide** run in a generated project, from its root. In the NextSpark monorepo, run `cd apps/dev && node ../../packages/core/scripts/build/registry.mjs` (add `--watch` to watch).

The generated project/theme registry provides zero-runtime-I/O access to the
presentation configuration compiled from the root-first project.

## Location and imports

The compiler writes:

```text
.nextspark/registries/theme-registry.ts
```

Application code imports it through the generated alias:

```ts
import { THEME_REGISTRY, THEME_METADATA } from '@nextsparkjs/registries/theme-registry'
import { ThemeService } from '@nextsparkjs/core/lib/services'
```

Never edit the generated registry directly. Edit project-owned source such as
`config/theme.config.ts`, `config/dashboard.config.ts`,
`config/app.config.ts`, `entities/`, `api/`, or `styles/`, then rebuild.

## Root-first behavior

The compiler discovers exactly one project: the nearest ancestor containing
`nextspark.config.ts`. There is no active-theme environment variable and no
runtime project switch. The registry therefore contains one project entry,
whose name comes from `config/theme.config.ts`.

Use the current-project helpers when code does not need the compatibility name:

```ts
import { ThemeService } from '@nextsparkjs/core/lib/services'

const theme = ThemeService.getCurrent()
const dashboard = ThemeService.getCurrentDashboardConfig()
const app = ThemeService.getCurrentAppConfig()
```

Name-based helpers remain available for code that works with registry records:

```ts
import { ThemeService } from '@nextsparkjs/core/lib/services'

const projectName = ThemeService.getCurrentName()
const entry = ThemeService.getEntry(projectName)
```

## Registry entry

Each entry records the project theme config plus discovered capabilities:
components, styles, assets, messages, dashboard/app/dev configuration,
entities, API routes, scheduled actions, and enabled local plugins.

```ts
const entry = ThemeService.getCurrentEntry()

if (entry?.hasStyles) {
  console.log(`Project ${entry.name} supplies root-first styles`)
}
```

## Plugins

Local plugins live under `plugins/<name>/` and are enabled by
`nextspark.config.ts`:

```ts
import { defineConfig } from '@nextsparkjs/core/lib/config'

export default defineConfig({
  plugins: ['analytics'],
})
```

After changing the list, rebuild the registries. The generated project entry
records which local plugins were compiled.

## Testing

Mock `@nextsparkjs/registries/theme-registry` at the package alias, not at a
filesystem path. Project tests should run from a root containing
`nextspark.config.ts`.

## Troubleshooting

### Project entry is missing

```bash
ls nextspark.config.ts package.json config/theme.config.ts
pnpm build:registries
```

Confirm `package.json` declares `next` and that the config files are valid.

### Styles are stale

Edit `styles/globals.css`, rebuild, and restart the development server. The
compiler maintains the generated `src/app/globals.css` adapter.

### Plugin contribution is missing

Confirm the plugin directory exists under `plugins/`, its name is listed in
`nextspark.config.ts`, and its `plugin.config.ts` is valid.
