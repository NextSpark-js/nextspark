# NPM Version - Complete Guide

Increment package versions with semantic versioning.

## Step-by-Step Process

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

### Step 3: Choose Version Options

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

### Step 4: Execute Version Increment

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

### Step 5: Verify Results

```bash
echo "=== Updated Versions ==="
echo "Core: $(node -p "require('./packages/core/package.json').version")"
echo "CLI: $(node -p "require('./packages/cli/package.json').version")"
echo "create-nextspark-app: $(node -p "require('./packages/create-nextspark-app/package.json').version")"

echo ""
echo "=== Files Modified ==="
git diff --name-only
```

## Pre-release Versions

If current version is a pre-release (e.g., `0.1.0-beta.3`):

| Option | Result | Use Case |
|--------|--------|----------|
| prerelease | 0.1.0-beta.4 | Continue beta testing |
| patch | 0.1.0 | Graduate to stable |
| minor | 0.2.0 | New features, skip to stable |

## Next Steps

| Step | Command | Description |
|------|---------|-------------|
| 1. Commit changes | `git add -A && git commit -m "chore: bump version to x.x.x"` | Commit version changes |
| 2. Create tag | `git tag vx.x.x` | Tag the release |
| 3. Repackage | `/npm:repackage` | Build new packages |
| 4. Publish | `/do:npm-publish` | Publish to npm |

## Important Rules

1. **NEVER** modify package.json files without explicit user confirmation
2. **ALWAYS** analyze commits to recommend appropriate version increment
3. **ALWAYS** show current vs new version comparison
4. **ALWAYS** update dependency references when core version changes
5. **ALWAYS** show next steps (commit, tag, repackage)
6. **ALWAYS** warn about version mismatches across packages
