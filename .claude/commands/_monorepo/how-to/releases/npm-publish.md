# NPM Publish - Complete Guide

Publish all 12 NextSpark packages to npm registry.

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
pnpm pkg:pack             →  syncs templates + builds ALL packages + creates .tgz files
pnpm pkg:verify-tarballs  →  verifies the .tgz files are installable and leak nothing maintainer-local
pnpm pkg:publish          →  validates versions + publishes .tgz in correct order
```

`pnpm pkg:pack` uses `pnpm pack` internally which DOES resolve `workspace:*` → real versions.

---

## Complete Package Registry (12 packages)

See `npm-version.md` for the full list. The 12 publishable packages are:

**Core (7):** core, ui, mobile, testing, cli, create-nextspark-app, ai-workflow
**Project templates:** bundled inside `@nextsparkjs/core`; not published separately
**Plugins (5):** plugin-ai, plugin-amplitude, plugin-langchain, plugin-social-media-publisher, plugin-walkme

---

## Step-by-Step Process

### Step 1: Version Check (MANDATORY first step)

Before publishing, versions MUST be defined. Execute the `npm-version` flow:

1. List all 12 packages with current versions
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
#   2. Builds all 12 publishable packages in dependency order
#   3. Creates .tgz files in .packages/ directory
#   4. Resolves workspace:* → real version numbers
pnpm pkg:pack
```

**What `pnpm pkg:pack` does internally (`scripts/packages/pack.sh`):**

| Step | Action | Why |
|------|--------|-----|
| 1a | (removed in beta.192) | Core ships no `templates/app`: `pack.sh` refuses to pack while one exists and `pkg:verify-tarballs` fails a core tarball that has it |
| 1b | `ai-workflow/scripts/sync.mjs` | Copies `.claude/` → `packages/ai-workflow/claude/` so agents/commands/skills are up-to-date |
| 2 | Build ui | Other packages depend on it |
| 3 | Build mobile | Core depends on it |
| 4 | Build core | Most packages depend on it |
| 5 | Build cli, create-app | Depend on core |
| 6 | Build plugins | Depend on core |
| 7 | `pnpm pack` each package | Creates .tgz with resolved dependencies |

### Step 3.5: Verify the tarballs (release gate G3)

```bash
# Checks, for every .tgz in .packages/:
#   - every path main/module/types/bin/exports (incl. wildcard subpaths)
#     points at a file that actually exists in the tarball
#   - workspace:/link:/file: protocols did not survive in the packed
#     package.json, and internal @nextsparkjs/* dependencies point at the
#     version being packed in this run
#   - no maintainer-local absolute path, stray .env file, or
#     private-key/credential-looking material shipped (matches are masked)
#   - reports tarball size and file count per package
pnpm pkg:verify-tarballs
```

A justified false positive can be silenced with a committed, explicit entry
(exact package + finding type + match, with a required `reason`) in
`scripts/packages/verify-tarballs.allowlist.json` — never with a blanket glob.
The command exits non-zero on any unallowlisted finding, so do not proceed to
Step 4 until it passes.

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
pnpm pkg:publish --tag beta                       # beta only
pnpm pkg:publish --tag latest --also-tag beta     # latest AND move beta to the same version
pnpm pkg:publish --tag latest --also-tag beta --dry-run --skip-auth-check   # preview, no login needed
```

`--also-tag <tag>` runs `npm dist-tag add <pkg>@<version> <tag>` after each package is published
(`--dry-run` only prints those commands). `--skip-auth-check` skips `npm whoami` and is only accepted
with `--dry-run`. If a publish fails the run stops, so no package goes live before a dependency it pins.

**Resuming after a partial publish:** re-run the same command with the same `.packages` (use `--no-cleanup`
on the first run if unsure). Before each package the script runs `npm view <name>@<version> version`; a version
already on the registry is reported as `[SKIP] already published` and still gets `--also-tag`. Dist-tag
commands that failed (e.g. an expired OTP) are listed at the end so they can be re-run.

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
echo "--- Plugins ---"
npm view @nextsparkjs/plugin-ai dist-tags --json 2>/dev/null
npm view @nextsparkjs/plugin-amplitude dist-tags --json 2>/dev/null
npm view @nextsparkjs/plugin-social-media-publisher dist-tags --json 2>/dev/null
npm view @nextsparkjs/plugin-walkme dist-tags --json 2>/dev/null
```

### Step 6: Test Installation

```bash
# Quick smoke test
pnpm dlx create-nextspark-app@latest test-install --yes
cd test-install && pnpm install
# A fresh project has no auth provider env, so the production auth preflight (#202) would fail the build;
# declare the runtime-only providers for the smoke test:
NEXTSPARK_AUTH_RUNTIME_ONLY=email,google pnpm exec nextspark build
```

---

## Publish Order (handled by script)

`publish.sh` computes the order from the tarballs: each package's `dependencies`, `peerDependencies`
and `optionalDependencies` on other `@nextsparkjs/*` packages in the set (`scripts/packages/publish-order.mjs`).
A package is published after everything it pins (e.g. `ui` before `core`, `core` before the plugins,
`cli` before `create-nextspark-app`), and a dependency cycle aborts before anything is published.

---

## Error Scenarios

### `workspace:*` in published package
> **Root cause**: Used `npm publish` instead of `pnpm pkg:pack` + `pnpm pkg:publish`.
> **Fix**: Unpublish broken version, re-publish using the correct scripts.

### Missing template files in generated project
> **Root cause**: (historical) `sync:templates` was not run before build; it no longer exists.
> **Fix**: `pnpm pkg:pack` runs sync automatically. Never use `--skip-build`.

### Version mismatch
> **Root cause**: Not all 16 packages were bumped.
> **Fix**: Run `/do:npm-version` to align all versions.

### Not logged in to npm
```bash
npm login
```

---

## Important Rules

1. **NEVER** use `npm publish` directly — it BREAKS packages (workspace:* leak)
2. **ALWAYS** use `pnpm pkg:pack` → `pnpm pkg:verify-tarballs` → `pnpm pkg:publish` pipeline
3. **ALWAYS** run version check (Step 1) before publishing
4. **ALWAYS** verify npm authentication before attempting publish
5. **ALWAYS** verify ALL 16 packages were published successfully
6. **ALWAYS** test installation after publish
7. **NEVER** skip `pnpm pkg:pack` — it handles template sync + build + workspace resolution
8. **NEVER** skip `pnpm pkg:verify-tarballs` — it is release gate G3 (installable, reproducible, no leaked secrets)
9. **NEVER** publish without explicit user confirmation
