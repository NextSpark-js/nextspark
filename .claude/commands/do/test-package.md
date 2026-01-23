---
description: "Test npm package from scratch - creates fresh project and validates full flow with automated tests"
---

# do:test-package

**Context:** {{{ input }}}

---

## Purpose

Test the npm package distribution by creating a **fresh project** and validating the complete installation and runtime flow. This simulates exactly what a new user would experience when installing NextSpark from npm.

**When to use this command:**
- **Pre-publish validation** - Before releasing a new version to npm
- **Clean install testing** - After major changes to CLI or init process
- **New user experience validation** - Ensuring the onboarding flow works

**This is different from daily development testing:**
- Daily dev testing uses `pnpm setup:update-local` with `projects/local`
- This command creates a **completely fresh project** to simulate npm install

---

## Prerequisites

Before running this command, ensure:
1. **PostgreSQL database** is running and accessible
2. **Node.js 18+** is installed
3. **pnpm** is installed and working
4. **No processes using the test port** (default 3005)

---

## Cross-Platform Compatibility

This command must work on **both Windows and Unix** systems. Key differences:

| Operation | Windows (Git Bash) | Linux/Mac |
|-----------|-------------------|-----------|
| Kill process by PID | `cmd //c "taskkill /F /PID $PID"` | `kill -9 $PID` |
| Find process on port | `netstat -ano \| findstr ":$PORT"` | `lsof -ti:$PORT` |
| Delete locked folder | `cmd //c "rmdir /s /q folder"` | `rm -rf folder` |
| Background process | `cmd //c "..." &` | `command &` |

---

## Automated Execution

Execute these steps in order. **Stop and report if any step fails.**

### Step 1: Define Variables

**IMPORTANT:** Set these variables based on your local environment. All paths should be **relative to the nextspark root** or use environment variables.

```bash
# Determine repo root (parent of repo/ folder)
# Adjust this to match your local setup
NEXTSPARK_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"  # If running from script
# OR set manually:
# NEXTSPARK_ROOT="/path/to/your/nextspark"  # Linux/Mac
# NEXTSPARK_ROOT="C:/path/to/nextspark"     # Windows (use forward slashes!)

# Derived paths (don't change these)
REPO_ROOT="$NEXTSPARK_ROOT/repo"
PROJECTS_DIR="$NEXTSPARK_ROOT/projects"
TEST_DIR="$PROJECTS_DIR/test-package"
TEST_PORT=3005
```

### Step 2: Clean Environment

```bash
# Kill any processes on test port
# Windows:
netstat -ano 2>/dev/null | grep ":$TEST_PORT" | head -1 | awk '{print $5}' | xargs -I {} cmd //c "taskkill /F /PID {}" 2>/dev/null || true
# Linux/Mac:
# lsof -ti:$TEST_PORT | xargs kill -9 2>/dev/null || true

# Clean previous test project
rm -rf "$TEST_DIR" 2>/dev/null || true
# Windows fallback for locked files:
# cmd //c "rmdir /s /q test-package" 2>/dev/null || true
```

### Step 3: Build and Pack ALL Packages

**IMPORTANT:** Build core, CLI, AND testing packages.

```bash
# Build and pack core
cd "$REPO_ROOT/packages/core"
pnpm build:js
rm -f nextsparkjs-core-*.tgz
pnpm pack

# Build and pack CLI
cd "$REPO_ROOT/packages/cli"
pnpm build
rm -f nextsparkjs-cli-*.tgz
pnpm pack

# Build and pack testing (required for Cypress tests)
cd "$REPO_ROOT/packages/testing"
pnpm build
rm -f nextsparkjs-testing-*.tgz
pnpm pack

# Verify tarballs exist
ls "$REPO_ROOT/packages/core"/nextsparkjs-core-*.tgz
ls "$REPO_ROOT/packages/cli"/nextsparkjs-cli-*.tgz
ls "$REPO_ROOT/packages/testing"/nextsparkjs-testing-*.tgz
```

**Validation:** All three `.tgz` files must exist.

### Step 4: Create Test Project from Template

Copy from `my-app` template, **excluding node_modules**:

```bash
mkdir -p "$TEST_DIR"

# Copy essential directories
cd "$PROJECTS_DIR/my-app"
cp -r app contents .nextspark public "$TEST_DIR/"
cp -r scripts "$TEST_DIR/" 2>/dev/null || true

# Copy config files
cp i18n.ts next.config.mjs tsconfig.json postcss.config.mjs \
   eslint.config.mjs .env .env.example .gitignore .npmrc \
   cypress.d.ts tsconfig.cypress.json \
   "$TEST_DIR/" 2>/dev/null || true
```

### Step 5: Create package.json with Tarball References

Get the absolute paths to the tarballs and create package.json:

```bash
cd "$TEST_DIR"

# Get tarball paths (absolute)
CORE_TGZ=$(ls "$REPO_ROOT/packages/core"/nextsparkjs-core-*.tgz | head -1)
CLI_TGZ=$(ls "$REPO_ROOT/packages/cli"/nextsparkjs-cli-*.tgz | head -1)
TESTING_TGZ=$(ls "$REPO_ROOT/packages/testing"/nextsparkjs-testing-*.tgz | head -1)

# On Windows Git Bash, convert /c/... to C:/... format for pnpm
# This sed handles the conversion automatically
CORE_TGZ=$(echo "$CORE_TGZ" | sed 's|^/\([a-zA-Z]\)/|\1:/|')
CLI_TGZ=$(echo "$CLI_TGZ" | sed 's|^/\([a-zA-Z]\)/|\1:/|')
TESTING_TGZ=$(echo "$TESTING_TGZ" | sed 's|^/\([a-zA-Z]\)/|\1:/|')

echo "Core: $CORE_TGZ"
echo "CLI: $CLI_TGZ"
echo "Testing: $TESTING_TGZ"
```

Then use the **Write tool** to create package.json with the actual tarball paths:

```json
{
  "name": "test-package",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "@nextsparkjs/cli": "file:<CLI_TGZ_PATH>",
    "@nextsparkjs/core": "file:<CORE_TGZ_PATH>",
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "better-auth": "^1.4.0",
    "next-intl": "^4.0.2",
    "drizzle-orm": "^0.41.0",
    "postgres": "^3.4.5",
    "@tanstack/react-query": "^5.64.2",
    "zod": "^4.1.5",
    "react-hook-form": "^7.54.2",
    "@hookform/resolvers": "^5.0.1",
    "tailwindcss": "^4.0.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0",
    "lucide-react": "^0.469.0",
    "sonner": "^1.7.4",
    "date-fns": "^4.1.0",
    "nanoid": "^5.0.9",
    "slugify": "^1.6.6"
  },
  "scripts": {
    "dev": "nextspark dev",
    "build": "nextspark build",
    "start": "next start",
    "lint": "next lint",
    "db:reset": "nextspark db reset",
    "db:migrate": "nextspark db migrate",
    "db:seed": "nextspark db seed",
    "cy:run": "cypress run",
    "cy:run:api": "cypress run --env grepTags=@api",
    "cy:run:smoke": "cypress run --env grepTags=@smoke"
  },
  "devDependencies": {
    "typescript": "^5.7.3",
    "@types/node": "^22.10.7",
    "@types/react": "^19.0.7",
    "@types/react-dom": "^19.0.3",
    "@tailwindcss/postcss": "^4.0.0",
    "eslint": "^9.18.0",
    "eslint-config-next": "^15.1.0",
    "@eslint/eslintrc": "^3.2.0",
    "drizzle-kit": "^0.31.4",
    "cypress": "^15.8.2",
    "@testing-library/cypress": "^10.0.2",
    "@cypress/grep": "^5.0.1",
    "@nextsparkjs/testing": "file:<TESTING_TGZ_PATH>",
    "allure-cypress": "^3.0.0",
    "dotenv": "^16.4.7"
  }
}
```

**NOTE:** Replace `<CORE_TGZ_PATH>`, `<CLI_TGZ_PATH>`, `<TESTING_TGZ_PATH>` with actual paths from the variables above.

### Step 6: Create cypress.config.ts

The my-app template may not have this file. Create it:

```typescript
import { defineConfig } from 'cypress'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '.env') })

const port = process.env.PORT || 3005
const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'my-saas-app'

export default defineConfig({
  e2e: {
    baseUrl: `http://localhost:${port}`,
    specPattern: [`contents/themes/${activeTheme}/tests/cypress/e2e/**/*.cy.ts`],
    supportFile: `contents/themes/${activeTheme}/tests/cypress/support/e2e.ts`,
    fixturesFolder: `contents/themes/${activeTheme}/tests/cypress/fixtures`,
    videosFolder: 'cypress/videos',
    screenshotsFolder: 'cypress/screenshots',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    retries: { runMode: 2, openMode: 0 },
    experimentalRunAllSpecs: true,
  },
})
```

### Step 7: Configure Environment

```bash
cd "$TEST_DIR"

# Create .env with test database and correct port
# IMPORTANT: Adjust DATABASE_URL for your local PostgreSQL setup
cat > .env << 'EOF'
# Database - ADJUST THIS FOR YOUR SETUP
DATABASE_URL="postgresql://user:password@localhost:5432/nextspark_test?sslmode=disable"

# Authentication
BETTER_AUTH_SECRET=test_secret_key_for_local_development_only

# Theme
NEXT_PUBLIC_ACTIVE_THEME="my-saas-app"

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3005"
NODE_ENV="development"
PORT=3005

# Email Provider (dummy key for production build - devKeyring handles login in dev)
# This bypasses the email provider validation during `next build`
RESEND_API_KEY=re_dummy_key_for_build_only

# Cypress Test Credentials (match your seeded test users)
CYPRESS_BASE_URL=http://localhost:3005
CYPRESS_TEST_PASSWORD=Test1234
CYPRESS_SUPERADMIN_EMAIL=superadmin@nextspark.dev
CYPRESS_SUPERADMIN_PASSWORD=Pandora1234
CYPRESS_OWNER_EMAIL=carlos.mendoza@tmt.dev
EOF
```

**Note:** The `RESEND_API_KEY` is a dummy value that passes build validation. For actual email functionality, use a real Resend API key. In development, the `devKeyring` system allows login without email verification.

### Step 8: Install Dependencies

```bash
cd "$TEST_DIR"
pnpm install

# Verify installation
ls node_modules/@nextsparkjs/core/package.json
ls node_modules/@nextsparkjs/cli/package.json
ls node_modules/@nextsparkjs/testing/package.json
```

### Step 9: Run Migrations

```bash
cd "$TEST_DIR"
npx nextspark db migrate
npx nextspark db seed || echo "Seed command not available"
```

### Step 10: Build Registries

```bash
cd "$TEST_DIR"
npx nextspark registry build
```

**Expected:** All registry files generated in `.nextspark/registries/`.

### Step 11: Start Server and Verify

```bash
cd "$TEST_DIR"

# Clean any stale .next cache
rm -rf .next 2>/dev/null || true

# Start dev server in background
PORT=$TEST_PORT npx next dev -p $TEST_PORT &

# Wait for server (up to 60 seconds)
for i in {1..12}; do
  sleep 5
  echo "Check $i..."
  if curl -s http://localhost:$TEST_PORT > /dev/null 2>&1; then
    echo "Server is up!"
    break
  fi
done
```

### Step 12: Verify Endpoints

```bash
# Quick verification
curl -s http://localhost:$TEST_PORT | grep -q "DOCTYPE" && echo "Homepage OK" || echo "Homepage FAILED"
curl -s http://localhost:$TEST_PORT/login | grep -q "DOCTYPE" && echo "Login OK" || echo "Login FAILED"
curl -s http://localhost:$TEST_PORT/api/auth/get-session && echo "Auth API OK"
```

### Step 13: Test Production Build (Optional)

First kill the dev server, then:

```bash
# Kill dev server
# Windows: netstat -ano | findstr ":$TEST_PORT" | awk '{print $5}' | head -1 | xargs -I {} cmd //c "taskkill /F /PID {}"
# Linux/Mac: lsof -ti:$TEST_PORT | xargs kill -9 || true

# Clean and build
rm -rf .next
npx nextspark build
```

---

## Success Criteria

The test passes if:
1. All packages build and pack without errors
2. Dependencies install successfully
3. Registries build successfully (no path escaping errors)
4. Server starts and reaches "Ready" state
5. Homepage and login pages render correctly
6. Production build completes without errors

---

## Known Issues & Workarounds

### Windows Path Escaping in Registries (FIXED)

**Issue:** Registry files used backslashes (`\`) causing escape sequence errors like `\v` being interpreted as vertical tab.

**Status:** Fixed in core registry generator. All paths are now normalized to forward slashes.

**If still occurring:** Rebuild core package: `cd packages/core && pnpm build:js && pnpm pack`

### CSS Import Paths with Backslashes

**Issue:** On Windows, CSS `@import` statements may get backslash paths causing build errors.

**Solution:** Ensure all CSS imports use forward slashes:
```css
/* WRONG */
@import "..\contents\themes\my-saas-app\styles\globals.css";

/* CORRECT */
@import "../contents/themes/my-saas-app/styles/globals.css";
```

### Windows File Locking (.next/trace)

**Issue:** Previous Next.js process leaves `.next/trace` locked.

**Workaround:**
```bash
rm -rf .next 2>/dev/null
# Windows: cmd //c "rmdir /s /q .next" 2>/dev/null
# If still locked, kill all node processes or restart terminal
```

### Port Already in Use

**Issue:** Previous test left server running.

**Workaround:**
```bash
# Windows
netstat -ano | findstr ":3005" | awk '{print $5}' | head -1 | xargs -I {} cmd //c "taskkill /F /PID {}"
# Linux/Mac
lsof -ti:3005 | xargs kill -9
```

---

## Cleanup

```bash
# Kill server
# (use appropriate command for your OS from above)

# Remove test project
rm -rf "$TEST_DIR"
```

---

## After Testing

If all tests pass, the package is ready for publishing:

```bash
cd "$REPO_ROOT"
pnpm pkg:version -- patch  # or minor/major
pnpm pkg:pack
pnpm pkg:publish
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Full test (manual verification) | `/do:test-package` |
| Daily dev testing | `pnpm setup:update-local` |
| Just rebuild packages | `pnpm build:core && pnpm build:cli` |
| Verify server running | `curl http://localhost:3005` |

---

## Template Locations (For Reference)

When fixing bugs found during testing, modify the **TEMPLATES** not the test project:

| What | Location |
|------|----------|
| App templates | `repo/packages/core/templates/app/` |
| Starter theme | `repo/packages/core/templates/contents/themes/starter/` |
| Registry generators | `repo/packages/core/scripts/build/registry/` |

**DO NOT** fix bugs in `projects/test-package/` - those changes are temporary and won't help future users.
