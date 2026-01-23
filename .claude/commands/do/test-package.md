---
description: "Test npm package from scratch - creates fresh Next.js project and validates full flow"
---

# do:test-package

**Context:** {{{ input }}}

---

## Purpose

Test the npm package distribution by creating a **fresh Next.js project** and validating the complete installation and runtime flow. This simulates exactly what a new user would experience when installing NextSpark from npm.

**When to use this command:**
- **Pre-publish validation** - Before releasing a new version to npm
- **Clean install testing** - After major changes to CLI or init process
- **New user experience validation** - Ensuring the onboarding flow works

See also: `.claude/skills/npm-development-workflow/SKILL.md` section "When to Reset my-app from Scratch" for the decision framework.

**This is different from daily development testing:**
- Daily dev testing uses `pnpm setup:update-local` with `projects/my-app`
- This command creates a **completely fresh project** to simulate npm install

---

## MANDATORY: Read Skill First

Read `.claude/skills/npm-development-workflow/SKILL.md` for context on dual-mode testing.

---

## Prerequisites

Before running this command, ensure:
1. **PostgreSQL database** is running and accessible
2. **Node.js 18+** is installed
3. **pnpm** is installed and working
4. **CLI package** is built and packed (in addition to core)

---

## Execution Steps

Execute these steps in order. **Stop and report if any step fails.**

### Step 0: Verify Environment

```bash
# Determine paths relative to repo root
REPO_ROOT="$(git rev-parse --show-toplevel)"
PROJECTS_DIR="$(dirname "$REPO_ROOT")/projects"

# Ensure projects directory exists
if [ ! -d "$PROJECTS_DIR" ]; then
  echo "Creating projects directory..."
  mkdir -p "$PROJECTS_DIR"
fi

echo "REPO_ROOT: $REPO_ROOT"
echo "PROJECTS_DIR: $PROJECTS_DIR"
```

### Step 1: Clean Previous Test Project

```bash
cd "$PROJECTS_DIR"
rm -rf test-package
```

### Step 2: Build and Pack Packages

Build and pack both core and CLI packages:

```bash
# Build and pack core
cd "$REPO_ROOT/packages/core"
pnpm build:js
pnpm pack

# Build and pack CLI (required for nextspark command)
cd "$REPO_ROOT/packages/cli"
pnpm build
pnpm pack
```

**Validation:** Both builds complete without errors. `.tgz` files created in each package directory.

### Step 3: Create Fresh Next.js Project

**Option A: Using create-next-app (may timeout on some systems)**
```bash
cd "$PROJECTS_DIR"
npx create-next-app@latest test-package --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --turbopack --yes
```

**Option B: Manual creation (if Option A fails)**
```bash
cd "$PROJECTS_DIR"
mkdir test-package && cd test-package

# Create package.json
cat > package.json << 'EOF'
{
  "name": "test-package",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --turbopack -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "15.1.6",
    "react": "19.1.0",
    "react-dom": "19.1.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "15.1.6",
    "typescript": "^5"
  }
}
EOF

# Create minimal structure
mkdir -p src/app
# ... (add tsconfig.json, next.config.ts, etc.)
```

**Note:** On Windows with Git Bash, `create-next-app` may appear to hang. Use `npm install` with full path (`/c/nvm4w/nodejs/npm.cmd install`) if standard `npm`/`pnpm` commands don't produce output.

### Step 4: Install Core and CLI Tarballs

```bash
cd "$PROJECTS_DIR/test-package"

# Install both core and CLI packages
CORE_TARBALL=$(ls "$REPO_ROOT/packages/core"/nextsparkjs-core-*.tgz | head -1)
CLI_TARBALL=$(ls "$REPO_ROOT/packages/cli"/nextsparkjs-cli-*.tgz | head -1)

pnpm add "$CORE_TARBALL" "$CLI_TARBALL"
```

**IMPORTANT:** The CLI package is separate from core and must be installed for the `nextspark` command to work.

### Step 5: Run CLI Init

```bash
cd "$PROJECTS_DIR/test-package"
npx nextspark init --registries-only
```

**Note:** The full wizard (`npx nextspark init`) requires interactive input. Use `--registries-only` for non-interactive testing, then manually configure or copy files from apps/dev.

**For full init with wizard:**
```bash
npx nextspark init --quick --yes
# Answer prompts for project name, etc.
```

### Step 6: Build Registries

After init, rebuild registries to ensure all theme/entity data is generated:

```bash
cd "$PROJECTS_DIR/test-package"
npx nextspark registry build
```

**Expected output:** Registry files created in `.nextspark/registries/`.

### Step 7: Copy and Configure Environment

```bash
cd "$PROJECTS_DIR/test-package"
cp "$REPO_ROOT/apps/dev/.env" .env

# Add/update PORT for test project
echo "PORT=3000" >> .env
```

**Important:**
- Verify `DATABASE_URL` points to a valid, accessible database
- If database uses SSL, ensure SSL mode is correct in connection string

### Step 8: Run Database Migrations

```bash
cd "$PROJECTS_DIR/test-package"
npx nextspark db migrate
```

**Known issue:** The migration script hardcodes SSL settings. If your database doesn't support SSL, migrations will fail with "The server does not support SSL connections".

**Workaround:** If using shared database with monorepo (same DATABASE_URL), migrations are already applied and this step can be skipped.

### Step 9: Configure next.config for NPM Mode

The `next.config.mjs` from monorepo has paths specific to monorepo structure. Update for NPM mode:

```bash
# Fix i18n config path (points to monorepo location by default)
# Change from:
#   createNextIntlPlugin('../../packages/core/src/i18n.ts')
# To:
#   createNextIntlPlugin('./node_modules/@nextsparkjs/core/dist/i18n.js')
```

### Step 10: Start Development Server

```bash
cd "$PROJECTS_DIR/test-package"
pnpm dev
```

**Expected:** Server starts on http://localhost:3000

### Step 11: Manual Verification Checklist

Open browser at http://localhost:3000 and verify:

- [ ] Homepage loads without errors
- [ ] No console errors in browser DevTools
- [ ] No server errors in terminal
- [ ] Login page accessible at /login
- [ ] Can login with test user: `superadmin@tmt.dev` / `Test1234`
- [ ] Dashboard loads after login
- [ ] Sidebar shows entities (users, teams, etc.)
- [ ] Can create a new record
- [ ] Can edit an existing record
- [ ] Can delete a record
- [ ] List pagination works

---

## Known Issues (NPM Mode)

### 1. CLI is Separate Package
**Issue:** The `nextspark` CLI command comes from `@nextsparkjs/cli`, not `@nextsparkjs/core`.
**Solution:** Install both packages: `pnpm add @nextsparkjs/core @nextsparkjs/cli`

### 2. Theme Dependencies on Plugins
**Issue:** Default theme imports from langchain plugin (`@/plugins/langchain/...`).
**Solution:** Install required plugins or use a theme without plugin dependencies.

### 3. Migration Script SSL
**Issue:** `run-migrations.mjs` hardcodes `ssl: { require: true }` which fails on local databases without SSL.
**Solution:** Use shared database with existing migrations, or modify the script locally.

### 4. Nested node_modules in Theme
**Issue:** Copying theme from monorepo may include nested `node_modules/` with monorepo-specific `@nextsparkjs/core`.
**Solution:** Remove nested `node_modules` from `contents/themes/*/node_modules/`.

### 5. next.config Paths
**Issue:** `next.config.mjs` references monorepo paths like `../../packages/core/src/i18n.ts`.
**Solution:** Update paths to use `node_modules/@nextsparkjs/core/dist/...`.

### 6. Windows Git Bash
**Issue:** Some npm/pnpm commands appear to hang without output on Windows.
**Solution:** Use full path to npm/npx: `/c/nvm4w/nodejs/npm.cmd install`

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `nextspark: command not found` | Install CLI package: `pnpm add @nextsparkjs/cli` |
| `create-next-app` hangs | Use manual project creation (Option B in Step 3) |
| Tarball not found | Run pack commands in Step 2 |
| `nextspark init` prompts | Use `--registries-only` flag for non-interactive |
| Migration SSL error | Skip if using shared DB, or modify `run-migrations.mjs` |
| `Module not found: @nextsparkjs/registries` | Run `nextspark registry build` |
| `Module not found: @/plugins/...` | Install required plugin or remove plugin-dependent templates |
| Port already in use | Use different port: `next dev -p 3001` |
| `i18n config not found` | Update next.config.mjs i18n path for NPM mode |

---

## Success Criteria

The test passes if:
1. All steps complete without unrecoverable errors
2. Dev server starts and serves pages
3. Authentication flow works (login/logout)
4. CRUD operations function correctly
5. No hydration mismatches or console errors

---

## After Testing

If test passes, the package is ready for publishing:

```bash
cd "$REPO_ROOT"
pnpm pkg:version -- patch  # or minor/major
pnpm pkg:pack
pnpm pkg:publish
```

If test fails, document issues and fix in the repo before re-running.

---

## Cleanup

```bash
cd "$PROJECTS_DIR"
rm -rf test-package
```

---

## Relationship with Daily Development

| Scenario | Command to Use |
|----------|----------------|
| Daily development testing | `pnpm setup:update-local` (uses `projects/my-app`) |
| Pre-publish clean install | `/do:test-package` (creates fresh `projects/test-package`) |
| After CLI/init changes | `/do:test-package` (validates fresh install flow) |
| After core changes only | `pnpm setup:update-local` (faster, reuses existing project) |
