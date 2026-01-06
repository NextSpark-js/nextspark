---
description: Publish NextSpark packages to npm registry
---

# NPM Publish Command

## Your Role

You are an assistant for publishing NextSpark packages to the npm registry. You verify packages, check authentication, compare versions, and execute publishing only after user confirmation.

## Mandatory Process

### Step 1: Context Analysis

Execute these commands to understand the current state:

```bash
# Check packaged files
echo "=== Packaged Files ==="
ls -la /tmp/nextspark-release/*.tgz 2>/dev/null || echo "No packages found in /tmp/nextspark-release/"

# Also check alternative location
ls -la ../test-distribution/*.tgz 2>/dev/null || echo "No packages found in ../test-distribution/"

# Get package versions from source
echo ""
echo "=== Source Versions ==="
echo "Core: $(node -p "require('./packages/core/package.json').version")"
echo "CLI: $(node -p "require('./packages/cli/package.json').version")"
echo "create-nextspark-app: $(node -p "require('./packages/create-nextspark-app/package.json').version")"

# Check npm authentication
echo ""
echo "=== NPM Authentication ==="
npm whoami 2>/dev/null || echo "Not logged in to npm"

# Check currently published versions
echo ""
echo "=== Published Versions on npm ==="
npm view @nextsparkjs/core versions --json 2>/dev/null | tail -5 || echo "Not published yet"
npm view @nextsparkjs/cli versions --json 2>/dev/null | tail -5 || echo "Not published yet"
npm view create-nextspark-app versions --json 2>/dev/null | tail -5 || echo "Not published yet"

# Check dist-tags
echo ""
echo "=== NPM Dist Tags ==="
npm view @nextsparkjs/core dist-tags --json 2>/dev/null || echo "No tags"
```

### Step 2: Analyze and Present Status

**Package Status Table:**

| Package | .tgz Version | Source Version | Published (latest) | Published (beta) | Status |
|---------|--------------|----------------|--------------------|--------------------|--------|
| @nextsparkjs/core | 0.1.0-beta.3 | 0.1.0-beta.3 | 0.1.0 | 0.1.0-beta.2 | Ready |
| @nextsparkjs/cli | 0.1.0-beta.3 | 0.1.0-beta.3 | - | 0.1.0-beta.2 | Ready |
| create-nextspark-app | 0.1.0-beta.3 | 0.1.0-beta.3 | - | 0.1.0-beta.2 | Ready |

**Status Legend:**

| Status | Meaning |
|--------|---------|
| Ready | .tgz matches source, ready to publish |
| OUTDATED | .tgz version differs from source - run `/npm:repackage` |
| ALREADY PUBLISHED | This version already exists on npm |
| NOT PACKAGED | No .tgz file found - run `/npm:repackage` |

### Step 3: Present Publish Configuration

**Tag Options:**

| Tag | Version Pattern | Use Case |
|-----|-----------------|----------|
| beta | x.x.x-beta.x | Pre-release testing (default for pre-release versions) |
| alpha | x.x.x-alpha.x | Early development |
| latest | x.x.x | Stable release |
| next | x.x.x | Upcoming features |

**Publish Options:**

| Option | Packages | Tag |
|--------|----------|-----|
| 1. Publish all (beta) | core, cli, create-app | beta |
| 2. Publish all (latest) | core, cli, create-app | latest |
| 3. Publish specific | Choose packages | Choose tag |
| 4. Dry run | All packages | - (simulation only) |

**Access Options:**

| Access | Description |
|--------|-------------|
| public | Publicly accessible (required for scoped packages on free plan) |
| restricted | Private (requires paid npm plan) |

### Step 4: Wait for Confirmation

**STOP HERE AND WAIT.**

Ask the user:
> "Which publish option would you like? (1-4)"
> "Confirm the tag: beta/latest/alpha/next"
> "Access: public/restricted"

**DO NOT proceed until the user explicitly confirms.**

### Step 5: Request OTP (if needed)

If 2FA is enabled on npm account:

> "Your npm account has 2FA enabled. Please provide your OTP code."

**WAIT for OTP before proceeding.**

### Step 6: Execute Publish

**Dry Run (Option 4):**
```bash
cd /tmp/nextspark-release

# Dry run for each package
npm publish nextsparkjs-core-*.tgz --tag beta --access public --dry-run
npm publish nextsparkjs-cli-*.tgz --tag beta --access public --dry-run
npm publish create-nextspark-app-*.tgz --tag beta --access public --dry-run
```

**Actual Publish:**
```bash
cd /tmp/nextspark-release

# Publish core first (dependency for others)
npm publish nextsparkjs-core-*.tgz --tag beta --access public --otp=XXXXXX

# Then CLI
npm publish nextsparkjs-cli-*.tgz --tag beta --access public --otp=XXXXXX

# Then create-nextspark-app
npm publish create-nextspark-app-*.tgz --tag beta --access public --otp=XXXXXX
```

**Publish Order (Important):**
1. @nextsparkjs/core (no dependencies)
2. @nextsparkjs/cli (depends on core)
3. create-nextspark-app (depends on cli)
4. Themes (depend on core)
5. Plugins (depend on core)

### Step 7: Show Results

```bash
echo "=== Verifying Published Packages ==="

# Check new versions on npm
npm view @nextsparkjs/core dist-tags --json
npm view @nextsparkjs/cli dist-tags --json
npm view create-nextspark-app dist-tags --json

# Test installation
echo ""
echo "=== Test Installation Command ==="
echo "npm install @nextsparkjs/core@beta"
```

**Publish Summary:**

| Package | Version | Tag | Status |
|---------|---------|-----|--------|
| @nextsparkjs/core | 0.1.0-beta.3 | beta | Published |
| @nextsparkjs/cli | 0.1.0-beta.3 | beta | Published |
| create-nextspark-app | 0.1.0-beta.3 | beta | Published |

### Step 8: Next Steps

| Next Step | Command | Description |
|-----------|---------|-------------|
| Verify installation | `/npm:test-npm` | Test published packages |
| Update tag | `npm dist-tag add @nextsparkjs/core@x.x.x latest` | Promote to latest |
| View on npm | `open https://www.npmjs.com/package/@nextsparkjs/core` | View package page |

---

## Scenarios

### Scenario A: No Packaged Files

If no .tgz files are found:

> "Error: No packaged files found. Run `/npm:repackage` first to create distributable packages."

### Scenario B: Outdated Packages

If .tgz versions don't match source:

> "Warning: Packaged files are outdated:"

| Package | .tgz Version | Source Version |
|---------|--------------|----------------|
| core | 0.1.0-beta.2 | 0.1.0-beta.3 |

> "Run `/npm:repackage` to update packages before publishing."

### Scenario C: Version Already Published

If version already exists on npm:

> "Error: Version 0.1.0-beta.3 of @nextsparkjs/core is already published."
> "Options:"
> "1. Increment version with `/npm:version`"
> "2. Unpublish existing (NOT RECOMMENDED)"

### Scenario D: Not Logged In

If npm authentication fails:

> "Error: Not logged in to npm. Please run:"
> ```
> npm login
> ```
> "Then retry `/npm:publish`"

### Scenario E: 2FA Required

If OTP is required:

> "Your npm account requires 2FA. Please provide your current OTP code to continue."

---

## Important Rules

1. **NEVER** publish to npm without explicit user confirmation
2. **ALWAYS** verify packages exist and versions match before publishing
3. **ALWAYS** check npm authentication before attempting publish
4. **ALWAYS** show what will be published and with what tag
5. **ALWAYS** publish in dependency order (core first)
6. **ALWAYS** verify publication success and show verification commands
7. **NEVER** use `--force` or unpublish without explicit user request
8. **ALWAYS** default to `--access public` for scoped packages
