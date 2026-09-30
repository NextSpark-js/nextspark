# @nextsparkjs/cli

CLI tool for NextSpark development workflow.

## Installation

The CLI is included with `@nextsparkjs/core`. You can use it with npx:

```bash
npx nextspark <command>
```

Or install globally:

```bash
pnpm add -g @nextsparkjs/cli
```

## Commands

### Initialize Project

```bash
npx nextspark init              # Interactive wizard
npx nextspark init --preset saas    # Use SaaS preset
npx nextspark init --preset blog    # Use Blog preset
npx nextspark init --preset crm     # Use CRM preset
```

### Versioned skill guides

The project-local CLI bundles concise offline guidance that matches its installed version. No monorepo `.claude/` folder or network access is required:

```bash
pnpm nextspark skills list --json
pnpm nextspark skills get nextspark-blocks
pnpm nextspark skills get nextspark-auth
pnpm nextspark skills get nextspark-cli
```

New projects receive small `AGENTS.md` and `CLAUDE.md` pointers only. The legacy `@nextsparkjs/ai-workflow` pack remains an explicit opt-in through `nextspark setup:ai`; it is not installed by `nextspark init --yes`.

### Development

```bash
nextspark dev       # Generate src/app and the registries, start the dev server and regenerate on changes
nextspark build     # prepare --production, then next build
nextspark prepare   # Generate src/app and the registries once (--check compares, --watch watches)
```

`src/app` is generated and git-ignored: never edit it. Change a route by putting a file at
the same path in `templates/` (pages, layouts) or `api/` (Route Handlers).
`registry build` and `registry watch` (also `registry:build`, `registry:watch`) are older names for `prepare` and `prepare --watch`.

#### Choosing the bundler

`dev` and `build` both accept `--webpack` and `--turbopack`. The choice is
spelled for the project's Next.js version, so the same flag works across
majors: on Next 15 Webpack is the default and Turbopack is opt-in, on Next 16
it is the other way round. `nextspark build --webpack` is what a Next 16
project with a custom `webpack()` in `next.config` needs in order to build.

```bash
nextspark build --webpack     # Force Webpack
nextspark dev --turbopack     # Force Turbopack
```

Any other flag is forwarded verbatim to `next dev` / `next build`:

```bash
nextspark build --debug --profile
```

### Database

```bash
nextspark db:migrate   # Run database migrations
nextspark db:seed      # Seed sample data
```

### Upgrade a 0.x project

```bash
nextspark migrate --dry-run   # Read-only report
nextspark migrate --yes       # Move to the root-first layout and convert a committed app tree
```

See [Upgrading a 0.x project](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/17-updates/06-upgrade-0x-projects.md).

## Requirements

- Node.js 22.14.0 or later
- pnpm recommended

## Documentation

Visit [nextspark.dev/docs](https://nextspark.dev/docs) for full documentation.

## License

MIT
