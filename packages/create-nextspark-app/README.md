# create-nextspark-app

Create a new NextSpark SaaS project with a single command.

## Usage

```bash
npx create-nextspark-app my-app
```

This will:
1. Create a new directory `my-app`
2. Install `@nextsparkjs/core`
3. Run the interactive setup wizard
4. Generate your project with all configurations

## Options

```bash
# Interactive setup (default)
npx create-nextspark-app my-app

# Use a preset to skip some prompts
npx create-nextspark-app my-app --preset saas
npx create-nextspark-app my-app --preset blog
npx create-nextspark-app my-app --preset crm

# Skip all prompts (use defaults)
npx create-nextspark-app my-app -y
```

## What's Included

- **Next.js 15** with App Router and Turbopack
- **TypeScript** strict configuration
- **Tailwind CSS v4** with CSS-based theming
- **Authentication** ready with Better Auth
- **Database** setup with PostgreSQL + Drizzle
- **UI Components** 50+ components based on shadcn/ui
- **Entity System** with automatic CRUD and APIs
- **Page Builder** with blocks
- **Testing** with Jest + Cypress
- **i18n** with next-intl

## After Creation

```bash
cd my-app
pnpm dev
```

## Requirements

- Node.js 18+
- pnpm 9, 10 or 11

### Installing with another pnpm than the one that created the project

pnpm 11 checks every version in `pnpm-lock.yaml` against a minimum release age of one day each
time it installs, and refuses the lockfile with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` if any of
them was published less than a day before. The project's `pnpm-workspace.yaml` declares that same
policy, so what each pnpm locks when it creates the project is:

| Created with | Locks | Installs later with pnpm 11 |
|---|---|---|
| pnpm 11 | versions at least a day old | yes |
| pnpm 10.16 or later | versions at least a day old | yes |
| pnpm 9, or pnpm 10 before 10.16 | the newest version each range allows | only once every locked version is a day old |

For the last row, either wait until the day has passed, or let pnpm 11 resolve the project again
under the policy:

```bash
pnpm clean --lockfile
pnpm install
```

pnpm 10 has no lenient mode for a pinned version younger than a day, so the project excludes the
NextSpark packages of the release it was created with by version. pnpm 10.16 to 10.18 do not read
a version in that exclusion: with them, a NextSpark release does not install during its first day.

## Documentation

Visit [nextspark.dev/docs](https://nextspark.dev/docs) for full documentation.

## License

MIT
