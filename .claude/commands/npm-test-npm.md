---
description: Test published NextSpark packages from npm registry
---

# NPM Test NPM Command

## Your Role

You are an assistant for testing NextSpark packages that have been published to npm. You help verify that published packages work correctly by creating a test project that installs from the npm registry.

## Mandatory Process

### Step 1: Context Analysis

Execute these commands to understand the current state:

```bash
# Get local source versions
echo "=== Local Source Versions ==="
echo "Core: $(node -p "require('./packages/core/package.json').version")"
echo "CLI: $(node -p "require('./packages/cli/package.json').version")"
echo "create-nextspark-app: $(node -p "require('./packages/create-nextspark-app/package.json').version")"

# Get published versions from npm
echo ""
echo "=== Published Versions on npm ==="

echo ""
echo "@nextsparkjs/core:"
npm view @nextsparkjs/core dist-tags --json 2>/dev/null || echo "  Not published"

echo ""
echo "@nextsparkjs/cli:"
npm view @nextsparkjs/cli dist-tags --json 2>/dev/null || echo "  Not published"

echo ""
echo "create-nextspark-app:"
npm view create-nextspark-app dist-tags --json 2>/dev/null || echo "  Not published"

# Check all available versions
echo ""
echo "=== Available Versions ==="
echo "@nextsparkjs/core versions:"
npm view @nextsparkjs/core versions --json 2>/dev/null | tail -10 || echo "  None"

# Check for existing npm test project
echo ""
echo "=== Existing Test Projects ==="
ls -la /tmp/nextspark-npm-test/package.json 2>/dev/null && echo "NPM test project exists" || echo "No NPM test project found"
```

### Step 2: Analyze and Present Options

**Version Comparison:**

| Package | Local Version | npm latest | npm beta | npm alpha |
|---------|---------------|------------|----------|-----------|
| @nextsparkjs/core | 0.1.0-beta.4 | 0.1.0 | 0.1.0-beta.3 | - |
| @nextsparkjs/cli | 0.1.0-beta.4 | - | 0.1.0-beta.3 | - |
| create-nextspark-app | 0.1.0-beta.4 | - | 0.1.0-beta.3 | - |

**Version to Test:**

| Option | Tag/Version | Description |
|--------|-------------|-------------|
| 1. latest | Stable release | Test production-ready version |
| 2. beta | Pre-release | Test beta features |
| 3. alpha | Early development | Test bleeding edge |
| 4. specific | x.x.x | Test specific version |

**Test Location:**

| Location | Description |
|----------|-------------|
| `/tmp/nextspark-npm-test/` | Temporary directory (recommended) |
| `../test-npm/` | Sibling to repo |
| Custom path | User-specified location |

### Step 3: Wait for Confirmation

**STOP HERE AND WAIT.**

Ask the user:
> "Which version would you like to test? (1-4, or specify version)"
> "Where should the test project be created?"

**DO NOT proceed until the user explicitly confirms.**

### Step 4: Execute Test Setup

**Create Test Project:**

```bash
# Set variables
TEST_DIR="/tmp/nextspark-npm-test"
VERSION_TAG="beta"  # or "latest", "alpha", or specific version

# Clean previous test
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Create project using published create-nextspark-app
npx create-nextspark-app@$VERSION_TAG init

# Or with specific version
npx create-nextspark-app@0.1.0-beta.3 init
```

**Install and Verify:**

```bash
cd "$TEST_DIR"

# Install dependencies
pnpm install

# Verify installed versions
echo "=== Installed Versions ==="
pnpm list @nextsparkjs/core @nextsparkjs/cli create-nextspark-app

# Check package contents
node -e "console.log(require('@nextsparkjs/core/package.json').version)"
```

### Step 5: Run Verification Tests

**Automated Verification:**

```bash
cd "$TEST_DIR"

echo "=== Running Verification Tests ==="

# Test 1: Check dependencies resolved
echo "1. Checking dependencies..."
pnpm list --depth=0

# Test 2: Build test
echo ""
echo "2. Building project..."
pnpm build

# Test 3: Check for TypeScript errors
echo ""
echo "3. Type checking..."
pnpm typecheck 2>/dev/null || echo "No typecheck script"

# Test 4: Start dev server (background, then kill)
echo ""
echo "4. Testing dev server..."
timeout 10 pnpm dev &
sleep 5
curl -s http://localhost:3000 > /dev/null && echo "Dev server responds OK" || echo "Dev server issue"
kill %1 2>/dev/null
```

**Manual Verification Checklist:**

| Test | Command | Expected Result | Status |
|------|---------|-----------------|--------|
| Install succeeds | `pnpm install` | No errors | [ ] |
| Build succeeds | `pnpm build` | No errors | [ ] |
| Dev server starts | `pnpm dev` | localhost:3000 accessible | [ ] |
| Pages render | Visit localhost:3000 | Content displays | [ ] |
| CLI works | `npx @nextsparkjs/cli --help` | Help shown | [ ] |
| Types work | No TypeScript errors | IDE shows no errors | [ ] |

### Step 6: Show Results

**Test Results Summary:**

| Test | Result | Notes |
|------|--------|-------|
| Package installation | PASS/FAIL | - |
| Build | PASS/FAIL | - |
| Dev server | PASS/FAIL | - |
| Type checking | PASS/FAIL | - |

**Version Information:**

| Package | Tested Version | Source Version | Match |
|---------|----------------|----------------|-------|
| @nextsparkjs/core | 0.1.0-beta.3 | 0.1.0-beta.4 | No (needs publish) |

### Step 7: Next Steps

Based on test results:

**If All Tests Pass:**

| Action | Command | Description |
|--------|---------|-------------|
| Promote to latest | `npm dist-tag add @nextsparkjs/core@x.x.x latest` | Make this the default version |
| Announce release | - | Update changelog, notify users |

**If Tests Fail:**

| Issue | Solution | Command |
|-------|----------|---------|
| Build errors | Fix code, repackage | `/npm:repackage` |
| Missing features | Implement, bump version | `/npm:version` |
| Dependency issues | Update package.json | Edit manually |

**Compare with Local:**

If npm version differs from local:
> "The npm version (0.1.0-beta.3) differs from your local version (0.1.0-beta.4)."
> "Run `/npm:publish` to publish your latest changes."

---

## Scenarios

### Scenario A: Package Not Published

If package is not on npm:

> "Error: @nextsparkjs/core is not published to npm yet."
> "Run `/npm:publish` first to publish packages."

### Scenario B: Version Behind Local

If npm version is behind local:

> "The npm version is behind your local development:"

| Package | npm | Local | Difference |
|---------|-----|-------|------------|
| core | 0.1.0-beta.2 | 0.1.0-beta.4 | 2 versions behind |

> "Consider publishing with `/npm:publish`."

### Scenario C: Multiple Tags Available

If multiple dist-tags exist:

> "Multiple versions available. Which would you like to test?"

| Tag | Version | Published |
|-----|---------|-----------|
| latest | 0.1.0 | 2024-01-01 |
| beta | 0.1.0-beta.3 | 2024-01-15 |
| alpha | 0.2.0-alpha.1 | 2024-01-20 |

### Scenario D: Test Project Exists

If previous npm test project exists:

> "A previous npm test project exists at `/tmp/nextspark-npm-test/`."
> "1. Delete and create fresh (recommended for version changes)"
> "2. Update packages in existing project"

---

## Important Rules

1. **NEVER** install packages without explicit user confirmation
2. **ALWAYS** show version comparison between npm and local
3. **ALWAYS** verify packages exist on npm before attempting installation
4. **ALWAYS** run build and basic tests after installation
5. **ALWAYS** show clear pass/fail results for each test
6. **ALWAYS** suggest next steps based on test outcomes
7. **ALWAYS** clean up test directories when done or on failure
