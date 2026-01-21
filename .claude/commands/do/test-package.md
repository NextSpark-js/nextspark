---
description: "Test npm package from scratch - creates fresh Next.js project and validates full flow"
---

# do:test-package

**Context:** {{{ input }}}

---

## Purpose

Test the npm package distribution by creating a fresh Next.js project and validating the complete installation and runtime flow. This simulates exactly what a new user would experience when installing NextSpark from npm.

---

## MANDATORY: Read Skill First

Read `.claude/skills/npm-development-workflow/SKILL.md` for context on dual-mode testing.

---

## Execution Steps

Execute these steps in order. Stop and report if any step fails.

### Step 1: Clean Previous Test Project

```bash
# Remove existing test project
cd G:/GitHub/nextspark/projects
rm -rf test-package
```

### Step 2: Build Core Package

```bash
cd G:/GitHub/nextspark/repo/packages/core
pnpm build:js
```

**Validation:** Build completes without errors.

### Step 3: Pack Core Package

```bash
cd G:/GitHub/nextspark/repo/packages/core
pnpm pack
```

**Output:** Creates `nextsparkjs-core-X.Y.Z.tgz` file.

### Step 4: Create Fresh Next.js Project

```bash
cd G:/GitHub/nextspark/projects
npx create-next-app@latest test-package --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
```

**Note:** Use `--yes` or provide answers non-interactively if needed.

### Step 5: Install Core Tarball

```bash
cd G:/GitHub/nextspark/projects/test-package

# Find the tarball version dynamically
TARBALL=$(ls ../../repo/packages/core/nextsparkjs-core-*.tgz | head -1)
pnpm add "$TARBALL"
```

### Step 6: Run CLI Init

```bash
cd G:/GitHub/nextspark/projects/test-package
npx nextspark init
```

**Expected:** CLI copies structure, theme, configs to the project.

### Step 7: Copy Environment File

```bash
cd G:/GitHub/nextspark/projects/test-package
cp ../../repo/apps/dev/.env .env
```

**Important:** Verify DATABASE_URL points to valid database.

### Step 8: Run Database Migrations

```bash
cd G:/GitHub/nextspark/projects/test-package
pnpm db:migrate
```

**Validation:** All migrations run successfully, tables created.

### Step 9: Start Development Server

```bash
cd G:/GitHub/nextspark/projects/test-package
pnpm dev
```

**Expected:** Server starts on port 3000 (or as configured in .env).

### Step 10: Manual Verification Checklist

Open browser at http://localhost:3000 and verify:

- [ ] Homepage loads without errors
- [ ] No console errors in browser DevTools
- [ ] No server errors in terminal
- [ ] Login page accessible at /login
- [ ] Can login with test user: `superadmin@tmt.dev` / `Test1234`
- [ ] Dashboard loads after login
- [ ] Sidebar shows entities
- [ ] Can create/edit/delete records

---

## Quick One-Liner (For Experienced Users)

```bash
cd G:/GitHub/nextspark/projects && rm -rf test-package && \
cd ../repo/packages/core && pnpm build:js && pnpm pack && \
cd ../../projects && npx create-next-app@latest test-package --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --yes && \
cd test-package && pnpm add ../../repo/packages/core/nextsparkjs-core-*.tgz && \
npx nextspark init && cp ../../repo/apps/dev/.env .env && \
pnpm db:migrate && pnpm dev
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `nextspark: command not found` | Ensure core package installed: `pnpm list @nextsparkjs/core` |
| Migration fails | Check DATABASE_URL in .env, ensure DB server running |
| `Module not found` | Run `pnpm install` again, check tarball version matches |
| Port already in use | Change PORT in .env or kill existing process |
| Login fails | Run migrations again, check test users exist in DB |

---

## Success Criteria

The test passes if:
1. All 10 steps complete without errors
2. Dev server starts and serves pages
3. Authentication flow works (login/logout)
4. CRUD operations function correctly
5. No hydration mismatches or console errors

---

## After Testing

If test passes, the package is ready for publishing:
```bash
cd G:/GitHub/nextspark/repo
pnpm pkg:version -- patch  # or minor/major
pnpm pkg:publish
```

If test fails, fix issues and re-run `/do:test-package`.
