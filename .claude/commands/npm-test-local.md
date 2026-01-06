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
# Check for existing test project
ls -la ../projects/test-local-packages/package.json 2>/dev/null && echo "Test project exists" || echo "No test project found"

# Check source versions
echo ""
echo "=== Source Versions ==="
echo "Core: $(node -p "require('./packages/core/package.json').version")"
echo "CLI: $(node -p "require('./packages/cli/package.json').version")"
```

### Step 2: Analyze and Present Options

**Test Options:**

| Option | Description | Use Case |
|--------|-------------|----------|
| 1. Full setup | Build, package, and create test project | Clean testing (recommended) |
| 2. Quick run | Just run tests on existing project | Iterative testing |

**Presets Available:**
- `saas` (default) - Full SaaS application
- `blog` - Blog/content site
- `crm` - CRM application

### Step 3: Wait for Confirmation

**STOP HERE AND WAIT.**

Ask the user:
> "Would you like to run the full setup (1) or quick test on existing project (2)?"
> "Which preset? (saas/blog/crm)"

**DO NOT proceed until the user explicitly confirms.**

### Step 4: Execute Test Setup

**Option 1: Full Setup (Recommended)**

```bash
# Single command handles everything:
# - Cleans existing project
# - Builds and packages all packages
# - Creates test project with local .tgz references
# - Runs wizard with local CLI
# - Creates .env
# - Builds project

./scripts/tests/local/setup.sh --preset saas --theme default
```

The setup script will:
1. Remove existing test project (if any)
2. Create `../projects/test-local-packages/.packages/`
3. Run `repackage.sh --all` directly to `.packages/`
4. Create `package.json` with `file:` references
5. Install dependencies with pnpm
6. Run wizard with local CLI (`--name`, `--slug`, `--yes` flags)
7. Create `.env` with required variables
8. Build the project

**Option 2: Quick Test (existing project)**

```bash
cd ../projects/test-local-packages
pnpm dev   # Start dev server
pnpm build # Or rebuild
pnpm test  # Run tests
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
| CLI works | `npx nextspark --help` | Help displayed |

### Step 6: Next Steps

| Status | Next Step | Command |
|--------|-----------|---------|
| Tests pass | Publish to npm | `/npm-publish` |
| Issues found | Fix code and re-run setup | `./scripts/tests/local/setup.sh` |
| Version needs bump | Increment version | `/npm-version` |

---

## Scenarios

### Scenario A: No Test Project Exists

> "No test project found. Running full setup to create one."

Then execute:
```bash
./scripts/tests/local/setup.sh
```

### Scenario B: Test Project Already Exists

> "Test project exists at `../projects/test-local-packages/`. Options:"
> "1. Run full setup (will replace existing project)"
> "2. Quick test on existing project"

### Scenario C: Build Fails

If the setup script fails during build:

> "Build failed. Check the error above. Common issues:"
> "- Missing environment variables"
> "- TypeScript errors in packages"
> "- Missing dependencies"

---

## Important Rules

1. **NEVER** skip confirmation before running setup
2. **ALWAYS** check for existing projects before running
3. **ALWAYS** provide verification commands after setup
4. **ALWAYS** show next steps based on test results
5. The setup script always cleans and rebuilds - there's no "update" mode
