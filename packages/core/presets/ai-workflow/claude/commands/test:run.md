---
description: "[Test Step 2] Execute Cypress test suite with options for specific tests or full run"
---

# Test Run - Execute Test Suite

You are executing Cypress tests for quality assurance.

**Test Scope (optional):**
{{{ input }}}

---

## Your Mission

Execute Cypress tests with proper configuration:

1. **Determine scope** (full suite, specific file, or entity)
2. **Start dev server** if not running
3. **Execute tests** with appropriate options
4. **Report results** with pass/fail summary
5. **Identify failures** for potential fixing
6. **Verify BDD documentation** is up to date

---

## ⚠️ IMPORTANT: Cypress Commands

The project uses a custom runner that **auto-detects the active theme**:

```bash
# ✅ CORRECT - Use these commands (auto-detect theme from NEXT_PUBLIC_ACTIVE_THEME)
pnpm cy:open                                    # Open Cypress UI
pnpm cy:run                                     # Run all tests headless
pnpm cy:run -- --spec "cypress/e2e/**/*.cy.ts"  # Run specific spec pattern
pnpm test:e2e                                   # Full E2E with server start

# With grep tags (filter by test tags)
pnpm cy:run -- --env grepTags=@smoke            # Only @smoke tests
pnpm cy:run -- --env grepTags="@uat+@superadmin"  # AND logic (both tags)
pnpm cy:run -- --env grepTags="@uat @superadmin"  # OR logic (either tag)

# Combined options
pnpm cy:run -- --spec "cypress/e2e/_superadmin/**/*.cy.ts" --env grepTags=@smoke

# ❌ WRONG - Do NOT use these (hardcodes theme path)
# pnpm cypress run --config-file contents/themes/default/tests/cypress.config.ts
```

**Theme Detection:** Uses `NEXT_PUBLIC_ACTIVE_THEME` from `.env` (defaults to `default`)

---

## Test Execution Protocol

### Step 1: Determine Test Scope

```typescript
const input = '{{{ input }}}'

// Determine what to test
let testScope = 'all'
let specPattern = ''

if (!input || input === 'all') {
  // Run all tests
  testScope = 'all'
  specPattern = 'contents/themes/default/tests/cypress/e2e/**/*.cy.ts'
} else if (input.includes('.cy.ts')) {
  // Specific test file
  testScope = 'file'
  specPattern = input
} else if (input.includes('.claude/sessions/')) {
  // Session-based: run tests for that feature
  const sessionPath = input
  const featureName = extractFeatureName(sessionPath)
  testScope = 'feature'
  specPattern = `contents/themes/default/tests/cypress/e2e/**/*${featureName}*.cy.ts`
} else {
  // Entity or feature name
  testScope = 'entity'
  specPattern = `contents/themes/default/tests/cypress/e2e/**/*${input}*.cy.ts`
}
```

### Step 2: Check Dev Server

```typescript
// Check if dev server is running
const serverCheck = await Bash({
  command: 'curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 || echo "not_running"',
  description: 'Check dev server status'
})

if (serverCheck.output.includes('not_running') || serverCheck.output !== '200') {
  // Start dev server in background
  await Bash({
    command: 'pnpm dev &',
    description: 'Start development server',
    run_in_background: true
  })

  // Wait for server to be ready
  await Bash({
    command: 'npx wait-on http://localhost:5173 --timeout 60000',
    description: 'Wait for dev server'
  })
}
```

### Step 3: Execute Tests

```typescript
// Run tests based on scope
const testCommand = getTestCommand(testScope, specPattern)

await Bash({
  command: testCommand,
  description: `Run Cypress tests (${testScope})`,
  timeout: 300000  // 5 minutes max
})
```

---

## Test Commands by Scope

### Run All Tests

```bash
# Full test suite (auto-detects active theme)
pnpm cy:run

# With specific browser
pnpm cy:run -- --browser chrome
```

### Run API Tests Only

```bash
# All API tests
pnpm cy:run -- --spec "cypress/e2e/api/**/*.cy.ts"

# Specific API test file
pnpm cy:run -- --spec "cypress/e2e/api/products.cy.ts"
```

### Run UAT Tests Only

```bash
# All UAT tests
pnpm cy:run -- --spec "cypress/e2e/uat/**/*.cy.ts"

# Specific UAT test file
pnpm cy:run -- --spec "cypress/e2e/uat/products.cy.ts"
```

### Run Entity-Specific Tests

```bash
# All tests for an entity (API + UAT)
pnpm cy:run -- --spec "cypress/e2e/**/*products*.cy.ts"
```

### Run Single Test File

```bash
pnpm cy:run -- --spec "cypress/e2e/specific/test.cy.ts"
```

### Run with Grep Tags

```bash
# Run smoke tests only
pnpm cy:run -- --env grepTags=@smoke

# Run critical tests
pnpm cy:run -- --env grepTags=@critical

# Run multiple tags (AND logic - must have both)
pnpm cy:run -- --env grepTags="@uat+@superadmin"

# Run multiple tags (OR logic - have either)
pnpm cy:run -- --env grepTags="@uat @superadmin"

# Combine with spec pattern
pnpm cy:run -- --spec "cypress/e2e/_superadmin/**/*.cy.ts" --env grepTags=@smoke
```

### Common Grep Tags

| Tag | Description |
|-----|-------------|
| `@smoke` | Critical path, fast tests |
| `@uat` | User acceptance tests |
| `@api` | API endpoint tests |
| `@in-develop` | Tests being developed/fixed |
| `@feat-admin` | Admin feature tests |
| `@superadmin` | Superadmin-only tests |

---

## Step 4: Parse Results

```typescript
// Parse test output for results
const results = parseTestResults(testOutput)

/*
Results structure:
{
  total: 24,
  passed: 22,
  failed: 2,
  skipped: 0,
  duration: '2m 45s',
  failures: [
    {
      spec: 'e2e/api/products.cy.ts',
      test: 'should create new product',
      error: 'Expected status 201 but got 400',
      screenshot: 'screenshots/products--should-create.png'
    }
  ]
}
*/
```

### Step 5: Generate Report

```typescript
// If session exists, update tests.md
if (sessionPath) {
  await Edit({
    file_path: `${sessionPath}/tests.md`,
    old_string: '[Vacío hasta que qa-automation ejecute tests]',
    new_string: `### Resultados de Ejecución

**Fecha:** ${new Date().toISOString()}
**Scope:** ${testScope}
**Duración:** ${results.duration}

| Métrica | Valor |
|---------|-------|
| Total | ${results.total} |
| Pasaron | ${results.passed} |
| Fallaron | ${results.failed} |
| Omitidos | ${results.skipped} |
| Pass Rate | ${((results.passed / results.total) * 100).toFixed(1)}% |

${results.failed > 0 ? `
### Tests Fallidos

${results.failures.map(f => `
**${f.spec}**
- Test: ${f.test}
- Error: \`${f.error}\`
- Screenshot: \`${f.screenshot}\`
`).join('\n')}
` : '### Todos los tests pasaron'}`
  })
}
```

---

## Interactive Mode (for debugging)

```bash
# Open Cypress UI for interactive debugging (auto-detects theme)
pnpm cy:open

# Run specific test interactively
pnpm cy:open -- --spec "cypress/e2e/api/products.cy.ts"
```

---

## Environment Variables

```typescript
// Ensure test environment is configured
const envVars = {
  CYPRESS_BASE_URL: 'http://localhost:5173',
  CYPRESS_API_URL: 'http://localhost:5173/api',
  // Test user credentials
  CYPRESS_TEST_USER: 'superadmin@nextspark.dev',
  CYPRESS_TEST_PASSWORD: 'Test123!@#',
  // API key for auth tests
  CYPRESS_API_KEY: process.env.TEST_API_KEY
}
```

---

## Output Format

```markdown
## Test Execution Results

**Scope:** ${testScope}
**Spec Pattern:** \`${specPattern}\`
**Duration:** ${results.duration}

### Summary

| Status | Count |
|--------|-------|
| Total | ${results.total} |
| Passed | ${results.passed} |
| Failed | ${results.failed} |
| Skipped | ${results.skipped} |

### Pass Rate: ${passRate}%

${results.failed === 0 ? `
### All Tests Passed

No failures detected. Test suite is green.
` : `
### Failed Tests

${results.failures.map(f => `
#### ${f.test}
- **File:** \`${f.spec}\`
- **Error:** ${f.error}
- **Screenshot:** \`${f.screenshot}\`
`).join('\n')}

### Recommended Actions
1. Run \`/test:fix\` to auto-repair failing tests
2. Check screenshots in \`cypress/screenshots/\`
3. Review test logs for stack traces
`}

### Test Files Executed
${testFiles.map(f => `- \`${f}\``).join('\n')}

### Next Steps
${results.failed > 0
  ? '- Run `/test:fix` to attempt automatic fixes'
  : '- Tests passing. Ready for code review.'}
```

---

## Common Issues and Solutions

### Tests Timeout

```bash
# Increase timeout
pnpm cy:run -- --config defaultCommandTimeout=10000
```

### Server Not Ready

```bash
# Use test:e2e which handles server start
pnpm test:e2e

# Or manually wait then run
npx wait-on http://localhost:5173 --timeout 60000 && pnpm cy:run
```

### Browser Issues

```bash
# Run headless with specific browser
pnpm cy:run -- --browser chrome --headless

# Or use electron (default, most stable)
pnpm cy:run -- --browser electron
```

### Flaky Tests

```bash
# Run with retries
pnpm cy:run -- --config retries=2
```

### Run Only Failing/In-Development Tests

```bash
# Tests tagged with @in-develop
pnpm cy:run -- --env grepTags=@in-develop
```

---

## Parallel Execution (CI)

```bash
# For CI with parallelization
pnpm cy:run -- \
  --record \
  --parallel \
  --group "E2E Tests" \
  --ci-build-id ${BUILD_ID}
```

---

## BDD Documentation Check

After running tests, verify the BDD documentation is up to date:

1. **Coverage count** in frontmatter matches actual test count
2. **Test scenarios** are documented for each test
3. **UI Elements table** has all data-cy selectors used
4. **Summary table** lists all test IDs

```bash
# Find BDD files for a spec
# If running: cypress/e2e/_superadmin/all-users.cy.ts
# BDD file: cypress/e2e/_superadmin/all-users.bdd.md
```

---

**Now execute the tests for the scope described above.**
