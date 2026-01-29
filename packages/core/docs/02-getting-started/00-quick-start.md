# Quick Start

## Introduction

Get from zero to running application in **under 5 minutes**. This guide provides the absolute minimum steps to see the boilerplate in action.

**For detailed setup:** See [Installation Guide](./01-installation.md)

---

## Prerequisites Check

Before starting, verify you have:

```bash
# Node.js 18+ (20+ recommended)
node -v
# Should show: v20.x.x or higher

# pnpm 10.17+
pnpm -v
# Should show: 10.17.0 or higher

# If pnpm not installed:
npm install -g pnpm@10.17.0
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

**Open:** http://localhost:5173

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

# 3. Application URLs (use localhost:5173 for dev)
BETTER_AUTH_URL="http://localhost:5173"
NEXT_PUBLIC_APP_URL="http://localhost:5173"

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
- [ ] BETTER_AUTH_URL - Use `http://localhost:5173` for local dev
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

**What happens (takes 10-15 seconds):**

```text
1. [2-3s]  → Updating TypeScript config for active theme...
2. [2-3s]  → Building theme CSS and copying assets...
3. [5-10s] → Generating registries (entities, plugins, themes)...
4. [1-2s]  → Building documentation index...
5. [2-3s]  → Starting Next.js with Turbopack on port 5173...

✓ Ready! Open http://localhost:5173
```

**Console output should show:**
```text
  ▲ Next.js 15.x.x
  - Local:        http://localhost:5173
  - Turbopack:    enabled

 ✓ Starting...
 ✓ Ready in 12s
```

---

## Step 5: Verify Setup

### 1. Open Application

**Navigate to:** http://localhost:5173

**You should see:**
- ✅ Landing page loads
- ✅ No console errors
- ✅ Theme CSS applied

### 2. Test Dashboard Access

**Click "Dashboard" link** or go to: http://localhost:5173/dashboard

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
cat core.version.json
```

This file tracks which version of the core framework you're running. For updating to newer versions, see [Core Updates](../updates/update-core).

---

## Common Quick Start Issues

### Port 5173 Already in Use

```bash
# Find process using port 5173
lsof -i :5173

# Kill the process (replace PID)
kill -9 <PID>

# Or use a different port
next dev --turbopack -p 3000
```

### "pnpm: command not found"

```bash
# Install pnpm globally
npm install -g pnpm@10.17.0

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
rm -rf .next
rm -rf core/lib/registries/*

# Rebuild registries manually
pnpm registry:build

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

## Understanding the Build Process

When you run `pnpm dev`, 6 processes run in sequence:

### 1. TypeScript Config Update (~2s)
**Script:** `core/scripts/build/update-tsconfig.mjs`
- Updates `tsconfig.json` to exclude inactive themes
- Improves TypeScript performance
- Runs before every dev server start

### 2. Theme CSS Build (~2s)
**Script:** `core/scripts/build/theme.mjs --watch`
- Compiles theme CSS from `contents/themes/default/styles/`
- Copies public assets to `public/theme/`
- Outputs to `app/theme-styles.css`
- **Auto-generated - never edit manually**

### 3. Registry Generation (~5-10s)
**Script:** `core/scripts/build/registry.mjs --watch`
- **CRITICAL:** Scans entities, plugins, themes
- Generates static registries in `core/lib/registries/`
- **~17,255x performance improvement** over runtime loading
- **Auto-generated - never edit manually**

### 4. Documentation Index (~1s)
**Script:** `core/scripts/build/docs.mjs`
- Indexes all markdown files in `core/docs/`
- Creates searchable documentation
- Generates navigation

### 5. Plugin Workspaces (~2s)
**Tool:** Turbo (monorepo orchestration)
- Starts dev servers for plugins
- Coordinates dependencies
- Enables hot reload for plugins

### 6. Next.js Dev Server (~2s)
**Command:** `next dev --turbopack -p 5173`
- Starts Next.js on port 5173
- Uses Turbopack (faster than Webpack)
- Enables Hot Module Replacement (HMR)

**Total Time:** 10-15 seconds (first time may be longer)

**Why this matters:**
- Understand what's happening during startup
- Know which processes to monitor
- Troubleshoot build failures effectively

---

## Auto-Generated Files (Never Edit)

**These directories are auto-generated:**

```bash
# Next.js build output
.next/

# Registry files (generated by build-registry.mjs)
core/lib/registries/
├── entity-registry.ts
├── entity-registry.client.ts
├── plugin-registry.ts
├── plugin-registry.client.ts
├── theme-registry.ts
├── translation-registry.ts
├── route-handlers.ts
├── config-registry.ts
├── docs-registry.ts
└── index.ts

# Theme CSS (generated by build-theme.mjs)
app/theme-styles.css

# Theme assets (copied from theme/public/)
public/theme/
```

**To make changes:**
- **Entities:** Edit files in `contents/themes/default/entities/[entity]/`
- **Plugins:** Edit files in `contents/plugins/[plugin]/`
- **Themes:** Edit files in `contents/themes/default/`
- **Rebuild:** Run `pnpm registry:build` or restart `pnpm dev`

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

**Landing Page:** http://localhost:5173
- See default theme
- Test navigation
- Check responsive design

**Dashboard:** http://localhost:5173/dashboard
- Requires authentication
- View sample data (if migration created it)
- Test CRUD operations

**API Endpoints:** http://localhost:5173/api/v1/
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
pnpm dev                    # Start dev server (all processes)
pnpm dev:watch              # Dev with watch mode (auto-rebuild)

# Build
pnpm registry:build         # Build registries (one-time)
pnpm registry:build-watch   # Build registries (watch mode)
pnpm theme:build            # Build theme CSS (one-time)
pnpm build                  # Production build (all scripts + Next.js)

# Database
pnpm db:migrate             # Run migrations
pnpm db:verify              # Verify tables exist

# Testing
pnpm test                   # Run all tests
pnpm test:unit              # Unit tests (Jest)
pnpm test:e2e               # E2E tests (Cypress)

# Linting
pnpm lint                   # Check code quality
pnpm lint:fix               # Fix auto-fixable issues
pnpm type-check             # TypeScript validation
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
- ✅ Verified app loads on http://localhost:5173
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
