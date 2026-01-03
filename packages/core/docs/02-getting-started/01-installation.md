# Installation

## Introduction

Complete step-by-step installation guide for setting up NextSpark for local development. This guide covers all prerequisites, dependencies, and initial configuration.

**Quick Start:** For a faster setup, see [Quick Start Guide](./00-quick-start.md)

---

## Prerequisites

### Required Software

#### 1. Node.js 18+ (20+ Recommended)

**Check version:**
```bash
node -v
# Should show: v20.x.x or v18.x.x
```

**Install/Update:**
- **macOS:** `brew install node@20`
- **Linux:** [NodeSource](https://github.com/nodesource/distributions)
- **Windows:** [nodejs.org](https://nodejs.org)

**Verify installation:**
```bash
node -v
npm -v
```

#### 2. pnpm 10.17.0 (Exact Version)

**Why pnpm:**
- Faster than npm/yarn
- Disk space efficient
- Better monorepo support
- Project uses `packageManager` field for version locking

**Install:**
```bash
# Install specific version
npm install -g pnpm@10.17.0

# Verify
pnpm -v
# Should show: 10.17.0
```

**Alternative (via Corepack):**
```bash
# Enable Corepack (comes with Node.js 16.9+)
corepack enable

# Install pnpm via Corepack (uses version from package.json)
corepack prepare pnpm@10.17.0 --activate
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

The boilerplate tracks the installed core framework version in `core.version.json`. This file is automatically managed by the update system.

**Check your current core version:**
```bash
cat core.version.json
```

**Example output:**
```json
{
  "version": "0.1.0",
  "updatedAt": "2024-12-20T00:00:00.000Z",
  "releaseUrl": null,
  "previousVersion": null,
  "repository": "TheMoneyTeam-com-ar/nextspark"
}
```

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
- Check Node.js version is 18+
- Check pnpm version is exactly 10.17.0
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
BETTER_AUTH_URL="http://localhost:5173"

# === APPLICATION (REQUIRED) ===
NEXT_PUBLIC_ACTIVE_THEME="default"
NEXT_PUBLIC_APP_URL="http://localhost:5173"

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

**Verify tables:**
```bash
pnpm db:verify
```

**Should show:**
```text
Checking tables...
✓ user
✓ session
✓ account
✓ verification
✓ api_keys
✓ meta
✓ user_flags
✓ tasks
✓ _migrations

All required tables exist!
```

**If migration fails:**
- Check `DATABASE_URL` is correct
- Verify database is accessible
- Check network/firewall settings
- See [Troubleshooting → Database](./08-troubleshooting.md#database-connection-errors)

**See:** [Database Setup Guide](./02-database-setup.md) for detailed instructions

### Step 5: Build Registries

**Generate static registries:**
```bash
pnpm registry:build
```

**What happens:**
- Scans `contents/themes/` for entities, messages, configs
- Scans `contents/plugins/` for plugin configs
- Generates static registry files in `core/lib/registries/`
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
✓ Generating config-registry.ts

Registry build completed in 5.2s
```

**Why this matters:**
- **~17,255x performance improvement** over runtime imports
- Eliminates file system I/O at runtime
- Static type checking for all configurations
- Faster cold starts and page loads

**See:** [Build Process Guide](./04-build-process.md) for detailed explanation

### Step 6: Build Theme

**Compile theme CSS and copy assets:**
```bash
pnpm theme:build
```

**What happens:**
- Compiles CSS from `contents/themes/default/styles/`
- Outputs to `app/theme-styles.css`
- Copies public assets from `contents/themes/default/public/` to `public/theme/`
- Processes CSS variables

**Expected output:**
```text
Building theme: default
✓ Compiling CSS...
✓ Copying public assets...
✓ Generated: app/theme-styles.css
✓ Copied: public/theme/

Theme build completed in 1.8s
```

### Step 7: Build Documentation Index

**Index markdown documentation:**
```bash
pnpm docs:build
```

**What happens:**
- Scans `core/docs/**/*.md`
- Parses frontmatter and headings
- Creates searchable index
- Generates navigation structure
- Outputs to `core/lib/registries/docs-registry.ts`

**Expected output:**
```text
Building documentation index...
✓ Scanning core/docs/
✓ Indexing 123 markdown files
✓ Generating docs-registry.ts

Docs build completed in 1.2s
```

### Step 8: Start Development Server

**Start all processes:**
```bash
pnpm dev
```

**What happens (10-15 seconds):**

```text
1. [THEME]    Building theme CSS... ✓ (2.1s)
2. [REGISTRY] Building registries... ✓ (5.4s)
3. [DOCS]     Building docs index... ✓ (1.1s)
4. [PLUGINS]  Starting plugin dev servers... ✓ (1.8s)
5. [APP]      Starting Next.js with Turbopack... ✓ (3.2s)

  ▲ Next.js 15.4.6
  - Local:        http://localhost:5173
  - Turbopack:    enabled

 ✓ Starting...
 ✓ Ready in 12s
```

**Watch modes active:**
- **THEME:** Rebuilds CSS on file changes in `contents/themes/*/styles/`
- **REGISTRY:** Rebuilds registries on changes in `contents/`
- **PLUGINS:** Hot reload for plugin development
- **APP:** Next.js HMR for React components

**Open browser:** http://localhost:5173

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
# ✅ Should be v18.x.x or v20.x.x

# Check pnpm
pnpm -v
# ✅ Should be 10.17.0

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
# Check database connection
pnpm db:verify

# ✅ Should list all tables without errors
```

### 4. Build Artifacts

```bash
# Check registries generated
test -d core/lib/registries && echo "✅ Registries directory exists" || echo "❌ Registries missing"
test -f core/lib/registries/entity-registry.ts && echo "✅ Entity registry exists" || echo "❌ Entity registry missing"

# Check theme CSS generated
test -f app/theme-styles.css && echo "✅ Theme CSS exists" || echo "❌ Theme CSS missing"

# Check theme assets copied
test -d public/theme && echo "✅ Theme assets exist" || echo "❌ Theme assets missing"
```

### 5. Development Server

```bash
# Start server (in another terminal)
pnpm dev

# Server should start on port 5173
# ✅ No errors in console
# ✅ All 5 processes running (THEME, REGISTRY, DOCS, PLUGINS, APP)
```

### 6. Application Access

**Open:** http://localhost:5173

**Verify:**
- [ ] Landing page loads
- [ ] Theme CSS applied (colors, fonts, layout)
- [ ] Navigation links work
- [ ] No console errors in browser DevTools
- [ ] Dashboard redirects to login when not authenticated

### 7. Authentication Flow (Optional)

**If you configured Resend:**

1. **Sign Up:**
   - Go to http://localhost:5173/signup
   - Enter email and password
   - Submit form

2. **Email Verification:**
   - Check your email
   - Click verification link
   - Should redirect to verified page

3. **Log In:**
   - Go to http://localhost:5173/login
   - Enter credentials
   - Submit form
   - Should redirect to dashboard

4. **Dashboard Access:**
   - Go to http://localhost:5173/dashboard
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
5. Set authorized redirect URI: `http://localhost:5173/api/auth/callback/google`
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
npm install -g pnpm@10.17.0

# Or via Corepack
corepack enable
corepack prepare pnpm@10.17.0 --activate
```

### "Node version too old"

**Check version:**
```bash
node -v
```

**If < v18.0.0:**
```bash
# macOS
brew install node@20

# Linux (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
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
node core/scripts/build/registry.mjs --build --verbose

# Check TypeScript
pnpm type-check

# Clear and rebuild
rm -rf core/lib/registries/*
pnpm registry:build
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

### Port 5173 already in use

**Find process:**
```bash
lsof -i :5173
```

**Kill process:**
```bash
kill -9 <PID>
```

**Or use different port:**
```bash
# Edit package.json dev script
"dev": "... next dev --turbopack -p 3000"
```

---

## Next Steps

### 1. Explore the Application

**Landing Page:** http://localhost:5173
- Test navigation
- View theme styling
- Test responsiveness

**Dashboard:** http://localhost:5173/dashboard
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
pnpm test

# E2E tests
pnpm test:e2e
```

**See:** [Testing Guide](../12-testing/README.md)

### 5. Prepare for Deployment

**When ready for production:**
- [Deployment Guide](./07-deployment.md)
- [Environment Configuration](./03-environment-configuration.md)

---

## Summary

**You've completed installation if you:**
- ✅ Installed Node.js 18+, pnpm 10.17.0, and PostgreSQL
- ✅ Cloned repository and installed dependencies
- ✅ Configured `.env.local` with required variables
- ✅ Ran database migrations successfully
- ✅ Built registries, theme, and docs
- ✅ Started dev server on port 5173
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
