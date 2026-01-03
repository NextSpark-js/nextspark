# @nextsparkjs/create-app

Create a new NextSpark SaaS project with a single command.

## Usage

```bash
npx @nextsparkjs/create-app my-app
cd my-app
pnpm install
pnpm dev
```

## What's Included

- Next.js 15 with App Router
- TypeScript configuration
- Tailwind CSS v4 setup
- Authentication ready (Better Auth)
- Database setup (PostgreSQL + Drizzle)
- UI components (shadcn/ui based)
- Testing setup (Jest + Cypress)
- i18n support (next-intl)

## Options

```bash
npx @nextsparkjs/create-app my-app --theme blog     # Use blog theme
npx @nextsparkjs/create-app my-app --theme crm      # Use CRM theme
npx @nextsparkjs/create-app my-app --skip-install   # Skip npm install
```

## Documentation

Visit [nextspark.dev/docs](https://nextspark.dev/docs) for full documentation.

## License

MIT
