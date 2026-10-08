# Public API of `@nextsparkjs/core`

`@nextsparkjs/core` declares about 90 export subpaths, many of them wildcards (`./lib/*`, `./components/*`). Almost anything under `src/` can be imported. This page says which subpaths you can build on: those follow SemVer. Everything else may change in a minor release.

## The rule

A subpath is **public** if at least one of these holds:

1. It is listed on this page (the machine-readable copy is `packages/core/public-api.json`).
2. Code that a **stable** template copies into your project imports it. The `starter` project and the shared files the scaffold writes (`proxy.ts`, `instrumentation.ts`, `i18n.ts`, `next.config.mjs`, `lib/`, the block and feature templates) are stable. `blog`, `crm` and `productivity` are experimental.
3. It is a configuration contract: the `nextspark.config.ts` types, entity config, `definePlugin`, `BlockConfig`, the billing config types, permissions and features.

Everything else is **internal**, even if the exports map lets you import it.

**Barrels.** `.`, `./components/ui` and `./hooks` are barrels. A name a public barrel exports is public by name. Its own file subpath (`./components/ui/input`, `./hooks/useAuth`) is public only if it is listed. Importing `useAuth` from `@nextsparkjs/core` is covered by SemVer; importing it from `@nextsparkjs/core/hooks/useAuth` is not.

## What public means

- A breaking change to a public subpath needs a **major** release. A deprecation is announced in a minor, with a runtime or CLI notice and a changelog entry, and the item is removed in the next major.
- A public subpath is exported by the package for as long as the major lasts. A test (`tests/node/public-api.test.ts`) fails if an entry stops resolving to a built file through the exports map.
- A stable template cannot import a subpath that is not on the list, or build a core specifier at runtime: the same test fails and names the file and the subpath. Adding the subpath to the list is how a template makes it part of the contract. It also fails when a `template-import` entry is no longer imported by any stable template.
- A public subpath that belongs to an **experimental surface** (billing, scheduled actions, testing helpers) follows the experimental rule until that surface is stable: no guarantee, changes in a minor with a changelog note. Those rows are marked *experimental*.
- `./proxy` and `./instrumentation` are the request proxy and server startup. Their exports (`proxy`, `createProxy` and its options, `register`) are the contract; what they do inside (cookie names, the session hint, the order of the checks) is core's to change, like any behaviour behind a public function, and changes with a changelog note.

## What internal means

An internal subpath may change or disappear in a minor release, with no deprecation. Internal subpaths are versioned in lockstep with `@nextsparkjs/cli`, so a project that moves both together keeps working. Internal areas include:

- `routes/*`, `templates/*`, `scripts/*` and `migrations/*`;
- the testing selectors and helpers, except `./selectors` and `./lib/selectors/selector-factory`;
- the devtools components;
- the billing gateways and the webhook handlers (`lib/billing/stripe-webhook` and `polar-webhook` still resolve for one more minor; the webhook extension types are exported from `./lib/billing/config-types`);
- `lib/mcp`;
- the proxy plumbing behind `./proxy`: `lib/middleware`, `lib/auth/session-hint` and `lib/docs/access` (public up to 0.1.0-beta.197; the release after it made the scaffold's `proxy.ts` a facade over `./proxy`);
- any `lib/*`, `components/*`, `hooks/*` or `utils/*` subpath not on the list.

Importing an internal subpath from your own code works today and is not supported. Code samples in other guides that import an unlisted subpath use an internal API; the test prints the list of such subpaths. Three things that look like public paths are not:

- the generated `src/app` (it is regenerated, never edit it);
- the `node_modules/@nextsparkjs/core/scripts/...` files the generated `package.json` scripts run (they belong to the CLI);
- the generated Jest config, which maps `@nextsparkjs/core/(lib|hooks|components)/...` straight into `dist/` (the CLI owns it).

## Public subpaths

The reason in each row is one of `template-import` (a stable template imports it), `config-contract` or `documented`. A template change can retire a `template-import` entry with an upgrade note.

### Package root

| Subpath | Why it is public |
| --- | --- |
| `.` | documented — The package root: cn, the hooks, contexts, providers and UI components of the barrels, authenticateRequest and ThemeToggle. sel, cySelector and createAriaLabel are not exported from the root: import sel and cySelector from ./selectors. |

### Configuration

| Subpath | Why it is public |
| --- | --- |
| `./lib/config` | config-contract — defineConfig and validateNextSparkConfig for nextspark.config.ts; the generated nextspark.config.ts imports it. |
| `./lib/config/nextspark-types` | config-contract — The NextSparkConfig types behind nextspark.config.ts. |
| `./lib/config/types` | config-contract — App configuration types (app.config.ts, dev.config.ts). |
| `./lib/config/features-types` | config-contract — Feature flag configuration types (features.config.ts). |
| `./lib/billing/config-types` | config-contract (experimental) — Billing config types, plus the StripeWebhookExtensions and PolarWebhookExtensions types the webhook-extension templates import. The gateways and webhook modules are internal. |
| `./lib/permissions/types` | config-contract — Permission configuration types (permissions.config.ts). |
| `./lib/entities/types` | config-contract — Entity configuration types (EntityConfig and its fields). |
| `./types/blocks` | config-contract — BlockConfig, baseBlockSchema and the block field types. |
| `./types/plugin` | config-contract — definePlugin and the PluginConfig types. |
| `./types/theme` | config-contract — Project theme configuration types (theme.config.ts). |
| `./types/api-presets` | template-import — API presets for entity api folders. |

### UI components

| Subpath | Why it is public |
| --- | --- |
| `./components/ui` | template-import — Barrel for optimizePackageImports in next.config.mjs. Every name the barrel exports is public by name. |
| `./components/ui/avatar` | template-import |
| `./components/ui/badge` | template-import |
| `./components/ui/button` | template-import |
| `./components/ui/card` | template-import |
| `./components/ui/skeleton-features` | template-import |
| `./components/ui/skeleton-public` | template-import |

### Hooks and contexts

| Subpath | Why it is public |
| --- | --- |
| `./hooks` | template-import — Barrel for optimizePackageImports in next.config.mjs. Every name the barrel exports is public by name. |
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

### Entities and permissions

| Subpath | Why it is public |
| --- | --- |
| `./lib/services` | documented — Service classes the entity and permission guides call. |
| `./lib/api/auth` | documented — API auth helpers named by the permissions guides. |
| `./lib/permissions/hooks` | documented — Permission hooks named by the entity and teams guides. |
| `./lib/api/rate-limit` | documented — Rate limiting for API routes (rate-limiting guide). |
| `./lib/api/entity/generic-handler` | documented — The generic entity route handler named by the API guides. |
| `./components/entities/wrappers` | documented — Entity list, detail and form wrappers (entity guide). |

### Plugins and blocks

| Subpath | Why it is public |
| --- | --- |
| `./lib/plugins/hook-system` | documented — Entity and plugin hooks (entity and scheduled-action guides). |
| `./components/ui/input` | documented — Used by the plugin guide. |
| `./components/ui/select` | documented — Used by the plugin guide. |
| `./components/ui/textarea` | documented — Used by the plugin guide. |
| `./lib/blocks/loader` | documented — Block loader named by the page builder guide. |

### Request pipeline

| Subpath | Why it is public |
| --- | --- |
| `./lib/api/auth/dual-auth` | documented — authenticateRequest for API routes; the nextspark skills guide tells projects to import it. |
| `./proxy` | template-import — proxy and createProxy({ authenticatedPaths }): the request proxy the src/proxy.ts the scaffold writes re-exports. |
| `./instrumentation` | template-import — register(): the server startup the instrumentation.ts the scaffold writes re-exports. |
| `./lib/auth` | documented — The Better Auth instance (auth.api.getSession and the other server calls) the authentication and API guides use in project code. |
| `./lib/auth/runtime-readiness` | documented — getAuthReadinessResponse, which a project that overrides core's auth routes adds to them (passwordless guide), and logAuthReadinessAtStartup for a project instrumentation.ts that does not call core's register(). |
| `./lib/teams/active-team-cookie` | documented — ACTIVE_TEAM_COOKIE and activeTeamIdForSession, how server code reads the active team (teams permissions guide). |

### Jobs

| Subpath | Why it is public |
| --- | --- |
| `./lib/scheduled-actions` | documented (experimental) — registerScheduledAction, scheduleAction and the rest of the scheduled-actions API (scheduled actions guides). |

### Blocks

| Subpath | Why it is public |
| --- | --- |
| `./lib/blocks/sanitize-html` | template-import |

### Billing

| Subpath | Why it is public |
| --- | --- |
| `./hooks/useSubscription` | documented (experimental) — Billing is experimental. |
| `./hooks/useFeature` | documented (experimental) — Billing is experimental. |
| `./hooks/useQuota` | documented (experimental) — Billing is experimental. |
| `./hooks/useMembership` | documented (experimental) — Billing is experimental. |

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
| `./selectors` | template-import (experimental) — Public because the starter lib/selectors.ts and its Cypress tests import it. Testing helpers are experimental. |
| `./lib/selectors/selector-factory` | template-import (experimental) — Public because the starter lib/block-selectors.ts imports it: the lightweight import for blocks; the ./selectors barrel pulls in every domain. |

## Outside the exports map

These are public too, and are not subpaths: the root-first layout, the `templates/` and `api/` override conventions, the API namespaces, the documented `NEXTSPARK_*` variables, and the database schema as far as user data is concerned.

## Closing the exports map

The exports map stays open for the whole 1.x line, so internal subpaths keep resolving. Closing it to the public list is a **2.0** change, shipped with a codemod in `nextspark migrate`. Until then, the list and the test are the contract.
