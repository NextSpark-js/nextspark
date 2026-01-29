# Setup

## Introduction

This guide walks you through the initial project setup **after** you've completed the installation process. While the [Quick Start](./00-quick-start.md) gets you running in 5 minutes and [Installation](./01-installation.md) covers dependency installation, this guide focuses on properly configuring your development environment, understanding the project structure, and verifying everything is working correctly.

**What this guide covers:**
- Post-installation verification and configuration
- Development tools and IDE setup
- Deep dive into project structure
- Database verification and initial data
- Registry system explanation
- Theme activation and verification
- Development workflow optimization
- Testing environment setup

**What this guide does NOT cover:**
- Installing dependencies (see [Installation](./01-installation.md))
- Quick 5-minute setup (see [Quick Start](./00-quick-start.md))
- Database creation (see [Database Setup](./03-database-setup.md))
- Environment variables reference (see [Environment Configuration](./05-environment-configuration.md))

**Prerequisites:**
- ✅ Completed [Installation Guide](./01-installation.md)
- ✅ Node.js 20+, pnpm 10.17+ installed
- ✅ PostgreSQL database accessible (Supabase or local)
- ✅ `.env.local` file configured with required variables

**Time estimate:** 10-15 minutes

---

## 1. Post-Installation Verification

### 1.1 Verify Installation Success

Before configuring anything, let's verify the installation completed successfully.

**Check Node.js and pnpm versions:**
```bash
node -v
# Should show: v20.x.x or higher

pnpm -v
# Should show: 10.17.0 or higher
```

**Check dependencies installed:**
```bash
ls node_modules | wc -l
# Should show: 800+ packages

# Verify key dependencies
ls node_modules | grep -E "(next|react|typescript|better-auth)"
# Should see: next, react, typescript, better-auth, etc.
```

**Check project structure created:**
```bash
ls -la
# Should see:
# - app/
# - contents/
# - core/
# - scripts/
# - package.json
# - tsconfig.json
# - .env.local
```

### 1.2 Verify Build Artifacts

After running `pnpm dev` for the first time, several artifacts should have been generated:

**Registry files (auto-generated):**
```bash
ls core/lib/registries/
# Should see:
# - entity-registry.ts
# - entity-registry.client.ts
# - plugin-registry.ts
# - theme-registry.ts
# - route-handlers.ts
# - ... (16 total registry files)
```

**Theme CSS (auto-generated):**
```bash
ls app/theme-styles.css
# Should exist

ls public/theme/
# Should see copied theme assets:
# - brand/
# - images/
# - fonts/ (if theme has custom fonts)
```

**Next.js build cache:**
```bash
ls .next/
# Should see Next.js cache directory
```

### 1.3 Verify Application Running

**Check dev server started:**
```bash
# You should see output like:
  ▲ Next.js 15.x.x
  - Local:        http://localhost:5173
  - Turbopack:    enabled

 ✓ Ready in 12s
```

**Open in browser:**
1. Navigate to http://localhost:5173
2. You should see the landing page load
3. Check browser console (F12) - should be no critical errors

**Check dashboard redirect:**
1. Navigate to http://localhost:5173/dashboard
2. Should redirect to `/login` (not authenticated)
3. Login page should display properly

### 1.4 Verify Environment Variables

**Check .env.local exists:**
```bash
cat .env.local
# Should show your environment variables (database, auth secret, etc.)
```

**Verify required variables set:**
```bash
# Run verification script (create if needed)
node -e "
const requiredVars = [
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_ACTIVE_THEME',
  'RESEND_API_KEY'
];

const missing = requiredVars.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.log('❌ Missing required env vars:', missing.join(', '));
  process.exit(1);
} else {
  console.log('✅ All required environment variables are set');
}
"
```

**Common mistakes:**
- ❌ DATABASE_URL using wrong port (:5432 instead of :6543 for Supabase pooler)
- ❌ BETTER_AUTH_SECRET not set or too short
- ❌ URLs with trailing slashes
- ❌ NEXT_PUBLIC_ACTIVE_THEME not matching actual theme directory

---

## 2. Development Tools Setup

### 2.1 VS Code Configuration

**Install recommended extensions:**

Create `.vscode/extensions.json`:
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "Prisma.prisma",
    "wix.vscode-import-cost",
    "streetsidesoftware.code-spell-checker",
    "usernamehw.errorlens"
  ]
}
```

**Configure workspace settings:**

Create `.vscode/settings.json`:
```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": false
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.associations": {
    "*.css": "tailwindcss"
  },
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cn\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ],
  "search.exclude": {
    "**/node_modules": true,
    "**/.next": true,
    "**/dist": true,
    "**/.turbo": true
  }
}
```

### 2.2 Debugging Setup

**Create launch configuration:**

Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm dev"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}"
    },
    {
      "name": "Next.js: debug full stack",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm dev",
      "serverReadyAction": {
        "pattern": "started server on .+, url: (https?://.+)",
        "uriFormat": "%s",
        "action": "debugWithChrome"
      }
    }
  ]
}
```

**Usage:**
1. Press F5 or go to Run and Debug panel
2. Select configuration (server-side, client-side, or full stack)
3. Set breakpoints in your code
4. Debug interactively

### 2.3 TypeScript Server Optimization

**Update tsconfig.json for better performance:**

The project already has this, but verify:
```json
{
  "compilerOptions": {
    "incremental": true,
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

**Restart TypeScript server:**
- VS Code Command Palette (Cmd/Ctrl + Shift + P)
- Type: "TypeScript: Restart TS Server"
- Do this after major changes or if autocomplete breaks

### 2.4 Git Hooks Configuration

**Verify husky hooks installed:**
```bash
ls .husky/
# Should see:
# - pre-commit
# - commit-msg
```

**Test pre-commit hook:**
```bash
# Make a trivial change
echo "// test" >> test-file.js

# Try to commit (hook should run)
git add test-file.js
git commit -m "test"

# Should run:
# - TypeScript type check
# - ESLint
# - Tests (if configured)

# Clean up
rm test-file.js
```

**Skip hooks (emergency only):**
```bash
# Use --no-verify to skip hooks (use sparingly!)
git commit --no-verify -m "emergency fix"
```

### 2.5 Claude Code AI Workflow (Optional)

If you're using Claude Code for AI-assisted development, you can set up the workflow system:

**Setup command:**
```bash
nextspark setup:ai
```

**What it provides:**
- AI agent templates for specialized development tasks
- Optional ClickUp integration for project management
- Session-based workflow tracking
- Customizable automation patterns

**When to use:**
- Working with Claude Code AI assistant
- Want structured AI development workflow
- Need project management integration

**Learn more:** See [Claude Workflow Documentation](../16-claude-workflow/01-overview.md) for complete setup guide and customization options.

---

## 3. Understanding Your Project Structure

### 3.1 Core vs Contents Separation

This is the **most important concept** to understand:

**Core (`core/` directory):**
```text
core/
├── components/        # Reusable UI components
├── lib/              # Core business logic
│   ├── registries/   # ⚠️ AUTO-GENERATED - NEVER EDIT
│   ├── entities/     # Entity system
│   ├── services/     # Database services
│   └── utils/        # Utility functions
└── types/            # TypeScript type definitions
```

**Rules for core/:**
- ✅ **READ** from core/ in your code
- ❌ **NEVER** edit files in `core/lib/registries/` (auto-generated)
- ❌ **AVOID** editing core/ unless fixing bugs or adding features
- ✅ Import from `@/core/lib/registries/` for content access

**Contents (`contents/` directory):**
```text
contents/
├── themes/
│   └── default/           # YOUR ACTIVE THEME
│       ├── config/        # ✅ Edit here: all config files
│       │   ├── theme.config.ts
│       │   └── app.config.ts
│       ├── entities/      # ✅ Edit here: your entities
│       ├── messages/      # ✅ Edit here: translations
│       ├── public/        # ✅ Edit here: theme assets
│       └── styles/        # ✅ Edit here: theme CSS
└── plugins/
    ├── ai/               # ✅ Edit here: plugin configs
    └── ...
```

**Rules for contents/:**
- ✅ **EDIT** files in contents/ for customization
- ✅ **ADD** entities, plugins, themes here
- ❌ **NEVER** import directly from `@/contents` in app code
- ✅ Use registries to access contents at runtime

**App (`app/` directory):**
```text
app/
├── (public)/         # Public routes (no auth)
├── (protected)/      # Protected routes (auth required)
├── api/             # API routes
├── globals.css      # Global styles
└── layout.tsx       # Root layout
```

**Rules for app/:**
- ✅ **CREATE** pages and routes here
- ✅ **USE** components from core/
- ✅ **ACCESS** content via registries
- ❌ **NEVER** import from `@/contents` directly

### 3.2 Key Directories Deep Dive

**`contents/themes/default/` - Your Active Theme:**

This is where **all your customization** happens:

```text
contents/themes/default/
├── entities/
│   └── tasks/              # Example entity
│       ├── tasks.config.ts # Entity configuration
│       ├── tasks.fields.ts # Field definitions
│       ├── messages/       # Entity translations
│       │   ├── en.json
│       │   └── es.json
│       └── migrations/     # Entity-specific migrations
│
├── messages/               # Global theme translations
│   ├── en.json
│   └── es.json
│
├── public/                 # Theme assets
│   ├── brand/             # Logos, favicons
│   ├── images/            # Theme images
│   └── fonts/             # Custom fonts (optional)
│
├── styles/                # Theme CSS
│   ├── globals.css        # Main theme styles
│   ├── components.css     # Component overrides
│   └── utilities.css      # Utility classes
│
└── config/                # All configuration files
    ├── theme.config.ts    # Theme metadata
    ├── app.config.ts      # App-level config
    ├── dashboard.config.ts # Dashboard config
    ├── permissions.config.ts # Permissions
    └── billing.config.ts  # Billing/plans
```

**`contents/plugins/` - Plugin Ecosystem:**

```text
contents/plugins/
└── ai/                    # Example: AI plugin
    ├── plugin.config.ts   # Plugin metadata
    ├── api/              # Plugin API routes
    ├── components/       # Plugin components
    ├── messages/         # Plugin translations
    └── .env.example      # Plugin environment vars
```

**`core/components/` - Reusable UI Components:**

```text
core/components/
├── ui/                   # shadcn/ui components (DO NOT MODIFY)
│   ├── button.tsx
│   ├── input.tsx
│   └── ...
│
├── entities/            # Entity-related components
│   ├── wrappers/       # Universal entity wrappers
│   └── ...
│
└── layout/             # Layout components
    ├── Header.tsx
    ├── Sidebar.tsx
    └── ...
```

**`core/lib/registries/` - Auto-Generated (⚠️ NEVER EDIT):**

```text
core/lib/registries/
├── entity-registry.ts           # ⚠️ AUTO-GENERATED
├── entity-registry.client.ts    # ⚠️ AUTO-GENERATED
├── plugin-registry.ts           # ⚠️ AUTO-GENERATED
├── theme-registry.ts            # ⚠️ AUTO-GENERATED
├── route-handlers.ts            # ⚠️ AUTO-GENERATED
├── translation-registry.ts      # ⚠️ AUTO-GENERATED
└── ... (16 files total)         # ⚠️ ALL AUTO-GENERATED
```

**These files are 100% auto-generated** by `core/scripts/build/registry.mjs`. Any manual edits will be **overwritten** on next build.

### 3.3 Configuration Files

**`theme.config.ts` - Theme Metadata:**
```typescript
// contents/themes/default/config/theme.config.ts
export const themeConfig = {
  id: 'default',
  name: 'Default Theme',
  version: '1.0.0',

  colors: {
    primary: '#3b82f6',
    secondary: '#8b5cf6'
  },

  brand: {
    logo: '/theme/brand/logo.svg',
    favicon: '/theme/brand/favicon.ico'
  }
}
```

**`app.config.ts` - Application Settings:**
```typescript
// contents/themes/default/config/app.config.ts
export const appConfig = {
  name: 'My SaaS App',
  description: 'Built with NextSpark',

  features: {
    enableSignup: true,
    enableOAuth: true,
    enableDarkMode: true
  }
}
```

**`tsconfig.json` - TypeScript Configuration:**
- Strict mode enabled
- Path aliases configured (`@/*`, `@/core/*`, `@/contents/*`)
- Next.js plugin included
- Auto-updated to exclude inactive themes

**`package.json` - Dependencies and Scripts:**
- Dependencies: Next.js, React, TypeScript, Better Auth, etc.
- Scripts: dev, build, test, lint, registry:build, etc.
- Workspace configuration (if using pnpm workspaces)

---

## 4. Database Verification

### 4.1 Verify Database Connection

**Test connection with verification script:**
```bash
pnpm db:verify
```

**Expected output:**
```text
✓ Database connection successful
✓ Found 15 tables:
  - user
  - session
  - account
  - verification
  - tasks
  - tasks_meta
  - meta
  - api_keys
  - ...

✓ All required tables exist
✓ Database schema is up to date
```

**If verification fails:**
- Check DATABASE_URL in .env.local
- Ensure Supabase project is running
- Verify pooler connection (:6543) not direct (:5432)
- Check network/firewall blocking connection

### 4.2 Understand Migration Status

**Check which migrations have run:**
```bash
# View migration history (if using migration tracking)
psql $DATABASE_URL -c "SELECT * FROM schema_migrations ORDER BY version;"
```

**Re-run migrations if needed:**
```bash
pnpm db:migrate
```

**Check table structure:**
```bash
# Example: View tasks table
psql $DATABASE_URL -c "\d tasks"
```

### 4.3 Seed Development Data (Optional)

**Create test user accounts:**

Option 1 - Via UI:
1. Go to http://localhost:5173/signup
2. Create account with your email
3. Verify email (check Resend dashboard if not receiving)
4. Log in

Option 2 - Direct database insert (skip email verification):
```sql
-- Create test user
INSERT INTO "user" (id, email, name, email_verified, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'test@example.com',
  'Test User',
  true,
  NOW(),
  NOW()
);

-- Find user ID
SELECT id, email, name FROM "user" WHERE email = 'test@example.com';
```

**Seed sample entities (tasks example):**
```sql
-- Create sample tasks (replace USER_ID with actual user ID)
INSERT INTO tasks (user_id, title, description, status, priority, created_at, updated_at)
VALUES
  ('USER_ID', 'Setup development environment', 'Install dependencies and configure tools', 'done', 'high', NOW(), NOW()),
  ('USER_ID', 'Read documentation', 'Go through all getting started guides', 'in_progress', 'high', NOW(), NOW()),
  ('USER_ID', 'Build first feature', 'Create a new entity from scratch', 'todo', 'medium', NOW(), NOW());
```

### 4.4 Database Tools Setup

**Recommended PostgreSQL clients:**

1. **Postico (macOS)** - https://eggerapps.at/postico/
   - Beautiful UI, great for browsing
   - Easy query execution
   - Table relationship visualization

2. **DBeaver (Cross-platform)** - https://dbeaver.io/
   - Free and open source
   - Supports many databases
   - Powerful SQL editor

3. **pgAdmin (Cross-platform)** - https://www.pgadmin.org/
   - Official PostgreSQL tool
   - Full-featured admin interface

4. **Supabase Dashboard (Web)**
   - Built-in to Supabase
   - Table editor, SQL editor, logs
   - No installation needed

**Connect using Supabase dashboard:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to "Table Editor" or "SQL Editor"
4. Browse tables or run queries

---

## 5. Registry System Setup

### 5.1 Understanding Registries

**What are registries?**

Registries are **static TypeScript files** auto-generated at build time that contain all your entities, plugins, themes, and configurations. They provide:
- ⚡ **~17,255x performance improvement** (140ms → 6ms)
- 🔒 **Zero runtime I/O** (no filesystem access)
- ✅ **Type safety** (full TypeScript autocomplete)
- 🎯 **O(1) lookup** (instant access)

**Why they matter:**

Without registries, the app would need to:
1. Scan filesystem for entities (20ms)
2. Read configuration files (40ms)
3. Process configurations (15ms)
4. Discover related resources (35ms)
5. Build metadata (30ms)

**Total: 140ms PER ENTITY**

With registries, everything is pre-compiled:
- **Total: 6ms for ALL entities** (17,255x faster!)

**How they work:**

```text
BUILD TIME (once):
  core/scripts/build/registry.mjs
    ↓
  Scans contents/themes/default/entities/
  Scans contents/plugins/*/entities/
  Scans core/lib/entities/core/
    ↓
  Generates static TypeScript files
    ↓
  core/lib/registries/*.ts (16 files)

RUNTIME (every request):
  import { ENTITY_REGISTRY } from '@/core/lib/registries/entity-registry'
  const config = ENTITY_REGISTRY.tasks  // <1ms lookup
```

### 5.2 Initial Registry Build

**Build registries manually:**
```bash
pnpm registry:build
```

**Expected output:**
```text
🔍 Discovering content...
🔍 Found 2 entities:
  ✓ tasks (from theme)
  ✓ users (from core)
🔍 Found 1 plugins:
  ✓ ai
🔍 Found 1 theme:
  ✓ default

📝 Generating registries...
  ✓ entity-registry.ts (487 lines)
  ✓ entity-registry.client.ts (245 lines)
  ✓ plugin-registry.ts (312 lines)
  ✓ theme-registry.ts (156 lines)
  ✓ route-handlers.ts (428 lines)
  ... (11 more registries)

✅ Registry build completed in 5.2s
```

**Verify registry files created:**
```bash
ls -lh core/lib/registries/
# Should see 16 .ts files, all recently modified
```

**Check a registry file (DO NOT EDIT):**
```bash
head -20 core/lib/registries/entity-registry.ts
# Should see auto-generated TypeScript code
# ⚠️ WARNING at top: "AUTO-GENERATED - DO NOT EDIT"
```

### 5.3 Registry Watch Mode

**Start registry watch mode:**
```bash
# In a separate terminal
pnpm registry:build-watch
```

**What happens:**
```text
🔍 Initial build completed
👀 Watching for changes in:
  - contents/themes/default/entities/
  - contents/plugins/
  - core/lib/entities/core/

[waiting for changes...]

# When you edit a file:
📝 Change detected: contents/themes/default/entities/tasks/tasks.config.ts
🔄 Rebuilding registries... (1.2s)
✅ Registry rebuilt successfully
⚠️  RESTART DEV SERVER to apply changes
```

**Important:** Registry changes require server restart
- Registries are imported at app initialization
- Can't hot reload imports
- Must stop `pnpm dev` and restart

**Workflow:**
1. Run `pnpm registry:build-watch` in terminal 1
2. Run `pnpm dev` in terminal 2
3. Edit entity/plugin/theme files
4. Registry rebuilds automatically
5. See "⚠️ RESTART DEV SERVER" message
6. Stop dev server (Ctrl+C in terminal 2)
7. Restart dev server (`pnpm dev`)
8. Changes applied ✅

---

## 6. Theme Activation and Verification

### 6.1 Active Theme Setup

**Verify active theme set:**
```bash
grep NEXT_PUBLIC_ACTIVE_THEME .env.local
# Should show: NEXT_PUBLIC_ACTIVE_THEME="default"
```

**Check theme directory exists:**
```bash
ls -la contents/themes/default/
# Should see:
# - theme.config.ts
# - app.config.ts
# - entities/
# - messages/
# - public/
# - styles/
```

**Understand theme CSS compilation:**

When you run `pnpm dev`, the build process:
1. Reads `NEXT_PUBLIC_ACTIVE_THEME` (.env.local)
2. Loads `contents/themes/default/styles/*.css`
3. Compiles CSS (processes variables, imports)
4. Outputs to `app/theme-styles.css` (auto-generated)
5. Copies `contents/themes/default/public/` → `public/theme/`

**Watch mode:**
```bash
# Theme CSS rebuilds automatically when:
# - Any .css file in contents/themes/default/styles/ changes
# - Any file in contents/themes/default/public/ changes

# See output:
[THEME] File change detected: contents/themes/default/styles/globals.css
[THEME] Rebuilding theme CSS... (234ms)
[THEME] ✓ Theme CSS rebuilt
```

### 6.2 Verify Theme Assets

**Check theme CSS generated:**
```bash
ls -lh app/theme-styles.css
# Should exist, ~50-200KB depending on theme
```

**Check public assets copied:**
```bash
ls -R public/theme/
# Should see:
# public/theme/brand/
#   - logo.svg
#   - favicon.ico
# public/theme/images/
#   - (theme images)
# public/theme/fonts/
#   - (custom fonts if any)
```

**Verify assets accessible:**

Open browser to:
- http://localhost:5173/theme/brand/logo.svg (should show logo)
- http://localhost:5173/theme/brand/favicon.ico (should download favicon)

### 6.3 Test Theme in Browser

**Open application:**
1. Navigate to http://localhost:5173
2. Open DevTools (F12)
3. Go to Elements/Inspector tab
4. Check `<html>` element

**Should see:**
```html
<html lang="en" class="light" style="--color-primary: #3b82f6; --color-secondary: #8b5cf6; ...">
```

**Test CSS variables applied:**
1. Open DevTools Console
2. Run:
```javascript
// Get computed primary color
getComputedStyle(document.documentElement).getPropertyValue('--color-primary')
// Should return: ' #3b82f6' (with spaces)
```

**Check theme styles loaded:**
1. Go to Network tab
2. Refresh page
3. Look for `theme-styles.css`
4. Status should be 200 OK
5. Check response contains your theme CSS

---

## 7. Development Workflow Setup

### 7.1 Terminal Setup

**Recommended terminal layout** (3 terminals):

**Terminal 1 - Main Dev Server:**
```bash
pnpm dev
# Runs: TypeScript config update, theme build, registry build, Next.js server
# Keep this running always
```

**Terminal 2 - Registry Watch (Optional):**
```bash
pnpm registry:build-watch
# Automatically rebuilds registries on content changes
# Use when actively developing entities/plugins
```

**Terminal 3 - Testing/Commands:**
```bash
# Use for ad-hoc commands:
pnpm test
pnpm lint
pnpm db:migrate
git status
# etc.
```

**Using terminal multiplexers (Advanced):**

**tmux:**
```bash
# Create session with 3 panes
tmux new -s dev

# Split horizontally
Ctrl+b %

# Split vertically
Ctrl+b "

# Navigate between panes
Ctrl+b arrow-keys

# Pane 1: pnpm dev
# Pane 2: pnpm registry:build-watch
# Pane 3: commands
```

**screen:**
```bash
# Create session
screen -S dev

# Create new window
Ctrl+a c

# Switch windows
Ctrl+a n (next)
Ctrl+a p (previous)

# Window 1: pnpm dev
# Window 2: pnpm registry:build-watch
# Window 3: commands
```

### 7.2 Browser DevTools Setup

**Install React DevTools:**

**Chrome:**
- https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi

**Firefox:**
- https://addons.mozilla.org/en-US/firefox/addon/react-devtools/

**Usage:**
1. Open DevTools (F12)
2. Go to "Components" tab (React DevTools)
3. Inspect component tree
4. View props, state, hooks
5. Edit props/state in real-time

**Recommended DevTools settings:**

**Console filtering:**
```javascript
// Add filters to hide noise:
// -source:react_devtools_backend
// -source:webpack
```

**Network tab monitoring:**
1. Keep Network tab open while developing
2. Filter by "Fetch/XHR" to see API calls
3. Check response times (should be <100ms for most)
4. Verify authentication headers present

**Lighthouse tab:**
1. Go to Lighthouse tab
2. Run audit on local site
3. Check Performance, Accessibility, Best Practices
4. Target: >90 in all categories

### 7.3 Git Configuration

**Initial commit (if not done):**
```bash
git init
git add .
git commit -m "chore: initial project setup"
```

**Configure git user:**
```bash
git config user.name "Your Name"
git config user.email "your.email@example.com"

# Or globally:
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

**Understand .gitignore:**

Already configured in project:
```text
# Ignored directories (DO NOT commit):
node_modules/          # Dependencies (huge!)
.next/                # Build output
.turbo/               # Turbo cache
dist/                 # Build artifacts

# Ignored files:
.env.local            # Local environment (secrets!)
.env.*.local          # Environment overrides

# Committed files (DO commit):
.env.example          # Template (no secrets)
```

**Check git status:**
```bash
git status
# Should show clean working directory after initial commit
# If you see core/lib/registries/ files, they should be committed
```

**Create feature branch:**
```bash
git checkout -b feature/my-first-feature
```

---

## 8. Testing Setup

### 8.1 Running Initial Tests

**Run all tests:**
```bash
pnpm test
```

**Run unit tests only:**
```bash
pnpm test:unit
# Uses Jest
# Tests: *.test.ts, *.test.tsx files
```

**Expected output:**
```text
 PASS  core/lib/utils/format.test.ts
 PASS  core/lib/entities/registry.test.ts

Test Suites: 2 passed, 2 total
Tests:       15 passed, 15 total
Snapshots:   0 total
Time:        3.245 s
```

**Run E2E tests:**
```bash
pnpm test:e2e
# Uses Cypress (headless)
# Tests: test/e2e/**/*.cy.ts
```

**Open Cypress UI:**
```bash
pnpm cy:open
# Opens Cypress Test Runner
# Can watch tests run in browser
# Good for development
```

### 8.2 Test Coverage Reports

**Generate coverage report:**
```bash
pnpm test:coverage
```

**Expected output:**
```text
--------------------|---------|----------|---------|---------|
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
All files           |   85.4  |   78.2   |   82.1  |   85.8  |
 lib/utils/         |   92.3  |   88.5   |   90.2  |   92.7  |
 lib/services/      |   81.2  |   75.4   |   78.9  |   81.6  |
 lib/entities/      |   87.8  |   82.1   |   85.3  |   88.2  |
--------------------|---------|----------|---------|---------|
```

**View HTML report:**
```bash
open coverage/lcov-report/index.html
# Opens coverage report in browser
# Shows which lines are covered/uncovered
```

**Coverage requirements:**
- Critical paths (auth, payments): 90%+
- Important features (CRUD, API): 80%+
- Utilities: 70%+

### 8.3 CI Workflow Setup

**Install CI workflow templates:**
```bash
pnpm setup:ci
```

**What this installs:**
- `validate-tags.yml` - Validates test tags on PR (opt-in)
- `cypress-smoke.yml` - Critical path tests on PR (~20 tests)
- `cypress-regression.yml` - Full test suite nightly (~300 tests)

**Expected output:**
```text
🔍 CI Workflow Setup

Available workflows:
  ✓ validate-tags.yml (Cypress tag validation)
  ✓ cypress-smoke.yml (Smoke tests on PR)
  ✓ cypress-regression.yml (Nightly regression)

Installing to .github/workflows/...
  ✓ Created validate-tags.yml
  ✓ Created cypress-smoke.yml
  ✓ Created cypress-regression.yml

✅ CI workflows installed successfully!
```

**Force reinstall:**
```bash
pnpm setup:ci -- --force
```

### 8.4 Theme-Level Cypress Setup

Each theme has its own Cypress config. If your theme doesn't have one, create it:

**Create theme Cypress config:**
```bash
# Copy from default theme as template
cp contents/themes/default/tests/cypress.config.ts contents/themes/YOUR_THEME/tests/
```

**Run tests for specific theme:**
```bash
pnpm cypress:run --config-file contents/themes/YOUR_THEME/tests/cypress.config.ts
```

### 8.5 Tag System

Test tags are **automatically discovered and validated** during the registry build. No manual setup required.

**Tags are validated when you build registries:**
```bash
node core/scripts/build/registry.mjs
```

The build generates `testing-registry.ts` with all discovered tags organized by category (features, flows, layers, priorities, etc.).

**Learn more:** See [Tag Validation System](../12-testing/09-tag-validation-system.md) for details.

### 8.6 CI/CD Preparation

**Understand test scripts:**

```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=test/unit",
    "test:e2e": "cypress run",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch"
  }
}
```

**CI/CD will run:**
1. `pnpm type-check` (TypeScript errors)
2. `pnpm lint` (ESLint errors)
3. `node core/scripts/build/registry.mjs` (Registry build with tag validation)
4. `pnpm test:unit` (Unit tests)
5. `pnpm test:e2e` (E2E tests)
6. `pnpm build` (Production build)

All must pass ✅ before merge.

---

## 9. Verification Checklist

Go through this checklist to verify everything is set up correctly:

### Installation Verification
- [ ] Node.js 20+ installed (`node -v`)
- [ ] pnpm 10.17+ installed (`pnpm -v`)
- [ ] Dependencies installed (800+ packages in node_modules/)
- [ ] Project structure created (app/, core/, contents/, scripts/)

### Build Artifacts
- [ ] Registry files generated (16 files in core/lib/registries/)
- [ ] Theme CSS compiled (app/theme-styles.css exists)
- [ ] Theme assets copied (public/theme/ directory exists)
- [ ] Next.js cache created (.next/ directory exists)

### Application Running
- [ ] Dev server started (`pnpm dev` runs without errors)
- [ ] Landing page loads (http://localhost:5173)
- [ ] Dashboard redirects to login (http://localhost:5173/dashboard → /login)
- [ ] No critical errors in browser console

### Environment Configuration
- [ ] .env.local file exists and configured
- [ ] All required environment variables set
- [ ] DATABASE_URL uses pooler connection (:6543)
- [ ] BETTER_AUTH_SECRET is set (32+ characters)
- [ ] NEXT_PUBLIC_ACTIVE_THEME="default"

### Database
- [ ] Database connection successful (`pnpm db:verify` passes)
- [ ] All required tables exist (15+ tables)
- [ ] Migrations completed successfully
- [ ] Can connect via database client (Postico/DBeaver/Supabase dashboard)

### Development Tools
- [ ] VS Code extensions installed (ESLint, Prettier, Tailwind CSS, etc.)
- [ ] Workspace settings configured (.vscode/settings.json)
- [ ] Debugging configured (.vscode/launch.json)
- [ ] TypeScript server working (autocomplete functional)

### Registry System
- [ ] Registry build successful (`pnpm registry:build` completes)
- [ ] All 16 registry files created
- [ ] Registry watch mode works (`pnpm registry:build-watch`)
- [ ] Understand registry rebuild requires server restart

### Theme
- [ ] Active theme set (NEXT_PUBLIC_ACTIVE_THEME="default")
- [ ] Theme directory exists (contents/themes/default/)
- [ ] Theme CSS compiled (app/theme-styles.css)
- [ ] Theme assets accessible (http://localhost:5173/theme/brand/logo.svg)
- [ ] CSS variables applied in browser (check DevTools)

### Git
- [ ] Git initialized (`git status` works)
- [ ] Git user configured
- [ ] .gitignore working (.env.local not tracked)
- [ ] Initial commit created (optional)
- [ ] Feature branch created (optional)

### Testing
- [ ] Unit tests run (`pnpm test:unit` passes)
- [ ] E2E tests run (`pnpm test:e2e` passes)
- [ ] Test coverage acceptable (80%+ overall)
- [ ] Cypress opens (`pnpm cy:open` works)
- [ ] CI workflows installed (`pnpm setup:ci` run)
- [ ] Theme Cypress config exists (contents/themes/{theme}/tests/cypress.config.ts)
- [ ] Tag registry created (optional, for tag validation)

### Success Criteria

**You're ready to start developing if:**
- ✅ All checklist items above are checked
- ✅ Dev server runs without errors
- ✅ Application loads in browser
- ✅ Tests pass
- ✅ No critical console errors

**If any items are unchecked:**
- See [Troubleshooting](./10-troubleshooting.md)
- Review relevant sections above
- Check error messages carefully

---

## 10. Next Steps

Congratulations! Your development environment is fully set up. 🎉

**Recommended learning path:**

1. **Build Your First Feature** → [First Project Tutorial](./04-first-project.md)
   - Create a complete "Projects" entity from scratch
   - Learn full-stack development workflow
   - Database → API → UI
   - ~30-45 minutes hands-on

2. **Customize Your App** → [First Customization](./09-first-customization.md)
   - Change theme colors
   - Add custom pages
   - Modify existing entities
   - ~20-30 minutes hands-on

3. **Understand Architecture** → [Architecture Patterns](../01-fundamentals/04-architecture-patterns.md)
   - Registry-based loading
   - Build-time generation
   - Config-driven development
   - Zero-runtime-I/O philosophy
   - ~20 minutes reading

4. **Learn Entity System** → [Entity System Introduction](../04-entities/01-introduction.md)
   - Config-driven entity development
   - Auto-generated APIs
   - Universal UI components
   - ~15 minutes reading

5. **Explore Advanced Topics:**
   - [API Development](../05-api/01-introduction.md)
   - [Theme System](../07-theme-system/01-introduction.md)
   - [Plugin Development](../08-plugin-system/01-introduction.md)
   - [Testing Guide](../12-testing/01-overview.md)

**Support Resources:**

- **Documentation:** [Main README](../README.md)
- **Troubleshooting:** [Common Issues](./10-troubleshooting.md)
- **GitHub Issues:** Report bugs or request features
- **Discord Community:** Real-time help (if available)

---

## Common Setup Issues

### Port 5173 Already in Use

**Error:**
```text
Error: listen EADDRINUSE: address already in use :::5173
```

**Solution:**
```bash
# Find process using port 5173
lsof -i :5173

# Kill the process (replace PID)
kill -9 <PID>

# Or use different port
next dev --turbopack -p 3000
```

### Registry Build Fails

**Error:**
```text
Error: Cannot find module '@/contents/themes/default/entities/tasks/tasks.config'
```

**Solution:**
```bash
# Stop dev server
# Clear build artifacts
rm -rf .next
rm -rf core/lib/registries/*

# Rebuild from scratch
pnpm registry:build

# Restart dev server
pnpm dev
```

### Theme CSS Not Loading

**Error:**
- Styles not applied
- `app/theme-styles.css` doesn't exist

**Solution:**
```bash
# Verify theme exists
ls contents/themes/default/

# Rebuild theme manually
pnpm theme:build

# Restart dev server
pnpm dev
```

### Database Connection Fails

**Error:**
```text
Error: connect ECONNREFUSED
```

**Solution:**
1. Check DATABASE_URL in .env.local
2. Verify Supabase project is running
3. Use pooler connection (:6543) not direct (:5432)
4. Test connection:
```bash
psql $DATABASE_URL -c "SELECT 1"
```

### TypeScript Errors Not Showing

**Issue:** VS Code not showing TypeScript errors

**Solution:**
1. Restart TypeScript server:
   - Cmd/Ctrl + Shift + P
   - "TypeScript: Restart TS Server"

2. Check TypeScript version:
```bash
npx tsc --version
# Should match version in package.json
```

3. Verify tsconfig.json is correct
4. Clear VS Code cache and reload window

### Tests Failing

**Error:**
```text
Test suite failed to run
```

**Solution:**
```bash
# Clear Jest cache
pnpm test --clearCache

# Update snapshots if needed
pnpm test -u

# Run specific test for debugging
pnpm test path/to/test.test.ts
```

---

## Summary

**What we accomplished:**
- ✅ Verified installation successful
- ✅ Configured development tools (VS Code, debugging, git hooks)
- ✅ Understood project structure (core vs contents separation)
- ✅ Verified database connection and seeded data
- ✅ Learned registry system (17,255x performance improvement)
- ✅ Activated and verified theme
- ✅ Set up development workflow (terminals, DevTools, git)
- ✅ Configured testing environment
- ✅ Installed CI workflow templates
- ✅ Set up theme-level Cypress configuration
- ✅ Completed verification checklist

**Key concepts learned:**
- **Core vs Contents:** Never edit registries, customize in contents/
- **Registry System:** Build-time generation for ultra-fast runtime
- **Theme System:** CSS compilation + asset copying
- **Testing Architecture:** Core provides infrastructure, themes provide specs
- **Tag Validation:** Automatic during registry build
- **CI Workflows:** Install via `pnpm setup:ci` for automated testing
- **Zero Tolerance:** No errors, warnings, or failing tests
- **Development Workflow:** Multiple terminals, registry watch, server restart

**You're now ready to:**
- Build features
- Customize the application
- Deploy to production
- Contribute to the project

**Next recommended:** [First Project Tutorial](./04-first-project.md) 🚀

---

**Last Updated**: 2025-12-13
**Version**: 1.1.0
**Status**: Complete
