# Changelog

All notable changes to `@nextsparkjs/core` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
