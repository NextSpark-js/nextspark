# NPM Publish - Complete Guide

Publish ALL 15 NextSpark packages to npm registry.

---

## CRITICAL RULES

### NEVER use `npm publish` directly

Using `npm publish` directly **BREAKS packages** because:
- `npm publish` does NOT resolve `workspace:*` protocol in dependencies
- Published packages will contain literal `"workspace:*"` strings instead of real version numbers
- Consumers will get installation errors

### MANDATORY: Use the automated scripts

The ONLY correct publish flow is:

```
pnpm pkg:pack    →  syncs templates + builds ALL packages + creates .tgz files
pnpm pkg:publish →  validates versions + publishes .tgz in correct order
```

`pnpm pkg:pack` uses `pnpm pack` internally which DOES resolve `workspace:*` → real versions.

---

## Complete Package Registry (15 packages)

See `npm-version.md` for the full list. All 15 packages are:

**Core (7):** core, ui, mobile, testing, cli, create-nextspark-app, ai-workflow
**Themes (4):** theme-default, theme-blog, theme-crm, theme-productivity
**Plugins (4):** plugin-ai, plugin-amplitude, plugin-langchain, plugin-social-media-publisher

---

## Step-by-Step Process

### Step 1: Version Check (MANDATORY first step)

Before publishing, versions MUST be defined. Execute the `npm-version` flow:

1. List all 15 packages with current versions
2. Ask user interactively: beta bump / release / versions ready / other
3. If bump needed: update all package.json files and commit

This step can be skipped ONLY if the user explicitly confirms versions are already set.

**If invoked via `/do:npm-publish`**, this step runs automatically by following the `npm-version` how-to first.

### Step 2: Verify Prerequisites

```bash
# Check npm authentication
echo "=== NPM Authentication ==="
npm whoami 2>/dev/null || echo "NOT LOGGED IN - run: npm login"

# Check git is clean (versions should already be committed)
echo ""
echo "=== Git Status ==="
git status --porcelain
if [ -n "$(git status --porcelain)" ]; then
  echo "WARNING: Uncommitted changes detected. Commit before publishing."
fi

# Check currently published versions on npm
echo ""
echo "=== Currently Published (beta tag) ==="
npm view @nextsparkjs/core dist-tags --json 2>/dev/null || echo "Not published yet"
```

### Step 3: Pack (sync + build + .tgz)

```bash
# This command does ALL of the following automatically:
#   1. Syncs templates from apps/dev/ → packages/core/templates/ (CRITICAL)
#   1b. Syncs .claude/ → packages/ai-workflow/claude/ (CRITICAL)
#   2. Builds ALL 15 packages in dependency order
#   3. Creates .tgz files in .packages/ directory
#   4. Resolves workspace:* → real version numbers
pnpm pkg:pack
```

**What `pnpm pkg:pack` does internally (`scripts/packages/pack.sh`):**

| Step | Action | Why |
|------|--------|-----|
| 1a | `sync:templates --sync` | Copies `apps/dev/app/` → `packages/core/templates/app/` so generated projects have all files |
| 1b | `ai-workflow/scripts/sync.mjs` | Copies `.claude/` → `packages/ai-workflow/claude/` so agents/commands/skills are up-to-date |
| 2 | Build ui | Other packages depend on it |
| 3 | Build mobile | Core depends on it |
| 4 | Build core | Most packages depend on it |
| 5 | Build cli, create-app | Depend on core |
| 6 | Build themes + plugins | Depend on core |
| 7 | `pnpm pack` each package | Creates .tgz with resolved dependencies |

### Step 4: Publish

```bash
# Determine the tag based on version type
# If version contains "beta" → use --tag beta
# If version contains "alpha" → use --tag alpha
# If stable version → use --tag latest

# This command does ALL of the following automatically:
#   1. Validates all versions are consistent
#   2. Verifies npm authentication
#   3. Publishes .tgz files in correct dependency order
#   4. Reports success/failure for each package
pnpm pkg:publish
```

**If you need a specific tag:**
```bash
# The publish script accepts options via the .packages directory
# Edit the tag in the script or publish manually with pnpm:
pnpm pkg:publish  # Uses publish.sh which defaults to 'latest' tag
```

**Manual override (only if script doesn't support needed options):**
```bash
# ONLY use pnpm publish (NEVER npm publish)
cd .packages
for tgz in *.tgz; do
  pnpm publish "$tgz" --tag beta --access public --no-git-checks
done
```

### Step 5: Verify Publication

```bash
echo "=== Verify Published Versions ==="
echo ""
echo "--- Core Packages ---"
npm view @nextsparkjs/core dist-tags --json 2>/dev/null
npm view @nextsparkjs/ui dist-tags --json 2>/dev/null
npm view @nextsparkjs/mobile dist-tags --json 2>/dev/null
npm view @nextsparkjs/testing dist-tags --json 2>/dev/null
npm view @nextsparkjs/cli dist-tags --json 2>/dev/null
npm view create-nextspark-app dist-tags --json 2>/dev/null
npm view @nextsparkjs/ai-workflow dist-tags --json 2>/dev/null
echo ""
echo "--- Themes ---"
npm view @nextsparkjs/theme-default dist-tags --json 2>/dev/null
npm view @nextsparkjs/theme-blog dist-tags --json 2>/dev/null
npm view @nextsparkjs/theme-crm dist-tags --json 2>/dev/null
npm view @nextsparkjs/theme-productivity dist-tags --json 2>/dev/null
echo ""
echo "--- Plugins ---"
npm view @nextsparkjs/plugin-ai dist-tags --json 2>/dev/null
npm view @nextsparkjs/plugin-amplitude dist-tags --json 2>/dev/null
npm view @nextsparkjs/plugin-langchain dist-tags --json 2>/dev/null
npm view @nextsparkjs/plugin-social-media-publisher dist-tags --json 2>/dev/null
```

### Step 6: Test Installation

```bash
# Quick smoke test
npx create-nextspark-app@beta test-install --yes
```

---

## Publish Order (handled by script)

The `publish.sh` script publishes in this order:

1. `@nextsparkjs/core` (no dependencies)
2. `@nextsparkjs/ui` (depends on core)
3. `@nextsparkjs/mobile` (depends on core)
4. `@nextsparkjs/testing` (depends on core)
5. `@nextsparkjs/cli` (depends on core)
6. `create-nextspark-app` (depends on cli)
7. `@nextsparkjs/ai-workflow` (standalone)
8. All themes (depend on core)
9. All plugins (depend on core)

---

## Error Scenarios

### `workspace:*` in published package
> **Root cause**: Used `npm publish` instead of `pnpm pkg:pack` + `pnpm pkg:publish`.
> **Fix**: Unpublish broken version, re-publish using the correct scripts.

### Missing template files in generated project
> **Root cause**: `sync:templates` was not run before build.
> **Fix**: `pnpm pkg:pack` runs sync automatically. Never use `--skip-build`.

### Version mismatch
> **Root cause**: Not all 15 packages were bumped.
> **Fix**: Run `/do:npm-version` to align all versions.

### Not logged in to npm
```bash
npm login
```

---

## Important Rules

1. **NEVER** use `npm publish` directly — it BREAKS packages (workspace:* leak)
2. **ALWAYS** use `pnpm pkg:pack` → `pnpm pkg:publish` pipeline
3. **ALWAYS** run version check (Step 1) before publishing
4. **ALWAYS** verify npm authentication before attempting publish
5. **ALWAYS** verify ALL 15 packages were published successfully
6. **ALWAYS** test installation after publish
7. **NEVER** skip `pnpm pkg:pack` — it handles template sync + build + workspace resolution
8. **NEVER** publish without explicit user confirmation
