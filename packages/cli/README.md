# @nextsparkjs/cli

The `nextspark` command: generates the host and the registries, runs the development server and the build, and runs migrations and checks for a NextSpark project.

> **Stability.** Stable: `dev`, `build`, `prepare`, `db:*`, `doctor` and `migrate`. Experimental: `add:plugin`, `add:mobile`, `setup:ai`, `sync:ai`, `skills`. `add:theme` is not supported. Commands not named here (`init`, `worker`, `db:demo-reset`, `check:mobile`, the `registry` aliases) are not on the stable list. See [Stability](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/01-stability.md).

## Installation

A project created with `pnpm create nextspark-app` already depends on it. Run it through the project's package manager:

```bash
pnpm exec nextspark <command>
```

To use it in another project: `pnpm add -D @nextsparkjs/cli`.

## Commands

### Initialize Project

```bash
pnpm exec nextspark init              # Interactive wizard
pnpm exec nextspark init --preset saas    # Use SaaS preset
pnpm exec nextspark init --preset blog    # Use Blog preset
pnpm exec nextspark init --preset crm     # Use CRM preset (configuration only; the template is --theme)
pnpm exec nextspark init --yes --locales en,es   # Languages without prompts (--default-locale picks the default)
pnpm exec nextspark init --theme blog     # Pre-select a template: starter (stable); blog, crm, productivity (experimental)
```

> **Experimental:** the blog, crm and productivity templates, the first-party plugins (`--plugins`), and billing are not part of the stable 1.0 surface and may change without a deprecation period.

### Versioned skill guides

The project-local CLI bundles concise offline guidance that matches its installed version. No monorepo `.claude/` folder or network access is required:

```bash
pnpm exec nextspark skills list --json
pnpm exec nextspark skills get nextspark-blocks
pnpm exec nextspark skills get nextspark-auth
pnpm exec nextspark skills get nextspark-cli
```

New projects receive small `AGENTS.md` and `CLAUDE.md` pointers only. The legacy `@nextsparkjs/ai-workflow` pack remains an explicit opt-in through `pnpm exec nextspark setup:ai`; it is not installed by `nextspark init --yes`.

### Development

```bash
nextspark dev       # Generate src/app and the registries, start the dev server and regenerate on changes
nextspark build     # prepare --production, then next build
nextspark prepare   # Generate src/app and the registries once (--check compares, --watch watches)
```

A project's `pnpm dev` and `pnpm build` run these.

`src/app` is generated and git-ignored: never edit it. Change a route by putting a file at
the same path in `templates/` (pages, layouts) or `api/` (Route Handlers).
`registry build` and `registry watch` (also `registry:build`, `registry:watch`) are older names for `prepare` and `prepare --watch`.

#### Choosing the bundler

`dev` and `build` both accept `--webpack` and `--turbopack`. The choice is
spelled for the project's Next.js version. NextSpark supports Next.js ~16.4.2,
where Turbopack is the default and Webpack is opt-in (Webpack is deferred, not
a supported bundler for 1.0). `nextspark build --webpack` is what a project with
a custom `webpack()` in `next.config` needs in order to build.

```bash
nextspark build --webpack     # Force Webpack
nextspark dev --turbopack     # Force Turbopack
```

Any other flag is forwarded verbatim to `next dev` / `next build`:

```bash
nextspark build --debug --profile
```

### Experimental helpers

> **Experimental:** `add:plugin`, `add:mobile`, `setup:ai` and `sync:ai` are not part of the stable 1.0 surface and may change without a deprecation period. Each prints this notice when it runs. `add:theme` is not supported: templates are extracted once from `@nextsparkjs/core` when the project is created (`create-nextspark-app --theme <name>`).

### Database

```bash
nextspark db:migrate   # Run database migrations (--dry-run lists what is pending and writes nothing)
nextspark db:seed      # Run migrations with the sample data, development only
```

### Health check

```bash
nextspark doctor       # Run a health check on the project
```

### Upgrade a 0.x project

```bash
nextspark migrate --dry-run   # Read-only report
nextspark migrate --yes       # Move to the root-first layout and convert a committed app tree
nextspark migrate --check     # Read-only: list the obsolete local copies a migrated project still holds (exit 1 if any, 2 if the check cannot run; add --json)
nextspark migrate --rename-entity-slugs   # Also rename entity slugs with an underscore to hyphens (optional) and print what else to update
```

See [Upgrading a 0.x project](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/17-updates/06-upgrade-0x-projects.md), and its [Cleanup after upgrading](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/17-updates/06-upgrade-0x-projects.md#cleanup-after-upgrading) checklist for workarounds core now replaces.

## Requirements

- Node.js 22.x (22.14.0 or later) or 24.x
- pnpm 10 (10.34.6 or later), 11 or 12; npm, yarn and bun are not supported. See the [support matrix](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/02-support-matrix.md).

## Documentation

- [NextSpark documentation](https://www.nextspark.dev/docs)
- [CLI tool](https://www.nextspark.dev/docs/npm-distribution/cli-tool)

## License

MIT
