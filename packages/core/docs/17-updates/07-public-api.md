# Public API of `@nextsparkjs/core`

`@nextsparkjs/core` declares about 90 export subpaths, many of them wildcards (`./lib/*`, `./components/*`). Almost anything under `src/` can be imported. This page says which subpaths you can build on: those follow SemVer. Everything else may change in a minor release.

## The rule

A subpath is **public** if at least one of these holds:

1. It is listed on this page (the machine-readable copy is `packages/core/public-api.json`).
2. Code that a **stable** template copies into your project imports it. The `starter` project and the shared files the scaffold writes (`proxy.ts`, `instrumentation.ts`, `i18n.ts`, `next.config.mjs`, `lib/`, the block and feature templates) are stable. `blog`, `crm` and `productivity` are experimental.
3. It is a configuration contract: the `nextspark.config.ts` types, entity config, `definePlugin`, `BlockConfig`, the billing config types, permissions and features.

Everything else is **internal**, even if the exports map lets you import it.

## What public means

- A breaking change to a public subpath needs a **major** release. A deprecation is announced in a minor, with a changelog entry, and the item is removed in the next major.
- A public subpath is exported by the package for as long as the major lasts. A test (`tests/node/public-api.test.ts`) fails if an entry stops resolving in the exports map.
- A stable template cannot import a subpath that is not on the list: the same test fails and names the file and the subpath. Adding the subpath to the list is how a template makes it part of the contract.

## What internal means

An internal subpath may change or disappear in a minor release, with no deprecation. Internal subpaths are versioned in lockstep with `@nextsparkjs/cli`, so a project that moves both together keeps working. Internal areas include:

- `routes/*`, `templates/*`, `scripts/*` and `migrations/*`;
- the testing selectors and helpers, except the two listed below;
- the devtools components;
- the billing gateways and the webhook handlers, except the two webhook modules listed below;
- `lib/mcp`;
- any `lib/*`, `components/*`, `hooks/*` or `utils/*` subpath not on the list.

Importing an internal subpath from your own code works today and is not supported. Two things that look like public paths are not: the generated `src/app` (it is regenerated, never edit it) and the `node_modules/@nextsparkjs/core/scripts/...` files the generated `package.json` scripts run (they belong to the CLI).

## Public subpaths

The reason in each row is one of `template-import` (a stable template imports it), `config-contract` or `documented`. A few subpaths are public only because a stable template imports them; they are marked, and a template change can retire them with an upgrade note.

### Package root

| Subpath | Why it is public |
| --- | --- |
| `.` | documented — The package root: cn, hooks, contexts, providers, UI components and authenticateRequest. |

### Configuration

| Subpath | Why it is public |
| --- | --- |
| `./lib/config` | config-contract — defineConfig and validateNextSparkConfig for nextspark.config.ts; the generated nextspark.config.ts imports it. |
| `./lib/config/nextspark-types` | config-contract — The NextSparkConfig types behind nextspark.config.ts. |
| `./lib/config/types` | config-contract — App configuration types (app.config.ts, dev.config.ts). |
| `./lib/config/features-types` | config-contract — Feature flag configuration types (features.config.ts). |
| `./lib/billing/config-types` | config-contract — Billing configuration types (billing.config.ts). |
| `./lib/permissions/types` | config-contract — Permission configuration types (permissions.config.ts). |
| `./lib/entities/types` | config-contract — Entity configuration types (EntityConfig and its fields). |
| `./types/blocks` | config-contract — BlockConfig, baseBlockSchema and the block field types. |
| `./types/plugin` | config-contract — definePlugin and the PluginConfig types. |
| `./types/theme` | config-contract — Project theme configuration types (theme.config.ts). |
| `./types/api-presets` | template-import — API presets for entity api folders. |

### UI components

| Subpath | Why it is public |
| --- | --- |
| `./components/ui` | template-import — Barrel for optimizePackageImports in next.config.mjs. |
| `./components/ui/avatar` | template-import |
| `./components/ui/badge` | template-import |
| `./components/ui/button` | template-import |
| `./components/ui/card` | template-import |
| `./components/ui/skeleton-features` | template-import |
| `./components/ui/skeleton-public` | template-import |

### Hooks and contexts

| Subpath | Why it is public |
| --- | --- |
| `./hooks` | template-import — Barrel for optimizePackageImports in next.config.mjs. |
| `./contexts/TeamContext` | template-import |

### Utilities

| Subpath | Why it is public |
| --- | --- |
| `./lib/utils` | template-import |
| `./lib/base-path` | template-import |

### Data access

| Subpath | Why it is public |
| --- | --- |
| `./lib/db` | template-import |

### Request pipeline

| Subpath | Why it is public |
| --- | --- |
| `./lib/api/auth/dual-auth` | documented — authenticateRequest for API routes; the nextspark skills guide tells projects to import it. |
| `./lib/auth` | template-import — Imported by the proxy.ts the scaffold writes. |
| `./lib/auth/session-hint` | template-import — Imported by the proxy.ts the scaffold writes. |
| `./lib/auth/runtime-readiness` | template-import — Imported by instrumentation.ts. |
| `./lib/middleware` | template-import — Imported by the proxy.ts the scaffold writes. |
| `./lib/teams/active-team-cookie` | template-import — Imported by the proxy.ts the scaffold writes. |
| `./lib/docs/access` | template-import — Imported by the proxy.ts the scaffold writes. |

### Jobs

| Subpath | Why it is public |
| --- | --- |
| `./lib/scheduled-actions` | template-import — Imported by instrumentation.ts. |

### Blocks

| Subpath | Why it is public |
| --- | --- |
| `./lib/blocks/sanitize-html` | template-import |

### Billing

| Subpath | Why it is public |
| --- | --- |
| `./lib/billing/stripe-webhook` | template-import — Public only because templates/lib/billing/stripe-webhook-extensions.ts imports it. The gateways and webhook handlers stay internal. |
| `./lib/billing/polar-webhook` | template-import — Public only because templates/lib/billing/polar-webhook-extensions.ts imports it. The gateways and webhook handlers stay internal. |

### Email

| Subpath | Why it is public |
| --- | --- |
| `./lib/email/types` | template-import |
| `./lib/email/send` | documented — Named by the emails/_README.md the starter copies. |
| `./emails/verify-email` | template-import |

### Internationalization

| Subpath | Why it is public |
| --- | --- |
| `./i18n` | template-import — Re-exported by the i18n.ts the scaffold writes. |
| `./lib/i18n/client-messages` | template-import |

### Styles

| Subpath | Why it is public |
| --- | --- |
| `./styles/utilities.css` | template-import — Imported by the starter globals.css. |
| `./styles/docs.css` | template-import — Imported by the starter globals.css. |

### Testing selectors

| Subpath | Why it is public |
| --- | --- |
| `./selectors` | template-import — Public only because the starter lib/selectors.ts and its Cypress tests import it. |
| `./lib/selectors/selector-factory` | template-import — Public only because the starter lib/block-selectors.ts imports it. |

## Outside the exports map

These are public too, and are not subpaths: the root-first layout, the `templates/` and `api/` override conventions, the API namespaces, the documented `NEXTSPARK_*` variables, and the database schema as far as user data is concerned.

## Closing the exports map

The exports map stays open for the whole 1.x line, so internal subpaths keep resolving. Closing it to the public list is a **2.0** change, shipped with a codemod in `nextspark migrate`. Until then, the list and the test are the contract.
