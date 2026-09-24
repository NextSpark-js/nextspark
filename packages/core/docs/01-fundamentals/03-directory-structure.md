# Directory Structure

NextSpark projects use the root-first layout defined by the
[root-first source contract](./07-root-first-source-contract.md). The directory
containing `nextspark.config.ts` is simultaneously the project root, the Next.js
host, and the source root.

```text
my-project/
├── nextspark.config.ts       # Project marker and compiler configuration
├── next.config.ts
├── package.json
├── api/                      # Project route-handler source
├── blocks/                   # Page-builder blocks
├── components/               # Project React components
├── config/                   # Runtime configuration and project hooks
├── entities/                 # Entity definitions
├── lib/                      # Project services and helpers
├── messages/                 # Project translations
├── migrations/               # Project migration history
├── plugins/                  # Enabled local plugins
├── public/                   # Static assets
├── styles/                   # Project styles
├── templates/                # Page and layout source
├── tests/                    # Project tests and fixtures
├── src/
│   └── app/                  # Generated Next.js adapter; do not edit
└── .nextspark/
    └── registries/           # Generated registries; do not edit
```

## Ownership

- The named root directories are project-owned source.
- `src/app/` and `.nextspark/registries/` are compiler-owned output.
- Installed `@nextsparkjs/*` packages provide framework code and replaceable
  defaults; they are not copied into the project for customization.
- A local plugin is stored at `plugins/<name>/` and is enabled by its directory
  name in `nextspark.config.ts`.

The compiler may create, replace, or remove only manifest-owned files beneath
the two generated roots. Framework updates never overwrite the project-owned
source directories.

## Routes and hooks

Project page and layout source belongs in `templates/`; project route-handler
source belongs in `api/`. The compiler diagnoses collisions before it writes the
generated adapter.

Reserved Next.js entry points are not project-template source. Project request
behavior is exported as `proxyHook` from `config/hooks/proxy.ts`, and project
instrumentation behavior belongs in `config/hooks/instrumentation.ts`.

## Entities, migrations, and plugins

```text
entities/<entity>/
├── <entity>.config.ts
├── <entity>.fields.ts
├── <entity>.types.ts
├── <entity>.service.ts
├── messages/
└── migrations/

plugins/<plugin>/
├── plugin.config.ts
├── api/
├── components/
├── lib/
└── migrations/
```

Project-wide migrations live in `migrations/`; entity- and plugin-owned
migrations remain beside their owners.

## Path aliases

The scaffold maps `@/*` to the project root, `@/plugins/*` to local plugins,
`@/app/*` to generated `src/app/*`, and `@nextsparkjs/registries` to generated
registry output. Runtime code should use registries instead of dynamically
discovering project source.

## Install-once templates

The `blog`, `crm`, `productivity`, and `starter` project templates ship inside
core at `packages/core/templates/projects/<name>/`. The CLI copies one template
into a new project root once. After extraction, every copied file is ordinary
project-owned source; changing or upgrading core does not resynchronize it.
