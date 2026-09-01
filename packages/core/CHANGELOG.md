# Changelog

All notable changes to `@nextsparkjs/core` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Registry-driven MCP (Model Context Protocol) server engine (`@nextsparkjs/core/lib/mcp`, #98).**
  Every `access.api`-enabled entity in the entity registry now gets a working MCP tool
  surface for free — `list`/`get`/`create`/`update`/`delete` tools generated from each
  entity's field definitions, with zero per-entity code. See
  [docs/05-api/20-mcp-server.md](./docs/05-api/20-mcp-server.md).
  - **Engine** (`engine.ts`, `tool-generator.ts`, `schema-builder.ts`) builds a JSON-Schema
    presentation layer from `EntityField[]` (the core's own `generateEntitySchemas` output
    can't back `tools/list` — some field types use a `z.union([..., z.undefined()]).transform()`
    shape `z.toJSONSchema()` rejects). The presentation layer also hardens the generated
    `list` tool against known silent-failure modes of the generic list endpoint: strict
    unknown-key rejection, a `sortBy` enum restricted to sortable fields, `datetime` fields
    excluded from `filters` (equality against a timestamptz silently returns `[]`), a
    `dateField`/`from`/`to` cross-field rule, and `distinct` never exposed.
  - **Executor** (`executor.ts`) invokes the real `handleGenericList/Create/Read/Update/Delete`
    handlers in-process with a synthesized request — the exact same code path
    `/api/v1/{entity}` uses, so every tool call inherits the fixed scope + team-role
    permission + ownership/field-guard enforcement (#94, #95) automatically. No separate
    authorization layer is re-implemented in the MCP engine.
  - **Transport** (`transport.ts`) is a ~80 LOC stateless in-memory `Transport` adapter,
    since the SDK's `StreamableHTTPServerTransport` requires Node's
    `IncomingMessage`/`ServerResponse`, unavailable in the Next.js App Router request model.
  - **Registry discovery**: a theme customizes one entity's MCP surface by adding
    `entities/<slug>/mcp.ts` (`McpEntityOverride` — exclude, excludeOperations,
    relaxRequired, describe, errorHints, transformInput/transformOutput, extraTools),
    auto-discovered by a new `mcp-overrides` registry generator the same way
    `entities/<slug>/api/presets.ts` is discovered today — no manual import list to maintain.
  - **Audit**: every tool call, success or failure, is written to `api_audit_log` with an
    `mcp:<tool>` endpoint prefix.
  - New dependency: `@modelcontextprotocol/sdk` (`zod` was already in core's dependency tree).
  - New package export: `@nextsparkjs/core/lib/mcp`.

### Security

- **API-key scope minting now matches scope enforcement (#94).** `validateScopesForUser`
  — the gate deciding which scopes a user may mint into an API key — previously checked
  a hardcoded map keyed by the caller's **global** `users.role`, referencing a
  nonexistent role (`colaborator`) and missing `owner`/`viewer` entirely. Independently,
  the scope-registry generator that was supposed to back this was dead code: it read
  entity properties (`entity.api.endpoints`, `entity.features`) that don't exist on the
  real entity-discovery shape, so `SCOPE_CONFIG.roles` was 100% hardcoded, wrong JSON
  referencing a nonexistent `products` entity. Net effect: **no non-superadmin user
  could ever mint a working API key for their own theme's entities.**
  - The scope-registry generator (`scope-registry.mjs`) now emits a file that computes
    `SCOPE_CONFIG.roles` at import time, deriving `<slug>:read/write/delete` per
    API-exposed entity from the same team-role permission matrix
    (`PERMISSIONS_BY_ROLE`) the request-time authorization check uses — scope minting
    and scope enforcement can no longer drift apart.
  - `validateScopesForUser(userId, teamId, requestedScopes)` now takes an explicit
    `teamId` and resolves the caller's real **team** role via `TeamMemberService`,
    with an explicit bypass for the global `superadmin` role (which is not a team role
    and never appears in `AVAILABLE_ROLES`).
  - `POST /api/v1/api-keys` now resolves team context (`x-team-id` header / cookie /
    default team) before validating requested scopes, for any non-superadmin caller.
  - Fixed a satellite bug: `handleGenericDelete` checked the entity's `:write` scope
    instead of `:delete` — a write-scoped key could delete, and the `:delete` scope was
    pure decoration.
  - Removed the undocumented, unmintable `admin:all` scope from `hasRequiredScope` —
    dead code (nothing could mint it) and a latent, undocumented full-access string.
    Use `*` instead.

- **API-key authentication no longer bypasses team-role permission checks, field
  guards, or ownership-based row filtering on the generic entity routes (#95).**
  `/api/v1/[entity]` previously ran three authorization layers — a team-role
  permission check, per-role field write guards, and ownership-scoped row
  filtering — only for session-authenticated requests, explicitly skipping all
  three for API-key auth on the stated assumption that scopes alone governed
  API-key requests. Scopes only ever expressed entity+operation granularity, so a
  scoped key could read/write outside its owner's team role, ownership scope, or
  field restrictions — broader access than the same user's own session. All three
  checks now run identically for both auth types.

- **SQL identifier injection in the generic list `distinct` query (#96).**
  `GET /api/v1/{entity}?fields=X&distinct=true` interpolated the raw `fields`
  value as a quoted SQL identifier without validating it against the entity's
  fields — unlike the sibling non-distinct branch — so any caller with
  `<slug>:read` could inject SQL into the SELECT list. The name is now
  validated first (`400 INVALID_FIELD`) through the same `isEntityField` check
  both branches share.

### Fixed

- **`beforeEntityCreate` is now invoked by the generic create handler (#118).**
  `POST /api/v1/{entity}` only fired `afterEntityCreate`, so the
  `entity.<slug>.before_create` filter could neither reshape nor reject a
  payload before the INSERT. The hook now runs after authorization and before
  the write; a thrown error rejects the create with `400
  BEFORE_CREATE_REJECTED` (or the 4xx `status` the error carries).

- **Generic entity handler no longer fails silently on bad list parameters,
  unknown body keys, or CHECK-constraint violations (#97).** Each of these used
  to return a plausible-looking wrong answer instead of an error the caller
  could act on:
  - `?search=` on an entity with none of `name`/`title`/`slug`/`content` → `400
    SEARCH_NOT_SUPPORTED` (was: every row, unfiltered).
  - A custom filter whose key is not an entity field (`?statuz=active`) → `400
    INVALID_FILTER` naming the key(s) (was: filter silently dropped). Legacy
    client params (`includeMeta`, `userId`, `sort`/`order`, `userFiltered`)
    stay accepted; `sort`/`order` now work as aliases of `sortBy`/`sortOrder`.
  - An invalid `?sortBy=` → `400 INVALID_SORT_FIELD` (was: silent default sort).
  - `?dateField=2026-01-15` on a `date`/`datetime` field matches the whole
    day (`>= day AND < day + 1`) instead of an equality that never matched a
    timestamp; values with a time component keep exact equality.
  - Create/update schemas from `generateEntitySchemas` are now `.strict()`:
    an unknown body key (`notes` for `note`) → `400 VALIDATION_ERROR` with an
    `unrecognized_keys` issue (was: silently stripped, `201`). Keys the handler
    consumes itself (`metas`, `userId`, `teamId`, taxonomy relation arrays,
    builder `blocks`/`settings`) are unaffected.
  - PostgreSQL `23514` CHECK violations → `422 CHECK_CONSTRAINT_VIOLATION`
    with the constraint name; `23503` on create/update → `422
    FOREIGN_KEY_VIOLATION` (was: opaque `500`). `23505` → `409` and delete
    `23503` → `409` are unchanged.

### Known Limitations

- Requests against the generic entity routes (`/api/v1/[entity]`) — session or
  API-key — are still not written to `api_audit_log`; that table's `apiKeyId`
  column is `NOT NULL`, so closing this gap needs a migration and a new logging
  path, tracked separately from the fixes above.

## [0.1.0-beta.167]

### Security — RLS Enforcement Layer

This release closes a class of latent security gaps that only surface once the
app connects to Postgres as a **non-owner role** (the owner skips RLS). It makes
RLS real and is **backward-compatible**: installs that keep connecting as the
owner behave exactly as before. The "cutover" to real RLS is opt-in via env.

> **Upgrade note (existing databases):** several ORIGINAL migrations were edited
> in place (002/007/008/009/010/013/016/017). The migration runner tracks by
> filename, so already-migrated databases will NOT re-apply them — run
> `pnpm db:reset` to recreate the schema with the new policies.

### Added
- **Service connection (`DATABASE_SERVICE_URL`)**: a second DB pool that BYPASSES
  RLS for system operations (Better Auth login/verification, scheduler/processor,
  payment webhooks, superadmin bypass, privileged team/subscription bootstrap).
  `db.ts` routes by presence of `userId` (no userId → service); a `{ service: true }`
  option + `getServiceTransactionClient()` force the service pool for userId-bearing
  bootstraps. Falls back to `DATABASE_URL` when unset.
- **Runtime role migration `022_rls_runtime_roles.sql`**: creates the non-owner
  `nextspark_app` runtime role (member of `authenticated`, no `BYPASSRLS`), grants,
  default privileges for future objects, and an `anon` lockdown.
- **`MIGRATE_DATABASE_URL`**: run migrations/seeds as the table owner while the
  runtime connects as `nextspark_app`. Falls back to `DATABASE_URL`.
- **Direct-field `ownershipFilter`**: `ownershipFilter.linkedBy` is now optional
  (direct ownership via the entity's own column), and `linkedBy.softDelete?: boolean`
  makes the `deletedAt IS NULL` clause conditional (supports entities without a
  `deletedAt` column).

### Changed
- **LIST/READ permission enforcement**: the generic entity handler now checks
  session permissions on LIST and READ (previously only create/update/delete). A
  member without `entity.list`/`entity.read` gets 403. Admin bypass and API-key
  (scope-based) paths are unaffected.
- **Permission check fails CLOSED**: a thrown error during the session permission
  check now returns `500 PERMISSION_CHECK_FAILED` instead of allowing access.
- **Hardened default RLS policies**: `users`/`account`/`session`/`verification`
  (002), `subscriptions`/`billing_events` (013/016) and `scheduled_actions` (017)
  replace their permissive `USING (true)` / `WITH CHECK (true)` defaults with
  per-user / elevated-tier / service-only policies.
- **`team_role` is now `TEXT` (not a Postgres ENUM)**: themes extend team roles via
  config (`availableTeamRoles` + `permissions.config.ts`) without patching the DB.
  No privilege boundary is lost (RLS compares against explicit literals; unknown
  roles fail closed). Affects migrations 007/008/009/010.
- **Better Auth** connects via the service connection; `pgbouncer=true` is now only
  appended for pooler URLs.

### Added
- **Cross-subdomain session cookies** (`COOKIE_BASE_DOMAIN`): opt-in env var that
  scopes the auth session cookie to a shared base domain (e.g. `.example.com`) so
  the session is readable across sibling subdomains. Enables OAuth running on the
  apex to carry the session back to tenant subdomains in multi-tenant setups
  (social providers don't allow wildcard `redirect_uri`s, so OAuth can't run on
  the subdomain itself). Off by default — cookies stay host-scoped unless
  `COOKIE_BASE_DOMAIN` is set; pair it with a wildcard in `CORS_ADDITIONAL_ORIGINS`
  (e.g. `https://*.example.com`). See `docs/06-authentication/05-session-management.md`.

## [0.1.0-beta.147] - 2026-04-19

### Fixed
- **Root layout `NextIntlClientProvider` missing `locale` prop**: Dashboard pages crashed with
  `No intl context found. Have you configured the provider?` when the project had a different
  `next-intl` version (e.g. 4.8.x) than the one bundled with core (4.9.x). Each package version
  creates its own `IntlContext`, so the provider from one copy never matched consumers from the other.
  Fixed in `templates/app/layout.tsx` by explicitly passing `locale={locale}` and bumped core's
  `next-intl` dependency to `^4.9.1` to encourage deduplication.

### Migration notes (from <= 0.146)
Projects upgrading may need to deduplicate `next-intl`/`use-intl` in their monorepo. Add to the
root `package.json`:
```json
"pnpm": {
  "overrides": {
    "next-intl": "^4.9.1",
    "use-intl": "^4.9.1"
  }
}
```
Then `pnpm install` + restart dev. Run `pnpm nextspark sync:app --force` to refresh the
auto-generated `app/layout.tsx` with the `locale` prop fix.

## [0.1.0-beta.3] - 2025-01-04

### Added
- **ESLint Configuration**: Added `eslint.config.mjs` template for generated projects
- **Langchain Plugin Support**: Fixed demo theme installer to properly copy langchain plugin files
- **Starter Theme**: Minimal starter theme template for new projects
- **Pre-compiled UI CSS**: 120KB of pre-compiled Tailwind classes for UI components
- **Jest Mock Registries**: Comprehensive mock registries for unit testing
- **Web Crypto API Polyfills**: Full crypto support for API key tests

### Changed
- **Wizard Improvements**: Enhanced 9-step wizard with better validation
- **Package Structure**: Optimized exports for tree-shaking
- **Test Infrastructure**: Improved Jest configuration with proper module mappings

### Fixed
- **Demo Theme Installation**: Langchain plugin files now properly copied during demo installation
- **Cypress Support**: Fixed TypeScript support in Cypress tests via webpack preprocessor
- **DevKeyring Styles**: Fixed popover styles using pre-compiled CSS approach

## [0.1.0-beta.2] - 2025-01-03

### Added
- **Cypress Testing Framework**: Full E2E test infrastructure with @cypress/grep
- **Allure Reporting**: Integrated allure-cypress for test reports
- **Theme Templates**: Complete default and starter theme templates
- **Registry System**: Build-time registry generation for ultra-fast runtime

### Changed
- **Module Resolution**: Updated path mappings for ESM compatibility
- **Build Process**: Unified build script with tsup + tsc

### Fixed
- **Translation System**: All translation keys now properly resolved
- **Type Generation**: Fixed .d.ts generation for all exports

## [0.1.0-beta.1] - 2025-01-02

### Added
- **Initial Beta Release**: First public beta of @nextsparkjs/core
- **Interactive Wizard**: 9-step project generator with presets
- **Entity System**: Complete CRUD with dynamic API generation
- **Authentication**: Better Auth integration with social providers
- **Billing System**: Stripe integration with plans, features, and limits
- **Teams & Permissions**: Multi-tenant support with role-based access
- **i18n Support**: Multi-language with next-intl (6 languages)
- **UI Components**: 50+ shadcn/ui based components
- **DevTools**: Built-in development tools and API tester
- **Theme System**: Plugin-based theming architecture
- **Block Editor**: Drag-and-drop page builder

### Developer Experience
- **TypeScript First**: Full type safety across the framework
- **Hot Reload**: Fast refresh for theme development
- **CLI Tools**: `nextspark init`, `nextspark dev`, `nextspark build`
- **Testing Support**: Jest and Cypress configurations included

---

## Package Links

- **npm**: https://www.npmjs.com/package/@nextsparkjs/core
- **GitHub**: https://github.com/NextSpark-js/nextspark
- **Documentation**: https://nextspark.dev/docs
