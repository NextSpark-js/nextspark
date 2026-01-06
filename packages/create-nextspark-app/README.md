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
- pnpm (recommended)

## Documentation

Visit [nextspark.dev/docs](https://nextspark.dev/docs) for full documentation.

## License

MIT
