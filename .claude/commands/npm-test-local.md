---
description: Test local NextSpark packages before publishing
---

# NPM Test Local Command

## Your Role

You are an assistant for testing NextSpark packages locally before publishing to npm. You help set up a test project using local .tgz files to verify packages work correctly.

## Mandatory Process

### Step 1: Context Analysis

Execute these commands to understand the current state:

```bash
# Check for packaged files
echo "=== Available .tgz Packages ==="
ls -la /tmp/nextspark-release/*.tgz 2>/dev/null || echo "No packages in /tmp/nextspark-release/"
ls -la ../test-distribution/*.tgz 2>/dev/null || echo "No packages in ../test-distribution/"

# Check package versions
echo ""
echo "=== Package Versions in .tgz files ==="
for tgz in /tmp/nextspark-release/*.tgz; do
  if [ -f "$tgz" ]; then
    echo "$(basename $tgz)"
  fi
done

# Check if test project exists
echo ""
echo "=== Existing Test Projects ==="
ls -la ../test-distribution/package.json 2>/dev/null && echo "Test project exists in ../test-distribution/" || echo "No test project found"
ls -la /tmp/nextspark-test/package.json 2>/dev/null && echo "Test project exists in /tmp/nextspark-test/" || echo "No test project in /tmp/nextspark-test/"

# Check source versions for comparison
echo ""
echo "=== Source Versions ==="
echo "Core: $(node -p "require('./packages/core/package.json').version")"
echo "CLI: $(node -p "require('./packages/cli/package.json').version")"
```

### Step 2: Analyze and Present Options

**Package Status:**

| Package | .tgz File | Version | Status |
|---------|-----------|---------|--------|
| @nextsparkjs/core | nextsparkjs-core-0.1.0-beta.3.tgz | 0.1.0-beta.3 | Available |
| @nextsparkjs/cli | nextsparkjs-cli-0.1.0-beta.3.tgz | 0.1.0-beta.3 | Available |
| create-nextspark-app | create-nextspark-app-0.1.0-beta.3.tgz | 0.1.0-beta.3 | Available |

**Test Options:**

| Option | Description | Use Case |
|--------|-------------|----------|
| 1. Create new test project | Initialize fresh NextSpark app with local packages | Clean testing |
| 2. Update existing test project | Update packages in existing test project | Iterative testing |
| 3. Test CLI only | Test CLI commands without full project | Quick CLI verification |

**Test Project Location:**

| Location | Description |
|----------|-------------|
| `../test-distribution/` | Sibling to repo (recommended) |
| `/tmp/nextspark-test/` | Temporary directory |
| Custom path | User-specified location |

### Step 3: Wait for Confirmation

**STOP HERE AND WAIT.**

Ask the user:
> "Which test option would you like? (1-3)"
> "Where should the test project be created?"

**DO NOT proceed until the user explicitly confirms.**

### Step 4: Execute Test Setup

**Option 1: Create New Test Project**

```bash
# Set variables
TEST_DIR="../test-distribution"
PACKAGES_DIR="/tmp/nextspark-release"

# Create test directory
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Copy all .tgz files
cp "$PACKAGES_DIR"/*.tgz .

# Run the CLI wizard to create project
npx ./create-nextspark-app-*.tgz init

# After wizard completes, run force-local-packages script
cd /path/to/repo
./scripts/force-local-packages.sh

# Install dependencies
cd "$TEST_DIR"
pnpm install
```

**Option 2: Update Existing Test Project**

```bash
TEST_DIR="../test-distribution"
PACKAGES_DIR="/tmp/nextspark-release"

cd "$TEST_DIR"

# Remove old packages
rm -f *.tgz

# Copy new packages
cp "$PACKAGES_DIR"/*.tgz .

# Update package.json references
cd /path/to/repo
./scripts/force-local-packages.sh

# Reinstall
cd "$TEST_DIR"
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

**Option 3: Test CLI Only**

```bash
PACKAGES_DIR="/tmp/nextspark-release"

# Test CLI help
npx "$PACKAGES_DIR"/nextsparkjs-cli-*.tgz --help

# Test CLI version
npx "$PACKAGES_DIR"/nextsparkjs-cli-*.tgz --version

# Test init command (dry run)
npx "$PACKAGES_DIR"/create-nextspark-app-*.tgz init --help
```

### Step 5: Show Available Test Commands

After setup, present available commands:

**Build and Development:**

```bash
cd ../test-distribution

# Development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

**Verification Commands:**

```bash
# Check installed versions
pnpm list @nextsparkjs/core @nextsparkjs/cli

# Verify core package
node -e "const pkg = require('@nextsparkjs/core/package.json'); console.log('Core version:', pkg.version)"

# Run tests if available
pnpm test
```

**Test Checklist:**

| Test | Command | Expected Result |
|------|---------|-----------------|
| Dev server starts | `pnpm dev` | Server on localhost:3000 |
| Build succeeds | `pnpm build` | No errors |
| Pages load | Visit localhost:3000 | Content renders |
| CLI works | `npx @nextsparkjs/cli --help` | Help displayed |

### Step 6: Next Steps

| Status | Next Step | Command |
|--------|-----------|---------|
| Tests pass | Publish to npm | `/npm:publish` |
| Issues found | Debug and repackage | `/npm:repackage` |
| Version needs bump | Increment version | `/npm:version` |

---

## Scenarios

### Scenario A: No Packages Available

If no .tgz files are found:

> "Error: No packaged files found. Run `/npm:repackage` first to create packages for testing."

### Scenario B: Test Project Already Exists

If test project exists:

> "A test project already exists at `../test-distribution/`. Options:"
> "1. Update packages in existing project (preserves your test content)"
> "2. Delete and create fresh project"

### Scenario C: Package Version Mismatch

If .tgz versions don't match source:

> "Warning: Package versions don't match source code:"

| Package | .tgz | Source |
|---------|------|--------|
| core | 0.1.0-beta.2 | 0.1.0-beta.3 |

> "Consider running `/npm:repackage` to get latest versions."

### Scenario D: Missing CLI Package

If CLI .tgz is missing:

> "Warning: CLI package not found. The wizard requires the CLI package."
> "Run `/npm:repackage` to generate all packages."

---

## Important Rules

1. **NEVER** delete existing test projects without explicit user confirmation
2. **ALWAYS** check for existing packages before attempting setup
3. **ALWAYS** show what commands will be run before executing
4. **ALWAYS** provide verification commands after setup
5. **ALWAYS** show next steps based on test results
6. **ALWAYS** preserve user content in existing test projects when updating
