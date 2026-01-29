---
description: "Test npm package from scratch - fully automated with Playwright verification"
---

# do:test-package

**Input:** {{{ input }}}

---

## Fully Automated NPM Package Test

Tests the **REAL npm user experience** from scratch. Simulates exactly what a new user does when installing NextSpark from npm.

**Usage:**
```
/do:test-package DATABASE_URL="postgresql://user:pass@host:5432/dbname?sslmode=disable"
```

---

## Step 0: Environment Detection & Setup

**CRITICAL:** Before running any commands, detect the environment and set up command aliases.

### 0.1 Detect Operating System

```bash
# Check if running on Windows (Git Bash, MSYS, Cygwin)
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ -n "$WINDIR" ]]; then
  IS_WINDOWS=true
else
  IS_WINDOWS=false
fi
```

### 0.2 Set Command Aliases for Cross-Platform Compatibility

**On Windows with Git Bash**, npm/npx/pnpm may produce no output or fail silently.
Use `.cmd` extension to invoke the batch file wrappers:

```bash
if [ "$IS_WINDOWS" = true ]; then
  # Windows: Find the actual .cmd location and use it
  NPM_PATH=$(which npm 2>/dev/null)
  if [ -n "$NPM_PATH" ]; then
    NPM_CMD="${NPM_PATH}.cmd"
    NPX_CMD="${NPM_PATH/npm/npx}.cmd"
  else
    # Fallback: try cmd.exe invocation
    NPM_CMD="cmd.exe /c npm"
    NPX_CMD="cmd.exe /c npx"
  fi
else
  # Linux/Mac: Use commands directly
  NPM_CMD="npm"
  NPX_CMD="npx"
fi
```

**Alternative for Claude Code:** Use Bash tool with `cmd.exe /c` wrapper on Windows:
```bash
# Windows reliable approach:
cmd.exe /c "npm pack"
cmd.exe /c "npx create-next-app@latest ..."

# Linux/Mac:
npm pack
npx create-next-app@latest ...
```

### 0.3 Set Project Variables

```bash
# Detect repo root (adjust based on where this runs)
REPO_ROOT=$(cd "$(dirname "$0")/../../../.." && pwd)  # Or use absolute path
PROJECTS_DIR="${REPO_ROOT}/../projects"
TEST_DIR="${PROJECTS_DIR}/test-package"
TEST_PORT=3005
```

---

## EXECUTE ALL STEPS AUTOMATICALLY

### Step 1: Parse Input & Database Configuration

#### 1.1 Extract DATABASE_URL from input

Look for `DATABASE_URL="..."` in the input string.

#### 1.2 If DATABASE_URL not found, ASK THE USER:

Use **AskUserQuestion** tool:
```
Question: "What DATABASE_URL should I use for testing?"
Header: "Database"
Options:
  - "I'll provide one" -> Then ask for the connection string
  - "Use localhost default" -> postgresql://postgres:postgres@localhost:5432/nextspark_test
```

#### 1.3 Confirm database reset

Use **AskUserQuestion** tool:
```
Question: "This test will run migrations and seed data. Can I reset/modify this database?"
Header: "DB Reset"
Options:
  - "Yes, reset it completely" (Recommended) -> Will drop and recreate tables
  - "No, just run migrations" -> Only apply new migrations, keep existing data
  - "Cancel" -> Stop the test
```

---

### Step 2: Kill Any Process on Test Port

```bash
if [ "$IS_WINDOWS" = true ]; then
  # Windows: Find PID and kill via cmd.exe
  PID=$(netstat -ano 2>/dev/null | grep ":${TEST_PORT}" | head -1 | awk '{print $5}')
  if [ -n "$PID" ] && [ "$PID" != "0" ]; then
    cmd.exe /c "taskkill /F /PID $PID" 2>/dev/null || true
  fi
else
  # Linux/Mac
  lsof -ti:${TEST_PORT} 2>/dev/null | xargs kill -9 2>/dev/null || true
fi
```

---

### Step 3: Build and Pack ALL Packages

**CRITICAL:** Must do a **CLEAN rebuild** to include latest code changes. Stale build caches can cause the packed tarball to contain outdated code even when source files are correct.

```bash
# Core package
cd "${REPO_ROOT}/packages/core"
rm -rf dist                    # IMPORTANT: Clean dist to prevent stale cache
pnpm build:js
rm -f *.tgz
$NPM_CMD pack
# Or on Windows: cmd.exe /c "npm pack"

# CLI package
cd "${REPO_ROOT}/packages/cli"
rm -rf dist                    # IMPORTANT: Clean dist to prevent stale cache
pnpm build
rm -f *.tgz
$NPM_CMD pack

# Testing package
cd "${REPO_ROOT}/packages/testing"
rm -rf dist                    # IMPORTANT: Clean dist to prevent stale cache
pnpm build
rm -f *.tgz
$NPM_CMD pack
```

**Why clean builds matter:** Build tools like tsup may cache intermediate results. If source files changed but the cache wasn't invalidated, the packed tarball will contain old code. Always `rm -rf dist` before building to ensure fresh compilation.

**Verify all three `.tgz` files exist:**
```bash
CORE_TGZ=$(ls "${REPO_ROOT}/packages/core/"*.tgz 2>/dev/null | head -1)
CLI_TGZ=$(ls "${REPO_ROOT}/packages/cli/"*.tgz 2>/dev/null | head -1)
TESTING_TGZ=$(ls "${REPO_ROOT}/packages/testing/"*.tgz 2>/dev/null | head -1)

if [ -z "$CORE_TGZ" ] || [ -z "$CLI_TGZ" ] || [ -z "$TESTING_TGZ" ]; then
  echo "ERROR: Not all tarballs were created"
  exit 1
fi
```

---

### Step 4: Clean Previous Test Project

```bash
rm -rf "$TEST_DIR"
```

---

### Step 5: Create Fresh Next.js App

**This simulates what a real npm user does:**

```bash
cd "$PROJECTS_DIR"

if [ "$IS_WINDOWS" = true ]; then
  cmd.exe /c "npx create-next-app@latest test-package --typescript --tailwind --eslint --app --src-dir=false --import-alias=@/* --turbopack=false --yes"
else
  npx create-next-app@latest test-package \
    --typescript --tailwind --eslint --app \
    --src-dir=false --import-alias="@/*" \
    --turbopack=false --yes
fi
```

**Verify:** `$TEST_DIR/package.json` exists.

---

### Step 6: Install NextSpark Packages + Peer Dependencies

```bash
cd "$TEST_DIR"

if [ "$IS_WINDOWS" = true ]; then
  # Install core and CLI from tarballs
  cmd.exe /c "npm install \"$CORE_TGZ\" \"$CLI_TGZ\""

  # Install testing as devDependency
  cmd.exe /c "npm install -D \"$TESTING_TGZ\""

  # Install required peer dependency
  cmd.exe /c "npm install better-auth"
else
  npm install "$CORE_TGZ" "$CLI_TGZ"
  npm install -D "$TESTING_TGZ"
  npm install better-auth
fi
```

**Verify:**
```bash
ls -la node_modules/@nextsparkjs/core
ls -la node_modules/@nextsparkjs/cli
ls -la node_modules/@nextsparkjs/testing
ls -la node_modules/better-auth
```

---

### Step 7: Initialize NextSpark (Multi-Step Process)

**IMPORTANT:** The init process has multiple steps due to interactive wizard limitations.

#### 7.1 Initialize registries
```bash
cd "$TEST_DIR"

if [ "$IS_WINDOWS" = true ]; then
  cmd.exe /c "npx nextspark init --registries-only"
else
  npx nextspark init --registries-only
fi
```

#### 7.2 Sync app folder and root config files
```bash
if [ "$IS_WINDOWS" = true ]; then
  cmd.exe /c "npx nextspark sync:app --force"
else
  npx nextspark sync:app --force
fi
```

This syncs:
- All `/app` template files
- `middleware.ts` - Required for permission validation
- `next.config.mjs` - Required for webpack aliases and security headers
- `tsconfig.json` - Required for path aliases and test exclusions
- `i18n.ts` - Required for next-intl

#### 7.3 Copy starter theme
```bash
mkdir -p contents/themes
cp -r node_modules/@nextsparkjs/core/templates/contents/themes/starter contents/themes/starter
```

**Verify:**
```bash
ls -la contents/themes/starter/
ls -la .nextspark/registries/
ls -la next.config.mjs
ls -la middleware.ts
ls -la tsconfig.json
```

---

### Step 8: Create .env with User's DATABASE_URL

Use **Write tool** to create `$TEST_DIR/.env`:

```env
# Database - From user input
DATABASE_URL="<USER_PROVIDED_DATABASE_URL>"

# Authentication
BETTER_AUTH_SECRET=test_secret_2e205f79e4b0b8a061e79af9da52f1010ffe923a

# Theme
NEXT_PUBLIC_ACTIVE_THEME="starter"

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3005"
NODE_ENV="development"
PORT=3005

# Email Provider (dummy for build - devKeyring handles login)
RESEND_API_KEY=re_dummy_key_for_build_only

# Cypress
CYPRESS_BASE_URL=http://localhost:3005
CYPRESS_TEST_PASSWORD=Test1234
CYPRESS_SUPERADMIN_EMAIL=superadmin@nextspark.dev
CYPRESS_SUPERADMIN_PASSWORD=Pandora1234
CYPRESS_OWNER_EMAIL=carlos.mendoza@tmt.dev
```

---

### Step 9: Run Database Migrations

```bash
cd "$TEST_DIR"

if [ "$IS_WINDOWS" = true ]; then
  cmd.exe /c "npx nextspark db:migrate"
else
  npx nextspark db:migrate
fi
```

**Verify:** Command completes without errors. Should show:
- Phase 1: Core migrations (20 files)
- Phase 2: Entity migrations (varies by theme)

---

### Step 10: Build Registries

```bash
cd "$TEST_DIR"

if [ "$IS_WINDOWS" = true ]; then
  cmd.exe /c "npx nextspark registry:build"
else
  npx nextspark registry:build
fi
```

**Verify:**
```bash
ls -la .nextspark/registries/*.ts
```

Should have 20+ registry files. Check for NO path escaping errors (no `\v`, `\t` in file paths).

---

### Step 11: Start Dev Server

```bash
cd "$TEST_DIR"
rm -rf .next  # Clean any stale cache

if [ "$IS_WINDOWS" = true ]; then
  # Start in background - Windows
  cmd.exe /c "start /B npx next dev -p $TEST_PORT" &
else
  npx next dev -p $TEST_PORT &
fi
```

**Wait for server:** Poll until responsive (max 60 seconds):
```bash
for i in {1..60}; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${TEST_PORT}/" 2>/dev/null)
  if [ "$HTTP_CODE" = "200" ]; then
    echo "Server ready!"
    break
  fi
  sleep 1
done
```

---

### Step 12: Playwright MCP Verification

Use **mcp__playwright__** tools to verify the app works:

#### 12.1 Homepage
```
mcp__playwright__browser_navigate -> http://localhost:3005
mcp__playwright__browser_snapshot -> Verify page loads (title should be "NextSpark App" or similar)
```

#### 12.2 Login Page
```
mcp__playwright__browser_navigate -> http://localhost:3005/login
mcp__playwright__browser_snapshot -> Verify:
  - Title contains "Sign In" or "Login"
  - Login form elements visible
  - "Dev Keyring" button visible (in development)
```

#### 12.3 Signup Page
```
mcp__playwright__browser_navigate -> http://localhost:3005/signup
mcp__playwright__browser_snapshot -> Verify signup form renders
```

#### 12.4 Dashboard (requires login)
```
# Click Dev Keyring button
# Select a test user
# Verify redirect to /dashboard
```

#### 12.5 Check for Console Errors
```
mcp__playwright__browser_console_messages -> Check for errors
```

**Acceptable errors:**
- CSP warnings (if NEXT_PUBLIC_APP_URL doesn't match port)
- Missing i18n messages (non-critical)

**Fail on:**
- Module not found errors
- TypeScript errors
- Build errors

---

### Step 13: Stop Dev Server

```bash
if [ "$IS_WINDOWS" = true ]; then
  PID=$(netstat -ano 2>/dev/null | grep ":${TEST_PORT}" | head -1 | awk '{print $5}')
  if [ -n "$PID" ] && [ "$PID" != "0" ]; then
    cmd.exe /c "taskkill /F /PID $PID" 2>/dev/null || true
  fi
else
  lsof -ti:${TEST_PORT} 2>/dev/null | xargs kill -9 2>/dev/null || true
fi
```

---

### Step 14: Test Production Build (CRITICAL)

```bash
cd "$TEST_DIR"
rm -rf .next

if [ "$IS_WINDOWS" = true ]; then
  cmd.exe /c "npx next build"
else
  npx next build
fi
```

**Success criteria:**
- "Compiled successfully" message
- No TypeScript errors
- No module resolution errors
- Build completes with exit code 0

**Check output for:**
- Route list showing all pages
- No "Module not found" errors
- No "Type error" messages

---

### Step 15: Final Report

Summarize all results:

```markdown
## NPM Package Test Results

### Build Phase
- [ ] Core package built and packed (size: X MB)
- [ ] CLI package built and packed (size: X KB)
- [ ] Testing package built and packed (size: X KB)

### Installation Phase
- [ ] create-next-app succeeded (Next.js version: X.X.X)
- [ ] Packages installed from tarballs
- [ ] better-auth peer dependency installed
- [ ] nextspark init --registries-only completed
- [ ] nextspark sync:app completed
- [ ] Starter theme copied

### Configuration Phase
- [ ] .env created with DATABASE_URL
- [ ] Migrations ran successfully (X core + X entity)
- [ ] Registries built (X files, no path errors)

### Runtime Phase
- [ ] Dev server started on port 3005
- [ ] Homepage loads (HTTP 200)
- [ ] Login page renders with form
- [ ] Signup page renders
- [ ] No critical console errors

### Production Phase
- [ ] Production build passed
- [ ] All routes compiled
- [ ] No TypeScript errors

### Overall: PASS / FAIL
```

---

## Error Handling

If ANY step fails:

1. **STOP immediately**
2. **Report exact error** with file/line if available
3. **Identify root cause:**
   - Template issue -> Fix in `repo/packages/core/templates/`
   - CLI issue -> Fix in `repo/packages/cli/src/`
   - Core issue -> Fix in `repo/packages/core/src/`
4. **Do NOT continue** to next steps

### Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| `Module not found: better-auth/next-js` | Missing peer dependency | `npm install better-auth` |
| `Cannot find module 'cypress'` | Tests not excluded | Ensure tsconfig.json has `**/tests/**` in exclude |
| `@nextsparkjs/registries` not found | Missing webpack alias | Ensure `next.config.mjs` was synced |
| CSP violation errors | Wrong APP_URL | Update `NEXT_PUBLIC_APP_URL` to match actual port |
| npm/npx silent on Windows | Git Bash compatibility | Use `cmd.exe /c "npm ..."` wrapper |
| `.next/dev/lock` error | Stale lock from crashed server | `rm -rf .next` and restart |
| Root config files not synced (i18n.ts, tsconfig.json, etc.) | Stale CLI build cache | `rm -rf dist && pnpm build` before `npm pack` |
| Tarball contains old code despite source changes | Build cache not invalidated | Always `rm -rf dist` before building each package |

---

## After Success

Package is ready for npm publish:

```bash
cd "$REPO_ROOT"
pnpm pkg:version -- patch  # or minor/major
pnpm pkg:publish
```

---

## What This Tests

| Component | Tested |
|-----------|--------|
| `@nextsparkjs/core` build & pack | Yes |
| `@nextsparkjs/cli` build & pack | Yes |
| `@nextsparkjs/testing` build & pack | Yes |
| Tarball installation | Yes |
| `nextspark init` CLI command | Yes |
| `nextspark sync:app` CLI command | Yes |
| `nextspark db:migrate` CLI command | Yes |
| `nextspark registry:build` CLI command | Yes |
| Theme copying | Yes |
| Database migrations | Yes |
| Registry generation | Yes |
| Path normalization (Windows) | Yes |
| Dev server startup | Yes |
| Page rendering | Yes |
| Auth system UI | Yes |
| Production build | Yes |

---

## Cleanup

After testing, optionally clean up:

```bash
# Remove test project
rm -rf "$TEST_DIR"

# Remove tarballs (optional - keep for re-testing)
rm -f "${REPO_ROOT}/packages/core/"*.tgz
rm -f "${REPO_ROOT}/packages/cli/"*.tgz
rm -f "${REPO_ROOT}/packages/testing/"*.tgz
```
