# CLI Tool

> **Experimental:** The add:theme, add:plugin, add:mobile, setup:ai and sync:ai commands — not part of the stable 1.0 surface and may change without a deprecation period.

> **Registry commands in this guide** run in a generated project, from its root. In the NextSpark monorepo, run `cd apps/dev && node ../../packages/cli/dist/cli.js prepare` (add `--watch` to watch).

NextSpark provides a CLI tool for common development tasks.

## Current Status

The executable is provided by `@nextsparkjs/cli` at `bin/nextspark.js`.
Generated projects install that package alongside `@nextsparkjs/core` and expose
the command through `node_modules/.bin/nextspark`.

## What Works Now

### Postinstall Hook (Notice Only)

Installing `@nextsparkjs/core` never writes into a project. Its postinstall hook
only prints a notice when the project still carries a committed `src/app` (or
`app/`): run `pnpm exec nextspark migrate` to move to the generated host.
`nextspark sync:app` and the hook that ran it were removed in
`0.1.0-beta.192` ([timeline](../17-updates/05-sync-app-removal.md)).
`nextspark dev`, `build` and `prepare` generate `src/app` and the registries.

### Manual Commands

```bash
# Registry generation (generated-project package script)
pnpm build:registries

# Equivalent direct CLI command (registry:build is a name for prepare)
pnpm exec nextspark prepare

# TSConfig update
node node_modules/@nextsparkjs/core/scripts/build/update-tsconfig.mjs

# Database migrations
node node_modules/@nextsparkjs/core/scripts/db/run-migrations.mjs
```

### 0.x root-first migration

`nextspark migrate` moves a 0.x project to the root-first layout and converts a
committed `app/` or `src/app` tree (see [Upgrading a 0.x project](../17-updates/06-upgrade-0x-projects.md)).
Start with the read-only inventory, from the repository root (or any directory inside it):

```bash
pnpm exec nextspark migrate --dry-run
pnpm exec nextspark migrate --dry-run --json
```

The report resolves the Next.js host before scanning, so a web host under
`web/` is not mistaken for the monorepo root. It inventories version drift,
the project and plugins, template customizations, legacy imports, tooling
paths, root-name and file collisions, untracked files, and sibling workspace
references. For legacy projects only, it reads the selected theme from `NEXT_PUBLIC_ACTIVE_THEME` or `.env.example`; it does not read private `.env` files. Once the report is clean,
`pnpm exec nextspark migrate --yes` performs the move (`--no-prepare` skips the
`nextspark prepare` it runs at the end).

## CLI Commands

The installed CLI currently exposes:

```bash
nextspark <command>

Commands:
  init              Initialize NextSpark in an existing project
  dev               Start the Next.js development server
  dev:registry      Start development with Webpack (same as dev --webpack)
  build             Generate src/app and the registries, then build for production
  generate          Same as prepare
  registry:build    Same as prepare
  registry:watch    Same as prepare --watch
  doctor            Run project health checks
  db:migrate        Run database migrations
  db:seed           Seed sample data
  prepare           Generate src/app and the registries (--check compares, --watch watches)
  migrate           Move a 0.x project to the root-first layout and the generated src/app

Options:
  -h, --help    Show help message
  --version     Show version
```

## Doctor codes

`nextspark doctor` reports these findings with a stable code, at the start of the message:

| Code | Level | Meaning |
|---|---|---|
| `NS_DUPLICATE_DEPENDENCY` | warn | `pnpm-lock.yaml` resolves more than one version of `next`, `better-auth` or `zod` that the project can align: the versions its importers declare, plus transitive copies of the same major as one of them (a `zod` 3 next to `zod` 4 is not reported). A transitive copy that is reachable only through `@nextsparkjs/core`'s own dependencies (read from the `snapshots:` section) is not reported either: the project cannot change it. It names the importer that pulls each version and prints, for each importer below the highest version, `pnpm add --filter <importer> <pkg>@<range>` (with `--save-peer` when the importer declares the package as a peer dependency). The project is the importers that declare core, the workspace packages they reach through `link:` (the whole chain) and the importers that declare the package as a peer; other apps of the workspace are left out. The range printed is the one the installed core declares for the package, or `^` the highest version when core declares none. Only pnpm lockfile v9 is read; any other version is reported as not checked. |
| `NS_APP_ROLE_NOT_AUTHENTICATED` | warn | The `nextspark_app` role is not a member of `authenticated` that inherits it, so no policy written `TO authenticated` applies to it: `/api/v1/users/me` answers 404 `USER_NOT_FOUND`, lists come back empty and `api_audit_log` writes fail with 42501. Migration 022 skips the `GRANT` when the migration role has no `CREATEROLE`. The finding prints the statement for a superuser to run (`GRANT authenticated TO nextspark_app WITH INHERIT TRUE;` on PostgreSQL 16 and later). A database with no `nextspark_app` (no cutover yet) is not reported. |
| `NS_ZOD_BELOW_CORE` | fail | A `zod` that an importer resolves is below the range the installed `@nextsparkjs/core` declares; two zod versions break the schema types. A transitive `zod` that no importer declares is ignored. It prints the `pnpm add --filter <importer> zod@<range>` that raises it (`--save-peer` for a peer dependency). |
| `NS_QUERY_CLIENT_NOT_REGISTERED` | warn | A file creates `new QueryClient(` and never calls `registerQueryCache`, so that client is not cleared on sign-in. It lists `file:line`; register it with `registerQueryCache(() => client.clear())` from `@nextsparkjs/core/lib/auth/query-caches`. Test, spec and stories files, generated `src/app`, and directories such as `node_modules`, `tests`, `cypress`, `public` or any starting with a dot are skipped. A server-side client created per request (`cache(() => new QueryClient())`) does not need registering; the check looks at one file at a time and does not follow imports, so register it or ignore the finding. |
| `NS_NEXT_THEMES_IMPORT` | warn | A project file imports `next-themes` (an import, a re-export, `import()` or `require()`). Core renders its own theme provider since 0.1.0-beta.200, and the hook of `next-themes` does not see it: it returns no theme and a `setTheme` that does nothing. It lists `file:line`; import `useTheme` and `ThemeProvider` from `@nextsparkjs/core/providers/theme-provider`, or run `pnpm update-core`, which rewrites the named imports when the update reaches 0.1.0-beta.200. It looks at the files the rewrite looks at, with the rules of the installed core: the `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts` and `.cts` files of the project, but not tests (`*.test.*`, `*.spec.*`, `*.stories.*`, `tests/`, `__tests__/`, `cypress/`), type declarations, `public/`, build output, `node_modules/`, generated `src/app/` or directories starting with a dot; a comment or a string that mentions the import is not reported. `nextspark prepare` (and so `dev` and `build`) prints the same finding with the command, without writing anything or changing its exit code. |

## Database commands

`db:migrate` and `db:seed` (also `db migrate` / `db seed`) take one option:

| Option | Effect |
|---|---|
| `--no-env-file` | Ignore the project `.env`; the connection comes only from the exported environment |

Precedence: an exported `DATABASE_URL`, `MIGRATE_DATABASE_URL`, `MIGRATION_TIMEOUT_SECONDS` or `NEXT_PUBLIC_ACTIVE_THEME` beats the same variable in `.env`; the `.env` fills what the environment leaves unset. Before the first migration the runner prints the destination (host and database name only, never the user, password or URL). See [Database Migrations](../10-backend/02-migrations.md#running-migrations).

## Using in package.json

Consumer projects can invoke the locally installed CLI explicitly through pnpm:

```json
{
  "scripts": {
    "dev": "pnpm exec nextspark dev",
    "build": "pnpm exec nextspark build",
    "build:registries": "pnpm exec nextspark prepare",
    "db:migrate": "pnpm exec nextspark db:migrate"
  }
}
```

There is no separate supported theme-build command. Next.js compiles the
stylesheet that the generated root layout imports (`@/styles/globals.css`) during
`pnpm dev` and `pnpm build`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXTSPARK_DEBUG` | - | Enable debug output |

## Command Reference

### Available CLI Commands
- `pnpm exec nextspark init` - Initialize in an existing project
- `pnpm exec nextspark dev` - Start Next.js; add `--registry` for a registry watcher
- `pnpm exec nextspark build` - Generate registries and run a production build

### v0.4.0 - create-nextspark
- [ ] `npx create-nextspark` - Full project scaffolding
- [ ] Interactive prompts for theme selection
- [ ] Database provider selection (Supabase, Neon, etc.)

## Troubleshooting

### Command Not Found

The CLI requires the package to be installed:

```bash
pnpm add @nextsparkjs/core @nextsparkjs/cli
```

### Permission Denied

On Unix systems:

```bash
chmod +x node_modules/@nextsparkjs/cli/bin/nextspark.js
```

### Config Not Found

Ensure `.env` selects an existing theme and that its generated configuration is
present under `config/`. A root `nextspark.config.ts` is
optional and is not generated by the wizard.

## Related

- [03-build-scripts.md](./03-build-scripts.md) - Build scripts
- [04-config-system.md](./04-config-system.md) - Configuration
- [00-getting-started.md](./00-getting-started.md) - Setup guide
