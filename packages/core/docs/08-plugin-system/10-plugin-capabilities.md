# Plugin Capabilities

> Part of RFC #203 ("Plugin model"). Runtime plugins declare the surfaces they contribute to; the compiler takes only what is declared and fails generation on anything else.

## Declaring capabilities

Write the plugin config with `definePlugin` and a **literal** `capabilities` array:

```ts
// plugins/example/plugin.config.ts
import { definePlugin } from '@nextsparkjs/core/types/plugin'

export const examplePluginConfig = definePlugin({
  name: 'example',
  capabilities: ['server', 'web'],
})

export default examplePluginConfig
```

`definePlugin` returns a regular `PluginConfig`. Everything else in `PluginConfig` (`displayName`, `version`, `hooks`, `api`, ...) still works; `displayName` defaults to `name`, `version` to `0.0.0` and `enabled` to `true`.

The registry build reads `capabilities` from the source without running the config, so it must be an array literal of the four names below. A computed list, an unknown name or an empty array fails generation (`NS_PLUGIN_CAPABILITY_INVALID`).

| Capability | Contributes | Files it covers |
| --- | --- | --- |
| `server` | API routes (`/api/plugins/<name>/**`), entities, settings areas, server pages, the server registries | `api/**`, `entities/**`, `settings/**`, `plugin.pages.server.ts`, and Route Handlers (`route.ts`) under `templates/` |
| `web` | Routes and layouts of the web host, components, messages, assets, the client registry | `templates/**` except Route Handlers, `components/**`, `hooks/**`, `providers/**`, `messages/**`, `assets/**`, `styles/**`, any file with a `'use client'` directive |
| `mobile` | The mobile entry | `mobile/**` |
| `build` | Build-time code (codemods, generators) | `build/**` |

A plugin whose config declares no `capabilities` is **legacy**: it is treated as `server` + `web` + `build` (everything but `mobile`), so plugins that have not moved to `definePlugin` keep working. Declare the capabilities the plugin really has; it is the only way to get the checks below against a narrower surface.

## What the compiler enforces

Every violation fails generation (`nextspark prepare`, `nextspark dev` and the registry build) with a diagnostic that names the **plugin**, the **capability** and the **file**.

1. **Only what is declared is taken.**
   - A file in a surface the plugin did not declare is `NS_PLUGIN_CAPABILITY_UNDECLARED`: `plugins/demo/api/hello/route.ts: is in api/, so the plugin needs the "server" capability, but it declares [web]`.
   - The host plan follows the same rule: a page or layout under `templates/` needs `web`, a Route Handler (`api/**`, or a `route` file under `templates/`) needs `server`.
   - `plugin-registry.ts`, the route-handler registry and the unified registry list only the `server` plugins; `plugin-registry.client.ts` lists only the `web` ones. A `build`-only or `mobile`-only plugin is in neither.
   - `plugin-catalog.ts` is capability-neutral: static metadata (name, display name, version, description, `enabled`, capabilities, what it contributes; `enabled` is the config's literal boolean, `null` when the config computes it,) of every enabled plugin, importing nothing. `PluginService.getCatalog()`, `getNames()`, `getCount()` and `exists()` read it; `PluginService.getAll()` / `get()` stay the executable server plugins. The devtools and superadmin layouts merge the navigation of both registries (`getAllPluginNavItems`). A web-only plugin has no server code, so its `onLoad` hook does not run on the server.
2. **A web or mobile entry cannot reach server code** (`NS_PLUGIN_SERVER_IN_CLIENT`). The compiler follows the import graph from every `web` entry (`templates/` pages, `components/`, `hooks/`, `providers/`, `'use client'` files, and `plugin.config.ts` when the plugin declares `web`) and every `mobile` entry (`mobile/`). Reaching any of these is a violation, and the message shows the import chain:
   - server code: the plugin's `api/` files and `templates/` Route Handlers, the project's `api/`, any `route.*` file, and any `*.server.*` module;
   - a module that imports `server-only`, `next/headers`, `next/server`, a Node built-in (`node:fs`, `path`, ...), `pg` and the other server packages listed in `discovery/plugin-capabilities.mjs`, or a server-only core module (`@nextsparkjs/core/lib/db`, `.../lib/api/**`, ...): also when it is only reached through another module (a web component importing `@nextsparkjs/core/lib/locale` fails because that file imports `next/headers`).

   What is followed, and what is not (the boundary):
   - **Workspace files** (plugins, the project, workspace packages) resolve with TypeScript and the plugin's real compiler options (its own `tsconfig.json`, else the project's: `paths`, `baseUrl`, `extends`). `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs` and `.cjs` are all traversed, including `index` files.
   - **Workspace packages and every `@nextsparkjs/*` package** resolve to the runtime target that the bundler of the entry being checked selects for that edge, never the `types` one. The edge kind matters: an ESM `import` / `export from` / `import()` selects the `import` branch, a CommonJS `require()` or TypeScript `import x = require()` the `require` branch. A `web` entry uses Next's client conditions (`browser`, then `import`+`module`+`default` or `require`+`default`; never `node`), and because webpack and Turbopack differ on `require`, a web `require` is checked against both branches and reported if either reaches server code. A `mobile` entry uses Metro's (`react-native` + `import` for ESM, `react-native` + `require` for CommonJS, then `default`), and the `build` check the server's (`node`, `import`/`require`, `default`). Wildcard subpaths are matched; without `exports` the `browser` / `react-native` / `module` / `main` fields are tried in that order, and the object form of `browser` (`{ "./server.js": "./browser.js", "fs": false }`, `false` = empty module) replaces modules in the package for client targets: a relative replacement is a file inside the package, a bare one (`{ "safe-dep": "unsafe-dep" }`) is followed as a package import of the same target and edge kind (cycles in the map are cut), and an edge is dropped only for an explicit `false` or because its replacement was followed. A replacement that names no file or package is `NS_PLUGIN_BROWSER_MAP_UNRESOLVED`, never a silent drop. So `{ "browser": "./server.js", "import": "./clean.js" }` reaches `server.js` from a web plugin, `{ "node": "./server.js", "import": "./clean.js" }` does not, and `{ "import": "./clean.js", "require": "./server.cjs" }` is clean for an ESM import but not for a mobile `require`. A `dist/` file that was not built falls back to its `src/` file.
   - **Third-party packages in `node_modules`** are not opened for `web`; the bundlers fail those builds themselves, and `packages/core/tests/node/third-party-boundary.test.ts` proves it with real builds (run with `NEXTSPARK_BUNDLER_BOUNDARY=1`; gated because each build takes seconds to a minute): Next (webpack and Turbopack) rejects a client component whose third-party package imports `node:fs` or `server-only`, and builds the same component over a clean package. For `mobile` the compiler *does* read third-party entries, but only for `server-only`: Metro (the same test, with the metro of the workspace store) fails a third-party `node:fs` (`Unable to resolve module node:fs`) but bundles a third-party `server-only` import without complaint, because that package only throws when it runs.

   Type-only imports and re-exports (`import type`, `import { type X }`, `export { type X } from`) are erased and are not followed.
3. **Build code never enters a runtime bundle** (`NS_PLUGIN_BUILD_IN_RUNTIME`): nothing in `build/**` may be reachable from the `server`, `web` or `mobile` entries.

A plugin that imports a runtime value from `@nextsparkjs/core` (`definePlugin` included) must declare a `@nextsparkjs/core` peer dependency no lower than `0.1.0-beta.192`, the first release that exports `definePlugin` (checked by `scripts/packages/plugin-core-peer.test.mjs`); in this workspace each plugin also links the workspace core as a dev dependency.

Test files, `__tests__`, `docs`, `examples`, `migrations` and `node_modules` are not contributions and are not scanned.

## Collisions between plugins

Collisions are diagnostics naming **both** plugins. The order plugins are discovered in never changes the result: names are sorted before they are compared and reported.

| Collision | Diagnostic |
| --- | --- |
| Two sources with the same plugin name (a registry key) | `NS_PLUGIN_NAME_COLLISION` |
| The same entity name in two plugins | `NS_PLUGIN_ENTITY_COLLISION` (core and the project may still replace a plugin's entity on purpose) |
| The same web route (`templates/**`) in two plugins | `NS_HOST_ROUTE_COLLISION`: `two plugins provide this route: plugins/a/... and plugins/b/...` |

A plugin's API is namespaced at `/api/plugins/<name>/**`, so two plugins with different names never collide there.

## Migrating a plugin

1. Replace `export const fooPluginConfig: PluginConfig = { ... }` with `definePlugin({ ..., capabilities: [...] })`.
2. List what the plugin has: an `api/` or `entities/` directory means `server`; `components/`, `hooks/`, `providers/`, `templates/` or `messages/` means `web`.
3. In a generated project, run `pnpm build:registries` (or `nextspark prepare`). Fix each diagnostic: declare the capability, or move the code that the diagnostic names.

The plugins in this repository declare: `ai` `['server']`, `social-media-publisher` `['server']`, `amplitude` `['web']`, `walkme` `['web']`, `langchain` `['server', 'web']`.

## Not covered yet

Declaration, enforcement and collisions are in. The full contribution model (a plugin contributing blocks, templates and migrations through one manifest, precedence for product packages, an ownership manifest) is a later stage of #203, and there is no mobile host yet: `mobile` is declared and checked but nothing consumes it.

## Limits of the static check

The check is a static import-graph analysis, not a bundler. It does **not** model:

- **Dynamic specifiers**: `import(name)` / `require(name)` with a computed string, `require.resolve`, `new URL(..., import.meta.url)` and asset imports are not edges. (A registry module that imports a plugin by a variable is already rejected elsewhere by the generated-host grammar.)
- **Reachability**: an edge is followed whether or not the code path runs, so a `server-only` import behind `if (typeof window === 'undefined')` or a dead branch is still reported, and tree-shaking is ignored. Move the server part to its own module.
- **Bundler-specific resolution beyond the modeled subset**: `exports` conditions other than `browser`, `react-native`, `import`, `require`, `module`, `node`, `default`; custom conditions (`customConditions`, `resolver.unstable_conditionNames`); `imports` (`#internal`) maps; webpack `resolve.alias` / Turbopack `resolveAlias`; Metro `resolveRequest`; and the `module-sync` condition. The legacy `browser` object form is applied to client targets; `react-native` / `module` field maps are not.
- **Non-code files**: only `.ts .tsx .mts .cts .js .jsx .mjs .cjs` are parsed; a `.json`, `.css` or `.wasm` module is not followed.
- **Third-party packages** (see the boundary above): not traversed for web; traversed for mobile only for `server-only`. A third-party server-only package that is neither a Node built-in nor `server-only` is caught by no one until it fails at run time.
- **Runtime environment checks in core**: server-only core modules are recognized by a fixed list and by following their imports; a core module that is server-only only by convention (no marker, no Node import) is not known.
- **Name-based surfaces**: server code is recognized by directory (`api/`, `entities/`, `settings/`, `templates/**/route.*`), by file name (`route.*`, `*.server.*`) and by marker imports. A server-only module with none of these that a client entry imports is caught only through its own markers.
- **Type checking**: `import type` and type-only specifiers are erased and ignored; a `.d.ts`-only package (no JavaScript beside it) has no runtime file to follow.

These are the cases the gated bundler tests (`NEXTSPARK_BUNDLER_BOUNDARY=1`) and the host build itself remain the backstop for.
