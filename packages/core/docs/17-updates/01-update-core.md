# Core Update Command

## Introduction

The `update-core` command is a powerful tool for updating your NextSpark installation to the latest core framework version while preserving all your customizations. By default, it updates **everything**: core files, core plugins, and core themes from the official repository.

This command downloads releases from GitHub, intelligently replaces core files, and protects all your custom code, configurations, and user-specific files.

**Default Repository:** `TheMoneyTeam-com-ar/nextspark`

---

## Quick Reference

```bash
# Full update (DEFAULT)
pnpm update-core                    # Updates CORE + PLUGINS + THEMES
pnpm update-core --latest           # Explicit: latest version
pnpm update-core --version v2.0.0   # Specific version

# Branch Management
pnpm update-core --branch           # Creates branch update/X-Y-Z before updating
pnpm update-core -b                 # Short alias for --branch

# Selective exclusions
pnpm update-core --exclude=plugins  # Only CORE + THEMES
pnpm update-core --exclude=themes   # Only CORE + PLUGINS
pnpm update-core --exclude=core     # Only PLUGINS + THEMES (rare, but possible)

# Multiple exclusions
pnpm update-core --exclude=plugins,themes  # Only CORE
pnpm update-core --exclude=core,plugins    # Only THEMES

# Information
pnpm update-core --list             # List available releases
pnpm update-core --check            # Check for updates
pnpm update-core --current          # Show current version
pnpm update-core --help             # Help

# Combinations
pnpm update-core --version v2.0.0 --exclude=themes
pnpm update-core --version v2.5.0 --branch
pnpm update-core --exclude=plugins -b
```

---

## What Gets Updated

### By Default (No Flags)

When you run `pnpm update-core` without any flags, it updates:

- **Core Files** - Framework files in `app/`, `core/`, `scripts/`, `middleware.ts`, config files
- **Core Plugins** - Official plugins from the repository (in `contents/plugins/`)
- **Core Themes** - Official themes from the repository (in `contents/themes/`)

### Protected Files (Never Touched)

The following paths are **always protected**, regardless of flags:

- `contents/` - Your custom themes and plugins
- `.env*` - All environment files
- `.claude/` - Claude workflow configuration
- `public/uploads/` - User-uploaded files
- `supabase/` - Local database configuration
- `.git/` - Git repository history
- `node_modules/` - Dependencies (reinstalled after update)
- `.next/` - Build cache
- `pnpm-lock.yaml` - Lock file

---

## Command Flags

### Version Selection

#### `--version <version>`

Update to a specific release version.

```bash
pnpm update-core --version v2.0.0
pnpm update-core --version v1.5.3
```

**Use when:**
- You need a specific stable version
- Rolling back to a previous release
- Testing a particular version

#### `--latest`

Explicitly update to the latest release (this is the default behavior).

```bash
pnpm update-core --latest
```

**Note:** You don't need this flag as latest is the default, but it makes the command explicit.

---

### Exclusion Control

#### `--exclude=<items>`

Selectively exclude categories from the update. Valid values: `core`, `plugins`, `themes`.

**Single exclusion:**
```bash
# Update only core + themes (skip plugins)
pnpm update-core --exclude=plugins

# Update only core + plugins (skip themes)
pnpm update-core --exclude=themes

# Update only plugins + themes (skip core - rare use case)
pnpm update-core --exclude=core
```

**Multiple exclusions:**
```bash
# Update only core files
pnpm update-core --exclude=plugins,themes

# Update only themes
pnpm update-core --exclude=core,plugins
```

**Use cases:**
- `--exclude=plugins` - When you've heavily customized plugins and want to update them manually
- `--exclude=themes` - When you only want framework updates without theme changes
- `--exclude=core` - When you only want plugin/theme updates (very rare)

---

### Branch Management

#### `--branch` or `-b`

Create a new Git branch before applying any changes. The branch name follows the format `update/X-Y-Z` where version dots are replaced with dashes.

```bash
# Create branch update/0-2-0 and update there
pnpm update-core --branch

# Short alias
pnpm update-core -b

# Combine with version selection
pnpm update-core --version v2.5.0 --branch
# Creates branch: update/2-5-0

# Combine with exclusions
pnpm update-core --exclude=plugins -b
```

**Benefits:**
- Review changes safely in isolation
- Test updates before merging to main
- Easy rollback (just delete the branch)
- Good for production deployments

**Branch format examples:**
- `v0.1.0` → `update/0-1-0`
- `v2.5.0` → `update/2-5-0`
- `v2.10.3` → `update/2-10-3`

**Workflow with branches:**
```bash
# 1. Update in new branch
pnpm update-core --branch

# 2. Test changes
pnpm dev

# 3. If satisfied, merge to main
git checkout main
git merge update/0-2-0

# 4. Push
git push origin main

# 5. Delete branch
git branch -d update/0-2-0
```

---

### Information Commands

#### `--list`

List all available releases from the GitHub repository.

```bash
pnpm update-core --list
```

**Output example:**
```text
Available Releases:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Version: v0.2.0
Released: 2024-01-15
URL: https://github.com/TheMoneyTeam-com-ar/nextspark/releases/tag/v0.2.0

Version: v0.1.5
Released: 2024-01-10
URL: https://github.com/TheMoneyTeam-com-ar/nextspark/releases/tag/v0.1.5

Version: v0.1.0
Released: 2024-01-01
URL: https://github.com/TheMoneyTeam-com-ar/nextspark/releases/tag/v0.1.0
```

#### `--check`

Check if updates are available without performing the update.

```bash
pnpm update-core --check
```

**Output examples:**

If update available:
```text
🔍 Checking for updates...

Current version:  v0.1.0
Latest version:   v0.2.0
Status:           Update available

To update: pnpm update-core
```

If up to date:
```text
🔍 Checking for updates...

Current version:  v0.2.0
Latest version:   v0.2.0
Status:           Up to date ✓
```

#### `--current`

Display the currently installed core version.

```bash
pnpm update-core --current
```

**Output:**
```text
Current core version: v0.1.0
Updated: 2024-01-15
```

#### `--help` or `-h`

Display comprehensive help information.

```bash
pnpm update-core --help
pnpm update-core -h
```

---

## Usage Examples

### Basic Updates

**1. Update everything to latest:**
```bash
pnpm update-core
```

**2. Update to specific version:**
```bash
pnpm update-core --version v2.0.0
```

**3. Check what's available first:**
```bash
# See available versions
pnpm update-core --list

# Then update to chosen version
pnpm update-core --version v2.5.0
```

---

### Selective Updates

**4. Update only core framework (skip plugins and themes):**
```bash
pnpm update-core --exclude=plugins,themes
```

**5. Update framework and plugins (skip themes):**
```bash
pnpm update-core --exclude=themes
```

**6. Update only plugins:**
```bash
pnpm update-core --exclude=core,themes
```

---

### Safe Updates with Branches

**7. Update in a new branch for safety:**
```bash
# Create branch and update
pnpm update-core --branch

# Test changes
pnpm dev

# If good, merge
git checkout main
git merge update/0-2-0
git push origin main

# Cleanup
git branch -d update/0-2-0
```

**8. Update specific version in new branch:**
```bash
pnpm update-core --version v2.5.0 --branch
```

---

### Complex Combinations

**9. Update core only, specific version, in new branch:**
```bash
pnpm update-core --version v2.0.0 --exclude=plugins,themes --branch
```

**10. Update everything except plugins, in new branch:**
```bash
pnpm update-core --exclude=plugins -b
```

---

## Expected Output

### Successful Update (Without Branch)

```bash
pnpm update-core
```

**Output:**
```text
🔄 NextSpark Core Updater v2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️  Current core version: v0.1.0

📦 Update scope:
   ✅ Core files
   ✅ Core plugins
   ✅ Core themes

📸 Creating safety snapshot...
✓ Snapshot created: pre-update-v0.2.0-1703123456

🔍 Fetching release info...
✓ Target version: v0.2.0

⬇️  Downloading core...
✓ Downloaded (5.2 MB)

📦 Extracting...
✓ Extracted to temp directory

📦 Core plugins detected: ai, social-media-publisher
🎨 Core themes detected: default

🔄 Updating core files...
✓ Updated 234 files
✓ Skipped 12 protected files

🔌 Updating plugins...
✓ Updated 2 plugin(s)
✓ Added 0 new plugin(s)
✓ Preserved 3 custom plugin(s)

🎨 Updating themes...
✓ Updated 1 theme(s)
✓ Added 0 new theme(s)
✓ Preserved 2 custom theme(s)

🔀 Merging configuration files...
✓ package.json merged

🧹 Cleaning up...
✓ Temp files removed

⚙️  Running post-update tasks...
✓ Cache cleared
✓ Dependencies installed
✓ Registries rebuilt
✓ New migrations detected: 2

✍️  Updating version file...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 Core updated successfully!

📊 Update Summary:
   Previous: v0.1.0
   Current:  v0.2.0
   Updated:  12/21/2024

📖 Next steps:
   1. Review changes: git diff HEAD~1
   2. Test your application: pnpm dev
   3. Run migrations: pnpm db:migrate

🔙 To rollback: git reset --hard HEAD~1 && pnpm install
```

---

### Successful Update (With Branch)

```bash
pnpm update-core --branch
```

**Output:**
```text
🔄 NextSpark Core Updater v2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️  Current core version: v0.1.0

📦 Update scope:
   ✅ Core files
   ✅ Core plugins
   ✅ Core themes

📸 Creating safety snapshot...
✓ Snapshot created: pre-update-v0.2.0-1703123456

🔍 Fetching release info...
✓ Target version: v0.2.0

⬇️  Downloading core...
✓ Downloaded (5.2 MB)

📦 Extracting...
✓ Extracted to temp directory

🌿 Creating update branch...
✓ Created and switched to branch: update/0-2-0

📦 Core plugins detected: ai, social-media-publisher
🎨 Core themes detected: default

🔄 Updating core files...
✓ Updated 234 files
✓ Skipped 12 protected files

🔌 Updating plugins...
✓ Updated 2 plugin(s)
✓ Added 0 new plugin(s)
✓ Preserved 3 custom plugin(s)

🎨 Updating themes...
✓ Updated 1 theme(s)
✓ Added 0 new theme(s)
✓ Preserved 2 custom theme(s)

🔀 Merging configuration files...
✓ package.json merged

🧹 Cleaning up...
✓ Temp files removed

⚙️  Running post-update tasks...
✓ Cache cleared
✓ Dependencies installed
✓ Registries rebuilt
✓ New migrations detected: 2

✍️  Updating version file...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 Core updated successfully!

📊 Update Summary:
   Previous: v0.1.0
   Current:  v0.2.0
   Updated:  12/21/2024

📖 Next steps:
   1. Review changes: git diff main..update/0-2-0
   2. Test your application: pnpm dev
   3. Run migrations: pnpm db:migrate
   4. Merge to main: git checkout main && git merge update/0-2-0
   5. Push: git push origin main
   6. Delete branch: git branch -d update/0-2-0

🔙 To rollback: git checkout main && git branch -D update/0-2-0
```

---

## Update Process Details

### What Happens During Update

1. **Pre-flight checks** - Validates Git repository, network connection
2. **Safety snapshot** - Creates Git commit with timestamp for rollback
3. **Fetch release info** - Gets version details from GitHub API
4. **Download** - Downloads ZIP from GitHub releases
5. **Extract** - Extracts to temporary directory
6. **Branch creation** (if `--branch` flag) - Creates and switches to update branch
7. **Detect components** - Identifies core plugins and themes in download
8. **Update core files** - Copies framework files, skips protected paths
9. **Update plugins** - Updates/adds core plugins, preserves custom ones
10. **Update themes** - Updates/adds core themes, preserves custom ones
11. **Merge package.json** - Intelligently merges dependencies
12. **Cleanup** - Removes temporary files
13. **Post-update tasks** - Clears cache, installs dependencies, rebuilds registries
14. **Version tracking** - Updates `core.version.json`
15. **Report** - Shows summary and next steps

---

## Core Version Tracking

The boilerplate tracks the installed core version in `core.version.json`:

```json
{
  "version": "0.2.0",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "releaseUrl": "https://github.com/TheMoneyTeam-com-ar/nextspark/releases/tag/v0.2.0",
  "previousVersion": "0.1.0",
  "repository": "TheMoneyTeam-com-ar/nextspark"
}
```

**Check current version:**
```bash
cat core.version.json
# or
pnpm update-core --current
```

---

## Troubleshooting

### Error: Branch already exists

**Problem:**
```text
❌ Error: Branch 'update/0-2-0' already exists
   Delete it first: git branch -D update/0-2-0
   Or update without --branch flag
```

**Solution:**
```bash
# Option 1: Delete existing branch
git branch -D update/0-2-0
pnpm update-core --branch

# Option 2: Update without creating branch
pnpm update-core
```

---

### Error: Not a git repository

**Problem:**
```text
❌ Error: Could not create git branch
   Make sure you are in a git repository
```

**Solution:**
```bash
# Initialize git if not done
git init
git add .
git commit -m "Initial commit"

# Then try again
pnpm update-core --branch
```

---

### Error: Network timeout

**Problem:**
```text
❌ Error: Failed to fetch release info
   Network timeout or rate limit exceeded
```

**Solution:**
```bash
# For private repos or rate limits, set GitHub token
export GITHUB_TOKEN="ghp_your_token_here"

# Try again
pnpm update-core
```

---

### Rollback After Update

**If update was on current branch:**
```bash
# Rollback to previous commit
git reset --hard HEAD~1

# Reinstall dependencies
pnpm install
```

**If update was on separate branch:**
```bash
# Switch back to main
git checkout main

# Delete update branch
git branch -D update/0-2-0
```

---

## Best Practices

1. **Always check available versions first:**
   ```bash
   pnpm update-core --list
   ```

2. **Use branches for production updates:**
   ```bash
   pnpm update-core --branch
   ```

3. **Review changes before merging:**
   ```bash
   git diff main..update/0-2-0
   ```

4. **Test after update:**
   ```bash
   pnpm dev
   pnpm test
   ```

5. **Run migrations if detected:**
   ```bash
   pnpm db:migrate
   ```

6. **Commit the update:**
   ```bash
   git add .
   git commit -m "chore: update core to v0.2.0"
   ```

---

## See Also

- [Release Version Command](../updates/release-version) - Creating new core releases
- [Installation Guide](../getting-started/installation) - Initial setup
- [Deployment](../deployment/overview) - Production deployment strategies

