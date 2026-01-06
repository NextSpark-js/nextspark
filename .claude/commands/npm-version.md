---
description: Increment package versions with semantic versioning
---

# NPM Version Command

## Your Role

You are an assistant for managing NextSpark package versions. You analyze commits to recommend version increments and ensure consistent versioning across the monorepo.

## Mandatory Process

### Step 1: Context Analysis

Execute these commands to understand version state:

```bash
# Get current versions
echo "=== Current Versions ==="
echo "Core: $(node -p "require('./packages/core/package.json').version")"
echo "CLI: $(node -p "require('./packages/cli/package.json').version")"
echo "create-nextspark-app: $(node -p "require('./packages/create-nextspark-app/package.json').version")"

# Get last tag
echo ""
echo "=== Last Tag ==="
git describe --tags --abbrev=0 2>/dev/null || echo "No tags found"

# Get commits since last tag
echo ""
echo "=== Commits Since Last Tag ==="
git log $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~20")..HEAD --oneline

# Check for uncommitted changes
echo ""
echo "=== Uncommitted Changes ==="
git status --porcelain
```

### Step 2: Analyze Commits

Classify commits using conventional commit prefixes:

| Prefix | Version Increment | Examples |
|--------|-------------------|----------|
| `feat:` | MINOR | New features |
| `fix:` | PATCH | Bug fixes |
| `docs:` | PATCH | Documentation only |
| `style:` | PATCH | Formatting, no logic change |
| `refactor:` | PATCH | Code restructuring |
| `perf:` | PATCH | Performance improvements |
| `test:` | PATCH | Adding/updating tests |
| `chore:` | PATCH | Maintenance tasks |
| `BREAKING CHANGE` | MAJOR | Breaking API changes |

**Commit Analysis Table:**

| Commit | Type | Impact |
|--------|------|--------|
| abc123 feat: add new API | feat | MINOR |
| def456 fix: resolve bug | fix | PATCH |
| ... | ... | ... |

**Recommendation:**

Based on the analysis, the recommended version increment is: **[PATCH/MINOR/MAJOR]**

| Current Version | Recommended Version | Reason |
|-----------------|---------------------|--------|
| 0.1.0-beta.3 | 0.1.0-beta.4 | Bug fixes only |

### Step 3: Present Version Options

**Version Increment Options:**

| Option | Current | New Version | Description |
|--------|---------|-------------|-------------|
| 1. patch | 0.1.0 | 0.1.1 | Bug fixes, small changes |
| 2. minor | 0.1.0 | 0.2.0 | New features (backwards compatible) |
| 3. major | 0.1.0 | 1.0.0 | Breaking changes |
| 4. prerelease (beta) | 0.1.0-beta.3 | 0.1.0-beta.4 | Pre-release increment |
| 5. custom | - | x.x.x | Specify exact version |

**Scope Options:**

| Scope | Description |
|-------|-------------|
| all | Update all packages to same version |
| core | Only @nextsparkjs/core |
| cli | Only @nextsparkjs/cli |
| create-app | Only create-nextspark-app |

### Step 4: Wait for Confirmation

**STOP HERE AND WAIT.**

Ask the user:
> "Which version increment would you like? (1-5) And which scope? (all/core/cli/create-app)"

**DO NOT proceed until the user explicitly confirms.**

### Step 5: Execute Version Increment

Based on user selection:

**Update package.json files:**

```bash
# For core
cd packages/core
npm version <patch|minor|major|prerelease> --no-git-tag-version

# For CLI
cd packages/cli
npm version <patch|minor|major|prerelease> --no-git-tag-version

# For create-nextspark-app
cd packages/create-nextspark-app
npm version <patch|minor|major|prerelease> --no-git-tag-version
```

**Update dependency references:**

If core version changes, update references in:
- `packages/cli/package.json`
- `packages/create-nextspark-app/package.json`
- `themes/*/package.json`
- `plugins/*/package.json`

### Step 6: Show Results

```bash
echo "=== Updated Versions ==="
echo "Core: $(node -p "require('./packages/core/package.json').version")"
echo "CLI: $(node -p "require('./packages/cli/package.json').version")"
echo "create-nextspark-app: $(node -p "require('./packages/create-nextspark-app/package.json').version")"

echo ""
echo "=== Files Modified ==="
git diff --name-only
```

**Changes Summary:**

| Package | Previous | New |
|---------|----------|-----|
| @nextsparkjs/core | 0.1.0-beta.3 | 0.1.0-beta.4 |
| @nextsparkjs/cli | 0.1.0-beta.3 | 0.1.0-beta.4 |
| create-nextspark-app | 0.1.0-beta.3 | 0.1.0-beta.4 |

### Step 7: Next Steps

| Next Step | Command | Description |
|-----------|---------|-------------|
| 1. Commit changes | `git add -A && git commit -m "chore: bump version to x.x.x"` | Commit version changes |
| 2. Create tag | `git tag vx.x.x` | Tag the release |
| 3. Repackage | `/npm:repackage` | Build new packages |
| 4. Publish | `/npm:publish` | Publish to npm |

---

## Scenarios

### Scenario A: Pre-release Version

If current version is a pre-release (e.g., `0.1.0-beta.3`):

> "Current version is a pre-release. Options for next version:"

| Option | Result | Use Case |
|--------|--------|----------|
| prerelease | 0.1.0-beta.4 | Continue beta testing |
| patch | 0.1.0 | Graduate to stable |
| minor | 0.2.0 | New features, skip to stable |

### Scenario B: Version Mismatch Across Packages

If package versions are not in sync:

> "Warning: Package versions are out of sync:"

| Package | Version |
|---------|---------|
| core | 0.1.0-beta.3 |
| cli | 0.1.0-beta.2 |
| create-app | 0.1.0-beta.1 |

> "Recommend syncing all to highest version (0.1.0-beta.3) or incrementing all together."

### Scenario C: Uncommitted Changes

If there are uncommitted changes:

> "Warning: You have uncommitted changes. Commit or stash them before version bump to avoid confusion."

---

## Important Rules

1. **NEVER** modify package.json files without explicit user confirmation
2. **ALWAYS** analyze commits to recommend appropriate version increment
3. **ALWAYS** show current vs new version comparison
4. **ALWAYS** update dependency references when core version changes
5. **ALWAYS** show next steps (commit, tag, repackage)
6. **ALWAYS** warn about version mismatches across packages
