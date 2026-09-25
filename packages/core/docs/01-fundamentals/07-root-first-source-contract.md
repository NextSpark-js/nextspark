# Root-first Source Contract

## Status and release boundary

This document is the source contract for the `0.1.0-beta.193` compiler work. It is intentionally breaking: the compiler reads the root-first layout only. It does not read `contents/themes/<theme>`, does not fall back to that layout, and has no compatibility flag. `NEXT_PUBLIC_ACTIVE_THEME` is removed rather than renamed. A 0.x project must run the one-shot migration before upgrading.

Themes are install-once project templates. Scaffolding may record their origin, but after extraction every file is project-owned source and is never synchronized from the template again.

This contract defines source locations and ownership. The generated-host implementation must still pass the Next.js conformance gates in issue #203.

## Root terminology

- **Workspace root:** the package-manager workspace and shared-package boundary. It may contain one or more independent project roots.
- **Project root:** the directory containing `nextspark.config.ts`, the runnable Next.js host, and the NextSpark product source. These are one directory and cannot be selected independently.
- **Generated roots:** `<projectRoot>/src/app` and `<projectRoot>/.nextspark/registries`.

The registry directory keeps its existing name because renaming dozens of consumers has no user-visible benefit, and this cutover is already large.

A monorepo may contain several project roots, but each is self-contained and compiled independently. There is no active-project setting, `project.root` field, `--project` flag, or sibling-project selection algorithm.

## Project layout

The following paths are relative to the project root:

```text
my-project/
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── nextspark.config.ts
├── next.config.ts
│
├── api/                         # project route-handler source
├── blocks/                      # project block definitions
├── components/                  # project React components
├── config/                      # app, dashboard, permissions and hook config
│   └── hooks/
│       ├── proxy.ts             # optional project request hook
│       └── instrumentation.ts   # optional project instrumentation hook
├── entities/                    # project entity definitions
├── hooks/                       # project React and application hooks
├── lib/                         # project services and other application code
├── messages/                    # project translations
├── migrations/                  # project-owned migration history
├── plugins/                     # local runtime plugins, one directory per plugin
├── public/                      # project static assets
├── services/                    # project service modules
├── scripts/                     # project-owned helper scripts
├── styles/                      # project styles, including globals.css
├── templates/                   # page, layout and route-template source
├── tests/                       # project tests and fixtures
├── docs/                        # project documentation and documentation source
├── about/                       # project-owned about content
│
├── src/
│   ├── app/                     # GENERATED Next.js adapter; never edit
│   └── proxy.ts                 # GENERATED Next.js 16 request entry (middleware.ts on Next.js 15)
└── .nextspark/
    └── registries/              # GENERATED registries and manifests; never edit
```

The compiler must not search for a theme directory. It discovers project contributions directly from the root directories above and local plugin contributions from `plugins/<plugin>/`.

`api/` and `templates/` are separate source surfaces. Their route collision rules must be deterministic and diagnosed before generation; a project route must not silently replace another project route.

## `nextspark.config.ts`

The config file is required at the project root and must default-export the value returned by `defineConfig`. The compiler-facing schema is validated by `validateNextSparkConfig` from `@nextsparkjs/core/lib/config`.

```ts
import { defineConfig } from '@nextsparkjs/core/lib/config'

export default defineConfig({
  plugins: ['analytics', 'billing-local'],
  features: {
    aiChat: false,
  },
  template: {
    name: 'crm',
    version: '0.1.0-beta.193',
  },
})
```

### Compiler-read fields

| Field | Type | Default | Required | Meaning |
| --- | --- | --- | --- | --- |
| `plugins` | `string[]` | `[]` | No | Names of enabled local plugin directories immediately under `<projectRoot>/plugins`. Entries are names, not paths or package specifiers. |
| `features` | object | all current flags enabled | No | Build-time feature selection. |
| `features.billing` | `boolean` | `true` | No | Include billing contributions. |
| `features.teams` | `boolean` | `true` | No | Include team contributions. |
| `features.superadmin` | `boolean` | `true` | No | Include superadmin contributions. |
| `features.aiChat` | `boolean` | `true` | No | Include AI chat contributions. |

No compiler-read field is required because the root-first defaults are complete. The file itself is required so root discovery is deterministic and invalid configuration can fail before generation.

Plugin names are logical local identifiers. For example, `plugins: ['analytics']` enables `<projectRoot>/plugins/analytics`; `plugins: ['plugins/analytics']`, absolute paths (including Windows paths with either slash style), traversal, and duplicate names are invalid. Packaged plugins and their identities are a later plugin-contract concern and are not represented by this local-plugin list.

`project`, `project.root`, `project.activeProject`, and equivalent selector fields are unsupported. Configuration cannot point outside its own directory.

### Fields retained but not read by the root-first compiler

| Field | Type | Default | Required | Ownership |
| --- | --- | --- | --- | --- |
| `template` | `{ name: string; version: string }` | absent | No | Informational scaffold origin only; it never triggers synchronization or updates. Both nested fields are required when present. |
| `database` | `{ provider: 'postgres' \| 'mysql' \| 'sqlite'; runMigrations?: boolean }` | absent | No | Runtime/tooling configuration outside source discovery. |
| `auth` | `{ providers: ('email' \| 'google')[]; requireEmailVerification?: boolean }` | absent | No | Runtime authentication configuration outside source discovery. |
| `app` | `{ name?: string; description?: string }` | absent | No | Runtime application metadata outside source discovery. |

This slice adds the contract type and validator only. It deliberately does not change the beta.192 regex config loader; slice B replaces compiler consumption.

### Packaged plugins

This section supersedes the local-only wording above when a project consumes a published plugin.

- A local plugin is enabled by its directory name, for example `plugins: ['analytics']`, and resolves to `<projectRoot>/plugins/analytics` exactly as before.
- A packaged plugin is enabled by its scoped npm package name, for example `plugins: ['@nextsparkjs/plugin-langchain']`. The same package must be declared in the project's `dependencies`, `devDependencies`, or `optionalDependencies`.
- The compiler resolves that package with Node dependency resolution anchored at `<projectRoot>/package.json`. It never scans `node_modules`, a workspace, or sibling directories for packages whose names look like plugins.
- A packaged plugin's `package.json` must declare `nextspark.type: 'plugin'` and a directory-safe logical `nextspark.name`. Registry keys and route identities use that logical name; generated imports use the configured package name and its exported source paths.
- If `<projectRoot>/plugins/<nextspark.name>/plugin.config.ts` exists, that local plugin shadows the packaged plugin. The package declaration is still resolved and validated so a stale or missing dependency cannot be hidden accidentally.
- If an enabled package is undeclared, not installed, not resolvable from the project, or lacks valid NextSpark plugin metadata, compilation fails before generation with an actionable diagnostic naming the package and directing the project to declare it and run `pnpm install`.

Local and packaged plugins expose the same registry contribution surface. This rule changes source discovery only; packaged-plugin migration ownership remains deferred as described under open questions.

### Removal of active-theme selection

`NEXT_PUBLIC_ACTIVE_THEME` is not part of the root-first contract. The compiler, runtime, CLI, database tooling, generated environment files, tests, and documentation must stop reading, writing, forwarding, or requiring it. The project root is the former active theme's replacement: project source is read directly from that root. The one-shot migration owns its legacy parsing privately and removes the old field; the shared root-first config type does not expose it.

### Tooling and scaffold configuration

Root-first paths are a repository and scaffolding contract, not only a compiler concern. The project templates copied by `create-nextspark-app` must emit root-first aliases and workspace globs: `packages/core/templates/tsconfig.json` must not map through `contents/themes/*` or `contents/plugins/*`, and `packages/core/templates/pnpm-workspace.yaml` must not create those legacy workspaces. The repository development host must follow the same rule, so the legacy mappings and includes in `apps/dev/tsconfig.json` are part of the scaffolding-and-repository-tooling cutover.

These files must change atomically with scaffold generation. Otherwise a newly created project, or the repository's reference development project, would reintroduce the old layout even after compiler discovery becomes root-first.

## Project-root recognition

Commands recognize exactly one project root; they never select among sibling projects.

1. There is no `--project` flag, active-project environment variable, or config selector.
2. A command searches upward from its working directory for the nearest `nextspark.config.ts`.
3. The directory containing that file is the project, host, config, and source root. Search stops there and never inspects sibling applications.
4. The compiler reads `<projectRoot>/package.json` and requires a non-empty `next` entry in `dependencies` or `devDependencies`. A `next.config.*` file is optional and is never a root-selection signal. A root with the dependency but no `next.config.*` is valid; a directory with `next.config.*` but no declared `next` dependency is rejected with an actionable error.

To host several projects in one repository, give each project its own root and `nextspark.config.ts`, then invoke commands from that root or one of its descendants.

## Reserved project-root names

Project-template source may not provide these names at the project root:

| Reserved name | Owner and replacement |
| --- | --- |
| `middleware.*` | Reserved by Next.js. A migrated theme middleware hook moves to `config/hooks/proxy.ts` and is composed by the framework request entry under `src/`. |
| `proxy.*` | Reserved for the Next.js/framework request entry under `src/`. Project request behavior belongs in `config/hooks/proxy.ts`. |
| `instrumentation.*` | Reserved for the Next.js/framework instrumentation entry. Project instrumentation behavior belongs in `config/hooks/instrumentation.ts`. |
| `app/` | Must not coexist with generated `src/app/`. Route source belongs in `templates/` or `api/`. |
| `pages/` | Unsupported Pages Router root. Route source belongs in `templates/` or `api/`. |
| `src/` | Reserved for generated host integration, beginning with `src/app/`. Project modules use the named root directories. |
| `next.config.*` | Single host integration file. Template copies are not project source; migration must preserve and report existing host customizations for explicit integration. |

## Migration source extraction

The named directories in the layout are recognized project source roots. In particular, `services/`, `hooks/`, `scripts/`, `docs/`, and `about/` are recognized alongside the original named roots.

The migration is intentionally not a fixed-root allowlist: it moves every top-level theme directory and file to the same path under the project root, including a project-specific directory that is not named above. The exceptions are only the reserved project-root names in the table above. The explicit reserved-name mapping is:

- `middleware.*` and `proxy.*` move to `config/hooks/proxy.*`; the migrated module must export the named `proxyHook` hook.
- `instrumentation.*` moves to `config/hooks/instrumentation.*`.
- `app/`, `pages/`, `src/`, and `next.config.*` are reported and are never copied directly to the project root.

### Legacy generated `app/` host

The former root `app/` host is generated output, not root-first source. Migration compares it with the installed core host templates. Where the installed core can run the guarded sync, it generates and verifies `src/app/` through `nextspark sync:app --force` **before** removing the old `app/`; a sync failure stops migration, preserves the old host, and prints rollback commands. Byte-identical files (and intact generated-tag files) are then removed. A file that differs from core or is absent from its template set is treated as a customization: migration reports its path and moves it to `legacy-app-customizations/` at the project root. When it archives a customization, migration adds `legacy-app-customizations` to the root `tsconfig.json` `exclude`; migration scans ignore that directory as well, and its root location is not a Next route root. The customization therefore remains available for manual porting without typechecking, registry scanning, or participating in the build. If the installed core cannot run the sync path, migration creates `src/app/` and reports the exact `nextspark sync:app --force` follow-up command instead.

Migration creates `nextspark.config.ts` only when it is absent. Its plugin list retains required local plugins that exist under `plugins/` and required packaged plugins declared by the project. If a legacy theme config declares plugins dynamically rather than as string literals, migration warns that the generated list may be incomplete. A theme `.env.example` moves to the project root only if no root example exists; differing root and theme examples are reported and never merged. Plugin `.env.example` files stay with their plugins.

Before writing, the migration reports reserved-name exceptions and its move plan. It stops without changing the tree if a destination already exists with different bytes; byte-identical source/destination pairs are verified and deduplicated. It must never delete a source it has not recognized as owned by the migration.

## Precedence and ownership

The source precedence is:

```text
core defaults < project source < generated output
```

- **Core defaults** are replaceable framework inputs from the installed core version.
- **Project source** is the checked-in root-first tree. It wins over replaceable core presentation defaults and is never overwritten by framework updates.
- **Generated output** is the deterministic materialization of the resolved core and project inputs. Runtime imports consume this output, so it has final operational precedence; it is not an independent customization layer.

This ordering does not authorize replacing migration history, authentication invariants, permission enforcement, or protected framework routes. Those collisions must fail with diagnostics or follow a separately documented composition rule.

The framework may create, replace, and remove only manifest-owned files under:

- `<projectRoot>/src/app/`
- `<projectRoot>/.nextspark/registries/`

Everything else is source or host configuration. The compiler must not overwrite it. A migration may move or rewrite project files only as an explicit user-invoked operation with its report, cleanliness check, and rollback guarantees.

## Install-once templates

`create-nextspark-app --theme <name>` extracts a template into the root-first source tree once. The extracted files immediately become project source. Upgrading NextSpark does not compare, merge, or restore them from the original template. `template.name` and `template.version` are provenance for documentation and upgrade guidance only.

The repository's `blog`, `crm`, and `productivity` trees move from runnable workspace themes to the core-owned catalog at `packages/core/templates/projects/<name>/`. They are payloads, not compiler inputs or independently selected projects.

Their test suites have this explicit fate:

- The blog Jest tests and all blog, CRM, and productivity Cypress behavior suites are kept with their template payloads.
- CI extracts each template into a clean temporary project root and runs the retained suite against that generated root-first project. No suite runs by selecting a theme inside `apps/dev`.
- Theme-selection harnesses and empty suite scaffolding are retired: `NEXT_PUBLIC_ACTIVE_THEME`, the `test:theme` selector, `jest-theme.mjs`, theme-path Cypress selection, and CRM/productivity Jest config/setup trees that contain no tests do not survive merely to preserve the old package shape.
- Tests of the default product run against `apps/dev`, which becomes a root-first project rather than a host that selects a workspace theme.

Runtime product packages are deferred. In particular, this contract does not decide whether a plugin or future product package may own database migrations.

## Out of scope and full platform picture

This source contract covers the always-present web host. It intentionally does not define the source contracts for:

- `mobile/` and Expo Router;
- `desktop/` and Tauri;
- project-authored `mcp/` tools and their authenticated transport.

Those surfaces must not force another web-source move. See [issue #203, “Full platform picture (later releases, not a 1.0 commitment)”](https://github.com/NextSpark-js/nextspark/issues/203#full-platform-picture-later-releases-not-a-10-commitment) for the intended sibling `mobile/`, `desktop/`, `mcp/`, and portable `packages/` layout. Until the platform-contracts work lands, none of those directories is a beta.193 compiler input.

## Open questions for later slices

1. **Request-hook export contract:** the legacy theme hook can export a named `middleware` or a default function. Recommendation: define one named `proxyHook` export in `config/hooks/proxy.ts` and make the migration produce a diagnostic when it cannot rewrite the old shape safely.
2. **Packaged plugin migrations:** presentation precedence cannot decide migration ownership or history. Recommendation: defer packaged plugin migrations until logical plugin identity, ordering, uninstall behavior, and database history retention are specified.
3. **Host integration composition:** which explicit adapter or composition API should connect preserved, user-owned `next.config.*`, `proxy.*`, and `instrumentation.*` custom logic to framework behavior? Recommendation: decide this from the Next conformance/adoption result; do not make the migration infer custom logic.
