---
description: "Test npm package from scratch - fully automated with Playwright MCP browser verification"
---

# do:test-package

**Input:** {{{ input }}}

---

## Fully Automated Local Package Test

Tests the **REAL user experience** from scratch using 100% LOCAL code. Simulates exactly what a new user does when running `npx create-nextspark-app`, but using locally built packages instead of npm.

**Usage:**
```
/do:test-package DATABASE_URL="postgresql://user:pass@host:5432/dbname?sslmode=disable"
/do:test-package DATABASE_URL="..." --skip-perf   # functional test only, no performance phases
```

`DATABASE_URL` is any disposable PostgreSQL reachable from this machine. Never point this command at a production database: it runs migrations and seeds sample data.

Unless `--skip-perf` is given, the run also measures performance: dev-server checks (Step 10.7) and SSR, JavaScript size and Web Vitals checks on the production build (Step 12.1 to 12.4). Numbers from a laptop are indicative; what matters is the change between versions.

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
# Evidence and the performance baseline go here, outside the repo (so the clean-status check still passes)
RESULTS_DIR="${PROJECTS_DIR}/test-package-results"
# One subdirectory per run: <core version under test>-<date>, so a run never overwrites the previous baseline
CORE_VERSION=$(node -p "require('${REPO_ROOT}/packages/core/package.json').version")
PERF_DIR="${RESULTS_DIR}/perf/${CORE_VERSION}-$(date +%Y%m%d-%H%M)"
# Not created here: the first performance step that writes (10.7 or 12.1) runs `mkdir -p "$PERF_DIR"`, so --skip-perf leaves nothing behind
```

**Where `create-nextspark-app` looks for tarballs:** a `.packages` directory in the current directory, `../`, `../repo/`, `../../` or `../../repo/`. If `REPO_ROOT` is a git worktree (`.claude/worktrees/NN`), none of those reaches it: create a symlink `ln -s "$REPO_ROOT" "$(dirname "$PROJECTS_DIR")/repo"` (the parent of `projects/` gets a `repo` link to the worktree). If more than one `.packages` is in sight, core and cli take the first one in that order **without a warning**; ui and testing warn ("Found more than one local ... tarball" or "Ignoring local ... not at <version>") and come from the registry. Keep exactly one `.packages` visible.

---

## EXECUTE ALL STEPS AUTOMATICALLY

### Step 1: Parse Input & Database Configuration

#### 1.1 Extract DATABASE_URL from input

Look for `DATABASE_URL="..."` in the input string. Also look for the flag `--skip-perf`: when present, skip Step 10.7, Steps 12.1 to 12.4 and the Performance section of the report, and run everything else unchanged.

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
  # LISTEN only: a connected browser also holds a socket on the port and must not be killed
  lsof -tiTCP:${TEST_PORT} -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null || true
fi
```

---

### Step 3: Build and Pack ALL Packages (100% Local)

**CRITICAL:**
1. Must do a **CLEAN rebuild** (`rm -rf dist`) to include latest code changes
2. **MUST use `pnpm pack`** (not `npm pack`) to properly resolve `workspace:*` dependencies
3. Copy ALL tarballs to `$REPO_ROOT/.packages/` so `create-nextspark-app` finds them

```bash
# zsh (default shell on macOS) aborts a command whose glob matches nothing: allow empty matches
setopt nonomatch 2>/dev/null || true

# Clean the .packages directory first
rm -rf "$PACKAGES_DIR"
mkdir -p "$PACKAGES_DIR"

# Order matters: ui (dependency of core) -> core -> cli -> testing -> create-nextspark-app.
# Stop at the first failure (error handling below): do not pack the rest.
for pkg in ui core cli testing create-nextspark-app; do
  ( cd "${REPO_ROOT}/packages/${pkg}" \
    && rm -rf dist && pnpm build && rm -f ./*.tgz && pnpm pack && cp ./*.tgz "$PACKAGES_DIR/" ) \
    || { echo "FAILED: ${pkg}"; break; }
done
```

**Why pnpm pack is required:** Some packages use `workspace:*` references (e.g., `@nextsparkjs/cli` depends on `@nextsparkjs/core` that way). When using `pnpm pack`, these are automatically converted to actual version numbers (e.g., `0.1.0-beta.93`). Using `npm pack` leaves them as `workspace:*`, which causes `EUNSUPPORTEDPROTOCOL` errors during installation. `@nextsparkjs/core` itself no longer has any `workspace:*` dependency (it dropped its runtime dependency on `@nextsparkjs/testing` in beta.192 -- see `packages/core/docs/17-updates/03-beta-192-status.md`), but still needs `pnpm pack`, not `npm pack`, for the same reason every other packed workspace package does.

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

**Verify `workspace:*` was resolved in every tarball** (each count must be `0`; the CLI must depend on the exact core version):
```bash
for t in "$PACKAGES_DIR"/*.tgz; do
  echo "$(basename "$t"): $(tar -xOzf "$t" package/package.json | grep -c 'workspace:')"
done
tar -xOzf "$PACKAGES_DIR"/nextsparkjs-cli-*.tgz package/package.json | grep '@nextsparkjs/core'
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
- Looks for tarballs in a `.packages/` directory in `cwd`, `../`, `../repo/`, `../../` or `../../repo/` (see Step 0.3 for worktrees)
- Installs `@nextsparkjs/core`, `@nextsparkjs/cli`, `@nextsparkjs/ui` and `@nextsparkjs/testing` from local tarballs
- Runs `nextspark init` wizard (creates the host, `src/app` included, and a `.env` with a generated `BETTER_AUTH_SECRET`)

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
3. Finds tarballs in `.packages/` (via `findLocalTarball`; with the repo in a worktree it needs the `repo` symlink from Step 0.3, and only one visible `.packages`)
4. Installs `@nextsparkjs/{core,cli,ui,testing}` from local tarballs (the installer may be your global pnpm, not the repo's pinned one)
5. Runs `nextspark init --theme starter --yes`, which generates the host: `src/app` (thin facades, `src/proxy.ts`), `.nextspark/registries/`, `config/`, `templates/`

**Verify:**
```bash
ls "$TEST_DIR/package.json"
ls "$TEST_DIR/node_modules/@nextsparkjs/core"
ls "$TEST_DIR/node_modules/@nextsparkjs/cli"
ls "$TEST_DIR/templates"
ls "$TEST_DIR/src/app" | head   # generated by init and git-ignored (src/app/ is in .gitignore)
ls "$TEST_DIR/.nextspark/registries/"
grep '@nextsparkjs' "$TEST_DIR/package.json"   # four `file:` tarball paths: core, cli, ui, testing
```

`src/app` is fully generated and git-ignored: after init it already exists (about 187 files in beta.199), and `nextspark prepare` (Step 8) regenerates it. Never edit it by hand.

**If project generation fails, stop and report the failed command; do not reconstruct a legacy layout manually.**

---

### Step 6: Create .env with User's DATABASE_URL

`create-nextspark-app` already wrote a `.env` (with a generated `BETTER_AUTH_SECRET`). **Overwrite it** with a shell heredoc (`cd "$TEST_DIR" && cat > .env <<'EOF' ... EOF`); do not read the old one and do not use the Write tool (it refuses to overwrite a file that was not read first):

```env
# Database - From user input
DATABASE_URL="<USER_PROVIDED_DATABASE_URL>"

# Authentication
BETTER_AUTH_SECRET=test_secret_2e205f79e4b0b8a061e79af9da52f1010ffe923a

# Theme

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3005"
NODE_ENV="development"
PORT=3005

# Email Provider. Dummy key: in development the console email provider is used regardless of the key,
# so the sign-in (OTP) code is printed in the dev server log. The dummy key does NOT satisfy the
# production auth readiness check (see Step 12).
RESEND_API_KEY=re_dummy_key_for_build_only

# Cypress (not used by this command: login is by emailed code, not by password)
CYPRESS_BASE_URL=http://localhost:3005
CYPRESS_SUPERADMIN_EMAIL=superadmin@nextspark.dev
```

---

### Step 7: Run Database Migrations

```bash
cd "$TEST_DIR"
# db:seed = the migrations plus the sample data (development only; plain db:migrate applies no sample data)
pnpm exec nextspark db:seed
```

**Verify:** Command completes without errors. Should show:
- `Sample data is applied (development)`
- Phase 1: Core migrations (43 files, so 43 rows in `_migrations` as of beta.199; the number grows with each release)
- Phase 2: Entity migrations (about 9 for the starter theme: pages, posts, tasks; check `_entity_migrations`)

**A database role that is not a superuser and has no CREATEROLE** (a shared cluster, a managed host) also runs the migrations: migration `022` skips the role steps it has no privilege for and prints `Role setup: could not ...` warnings saying what a superuser can run by hand. The app does not need them to run; only an RLS isolation test that does `SET ROLE nextspark_app` does. If `nextspark_app` does not exist yet, creating it still needs CREATEROLE.

**Seeded users** (table `users`): `superadmin@nextspark.dev` (role `superadmin`), `developer@nextspark.dev` (role `developer`). `db:seed` gives each a `credential` account with the sample-data password, but in this flow they still sign in with an emailed code (the code is in the dev log); the password exists, so the production check in Step 12 reports it.

---

### Step 8: Build Registries

```bash
cd "$TEST_DIR"
pnpm exec nextspark prepare   # init already generated everything: this first run already reports "0 written"
pnpm exec nextspark prepare   # second run: "0 written" again (everything unchanged)
```

**Verify:**
```bash
ls -la .nextspark/registries/*.ts
```

Should have about 33 registry files (beta.199) and report `Generated src/app (187 files) and 33 registries: 0 written ... 220 unchanged` (the counts change with the starter and the release; what matters is `0 written`). Check for NO path escaping errors (no `\v`, `\t` in file paths).

---

### Step 9: Start Dev Server

```bash
cd "$TEST_DIR"
rm -rf .next  # Clean any stale cache
# The project's dev script is `nextspark dev` (prepares, starts Next, keeps the watcher). Ready in a few seconds,
# "Cache Components enabled". The PID is of the pnpm wrapper; the port is held by the next-server child.
pnpm exec nextspark dev -p ${TEST_PORT} > dev.log 2>&1 &
echo $! > dev.pid
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

### Step 10: Browser Verification with Playwright MCP

Use the **Playwright MCP** tools (`mcp__plugin_playwright_playwright__browser_*`) to verify the app works end-to-end: `browser_navigate`, `browser_snapshot` (accessibility tree), `browser_click`, `browser_fill_form` / `browser_type`, `browser_wait_for`, `browser_console_messages`, `browser_take_screenshot`.

**`agent-browser` is optional**, an alternative if it is installed (`npm i -g agent-browser`); it is not installed by default and this command does not depend on it. If you use it, mind its two confirmed limitations: `agent-browser console` does not reliably capture output (prove the capture path with a `console.error` canary before trusting "0 errors"), and a ref-based `click` does not scroll into view (use `eval` with a real DOM `.click()` inside scrollable dialogs/menus). Playwright MCP has neither problem.

**Playwright MCP notes:**
- Prefer `data-cy` selectors (the product's test id attribute) over refs: refs get a frame prefix after navigation (`f2e107`) and change between snapshots.
- `browser_take_screenshot` only writes under the repo and `.playwright-mcp/`: pass a relative filename, then `mv` the file out of the repo root into your evidence folder **before** the clean-status check (`.playwright-mcp/` is git-ignored).
- **Console check on every page you visit:** call `browser_console_messages` (level `error`) after each navigation and report anything other than known noise.

#### 10.1 Homepage & Auth Pages (curl pre-check)

Quick HTTP checks before launching the browser:
```bash
# Homepage
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3005/

# Login page
curl -s http://localhost:3005/login | grep -oE '<title>(Sign In|Create Account)[^<]*'

# Signup page
curl -s http://localhost:3005/signup | grep -oE '<title>(Sign In|Create Account)[^<]*'

# Dashboard (should redirect 307 to login when unauthenticated)
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3005/dashboard
```

**Expected:** Homepage 200, Login 200 (title starts with `Sign In`, e.g. `Sign In | test-package`), Signup 200 (title starts with `Create Account`), Dashboard 307.

#### 10.2 Login by emailed code (OTP)

Login is **passwordless by default**. There is no password to fill, and `CYPRESS_SUPERADMIN_PASSWORD` is not used. In development the console email provider prints the email, including the 6-digit code, in the dev server log.

1. `browser_navigate` to `http://localhost:3005/login`, then `browser_snapshot`.
   Verify: textbox **Email**, button **Email me a sign-in code**, link **Sign in with a password instead**, button **Dev Keyring**.
2. Fill **Email** with `superadmin@nextspark.dev` and click **Email me a sign-in code**.
3. Read the code from the dev server log:
   ```bash
   grep 'is your verification code' "$TEST_DIR/dev.log" | tail -1
   # 📧 EMAIL INTERCEPTED ... Subject: 846899 is your verification code - test-package
   ```
   The code is sent after the request answers (Better Auth's background tasks), so it can reach the log a moment later: if the line is not there yet, wait a second and grep again (up to ~15 s).
4. Fill the **Sign-in code** textbox with the 6 digits and submit.

**Expect:** redirect to `/dashboard`, heading "Dashboard", sidebar links **Dashboard, Media, Pages, Posts, Tasks**.

#### 10.3 Entity CRUD Test: Tasks

**CRITICAL:** Test full CRUD operations to verify the data flow works end-to-end.

Selectors (`data-cy`): `tasks-field-title` and `tasks-field-description` are **container `div`s**, not the inputs: the controls are `[data-cy=tasks-field-title] input` and `[data-cy=tasks-field-description] textarea` (they have **no `name` attribute**); detail page `tasks-edit`, `tasks-delete`; delete dialog `tasks-delete-confirm`. The submit button is `tasks-form-submit` on both forms (label **Create** on the create form, **Save Changes** on the edit form); there is no `tasks-submit`.

##### 10.3.1 Navigate to Tasks
`browser_navigate` to `http://localhost:3005/dashboard/tasks`, then `browser_snapshot`.
Verify: heading "Tasks", link "Add task", heading "No tasks found" or table with data.

##### 10.3.2 CREATE - Add New Task
Navigate directly to `http://localhost:3005/dashboard/tasks/create` (more reliable than clicking the link) and snapshot.
Verify: heading "Create task", form fields: Title*, Description, Status, Priority, etc.

Fill `[data-cy=tasks-field-title] input` with `NPM Package Test Task` and `[data-cy=tasks-field-description] textarea` with `Task created during NPM package test`, then click `[data-cy=tasks-form-submit]` (**Create**).

**Expect:** redirect to `/dashboard/tasks/<uuid>` with heading "NPM Package Test Task" and the Edit and Delete buttons.

##### 10.3.3 READ - Verify Task Detail
`browser_take_screenshot` (relative filename, then move it out of the repo).
Visually verify: Title, Description, Status "To Do", Priority "Medium", timestamps.

##### 10.3.4 UPDATE - Edit Task
Navigate directly to `http://localhost:3005/dashboard/tasks/<TASK_UUID>/edit` and snapshot.
Verify: form pre-filled with current values.

Replace the content of `[data-cy=tasks-field-title] input` with `NPM Package Test Task - UPDATED` and click `[data-cy=tasks-form-submit]` (**Save Changes**).

**Expect:** redirect to the detail page with heading "NPM Package Test Task - UPDATED".

##### 10.3.5 DELETE - Remove Task
Click `[data-cy=tasks-delete]`. Verify: `alertdialog` titled `Delete "<title>"?` ("This action cannot be undone") with buttons **Cancel** and **Delete**. Click `[data-cy=tasks-delete-confirm]`.

**Expect:** redirect to `/dashboard/tasks`, list shows "No tasks found".

##### 10.3.6 Tasks CRUD Summary
All four operations must pass:
- **CREATE** - Form submission creates entity, redirects to detail page
- **READ** - Detail page shows correct data (title, description, status, priority)
- **UPDATE** - Edit form saves changes, title updated in detail view
- **DELETE** - Confirmation dialog removes entity, list shows empty state

#### 10.4 Entity CRUD Test: Pages + Page Builder URL

**CRITICAL:** Test Pages entity CRUD AND verify the page builder renders at the public slug URL.

Selectors (`data-cy`): `builder-title-input`, `builder-slug-input`, `builder-save-btn` (Save Draft), `builder-publish-btn`, `block-picker-add-hero`.

##### 10.4.1 CREATE - Add New Page
Navigate to `http://localhost:3005/dashboard/pages/create` and snapshot.
Verify: page builder editor with title input, slug input, Save Draft and Publish buttons.

Fill `[data-cy=builder-title-input]` with `Test Landing Page`; the slug auto-generates: `[data-cy=builder-slug-input]` must hold `test-landing-page`.

**Add a block before publishing:** click `[data-cy=block-picker-add-hero]` (or any block). An empty page has nothing to show at the public URL. A hero added with empty props renders an empty `<section data-cy="block-hero">` (white text, nothing visible): that is the input, not a bug.

Click `[data-cy=builder-publish-btn]`. **Expect:** redirect to `/dashboard/pages/<uuid>/edit`.

##### 10.4.2 READ - Verify PUBLIC URL
```bash
SLUG=test-landing-page   # or the value of [data-cy=builder-slug-input]
```
`browser_navigate` to `http://localhost:3005/${SLUG}` and snapshot.

**KEY TEST:** the page renders at the public slug URL. Verify `[data-cy=block-hero]` and `data-page-slug=<slug>` in the DOM (also visible with `curl -s http://localhost:3005/${SLUG} | grep -E 'data-page-slug|block-hero'`).

**This validates the full page builder pipeline:**
1. Entity created in dashboard -> saved to DB
2. Public route `[...slug]` resolves the page by slug
3. Page content/blocks render on the public URL

##### 10.4.3 DELETE - Remove Page (via list bulk action)
Navigate to `http://localhost:3005/dashboard/pages`. Tick the row's checkbox (`tr:has-text("Test Landing") input[data-cy^="pages-select-"]`; it is a native input, not `[role=checkbox]`), click `[data-cy=pages-bulk-delete]`, then `[data-cy=pages-bulk-delete-confirm]`. The row disappears from the list. The dashboard has **two** `main` elements: scope content queries to `main.flex-1`.

**Verify the public URL no longer serves the page:** `http://localhost:3005/${SLUG}` must NOT contain `data-page-slug=<slug>`; it shows the not-found page (`This page could not be found`) and `<meta name="robots" content="noindex">`.

**HTTP status is 200, not 404, under Cache Components** (the default rendering mode; documented in `packages/core/docs/18-page-builder/07-public-rendering.md`, "G0 decision"). A 404 status is expected only with legacy ISR (`cacheComponents` off). Do not fail the step on the status code; fail it if the old page content is still served (re-check after ~20 s with `curl` before deciding).

##### 10.4.4 Pages Summary
- **CREATE** - Page created with auto-generated slug and a block
- **READ (public URL)** - `localhost:3005/<slug>` renders `block-hero` and `data-page-slug`
- **DELETE** - Page removed, **public URL shows the not-found page (200 + noindex), not the old content**

#### 10.5 Superadmin Panel Verification

Signed in as `superadmin@nextspark.dev` (10.2):
`browser_navigate` to `http://localhost:3005/superadmin`, snapshot, console check.
Verify: heading "Super Admin", navigation links (Users, Teams, Subscriptions, etc.).

`browser_navigate` to `http://localhost:3005/superadmin/users`, snapshot, console check.
Verify: both seeded users appear. The page opens on the tab "Regular Users (1)" with the developer; the superadmin is under the "Superadmins (1)" tab (stats: Total Users 2, Superadmins 1).

**Playwright note:** snapshots of the admin and devtools pages collapse most nodes at the default depth. Verify with `browser_evaluate` (headings, nav `href`s, `tbody tr` text). Expected nav: `/superadmin` -> users, teams, team-roles, docs, subscriptions; `/devtools` -> style, tests, features, flows, blocks, tags, config, api, scheduled-actions.

#### 10.6 DevTools Panel Verification

DevTools needs the **developer** role; the superadmin session does not open it. Sign out (`browser_evaluate`: `fetch('/api/auth/sign-out',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})` returns 200) or use a fresh browser context, and repeat the 10.2 flow with `developer@nextspark.dev`, reading the new code with `grep 'is your verification code' dev.log | tail -1`.

`browser_navigate` to `http://localhost:3005/devtools`, snapshot, console check.
Verify: page loads without errors.

`browser_navigate` to `http://localhost:3005/devtools/config`, snapshot, console check.
Verify: entity configuration visible.

#### 10.7 Dev Performance Phase (skip with `--skip-perf`)

Run it with the dev server still up and the browser still signed in. **A dev server is not a production build: do NOT report Web Vitals (LCP, CLS, INP, TTFB) from it as if they were production numbers.** Dev checks only answer "is anything broken or unusually slow while developing". Web Vitals are measured in Step 12.

Report every finding with route, evidence (message text, timing, log line) and severity (high: error or broken page; medium: a warning that repeats or a page that never settles; low: noise).

1. **Console on the key pages.** For each of `/`, `/login`, `/signup`, `/dashboard`, `/dashboard/tasks` (an entity list) and `/dashboard/pages/create` (the page editor): `browser_navigate`, wait for the page to settle, then `browser_console_messages` at level `error` and again at level `warning`. Record each distinct message once, with the routes where it appears. (Visit `/login` and `/signup` in a fresh context or after signing out; a signed-in session redirects them.)
2. **Hydration warnings.** In the same messages and in `dev.log`, search for `hydrat` (for example `Hydration failed`, `did not match`, `server rendered HTML`). Any hit is at least medium; name the route.
3. **First-compile time per route.** The first request of a route in dev compiles it. This check needs a fresh dev server, and by now 10.1-10.6 have already compiled these routes, so the restart is mandatory: stop the server as in Step 11 (by PID; otherwise the new one collides on the test port), run Step 9 again (including `rm -rf .next`), and wait until it answers. The browser session survives the restart (the session lives in the database). Then request each route once with `curl` and read the time, then the compile lines from the log:
   ```bash
   for p in / /login /signup /dashboard /dashboard/tasks /dashboard/pages/create; do
     echo "$p $(curl -s -o /dev/null -w '%{http_code} %{time_total}s' http://localhost:${TEST_PORT}$p)"
   done
   grep -E 'Compiled|compiled in|Ready in' "$TEST_DIR/dev.log" | tail -20
   ```
   Signed out, `/dashboard*` answers 307: that time is the redirect, so take the dashboard compile times from the log or from the signed-in browser navigation. Flag a first compile above 10 s as medium. A second request of the same route (warm) should be much faster: report both.
4. **HMR check.** Edit one i18n message of the generated project, check that the page shows it without a manual reload, then restore the file:
   ```bash
   cd "$TEST_DIR"
   MSG=messages/en/home.json                        # shown on `/`; if the starter has no such file, use another message file that a page you can open renders (not analytics.json: dashboard only)
   mkdir -p "$PERF_DIR" && cp "$MSG" "$PERF_DIR/hmr-backup.json"
   # change one string value in $MSG to "HMR-CHECK", keeping the JSON valid
   ```
   With the page that renders that string open (find the key with `grep -rn "<key>" src contents`), `browser_wait_for` the text `HMR-CHECK` (max 15 s) **without** `browser_navigate`. Record the time until it appears; if it never appears, that is a finding (high). Then restore the file and confirm the page shows the original text again:
   ```bash
   cp "$PERF_DIR/hmr-backup.json" "$MSG"
   ```
   If no message in the starter can be shown on a page you can reach, say so and mark the check "not run" instead of passing it.

#### 10.8 Close Browser

`browser_close`.

#### 10.9 Full Verification Summary

| Test | Area | What it validates |
|------|------|-------------------|
| CREATE | Tasks | Entity form submission + API create |
| READ | Tasks | Detail page rendering + data display |
| UPDATE | Tasks | Edit form + API update + data persistence |
| DELETE | Tasks | Confirmation dialog + API delete + redirect |
| CREATE | Pages | Page creation with slug and a block |
| READ (public URL) | Pages | **Page builder pipeline: slug -> public render** |
| DELETE | Pages | Deletion + **public URL stops serving the page (not-found page, 200 + noindex)** |
| Superadmin | Admin | Panel loads, users list renders |
| DevTools | Developer | Config, entity overview loads |
| Dev performance (10.7) | Dev server | Console and hydration cleanliness, first compile, HMR (no Web Vitals) |

---

### Step 11: Stop Dev Server

The dev server is three processes (pnpm -> nextspark -> `next-server`) and the port is held by the `next-server` child. Kill by PID, never by pattern, and never kill connected clients (the browser) along with it:

```bash
kill "$(cat "$TEST_DIR/dev.pid")" 2>/dev/null || true
lsof -tiTCP:${TEST_PORT} -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null || true   # LISTEN only
lsof -tiTCP:${TEST_PORT} -sTCP:LISTEN || echo "port ${TEST_PORT} free"
```

The dev log prints `[DB] SIGTERM received, initiating graceful shutdown ... Database pool closed` many times during normal use (27 in ~3 minutes in beta.195, 28-29 in a session on beta.196); it does not fail the run, but note the count in the report.

---

### Step 12: Test Production Build (CRITICAL)

The documented production build is `nextspark build` (the project's `pnpm build`): it runs `prepare --production` (registries, `src/app`, and the **auth readiness check**) and then `next build`. See `packages/core/docs/20-npm-distribution/06-prepare.md`.

```bash
cd "$TEST_DIR"
rm -rf .next
pnpm build 2>&1 | tee build.log
```

**The readiness check fails the build when no login method in `auth.methods` can authenticate.** The test `.env` has no `EMAIL_FROM` and no Google credentials (and the console email provider does not count), so a plain `pnpm build` can stop with diagnostics such as `EMAIL_FROM_MISSING` / `GOOGLE_CLIENT_ID_MISSING`. That is the product working as designed, not a defect. Then run the documented **runtime-only build** (providers whose credentials are injected only at runtime): delete any placeholder line such as `RESEND_API_KEY=re_dummy...` from `.env` (a placeholder fails even with the variable below; only *absent* values are deferred), then:

```bash
NEXTSPARK_AUTH_RUNTIME_ONLY=email,google pnpm build 2>&1 | tee build.log
```

Record which of the two builds you ran. (`NEXTSPARK_AUTH_PREFLIGHT=off` is the only bypass; do not use it here.) Docs: `packages/core/docs/06-authentication/12-passwordless-preset.md`, "Production readiness check".

**Success criteria:**
- "Compiled successfully" message ("Cache Components enabled" in the header)
- No TypeScript errors
- No module resolution errors
- Build completes with exit code 0

**Check output for:**
- Route list showing all pages (`◐` partial prerender, `○` static, `ƒ` dynamic; ~133 static pages for the starter theme)
- No "Module not found" errors
- No "Type error" messages
- Noise that does not fail the build but must be counted and reported: `grep -c MISSING_MESSAGE build.log`, `grep -c 'ReferenceError' build.log` (beta.196: both 0)

**Start the production server and check it** (`next start` needs only the output of the build):
```bash
pnpm exec next start -p ${TEST_PORT} > start.log 2>&1 &
echo $! > prod.pid
sleep 3
for p in / /login /dashboard; do echo "$p $(curl -s -o /dev/null -w '%{http_code}' http://localhost:${TEST_PORT}$p)"; done
# Expected: / 200, /login 200, /dashboard 307
```

Keep this server running for Steps 12.1 to 12.4 (unless `--skip-perf`), then stop it by PID in Step 12.5.

With the runtime-only build, `start.log` shows an `[auth-readiness] no login method can authenticate` error at startup: expected until the credentials are injected; the server keeps serving and the per-request gates refuse unusable methods.

**Sample-data password warning.** On a database seeded with `db:seed`, `next start` also prints `[auth-readiness] 2 account(s) still have a sample-data password` (expected), but only when the production server can reach the database. Production defaults to SSL, so a local Postgres without SSL needs `?sslmode=disable` in `DATABASE_URL` (the usage example at the top already has it). Without it the line is instead `[auth-readiness] could not check for sample-data passwords at startup (query failed: <code or class>)`: the server keeps serving, but the check did not run (`ECONNREFUSED`/`Error` usually mean the connection, often SSL; `42P01` means the database answered but is not migrated; `28P01` is a wrong password). Do not report a missing warning as a pass until you have seen one of the two lines.

#### 12.1 SSR check (skip with `--skip-perf`)

The main content of a public page must be in the HTML the server sends, before any JavaScript runs. For each public route (`/`, `/login`, `/signup`, `/support`, `/docs`, `/blog`, plus `/<slug>` of a page if you still have one), fetch the HTML and check it:

```bash
mkdir -p "$PERF_DIR"
for p in / /login /signup /support /docs /blog; do
  H="$PERF_DIR/ssr$(echo "$p" | tr / _).html"
  curl -s -o "$H" -w "$p HTTP %{http_code} TTFB %{time_starttransfer}s total %{time_total}s\n" "http://localhost:${TEST_PORT}$p"
  echo "  title:     $(grep -oE '<title>[^<]*' "$H" | head -1)"
  echo "  h1:        $(grep -oE '<h1[^>]*>' "$H" | wc -l | tr -d ' ') element(s)"
  echo "  canonical: $(grep -cE 'rel="canonical"' "$H")  description: $(grep -cE 'name="description"' "$H")  og:title: $(grep -cE 'property="og:title"' "$H")  og:description: $(grep -cE 'property="og:description"' "$H")"
  echo "  client-render bailout: $(grep -c 'BAILOUT_TO_CLIENT_SIDE_RENDERING' "$H")  skeleton/loading markers: $(grep -ciE 'animate-pulse|skeleton' "$H")"
done
```

Also pick one key phrase you saw on each page in the browser and `grep -c` for it in the saved HTML: it must be there. A missing or empty `<title>`, no `<h1>`, a key phrase absent from the HTML, any `BAILOUT_TO_CLIENT_SIDE_RENDERING`, or a body that is only loading markers is a failure of that route (medium to high). A missing canonical or `og:*` tag is low on routes that should not be indexed (`/login`, `/signup`) and medium on content routes. The markers are heuristics: show the matching line before calling it a defect.

#### 12.2 JavaScript per route (skip with `--skip-perf`)

Run the existing per-route checker from the repo against the project you just built. It reads the build output only (no server needed), measures the gzip JavaScript each route loads, and compares it with the budget in `scripts/performance/starter-route-js-budget.json`:

```bash
cd "$REPO_ROOT"
node scripts/performance/starter-route-js.mjs --app "$TEST_DIR" --json "$PERF_DIR/route-js.json" | tee "$PERF_DIR/route-js.txt"
# exit 0: every route within budget; 1: a route is over budget; 2: usage or build-output error
```

Record the exit code and, per route, the measured size against its `maxGzipBytes`. A route over budget is a failure; add the headroom (budget minus measured) to the table so a shrinking margin shows before it fails. `scripts/performance/README.md` explains how the budget was set. If the checker exits 2, report its message and mark this check "not run".

#### 12.3 Web Vitals and TTFB per route (skip with `--skip-perf`)

Thresholds (good): LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1. TTFB is reported, with 800 ms as the usual reference. Measure on the production server from Step 12, never on the dev server.

**Tool.** Use the chrome-devtools MCP if it is connected (performance trace and insights). If it is not, use Playwright MCP: `browser_evaluate` for the observers below, or `browser_run_code_unsafe` for a Chromium trace over CDP. If `lighthouse` is already installed (`lighthouse --version` works) it is an acceptable alternative for the public routes; do not install it just for this.

**Routes.** Public: `/`, `/login`, `/signup`, `/support`, `/docs`, `/blog`. Dashboard: `/dashboard` and `/dashboard/tasks`, only if you can hold a signed-in session on this production server. The runtime-only build has no usable login method (see above), so you may not be able to sign in: then list the dashboard routes as "not measured (no session)". Do not substitute dev-server numbers and do not guess.

**LCP, CLS, TTFB.** The CLS below adds up every layout shift without recent input over the whole load. The real CLS is the worst session window, so this sum is an upper bound of it; that is acceptable for a short page load, but a value above 0.1 here deserves a look at the individual shifts before it is called a failure. (One `browser_evaluate` per route after `browser_navigate`; the observers are `buffered`, so they report what already happened):
```js
async () => {
  const out = { lcp: null, cls: 0 };
  new PerformanceObserver(l => { for (const e of l.getEntries()) out.lcp = e.startTime; })
    .observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) out.cls += e.value; })
    .observe({ type: 'layout-shift', buffered: true });
  await new Promise(r => setTimeout(r, 3000));          // let late shifts and the final LCP candidate arrive
  const nav = performance.getEntriesByType('navigation')[0];
  out.ttfb = nav.responseStart;
  return out;
}
```

**INP on one simple interaction.** INP needs a real interaction: install the observer, interact, then read it. On each route use one cheap control with no side effects (a menu or theme toggle, a tab, a link that stays on the page):
```js
() => {
  window.__inp = 0;
  new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.interactionId > 0) window.__inp = Math.max(window.__inp, e.duration); })
    .observe({ type: 'event', durationThreshold: 16, buffered: true });
}
```
Run it, `browser_click` the control, wait a second, then `browser_evaluate` `() => window.__inp`. This is the longest single interaction, a one-sample stand-in for INP: say so in the report. If `__inp` is still 0 no interaction reached the 16 ms threshold: report "< 16 ms", not 0. A route with no safe control is "not measured".

**Cold and warm.** Measure each route twice: the first load after the server start (cold; use a fresh browser context) and a second load of the same URL (warm). Report both and their median; with two runs the median is the midpoint, so if cold and warm differ by more than 20% for a metric on a route say so and take a third run of that metric on that route, then report the median of the three. A laptop is noisy: close other heavy processes first and note anything still running.

#### 12.4 Performance summary table (skip with `--skip-perf`)

Build one table, route by metric, giving cold / warm / median for every timing metric (TTFB, LCP, CLS, INP), not only TTFB, and mark every cell that fails its threshold with `FAIL`:

```markdown
| Route | TTFB ms (cold / warm / median) | LCP ms | CLS | INP ms | JS gzip (measured / budget) | SSR content |
|-------|--------------------------------|--------|-----|--------|-----------------------------|-------------|
| /     | 120 / 40 / 80                  | 1500 / 1300 / 1400 | 0.02 / 0.01 / 0.015 | 70 / 50 / 60 | 218 KB / 230 KB | ok |
```

A cell fails when LCP > 2500 ms, INP > 200 ms, CLS > 0.1, JS is over budget, or SSR content is not ok. Save the table, the raw numbers (one JSON file per route is enough) and `route-js.json` in `$PERF_DIR` (a subdirectory per run, `<core version>-<date>`, see Step 0.3), together with the version under test (`$CORE_VERSION`), the date, the machine class (laptop or CI) and the Node and Next versions. Do not put these files in the repo.

#### 12.5 Stop the production server

```bash
kill "$(cat "$TEST_DIR/prod.pid")" 2>/dev/null
lsof -tiTCP:${TEST_PORT} -sTCP:LISTEN | xargs kill 2>/dev/null || true
lsof -tiTCP:${TEST_PORT} -sTCP:LISTEN || echo "port ${TEST_PORT} free"
```

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
- [ ] workspace:* references resolved correctly (`grep -c workspace:` = 0 in every tarball; CLI depends on the exact core version)
- [ ] CLI dist verification passed (no stale code)
- [ ] All tarballs copied to .packages/

### Project Creation Phase (create-nextspark-app)
- [ ] create-nextspark-app ran successfully (100% local)
- [ ] Found local tarballs in .packages/
- [ ] @nextsparkjs/{core,cli,ui,testing} installed from local tarballs (four `file:` paths in package.json)
- [ ] nextspark init completed
- [ ] `src/app` generated by init and regenerated by `nextspark prepare` (git-ignored; second prepare reports 0 written)
- [ ] Starter theme available

### Configuration Phase
- [ ] .env created with DATABASE_URL
- [ ] Migrations ran successfully (about 43 core + 9 entity)
- [ ] Registries built (about 33 files, no path errors)

### Runtime Phase (Playwright MCP)
- [ ] Dev server started on port 3005 (`nextspark dev`)
- [ ] Homepage loads (HTTP 200)
- [ ] Login page renders with form (title starts with "Sign In")
- [ ] Signup page renders (title starts with "Create Account")
- [ ] Login with superadmin by emailed code (read from the dev log) succeeds
- [ ] Dashboard loads with navigation sidebar (Dashboard, Media, Pages, Posts, Tasks)

### CRUD Test Phase: Tasks Entity
- [ ] CREATE: Task created via form, redirected to detail
- [ ] READ: Detail page shows title, description, status, priority
- [ ] UPDATE: Title edited and persisted
- [ ] DELETE: Confirmation dialog, task removed

### CRUD Test Phase: Pages Entity + Page Builder
- [ ] CREATE: Page created with auto-generated slug
- [ ] READ (public URL): `localhost:3005/<slug>` renders correctly
- [ ] DELETE: Page removed, public URL no longer serves the page (not-found page, 200 + noindex under Cache Components)

### Admin & DevTools Phase
- [ ] Superadmin panel loads (`/superadmin`)
- [ ] Superadmin users list renders (`/superadmin/users`: developer under Regular Users, superadmin under Superadmins)
- [ ] DevTools panel loads (`/devtools`, signed in as developer)
- [ ] DevTools config loads (`/devtools/config`)

### Production Phase
- [ ] Production build passed (`pnpm build`, or the runtime-only build: say which)
- [ ] All routes compiled
- [ ] No TypeScript errors
- [ ] `next start`: / 200, /login 200, /dashboard 307
- [ ] Build log noise counted (MISSING_MESSAGE, ReferenceError)
- [ ] Browser console checked on every page (`browser_console_messages`)

### Performance (write "skipped (--skip-perf)" when the flag was used)
- [ ] Dev (10.7, not Web Vitals): console errors and warnings per key page, hydration warnings, first-compile time per route, HMR check (time to show, file restored)
- [ ] SSR (12.1): title, h1, key text, description/canonical/og tags in the initial HTML; no client-render bailout; findings listed
- [ ] JS per route (12.2): `starter-route-js.mjs` exit code, measured size vs budget per route
- [ ] Web Vitals (12.3): LCP, CLS, INP, TTFB per route, cold and warm with the median; tool used (chrome-devtools MCP, Playwright/CDP or Lighthouse); routes "not measured" and why
- [ ] Summary table (12.4) with every failing cell marked
- [ ] Baseline saved: the table and raw numbers in `$PERF_DIR` (outside the repo, next to the other results), in this run's own subdirectory `<core version>-<date>`. Compare with the most recent earlier run and report the change per route; if there is none, say this run is the first baseline. Find it by modification time, not by name (names sort wrongly when the version digits change, `beta.99` vs `beta.199`), and only count runs that finished, i.e. that hold a `route-js.json`:
  ```bash
  for d in $(ls -1t "$RESULTS_DIR/perf"); do
    [ "$d" != "$(basename "$PERF_DIR")" ] && [ -f "$RESULTS_DIR/perf/$d/route-js.json" ] && { echo "$d"; break; }
  done
  ```
- Repeat in the report: the figures come from a laptop and are indicative; the change between versions is what counts

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
| `zsh: no matches found: *.tgz` | zsh aborts a glob with no match | `setopt nonomatch` (Step 3) or `rm -f ./*.tgz` |
| `pnpm build` fails with `EMAIL_FROM_MISSING` / `*_PLACEHOLDER` | Auth readiness check: no login method can authenticate | Runtime-only build (Step 12); remove placeholder values from `.env` |
| `EUNSUPPORTEDPROTOCOL: workspace:*` | Used `npm pack` instead of `pnpm pack` | **Always use `pnpm pack`** - it converts `workspace:*` to real versions |
| `Module not found: @nextsparkjs/ui` | UI package not installed | Ensure UI tarball is in `.packages/` |
| `Module not found: better-auth/next-js` | Missing peer dependency | `pnpm add better-auth` |
| `Cannot find module 'cypress'` | Tests not excluded | Ensure tsconfig.json has `**/tests/**` in exclude |
| `@nextsparkjs/registries` not found / `Couldn't find any pages or app directory` | Host not generated | `pnpm exec nextspark prepare` (regenerates `src/app` and `.nextspark/registries`) |
| "0 console errors" but you never validated the capture | `agent-browser console` doesn't reliably capture output here | Prove it with a canary first, or use Playwright MCP's `browser_console_messages` — see Step 10 |
| A click seems to do nothing / a dialog closes unexpectedly | agent-browser click lands on the wrong element in a scrollable container (no scroll-into-view) | Use `agent-browser eval` with a real `.click()`, or Playwright MCP's `browser_click` — see Step 10 |
| CSP violation errors | Wrong APP_URL | Update `NEXT_PUBLIC_APP_URL` to match actual port |
| `.next/dev/lock` error | Stale lock from crashed server | Stop the old server by PID, `rm -rf .next` and restart |
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
| `nextspark prepare` CLI command (host generation: `src/app`, registries) | Yes | Local CLI |
| `nextspark db:migrate` CLI command | Yes | Local CLI |
| `nextspark dev` / `nextspark build` (auth readiness check) | Yes | Local CLI |
| Theme copying | Yes | Local templates |
| Database migrations | Yes | Local SQL files |
| Registry generation | Yes | Local generators |
| Dev server startup | Yes | Local Next.js |
| Page rendering (Playwright MCP) | Yes | Local app |
| Auth system (passwordless login by emailed code) | Yes | Local auth |
| Entity CRUD - Tasks | Yes | Local API |
| Entity CRUD - Pages + Page Builder | Yes | Local API |
| Superadmin panel + users list | Yes | Local admin |
| DevTools panel + config | Yes | Local devtools |
| Production build + `next start` smoke | Yes | Local build |

**External dependencies (NOT from NextSpark):**
- `next`, `react`, `react-dom` — framework (peer deps, installed via npm)
- `better-auth` — auth library (peer dep)
- `tailwindcss`, `eslint` — dev tools (installed by create or init)

---

## Optional: Against the published release

To test what npm serves instead of the local tarballs, skip Steps 3-5 and create the project **outside the repo**, with no `.packages` in sight:

```bash
export TEST_DIR="$HOME/published-check/test-package"   # Steps 6-12 run in $TEST_DIR: point it here
mkdir -p "$HOME/published-check" && cd "$HOME/published-check"
npx create-nextspark-app@<version> test-package --theme starter --yes
# or, with pnpm:
pnpm --config.minimum-release-age=0 dlx create-nextspark-app@<version> test-package --theme starter --yes
```

Pin `<version>` (for example `0.1.0-beta.196`). pnpm 11+ ignores versions published less than a day ago (`minimumReleaseAge`), so `pnpm dlx create-nextspark-app@latest` installs the **previous** release during the first day after a publish. Check `grep '@nextsparkjs' package.json` shows the version you asked for, then continue from Step 6. In this flow the Step 5 check "four `file:` tarball paths" (and the matching checklist item) becomes "four `@nextsparkjs/*` entries at `<version>`". Remove `$HOME/published-check` in Cleanup. For the performance baseline (Step 0.3) `CORE_VERSION` is the repo's version, not the published one: in this flow set it from the generated project and recompute the directory before Step 10.7: `CORE_VERSION=$(node -p "require('$TEST_DIR/node_modules/@nextsparkjs/core/package.json').version")`, then `PERF_DIR="${RESULTS_DIR}/perf/${CORE_VERSION}-$(date +%Y%m%d-%H%M)"`.

---

## Cleanup

After testing, optionally clean up:

```bash
# Under zsh, `rm -f dir/*.tgz` errors when nothing matches: allow empty matches first
setopt nonomatch 2>/dev/null || true

# Stop any server still running, by PID (Steps 11 and 12)
# Remove test project
rm -rf "$TEST_DIR"
rm -rf "$HOME/published-check"   # only if the published-release section was used

# Remove the worktree symlink from Step 0.3, if you created one
[ -L "$(dirname "$PROJECTS_DIR")/repo" ] && rm "$(dirname "$PROJECTS_DIR")/repo"

# Remove .packages tarballs
rm -rf "$PACKAGES_DIR"

# Remove individual package tarballs
rm -f "${REPO_ROOT}/packages/ui/"*.tgz
rm -f "${REPO_ROOT}/packages/core/"*.tgz
rm -f "${REPO_ROOT}/packages/cli/"*.tgz
rm -f "${REPO_ROOT}/packages/testing/"*.tgz
rm -f "${REPO_ROOT}/packages/create-nextspark-app/"*.tgz

# Drop the throwaway database if the run used one (name from the DATABASE_URL)
dropdb "<db name>"

# Playwright MCP screenshots land in the repo root: move them to your evidence folder, then check
git -C "$REPO_ROOT" status --short   # must be clean
```

## Maintainer note: building a 0.x fixture for `nextspark migrate`

This is for testing `nextspark migrate` from an old release (the oldest supported is `0.1.0-beta.183`), not part of the run above.
`create-nextspark-app@0.1.0-beta.183 --yes` is not non-interactive: it stops at the "Step 1/10 Project Type" prompt and exits 0 with "Wizard cancelled".
Create the fixture with the CLI of that release instead:

```bash
pnpm dlx @nextsparkjs/cli@0.1.0-beta.183 init --preset saas --type web --name <name> --slug <slug> --description "<text>" --theme default --yes
```

The wizard installs the *current* `@nextsparkjs/plugin-langchain`, which needs core >= `0.1.0-beta.192`, so the project resolves a mix of versions and the dev
server answers 500 (`Can't resolve '@nextsparkjs/registries/app-config.client'`). Remove `contents/plugins/langchain` and the `nextspark.plugins` entry
in `package.json` (and the dependency) before you use it.
