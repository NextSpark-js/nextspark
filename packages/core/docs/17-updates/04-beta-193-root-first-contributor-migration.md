# Beta 193 root-first contributor migration

The repository development project no longer selects `themes/default` through
`apps/dev/contents`. Its project-owned source now lives directly under
`apps/dev/` (`api`, `blocks`, `components`, `config`, `entities`, `lib`,
`messages`, `migrations`, `plugins`, `public`, `styles`, `templates`, and
`tests`). The generated Next.js host lives under `apps/dev/src/app`; do not edit
that tree by hand.

The former runnable `blog`, `crm`, and `productivity` themes are install-once
catalog payloads under `packages/core/templates/projects/<name>/`. The starter
payload is in the same catalog. Local runtime plugins belong under
`apps/dev/plugins/<name>/`, while publishable plugin packages remain under the
repository-level `plugins/` directory.

## Updating an in-flight branch

1. Rebase or merge the cutover before resolving path conflicts.
2. Move changes made under `themes/default/<dir>/` to `apps/dev/<dir>/`, and
   changes under `plugins/<name>/` that were local to the dev project to
   `apps/dev/plugins/<name>/`.
3. Move source-route changes into `apps/dev/templates/` or `apps/dev/api/`.
   Reapply generated-host changes only through their source or generator, then
   rebuild `apps/dev/src/app`.
4. Remove `NEXT_PUBLIC_ACTIVE_THEME`, `contents/themes`, and `contents/plugins`
   assumptions from branch-local scripts, tests, aliases, and workspace globs.
5. Run the registry build, type-check, production build, CLI suite, core Jest,
   core Node tests, and registry script tests before handing the branch back.
