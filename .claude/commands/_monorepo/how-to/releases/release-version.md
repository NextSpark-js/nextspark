# Release Version - Complete Guide

Create a new core version release with semantic versioning.

## Prerequisites (NON-NEGOTIABLE)

### Check 1: Clean Git Working Directory

```bash
git status --porcelain
```

If output is NOT empty:
> Cannot create release with uncommitted changes.
> Commit all changes first, then retry.

### Check 2: Correct Branch

```bash
git rev-parse --abbrev-ref HEAD
```

Must be 'main' or 'master'. If on different branch:
> Releases must be from main/master branch.

### Check 3: Version File Exists

Check for `core.version.json`. If doesn't exist, create:
```json
{ "version": "0.0.0" }
```

## Step-by-Step Process

### Step 1: Get Current Version

```bash
cat core.version.json
```

### Step 2: Analyze Changes

```bash
# Get last tag
git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0"

# Get commits since last release
git log $(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")..HEAD --oneline

# Get changed files
git diff $(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")..HEAD --name-only
```

### Step 3: Categorize Changes

| Category | Commits | Version Impact |
|----------|---------|----------------|
| BREAKING CHANGE | Any with `BREAKING` or `!:` | MAJOR |
| Features | `feat:` commits | MINOR |
| Fixes | `fix:` commits | PATCH |
| Docs | `docs:` commits | No version |
| Chore | Other commits | No version |

### Step 4: Determine Version Bump

**SemVer Rules:**
- MAJOR: Breaking changes (incompatible API changes)
- MINOR: New features (backwards compatible)
- PATCH: Bug fixes (backwards compatible)

```
if (breaking.length > 0) → MAJOR
else if (features.length > 0) → MINOR
else → PATCH
```

### Step 5: Calculate New Version

| Bump Type | Current | New |
|-----------|---------|-----|
| major | 1.2.3 | 2.0.0 |
| minor | 1.2.3 | 1.3.0 |
| patch | 1.2.3 | 1.2.4 |

### Step 6: Execute Release

```bash
# Update version file
echo '{ "version": "X.Y.Z" }' > core.version.json

# Commit version change
git add core.version.json && git commit -m "chore: release vX.Y.Z"

# Create tag
git tag -a vX.Y.Z -m "Release vX.Y.Z"

# Push to remote
git push origin main --tags
```

### Step 7: Next Steps

After release:
1. Create GitHub Release (optional):
   ```bash
   gh release create vX.Y.Z --generate-notes
   ```
2. Announce release to team/users
3. Update changelog if maintained separately

## Semantic Versioning Reference

### MAJOR Version (X.0.0)
Increment when making incompatible API changes:
- Removing public API
- Changing function signatures
- Breaking database schema changes
- Removing features

### MINOR Version (x.Y.0)
Increment when adding backwards-compatible functionality:
- New features
- New API endpoints
- New optional parameters
- New components

### PATCH Version (x.y.Z)
Increment when making backwards-compatible bug fixes:
- Bug fixes
- Security patches
- Performance improvements
- Documentation updates

## Error Handling

### Uncommitted Changes
```
Steps to fix:
  1. git add .
  2. git commit -m "description"
  3. /do:release-version again
```

### Wrong Branch
```
Steps to fix:
  1. git checkout main
  2. git merge feature/my-feature
  3. git push origin main
  4. /do:release-version again
```

### No Changes
> Continue with patch release anyway? (user confirmation required)
