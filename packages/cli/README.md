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

### Development

```bash
nextspark dev       # Start dev server with active theme
nextspark build     # Production build
nextspark registry  # Build component registries
```

### Database

```bash
nextspark migrate   # Run database migrations
```

## Requirements

- Node.js 18+
- pnpm recommended

## Documentation

Visit [nextspark.dev/docs](https://nextspark.dev/docs) for full documentation.

## License

MIT
