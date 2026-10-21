# Upgrading 0.x projects to 0.1.0-beta.192 or later

This is the one upgrade path, supported from `0.1.0-beta.183` (the oldest release `nextspark migrate` is tested from; for anything older, first go to `0.1.0-beta.183`). A 0.x project (a `contents/themes/<theme>` layout, or a root-first project whose `src/app` was committed) upgrades to `0.1.0-beta.192` or a later release (the latest is the one to use) in two steps: install the new packages, then run `nextspark migrate` once. After that `src/app` is generated, git-ignored, and yours to leave alone. See the [generated host workflow](../01-fundamentals/08-generated-host.md) for how a project changes routes afterwards.

## Steps

1. Commit or stash everything: migrate refuses to move files on a dirty git tree. Work on a new branch.
2. Set every `@nextsparkjs/*` package to the same release, `0.1.0-beta.192` or later, in the root and in `web/` (or wherever the web app lives), including any `overrides` or `catalog` entries, and install. `pnpm update-core` does both only if the project is already on `0.1.0-beta.191` or later: earlier releases do not have it, so from `0.1.0-beta.183` to `0.1.0-beta.190` this step is manual, and a short checklist applies before step 1: see [Projects created before 0.1.0-beta.191](#projects-created-before-010-beta191). Do not bump `next` by hand: `migrate --yes` sets `next` and `eslint-config-next` to `~16.4.2` (the generator reads Next's own route rules and refuses another minor), and step 6 installs.
   `pnpm add` on pnpm 12 re-sorts the whole `dependencies` block, so a two-line change shows up as dozens of changed lines in `package.json`: commit it on its own.
3. Run `pnpm exec nextspark migrate --dry-run` from the web app's directory. It prints the report and changes nothing; it exits `1` when the migration would refuse to run, listing why under **App tree conversion**. `--json` prints the same as JSON. It also predicts the generated host on a throwaway copy (notices such as replaced entity routes and conflicts, and which checks ran); a prediction that fails is reported as unknown, never as clean.
   - **The active theme** comes from `NEXT_PUBLIC_ACTIVE_THEME` in the environment, else from `.env.example` in the web app's directory (the host root, e.g. `web/.env.example`, not the repository root). If the project keeps it elsewhere, set it on the command line: `NEXT_PUBLIC_ACTIVE_THEME=<theme> pnpm exec nextspark migrate --dry-run`, and the same for `--yes`.
4. Fix what the report names (and rename any entity called `users`, `teams`, `auth`, `billing`, `cron`, `api-keys`, `devtools`, `media`, `media-tags`, `blocks`, `patterns`, `post-categories` or `team-invitations`: core reserves those API namespaces and `prepare` refuses such an entity), then `pnpm exec nextspark migrate --yes`. Without `--yes` it stops after the report. Keep the rollback commands it prints until the upgrade is committed.
5. Review the printed summary and commit. If git still tracks files under `src/app`, run the `git rm -r -q --cached src/app` it prints (then commit) so that the now-ignored generated files leave the index.
6. **Install again** (at the root and in the web app). Migrate changes `next` and `eslint-config-next` to `~16.4.2`, so the install that came before it no longer matches `package.json`. Then `pnpm exec nextspark prepare`.
7. **Commit the contracts.** A web+mobile workspace gets a `packages/contracts` workspace package (wired into `pnpm-workspace.yaml` and into mobile's dependencies); commit it with its `src/` and `contracts.generation.json`. A web-only project has `.nextspark/contracts`, which is git-ignored.
8. **Untrack `next-env.d.ts`** if git tracks it (`git rm --cached next-env.d.ts`): migrate adds it to `.gitignore`, and Next rewrites it on every build.
9. Update the callers of every URL the report lists under **Project URLs that change**.
10. Verify: `pnpm exec nextspark prepare --check`, the web build, the mobile type-check, and in a web+mobile project `pnpm exec nextspark check:mobile`.

`--no-prepare` converts the files but does not generate `src/app` at the end; run `pnpm exec nextspark prepare` yourself.

### Projects created before 0.1.0-beta.191

`pnpm update-core` does not exist there, so step 2 is by hand: set `@nextsparkjs/cli`, `core`, `ui` and `testing` (devDependencies) to the same release, and the versions under the `nextspark` key of `package.json` if they differ, then `pnpm install --no-frozen-lockfile`. Also do these before step 1:

1. **Check `.gitignore`.** Those projects ignore `.nextspark/`, `.env` and the test outputs, but **not `node_modules/` and `.next/`**. Add both and commit. Append with a newline: a `>>` that lacks the trailing newline glues the entry to the last line (`.env.localnode_modules/`) and ignores nothing. `migrate` does not stop on a tracked `node_modules/`, but your commit will be huge (`git rm -r --cached node_modules` fixes it). Migrate adds `node_modules/`, `.next/`, `src/app/` and `next-env.d.ts` to `.gitignore` when they are missing, but only on a clean tree, and it refuses a tree where `node_modules/` is untracked: the refusal says `node_modules/ or .next/ is untracked: add it to .gitignore and commit that first` (a `--dry-run` lists them as `node_modules/` and `.next/`, one entry each, not every file).
2. **pnpm 11 or later and `ERR_PNPM_IGNORED_BUILDS`.** The project lists the packages allowed to run install scripts under `pnpm.onlyBuiltDependencies` in `package.json`, a field pnpm 11 and later no longer read, so every `pnpm install` (and every `pnpm <script>`, which installs first) ends with exit 1: the packages are installed, their scripts are not run. Migrate fixes it: it creates or updates `pnpm-workspace.yaml` with `allowBuilds` (pnpm 11 and later) and `onlyBuiltDependencies` (pnpm 10), the way `create-nextspark-app` writes them, keeps your entries, adds the packages NextSpark needs (`@nextsparkjs/core`, `@parcel/watcher`, `@swc/core`, `cypress`, `esbuild`, `protobufjs`, `sharp`, `unrs-resolver`, `@nextsparkjs/ai-workflow`), removes `pnpm.onlyBuiltDependencies` from `package.json`, and lists it in the plan under **pnpm build-script allowlist**. Install again afterwards (step 6). If you run pnpm 11 or later before migrating, add the same `allowBuilds:` block to `pnpm-workspace.yaml` yourself or run `pnpm approve-builds`.
3. **A root layout you edited stops migrate.** `app/layout.tsx` in these projects carries an "AUTO-GENERATED, DO NOT EDIT" header and is removed when it still matches core's template. If you changed it, migrate refuses (it imports `./globals.css` from the app tree) and says so. Move your changes into `templates/layout.tsx`, import `@nextsparkjs/core/...` or your own `styles/`, and run migrate again. Remember the `await` on `getBillingResourceHints()` (last bullet of **Also**) when you do.
4. **Placeholder values in `.env`.** Those projects' `.env` carries `RESEND_API_KEY="re_..."`, `GOOGLE_CLIENT_ID="your-google-client-id"` and the like. `nextspark build` checks that a login method can authenticate, and a placeholder is a value, not a missing one: the check fails with `*_PLACEHOLDER` **even with `NEXTSPARK_AUTH_RUNTIME_ONLY=email,google`**, which defers only absent values. Delete those lines (or put the real values) from `.env` and from the build environment; with the variable set and the lines gone the build reports the methods as deferred to runtime.
5. **Local Postgres:** a `DATABASE_URL` without `sslmode` still migrates on a database without SSL in development: the database scripts ask for SSL without validating the certificate and fall back to plain when the server says it has no SSL. With `NODE_ENV=production` (in the environment or the project `.env`) they validate the certificate and do not fall back, like the application's production connection, so a local Postgres used for a production build needs `?sslmode=disable`.

## Cleanup after upgrading

Migrate converts the app tree; it does not touch the local workarounds a project may have added before root-first, and some of them core now replaces. A project that finished the upgrade keeps them, and they either do nothing or hide a problem. Check each row; a project generated from the current templates has none of them.

| What to look for | What replaces it (first release) | Before and after | Confirm it is gone |
| --- | --- | --- | --- |
| A committed, generated app tree (`src/app` or `app/` with files tagged as generated) | `src/app` is generated by `nextspark prepare`, git-ignored and never edited (`0.1.0-beta.192`). A customized route belongs under `templates/` (see [What migrate does to the app tree](#what-migrate-does-to-the-app-tree)) | Before: `src/app/...` files in `git ls-files`. After: `.gitignore` has `src/app/` and a customized page lives at `templates/<path>` | `git ls-files src/app` prints nothing and `git check-ignore src/app` prints `src/app` |
| A full copy of the template `src/proxy.ts`, with the session and role checks written out | `src/proxy.ts` is a facade over core's proxy; the checks come with `@nextsparkjs/core` and are updated with it (`0.1.0-beta.198`). Redirects, rewrites and response headers go in the `proxyHook` of `config/hooks/proxy.ts`; extra paths that need a session go in `createProxy({ authenticatedPaths })` (see [Middleware](../10-backend/06-middleware.md)) | See the first block below | `src/proxy.ts` holds the `export { proxy }` line, the `config` matcher and, if you need it, your `createProxy({ authenticatedPaths })` call, and no session or role logic |
| `typescript: { ignoreBuildErrors: true }` in `next.config.mjs` | Nothing is needed: the template dropped it (`0.1.0-beta.192`) once core published declarations for deep imports, and a test guards that the template config does not set it. A project that kept it skips the type check in `next build` | See the second block below | `next.config.mjs` has no `ignoreBuildErrors`; `pnpm exec nextspark build` reports type errors again, so fix those it names |
| A local patch (an edited copy, `pnpm patch` or `patch-package`) whose only purpose is to switch off Better Auth's rate limit in development or tests | `DISABLE_RATE_LIMITING=true` also sets `rateLimit.enabled: false` in Better Auth (`0.1.0-beta.198`). It does not cover any other change to Better Auth's limits (windows, maximums, storage): keep a patch that does more than switch it off | See the third block below | No patch file under `patches/` and no `patchedDependencies` entry for it; sign-in is not limited with the variable set |

```ts
// 1. Proxy. Before: a copy of the old template, with the checks written out
import { NextResponse, type NextRequest } from 'next/server'
export async function proxy(request: NextRequest) {
  // session lookup, protected paths, role checks...
  return NextResponse.next()
}

// After: src/proxy.ts is the facade
export { proxy } from '@nextsparkjs/core/proxy'
// (and, for a redirect or header of your own, `export const proxyHook = ...` in config/hooks/proxy.ts)
```

```js
// 2. next.config.mjs. Before
export default { typescript: { ignoreBuildErrors: true } }
// After: the entry is removed
export default {}
```

```bash
# 3. Before: a patch that edits the auth setup so the limiter is off
pnpm patch @nextsparkjs/core    # ... and a patchedDependencies entry that keeps it
# After: delete the patch and its patchedDependencies entry, and set the variable where the limit is unwanted
DISABLE_RATE_LIMITING=true      # development or tests only
```

The generated app tree and `ignoreBuildErrors` rows hold from `0.1.0-beta.192`, the proxy and rate limit rows from `0.1.0-beta.198`. A `--check` mode of `nextspark migrate` that finds these automatically is not part of any release yet: until it is, the last column is the check.

## What migrate does to the app tree

It looks at `app/` (before the `src/` layout) or `src/app/`, and decides file by file. Both at once is refused.

| The file is | Migrate |
| --- | --- |
| Untouched output of core: an intact generated tag, a sync-state hash, the registry's `(templates)` output, a byte match with the previous core's template (fetched once from git history or the lockfile's version), or exactly what the generator emits for that route | Removes it: it is generated again |
| A wrapper that only looks a project template up at run time (`getTemplateOrDefault(...)`) | Removes it. The project's `templates/` file at that path is the static override |
| A file you changed, at a path core has a route for | Moves it to `templates/<path>` (pages, layouts, `loading`, `error`, ...), including a Route Handler under `api/v1/**`, and prints a diff against the version it replaces |
| A file you added | Moves it to `templates/<path>`, or a Route Handler under `api/<name>/route.ts` to `api/<name>/route.ts` |
| A billing webhook route core generated, when `lib/billing/<provider>-webhook-extensions` holds more than core's empty stub | Removes the route and adds `billing: { webhookExtensions: { <provider>: './lib/billing/...' } }` to `nextspark.config.ts` |

Every moved file keeps its relative imports pointing at the same files. Migrate then writes `src/proxy.ts` when the project has none, adds `.nextspark/` and `src/app/` to `.gitignore`, and runs `nextspark prepare`. If generation fails, the project is left converted, the failure is printed, and so is the rollback (`git checkout -- .` plus a `git clean` of exactly what the run created).

## When migrate is killed or fails after it started writing

Before its first write, `migrate --yes` takes a snapshot of what it can overwrite and records the rollback in `.nextspark/migrate-rollback/rollback.json` (the CLI rebuilds the commands from it). A run that is killed (`SIGKILL`, a closed terminal, a power cut) cannot print them, and a half-converted tree makes the next dry run report blockers that have nothing to do with the cause. So, while `.nextspark/migrate-rollback` exists, `migrate` (dry run or `--yes`) refuses to analyze, says the previous run did not finish, and prints the recorded commands. Run them from any directory, right away, before editing or committing anything: they restore the tracked files through git, remove what the run created, and put back the ignored files it had overwritten, then delete the snapshot. After that, run `migrate` again. If the snapshot has no `rollback.txt`, an older CLI's run failed or a run stopped while taking it, and project files may already have changed: inspect `.nextspark/migrate-rollback/files` and restore from it (or with git) before deleting the folder. If you keep the converted tree after an interrupted migrate (instead of running the rollback), delete `.nextspark/migrate-rollback` or every later migrate refuses. A symlinked backup folder, or a `rollback.json` that is missing, tracked by git, not in the form the CLI writes, or naming a path outside the generated host, is refused without printing anything: inspect it by hand. A run killed before the snapshot leaves nothing behind.

## When migrate stops

Anything it cannot place with certainty stops the run **before it writes**, naming the file and the reason. The usual ones:

| Reason | What to do |
| --- | --- |
| A file of the app root that is not a route (`globals.css`, `favicon.ico`, a `robots.txt`) | Move what it holds to `styles/globals.css` or `public/`, delete it, run again |
| A project route under `api/v1/**` or `api/plugins/**` | Those namespaces belong to core and plugins. Rename the directory to `api/<name>` (the URL becomes `/api/<name>`) and update its callers |
| The generator cannot use the file as a facade (for example `export const dynamic = someVariable`) | Write the segment config as a literal (`export const dynamic = 'force-dynamic'`) |
| The file imports another file of the app tree that is not kept | Import from `@nextsparkjs/core/...` or the project's own directories |
| The destination already exists (`templates/x/page.tsx`) | Merge the two by hand: the project file wins over core's |
| A run-time template lookup mixed with code of its own | Move the code into a plain `templates/` file at that path |
| The installed core has no route manifest | Upgrade `@nextsparkjs/core` to `0.1.0-beta.192` or later first |
| `nextspark.config.ts` already has a `billing` entry | Add `webhookExtensions` to it by hand, as the message shows |

## URLs that change

The dispatchers that served project routes at run time are gone:

| Before | Now |
| --- | --- |
| `/api/v1/theme/<theme>/<path>` | `/api/<path>` (the project's `api/<path>/route.ts`) |
| `/api/v1/plugin/<plugin>/<path>` | `/api/plugins/<plugin>/<path>` |

**Old URLs keep working.** Migrate adds native Next rewrites to `next.config` (`/api/v1/theme/<theme>/:path*` to `/api/:path*`, `/api/v1/plugin/<plugin>/:path*` to `/api/plugins/<plugin>/:path*`), merged with any `rewrites()` the file already has, so an installed mobile app and external integrations keep calling the old URLs. If migrate cannot edit the file it refuses before writing and prints the snippet to add. Remove the rewrites when no old client is left.

The report lists every occurrence in the project's source, including sibling workspaces such as `mobile/` and `packages/*` (`file:line`, the old URL and the new one); migrate does not rewrite callers.

## Permissions on routes a project template replaces

A project template whose URL collides with an entity's generated dashboard routes (`/dashboard/<entity>`, `/create`, `/[id]`, `/[id]/edit`; a differently named dynamic segment at the same position; or an optional catch-all that also serves one of them) **replaces that entity's whole generated subtree**, as a static template beat `[entity]` in 0.x. Migrate's report and `prepare`, `build` and `dev` print it as an Info notice. What changed from 0.x is that the replacing pages now sit behind the entity's permission layout (list, read, create or update, by URL):

- A role the entity's permissions do not allow now sees `permission-denied` on the page. The API already answered 403 to it, so it used to see an empty page. Hide the menu entry for those roles.
- The layout reads the *team* role. A `superadmin` or `developer` who belongs to a team with a role that lacks that permission can lose access on such a page. Check your data before deploying.

Templates that only add URLs coexist with the generated routes and are not affected.

## Cache Components is optional for an existing project

New projects are created with Cache Components and PPR on. An upgraded project keeps the rendering mode it has: migrate does not turn it on, and legacy ISR stays supported. To opt in, set `cacheComponents: true` in `next.config` and run a build; routes that read request data need a `Suspense` boundary. Under Cache Components an unknown public URL still answers a `noindex` not-found page with status 200 (it streams); a `loading.tsx` that wraps the public catch-all makes ISR answer 200 too, so keep loading skeletons inside a `Suspense` of the page instead.

## Also

- A project migrated by an earlier release may have a `legacy-app-customizations/` directory. Its files are not read any more: move each into `templates/` or `api/` by hand, following the table above.
- Workarounds you added before root-first may still be in the project: see [Cleanup after upgrading](#cleanup-after-upgrading).
- `nextspark sync:app` no longer exists: see the [removal timeline](./05-sync-app-removal.md).
- `getBillingResourceHints()` is async (since 0.1.0-beta.191). A root layout that still reads it without `await` fails the build while prerendering `/_not-found`: make the layout `async` and `await` the call.

## Coming from 0.1.0-beta.18x

Things a project that jumped from `0.1.0-beta.184` (or a neighbouring release) to the root-first layout met, none of which the steps above warn about. Do the first two before `pnpm db:migrate`, and the rest while you update callers and routes; a renamed entity directory is taken over by `pnpm db:migrate` from `0.1.0-beta.198` and needs its `_entity_migrations` rows re-keyed first on an earlier core; an underscore slug needs no rename at all (see [Entity slugs with an underscore](#entity-slugs-with-an-underscore)).

### Better Auth: a NOT NULL `issuer` column on `account`

`0.1.0-beta.184` declared `better-auth` as `^1.3.5`, so a lockfile could resolve any 1.x. Core pinned `~1.6.30` from `0.1.0-beta.185` and pins `~1.7.7` since `0.1.0-beta.199`. Better Auth `1.7.0` through `1.7.2` made `issuer` a required column of `account` (with a unique index on `("issuer", "accountId")`); `1.7.3` and later, and `1.6.x`, do not have it. A database migrated while the project ran one of those three releases keeps `account.issuer NOT NULL`. On `1.6` creating an account (a Google sign-in, a password sign-up) failed on the insert; on `1.7.3` and later Better Auth checks its tables when it starts and refuses every auth call, `getSession` included.

From `0.1.0-beta.199` there is nothing to do by hand: `pnpm db:migrate` applies `038_better_auth_account_identity.sql`, which makes `issuer` nullable and drops the unique indexes that include it. The column and its values stay. The same migration:

- adds the unique index on `("providerId", "accountId")` that core's `002_auth_tables.sql` declares, when the `account` table was created by Better Auth before 002 ran and lacks it. If rows already share a key, it stops and names the query that lists them; resolve each one (the Better Auth 1.7 upgrade guide, "Account identity keeps the provider key"), then run `pnpm db:migrate` again;
- gives `users.name` a value where it is `NULL` (first and last name, or `''`) and makes `''` its default. Better Auth 1.7 expects a string there.

After the migrations, `pnpm db:migrate` checks the auth tables (`users`, `session`, `account`, `verification`) and stops if one still has a NOT NULL column without a default that Better Auth never writes, naming each column. `nextspark doctor` runs the same check ("Auth schema"). Take a backup first, as for any migration.

### Migration 029 and the only superadmin

Migration `029_sample_accounts_outside_development.sql` finds accounts whose password is one of the two sample passwords (by the password, never by name), removes that password and their sessions, deactivates their API keys, and sets their role to `member`. If your only `superadmin` or `developer` still has a sample password, nobody can open `/superadmin` or `/devtools` after `pnpm db:migrate`.

Before upgrading, run:

```sql
SELECT u.id, u.email, u.role,
       EXISTS (
         SELECT 1 FROM "account" a
         WHERE a."userId" = u.id AND a."providerId" = 'credential'
           AND a."password" IN (
             '22de14d5472248ed0bece911df908b2a:d29576424798ba6845d348a3767c0b0f38a00f2aca461b3b1d34b99a93cab06c86774c6edb183e6d6ec47457649b032a49a7b60a48f6f4f7fbbc4ea40258f19f',
             '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866')
       ) AS has_sample_password
FROM "users" u
WHERE u.role IN ('superadmin', 'developer')
ORDER BY u.role, u.email;
```

Every row with `has_sample_password = true` will be demoted. Give each one you want to keep a new password first (the account's "change password" page, or the reset flow below); an account whose password was changed is left alone.

If it already ran and nobody can get in, there is no CLI command or script that creates a superadmin. The supported way is the one the migration's own header names, "set its role back and reset its password":

1. Request a password reset for the account's email on the login page. Better Auth's reset creates the password (`credential`) account when it is missing, so it works after 029 removed it. It needs working email delivery, a verified email address on the user, and email and password sign-in enabled: it is outside production; in production the project's `auth` config must list `email-password` in `methods` or set `emailAndPassword.enabled: true`.
2. Set the role back on the database, from a trusted shell:

   ```sql
   UPDATE "users" SET role = 'superadmin' WHERE email = 'owner@example.com';
   ```

   Migration `027`'s trigger enrols the user in the System Admin Team again (when the database has one). Use `'developer'` for a developer.

### Rate limits, CORS and the origin check on the project's own API routes

In `0.1.0-beta.184` a project route under `api/v1/theme/<theme>/**` was served by one dispatcher that wrapped every request in `withRateLimitTier`: `GET` in the `read` tier (200 requests per minute) and `POST`, `PUT`, `PATCH` and `DELETE` in the `write` tier (50 per minute), and plugin routes under `api/v1/plugin/<plugin>/**` the same way. It exported no `OPTIONS`, and `0.1.0-beta.184`'s `withRateLimitTier` added no CORS headers.

- **From `0.1.0-beta.199`** the generated host applies that same limit again to every method of every Route Handler under the project's `api/` (and a plugin's `api/`): `GET` and `HEAD` read, `POST`, `PUT`, `PATCH` and `DELETE` write, `OPTIONS` never, per client address and tier. Nothing to change in the routes. It only limits: no CORS headers and no origin check are added. A method that already wraps itself with `withRateLimitTier` keeps its own limit and is not counted twice. `withRateLimit` alone does not count: it limits only requests that present an API key, so such a route now also gets the default. A webhook with its own limits opts the whole route out with `export const rateLimit = false`. `DISABLE_RATE_LIMITING=true` still turns it off.
- **From `0.1.0-beta.192` to `0.1.0-beta.198`** a project route had no limit at all unless it wrapped its exports. Match the old behaviour on those releases with:

```ts
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

export const GET = withRateLimitTier(getHandler, 'read')
export const POST = withRateLimitTier(postHandler, 'write')
```

Counters are per client address and tier across all routes (in `0.1.0-beta.184` a request with an `x-api-key` header was counted per key instead). Wrapping a method with `withRateLimitTier` yourself (on any release; to choose another tier, `'strict'` for example) differs from the old dispatcher in two ways you want: it refuses a cookie-authenticated write from an untrusted origin (403) and adds core's CORS headers to every response. A route called from another origin also exports `export const OPTIONS = corsPreflight` (`import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'`). See [rate limiting](../05-api/07-rate-limiting.md#your-own-api-routes-project-and-plugins) and the CORS section of [authentication](../05-api/02-authentication.md#issue-4-cors-errors).

### Entity slugs with an underscore

An underscore is valid in an entity slug again (`campaign_members`): a slug starts with a lowercase letter and then uses `a-z`, `0-9`, `-` and `_`. Nothing has to be renamed. Between `0.1.0-beta.192` and `0.1.0-beta.199`, `nextspark prepare` refused such a slug with `NS_CONTRACTS_BAD_SLUG`; a project that renamed `campaign_members` to `campaign-members` to get past it can stay as it is, or rename it back (the directory, the `slug`, the permission key, the scopes and the URLs, as below, in the other direction). Two entities whose slugs differ only in `_` against `-` (`a_b` and `a-b`) export the same names and are refused (`NS_CONTRACTS_NAME_CLASH`).

`nextspark migrate` lists the underscore slugs it finds under **Entity slugs with an underscore**, and renames them to hyphens only when you ask: `nextspark migrate --rename-entity-slugs` (with `--dry-run` it prints the whole report and writes nothing), or yes to the question it asks in a terminal. `--yes` alone never renames. The rename:

- renames `entities/campaign_members/` to `entities/campaign-members/`, sets `slug: 'campaign-members'` and, unless the config already has one, `tableName: 'campaign_members'` (the SQL table and its `campaign_members_metas` do not change);
- rewrites the module specifiers that point into the directory (`from`, `import()`, `require()`, `jest.mock()` and `vi.mock()` of `@/entities/campaign_members/...`, and of `../campaign_members/...` from another entity; the same text in a comment or a URL string is left alone) and the entity key of `config/permissions.config.ts`, which the registry build validates against the slugs. It reads `slug` and `tableName` as top-level properties of the config (a mention in a comment does not count), and reads every edit back: if the config does not end up with the new slug and the old table, or the permissions key is not where it should be, every file and directory is put back and migrate stops;
- writes `entities/campaign-members/.renamed-from` (`campaign_members -> campaign-members`), so `pnpm db:migrate` records the migrations already applied under `campaign_members` for the new name instead of running them again (one line per migration: `001_x.sql: already applied as entity campaign_members; recorded for campaign-members`; check that no `CREATE` ran);
- prints the report below: the permission keys, the `UPDATE "api_key"` that rewrites the scopes (printed, never run), the old URL and a snippet to keep `/api/v1/campaign_members` as an alias for one release with a `Deprecation` header (a manual step: it edits `next.config`), the translations and the `_entity_migrations` re-key for a core that is older than this release.

A skipped entity is listed with the reason and left alone: its slug differs from its directory name or is not a string literal, its `tableName` is not a string literal, the hyphenated name is taken, or it has child entities (their tables are named `<directory>_<child>`, so renaming the directory would point them at tables that do not exist). The printed rollback removes the renamed directory too, and is printed even when the rename stops partway.

Renaming by hand follows the same steps. `prepare` requires the slug to equal the entity's directory name (`NS_HOST_ENTITY_SLUG_MISMATCH`), so rename both, and keep the table by setting it explicitly (the table name and its meta table, `<table>_metas`, derive from the slug otherwise):

```ts
export const campaignMembersEntityConfig: EntityConfig = {
  slug: 'campaign-members',
  tableName: 'campaign_members',
  // ...
}
```

`pnpm db:migrate` records an entity's migrations under its directory name, so a rename made by hand makes it look as if none of that entity's migrations had run.

- **From this release,** a directory with a `.renamed-from` file (what `migrate --rename-entity-slugs` writes) is taken over as described above, from where the entity is recorded now. A directory renamed by hand from `campaign_members` to `campaign-members` is taken over only as before: from `0.1.0-beta.198`, when `entities/campaign-members/` has no recorded migrations and `_entity_migrations` has rows for `campaign_members` from the old theme or the same plugin. Add a `.renamed-from` file containing `campaign_members -> campaign-members` to take over rows recorded for the project. The file counts only in the directory it names (a copy of the directory under another name ignores it), and it moves the rows to the new name, so they can be taken once.
- **On an earlier core,** re-key the rows **before** the next `pnpm db:migrate` (take a backup first). Only before `0.1.0-beta.198`:

  ```sql
  UPDATE "_entity_migrations" SET entity_name = 'campaign-members' WHERE entity_name = 'campaign_members';
  ```

- **To go back** after `pnpm db:migrate` has moved the rows to the new name, put the directory and slug back and restore the rows. `migrate` prints this with your real names and never runs it (take a backup first):

  ```sql
  UPDATE "_entity_migrations" SET entity_name = 'campaign_members' WHERE entity_name = 'campaign-members' AND source_type = 'project';
  ```

What a rename changes, and what a project updates:

| Where the old slug appears | Update |
| --- | --- |
| Role permissions: the `entities` key in `config/permissions.config.ts`, and every `campaign_members.<action>` string | The new slug (`campaign-members.create`) |
| API keys: stored `scopes` are `<slug>:read`, `<slug>:write` and `<slug>:delete` | A key holding `campaign_members:read` no longer matches (scopes are compared exactly; a key with `*` is unaffected): rewrite the stored scopes with the `UPDATE` below, or issue new keys |
| URLs: `/api/v1/campaign_members` is now `/api/v1/campaign-members` (no alias unless you add the one the report prints) | Every client: mobile app, integrations, scripts |
| Translations: the entity's i18n namespace is its directory name, so it follows the rename | `useTranslations('campaign_members')` becomes `useTranslations('campaign-members')`; the entity's own `messages/` files move with the directory, but keys for it in the project's other message files move under the new name |

```sql
UPDATE "api_key"
SET scopes = array_replace(array_replace(array_replace(scopes,
  'campaign_members:read', 'campaign-members:read'),
  'campaign_members:write', 'campaign-members:write'),
  'campaign_members:delete', 'campaign-members:delete')
WHERE scopes && ARRAY['campaign_members:read', 'campaign_members:write', 'campaign_members:delete'];
```

The contracts read column types from the migration that creates a table named like the slug, so with a different `tableName` the numeric fields of that entity are typed as `number | string` instead of following the column. It is only looser typing.

### Translations in the browser

Core now sends each route group only the message namespaces it uses; the rest stay on the server. A client component of the project that calls `useTranslations('<namespace>')` for a namespace of its own (not core's, and not an entity's name, which the dashboard sends for you) gets missing-message errors until a server layout next to that template adds it:

```tsx
// templates/dashboard/reports/layout.tsx
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { APP_CONFIG_MERGED } from '@nextsparkjs/core/lib/config/config-client'
import { getConfiguredClientNamespaces, selectMessages } from '@nextsparkjs/core/lib/i18n/client-messages'
import { ENTITY_REGISTRY } from '@nextsparkjs/registries/entity-registry'

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages()
  const { dashboard } = getConfiguredClientNamespaces({ entityRegistry: ENTITY_REGISTRY, appConfig: APP_CONFIG_MERGED })
  return (
    <NextIntlClientProvider messages={selectMessages(messages, 'dashboard', ['reports', ...dashboard])}>
      {children}
    </NextIntlClientProvider>
  )
}
```

The group is `'root'`, `'public'`, `'auth'`, `'dashboard'`, `'superadmin'` or `'devtools'`. There is no config key. The nested provider replaces the dashboard's messages for everything under it, so list what the dashboard sends too: `getConfiguredClientNamespaces` gives the entity names from `ENTITY_REGISTRY` and the navigation namespaces from the app config, the same list core's dashboard layout sends. A list with only `['reports']` leaves every entity screen under it without messages (`MISSING_MESSAGE`). See [Project template namespace outside its route group](../11-internationalization/02-setup-and-configuration.md#project-template-namespace-outside-its-route-group).

### Files under the old `app/` that stop migrate

Migrate names each file it cannot place, with the reason and what to do, and stops before writing anything; the usual cases are in [When migrate stops](#when-migrate-stops). A `globals.css`, `favicon.ico` or `robots.txt` at the root of the old `app/` is the common one: move what it holds to `styles/globals.css` or `public/`, delete it, run migrate again.

### Client address behind a proxy or on Vercel

Set `NEXTSPARK_CLIENT_IP_SOURCE` explicitly (`vercel` on Vercel, `cloudflare`, `xff` with `NEXTSPARK_TRUSTED_PROXY_HOPS`, or `header:<name>`). Unset, core falls back to guessing from several headers and production logs a warning at startup, and the rate limits above count whatever address it picks. See [Client address](../14-deployment/10-client-address.md).
