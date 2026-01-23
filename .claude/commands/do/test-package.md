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

### Step 2: Build Core Package

```bash
cd "$REPO_ROOT/packages/core"
pnpm build:js
```

**Validation:** Build completes without errors. If build fails, stop here.

### Step 3: Pack Core Package

```bash
cd "$REPO_ROOT/packages/core"
pnpm pack
```

**Output:** Creates `nextsparkjs-core-X.Y.Z.tgz` file in `packages/core/`.

### Step 4: Create Fresh Next.js Project

```bash
cd "$PROJECTS_DIR"
npx create-next-app@latest test-package --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --yes
```

### Step 5: Install Core Tarball

```bash
cd "$PROJECTS_DIR/test-package"

# Find the tarball version dynamically
TARBALL=$(ls "$REPO_ROOT/packages/core"/nextsparkjs-core-*.tgz | head -1)
pnpm add "$TARBALL"
```

### Step 6: Run CLI Init

```bash
cd "$PROJECTS_DIR/test-package"
npx nextspark init
```

**Expected:** CLI copies structure, theme, configs to the project.

### Step 7: Copy and Configure Environment

```bash
cd "$PROJECTS_DIR/test-package"
cp "$REPO_ROOT/apps/dev/.env" .env

# Ensure PORT is set to 3000 for clean test project
# (avoids conflict with monorepo dev server on 5173)
# Portable sed: works on both Linux and macOS
if grep -q '^PORT=' .env 2>/dev/null; then
  sed -i.bak 's/^PORT=.*/PORT=3000/' .env && rm -f .env.bak
else
  echo "PORT=3000" >> .env
fi
```

**Important:** Verify DATABASE_URL points to valid database.

### Step 8: Run Database Migrations

```bash
cd "$PROJECTS_DIR/test-package"
pnpm db:migrate
```

**Validation:** All migrations run successfully, tables created.

### Step 9: Start Development Server

```bash
cd "$PROJECTS_DIR/test-package"
pnpm dev
```

**Expected:** Server starts on http://localhost:3000

### Step 10: Manual Verification Checklist

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

## Quick One-Liner (For Experienced Users)

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)" && \
PROJECTS_DIR="$(dirname "$REPO_ROOT")/projects" && \
mkdir -p "$PROJECTS_DIR" && \
cd "$PROJECTS_DIR" && rm -rf test-package && \
cd "$REPO_ROOT/packages/core" && pnpm build:js && pnpm pack && \
cd "$PROJECTS_DIR" && npx create-next-app@latest test-package --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --yes && \
cd test-package && pnpm add "$REPO_ROOT/packages/core"/nextsparkjs-core-*.tgz && \
npx nextspark init && cp "$REPO_ROOT/apps/dev/.env" .env && \
pnpm db:migrate && pnpm dev
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `nextspark: command not found` | Ensure core package installed: `pnpm list @nextsparkjs/core` |
| `create-next-app` fails | Check Node.js version (requires 18+), check internet connection |
| Tarball not found | Run Step 3 again, check `packages/core/` for `.tgz` file |
| `nextspark init` fails | Verify CLI is bundled in core package, check CLI build |
| Migration fails | Check DATABASE_URL in .env, ensure DB server running |
| `Module not found` | Run `pnpm install` again, check tarball version matches |
| Port already in use | Change PORT in .env or kill existing process on 3000 |
| Login fails | Run migrations again, check test users exist in DB |
| Database connection refused | Start PostgreSQL server, verify connection string |

---

## Success Criteria

The test passes if:
1. All 10 steps complete without errors
2. Dev server starts and serves pages at http://localhost:3000
3. Authentication flow works (login/logout)
4. CRUD operations function correctly:
   - Can create a new record
   - Can view record details
   - Can edit and save changes
   - Can delete a record
   - List shows pagination
5. No hydration mismatches or console errors

---

## After Testing

If test passes, the package is ready for publishing. Follow the npm-development-workflow:

```bash
cd "$REPO_ROOT"
# See /do:npm-version and /do:npm-publish for complete details
pnpm pkg:version -- patch  # or minor/major based on changes
pnpm pkg:pack              # Create .tgz files
pnpm pkg:publish           # Publish to npm registry
```

If test fails, fix issues in the repo and re-run `/do:test-package`.

---

## Cleanup

To remove the test project after validation:

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
