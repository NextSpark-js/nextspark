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
