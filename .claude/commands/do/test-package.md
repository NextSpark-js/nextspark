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
  - "I'll provide one" → Then ask for the connection string
  - "Use localhost default" → postgresql://postgres:postgres@localhost:5432/nextspark_test
```

#### 1.3 Confirm database reset

Use **AskUserQuestion** tool:
```
Question: "This test will run migrations and seed data. Can I reset/modify this database?"
Header: "DB Reset"
Options:
  - "Yes, reset it completely" (Recommended) → Will drop and recreate tables
  - "No, just run migrations" → Only apply new migrations, keep existing data
  - "Cancel" → Stop the test
```

#### 1.4 Set variables

```
DATABASE_URL=<from user input or default>
CAN_RESET_DB=<true/false based on user choice>
TEST_PORT=3005
REPO_ROOT=<absolute path to repo/ folder>
PROJECTS_DIR=<absolute path to projects/ folder>
TEST_DIR=$PROJECTS_DIR/test-package
```

---

### Step 2: Kill Any Process on Test Port

```bash
# Windows (Git Bash):
netstat -ano 2>/dev/null | grep ":3005" | head -1 | awk '{print $5}' | xargs -I {} taskkill /F /PID {} 2>/dev/null || true

# Linux/Mac:
lsof -ti:3005 | xargs kill -9 2>/dev/null || true
```

---

### Step 3: Build and Pack ALL Packages

**CRITICAL:** Must rebuild to include latest code changes.

```bash
# Core package
cd $REPO_ROOT/packages/core
pnpm build:js
rm -f nextsparkjs-core-*.tgz
pnpm pack

# CLI package
cd $REPO_ROOT/packages/cli
pnpm build
rm -f nextsparkjs-cli-*.tgz
pnpm pack

# Testing package
cd $REPO_ROOT/packages/testing
pnpm build
rm -f nextsparkjs-testing-*.tgz
pnpm pack
```

**Verify:** All three `.tgz` files exist. Get their absolute paths.

---

### Step 4: Clean Previous Test Project

```bash
rm -rf $TEST_DIR
```

---

### Step 5: Create Fresh Next.js App

**This simulates what a real npm user does:**

```bash
cd $PROJECTS_DIR
npx create-next-app@latest test-package --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --turbopack=false --yes
```

**Verify:** `$TEST_DIR/package.json` exists.

---

### Step 6: Install NextSpark Packages

```bash
cd $TEST_DIR

# Install core and CLI from tarballs
pnpm add $CORE_TGZ_PATH $CLI_TGZ_PATH

# Install testing as devDependency
pnpm add -D $TESTING_TGZ_PATH
```

**Verify:** `node_modules/@nextsparkjs/core` and `node_modules/@nextsparkjs/cli` exist.

---

### Step 7: Run NextSpark Init (CRITICAL CLI TEST)

**This is the key test - the CLI init command that sets up everything:**

```bash
cd $TEST_DIR
npx nextspark init
```

This should:
- Copy theme structure to `contents/themes/`
- Create config files
- Set up app structure
- Configure i18n, auth, etc.

**Verify:**
- `contents/themes/` directory exists
- `app.config.ts` or similar config exists
- Theme files are in place

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
cd $TEST_DIR

# If user allowed reset, drop all tables first
if [ "$CAN_RESET_DB" = "true" ]; then
  npx nextspark db reset || echo "Reset not available, continuing with migrate..."
fi

npx nextspark db migrate
```

**Verify:** Command completes without errors.

---

### Step 10: Seed Database

```bash
cd $TEST_DIR

# Only seed if user allowed reset (otherwise data might conflict)
if [ "$CAN_RESET_DB" = "true" ]; then
  npx nextspark db seed || echo "Seed not available, continuing..."
else
  echo "Skipping seed (user chose not to reset database)"
fi
```

---

### Step 11: Build Registries

```bash
cd $TEST_DIR
npx nextspark registry build
```

**Verify:** `.nextspark/registries/` directory has generated files with NO path escaping errors (no `\v`, `\t` in strings).

---

### Step 12: Start Dev Server

```bash
cd $TEST_DIR
PORT=3005 npx next dev -p 3005 &
```

**Wait for server:** Poll `http://localhost:3005` until responsive (max 60 seconds).

---

### Step 13: Playwright MCP Verification

Use **mcp__playwright__** tools to verify the app works:

#### 13.1 Homepage
```
mcp__playwright__browser_navigate → http://localhost:3005
mcp__playwright__browser_snapshot → Verify page loads
```

#### 13.2 Login Page
```
mcp__playwright__browser_navigate → http://localhost:3005/login
mcp__playwright__browser_snapshot → Verify login form renders
```

#### 13.3 Signup Page
```
mcp__playwright__browser_navigate → http://localhost:3005/signup
mcp__playwright__browser_snapshot → Verify signup form renders
```

#### 13.4 Test DevKeyring Login (if devKeyring is configured)
```
mcp__playwright__browser_navigate → http://localhost:3005/login
# Look for devKeyring dropdown or test user buttons
# Click to login as test user
# Verify redirect to dashboard
```

#### 13.5 API Health Check
```
WebFetch → http://localhost:3005/api/auth/get-session
# Verify returns valid JSON response
```

---

### Step 14: Stop Dev Server

Kill process on port 3005.

---

### Step 15: Test Production Build

```bash
cd $TEST_DIR
rm -rf .next
npx next build
```

**Success criteria:**
- No TypeScript errors
- No import/export errors
- Build completes successfully

---

### Step 16: Final Report

Summarize all results:

```
## NPM Package Test Results

### Build Phase
- [ ] Core package built and packed
- [ ] CLI package built and packed
- [ ] Testing package built and packed

### Installation Phase
- [ ] create-next-app succeeded
- [ ] Packages installed from tarballs
- [ ] nextspark init completed ← CRITICAL

### Configuration Phase
- [ ] .env created with DATABASE_URL
- [ ] Migrations ran successfully
- [ ] Registries built (no path errors)

### Runtime Phase
- [ ] Dev server started
- [ ] Homepage loads
- [ ] Login page renders
- [ ] Signup page renders
- [ ] Auth API responds

### Production Phase
- [ ] Production build passed

### Overall: ✅ PASS / ❌ FAIL
```

---

## Error Handling

If ANY step fails:
1. **STOP immediately**
2. **Report exact error** with file/line if available
3. **Identify if it's a template issue** (fix in `repo/packages/core/templates/`)
4. **Do NOT continue** to next steps

---

## After Success

Package is ready for npm publish:

```bash
cd $REPO_ROOT
pnpm pkg:version -- patch  # or minor/major
pnpm pkg:publish
```

---

## What This Tests

| Component | Tested |
|-----------|--------|
| `@nextsparkjs/core` build | ✅ |
| `@nextsparkjs/cli` build | ✅ |
| `@nextsparkjs/testing` build | ✅ |
| Tarball installation | ✅ |
| `nextspark init` CLI command | ✅ |
| Database migrations | ✅ |
| Registry generation | ✅ |
| Path normalization (Windows) | ✅ |
| Dev server startup | ✅ |
| Page rendering | ✅ |
| Auth system | ✅ |
| Production build | ✅ |
