# Upgrading a 0.x project to the generated host

A 0.x project (a `contents/themes/<theme>` layout, or a root-first project whose `src/app` was committed) upgrades to `0.1.0-beta.192` in two steps: install the new packages, then run `nextspark migrate` once. After that `src/app` is generated, git-ignored, and yours to leave alone. See the [generated host workflow](../01-fundamentals/08-generated-host) for how a project changes routes afterwards.

## Steps

1. Commit or stash everything: migrate refuses to move files on a dirty git tree.
2. Set every `@nextsparkjs/*` package to the new version and install (`pnpm update-core` does both). Next.js must be the version core pins (`~16.3.5`): the generator reads Next's own route rules and refuses another minor.
3. `pnpm exec nextspark migrate --dry-run` prints the report and changes nothing. It exits `1` when the migration would refuse to run, listing why under **App tree conversion**. `--json` prints the same as JSON.
4. Fix what it names, then `pnpm exec nextspark migrate --yes`. Without `--yes` it stops after the report.
5. Review the printed summary, commit, and if git still tracks files under `src/app`, run the `git rm -r -q --cached src/app` it prints (then commit) so that the now-ignored generated files leave the index.
6. Update the callers of every URL the report lists under **Project URLs that change**.

`--no-prepare` converts the files but does not generate `src/app` at the end; run `pnpm exec nextspark prepare` yourself.

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

The report lists every occurrence in the project's source (`file:line`, the old URL and the new one); migrate only lists them, it does not rewrite callers.

## Also

- A project migrated by an earlier release may have a `legacy-app-customizations/` directory. Its files are not read any more: move each into `templates/` or `api/` by hand, following the table above.
- `nextspark sync:app` no longer exists: see the [removal timeline](./05-sync-app-removal).
