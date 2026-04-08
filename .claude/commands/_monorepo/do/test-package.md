---
description: "Test npm package from scratch - fully automated with agent-browser verification"
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

**CRITICAL:**
1. Must do a **CLEAN rebuild** to include latest code changes
2. **MUST use `pnpm pack`** (not `npm pack`) to properly resolve `workspace:*` dependencies

```bash
# UI package (dependency of core)
cd "${REPO_ROOT}/packages/ui"
rm -rf dist
pnpm build
rm -f *.tgz
pnpm pack                      # CRITICAL: Use pnpm pack, NOT npm pack

# Core package
cd "${REPO_ROOT}/packages/core"
rm -rf dist
pnpm build
rm -f *.tgz
pnpm pack                      # CRITICAL: Use pnpm pack to resolve workspace:* refs

# CLI package
cd "${REPO_ROOT}/packages/cli"
rm -rf dist
pnpm build
rm -f *.tgz
pnpm pack

# Testing package
cd "${REPO_ROOT}/packages/testing"
rm -rf dist
pnpm build
rm -f *.tgz
pnpm pack
```

**Why pnpm pack is required:** The core package uses `workspace:*` references (e.g., `@nextsparkjs/testing`). When using `pnpm pack`, these are automatically converted to actual version numbers (e.g., `0.1.0-beta.93`). Using `npm pack` leaves them as `workspace:*`, which causes `EUNSUPPORTEDPROTOCOL` errors during installation.

**Why clean builds matter:** Build tools like tsup may cache intermediate results. If source files changed but the cache wasn't invalidated, the packed tarball will contain old code. Always `rm -rf dist` before building to ensure fresh compilation.

**Verify all four `.tgz` files exist:**
```bash
UI_TGZ=$(ls "${REPO_ROOT}/packages/ui/"*.tgz 2>/dev/null | head -1)
CORE_TGZ=$(ls "${REPO_ROOT}/packages/core/"*.tgz 2>/dev/null | head -1)
CLI_TGZ=$(ls "${REPO_ROOT}/packages/cli/"*.tgz 2>/dev/null | head -1)
TESTING_TGZ=$(ls "${REPO_ROOT}/packages/testing/"*.tgz 2>/dev/null | head -1)

if [ -z "$UI_TGZ" ] || [ -z "$CORE_TGZ" ] || [ -z "$CLI_TGZ" ] || [ -z "$TESTING_TGZ" ]; then
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

**IMPORTANT:** Install UI first (dependency of core), then core+CLI, then testing.

```bash
cd "$TEST_DIR"

# Copy tarballs to project directory (avoids path issues on Windows)
cp "$UI_TGZ" "$CORE_TGZ" "$CLI_TGZ" "$TESTING_TGZ" ./

if [ "$IS_WINDOWS" = true ]; then
  # Install UI first (dependency of core)
  cmd.exe /c "npm install ./nextsparkjs-ui-*.tgz"

  # Install core and CLI from tarballs
  cmd.exe /c "npm install ./nextsparkjs-core-*.tgz ./nextsparkjs-cli-*.tgz"

  # Install testing as devDependency
  cmd.exe /c "npm install -D ./nextsparkjs-testing-*.tgz"

  # Install required peer dependency
  cmd.exe /c "npm install better-auth"
else
  npm install ./nextsparkjs-ui-*.tgz
  npm install ./nextsparkjs-core-*.tgz ./nextsparkjs-cli-*.tgz
  npm install -D ./nextsparkjs-testing-*.tgz
  npm install better-auth
fi
```

**Verify:**
```bash
ls -la node_modules/@nextsparkjs/ui
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

### Step 12: Browser Verification with agent-browser

Use **agent-browser** (CLI browser automation tool) to verify the app works end-to-end.
Uses accessibility tree snapshots (`snapshot -i`) and element refs (`@eN`) for interaction.

**Pre-requisite:** `agent-browser` must be installed (`npm i -g agent-browser`).

#### 12.1 Homepage & Auth Pages (curl pre-check)

Quick HTTP checks before launching the browser:
```bash
# Homepage
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3005/

# Login page
curl -s http://localhost:3005/login | grep -oE '<title>[^<]+</title>'

# Signup page
curl -s http://localhost:3005/signup | grep -oE '<title>[^<]+</title>'

# Dashboard (should redirect 307 to login when unauthenticated)
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3005/dashboard
```

**Expected:** Homepage 200, Login 200 (title "Sign In"), Signup 200 (title "Create Account"), Dashboard 307.

#### 12.2 Login via agent-browser

```bash
# Navigate to login page
agent-browser open http://localhost:3005/login
agent-browser wait --load networkidle
agent-browser snapshot -i
# Verify: heading "Sign in", textbox "Email", textbox "Password", button "Sign in", button "Dev Keyring"

# Fill login form with superadmin credentials from dev.config.ts
agent-browser fill @eEMAIL "superadmin@nextspark.dev"
agent-browser fill @ePASSWORD "Pandora1234"
agent-browser click @eSIGNIN   # button "Sign in"
agent-browser wait --load networkidle
agent-browser wait 3000
agent-browser snapshot -i
# Verify: Dashboard loaded with navigation sidebar (Tasks, Pages, Posts, Media links)
```

**IMPORTANT:** After `snapshot -i`, use the actual `ref=eN` values from the output. Refs change between snapshots.

#### 12.3 Entity CRUD Test: Tasks

**CRITICAL:** Test full CRUD operations to verify the data flow works end-to-end.

##### 12.3.1 Navigate to Tasks
```bash
agent-browser open http://localhost:3005/dashboard/tasks
agent-browser wait --load networkidle
agent-browser wait 3000
agent-browser snapshot -i
# Verify: heading "Tasks", link "Add task", heading "No tasks found" or table with data
```

##### 12.3.2 CREATE - Add New Task
```bash
# Click "Add task" link
agent-browser click @eADDTASK
agent-browser wait --load networkidle
agent-browser wait 3000
agent-browser snapshot -i
# Verify: heading "Create task", form fields: Title*, Description, Status, Priority, etc.

# Fill the form
agent-browser fill @eTITLE "NPM Package Test Task"
agent-browser fill @eDESCRIPTION "Task created during NPM package test"

# Submit - use JS click on [data-cy="tasks-form-submit"] for reliability
agent-browser eval '(() => { const b = document.querySelector("[data-cy=\"tasks-form-submit\"]"); if(b){b.click();return "clicked"} return "not found" })()'
agent-browser wait 5000

# Verify redirect to detail page
agent-browser get url   # Should be /dashboard/tasks/<uuid>
agent-browser snapshot -i
# Verify: heading "NPM Package Test Task", button "Edit", button "Delete"
```

**NOTE:** The `agent-browser click @ref` on form submit buttons may not trigger React form handlers reliably. Use `agent-browser eval` with `document.querySelector('[data-cy="...-form-submit"]').click()` as a fallback.

##### 12.3.3 READ - Verify Task Detail
```bash
agent-browser screenshot /tmp/test-task-detail.png
# Visually verify: Title, Description, Status "To Do", Priority "Medium", timestamps
```

##### 12.3.4 UPDATE - Edit Task
```bash
# Navigate directly to edit URL (more reliable than clicking Edit button)
agent-browser open http://localhost:3005/dashboard/tasks/<TASK_UUID>/edit
agent-browser wait --load networkidle
agent-browser wait 3000
agent-browser snapshot -i
# Verify: form pre-filled with current values, button "Save Changes"

# Update title
agent-browser fill @eTITLE "NPM Package Test Task - UPDATED"
agent-browser wait 500

# Submit via JS
agent-browser eval '(() => { const b = document.querySelector("[data-cy=\"tasks-form-submit\"]"); if(b){b.click();return "clicked"} return "not found" })()'
agent-browser wait 5000

# Verify redirect to detail page with updated title
agent-browser get url
agent-browser snapshot -i
# Verify: heading "NPM Package Test Task - UPDATED"
```

##### 12.3.5 DELETE - Remove Task
```bash
agent-browser snapshot -i
# Find Delete button ref
agent-browser click @eDELETE
agent-browser wait 1000
agent-browser snapshot -i
# Verify: confirmation dialog with heading "Delete", buttons "Cancel" and "Delete"

agent-browser click @eCONFIRM_DELETE
agent-browser wait 5000

# Verify redirect to list
agent-browser get url   # Should be /dashboard/tasks
agent-browser snapshot -i
# Verify: heading "No tasks found" (task was removed)
```

##### 12.3.6 Tasks CRUD Summary
All four operations must pass:
- **CREATE** - Form submission creates entity, redirects to detail page
- **READ** - Detail page shows correct data (title, description, status, priority)
- **UPDATE** - Edit form saves changes, title updated in detail view
- **DELETE** - Confirmation dialog removes entity, list shows empty state

#### 12.4 Entity CRUD Test: Pages + Page Builder URL

**CRITICAL:** Test Pages entity CRUD AND verify the page builder renders at the public slug URL.

##### 12.4.1 Navigate to Pages
```bash
agent-browser open http://localhost:3005/dashboard/pages
agent-browser wait --load networkidle
agent-browser wait 3000
agent-browser snapshot -i
# Verify: heading "Pages", link "Add page"
```

##### 12.4.2 CREATE - Add New Page
```bash
# Click "Add page" link
agent-browser click @eADDPAGE
agent-browser wait --load networkidle
agent-browser wait 3000
agent-browser snapshot -i
# Verify: heading "Create page", form fields: Title*, Slug, Content/Description, Status

# Fill the form
agent-browser fill @eTITLE "Test Landing Page"
agent-browser fill @eSLUG "test-landing"   # If slug field exists
# Note: slug may auto-generate from title. Check the form fields in snapshot.
# If there is a description/content field, fill it:
# agent-browser fill @eDESCRIPTION "This is a test landing page"

# Submit via JS
agent-browser eval '(() => { const b = document.querySelector("[data-cy=\"pages-form-submit\"]"); if(b){b.click();return "clicked"} return "not found" })()'
agent-browser wait 5000

# Verify redirect to detail page
agent-browser get url   # Should be /dashboard/pages/<uuid>
agent-browser snapshot -i
# Verify: heading "Test Landing Page", Edit and Delete buttons visible
# Note the slug value from the detail page for the public URL test
```

##### 12.4.3 READ - Verify Page Detail + PUBLIC URL
```bash
# Take screenshot of detail page
agent-browser screenshot /tmp/test-page-detail.png

# **KEY TEST: Verify the page renders at the public slug URL**
agent-browser open http://localhost:3005/test-landing
agent-browser wait --load networkidle
agent-browser wait 3000
agent-browser get url
agent-browser snapshot -i
# Verify:
#   - Page loads (NOT a 404)
#   - URL is http://localhost:3005/test-landing
#   - Page content renders (may show page builder blocks or basic content)
agent-browser screenshot /tmp/test-page-public.png
```

**This validates the full page builder pipeline:**
1. Entity created in dashboard -> saved to DB
2. Public route `[...slug]` resolves the page by slug
3. Page content/blocks render on the public URL

##### 12.4.4 UPDATE - Edit Page
```bash
# Navigate to edit page
agent-browser open http://localhost:3005/dashboard/pages/<PAGE_UUID>/edit
agent-browser wait --load networkidle
agent-browser wait 3000
agent-browser snapshot -i

# Update title
agent-browser fill @eTITLE "Test Landing Page - UPDATED"
agent-browser wait 500

# Submit
agent-browser eval '(() => { const b = document.querySelector("[data-cy=\"pages-form-submit\"]"); if(b){b.click();return "clicked"} return "not found" })()'
agent-browser wait 5000

# Verify update on detail page
agent-browser get url
agent-browser snapshot -i
# Verify: heading "Test Landing Page - UPDATED"

# **Re-check public URL still works after update**
agent-browser open http://localhost:3005/test-landing
agent-browser wait --load networkidle
agent-browser wait 3000
# Verify: page still renders (not 404)
```

##### 12.4.5 DELETE - Remove Page
```bash
# Navigate back to detail page
agent-browser open http://localhost:3005/dashboard/pages/<PAGE_UUID>
agent-browser wait --load networkidle
agent-browser wait 2000
agent-browser snapshot -i

# Click Delete
agent-browser click @eDELETE
agent-browser wait 1000
agent-browser snapshot -i
# Verify: confirmation dialog

agent-browser click @eCONFIRM_DELETE
agent-browser wait 5000

# Verify redirect to list
agent-browser get url   # Should be /dashboard/pages
agent-browser snapshot -i

# **Verify public URL now returns 404**
agent-browser open http://localhost:3005/test-landing
agent-browser wait --load networkidle
agent-browser wait 2000
agent-browser get url
agent-browser snapshot -i
# Verify: 404 page or "Not Found" (page was deleted)
```

##### 12.4.6 Pages CRUD + Page Builder Summary
All operations must pass:
- **CREATE** - Page created with slug "test-landing"
- **READ** - Detail page shows data; **PUBLIC URL `localhost:3005/test-landing` loads correctly**
- **UPDATE** - Title updated; public URL still works
- **DELETE** - Page removed; **public URL now returns 404**

#### 12.5 Superadmin Panel Verification

**Tests that the superadmin area loads correctly.** This is a core feature that could break silently.

```bash
agent-browser open http://localhost:3005/superadmin
agent-browser wait --load networkidle
agent-browser wait 3000
agent-browser snapshot -i
# Verify:
#   - Page loads (not 403/404/500)
#   - Heading "Super Admin" or similar admin title visible
#   - Navigation links visible (Users, Teams, Subscriptions, Docs, etc.)
agent-browser screenshot /tmp/test-superadmin.png
```

**Expected elements:** Links to Users, Teams, Subscriptions management. If the page shows "Permission Denied" or a 403, superadmin role detection is broken.

```bash
# Quick check: navigate to superadmin users list
agent-browser open http://localhost:3005/superadmin/users
agent-browser wait --load networkidle
agent-browser wait 3000
agent-browser snapshot -i
# Verify: User list renders with at least the superadmin and developer users
```

#### 12.6 DevTools Panel Verification

**Tests that the developer tools panel loads.** DevTools is critical for theme developers.

```bash
agent-browser open http://localhost:3005/devtools
agent-browser wait --load networkidle
agent-browser wait 3000
agent-browser snapshot -i
# Verify:
#   - Page loads (not 404/500)
#   - DevTools navigation visible (Config, Features, Flows, Tags, Tests, Blocks, API)
#   - Entity list or overview is displayed
agent-browser screenshot /tmp/test-devtools.png
```

```bash
# Check DevTools config page (shows entity configuration)
agent-browser open http://localhost:3005/devtools/config
agent-browser wait --load networkidle
agent-browser wait 3000
agent-browser snapshot -i
# Verify: Entity configuration visible (tasks, pages, posts, patterns)
```

```bash
# Check DevTools features page (shows feature registry)
agent-browser open http://localhost:3005/devtools/features
agent-browser wait --load networkidle
agent-browser wait 2000
agent-browser snapshot -i
# Verify: Feature registry loads without errors
```

#### 12.7 Search Functionality Test

**Tests that the global search works from the dashboard.**

```bash
# Navigate back to dashboard
agent-browser open http://localhost:3005/dashboard
agent-browser wait --load networkidle
agent-browser wait 2000
agent-browser snapshot -i

# Click the search combobox
agent-browser click @eSEARCH   # combobox "Search"
agent-browser wait 1000
agent-browser snapshot -i
# Verify: Search dialog/dropdown opens

# Type a search query (search for a known entity type)
agent-browser type @eSEARCH_INPUT "task"
agent-browser wait 2000
agent-browser snapshot -i
# Verify: Search results appear or "No results" message (both are valid - confirms search works)

# Press Escape to close search
agent-browser press Escape
```

#### 12.8 Close Browser

```bash
agent-browser close
```

#### 12.9 Full Verification Summary

| Test | Area | What it validates |
|------|------|-------------------|
| CREATE | Tasks | Entity form submission + API create |
| READ | Tasks | Detail page rendering + data display |
| UPDATE | Tasks | Edit form + API update + data persistence |
| DELETE | Tasks | Confirmation dialog + API delete + redirect |
| CREATE | Pages | Page creation with slug |
| READ (dashboard) | Pages | Page detail rendering |
| READ (public URL) | Pages | **Page builder pipeline: slug -> public render** |
| UPDATE | Pages | Edit persistence + public URL still works |
| DELETE | Pages | Deletion + **public URL returns 404** |
| Superadmin | Admin | Panel loads, users list renders |
| DevTools | Developer | Config, features, entity overview loads |
| Search | Dashboard | Global search opens and responds to input |

**If any operation fails:**
1. Check `agent-browser eval 'JSON.stringify(window._fetchLog)'` for API errors
2. Check `agent-browser screenshot /tmp/debug.png` for visual state
3. Verify database connection in .env
4. Check entity config in `contents/themes/starter/entities/`

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

### Build Phase (using pnpm pack)
- [ ] UI package built and packed (size: X KB)
- [ ] Core package built and packed (size: X MB)
- [ ] CLI package built and packed (size: X KB)
- [ ] Testing package built and packed (size: X KB)
- [ ] workspace:* references resolved correctly

### Installation Phase
- [ ] create-next-app succeeded (Next.js version: X.X.X)
- [ ] UI package installed (dependency of core)
- [ ] Packages installed from tarballs
- [ ] better-auth peer dependency installed
- [ ] nextspark init --registries-only completed
- [ ] nextspark sync:app completed
- [ ] Starter theme copied

### Configuration Phase
- [ ] .env created with DATABASE_URL
- [ ] Migrations ran successfully (X core + X entity)
- [ ] Registries built (X files, no path errors)

### Runtime Phase (agent-browser)
- [ ] Dev server started on port 3005
- [ ] Homepage loads (HTTP 200)
- [ ] Login page renders with form (title "Sign In")
- [ ] Signup page renders (title "Create Account")
- [ ] Login with superadmin credentials succeeds
- [ ] Dashboard loads with navigation sidebar

### CRUD Test Phase: Tasks Entity
- [ ] CREATE: Task created via form, redirected to detail
- [ ] READ: Detail page shows title, description, status, priority
- [ ] UPDATE: Title edited and persisted
- [ ] DELETE: Confirmation dialog, task removed

### CRUD Test Phase: Pages Entity + Page Builder
- [ ] CREATE: Page created with slug "test-landing"
- [ ] READ (dashboard): Detail page shows page data
- [ ] READ (public URL): `localhost:3005/test-landing` renders correctly
- [ ] UPDATE: Title updated, public URL still works
- [ ] DELETE: Page removed, public URL returns 404

### Admin & DevTools Phase
- [ ] Superadmin panel loads (`/superadmin`)
- [ ] Superadmin users list renders (`/superadmin/users`)
- [ ] DevTools panel loads (`/devtools`)
- [ ] DevTools config shows entities (`/devtools/config`)
- [ ] DevTools features page loads (`/devtools/features`)
- [ ] Global search opens and responds to input

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
| `EUNSUPPORTEDPROTOCOL: workspace:*` | Used `npm pack` instead of `pnpm pack` | **Always use `pnpm pack`** - it converts `workspace:*` to real versions |
| `Module not found: @nextsparkjs/ui` | UI package not installed | Install UI tarball before core: `npm install ./nextsparkjs-ui-*.tgz` |
| `Module not found: better-auth/next-js` | Missing peer dependency | `npm install better-auth` |
| `Cannot find module 'cypress'` | Tests not excluded | Ensure tsconfig.json has `**/tests/**` in exclude |
| `@nextsparkjs/registries` not found | Missing webpack alias | Ensure `next.config.mjs` was synced |
| CSP violation errors | Wrong APP_URL | Update `NEXT_PUBLIC_APP_URL` to match actual port |
| npm/npx silent on Windows | Git Bash compatibility | Use `cmd.exe /c "npm ..."` wrapper |
| `.next/dev/lock` error | Stale lock from crashed server | `rm -rf .next` and restart |
| Root config files not synced (i18n.ts, tsconfig.json, etc.) | Stale CLI build cache | `rm -rf dist && pnpm build` before packing |
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
| `@nextsparkjs/ui` build & pack | Yes |
| `@nextsparkjs/core` build & pack | Yes |
| `@nextsparkjs/cli` build & pack | Yes |
| `@nextsparkjs/testing` build & pack | Yes |
| `workspace:*` resolution (pnpm pack) | Yes |
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
| Page rendering (agent-browser) | Yes |
| Auth system UI (login form) | Yes |
| Login with credentials | Yes |
| Dashboard navigation | Yes |
| Entity CRUD - Tasks | Yes |
| Entity CRUD - Pages | Yes |
| Page Builder public URL rendering | Yes |
| Page Builder URL 404 after delete | Yes |
| Superadmin panel + users list | Yes |
| DevTools panel + config + features | Yes |
| Global search functionality | Yes |
| API endpoints (via CRUD forms) | Yes |
| Production build | Yes |

---

## Cleanup

After testing, optionally clean up:

```bash
# Remove test project
rm -rf "$TEST_DIR"

# Remove tarballs (optional - keep for re-testing)
rm -f "${REPO_ROOT}/packages/ui/"*.tgz
rm -f "${REPO_ROOT}/packages/core/"*.tgz
rm -f "${REPO_ROOT}/packages/cli/"*.tgz
rm -f "${REPO_ROOT}/packages/testing/"*.tgz
```
