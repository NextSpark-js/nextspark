---
description: Package NextSpark packages for NPM distribution
---

# NPM Repackage Command

## Your Role

You are an assistant for packaging NextSpark monorepo packages into distributable `.tgz` files. Your job is to analyze the current state, present options, and execute packaging only after user confirmation.

## Mandatory Process

### Step 1: Context Analysis

Execute these commands to understand the current state:

```bash
# Check for uncommitted changes
git status --porcelain

# Check which packages have changed since last tag
git diff --name-only $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~10") HEAD -- packages/ themes/ plugins/

# Check existing packaged files
ls -la ./.packages/*.tgz 2>/dev/null || echo "No packages found in ./.packages/"

# Get current core version
node -p "require('./packages/core/package.json').version"

# Get current CLI version
node -p "require('./packages/cli/package.json').version"

# Get current create-nextspark-app version
node -p "require('./packages/create-nextspark-app/package.json').version"
```

### Step 2: Analyze and Present Proposal

Based on the context analysis, present a summary table:

| Package | Current Version | Has Changes | Existing .tgz |
|---------|-----------------|-------------|---------------|
| @nextsparkjs/core | x.x.x | Yes/No | Yes/No |
| @nextsparkjs/cli | x.x.x | Yes/No | Yes/No |
| create-nextspark-app | x.x.x | Yes/No | Yes/No |
| (themes...) | x.x.x | Yes/No | Yes/No |
| (plugins...) | x.x.x | Yes/No | Yes/No |

**Present Options:**

| Option | Description | Recommended When |
|--------|-------------|------------------|
| 1. Package modified only | Only packages with changes since last tag | Normal development |
| 2. Package all | Rebuild all packages | After version bump or clean release |
| 3. Package specific | Choose specific packages | Testing specific package |

**Output Directory:** `./.packages/` (default, used by publish.sh)

### Step 3: Wait for Confirmation

**STOP HERE AND WAIT.**

Ask the user:
> "Which option would you like? (1/2/3)"

**DO NOT proceed until the user explicitly confirms.**

### Step 4: Execute Packaging

Based on user selection, execute the appropriate command:

**Option 1 - Package Modified Only:**
```bash
# First, identify modified packages
MODIFIED=$(git diff --name-only $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~10") HEAD -- packages/ themes/ plugins/ | cut -d'/' -f1-2 | sort -u)

# Then package each modified package
for pkg in $MODIFIED; do
  ./scripts/packages/pack.sh --package "$(basename $pkg)"
done
```

**Option 2 - Package All:**
```bash
./scripts/packages/pack.sh --all --clean
```

**Option 3 - Package Specific:**
```bash
# Package specific package(s)
./scripts/packages/pack.sh --package core
./scripts/packages/pack.sh --package cli --package core
```

### Step 5: Show Results

After execution, display:

```bash
# List generated packages
echo "Generated packages:"
ls -la ./.packages/*.tgz

# Show package sizes
echo ""
echo "Package sizes:"
du -h ./.packages/*.tgz
```

**Summary Table:**

| Package | Version | Size | Location |
|---------|---------|------|----------|
| @nextsparkjs/core | x.x.x | XXkb | ./.packages/nextsparkjs-core-x.x.x.tgz |
| ... | ... | ... | ... |

### Step 6: Next Steps

Present the logical next steps:

| Next Step | Command | Description |
|-----------|---------|-------------|
| Test locally | `/npm-test-local` | Test packages before publishing |
| Publish to npm | `/npm-publish` | Publish to npm registry |
| Increment version | `/npm-version` | If you need to bump versions first |

---

## Scenarios

### Scenario A: No Existing Packages

If `./.packages/` is empty or doesn't exist:

> "No existing packages found. I recommend Option 2 (Package all) to create a complete set of distributable packages."

### Scenario B: Outdated Packages Exist

If packages exist but versions don't match package.json:

> "Warning: Existing packages are outdated. Package versions don't match source. Recommend repackaging."

| Package | .tgz Version | Source Version | Status |
|---------|--------------|----------------|--------|
| core | 0.1.0 | 0.1.1 | OUTDATED |

### Scenario C: Uncommitted Changes

If `git status --porcelain` shows changes:

> "Warning: You have uncommitted changes. These will be included in the packages. Consider committing first."

---

## Important Rules

1. **NEVER** execute packaging scripts without explicit user confirmation
2. **ALWAYS** analyze context before proposing actions
3. **ALWAYS** show what will be done before doing it
4. **ALWAYS** show next steps after completion
5. **ALWAYS** warn about uncommitted changes
6. **ALWAYS** compare existing package versions with source versions
