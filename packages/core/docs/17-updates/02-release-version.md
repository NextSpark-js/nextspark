# Release Version Command

## Introduction

The `release` command manages version increments for core framework releases following **Semantic Versioning** (SemVer). It automatically updates `core.version.json`, creates a Git commit, and tags the release for distribution.

This command is primarily used by framework maintainers but can also be used by teams maintaining their own internal forks of the boilerplate.

**Semantic Versioning Format:** `MAJOR.MINOR.PATCH`

---

## Quick Reference

```bash
# Semantic increment
pnpm release --patch                # 0.1.0 → 0.1.1
pnpm release --minor                # 0.1.0 → 0.2.0
pnpm release --major                # 0.1.0 → 1.0.0

# Specific version
pnpm release --version 2.5.3        # Sets v2.5.3

# Information
pnpm release --current              # Show current version
pnpm release --help                 # Help

# Short aliases
pnpm release -p                     # --patch
pnpm release -m                     # --minor
pnpm release -M                     # --major
```

---

## Semantic Versioning Explained

Semantic Versioning follows the format: `MAJOR.MINOR.PATCH`

### MAJOR Version (`1.0.0` → `2.0.0`)

Increment when making **breaking changes** that require user action.

**Examples:**
- Removing or renaming core APIs
- Changing database schema in non-backward-compatible ways
- Removing support for Node.js versions
- Major refactoring requiring configuration changes

**Use when:**
- Users need to modify their code
- Migration guide is required
- Existing functionality breaks

```bash
pnpm release --major
pnpm release -M
```

---

### MINOR Version (`0.1.0` → `0.2.0`)

Increment when adding **new features** in a backward-compatible manner.

**Examples:**
- New plugins or themes
- New API endpoints
- New configuration options (with defaults)
- New components or utilities
- Optional new features

**Use when:**
- Adding functionality without breaking existing code
- Users can adopt new features at their pace
- No migration required

```bash
pnpm release --minor
pnpm release -m
```

---

### PATCH Version (`0.1.0` → `0.1.1`)

Increment when making **bug fixes** or minor improvements.

**Examples:**
- Bug fixes
- Security patches
- Documentation updates
- Performance improvements
- Internal refactoring (no API changes)
- Dependency updates

**Use when:**
- Fixing issues without changing functionality
- Making internal improvements
- Updating documentation

```bash
pnpm release --patch
pnpm release -p
```

---

## Command Flags

### Version Increment Flags

#### `--patch` or `-p`

Increment the patch version.

```bash
# Current: 0.1.0
pnpm release --patch
# Result: 0.1.1

# Short alias
pnpm release -p
```

#### `--minor` or `-m`

Increment the minor version (resets patch to 0).

```bash
# Current: 0.1.5
pnpm release --minor
# Result: 0.2.0

# Short alias
pnpm release -m
```

#### `--major` or `-M`

Increment the major version (resets minor and patch to 0).

```bash
# Current: 0.5.3
pnpm release --major
# Result: 1.0.0

# Short alias
pnpm release -M
```

**Note:** Capital `-M` for major to distinguish from `-m` (minor).

---

### Specific Version Flag

#### `--version <version>`

Set a specific version directly, bypassing incremental logic.

```bash
pnpm release --version 2.5.3
# Sets version to: v2.5.3

pnpm release --version 1.0.0
# Sets version to: v1.0.0
```

**Use when:**
- Aligning with external versioning scheme
- Correcting a version mistake
- Setting initial version

**Format:** Accepts versions with or without `v` prefix:
- `2.5.3` → `v2.5.3`
- `v2.5.3` → `v2.5.3`

---

### Information Flags

#### `--current`

Display the current version from `core.version.json`.

```bash
pnpm release --current
```

**Output:**
```text
Current core version: v0.1.0
```

#### `--help` or `-h`

Display help information.

```bash
pnpm release --help
pnpm release -h
```

---

## Usage Examples

### Semantic Version Bumps

**1. Bug fix release:**
```bash
# Fixed authentication bug, updated docs
pnpm release --patch
# 0.1.0 → 0.1.1
```

**2. New feature release:**
```bash
# Added new email plugin, new API endpoints
pnpm release --minor
# 0.1.5 → 0.2.0
```

**3. Breaking changes release:**
```bash
# Refactored entity system, requires migration
pnpm release --major
# 0.5.0 → 1.0.0
```

---

### Using Short Aliases

**4. Quick patch:**
```bash
pnpm release -p
```

**5. Quick minor:**
```bash
pnpm release -m
```

**6. Quick major:**
```bash
pnpm release -M
```

---

### Specific Versions

**7. Set version for initial release:**
```bash
pnpm release --version 1.0.0
```

**8. Align with external version:**
```bash
# Company decided to start at v2.0.0
pnpm release --version 2.0.0
```

---

### Checking Current Version

**9. Verify version before release:**
```bash
# Check current version
pnpm release --current

# Make decision based on output
pnpm release --minor
```

---

## Expected Output

### Successful Patch Release

```bash
pnpm release --patch
```

**Output:**
```text
🔄 NextSpark Version Release v2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Current version: v0.1.0
🎯 New version: v0.1.1

📝 Updating core.version.json...
✓ Version file updated

📦 Creating Git commit...
✓ Commit created: "chore: release v0.1.1"

🏷️  Creating Git tag...
✓ Tag created: v0.1.1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 Release v0.1.1 created successfully!

📖 Next steps:
   1. Review the commit: git show HEAD
   2. Push the release: git push origin main --tags
   3. Create GitHub Release (optional)
```

---

### Successful Minor Release

```bash
pnpm release --minor
```

**Output:**
```text
🔄 NextSpark Version Release v2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Current version: v0.1.5
🎯 New version: v0.2.0

📝 Updating core.version.json...
✓ Version file updated

📦 Creating Git commit...
✓ Commit created: "chore: release v0.2.0"

🏷️  Creating Git tag...
✓ Tag created: v0.2.0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 Release v0.2.0 created successfully!

📖 Next steps:
   1. Review the commit: git show HEAD
   2. Push the release: git push origin main --tags
   3. Create GitHub Release (optional)
```

---

### Successful Major Release

```bash
pnpm release --major
```

**Output:**
```text
🔄 NextSpark Version Release v2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Current version: v0.5.3
🎯 New version: v1.0.0

📝 Updating core.version.json...
✓ Version file updated

📦 Creating Git commit...
✓ Commit created: "chore: release v1.0.0"

🏷️  Creating Git tag...
✓ Tag created: v1.0.0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 Release v1.0.0 created successfully!

📖 Next steps:
   1. Review the commit: git show HEAD
   2. Push the release: git push origin main --tags
   3. Create GitHub Release (optional)
```

---

### Specific Version

```bash
pnpm release --version 2.5.3
```

**Output:**
```text
🔄 NextSpark Version Release v2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Current version: v0.1.0
🎯 New version: v2.5.3

📝 Updating core.version.json...
✓ Version file updated

📦 Creating Git commit...
✓ Commit created: "chore: release v2.5.3"

🏷️  Creating Git tag...
✓ Tag created: v2.5.3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 Release v2.5.3 created successfully!

📖 Next steps:
   1. Review the commit: git show HEAD
   2. Push the release: git push origin main --tags
   3. Create GitHub Release (optional)
```

---

## Release Process Details

### What Happens During Release

1. **Read current version** - Loads from `core.version.json`
2. **Calculate new version** - Based on flag (patch/minor/major) or explicit version
3. **Validate version** - Ensures valid SemVer format
4. **Update version file** - Writes new version to `core.version.json` with timestamp
5. **Create Git commit** - Commits the version change with standardized message
6. **Create Git tag** - Tags the commit with version (e.g., `v0.2.0`)
7. **Report success** - Shows summary and next steps

---

## Git Integration

### Commit Message Format

All releases use standardized commit messages:

```text
chore: release v0.2.0
```

This format:
- Uses `chore:` conventional commit type
- Clearly states it's a release
- Includes the version number

### Git Tags

Tags follow the format: `v{MAJOR}.{MINOR}.{PATCH}`

Examples:
- `v0.1.0`
- `v1.0.0`
- `v2.5.3`

**View all tags:**
```bash
git tag -l
```

**View tag details:**
```bash
git show v0.2.0
```

---

## Pushing Releases

After creating a release locally, push it to the remote repository:

### Push Both Commit and Tag

```bash
git push origin main --tags
```

This pushes:
- The commit with version update
- The version tag

### Push Only Tag (if commit already pushed)

```bash
git push origin v0.2.0
```

---

## GitHub Releases (Optional)

For public distribution, create a GitHub Release:

### Via GitHub UI

1. Go to repository → Releases → "Draft a new release"
2. Select tag: `v0.2.0`
3. Release title: `v0.2.0 - Release Name`
4. Add release notes
5. Publish release

### Via GitHub CLI

```bash
# Install GitHub CLI
brew install gh

# Authenticate
gh auth login

# Create release
gh release create v0.2.0 \
  --title "v0.2.0 - New Features" \
  --notes "Release notes here"
```

---

## Version Decision Guide

### When to Use PATCH (`0.1.0` → `0.1.1`)

- ✅ Fixed a bug
- ✅ Updated documentation
- ✅ Internal refactoring
- ✅ Performance improvements
- ✅ Security patches
- ✅ Dependency updates (patch/minor)

```bash
pnpm release --patch
```

---

### When to Use MINOR (`0.1.0` → `0.2.0`)

- ✅ Added new plugin
- ✅ Added new theme
- ✅ New API endpoints
- ✅ New components
- ✅ New optional features
- ✅ Backward-compatible improvements

```bash
pnpm release --minor
```

---

### When to Use MAJOR (`0.5.0` → `1.0.0`)

- ✅ Breaking API changes
- ✅ Removed features/APIs
- ✅ Database schema changes (breaking)
- ✅ Major refactoring
- ✅ Dropped support (Node.js versions, etc.)
- ✅ Requires user migration

```bash
pnpm release --major
```

---

### Pre-1.0.0 Versions

Before reaching `v1.0.0`, semantic versioning is more relaxed:

- **0.y.z** - Initial development, anything can change
- Breaking changes can be in MINOR versions (0.1.0 → 0.2.0)
- Once stable, release 1.0.0 and follow strict SemVer

---

## Troubleshooting

### Error: Invalid version format

**Problem:**
```text
❌ Error: Invalid version format: abc
   Expected format: X.Y.Z (e.g., 1.0.0)
```

**Solution:**
```bash
# Use valid SemVer format
pnpm release --version 1.0.0
```

---

### Error: No changes to commit

**Problem:**
```text
❌ Error: No changes to commit
   Version might already be set
```

**Solution:**
```bash
# Check current version
pnpm release --current

# If already at desired version, nothing to do
# Otherwise, specify a different version
pnpm release --minor
```

---

### Error: Tag already exists

**Problem:**
```text
❌ Error: Tag 'v0.2.0' already exists
```

**Solution:**
```bash
# Delete existing tag if needed
git tag -d v0.2.0

# Or use a different version
pnpm release --patch  # Try next patch version
```

---

### Undo a Release (Before Push)

If you created a release locally but haven't pushed:

```bash
# Remove the tag
git tag -d v0.2.0

# Undo the commit
git reset --soft HEAD~1

# Version file will be uncommitted, you can modify it
```

---

### Undo a Release (After Push)

If you pushed but need to retract (not recommended):

```bash
# Delete remote tag
git push origin :refs/tags/v0.2.0

# Delete local tag
git tag -d v0.2.0

# Revert commit
git revert HEAD
git push origin main
```

**Warning:** Deleting published releases can break users' installations. Only do this for critical errors immediately after release.

---

## Best Practices

### 1. Version Consistency

Always use the `release` command instead of manually editing `core.version.json`:

```bash
# ✅ Good
pnpm release --patch

# ❌ Bad
# Manually editing core.version.json
```

### 2. Commit Before Release

Ensure all changes are committed before creating a release:

```bash
# Commit your changes first
git add .
git commit -m "feat: add new feature"

# Then create release
pnpm release --minor
```

### 3. Review Before Push

Always review the commit and tag before pushing:

```bash
# Create release
pnpm release --minor

# Review commit
git show HEAD

# Review tag
git show v0.2.0

# If good, push
git push origin main --tags
```

### 4. Write Release Notes

For significant releases, document changes:

```bash
# Create release
pnpm release --minor

# Push
git push origin main --tags

# Create GitHub Release with notes
gh release create v0.2.0 \
  --title "v0.2.0 - New Email Plugin" \
  --notes-file CHANGELOG.md
```

### 5. Keep Changelog

Maintain a `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/):

```markdown
# Changelog

## [0.2.0] - 2024-01-15

### Added
- New email plugin
- API endpoints for email sending

### Fixed
- Authentication bug in production

## [0.1.0] - 2024-01-01

### Added
- Initial release
```

---

## Core Version File

The release command updates `core.version.json`:

```json
{
  "version": "0.2.0",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "releaseUrl": null,
  "previousVersion": "0.1.0",
  "repository": "TheMoneyTeam-com-ar/nextspark"
}
```

**Check version anytime:**
```bash
cat core.version.json
# or
pnpm release --current
```

---

## Release Workflow Example

Complete workflow for a minor release:

```bash
# 1. Ensure you're on main and up to date
git checkout main
git pull origin main

# 2. Verify all changes are committed
git status
# Should show: "nothing to commit, working tree clean"

# 3. Check current version
pnpm release --current
# Output: Current core version: v0.1.5

# 4. Create release (new features added)
pnpm release --minor
# Output: Release v0.2.0 created successfully!

# 5. Review the changes
git show HEAD
git show v0.2.0

# 6. Push to remote
git push origin main --tags

# 7. Create GitHub Release (optional but recommended)
gh release create v0.2.0 \
  --title "v0.2.0 - New Features" \
  --notes "
  ### Added
  - New email plugin
  - API endpoints for email sending
  
  ### Changed
  - Improved documentation
  
  ### Fixed
  - Authentication bug in production
  "

# 8. Announce release
# Post in Slack, Discord, or your communication channel
```

---

## See Also

- [Core Update Command](../updates/update-core) - Updating to new releases
- [Installation Guide](../getting-started/installation) - Initial setup
- [Semantic Versioning](https://semver.org/) - Official SemVer specification

