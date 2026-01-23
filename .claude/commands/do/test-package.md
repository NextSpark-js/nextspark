---
description: "Test npm package from scratch - creates fresh project and validates full flow with automated tests"
---

# do:test-package

**Context:** {{{ input }}}

---

## Purpose

Test the npm package distribution by creating a **fresh project** and validating the complete installation and runtime flow with **automated Cypress tests**. This simulates exactly what a new user would experience when installing NextSpark from npm.

**When to use this command:**
- **Pre-publish validation** - Before releasing a new version to npm
- **Clean install testing** - After major changes to CLI or init process
- **New user experience validation** - Ensuring the onboarding flow works

**This is different from daily development testing:**
- Daily dev testing uses `pnpm setup:update-local` with `projects/my-app`
- This command creates a **completely fresh project** to simulate npm install

---

## Prerequisites

Before running this command, ensure:
1. **PostgreSQL database** is running and accessible
2. **Node.js 18+** is installed
3. **pnpm** is installed and working
4. **No processes using ports 3000-3010** (or be prepared to kill them)

---

## Automated Execution

Execute these steps in order. **Stop and report if any step fails.**

### Step 1: Define Variables and Clean Environment

```bash
# Define paths
REPO_ROOT="G:/GitHub/nextspark/repo"
PROJECTS_DIR="G:/GitHub/nextspark/projects"
TEST_DIR="$PROJECTS_DIR/test-package"
TEST_PORT=3005

# Kill any processes on test port
netstat -ano | grep ":$TEST_PORT" | awk '{print $5}' | xargs -I {} taskkill /F /PID {} 2>/dev/null || true

# Clean previous test project (handle Windows file locks)
rm -rf "$TEST_DIR" 2>/dev/null || cmd //c "rmdir /s /q ${TEST_DIR//\//\\\\}" 2>/dev/null || true
```

### Step 2: Build and Pack Packages

```bash
# Build and pack core
cd "$REPO_ROOT/packages/core"
pnpm build:js
pnpm pack

# Build and pack CLI
cd "$REPO_ROOT/packages/cli"
pnpm build
pnpm pack

# Verify tarballs exist
ls -la "$REPO_ROOT/packages/core"/nextsparkjs-core-*.tgz
ls -la "$REPO_ROOT/packages/cli"/nextsparkjs-cli-*.tgz
```

**Validation:** Both `.tgz` files must exist.

### Step 3: Create Test Project from Template

Instead of creating from scratch, copy from `my-app` template (which has proper npm mode configuration) but **exclude node_modules**:

```bash
mkdir -p "$TEST_DIR"

# Copy essential directories (excluding node_modules)
cd "$PROJECTS_DIR/my-app"
cp -r app contents .nextspark public "$TEST_DIR/"
cp -r scripts "$TEST_DIR/" 2>/dev/null || true

# Copy config files
cp i18n.ts next.config.mjs tsconfig.json postcss.config.mjs \
   eslint.config.mjs .env .env.example .gitignore .npmrc \
   cypress.config.ts cypress.d.ts tsconfig.cypress.json \
   "$TEST_DIR/" 2>/dev/null || true
```

### Step 4: Create package.json with Tarball References

```bash
cd "$TEST_DIR"

# Get tarball filenames
CORE_TGZ=$(ls "$REPO_ROOT/packages/core"/nextsparkjs-core-*.tgz | head -1)
CLI_TGZ=$(ls "$REPO_ROOT/packages/cli"/nextsparkjs-cli-*.tgz | head -1)

# Create package.json with file: references
cat > package.json << EOF
{
  "name": "test-package",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "@nextsparkjs/cli": "file:$CLI_TGZ",
    "@nextsparkjs/core": "file:$CORE_TGZ",
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
    "@cypress/grep": "^5.0.1"
  }
}
EOF
```

### Step 5: Configure Environment

```bash
cd "$TEST_DIR"

# Create .env with test database and correct port
cat > .env << EOF
# Database - Uses dedicated test database (will be reset)
DATABASE_URL="postgresql://dbuser:dbpass_SecurePassword123@postgres.lab:5432/nextspark_test?sslmode=disable"

# Authentication
BETTER_AUTH_SECRET=2e205f79e4b0b8a061e79af9da52f1010ffe923a527a72791f0dbf7492df087a

# Theme
NEXT_PUBLIC_ACTIVE_THEME="my-saas-app"

# Application
NEXT_PUBLIC_APP_URL="http://localhost:$TEST_PORT"
NODE_ENV="development"
PORT=$TEST_PORT

# Cypress Test Credentials
CYPRESS_BASE_URL=http://localhost:$TEST_PORT
CYPRESS_TEST_PASSWORD=Test1234
CYPRESS_SUPERADMIN_EMAIL=superadmin@nextspark.dev
CYPRESS_SUPERADMIN_PASSWORD=Pandora1234
CYPRESS_OWNER_EMAIL=carlos.mendoza@tmt.dev
EOF
```

**Note:** Uses `nextspark_test` database which will be reset. If using shared database, change to `nextspark`.

### Step 6: Install Dependencies

```bash
cd "$TEST_DIR"

# On Windows, use full path if pnpm hangs
pnpm install 2>&1 || /c/nvm4w/nodejs/pnpm.cmd install 2>&1

# Verify installation
ls node_modules/@nextsparkjs/core/package.json
ls node_modules/@nextsparkjs/cli/package.json
```

### Step 7: Reset Database and Run Migrations

```bash
cd "$TEST_DIR"

# Reset database (drops all tables and recreates)
npx nextspark db reset --force 2>&1 || echo "DB reset not available, running migrate"

# Run migrations
npx nextspark db migrate 2>&1

# Seed sample data
npx nextspark db seed 2>&1 || echo "Seed command not available"
```

**Alternative if using shared database:**
```bash
# Skip reset, just verify connection
npx nextspark db verify 2>&1 || echo "DB verify not available"
```

### Step 8: Build Registries

```bash
cd "$TEST_DIR"

# Build registries for the theme
npx nextspark registry build 2>&1
```

**Expected:** All registry files generated in `.nextspark/registries/`.

### Step 9: Start Server and Run Automated Tests

Start the server in background and run Cypress tests:

```bash
cd "$TEST_DIR"

# Clean any stale .next cache (Windows file lock workaround)
rm -rf .next 2>/dev/null || cmd //c "rmdir /s /q .next" 2>/dev/null || true

# Start server in background
npx nextspark dev &
SERVER_PID=$!

# Wait for server to be ready
echo "Waiting for server on port $TEST_PORT..."
for i in {1..30}; do
  if curl -s "http://localhost:$TEST_PORT" > /dev/null 2>&1; then
    echo "Server ready!"
    break
  fi
  sleep 2
done

# Run Cypress smoke tests
npx cypress run --env grepTags=@smoke --config baseUrl=http://localhost:$TEST_PORT 2>&1
TEST_RESULT=$?

# Kill server
kill $SERVER_PID 2>/dev/null || true

# Report result
if [ $TEST_RESULT -eq 0 ]; then
  echo "✅ All tests passed!"
else
  echo "❌ Tests failed with exit code $TEST_RESULT"
  exit $TEST_RESULT
fi
```

**Alternative: Run API tests only (faster):**
```bash
npx cypress run --env grepTags=@api --config baseUrl=http://localhost:$TEST_PORT
```

---

## Automated Verification Checklist

The Cypress tests should verify:

| Test Tag | What It Verifies |
|----------|------------------|
| `@smoke` | Homepage loads, login works, dashboard accessible |
| `@api` | All API endpoints return correct responses |
| `@auth` | Login, logout, session management |
| `@crud` | Create, read, update, delete operations |

**If Cypress tests don't exist for the theme**, fall back to these manual checks with Playwright:

```javascript
// Use mcp__playwright to verify
await browser_navigate({ url: `http://localhost:${TEST_PORT}` });
await browser_snapshot(); // Should show homepage
await browser_navigate({ url: `http://localhost:${TEST_PORT}/login` });
await browser_snapshot(); // Should show login form
```

---

## Success Criteria

The test passes if:
1. ✅ All packages build and pack without errors
2. ✅ Dependencies install successfully
3. ✅ Registries build successfully
4. ✅ Server starts and reaches "Ready" state
5. ✅ Cypress smoke tests pass (or manual Playwright verification)
6. ✅ No hydration mismatches or console errors

---

## Known Issues & Workarounds

### Windows File Locking (.next/trace)

**Issue:** Previous Next.js process leaves `.next/trace` locked.

**Workaround:**
```bash
# Try multiple removal methods
rm -rf .next 2>/dev/null
cmd //c "rmdir /s /q .next" 2>/dev/null
# If still locked, restart terminal or use different .next path
NEXT_DIST_DIR=".next-test" npx next dev
```

### Windows pnpm Silent Hang

**Issue:** `pnpm install` appears to hang without output on Windows Git Bash.

**Workaround:** Use full path:
```bash
/c/nvm4w/nodejs/pnpm.cmd install
```

### Port Already in Use

**Issue:** Previous test left server running.

**Workaround:**
```bash
# Find and kill process on port
netstat -ano | grep ":3005" | awk '{print $5}' | head -1 | xargs taskkill /F /PID
# Or use different port
PORT=3006 npx nextspark dev
```

### Database SSL Error

**Issue:** Migration script expects SSL but local DB doesn't support it.

**Workaround:** Ensure `?sslmode=disable` in DATABASE_URL.

---

## Cleanup

```bash
# Stop any running servers
pkill -f "next dev" 2>/dev/null || taskkill /F /IM node.exe 2>/dev/null || true

# Remove test project
rm -rf "$PROJECTS_DIR/test-package"
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
| Full test (with Cypress) | `/do:test-package` |
| Daily dev testing | `pnpm setup:update-local` |
| Just rebuild packages | `pnpm build:core && pnpm build:cli` |
| Just run API tests | `pnpm cy:run -- --env grepTags=@api` |
