# Project Theme Registry Architecture

## Overview

The root-first compiler emits one project/theme registry entry. The registry is
build-time data, not a mechanism for selecting a project or switching between
sibling theme directories.

## Resolution

`packages/core/scripts/build/registry/project-mode.mjs` is the single owner of
compiler path resolution. It finds the nearest `nextspark.config.ts`, validates
the root's `package.json`, and supplies the project source and output paths to
discovery and generation.

## Discovery

The project/theme discovery module reads directly from the project root:

```text
config/theme.config.ts
config/dashboard.config.ts
config/app.config.ts
config/dev.config.ts
components/
styles/
public/
messages/
entities/
api/
```

Enabled local plugin names come from `nextspark.config.ts` and resolve only to
immediate directories under `plugins/`.

## Output

The generator writes:

```text
.nextspark/registries/theme-registry.ts
```

Consumers import it through `@nextsparkjs/registries/theme-registry`. The entry
contains configuration, capability flags, discovered entities and route files,
and enabled local plugin names.

## Runtime access

`ThemeService` exposes current-project helpers that do not require callers to
know the compatibility registry key:

```ts
import { ThemeService } from '@nextsparkjs/core/lib/services'

const entry = ThemeService.getCurrentEntry()
const themeConfig = ThemeService.getCurrent()
const dashboardConfig = ThemeService.getCurrentDashboardConfig()
const appConfig = ThemeService.getCurrentAppConfig()
```

Name-based helpers remain for compatibility with registry-oriented code, but
the generated registry contains only the current project.

## Invariants

- No environment variable selects a theme or project.
- No compiler module scans a legacy theme directory.
- Project source imports use `@/*`.
- Local plugin imports use `@/plugins/*`.
- Generated registry imports use `@nextsparkjs/registries/*`.
- Only `src/app/` and `.nextspark/registries/` are compiler-owned outputs.
