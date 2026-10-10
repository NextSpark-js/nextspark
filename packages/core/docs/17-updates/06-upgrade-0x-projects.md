# Upgrading 0.x projects to 0.1.0-beta.192 or later

This is the one upgrade path, supported from `0.1.0-beta.183` (the oldest release `nextspark migrate` is tested from; for anything older, first go to `0.1.0-beta.183`). A 0.x project (a `contents/themes/<theme>` layout, or a root-first project whose `src/app` was committed) upgrades to `0.1.0-beta.192` or a later release (the latest is the one to use) in two steps: install the new packages, then run `nextspark migrate` once. After that `src/app` is generated, git-ignored, and yours to leave alone. See the [generated host workflow](../01-fundamentals/08-generated-host.md) for how a project changes routes afterwards.

## Steps

1. Commit or stash everything: migrate refuses to move files on a dirty git tree. Work on a new branch.
2. Set every `@nextsparkjs/*` package to the same release, `0.1.0-beta.192` or later, in the root and in `web/` (or wherever the web app lives), including any `overrides` or `catalog` entries, and install. `pnpm update-core` does both only if the project is already on `0.1.0-beta.191` or later: earlier releases do not have it, so from `0.1.0-beta.183` to `0.1.0-beta.190` this step is manual, and a short checklist applies before step 1: see [Projects created before 0.1.0-beta.191](#projects-created-before-010-beta191). Do not bump `next` by hand: `migrate --yes` sets `next` and `eslint-config-next` to `~16.3.8` (the generator reads Next's own route rules and refuses another minor), and step 6 installs.
   `pnpm add` on pnpm 12 re-sorts the whole `dependencies` block, so a two-line change shows up as dozens of changed lines in `package.json`: commit it on its own.
3. Run `pnpm exec nextspark migrate --dry-run` from the web app's directory. It prints the report and changes nothing; it exits `1` when the migration would refuse to run, listing why under **App tree conversion**. `--json` prints the same as JSON. It also predicts the generated host on a throwaway copy (notices such as replaced entity routes and conflicts, and which checks ran); a prediction that fails is reported as unknown, never as clean.
   - **The active theme** comes from `NEXT_PUBLIC_ACTIVE_THEME` in the environment, else from `.env.example` in the web app's directory (the host root, e.g. `web/.env.example`, not the repository root). If the project keeps it elsewhere, set it on the command line: `NEXT_PUBLIC_ACTIVE_THEME=<theme> pnpm exec nextspark migrate --dry-run`, and the same for `--yes`.
4. Fix what the report names (and rename any entity called `users`, `teams`, `auth`, `billing`, `cron`, `api-keys`, `devtools`, `media`, `media-tags`, `blocks`, `patterns`, `post-categories` or `team-invitations`: core reserves those API namespaces and `prepare` refuses such an entity), then `pnpm exec nextspark migrate --yes`. Without `--yes` it stops after the report. Keep the rollback commands it prints until the upgrade is committed.
5. Review the printed summary and commit. If git still tracks files under `src/app`, run the `git rm -r -q --cached src/app` it prints (then commit) so that the now-ignored generated files leave the index.
6. **Install again** (at the root and in the web app). Migrate changes `next` and `eslint-config-next` to `~16.3.8`, so the install that came before it no longer matches `package.json`. Then `pnpm exec nextspark prepare`.
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
- `nextspark sync:app` no longer exists: see the [removal timeline](./05-sync-app-removal.md).
- `getBillingResourceHints()` is async (since 0.1.0-beta.191). A root layout that still reads it without `await` fails the build while prerendering `/_not-found`: make the layout `async` and `await` the call.

## Coming from 0.1.0-beta.18x

Things a project that jumped from `0.1.0-beta.184` (or a neighbouring release) to the root-first layout met, none of which the steps above warn about. Do the first two before `pnpm db:migrate`, and the rest while you update callers and routes; a renamed entity directory is taken over by `pnpm db:migrate` from `0.1.0-beta.198` and needs its `_entity_migrations` rows re-keyed first on an earlier core (see [Entity slugs with an underscore](#entity-slugs-with-an-underscore)).

### Better Auth: a NOT NULL `issuer` column on `account`

`0.1.0-beta.184` declared `better-auth` as `^1.3.5`, so a lockfile could resolve any 1.x. Core has pinned `~1.6.30` since `0.1.0-beta.185`. Better Auth `1.7.0` through `1.7.2` made `issuer` a required column of `account` (with a unique index on `("issuer", "accountId")`); `1.7.3` and later, and `1.6.x`, do not have it. A database that was migrated while the project ran one of those three releases keeps `account.issuer NOT NULL`, and `1.6` never writes it, so creating an account (a Google sign-in, a password sign-up) fails on the insert.

Read-only check (columns of `account` that are required, have no default and are not part of core's table):

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'account'
  AND is_nullable = 'NO' AND column_default IS NULL
  AND column_name NOT IN ('id', 'accountId', 'providerId', 'userId');
```

An empty result is fine. If it lists `issuer`, make it optional. This keeps the column and its values; nothing is dropped:

```sql
ALTER TABLE "account" ALTER COLUMN "issuer" DROP NOT NULL;
```

The unique index on `("issuer", "accountId")` can stay: rows written by `1.6` have a null `issuer`, which a PostgreSQL unique index does not compare. Core's own `account` table (`002_auth_tables.sql`) never had the column. Take a backup first, as for any `ALTER`.

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

Portable contracts need a slug that matches `^[a-z][a-z0-9-]*$`. `nextspark prepare` (so also the last step of `migrate --yes`, and the prediction of `migrate --dry-run`) refuses an entity whose `slug` has an underscore with `NS_CONTRACTS_BAD_SLUG`. `nextspark migrate` does not rename or warn about the slug in advance, so you do it by hand. `prepare` also requires the slug to equal the entity's directory name (`NS_HOST_ENTITY_SLUG_MISMATCH`), so rename both: `entities/campaign_members/` becomes `entities/campaign-members/` (update the imports that point into it), and its `slug` becomes `'campaign-members'`.

An entity's table name and its meta table (`<table>_metas`) derive from the slug, so keep the table by setting it explicitly; the SQL does not change:

```ts
export const campaignMembersEntityConfig: EntityConfig = {
  slug: 'campaign-members',
  tableName: 'campaign_members',
  // ...
}
```

`pnpm db:migrate` records an entity's migrations under its directory name, so after the rename it would look as if none of that entity's migrations had run.

- **From `0.1.0-beta.198`,** `pnpm db:migrate` recognises this: when `entities/campaign-members/` has no recorded migrations and `_entity_migrations` has rows for `campaign_members` from the same origin (the old theme, or the same plugin), it records them for the new name instead of running them again, and prints one line per migration, for example `001_x.sql: already applied as entity campaign_members; recorded for campaign-members`. Check that the log shows those lines and that no `CREATE` ran.
- **On an earlier core,** re-key the rows **before** the next `pnpm db:migrate` (take a backup first). Only before `0.1.0-beta.198`:

  ```sql
  UPDATE "_entity_migrations" SET entity_name = 'campaign-members' WHERE entity_name = 'campaign_members';
  ```

What the new slug changes, and what a project updates:

| Where the old slug appears | Update |
| --- | --- |
| Role permissions: the `entities` key in `config/permissions.config.ts`, and every `campaign_members.<action>` string | The new slug (`campaign-members.create`) |
| API keys: stored `scopes` are `<slug>:read`, `<slug>:write` and `<slug>:delete` | A key holding `campaign_members:read` no longer matches (scopes are compared exactly; a key with `*` is unaffected): rewrite the stored scopes with the `UPDATE` below, or issue new keys |
| URLs: `/api/v1/campaign_members` is now `/api/v1/campaign-members` (there is no alias for the old one) | Every client: mobile app, integrations, scripts |
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
import { selectMessages } from '@nextsparkjs/core/lib/i18n/client-messages'

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages()
  return (
    <NextIntlClientProvider messages={selectMessages(messages, 'dashboard', ['reports'])}>
      {children}
    </NextIntlClientProvider>
  )
}
```

The group is `'root'`, `'public'`, `'auth'`, `'dashboard'`, `'superadmin'` or `'devtools'`. There is no config key. The nested provider replaces the dashboard's messages for everything under it. If that part of the dashboard also renders entity screens, add those entities' names to the list. See [Project template namespace outside its route group](../11-internationalization/02-setup-and-configuration.md#project-template-namespace-outside-its-route-group).

### Files under the old `app/` that stop migrate

Migrate names each file it cannot place, with the reason and what to do, and stops before writing anything; the usual cases are in [When migrate stops](#when-migrate-stops). A `globals.css`, `favicon.ico` or `robots.txt` at the root of the old `app/` is the common one: move what it holds to `styles/globals.css` or `public/`, delete it, run migrate again.

### Client address behind a proxy or on Vercel

Set `NEXTSPARK_CLIENT_IP_SOURCE` explicitly (`vercel` on Vercel, `cloudflare`, `xff` with `NEXTSPARK_TRUSTED_PROXY_HOPS`, or `header:<name>`). Unset, core falls back to guessing from several headers and production logs a warning at startup, and the rate limits above count whatever address it picks. See [Client address](../14-deployment/10-client-address.md).
