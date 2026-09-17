# Installation

> **Registry commands in this guide** run in the NextSpark monorepo, from the repository root. In a generated project, build the registries with `pnpm build:registries` and watch them with `pnpm exec nextspark registry:watch`.

## Introduction

Complete step-by-step installation guide for setting up NextSpark for local development. This guide covers all prerequisites, dependencies, and initial configuration.

**Quick Start:** For a faster setup, see [Quick Start Guide](./00-quick-start.md)

---

## Prerequisites

### Required Software

#### 1. Node.js 22.13+

**Check version:**
```bash
node -v
# Should show: v22.13.0 or higher
```

**Install/Update:**
- **macOS:** `brew install node@22`
- **Linux:** [NodeSource](https://github.com/nodesource/distributions)
- **Windows:** [nodejs.org](https://nodejs.org)

**Verify installation:**
```bash
node -v
npm -v
```

#### 2. pnpm 9.0.0 (Repository Version)

**Why pnpm:**
- Faster than npm/yarn
- Disk space efficient
- Better monorepo support
- Project uses `packageManager` field for version locking

**Install:**
```bash
# Enable Corepack and activate the repository version
corepack enable
corepack prepare pnpm@9.0.0 --activate

# Verify
pnpm -v
# Should show: 9.0.0
```

#### 3. PostgreSQL Database

**Options:**

**A. Supabase (Recommended for Beginners)**
- ✅ Free tier available
- ✅ Managed hosting
- ✅ Built-in authentication
- ✅ Real-time subscriptions
- ✅ Easy connection pooling

**Create account:** [supabase.com](https://supabase.com)

**B. Local PostgreSQL**
- ✅ Full control
- ✅ No external dependencies
- ❌ Requires manual setup
- ❌ Need to configure connection pooling

**Install:**
- **macOS:** `brew install postgresql@16`
- **Linux:** `sudo apt install postgresql-16`
- **Windows:** [PostgreSQL Downloads](https://www.postgresql.org/download/windows/)

**C. Docker PostgreSQL**
```bash
docker run -d \
  --name sass-postgres \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=sass_db \
  -p 5432:5432 \
  postgres:16
```

**See:** [Database Setup Guide](./02-database-setup.md) for detailed instructions

#### 4. Git

**Check version:**
```bash
git --version
```

**Install:**
- **macOS:** Included with Xcode Command Line Tools
- **Linux:** `sudo apt install git`
- **Windows:** [git-scm.com](https://git-scm.com)

### Optional but Recommended

**VS Code Extensions:**
- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense
- Better Comments

**Command Line Tools:**
- Supabase CLI (if using Supabase): `npm install -g supabase`
- Vercel CLI (for deployment): `npm install -g vercel`
- PostgreSQL client tools: `brew install libpq` (macOS)

---

## Core Version Tracking

**Check your installed core version:**
```bash
pnpm update-core --current
```

After each update it completes, `update-core` also records the version in `core.version.json`.

**For updating to newer versions:** See [Core Updates](../updates/update-core)

---

## Installation Steps

### Step 1: Clone Repository

```bash
# Clone the repository
git clone <repository-url> nextspark
cd nextspark

# Verify structure
ls -la
# Should see: app/, core/, contents/, scripts/, package.json, etc.
```

**Expected structure:**
```text
nextspark/
├── .rules/                  # Claude Code development rules
├── app/                     # Next.js App Router
├── contents/                # Themes, plugins, entities
├── core/                    # Core application code
├── core/migrations/         # Database migrations
├── scripts/                 # Build scripts
├── test/                    # Test suites
├── package.json
├── tsconfig.json
└── .env.example
```

### Step 2: Install Dependencies

```bash
# Install all dependencies (takes 2-3 minutes)
pnpm install
```

**What happens:**
- Downloads ~500MB of dependencies
- Installs Playwright browsers (if needed)
- Sets up Git hooks (if configured)
- Links workspace packages

**Expected output:**
```text
Progress: resolved 1234, reused 1200, downloaded 34, added 1234
Packages: +1234
Packages are hard linked from the content-addressable store to the virtual store.
Done in 2m 34s
```

**If you see errors:**
- Check Node.js version is 22.13+
- Check pnpm version is 9.0.0
- Check internet connection
- Try clearing cache: `pnpm store prune`

### Step 3: Setup Environment Variables

```bash
# Copy environment template
cp .env.example .env.local
```

**Edit `.env.local`** - Configure these variables:

#### Minimal Configuration (Required)

```bash
# === DATABASE (REQUIRED) ===
DATABASE_URL="postgresql://postgres.xxxxx:password@aws-0-region.pooler.supabase.com:6543/postgres"

# === AUTHENTICATION (REQUIRED) ===
# Generate: openssl rand -base64 32
BETTER_AUTH_SECRET="your-generated-32-character-secret"
BETTER_AUTH_URL="http://localhost:3010"

# === APPLICATION (REQUIRED) ===
NEXT_PUBLIC_ACTIVE_THEME="default"
NEXT_PUBLIC_APP_URL="http://localhost:3010"

# === EMAIL SERVICE (REQUIRED) ===
RESEND_API_KEY="re_xxxxx"
RESEND_FROM_EMAIL="noreply@yourdomain.com"
RESEND_FROM_NAME="Your App Name"
```

**Generate BETTER_AUTH_SECRET:**
```bash
openssl rand -base64 32
# Copy output and paste into .env.local
```

**Get DATABASE_URL:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to Settings → Database
4. Copy **Connection pooling** string (port :6543)
5. Paste into `.env.local`

**Get RESEND_API_KEY:**
1. Sign up at [resend.com](https://resend.com)
2. Go to API Keys
3. Create new key
4. Copy and paste into `.env.local`

**See:** [Environment Configuration Guide](./03-environment-configuration.md) for complete reference

### Step 4: Database Setup

**Run migrations:**
```bash
pnpm db:migrate
```

**What happens:**
- Connects to database using `DATABASE_URL`
- Runs core migrations from `core/migrations/`
- Runs entity migrations from `contents/themes/*/entities/*/migrations/`
- Runs plugin migrations from `contents/plugins/*/migrations/`
- Creates migration tracking table (`_migrations`)
- Applies RLS policies

**Expected output:**
```text
Running migrations from: core/migrations/
✓ 001_initial_schema.sql
✓ 002_add_metadata.sql
✓ 003_add_user_flags.sql
✓ 004_add_api_keys.sql
✓ 005_add_rls_policies.sql
✓ 006_add_user_preferences.sql
✓ 007_add_audit_logs.sql

Running entity migrations...
✓ contents/themes/default/entities/tasks/migrations/001_create_tasks.sql

All migrations completed successfully!
```

**Inspect the Better Auth tables:**
```bash
cd apps/dev && node ../../packages/core/scripts/db/verify-tables.mjs
```

**Should show the discovered Better Auth table schemas and row counts:**
```text
Connected to database
✓ user
✓ session
✓ account
✓ verification
Verification complete!
```

**If migration fails:**
- Check `DATABASE_URL` is correct
- Verify database is accessible
- Check network/firewall settings
- See [Troubleshooting → Database](./08-troubleshooting.md#database-connection-errors)

**See:** [Database Setup Guide](./02-database-setup.md) for detailed instructions

### Step 5: Build Registries

**Prerequisite:** From the monorepo root, build Core once before running the registry script. This creates the `packages/core/dist` modules that the script imports.

```bash
pnpm build:core
```

**Generate static registries:**
```bash
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs
```

**What happens:**
- Scans `contents/themes/` for entities, messages, configs
- Scans `contents/plugins/` for plugin configs
- Generates static registry files in `.nextspark/registries/`
- Creates server and client versions
- Builds route handlers for dynamic routes

**Expected output:**
```text
Building registries...
✓ Scanning themes...
✓ Scanning plugins...
✓ Scanning entities...
✓ Generating entity-registry.ts
✓ Generating entity-registry.client.ts
✓ Generating plugin-registry.ts
✓ Generating plugin-registry.client.ts
✓ Generating theme-registry.ts
✓ Generating translation-registry.ts
✓ Generating route-handlers.ts
✓ Generating permissions-registry.ts
✓ Generating docs-registry.ts in .nextspark/registries/

Registry build completed in 5.2s
```

**Why this matters:**
- **~17,255x performance improvement** over runtime imports
- Eliminates file system I/O at runtime
- Static type checking for all configurations
- Faster cold starts and page loads

**See:** [Build Process Guide](./04-build-process.md) for detailed explanation

### Step 6: Verify Theme CSS

The monorepo has no separate theme-build package script. Verify the active theme stylesheet and the app import before starting Next.js:
```bash
test -f themes/default/styles/globals.css
grep -F 'themes/default/styles/globals.css' apps/dev/app/globals.css
```

**What happens:**
- `apps/dev/app/globals.css` imports the active theme stylesheet.
- Next.js compiles that CSS during `pnpm dev` and `pnpm build`.
- Theme assets used by the monorepo are present under `apps/dev/public/theme/`.

### Step 7: Build Documentation Registry

**Generate documentation metadata with every registry:**
```bash
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs
```

**What happens:**
- Reads the active theme's `docs/public/` and `docs/superadmin/` directories
- Derives navigation metadata from numbered sections and markdown files
- Outputs `.nextspark/registries/docs-registry.ts`
- Supports imports through `@nextsparkjs/registries/docs-registry`

**Expected output:**
```text
Building registries...
✓ Generating docs-registry.ts

Registry build completed
```

### Step 8: Start Development Server

**Start the development server:**
```bash
pnpm dev
```

The root script delegates to `apps/dev`, which starts one Next.js process with Turbopack on the `PORT` loaded from `apps/dev/.env`:

```text
> @nextsparkjs/dev dev
> dotenv -e .env -- sh -c 'next dev --turbopack -p $PORT'
```

Next.js handles application and imported CSS changes. If registry inputs change, run the registry watcher separately:

```bash
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs --watch
```

**Open browser:** use the local URL printed by Next.js (port 3010 in the measured `apps/dev/.env`).

**You should see:**
- ✅ Landing page loads
- ✅ Theme CSS applied
- ✅ No console errors
- ✅ Navigation works

**See:** [Running Locally Guide](./05-running-locally.md) for detailed development workflow

---

## Verification Checklist

### 1. Environment Setup

```bash
# Check Node.js
node -v
# ✅ Should be v22.13.0 or higher

# Check pnpm
pnpm -v
# ✅ Should be 9.0.0

# Check Git
git --version
# ✅ Should show git version

# Check dependencies installed
ls node_modules
# ✅ Should list many packages
```

### 2. Environment Variables

```bash
# Check .env.local exists
test -f .env.local && echo "✅ .env.local exists" || echo "❌ .env.local missing"

# Validate required variables (minimal check)
grep -q "DATABASE_URL" .env.local && echo "✅ DATABASE_URL set" || echo "❌ DATABASE_URL missing"
grep -q "BETTER_AUTH_SECRET" .env.local && echo "✅ BETTER_AUTH_SECRET set" || echo "❌ BETTER_AUTH_SECRET missing"
grep -q "NEXT_PUBLIC_ACTIVE_THEME" .env.local && echo "✅ NEXT_PUBLIC_ACTIVE_THEME set" || echo "❌ NEXT_PUBLIC_ACTIVE_THEME missing"
```

### 3. Database

```bash
# Inspect the Better Auth tables using apps/dev/.env
cd apps/dev && node ../../packages/core/scripts/db/verify-tables.mjs

# ✅ Should print the discovered Better Auth table schemas and row counts
```

### 4. Build Artifacts

```bash
# Check registries generated
test -d .nextspark/registries && echo "✅ Registries directory exists" || echo "❌ Registries missing"
test -f .nextspark/registries/entity-registry.ts && echo "✅ Entity registry exists" || echo "❌ Entity registry missing"
test -f .nextspark/registries/docs-registry.ts && echo "✅ Docs registry exists" || echo "❌ Docs registry missing"

# Check the app imports the active theme CSS
grep -F 'themes/default/styles/globals.css' apps/dev/app/globals.css

# Check app-served theme assets
test -d apps/dev/public/theme && echo "✅ Theme assets exist" || echo "❌ Theme assets missing"
```

### 5. Development Server

```bash
# Start server (in another terminal)
pnpm dev

# Server should start on PORT from apps/dev/.env
# ✅ No errors in console
# ✅ One Next.js process is listening
```

### 6. Application Access

**Open:** http://localhost:3010

**Verify:**
- [ ] Landing page loads
- [ ] Theme CSS applied (colors, fonts, layout)
- [ ] Navigation links work
- [ ] No console errors in browser DevTools
- [ ] Dashboard redirects to login when not authenticated

### 7. Authentication Flow (Optional)

**If you configured Resend:**

1. **Sign Up:**
   - Go to http://localhost:3010/signup
   - Enter email and password
   - Submit form

2. **Email Verification:**
   - Check your email
   - Click verification link
   - Should redirect to verified page

3. **Log In:**
   - Go to http://localhost:3010/login
   - Enter credentials
   - Submit form
   - Should redirect to dashboard

4. **Dashboard Access:**
   - Go to http://localhost:3010/dashboard
   - Should see dashboard (authenticated)
   - Test CRUD operations on tasks entity

---

## Post-Installation Setup

### Optional Configurations

#### 1. Google OAuth (Optional)

**If you want Google sign-in:**

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project (or select existing)
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Set authorized redirect URI: `http://localhost:3010/api/auth/callback/google`
6. Copy Client ID and Client Secret
7. Add to `.env.local`:
   ```bash
   GOOGLE_CLIENT_ID="xxxxx.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="xxxxx"
   ```

**See:** [Environment Configuration → Google OAuth](./03-environment-configuration.md#google-oauth)

#### 2. Plugin Configuration

**If using plugins with separate .env files:**

Example for billing plugin:
```bash
# Create plugin .env file
cp contents/plugins/billing/.env.example contents/plugins/billing/.env

# Edit with your credentials
nano contents/plugins/billing/.env
```

**Plugins with .env files:**
- `contents/plugins/billing/.env` - Payment provider credentials
- `contents/plugins/ai/.env` - OpenAI/Anthropic API keys
- `contents/plugins/amplitude/.env` - Analytics tracking

#### 3. VS Code Setup

**Recommended settings (.vscode/settings.json):**
```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.exclude": {
    "**/.next": true,
    "**/node_modules": true
  }
}
```

**Recommended extensions (.vscode/extensions.json):**
```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "aaron-bond.better-comments"
  ]
}
```

---

## Common Installation Issues

### "pnpm: command not found"

**Solution:**
```bash
corepack enable
corepack prepare pnpm@9.0.0 --activate
```

### "Node version too old"

**Check version:**
```bash
node -v
```

**If < v22.13.0:**
```bash
# macOS
brew install node@22

# Linux (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node -v
```

### "Unable to connect to database"

**Check DATABASE_URL format:**
```bash
# Correct format (pooler connection)
postgresql://postgres.xxxxx:password@aws-0-region.pooler.supabase.com:6543/postgres

# Wrong (direct connection - will fail in serverless)
postgresql://postgres.xxxxx:password@aws-0-region.supabase.com:5432/postgres
```

**Test connection:**
```bash
# Install PostgreSQL client
brew install libpq  # macOS
sudo apt install postgresql-client  # Linux

# Test
psql "$(grep DATABASE_URL .env.local | cut -d'=' -f2-)"
```

**See:** [Troubleshooting → Database](./08-troubleshooting.md#database-connection-errors)

### "Registry build fails"

**Common causes:**
- Syntax error in entity config
- Invalid plugin config
- TypeScript errors

**Debug:**
```bash
# Check entity configs
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs --build --verbose

# Check TypeScript
pnpm --dir apps/dev exec tsc --noEmit

# Clear and rebuild
rm -rf .nextspark/registries
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs
```

### "Theme not found: default"

**Verify:**
```bash
# Check theme directory exists
ls contents/themes/default

# Check .env.local
grep NEXT_PUBLIC_ACTIVE_THEME .env.local

# Should match directory name exactly (case-sensitive)
```

### Port 3010 already in use

**Find process:**
```bash
pid=$(lsof -tiTCP:3010 -sTCP:LISTEN)
ps -o command= -p "$pid"
kill "$pid"
```

**Or use different port:**
```bash
# Edit package.json dev script
"dev": "... next dev --turbopack -p 3000"
```

---

## Next Steps

### 1. Explore the Application

**Landing Page:** http://localhost:3010
- Test navigation
- View theme styling
- Test responsiveness

**Dashboard:** http://localhost:3010/dashboard
- Requires authentication
- Test CRUD operations
- Explore entity system

### 2. Learn the Architecture

**Read guides:**
- [Project Overview](../01-fundamentals/01-project-overview.md)
- [Directory Structure](../01-fundamentals/03-directory-structure.md)
- [Architecture Patterns](../01-fundamentals/04-architecture-patterns.md)

### 3. Make Your First Customization

**Follow tutorial:**
- [First Customization Guide](./06-first-customization.md)

**Quick customizations:**
1. Change theme colors
2. Modify landing page
3. Add custom page
4. Create new entity

### 4. Setup Testing

**Run tests:**
```bash
# Unit tests
pnpm test:core

# E2E tests
pnpm cy:run
```

**See:** [Testing Guide](../12-testing/README.md)

### 5. Prepare for Deployment

**When ready for production:**
- [Deployment Guide](./07-deployment.md)
- [Environment Configuration](./03-environment-configuration.md)

---

## Summary

**You've completed installation if you:**
- ✅ Installed Node.js 22.13+, pnpm 9.0.0, and PostgreSQL
- ✅ Cloned repository and installed dependencies
- ✅ Configured `.env.local` with required variables
- ✅ Ran database migrations successfully
- ✅ Built registries (including docs); Next.js compiles the imported theme CSS
- ✅ Started the dev server on the configured `PORT`
- ✅ Verified application loads without errors
- ✅ Tested authentication flow (optional)

**Time to complete:** 15-30 minutes (depending on download speeds and database setup)

**Next recommended:**
1. [Running Locally Guide](./05-running-locally.md) - Understand dev workflow
2. [Build Process Guide](./04-build-process.md) - Learn what happens during builds
3. [First Customization](./06-first-customization.md) - Make the app your own

**Need help?** See [Troubleshooting Guide](./08-troubleshooting.md)

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
