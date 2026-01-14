---
description: Fix failing Cypress tests iteratively until all pass
---

# Test Fix - Repair Failing Tests

You are fixing failing Cypress tests through iterative analysis and correction.

**Failing Test or Error Description:**
{{{ input }}}

---

## Your Mission

Fix failing tests through an **iterative batch loop**:

1. **Identify failures** and tag with `@in-develop`
2. **Detect flaky vs real failures** (run 2x before fixing)
3. **Analyze root cause** using POM architecture awareness
4. **Apply smart fixes** respecting project patterns
5. **Run batch of 5** tests until all pass
6. **Remove `@in-develop` tag** when fixed
7. **Update BDD documentation** when tests change

---

## ⚠️ IMPORTANT: Cypress Commands

The project uses a custom runner that **auto-detects the active theme**:

```bash
# ✅ CORRECT - Use these commands (auto-detect theme from NEXT_PUBLIC_ACTIVE_THEME)
pnpm cy:run                                     # Run all tests
pnpm cy:run -- --env grepTags=@in-develop       # Run only @in-develop tagged tests
pnpm cy:run -- --spec "cypress/e2e/**/*.cy.ts"  # Run specific spec pattern

# ❌ WRONG - Do NOT use these (hardcodes theme path)
# pnpm cypress run --config-file contents/themes/default/tests/cypress.config.ts
```

**Theme Detection:** Uses `NEXT_PUBLIC_ACTIVE_THEME` from `.env` (defaults to `default`)

---

## Phase 1: Identify and Tag Failing Tests

### Step 1.1: Run Initial Test Suite

```bash
# Run specified tests or full suite (auto-detects active theme)
pnpm cy:run -- --spec "${input || 'cypress/e2e/**/*.cy.ts'}" 2>&1

# Or run by grep tag
pnpm cy:run -- --env grepTags=@in-develop
```

### Step 1.2: Tag Failing Tests with @in-develop

For each failing test file, add the `@in-develop` tag:

```typescript
// Before
describe('Entity CRUD', {
  tags: ['@uat', '@feat-entity', '@crud']
}, () => {

// After
describe('Entity CRUD', {
  tags: ['@uat', '@feat-entity', '@crud', '@in-develop']  // Added @in-develop
}, () => {
```

**Important:** No session tag needed - `/test-fix` can run outside active sessions.

---

## Phase 2: Flaky Test Detection

Before attempting fixes, determine if failure is **consistent** or **flaky**:

```typescript
async function detectFlakyTests(failingTests: string[]) {
  const results = new Map<string, { runs: number, failures: number }>()

  for (const test of failingTests) {
    // Run each test 2 times
    for (let i = 0; i < 2; i++) {
      const result = await runSingleTest(test)
      const current = results.get(test) || { runs: 0, failures: 0 }
      current.runs++
      if (!result.passed) current.failures++
      results.set(test, current)
    }
  }

  return {
    // Fails every time = real bug
    consistentFailures: [...results].filter(([_, r]) => r.failures === r.runs),
    // Fails sometimes = flaky test
    flakyTests: [...results].filter(([_, r]) => r.failures > 0 && r.failures < r.runs),
    // Passed on retry = transient issue
    transientFailures: [...results].filter(([_, r]) => r.failures === 0)
  }
}
```

**Flaky Test Fixes:**
- Add deterministic waits (ApiInterceptor)
- Remove race conditions
- Ensure proper test isolation

---

## Phase 3: Batch Execution Strategy

### Run Tests in Batches of 5

```bash
# Execute only @in-develop tagged tests (auto-detects theme)
pnpm cy:run -- --env grepTags=@in-develop 2>&1
```

### Fix Loop (Max 5 Attempts per Test)

```typescript
const MAX_ATTEMPTS = 5
const BATCH_SIZE = 5

async function fixTestBatch(failingTests: string[]) {
  // Process in batches of 5
  for (let i = 0; i < failingTests.length; i += BATCH_SIZE) {
    const batch = failingTests.slice(i, i + BATCH_SIZE)

    for (const test of batch) {
      let attempt = 1

      while (attempt <= MAX_ATTEMPTS) {
        console.log(`\n🔧 Fixing: ${test} (Attempt ${attempt}/${MAX_ATTEMPTS})`)

        // 1. Run test and capture detailed error
        const failure = await runTestWithDiagnostics(test)

        if (failure.passed) {
          // Remove @in-develop tag
          await removeInDevelopTag(test)
          console.log(`✅ Fixed: ${test}`)
          break
        }

        // 2. Analyze with full context
        const analysis = await analyzeFailure(failure)

        // 3. Apply appropriate fix
        await applyFix(analysis)

        attempt++
      }

      if (attempt > MAX_ATTEMPTS) {
        console.log(`❌ Could not fix after ${MAX_ATTEMPTS} attempts: ${test}`)
      }
    }
  }
}
```

---

## Phase 4: Smart Failure Analysis

### Failure Categories

| Type | Indicator | Fix Location | Priority |
|------|-----------|--------------|----------|
| **Selector Not Found** | `Timed out waiting for element` | POM or Component | High |
| **API Intercept Mismatch** | `No request matching` | POM ApiInterceptor | High |
| **Assertion Failed** | `expected X to equal Y` | Test or Feature | Medium |
| **Auth Error** | `401 Unauthorized` | session-helpers.ts | High |
| **Timeout** | `exceeded timeout` | Add deterministic wait | Medium |
| **Network Error** | `cy.request() failed` | API or Test config | Medium |
| **Fixture Error** | `Cannot read property` | fixtures/*.json | Low |

### Diagnostic Data Collection

```typescript
async function runTestWithDiagnostics(testSpec: string) {
  // Run test with full diagnostics (auto-detects theme)
  const result = await Bash({
    command: `pnpm cy:run -- --spec "${testSpec}" --reporter json 2>&1`,
    timeout: 120000
  })

  // Collect additional diagnostics
  return {
    ...parseTestOutput(result),

    // Check for screenshots (Cypress auto-generates on failure)
    screenshots: await Glob('contents/themes/default/tests/cypress/screenshots/**/*.png'),

    // Check for videos
    videos: await Glob('contents/themes/default/tests/cypress/videos/**/*.mp4'),

    // Parse console errors from test output
    consoleErrors: extractConsoleErrors(result.output),

    // Extract network failures
    networkFailures: extractNetworkFailures(result.output)
  }
}
```

---

## Phase 5: POM-Aware Fix Patterns

### Understanding the Architecture

```
Test File (*.cy.ts)
    ↓ uses
POM (src/components/*POM.ts)
    ↓ extends
DashboardEntityPOM (src/core/DashboardEntityPOM.ts)
    ↓ uses
ApiInterceptor (src/helpers/ApiInterceptor.ts)
    ↓ reads
Selectors (fixtures/selectors/*.json)
```

### Fix: Selector Not Found

**IMPORTANT:** When adding missing selectors, choose the correct location based on the component:

| Component Location | Selector File |
|-------------------|---------------|
| `app/admin/**`, `app/dashboard/**`, `core/**` | `core/lib/test/core-selectors.ts` |
| `contents/themes/{theme}/**` | Theme's `selectors.ts` |

```typescript
async function fixSelectorIssue(failure: TestFailure) {
  // Extract selector from error: [data-cy="entity-table"]
  const selectorMatch = failure.error.match(/\[data-cy="([^"]+)"\]/)
  if (!selectorMatch) return { type: 'unknown' }

  const selector = selectorMatch[1]
  const entitySlug = extractEntityFromSelector(selector) // e.g., "tasks" from "tasks-table"

  // 1. Find where the component lives to determine selector file
  const componentSearch = await Grep({
    pattern: `data-cy="${selector}"`,
    path: '.' // Search everywhere
  })

  // Determine selector file based on component location
  const isThemeComponent = componentSearch.some(f => f.includes('contents/themes/'))
  const selectorFile = isThemeComponent
    ? `contents/themes/${activeTheme}/tests/cypress/src/selectors.ts`
    : 'core/lib/test/core-selectors.ts'

  // 2. Check if selector is defined in POM
  const pomFile = `contents/themes/${activeTheme}/tests/cypress/src/components/${pascalCase(entitySlug)}POM.ts`
  const pomExists = await fileExists(pomFile)

  if (pomExists) {
    const pomContent = await Read(pomFile)

    // Check if POM uses DashboardEntityPOM (inherits selectors)
    if (pomContent.includes('extends DashboardEntityPOM')) {
      // Selector should come from base class pattern replacement
      // Check if entity slug is correct in constructor
      console.log('POM extends DashboardEntityPOM - checking slug configuration')

      // Verify entities.json has correct slug
      const entitiesJson = await Read(`contents/themes/${activeTheme}/tests/cypress/fixtures/entities.json`)
      // ... validate entity config
    }
  }

  // 2. Check dashboard.json for custom selectors
  const dashboardSelectors = await Read(
    `contents/themes/${activeTheme}/tests/cypress/fixtures/selectors/dashboard.json`
  )

  // 3. Check if selector exists in actual component
  const componentSearch = await Grep({
    pattern: `data-cy="${selector}"`,
    path: 'app/'
  })

  if (componentSearch.length === 0) {
    // Selector doesn't exist in component - this is a frontend issue
    return {
      type: 'missing_selector',
      fix: 'frontend',
      selector,
      message: `Add data-cy="${selector}" to the component`
    }
  }

  // 4. Selector exists but test can't find it - timing issue
  return {
    type: 'timing_issue',
    fix: 'add_wait',
    selector,
    message: 'Element exists but not visible in time - add deterministic wait'
  }
}
```

### Fix: API Intercept Mismatch

```typescript
async function fixApiInterceptIssue(failure: TestFailure) {
  // Error: "Timed out retrying: cy.wait() timed out waiting for @entityList"

  const aliasMatch = failure.error.match(/@(\w+)/)
  if (!aliasMatch) return { type: 'unknown' }

  const alias = aliasMatch[1]

  // Check ApiInterceptor configuration
  const interceptorFile = `contents/themes/${activeTheme}/tests/cypress/src/helpers/ApiInterceptor.ts`
  const interceptorContent = await Read(interceptorFile)

  // Check if POM is using setupApiIntercepts()
  // Common issue: forgetting to call setupApiIntercepts() in beforeEach

  const testContent = await Read(failure.spec)

  if (!testContent.includes('setupApiIntercepts()')) {
    return {
      type: 'missing_intercept_setup',
      fix: 'test',
      message: 'Add pom.setupApiIntercepts() in beforeEach',
      patch: {
        file: failure.spec,
        old: 'beforeEach(() => {',
        new: `beforeEach(() => {
    pom.setupApiIntercepts()`
      }
    }
  }

  // Check if API endpoint pattern matches
  // ApiInterceptor uses: /api/v1/{slug}
  // Verify the entity slug is correct

  return {
    type: 'intercept_pattern_mismatch',
    fix: 'verify_slug',
    message: 'Verify entity slug matches API endpoint pattern'
  }
}
```

### Fix: Use ApiInterceptor Instead of Arbitrary Waits

```typescript
async function fixTimeoutWithApiInterceptor(failure: TestFailure) {
  const testContent = await Read(failure.spec)

  // ❌ Bad patterns to find and replace
  const badPatterns = [
    { pattern: /cy\.wait\(\d+\)/, replacement: 'Use ApiInterceptor wait' },
    { pattern: /\.should\('be\.visible'\)\.wait\(\d+\)/, replacement: 'Use API wait' },
    { pattern: /cy\.get\([^)]+\)\.should\('exist'\)[\s\S]*?cy\.wait\(\d+\)/, replacement: 'Combine with API wait' }
  ]

  for (const { pattern, replacement } of badPatterns) {
    if (pattern.test(testContent)) {
      console.log(`Found bad pattern: ${replacement}`)

      // Suggest proper fix using POM
      return {
        type: 'arbitrary_wait',
        fix: 'use_api_interceptor',
        message: `Replace arbitrary wait with deterministic API wait`,
        example: `
// ❌ Before (arbitrary wait)
cy.wait(2000)
cy.get('[data-cy="table"]').should('exist')

// ✅ After (deterministic wait)
pom.setupApiIntercepts()  // in beforeEach
pom.visitList()
pom.api.waitForList()     // waits for actual API response
pom.waitForList()         // then waits for UI
`
      }
    }
  }
}
```

---

## Phase 6: Fix Application

### Apply Fix Based on Analysis

```typescript
async function applyFix(analysis: FailureAnalysis) {
  switch (analysis.type) {
    case 'missing_selector':
      // Need frontend-developer to add data-cy
      await reportToContextMd(`
## Selector Missing: ${analysis.selector}

**Action Required:** frontend-developer needs to add \`data-cy="${analysis.selector}"\` to component.

**Search for component:**
\`\`\`bash
grep -r "className.*${analysis.selector.split('-')[0]}" app/
\`\`\`
`)
      break

    case 'missing_intercept_setup':
      // Auto-fix: add setupApiIntercepts
      await Edit({
        file_path: analysis.patch.file,
        old_string: analysis.patch.old,
        new_string: analysis.patch.new
      })
      break

    case 'arbitrary_wait':
      // Auto-fix: replace with API wait pattern
      await applyApiInterceptorFix(analysis)
      break

    case 'auth_error':
      // Check session-helpers.ts
      await fixAuthConfiguration(analysis)
      break

    case 'fixture_error':
      // Check and fix fixture files
      await fixFixtureConfiguration(analysis)
      break

    case 'feature_bug':
      // Call appropriate developer agent
      await callDeveloperAgent(analysis)
      break
  }
}
```

### Fix: Auth Issues

```typescript
async function fixAuthConfiguration(analysis: FailureAnalysis) {
  // Check session-helpers.ts
  const sessionHelpers = await Read(
    `contents/themes/${activeTheme}/tests/cypress/src/session-helpers.ts`
  )

  // Verify test users exist and credentials are correct
  const testUsers = {
    owner: { email: 'owner@test.com', password: 'Test123!@#' },
    member: { email: 'member@test.com', password: 'Test123!@#' },
    admin: { email: 'admin@test.com', password: 'Test123!@#' }
  }

  // Check if loginAsOwner/loginAsMember functions exist
  if (!sessionHelpers.includes('loginAsOwner')) {
    return {
      type: 'missing_login_function',
      message: 'session-helpers.ts missing loginAsOwner function'
    }
  }

  // Check if test is using correct login
  const testContent = await Read(analysis.spec)

  if (!testContent.includes('loginAs')) {
    return {
      type: 'missing_login_call',
      fix: {
        file: analysis.spec,
        old: 'beforeEach(() => {',
        new: `beforeEach(() => {
    cy.loginAsOwner()  // or loginAsMember based on test role`
      }
    }
  }
}
```

### Fix: Fixture Issues

```typescript
async function fixFixtureConfiguration(analysis: FailureAnalysis) {
  // Check entities.json
  const entitiesJson = await Read(
    `contents/themes/${activeTheme}/tests/cypress/fixtures/entities.json`
  )

  // Verify entity configuration
  const entities = JSON.parse(entitiesJson)

  // Check selector fixtures
  const dashboardSelectors = await Read(
    `contents/themes/${activeTheme}/tests/cypress/fixtures/selectors/dashboard.json`
  )

  // Verify patterns match
  const selectors = JSON.parse(dashboardSelectors)

  // Common issues:
  // 1. Entity slug mismatch
  // 2. Missing selector patterns
  // 3. Wrong baseUrl in fixtures
}
```

---

## Phase 7: Developer Agent Escalation

When fix requires code changes outside tests:

```typescript
async function callDeveloperAgent(analysis: FailureAnalysis) {
  const isApiIssue =
    analysis.spec.includes('/api/') ||
    analysis.error.includes('status') ||
    analysis.error.includes('request failed')

  const isSelectorIssue =
    analysis.type === 'missing_selector' ||
    analysis.error.includes('data-cy')

  if (isApiIssue) {
    // Write to context.md for backend-developer
    await appendToContextMd(`
## API Issue Detected by test:fix

**Test:** ${analysis.test}
**Error:** ${analysis.error}
**Expected:** ${analysis.expected}
**Actual:** ${analysis.actual}

**Required Action:** Fix API implementation

**Endpoint:** ${analysis.endpoint || 'Unknown'}
`)

    console.log('⚠️ API issue requires backend-developer attention')
    console.log('Details written to context.md')

  } else if (isSelectorIssue) {
    // Write to context.md for frontend-developer
    await appendToContextMd(`
## Missing Selector Detected by test:fix

**Test:** ${analysis.test}
**Selector:** ${analysis.selector}
**Component:** ${analysis.component || 'Unknown'}

**Required Action:** Add data-cy="${analysis.selector}" to component
`)

    console.log('⚠️ Selector issue requires frontend-developer attention')
    console.log('Details written to context.md')
  }
}
```

---

## Phase 8: Cleanup and Report

### Remove @in-develop Tag on Success

```typescript
async function removeInDevelopTag(testFile: string) {
  const content = await Read(testFile)

  // Remove @in-develop from tags array
  const updated = content.replace(
    /(tags:\s*\[[^\]]*)'@in-develop',?\s*([^\]]*\])/g,
    '$1$2'
  )

  // Clean up any trailing commas or spaces
  const cleaned = updated.replace(/,\s*\]/g, ']').replace(/\[\s*,/g, '[')

  await Write(testFile, cleaned)
  console.log(`🏷️ Removed @in-develop tag from ${testFile}`)
}
```

### Final Verification

```bash
# Run all previously failing tests one more time (auto-detects theme)
pnpm cy:run -- --spec "{list of fixed test files}" 2>&1
```

---

## Phase 9: Update BDD Documentation

**REQUIRED:** When tests are fixed or modified, update the companion `.bdd.md` file:

1. **Update coverage count** in frontmatter if tests added/removed
2. **Update test scenarios** if test logic changed
3. **Update UI Elements table** if selectors changed
4. **Update Summary table** with correct test IDs

```typescript
// Find BDD file for a test
// Test: cypress/e2e/_superadmin/all-users.cy.ts
// BDD:  cypress/e2e/_superadmin/all-users.bdd.md

const bddPath = testSpec.replace('.cy.ts', '.bdd.md')
```

---

## Output Report

```markdown
## Test Fix Results

**Initial Failures:** ${initialFailures.length}
**Flaky Tests Detected:** ${flakyTests.length}
**Fixed:** ${fixedCount}
**Still Failing:** ${stillFailing.length}
**Developer Escalations:** ${escalations.length}

### Flaky Tests (Fixed with Deterministic Waits)

| Test | Issue | Fix Applied |
|------|-------|-------------|
${flakyFixes.map(f => `| ${f.test} | ${f.issue} | Added ApiInterceptor wait |`).join('\n')}

### Fix Summary

| Test | Error Type | Fix Location | Fix Applied | Status |
|------|------------|--------------|-------------|--------|
${fixes.map(f => `| ${f.test} | ${f.errorType} | ${f.location} | ${f.fix} | ${f.status} |`).join('\n')}

### POM Updates

${pomUpdates.length > 0 ? pomUpdates.map(p => `
#### ${p.file}
\`\`\`diff
${p.diff}
\`\`\`
`).join('\n') : 'No POM updates needed'}

### Developer Escalations

${escalations.length > 0 ? escalations.map(e => `
- **${e.agent}**: ${e.issue}
  - Test: ${e.test}
  - Details in context.md
`).join('\n') : 'None - all issues resolved in tests'}

### Tags Status

- Tests with @in-develop removed: ${tagsRemoved}
- Tests still tagged @in-develop: ${stillTagged}

### Final Status

${stillFailing.length === 0
  ? `✅ **All Tests Passing**

All ${fixedCount} failing tests have been fixed.
- @in-develop tags removed
- Ready for next phase`
  : `⚠️ **Manual Review Required**

${stillFailing.length} tests could not be auto-fixed:
${stillFailing.map(f => `- ${f.test}: ${f.reason}`).join('\n')}

**Next Steps:**
1. Review escalations in context.md
2. Fix reported issues (selectors, API bugs)
3. Run \`/test-fix\` again
`}
```

---

## Best Practices

### DO:
- ✅ Always detect flaky tests first (run 2x)
- ✅ Use POM methods for interactions
- ✅ Prefer ApiInterceptor for waits
- ✅ Check fixtures before assuming code bug
- ✅ Remove @in-develop tags when fixed
- ✅ Document escalations in context.md

### DON'T:
- ❌ Add `cy.wait(ms)` for timing issues
- ❌ Use `{ force: true }` to bypass visibility
- ❌ Skip tests instead of fixing them
- ❌ Change assertions without understanding why
- ❌ Ignore flaky tests (they indicate real issues)
- ❌ Fix directly in test file if POM should handle it

---

## Quick Reference: Common Fixes

```typescript
// ❌ Arbitrary wait
cy.wait(3000)

// ✅ Deterministic API wait
pom.api.waitForList()

// ❌ Force click
cy.get('button').click({ force: true })

// ✅ Proper visibility wait
pom.waitForForm()
pom.clickSubmit()

// ❌ Hardcoded selector in test
cy.get('[data-cy="tasks-table"]')

// ✅ Use POM selector
cy.get(pom.selectors.table)

// ❌ Direct API call without intercept
cy.visit('/dashboard/tasks')

// ✅ With intercept setup
pom.setupApiIntercepts()
pom.visitList()
pom.api.waitForList()
```

---

**Now fix the failing tests using this methodology.**
