# @nextsparkjs/cli

CLI tool for NextSpark development workflow.

## Installation

The CLI is included with `@nextsparkjs/core`. You can use it with npx:

```bash
npx nextspark <command>
```

Or install globally:

```bash
npm install -g @nextsparkjs/cli
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
nextspark dev       # Start dev server with project
nextspark build     # Production build
nextspark registry  # Build component registries
```

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
nextspark migrate   # Run database migrations
```

## Requirements

- Node.js 22.14.0 or later
- pnpm recommended

## Documentation

Visit [nextspark.dev/docs](https://nextspark.dev/docs) for full documentation.

## License

MIT
