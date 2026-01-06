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
ls -la ../projects/test-local-packages/package.json 2>/dev/null && echo "Test project exists in ../projects/test-local-packages/" || echo "No local test project found"
ls -la ../projects/test-npm-packages/package.json 2>/dev/null && echo "NPM test project exists in ../projects/test-npm-packages/" || echo "No npm test project found"

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
| `../projects/test-local-packages/` | Local .tgz testing (setup.sh default) |
| `../projects/test-npm-packages/` | NPM published packages testing |

### Step 3: Wait for Confirmation

**STOP HERE AND WAIT.**

Ask the user:
> "Which test option would you like? (1-3)"
> "Where should the test project be created?"

**DO NOT proceed until the user explicitly confirms.**

### Step 4: Execute Test Setup

**Option 1: Create New Test Project (Recommended)**

Use the setup script which handles everything automatically:

```bash
# Full setup (repackages + creates project)
./scripts/tests/local/setup.sh --clean

# Or skip repackaging if .tgz files are up to date
./scripts/tests/local/setup.sh --skip-repackage --clean

# Use a different preset/theme
./scripts/tests/local/setup.sh --preset blog --theme productivity --clean
```

The setup script:
1. Runs `repackage.sh --all` to create .tgz files
2. Creates project directory in `../projects/test-local-packages/`
3. Copies .tgz files and sets up `file:` references in package.json
4. Installs all packages from local .tgz files
5. Runs the wizard with the LOCAL CLI (with new flags for automation)
6. Creates .env with required variables
7. Builds the project

**Option 2: Update Existing Test Project**

```bash
# Repackage first
./scripts/utils/repackage.sh --all --clean

# Then run setup with --clean to replace the project
./scripts/tests/local/setup.sh --skip-repackage --clean
```

**Option 3: Test CLI Only**

```bash
# Ensure packages are in test-distribution
./scripts/utils/repackage.sh --all

# Test CLI help
npx ../test-distribution/nextsparkjs-cli-*.tgz --help

# Test CLI version
npx ../test-distribution/nextsparkjs-cli-*.tgz --version

# Test init command help
npx ../test-distribution/create-nextspark-app-*.tgz --help
```

### Step 5: Show Available Test Commands

After setup, present available commands:

**Build and Development:**

```bash
cd ../projects/test-local-packages

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

> "A test project already exists at `../projects/test-local-packages/`. Options:"
> "1. Run setup with `--clean` flag to replace it"
> "2. Keep existing project and test manually"

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
