---
description: "Test npm package from scratch - fully automated with agent-browser verification"
---

# do:test-package

**Input:** {{{ input }}}

---

## Fully Automated Local Package Test

Tests the **REAL user experience** from scratch using 100% LOCAL code. Simulates exactly what a new user does when running `npx create-nextspark-app`, but using locally built packages instead of npm.

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
  NPM_CMD="cmd.exe /c npm"
  NPX_CMD="cmd.exe /c npx"
  PNPM_CMD="cmd.exe /c pnpm"
else
  NPM_CMD="npm"
  NPX_CMD="npx"
  PNPM_CMD="pnpm"
fi
```

### 0.3 Set Project Variables

```bash
REPO_ROOT="/path/to/nextspark/repo"         # Adjust to actual repo path
PROJECTS_DIR="${REPO_ROOT}/../projects"
TEST_DIR="${PROJECTS_DIR}/test-package"
PACKAGES_DIR="${REPO_ROOT}/.packages"         # Local tarballs directory
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
  PID=$(netstat -ano 2>/dev/null | grep ":${TEST_PORT}" | head -1 | awk '{print $5}')
  if [ -n "$PID" ] && [ "$PID" != "0" ]; then
    cmd.exe /c "taskkill /F /PID $PID" 2>/dev/null || true
  fi
else
  lsof -ti:${TEST_PORT} 2>/dev/null | xargs kill -9 2>/dev/null || true
fi
```

---

### Step 3: Build and Pack ALL Packages (100% Local)

**CRITICAL:**
1. Must do a **CLEAN rebuild** (`rm -rf dist`) to include latest code changes
2. **MUST use `pnpm pack`** (not `npm pack`) to properly resolve `workspace:*` dependencies
3. Copy ALL tarballs to `$REPO_ROOT/.packages/` so `create-nextspark-app` finds them

```bash
# Clean the .packages directory first
rm -rf "$PACKAGES_DIR"
mkdir -p "$PACKAGES_DIR"

# UI package (dependency of core)
cd "${REPO_ROOT}/packages/ui"
rm -rf dist && pnpm build && rm -f *.tgz && pnpm pack
cp *.tgz "$PACKAGES_DIR/"

# Core package
cd "${REPO_ROOT}/packages/core"
rm -rf dist && pnpm build && rm -f *.tgz && pnpm pack
cp *.tgz "$PACKAGES_DIR/"

# CLI package
cd "${REPO_ROOT}/packages/cli"
rm -rf dist && pnpm build && rm -f *.tgz && pnpm pack
cp *.tgz "$PACKAGES_DIR/"

# Testing package
cd "${REPO_ROOT}/packages/testing"
rm -rf dist && pnpm build && rm -f *.tgz && pnpm pack
cp *.tgz "$PACKAGES_DIR/"

# create-nextspark-app (THE LOCAL CREATE COMMAND)
cd "${REPO_ROOT}/packages/create-nextspark-app"
rm -rf dist && pnpm build && rm -f *.tgz && pnpm pack
cp *.tgz "$PACKAGES_DIR/"
```

**Why pnpm pack is required:** The core package uses `workspace:*` references (e.g., `@nextsparkjs/testing`). When using `pnpm pack`, these are automatically converted to actual version numbers (e.g., `0.1.0-beta.93`). Using `npm pack` leaves them as `workspace:*`, which causes `EUNSUPPORTEDPROTOCOL` errors during installation.

**Why clean builds matter:** Build tools like tsup may cache intermediate results. If source files changed but the cache wasn't invalidated, the packed tarball will contain old code. Always `rm -rf dist` before building to ensure fresh compilation.

**Verify all tarballs exist in .packages/:**
```bash
ls -la "$PACKAGES_DIR/"*.tgz

# Should show at minimum:
#   nextsparkjs-ui-*.tgz
#   nextsparkjs-core-*.tgz
#   nextsparkjs-cli-*.tgz
#   nextsparkjs-testing-*.tgz
#   create-nextspark-app-*.tgz
```

**Post-build verification (prevents stale dist bugs):**
```bash
# Verify CLI bundle does NOT contain stale PROTECTED_APP_FILES
if grep -q "PROTECTED_APP_FILES" "${REPO_ROOT}/packages/cli/dist/cli.js" 2>/dev/null; then
  echo "ERROR: CLI dist contains stale PROTECTED_APP_FILES — dist was not rebuilt properly"
  exit 1
fi
echo "CLI dist verification passed"
```

---

### Step 4: Clean Previous Test Project

```bash
rm -rf "$TEST_DIR"
```

---

### Step 5: Create Project Using Local create-nextspark-app

**This uses the locally built `create-nextspark-app` which:**
- Creates a minimal `package.json` (no create-next-app download)
- Looks for tarballs in `.packages/` directory automatically
- Installs `@nextsparkjs/core` and `@nextsparkjs/cli` from local tarballs
- Runs `npx nextspark init` wizard

```bash
cd "$PROJECTS_DIR"

# Run create-nextspark-app from local tarball with --yes for non-interactive
# The --theme flag selects the starter theme
node "${REPO_ROOT}/packages/create-nextspark-app/dist/index.js" test-package \
  --theme starter \
  --yes
```

**Alternative (if dist not usable directly):**
```bash
cd "$PROJECTS_DIR"
npx --yes "${PACKAGES_DIR}/create-nextspark-app-"*.tgz test-package \
  --theme starter \
  --yes
```

**What this does automatically:**
1. Creates `test-package/` directory
2. Writes minimal `package.json`
3. Finds tarballs in `$REPO_ROOT/.packages/` (via `findLocalTarball`)
4. Installs `@nextsparkjs/core` + `@nextsparkjs/cli` from local tarballs
5. Runs `npx nextspark init --theme starter --yes`

**Verify:**
```bash
ls "$TEST_DIR/package.json"
ls "$TEST_DIR/node_modules/@nextsparkjs/core"
ls "$TEST_DIR/node_modules/@nextsparkjs/cli"
ls "$TEST_DIR/app/layout.tsx"
ls "$TEST_DIR/.nextspark/registries/"
```

**If create-nextspark-app doesn't handle all steps**, complete manually:

```bash
cd "$TEST_DIR"

# Install UI (dependency of core) if not already installed
npm install "${PACKAGES_DIR}/nextsparkjs-ui-"*.tgz 2>/dev/null || true

# Install testing as devDependency
npm install -D "${PACKAGES_DIR}/nextsparkjs-testing-"*.tgz

# Install required peer dependency
npm install better-auth

# If init didn't run, do it manually:
npx nextspark init --registries-only
npx nextspark sync:app --force

# Copy starter theme if not already present
if [ ! -d "contents/themes/starter" ]; then
  mkdir -p contents/themes
  cp -r node_modules/@nextsparkjs/core/templates/contents/themes/starter contents/themes/starter
fi
```

---

### Step 6: Create .env with User's DATABASE_URL

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

### Step 7: Run Database Migrations

```bash
cd "$TEST_DIR"
npx nextspark db:migrate
```

**Verify:** Command completes without errors. Should show:
- Phase 1: Core migrations (20+ files)
- Phase 2: Entity migrations (varies by theme)

---

### Step 8: Build Registries

```bash
cd "$TEST_DIR"
npx nextspark registry:build
```

**Verify:**
```bash
ls -la .nextspark/registries/*.ts
```

Should have 20+ registry files. Check for NO path escaping errors (no `\v`, `\t` in file paths).

---

### Step 9: Start Dev Server

```bash
cd "$TEST_DIR"
rm -rf .next  # Clean any stale cache
npx next dev -p $TEST_PORT &
```

**Wait for server:** Poll until responsive (max 60 seconds):
```bash
for i in {1..60}; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${TEST_PORT}/" 2>/dev/null)
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "307" ]; then
    echo "Server ready!"
    break
  fi
  sleep 1
done
```

---

### Step 10: Browser Verification with agent-browser

Use **agent-browser** (CLI browser automation tool) to verify the app works end-to-end.
Uses accessibility tree snapshots (`snapshot -i`) and element refs (`@eN`) for interaction.

**Pre-requisite:** `agent-browser` must be installed (`npm i -g agent-browser`).

#### 10.1 Homepage & Auth Pages (curl pre-check)

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

#### 10.2 Login via agent-browser

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

**If login button click doesn't work via ref**, use JS fallback:
```bash
agent-browser eval '(() => { document.querySelector("form")?.requestSubmit(); return "submitted" })()'
```

#### 10.3 Entity CRUD Test: Tasks

**CRITICAL:** Test full CRUD operations to verify the data flow works end-to-end.

##### 10.3.1 Navigate to Tasks
```bash
agent-browser open http://localhost:3005/dashboard/tasks
agent-browser wait --load networkidle
agent-browser wait 3000
agent-browser snapshot -i
# Verify: heading "Tasks", link "Add task", heading "No tasks found" or table with data
```

##### 10.3.2 CREATE - Add New Task
```bash
# Navigate directly to create URL (more reliable than clicking link)
agent-browser open http://localhost:3005/dashboard/tasks/create
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

##### 10.3.3 READ - Verify Task Detail
```bash
agent-browser screenshot /tmp/test-task-detail.png
# Visually verify: Title, Description, Status "To Do", Priority "Medium", timestamps
```

##### 10.3.4 UPDATE - Edit Task
```bash
# Navigate directly to edit URL (more reliable than clicking Edit button)
agent-browser open http://localhost:3005/dashboard/tasks/<TASK_UUID>/edit
agent-browser wait --load networkidle
agent-browser wait 3000
agent-browser snapshot -i
# Verify: form pre-filled with current values

# Update title - clear first, then fill
agent-browser eval '(() => { const el = document.querySelector("input[name=\"title\"]"); if(el){el.focus();el.value="";el.dispatchEvent(new Event("input",{bubbles:true}));return "cleared"} return "not found" })()'
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

##### 10.3.5 DELETE - Remove Task
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

##### 10.3.6 Tasks CRUD Summary
All four operations must pass:
- **CREATE** - Form submission creates entity, redirects to detail page
- **READ** - Detail page shows correct data (title, description, status, priority)
- **UPDATE** - Edit form saves changes, title updated in detail view
- **DELETE** - Confirmation dialog removes entity, list shows empty state

#### 10.4 Entity CRUD Test: Pages + Page Builder URL

**CRITICAL:** Test Pages entity CRUD AND verify the page builder renders at the public slug URL.

##### 10.4.1 CREATE - Add New Page
```bash
agent-browser open http://localhost:3005/dashboard/pages/create
agent-browser wait --load networkidle
agent-browser wait 3000
agent-browser snapshot -i
# Verify: page builder editor with title input, slug input, Publish button

# Fill title (slug auto-generates)
agent-browser fill @eTITLE "Test Landing Page"
agent-browser wait 1000

# Check auto-generated slug
agent-browser eval '(() => { const el = document.querySelector("input[placeholder=\"url-slug\"]"); return el?.value || "no slug" })()'
# Expected: "test-landing-page"

# Click Publish
agent-browser click @ePUBLISH
agent-browser wait 5000

# Verify redirect to edit page
agent-browser get url   # Should be /dashboard/pages/<uuid>/edit
```

##### 10.4.2 READ - Verify PUBLIC URL
```bash
# Get the slug from the edit page
SLUG=$(agent-browser eval '(() => { const el = document.querySelector("input[placeholder=\"url-slug\"]"); return el?.value || "" })()')

# **KEY TEST: Verify the page renders at the public slug URL**
agent-browser open http://localhost:3005/${SLUG}
agent-browser wait --load networkidle
agent-browser wait 3000
agent-browser get url
agent-browser snapshot -i
# Verify:
#   - Page loads (NOT a 404)
#   - Page content renders (page builder blocks or basic content)
```

**This validates the full page builder pipeline:**
1. Entity created in dashboard -> saved to DB
2. Public route `[...slug]` resolves the page by slug
3. Page content/blocks render on the public URL

##### 10.4.3 DELETE - Remove Page (via list bulk action)
```bash
agent-browser open http://localhost:3005/dashboard/pages
agent-browser wait --load networkidle
agent-browser wait 3000

# Select the page row checkbox
agent-browser eval '(() => { const rows = document.querySelectorAll("tr"); for (const r of rows) { if (r.textContent?.includes("Test Landing")) { const cb = r.querySelector("input[type=checkbox], button[role=checkbox]"); if(cb){cb.click();return "checked"} } } return "not found"; })()'
agent-browser wait 1000

# Click Delete button (appears after selection)
agent-browser snapshot -i
# Find and click Delete button
agent-browser click @eDELETE
agent-browser wait 1000

# Confirm deletion dialog
agent-browser snapshot -i
agent-browser click @eCONFIRM_DELETE
agent-browser wait 5000

# **Verify public URL now returns 404**
agent-browser open http://localhost:3005/${SLUG}
agent-browser wait --load networkidle
agent-browser wait 2000
agent-browser snapshot -i
# Verify: 404 page or "Not Found" (page was deleted)
```

##### 10.4.4 Pages Summary
- **CREATE** - Page created with auto-generated slug
- **READ (public URL)** - `localhost:3005/<slug>` loads correctly
- **DELETE** - Page removed, **public URL returns 404**

#### 10.5 Superadmin Panel Verification

```bash
agent-browser open http://localhost:3005/superadmin
agent-browser wait --load networkidle
agent-browser wait 3000
agent-browser snapshot -i
# Verify: heading "Super Admin", navigation links (Users, Teams, Subscriptions, etc.)

agent-browser open http://localhost:3005/superadmin/users
agent-browser wait --load networkidle
agent-browser wait 3000
agent-browser snapshot -i
# Verify: User list renders with at least the superadmin and developer users
```

#### 10.6 DevTools Panel Verification

```bash
agent-browser open http://localhost:3005/devtools
agent-browser wait --load networkidle
agent-browser wait 3000
agent-browser snapshot -i
# Verify: Page loads without errors

agent-browser open http://localhost:3005/devtools/config
agent-browser wait --load networkidle
agent-browser wait 3000
agent-browser snapshot -i
# Verify: Entity configuration visible
```

#### 10.7 Close Browser

```bash
agent-browser close
```

#### 10.8 Full Verification Summary

| Test | Area | What it validates |
|------|------|-------------------|
| CREATE | Tasks | Entity form submission + API create |
| READ | Tasks | Detail page rendering + data display |
| UPDATE | Tasks | Edit form + API update + data persistence |
| DELETE | Tasks | Confirmation dialog + API delete + redirect |
| CREATE | Pages | Page creation with slug |
| READ (public URL) | Pages | **Page builder pipeline: slug -> public render** |
| DELETE | Pages | Deletion + **public URL returns 404** |
| Superadmin | Admin | Panel loads, users list renders |
| DevTools | Developer | Config, entity overview loads |

---

### Step 11: Stop Dev Server

```bash
lsof -ti:${TEST_PORT} 2>/dev/null | xargs kill -9 2>/dev/null || true
```

---

### Step 12: Test Production Build (CRITICAL)

```bash
cd "$TEST_DIR"
rm -rf .next
npx next build
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

### Step 13: Final Report

Summarize all results:

```markdown
## Local Package Test Results

### Build Phase (using pnpm pack → .packages/)
- [ ] UI package built and packed (size: X KB)
- [ ] Core package built and packed (size: X MB)
- [ ] CLI package built and packed (size: X KB)
- [ ] Testing package built and packed (size: X KB)
- [ ] create-nextspark-app built and packed (size: X KB)
- [ ] workspace:* references resolved correctly
- [ ] CLI dist verification passed (no stale code)
- [ ] All tarballs copied to .packages/

### Project Creation Phase (create-nextspark-app)
- [ ] create-nextspark-app ran successfully (100% local)
- [ ] Found local tarballs in .packages/
- [ ] @nextsparkjs/core installed from local tarball
- [ ] @nextsparkjs/cli installed from local tarball
- [ ] nextspark init completed
- [ ] sync:app synced all template files
- [ ] Starter theme available

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
- [ ] CREATE: Page created with auto-generated slug
- [ ] READ (public URL): `localhost:3005/<slug>` renders correctly
- [ ] DELETE: Page removed, public URL returns 404

### Admin & DevTools Phase
- [ ] Superadmin panel loads (`/superadmin`)
- [ ] Superadmin users list renders (`/superadmin/users`)
- [ ] DevTools panel loads (`/devtools`)
- [ ] DevTools config loads (`/devtools/config`)

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
   - Create-app issue -> Fix in `repo/packages/create-nextspark-app/src/`
4. **Do NOT continue** to next steps

### Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| `EUNSUPPORTEDPROTOCOL: workspace:*` | Used `npm pack` instead of `pnpm pack` | **Always use `pnpm pack`** - it converts `workspace:*` to real versions |
| `Module not found: @nextsparkjs/ui` | UI package not installed | Ensure UI tarball is in `.packages/` |
| `Module not found: better-auth/next-js` | Missing peer dependency | `npm install better-auth` |
| `Cannot find module 'cypress'` | Tests not excluded | Ensure tsconfig.json has `**/tests/**` in exclude |
| `@nextsparkjs/registries` not found | Missing webpack alias | Ensure `next.config.mjs` was synced |
| CSP violation errors | Wrong APP_URL | Update `NEXT_PUBLIC_APP_URL` to match actual port |
| `.next/dev/lock` error | Stale lock from crashed server | `rm -rf .next` and restart |
| Tarball contains old code | Build cache not invalidated | Always `rm -rf dist` before building each package |
| CLI has stale code in dist | tsup cache | `rm -rf dist && pnpm build` + verify with grep |
| create-nextspark-app can't find tarballs | Wrong .packages path | Verify tarballs are in `$REPO_ROOT/.packages/` |

---

## After Success

Package is ready for npm publish:

```bash
cd "$REPO_ROOT"
pnpm pkg:version -- patch  # or minor/major
pnpm pkg:publish
```

---

## What This Tests (100% Local)

| Component | Tested | Source |
|-----------|--------|--------|
| `create-nextspark-app` | Yes | Local build |
| `@nextsparkjs/ui` build & pack | Yes | Local build |
| `@nextsparkjs/core` build & pack | Yes | Local build |
| `@nextsparkjs/cli` build & pack | Yes | Local build |
| `@nextsparkjs/testing` build & pack | Yes | Local build |
| `workspace:*` resolution (pnpm pack) | Yes | Local |
| Local tarball discovery (.packages/) | Yes | Local |
| `nextspark init` CLI command | Yes | Local CLI |
| `nextspark sync:app` CLI command | Yes | Local CLI |
| `nextspark db:migrate` CLI command | Yes | Local CLI |
| `nextspark registry:build` CLI command | Yes | Local CLI |
| Theme copying | Yes | Local templates |
| Database migrations | Yes | Local SQL files |
| Registry generation | Yes | Local generators |
| Dev server startup | Yes | Local Next.js |
| Page rendering (agent-browser) | Yes | Local app |
| Auth system (login form + credentials) | Yes | Local auth |
| Entity CRUD - Tasks | Yes | Local API |
| Entity CRUD - Pages + Page Builder | Yes | Local API |
| Superadmin panel + users list | Yes | Local admin |
| DevTools panel + config | Yes | Local devtools |
| Production build | Yes | Local build |

**External dependencies (NOT from NextSpark):**
- `next`, `react`, `react-dom` — framework (peer deps, installed via npm)
- `better-auth` — auth library (peer dep)
- `tailwindcss`, `eslint` — dev tools (installed by create or init)

---

## Cleanup

After testing, optionally clean up:

```bash
# Remove test project
rm -rf "$TEST_DIR"

# Remove .packages tarballs
rm -rf "$PACKAGES_DIR"

# Remove individual package tarballs
rm -f "${REPO_ROOT}/packages/ui/"*.tgz
rm -f "${REPO_ROOT}/packages/core/"*.tgz
rm -f "${REPO_ROOT}/packages/cli/"*.tgz
rm -f "${REPO_ROOT}/packages/testing/"*.tgz
rm -f "${REPO_ROOT}/packages/create-nextspark-app/"*.tgz
```
