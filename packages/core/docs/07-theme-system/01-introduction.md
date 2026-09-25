# Project Theme System

> **Registry commands in this guide** run in a generated project, from its root. In the NextSpark monorepo, run `cd apps/dev && node ../../packages/core/scripts/build/registry.mjs` (add `--watch` to watch).

## Overview

In the root-first layout, presentation source belongs to the project itself.
There is no runtime theme selector and no `contents/themes/<name>` directory.
A project may be created from an install-once template, but the extracted files
are immediately project-owned.

## Project-owned source

```text
config/theme.config.ts
config/app.config.ts
config/dashboard.config.ts
styles/globals.css
styles/components.css
components/
blocks/
entities/
messages/
public/
templates/
```

Edit these files directly. The compiler discovers the project from the nearest
`nextspark.config.ts`, reads root-level source, and generates `src/app/` plus
`.nextspark/registries/`.

## Install-once templates

The bundled template catalog is under:

```text
packages/core/templates/projects/starter/
packages/core/templates/projects/blog/
packages/core/templates/projects/crm/
packages/core/templates/projects/productivity/
```

`create-nextspark-app --theme <name>` extracts one payload into the new
project root. Later framework upgrades do not merge or restore template files.
The optional `template` field in `nextspark.config.ts` records provenance only.

## Configuration

`config/theme.config.ts` defines presentation metadata and design behavior.
`config/app.config.ts` and `config/dashboard.config.ts` define application and
navigation overrides. Build-time feature and local-plugin selection belongs in
`nextspark.config.ts`.

```ts
import { defineConfig } from '@nextsparkjs/core/lib/config'

export default defineConfig({
  plugins: ['analytics'],
  template: { name: 'crm', version: '0.1.0-beta.193' },
})
```

## Styles

Project styles live under `styles/`. The build maintains the generated
`src/app/globals.css` adapter and `.next/theme-generated.css`; do not edit those
outputs directly.

## Runtime access

The generated project/theme registry contains one project entry. Prefer the
current-project helpers:

```ts
import { ThemeService } from '@nextsparkjs/core/lib/services'

const theme = ThemeService.getCurrent()
const appConfig = ThemeService.getCurrentAppConfig()
const dashboard = ThemeService.getCurrentDashboardConfig()
```

## Development workflow

```bash
# From the project root
pnpm build:registries
pnpm dev
```

When working in this repository, the reference project root is `apps/dev`:

```bash
cd apps/dev
node ../../packages/core/scripts/build/registry.mjs --build
pnpm dev
```
