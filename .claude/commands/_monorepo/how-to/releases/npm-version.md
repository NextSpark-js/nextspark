# NPM Version - Complete Guide

Increment package versions with semantic versioning across ALL 15 NextSpark packages.

## Complete Package Registry (15 packages)

ALL version operations MUST consider these packages:

### Core Packages (7)

| Package | Path | Description |
|---------|------|-------------|
| `@nextsparkjs/core` | `packages/core` | Core framework |
| `@nextsparkjs/ui` | `packages/ui` | UI component library |
| `@nextsparkjs/mobile` | `packages/mobile` | Mobile SDK (Expo) |
| `@nextsparkjs/testing` | `packages/testing` | Testing utilities and selectors |
| `@nextsparkjs/cli` | `packages/cli` | CLI tool |
| `create-nextspark-app` | `packages/create-nextspark-app` | Project generator |
| `@nextsparkjs/ai-workflow` | `packages/ai-workflow` | AI workflow agents, commands and skills |

### Themes (4)

| Package | Path |
|---------|------|
| `@nextsparkjs/theme-default` | `themes/default` |
| `@nextsparkjs/theme-blog` | `themes/blog` |
| `@nextsparkjs/theme-crm` | `themes/crm` |
| `@nextsparkjs/theme-productivity` | `themes/productivity` |

### Plugins (4)

| Package | Path |
|---------|------|
| `@nextsparkjs/plugin-ai` | `plugins/ai` |
| `@nextsparkjs/plugin-amplitude` | `plugins/amplitude` |
| `@nextsparkjs/plugin-langchain` | `plugins/langchain` |
| `@nextsparkjs/plugin-social-media-publisher` | `plugins/social-media-publisher` |

---

## Step-by-Step Process

### Step 1: List Current Versions

Read ALL 15 package.json files and display a table:

```bash
echo "=== ALL PACKAGE VERSIONS ==="
echo ""
echo "--- Core Packages ---"
echo "  @nextsparkjs/core:        $(node -p "require('./packages/core/package.json').version")"
echo "  @nextsparkjs/ui:          $(node -p "require('./packages/ui/package.json').version")"
echo "  @nextsparkjs/mobile:      $(node -p "require('./packages/mobile/package.json').version")"
echo "  @nextsparkjs/testing:     $(node -p "require('./packages/testing/package.json').version")"
echo "  @nextsparkjs/cli:         $(node -p "require('./packages/cli/package.json').version")"
echo "  create-nextspark-app:     $(node -p "require('./packages/create-nextspark-app/package.json').version")"
echo "  @nextsparkjs/ai-workflow: $(node -p "require('./packages/ai-workflow/package.json').version")"
echo ""
echo "--- Themes ---"
echo "  @nextsparkjs/theme-default:      $(node -p "require('./themes/default/package.json').version")"
echo "  @nextsparkjs/theme-blog:         $(node -p "require('./themes/blog/package.json').version")"
echo "  @nextsparkjs/theme-crm:          $(node -p "require('./themes/crm/package.json').version")"
echo "  @nextsparkjs/theme-productivity: $(node -p "require('./themes/productivity/package.json').version")"
echo ""
echo "--- Plugins ---"
echo "  @nextsparkjs/plugin-ai:                       $(node -p "require('./plugins/ai/package.json').version")"
echo "  @nextsparkjs/plugin-amplitude:                $(node -p "require('./plugins/amplitude/package.json').version")"
echo "  @nextsparkjs/plugin-langchain:                $(node -p "require('./plugins/langchain/package.json').version")"
echo "  @nextsparkjs/plugin-social-media-publisher:   $(node -p "require('./plugins/social-media-publisher/package.json').version")"
echo ""
echo "=== Git Context ==="
git describe --tags --abbrev=0 2>/dev/null || echo "No tags found"
git log $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~20")..HEAD --oneline
```

### Step 2: Ask User - Interactive Question

Use `AskUserQuestion` to ask the user what kind of version bump they want:

| Option | Description |
|--------|-------------|
| **Beta bump (all aligned)** | Increment pre-release tag on ALL 15 packages (e.g., `beta.85` -> `beta.86`). Default for development. |
| **Release (all aligned)** | Analyze commits to determine patch/minor/major, apply to ALL 15 packages. Removes pre-release tag. |
| **Release (only modified)** | Detect which packages have changes via `git diff`, bump only those. WARNING: this will desynchronize versions across packages. |
| **Versions are ready** | Do nothing. Only validate that versions are consistent. |

### Step 3: Detect Modified Packages (if "only modified" selected)

```bash
# Detect which packages have source changes since last tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~20")

echo "=== Modified packages since $LAST_TAG ==="
git diff --name-only $LAST_TAG..HEAD | grep -E "^(packages|themes|plugins)/" | cut -d/ -f1-2 | sort -u
```

Map changed paths to package names and only bump those.

### Step 4: Analyze Commits (for release bumps)

Classify commits using conventional commit prefixes:

| Prefix | Version Increment | Examples |
|--------|-------------------|----------|
| `feat:` | MINOR | New features |
| `fix:` | PATCH | Bug fixes |
| `docs:` | PATCH | Documentation only |
| `refactor:` | PATCH | Code restructuring |
| `perf:` | PATCH | Performance improvements |
| `chore:` | PATCH | Maintenance tasks |
| `BREAKING CHANGE` | MAJOR | Breaking API changes |

### Step 5: Execute Version Bump

For each package being bumped, update the `version` field in its `package.json`.

**IMPORTANT:** When bumping versions, also update `workspace:*` dependency references in all package.json files that reference other NextSpark packages. In the monorepo these use `workspace:*` protocol, but the versions must still be consistent for when `pnpm pack` resolves them to real versions.

**All 15 package.json paths:**

```
packages/core/package.json
packages/ui/package.json
packages/mobile/package.json
packages/testing/package.json
packages/cli/package.json
packages/create-nextspark-app/package.json
packages/ai-workflow/package.json
themes/default/package.json
themes/blog/package.json
themes/crm/package.json
themes/productivity/package.json
plugins/ai/package.json
plugins/amplitude/package.json
plugins/langchain/package.json
plugins/social-media-publisher/package.json
```

### Step 6: Verify and Commit

```bash
# Verify all versions
echo "=== Updated Versions ==="
for pkg in packages/core packages/ui packages/mobile packages/testing packages/cli packages/create-nextspark-app packages/ai-workflow; do
  echo "  $(node -p "require('./$pkg/package.json').name"): $(node -p "require('./$pkg/package.json').version")"
done
for pkg in themes/default themes/blog themes/crm themes/productivity; do
  echo "  $(node -p "require('./$pkg/package.json').name"): $(node -p "require('./$pkg/package.json').version")"
done
for pkg in plugins/ai plugins/amplitude plugins/langchain plugins/social-media-publisher; do
  echo "  $(node -p "require('./$pkg/package.json').name"): $(node -p "require('./$pkg/package.json').version")"
done

echo ""
echo "=== Files Modified ==="
git diff --name-only
```

Commit with: `chore: bump all packages to <version>`

---

## Pre-release Versions

If current version is a pre-release (e.g., `0.1.0-beta.85`):

| Option | Result | Use Case |
|--------|--------|----------|
| prerelease | 0.1.0-beta.86 | Continue beta testing |
| patch | 0.1.1 | Graduate to stable (bug fixes) |
| minor | 0.2.0 | Graduate to stable (new features) |
| major | 1.0.0 | Breaking changes |

---

## Next Steps After Versioning

If this command was invoked standalone (not from `npm-publish`):

| Step | Command | Description |
|------|---------|-------------|
| 1. Commit | `git add . && git commit` | Commit version changes |
| 2. Push | `git push origin main` | Push to remote |
| 3. Pack + Publish | `/do:npm-publish` | Full publish pipeline |

---

## Important Rules

1. **NEVER** modify package.json files without explicit user confirmation via interactive question
2. **ALWAYS** list ALL 15 packages with current versions before any operation
3. **ALWAYS** show current vs new version comparison before applying
4. **ALWAYS** update ALL 15 packages when doing aligned bumps
5. **ALWAYS** warn when "only modified" would desynchronize versions
6. **ALWAYS** commit version changes before proceeding to pack/publish
7. **NEVER** leave packages at inconsistent versions without explicit user acknowledgment
