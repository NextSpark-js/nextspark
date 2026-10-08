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
- Looks for tarballs in `.packages/` directory automatically
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
3. Finds tarballs in `$REPO_ROOT/.packages/` (via `findLocalTarball`)
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

`src/app` is fully generated and git-ignored: after init it already exists (~180 files), and `nextspark prepare` (Step 8) regenerates it. Never edit it by hand.

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
- Phase 1: Core migrations (29 files)
- Phase 2: Entity migrations (9 for the starter theme: pages, posts, tasks)

**Seeded users** (table `users`, no password and no session: they sign in with an emailed code): `superadmin@nextspark.dev` (role `superadmin`), `developer@nextspark.dev` (role `developer`).

---

### Step 8: Build Registries

```bash
cd "$TEST_DIR"
pnpm exec nextspark prepare
pnpm exec nextspark prepare   # second run: must report "0 written" (everything unchanged)
```

**Verify:**
```bash
ls -la .nextspark/registries/*.ts
```

Should have 31 registry files and report `Generated src/app (~179 files) and 31 registries`. Check for NO path escaping errors (no `\v`, `\t` in file paths).

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
4. Fill the **Sign-in code** textbox with the 6 digits and submit.

**Expect:** redirect to `/dashboard`, heading "Welcome back, Super", sidebar links **Dashboard, Media, Pages, Posts, Tasks**.

#### 10.3 Entity CRUD Test: Tasks

**CRITICAL:** Test full CRUD operations to verify the data flow works end-to-end.

Selectors (`data-cy`): fields `tasks-field-title`, `tasks-field-description` (the inputs have **no `name` attribute**); detail page `tasks-edit`, `tasks-delete`; delete dialog `tasks-delete-confirm`. The submit button is `tasks-submit` with label **Create** on the create form and `tasks-form-submit` with label **Save Changes** on the edit form.

##### 10.3.1 Navigate to Tasks
`browser_navigate` to `http://localhost:3005/dashboard/tasks`, then `browser_snapshot`.
Verify: heading "Tasks", link "Add task", heading "No tasks found" or table with data.

##### 10.3.2 CREATE - Add New Task
Navigate directly to `http://localhost:3005/dashboard/tasks/create` (more reliable than clicking the link) and snapshot.
Verify: heading "Create task", form fields: Title*, Description, Status, Priority, etc.

Fill `[data-cy=tasks-field-title]` with `NPM Package Test Task` and `[data-cy=tasks-field-description]` with `Task created during NPM package test`, then click the button **Create**.

**Expect:** redirect to `/dashboard/tasks/<uuid>` with heading "NPM Package Test Task" and the Edit and Delete buttons.

##### 10.3.3 READ - Verify Task Detail
`browser_take_screenshot` (relative filename, then move it out of the repo).
Visually verify: Title, Description, Status "To Do", Priority "Medium", timestamps.

##### 10.3.4 UPDATE - Edit Task
Navigate directly to `http://localhost:3005/dashboard/tasks/<TASK_UUID>/edit` and snapshot.
Verify: form pre-filled with current values.

Replace the content of `[data-cy=tasks-field-title]` with `NPM Package Test Task - UPDATED` and click **Save Changes**.

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
Navigate to `http://localhost:3005/dashboard/pages`. Tick the row's checkbox (`tr:has-text("Test Landing") [role=checkbox]`), click `[data-cy=pages-bulk-delete]`, then `[data-cy=pages-bulk-delete-confirm]`. The row disappears from the list.

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

#### 10.7 Close Browser

`browser_close`.

#### 10.8 Full Verification Summary

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

---

### Step 11: Stop Dev Server

The dev server is three processes (pnpm -> nextspark -> `next-server`) and the port is held by the `next-server` child. Kill by PID, never by pattern, and never kill connected clients (the browser) along with it:

```bash
kill "$(cat "$TEST_DIR/dev.pid")" 2>/dev/null || true
lsof -tiTCP:${TEST_PORT} -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null || true   # LISTEN only
lsof -tiTCP:${TEST_PORT} -sTCP:LISTEN || echo "port ${TEST_PORT} free"
```

The dev log prints `[DB] SIGTERM received, initiating graceful shutdown ... Database pool closed` many times during normal use (27 in ~3 minutes in beta.195); it does not fail the run, but note the count in the report.

---

### Step 12: Test Production Build (CRITICAL)

The documented production build is `nextspark build` (the project's `pnpm build`): it runs `prepare --production` (registries, `src/app`, and the **auth readiness check**) and then `next build`. See `packages/core/docs/20-npm-distribution/06-prepare.md`.

```bash
cd "$TEST_DIR"
rm -rf .next
pnpm build 2>&1 | tee build.log
```

**The readiness check fails the build when no login method in `auth.methods` can authenticate.** The test `.env` has no `RESEND_FROM_EMAIL` and no Google credentials (and the console email provider does not count), so a plain `pnpm build` can stop with diagnostics such as `RESEND_FROM_EMAIL_MISSING` / `GOOGLE_CLIENT_ID_MISSING`. That is the product working as designed, not a defect. Then run the documented **runtime-only build** (providers whose credentials are injected only at runtime): delete any placeholder line such as `RESEND_API_KEY=re_dummy...` from `.env` (a placeholder fails even with the variable below; only *absent* values are deferred), then:

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
- Noise that does not fail the build but must be counted and reported: `grep -c MISSING_MESSAGE build.log`, `grep -c 'ReferenceError' build.log` (beta.195: 132 and 2)

**Start the production server and check it** (`next start` needs only the output of the build):
```bash
pnpm exec next start -p ${TEST_PORT} > start.log 2>&1 &
echo $! > prod.pid
sleep 3
for p in / /login /dashboard; do echo "$p $(curl -s -o /dev/null -w '%{http_code}' http://localhost:${TEST_PORT}$p)"; done
# Expected: / 200, /login 200, /dashboard 307
kill "$(cat prod.pid)" 2>/dev/null; lsof -tiTCP:${TEST_PORT} -sTCP:LISTEN | xargs kill 2>/dev/null || true
```

With the runtime-only build, `start.log` shows an `[auth-readiness] no login method can authenticate` error at startup: expected until the credentials are injected; the server keeps serving and the per-request gates refuse unusable methods.

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
- [ ] Migrations ran successfully (28 core + 9 entity)
- [ ] Registries built (31 files, no path errors)

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
| `pnpm build` fails with `RESEND_FROM_EMAIL_MISSING` / `*_PLACEHOLDER` | Auth readiness check: no login method can authenticate | Runtime-only build (Step 12); remove placeholder values from `.env` |
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

## Cleanup

After testing, optionally clean up:

```bash
# Under zsh, `rm -f dir/*.tgz` errors when nothing matches: allow empty matches first
setopt nonomatch 2>/dev/null || true

# Stop any server still running, by PID (Steps 11 and 12)
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

# Drop the throwaway database if the run used one (name from the DATABASE_URL)
dropdb "<db name>"

# Playwright MCP screenshots land in the repo root: move them to your evidence folder, then check
git -C "$REPO_ROOT" status --short   # must be clean
```
