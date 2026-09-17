# Quick Start

> **Registry commands in this guide** run in the NextSpark monorepo, from the repository root. In a generated project, build the registries with `pnpm build:registries` and watch them with `pnpm exec nextspark registry:watch`.

## Introduction

Get from zero to running application in **under 5 minutes**. This guide provides the absolute minimum steps to see the boilerplate in action.

**For detailed setup:** See [Installation Guide](./01-installation.md)

---

## Prerequisites Check

Before starting, verify you have:

```bash
# Node.js 22.13+
node -v
# Should show: v22.13.0 or higher

# pnpm 9.0+
pnpm -v
# Should show: 9.0.0 or a compatible 9.x release

# If pnpm not installed:
corepack enable
corepack prepare pnpm@9.0.0 --activate
```

---

## TL;DR (3 Commands)

```bash
# 1. Install dependencies (~2-3 minutes)
pnpm install

# 2. Setup environment (edit DATABASE_URL and secrets)
cp .env.example .env.local

# 3. Run migrations and start dev server
pnpm db:migrate && pnpm dev
```

**Open:** http://localhost:3010

---

## Step 1: Clone & Install

```bash
# Clone the repository
git clone <repository-url>
cd nextspark

# Install dependencies (takes 2-3 minutes)
pnpm install
```

**Expected output:**
```text
Progress: resolved XXX, reused XXX, downloaded XX, added XXX
Done in Xs
```

> **Before running a registry command directly later in this guide:** from the monorepo root, run `pnpm build:core` once. The registry script imports modules generated in `packages/core/dist`.

---

## Step 2: Minimal Environment Setup

```bash
# Copy environment template
cp .env.example .env.local
```

**Edit `.env.local`** with these **REQUIRED** variables:

```bash
# 1. Database (use Supabase pooler URL)
DATABASE_URL="postgresql://postgres.xxxxx:password@aws-0-region.pooler.supabase.com:6543/postgres"

# 2. Generate auth secret (copy output)
# Run this command in terminal:
openssl rand -base64 32

# Then paste the output here:
BETTER_AUTH_SECRET="your-generated-32-character-secret"

# 3. Application URLs (use localhost:3010 for dev)
BETTER_AUTH_URL="http://localhost:3010"
NEXT_PUBLIC_APP_URL="http://localhost:3010"

# 4. Theme selection (use 'default' for now)
NEXT_PUBLIC_ACTIVE_THEME="default"

# 5. Email service (for auth emails - get free API key from resend.com)
RESEND_API_KEY="re_xxxxx"
RESEND_FROM_EMAIL="noreply@yourdomain.com"
RESEND_FROM_NAME="Your App Name"
```

**Quick Setup Checklist:**
- [ ] DATABASE_URL - Get from Supabase (use pooler connection :6543)
- [ ] BETTER_AUTH_SECRET - Generate with `openssl rand -base64 32`
- [ ] BETTER_AUTH_URL - Use `http://localhost:3010` for local dev
- [ ] NEXT_PUBLIC_APP_URL - Same as BETTER_AUTH_URL
- [ ] NEXT_PUBLIC_ACTIVE_THEME - Set to `default`
- [ ] RESEND_API_KEY - Get free key from [resend.com](https://resend.com)
- [ ] RESEND_FROM_EMAIL - Your verified email domain
- [ ] RESEND_FROM_NAME - Display name for emails

**Don't have Supabase?**
- Create free account: [supabase.com](https://supabase.com)
- Create new project
- Copy connection string from Settings → Database
- **IMPORTANT:** Use the **pooler** connection (port :6543, not :5432)

**Don't have Resend?**
- Create free account: [resend.com](https://resend.com)
- Get API key from API Keys section
- Verify your domain (or use test mode)

---

## Step 3: Database Migration

```bash
# Run database migrations (creates tables)
pnpm db:migrate
```

**Expected output:**
```text
Running migrations from: core/migrations/
✓ 001_initial_schema.sql
✓ 002_add_metadata.sql
✓ 003_add_user_flags.sql
...
All migrations completed successfully!
```

**If migration fails:**
- Check DATABASE_URL is correct
- Verify database is accessible
- See [Troubleshooting](./08-troubleshooting.md#database-connection-errors)

---

## Step 4: Start Development Server

```bash
pnpm dev
```

The root command delegates to `apps/dev` and starts one Next.js process:

```text
> @nextsparkjs/dev dev
> dotenv -e .env -- sh -c 'next dev --turbopack -p $PORT'
```

**Console output should show:**
```text
  ▲ Next.js 15.x.x
  - Local:        http://localhost:3010
  - Turbopack:    enabled

 ✓ Starting...
 ✓ Ready in 12s
```

---

## Step 5: Verify Setup

### 1. Open Application

**Navigate to:** http://localhost:3010

**You should see:**
- ✅ Landing page loads
- ✅ No console errors
- ✅ Theme CSS applied

### 2. Test Dashboard Access

**Click "Dashboard" link** or go to: http://localhost:3010/dashboard

**Expected behavior:**
- ✅ Redirects to login page (`/login`)
- ✅ Login form displays

### 3. Test Authentication (Optional)

**If you configured Resend:**

1. Click "Sign Up"
2. Enter email and password
3. Check your email for verification link
4. Verify email
5. Log in
6. Access dashboard

**If you didn't configure Resend:**
- Sign up will work but email verification won't send
- You can manually verify users in database if needed

### 4. Check Console

**Open browser DevTools (F12)** and check:

**No errors should appear.** Common warnings (safe to ignore):
- React hydration warnings (development only)
- Missing environment variables for optional features

**Errors to fix:**
- "Theme not found" → Check `NEXT_PUBLIC_ACTIVE_THEME=default`
- "Failed to fetch" → Check API routes are running
- "Database error" → Check `DATABASE_URL` is correct

### 5. Check Core Version

**Verify your core framework version:**
```bash
pnpm update-core --current
```

For updating to newer versions, see [Core Updates](../updates/update-core).

---

## Common Quick Start Issues

### Port 3010 Already in Use

```bash
# Find the listener, inspect it, then stop that PID
pid=$(lsof -tiTCP:3010 -sTCP:LISTEN)
ps -o command= -p "$pid"
kill "$pid"

# Or use a different port
PORT=3000 pnpm dev
```

### "pnpm: command not found"

```bash
# Enable Corepack and activate the repository version
corepack enable
corepack prepare pnpm@9.0.0 --activate

# Verify installation
pnpm -v
```

### "Cannot connect to database"

**Check DATABASE_URL:**
- ✅ Uses pooler connection (`:6543`)
- ✅ Password is correct
- ✅ No special characters unescaped
- ✅ Supabase project is running

**Test connection:**
```bash
# Install PostgreSQL client (if not installed)
brew install postgresql  # macOS
# or
sudo apt install postgresql-client  # Linux

# Test connection
psql "postgresql://postgres.xxxxx:password@aws-0-region.pooler.supabase.com:6543/postgres"
```

### "Theme not found: default"

**Verify:**
```bash
# Check theme directory exists
ls -la contents/themes/default

# Should show:
# theme.config.ts
# app.config.ts
# styles/
# public/
# entities/
# messages/

# Check .env.local
grep NEXT_PUBLIC_ACTIVE_THEME .env.local
# Should show: NEXT_PUBLIC_ACTIVE_THEME="default"
```

### Registry Build Fails

**Clear and rebuild:**
```bash
# Stop dev server (Ctrl+C)

# Clean build artifacts
rm -rf .next .nextspark/registries

# Rebuild every registry manually
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs

# Restart dev server
pnpm dev
```

### Slow Startup (> 30 seconds)

**Normal startup: 10-15 seconds**

**If taking longer:**
- Check CPU usage (build process is intensive)
- Check internet connection (downloads dependencies)
- Clear node_modules and reinstall:
  ```bash
  rm -rf node_modules
  pnpm install
  ```

---

## Understanding the Development Process

`pnpm dev` starts one Next.js process with Turbopack. It does not run TypeScript config updates, theme asset copying, registry generation, documentation generation, or plugin workspace servers.

### Next.js Development Server

**Command used by `apps/dev`:** `next dev --turbopack -p $PORT`
- Reads `PORT` from `apps/dev/.env` (3010 in the measured checkout)
- Compiles application code and imported theme CSS
- Enables Hot Module Replacement (HMR)

### Registry Generation

Run the registry builder separately when registry inputs change:

```bash
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs --watch
```

That script generates every registry, including the active theme's documentation registry. It is not started by the monorepo's root `pnpm dev` script.

---

## Auto-Generated Files (Never Edit)

**These directories are auto-generated:**

```bash
# Next.js build output
.next/

# Registry files (generated by registry.mjs)
.nextspark/registries/
├── entity-registry.ts
├── plugin-registry.ts
├── theme-registry.ts
├── docs-registry.ts
└── index.ts

```

**To make changes:**
- **Entities:** Edit files in `contents/themes/default/entities/[entity]/`
- **Plugins:** Edit files in `contents/plugins/[plugin]/`
- **Themes:** Edit files in `contents/themes/default/`
- **Rebuild:** In the monorepo, run `cd apps/dev && node ../../packages/core/scripts/build/registry.mjs`. Root `pnpm dev` starts `apps/dev` without rebuilding registries; in a generated project, `pnpm dev` builds registries on startup.

---

## Next Steps

### Optional: Claude Code AI Workflow Setup

If you're using Claude Code for development, set up the AI workflow system:

```bash
nextspark setup:ai
```

**What it does:**
- Installs `@nextsparkjs/ai-workflow` and copies agents, commands, skills to `.claude/`
- Sets up AI-assisted development workflow for Claude Code
- Preserves your custom configurations

**Learn more:** See [Claude Workflow Documentation](../16-claude-workflow/01-overview.md)

---

### Explore the Application

**Landing Page:** http://localhost:3010
- See default theme
- Test navigation
- Check responsive design

**Dashboard:** http://localhost:3010/dashboard
- Requires authentication
- View sample data (if migration created it)
- Test CRUD operations

**API Endpoints:** http://localhost:3010/api/v1/
- `/api/v1/tasks` - Sample entity API
- `/api/auth/*` - Authentication endpoints
- Test with curl or Postman

### Learn the Architecture

**Read Fundamentals:**
1. [Project Overview](../01-fundamentals/01-project-overview.md)
2. [Core Library Organization](../01-fundamentals/02-core-lib-organization.md)
3. [Directory Structure](../01-fundamentals/03-directory-structure.md)
4. [Architecture Patterns](../01-fundamentals/04-architecture-patterns.md)

**Understand Key Concepts:**
- Registry system (~17,255x performance)
- Build-time vs runtime
- Core vs Contents separation
- Entity system
- Plugin architecture

### Make Your First Customization

**Follow this guide:**
- [First Customization Tutorial](./06-first-customization.md)

**Quick wins:**
1. Change theme colors (CSS variables)
2. Modify landing page content
3. Add a custom page
4. Create a new entity

### Detailed Setup

**For production-ready setup:**
- [Complete Installation Guide](./01-installation.md)
- [Database Setup](./02-database-setup.md)
- [Environment Configuration](./03-environment-configuration.md)
- [Deployment Guide](./07-deployment.md)

---

## Development Commands Reference

```bash
# Development
pnpm dev                    # Start the development server

# Build
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs          # Build registries once
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs --watch  # Rebuild registries when files change
pnpm build                  # Create a production build

# Database
pnpm db:migrate             # Run migrations

# Testing
pnpm test:core              # Run the core Jest suite
pnpm cy:run                 # Run Cypress tests headlessly
pnpm cy:open                # Open the Cypress test runner
pnpm cy:tags "@smoke"       # Run Cypress tests with a tag filter

# Linting
pnpm lint                   # Check code quality
```

---

## Getting Help

**Troubleshooting:**
- [Troubleshooting Guide](./08-troubleshooting.md)

**Documentation:**
- [Full Documentation](../README.md)
- [API Reference](../05-api/README.md)
- [Component Guide](../09-frontend/README.md)

**Support:**
- GitHub Issues: Report bugs or request features
- Discord Community: Real-time help
- Stack Overflow: Tag with `nextspark`

---

## Summary

**You've completed Quick Start if you:**
- ✅ Installed dependencies with `pnpm install`
- ✅ Configured minimal `.env.local` (5 required variables)
- ✅ Ran database migrations with `pnpm db:migrate`
- ✅ Started dev server with `pnpm dev`
- ✅ Verified app loads on http://localhost:3010
- ✅ Tested authentication flow (optional)

**Time to complete:** < 5 minutes (excluding Supabase/Resend signup)

**Next recommended:**
1. **Explore:** Browse the application and test features
2. **Learn:** Read [Architecture Patterns](../01-fundamentals/04-architecture-patterns.md)
3. **Customize:** Follow [First Customization](./06-first-customization.md)
4. **Deploy:** See [Deployment Guide](./07-deployment.md) when ready

**Welcome to NextSpark!**

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
