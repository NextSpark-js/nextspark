# Quality Gates (v4.0)

> **Version 4.0** - 9 quality gates that ensure code quality at critical checkpoints.

## Introduction

Quality Gates are validation checkpoints that **BLOCK workflow progress** if conditions are not met. They represent the "Fail Fast" principle - catching issues early before they propagate.

> **Note:** This is ONE approach to quality validation. Gates can be customized, removed, or added based on your needs. See [Customization](./10-customization.md) for adapting gates to your workflow.

**Key Concepts:**
- **9 Gates** - Strategic validation points throughout the workflow (2 conditional)
- **Blocking Behavior** - Failed gates stop progress until fixed
- **Retry Logic** - Some gates have automatic fix-and-retry (max 3 attempts)
- **Gate Agents** - Specialized validator agents handle each gate

---

## Gates Overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                     9 QUALITY GATES IN WORKFLOW v4.0                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  BLOCK 2: FOUNDATION                                                     │
│  ├─ [GATE 1] plugin-validator (Phase 4) ─── TypeScript, registry        │
│  ├─ [GATE 2] theme-validator (Phase 4b) ─── Build, configs              │
│  └─ [GATE 3] db-validator (Phase 6) ─────── Migrations, data            │
│                                                                          │
│  BLOCK 3: BACKEND                                                        │
│  ├─ [GATE 4] backend-validator (Phase 8) ── Jest, build, tsc            │
│  └─ [GATE 5] api-tester (Phase 9) ───────── Cypress API [+RETRY]        │
│                                                                          │
│  BLOCK 5: FRONTEND                                                       │
│  ├─ [GATE 6] frontend-validator (Phase 12)─ data-cy, i18n               │
│  └─ [GATE 7] functional-validator (Phase 13) AC coherence               │
│                                                                          │
│  BLOCK 6: QA                                                             │
│  ├─ [GATE 8] qa-manual (Phase 14) ───────── Navigation [+RETRY]         │
│  └─ [GATE 9] qa-automation (Phase 15) ───── Cypress UAT                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Gate Summary Table

| # | Gate | Phase | Block | Retry | On Failure |
|---|------|-------|-------|-------|------------|
| 1 | plugin-validator | 4 | Foundation | No | → plugin-creator |
| 2 | theme-validator | 4b | Foundation | No | → theme-creator |
| 3 | db-validator | 6 | Foundation | No | → db-developer |
| 4 | backend-validator | 8 | Backend | No | → backend-developer |
| 5 | api-tester | 9 | Backend | Yes (3x) | → backend-developer |
| 6 | frontend-validator | 12 | Frontend | No | → frontend-developer |
| 7 | functional-validator | 13 | Frontend | No | → appropriate dev |
| 8 | qa-manual | 14 | QA | Yes (3x) | → appropriate dev |
| 9 | qa-automation | 15 | QA | Smart | → qa-automation fix |

---

## Gate 1: Plugin Validator

**Phase:** 4 (Conditional)
**Agent:** `plugin-validator`
**Condition:** Only if Phase 3 (plugin-creator) executed

### Gate Conditions

```markdown
- [ ] TypeScript compiles without errors
- [ ] `plugin.config.ts` exists and is valid
- [ ] Plugin appears in `PLUGIN_REGISTRY`
- [ ] Plugin enabled in `plugin-sandbox` theme
- [ ] `pnpm build` passes with plugin-sandbox theme
```

### Validation Commands

```bash
# TypeScript compilation
pnpm tsc --noEmit

# Build with plugin-sandbox
NEXT_PUBLIC_ACTIVE_THEME=plugin-sandbox pnpm build

# Verify registry
grep -l "plugin-name" core/lib/registries/plugin-registry.ts
```

### On Failure

1. Identify failing condition
2. Call `plugin-creator` with specific fix task
3. Re-run validation
4. If still failing, document in `context.md` and BLOCK

---

## Gate 2: Theme Validator

**Phase:** 4b (Conditional)
**Agent:** `theme-validator`
**Condition:** Only if Phase 3b (theme-creator) executed

### Gate Conditions

```markdown
- [ ] `pnpm build` passes without errors
- [ ] `theme.config.ts` exists and exports valid config
- [ ] `app.config.ts` exists and exports valid config
- [ ] `dashboard.config.ts` exists and exports valid config
- [ ] `permissions.config.ts` exists and exports valid config
- [ ] Team Mode configured correctly (if enabled)
- [ ] Theme appears in `THEME_REGISTRY`
```

### Validation Commands

```bash
# Build with new theme
NEXT_PUBLIC_ACTIVE_THEME=new-theme pnpm build

# Verify config files exist
ls contents/themes/new-theme/config/theme.config.ts
ls contents/themes/new-theme/config/app.config.ts
ls contents/themes/new-theme/config/dashboard.config.ts
ls contents/themes/new-theme/config/permissions.config.ts

# Verify registry
grep -l "new-theme" core/lib/registries/theme-registry.ts
```

### On Failure

1. Identify missing/invalid config
2. Call `theme-creator` with specific fix task
3. Re-run validation
4. If still failing, document in `context.md` and BLOCK

---

## Gate 3: DB Validator

**Phase:** 6
**Agent:** `db-validator`

### Gate Conditions

```markdown
- [ ] Migrations execute successfully
- [ ] All expected tables exist
- [ ] Sample data present (20+ records per entity)
- [ ] Test users exist with correct password hash
- [ ] Team memberships configured (if Team Mode enabled)
- [ ] Foreign key relationships valid (JOINs work)
- [ ] `devKeyring` configured in `app.config.ts`
```

### Validation Commands

```bash
# Run migrations
pnpm db:migrate

# Verify database structure
pnpm db:verify

# Test user authentication (via API or direct query)
# Check test users can authenticate with password Test1234
```

### Required Test Users

| Email | Role | Password | Must Exist |
|-------|------|----------|------------|
| owner@test.com | owner | Test1234 | ✓ |
| admin@test.com | admin | Test1234 | ✓ |
| member@test.com | member | Test1234 | ✓ |
| guest@test.com | guest | Test1234 | ✓ |
| superadmin@cypress.com | superadmin | Test1234 | ✓ |

### On Failure

1. Identify failing condition (missing table, bad data, etc.)
2. Call `db-developer` with specific fix task
3. Re-run validation
4. If still failing, document in `context.md` and BLOCK

---

## Gate 4: Backend Validator

**Phase:** 8
**Agent:** `backend-validator`

### Gate Conditions

```markdown
- [ ] Jest API tests pass: `pnpm test -- --testPathPattern=api`
- [ ] Build succeeds: `pnpm build`
- [ ] TypeScript clean: `tsc --noEmit` (no errors)
- [ ] Lint passes: `pnpm lint`
- [ ] Dual auth implemented on all new routes
```

### Validation Commands

```bash
# Run API tests
pnpm test -- --testPathPattern=api

# Build
pnpm build

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint
```

### Dual Auth Verification

Each API route must support both authentication methods:

```typescript
// Session-based (cookies)
const session = await auth.getSession(request)

// API key-based (header)
const apiKey = request.headers.get('x-api-key')
```

### On Failure

1. Identify failing test/error
2. Call `backend-developer` with specific fix task
3. Re-run validation
4. If still failing, document in `context.md` and BLOCK

---

## Gate 5: API Tester [RETRY]

**Phase:** 9
**Agent:** `api-tester`
**Retry:** Yes (max 3 attempts)

### Gate Conditions

```markdown
- [ ] All Cypress API tests pass (100%)
- [ ] Status codes tested: 200, 201, 400, 401, 404
- [ ] Dual auth tested (session + API key)
- [ ] Pagination tested (if applicable)
- [ ] Results documented in `tests.md`
```

### Retry Logic

```typescript
const MAX_RETRIES = 3

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  console.log(`API Test Attempt ${attempt}/${MAX_RETRIES}`)

  const result = await runCypressAPITests()

  if (result.allPassed) {
    console.log('✅ All API tests passed')
    await updateTestsFile(result)
    break
  }

  // Classify and fix failures
  for (const failure of result.failures) {
    await launchAgent('backend-developer', {
      task: `[API-TESTER FIX] Fix failing test`,
      context: {
        endpoint: failure.endpoint,
        method: failure.method,
        expectedStatus: failure.expectedStatus,
        actualStatus: failure.actualStatus,
        errorMessage: failure.error
      }
    })
  }

  if (attempt === MAX_RETRIES) {
    console.log('❌ GATE_FAILED: Max retries exceeded')
    await documentFailure('tests.md', result)
    throw new Error('API_TESTER_GATE_FAILED')
  }
}
```

### On 3 Failures

1. Document all failures in `tests.md`
2. Add entry to `pendings.md`
3. GATE_FAILED - requires manual intervention
4. Workflow BLOCKED

---

## Gate 6: Frontend Validator

**Phase:** 12
**Agent:** `frontend-validator`

### Gate Conditions

```markdown
- [ ] ALL interactive components have `data-cy` attributes
- [ ] Nomenclature follows: `{entity}-{component}-{detail}`
- [ ] NO hardcoded strings in components
- [ ] Translations exist in EN (`messages/en.json`)
- [ ] Translations exist in ES (`messages/es.json`)
- [ ] Translations in correct namespace
- [ ] NO next-intl runtime errors
- [ ] All selectors documented in `tests.md`
```

### data-cy Nomenclature

```typescript
// ✅ Correct
data-cy="products-table-row"
data-cy="products-form-submit"
data-cy="products-modal-close"

// ❌ Incorrect
data-cy="table-row"
data-cy="submit-button"
data-cy="closeBtn"
```

### Validation Commands

```bash
# Search for hardcoded strings (should return nothing)
grep -r "className.*>" --include="*.tsx" | grep -v "t("

# Verify translation files
cat contents/themes/*/messages/en.json | jq '.namespace'
cat contents/themes/*/messages/es.json | jq '.namespace'

# Build to catch next-intl errors
pnpm build
```

### On Failure

1. List missing `data-cy` attributes
2. List hardcoded strings found
3. Call `frontend-developer` with specific fixes
4. Re-run validation
5. If still failing, document in `context.md` and BLOCK

---

## Gate 7: Functional Validator

**Phase:** 13
**Agent:** `functional-validator`

### Gate Conditions

```markdown
- [ ] `progress.md` shows all developer phases completed
- [ ] Each AC from `requirements.md` has corresponding implementation
- [ ] Playwright spot-checks pass (navigation, basic interaction)
- [ ] No major gaps between `plan.md` and actual implementation
```

### AC Verification Process

```typescript
// Read requirements
const requirements = await readFile('requirements.md')
const acceptanceCriteria = parseACs(requirements)

// For each AC, verify implementation
for (const ac of acceptanceCriteria) {
  const verified = await verifyACImplementation(ac)

  if (!verified) {
    gaps.push({
      ac: ac.id,
      description: ac.description,
      status: 'NOT_IMPLEMENTED'
    })
  }
}
```

### Playwright Spot-Checks

```typescript
// Basic navigation checks
await page.goto('/dashboard')
await expect(page).toHaveTitle(/Dashboard/)

await page.goto('/dashboard/products')
await expect(page.locator('[data-cy="products-table"]')).toBeVisible()
```

### On Failure

1. List unimplemented ACs
2. List gaps between plan and implementation
3. Call appropriate developer (backend/frontend)
4. Re-run validation
5. If still failing, document in `context.md` and BLOCK

---

## Gate 8: QA Manual [RETRY]

**Phase:** 14
**Agent:** `qa-manual`
**Retry:** Yes (max 3 attempts)

### Gate Conditions

```markdown
- [ ] Dev server starts without errors
- [ ] All dashboard screens load successfully
- [ ] All public pages load successfully
- [ ] NO console errors in browser
- [ ] NO server errors (500s)
- [ ] UI renders correctly (no visual breaks)
- [ ] [MANUAL] ACs from requirements verified
```

### Manual Checks with Playwright

```typescript
// Start dev server
await startDevServer()

// Navigate to all key pages
const pages = [
  '/dashboard',
  '/dashboard/products',
  '/dashboard/settings',
  '/products',
  '/'
]

for (const path of pages) {
  await page.goto(path)

  // Check for console errors
  const consoleErrors = await getConsoleErrors()
  if (consoleErrors.length > 0) {
    errors.push({ page: path, type: 'console', errors: consoleErrors })
  }

  // Check for network errors
  const networkErrors = await getNetworkErrors()
  if (networkErrors.length > 0) {
    errors.push({ page: path, type: 'network', errors: networkErrors })
  }
}
```

### Retry Logic

```typescript
const MAX_RETRIES = 3

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  console.log(`QA Manual Attempt ${attempt}/${MAX_RETRIES}`)

  const result = await performManualQAChecks()

  if (result.allPassed) {
    console.log('✅ QA Manual passed')
    await updateContextFile('qa-manual', 'PASSED')
    break
  }

  // Classify and route errors
  for (const error of result.errors) {
    if (error.type === 'api_error' || error.type === 'server_error') {
      await launchAgent('backend-developer', {
        task: `[QA-MANUAL FIX] ${error.message}`,
        context: error
      })
    } else if (error.type === 'ui_error' || error.type === 'console_error') {
      await launchAgent('frontend-developer', {
        task: `[QA-MANUAL FIX] ${error.message}`,
        context: error
      })
    }
  }

  if (attempt === MAX_RETRIES) {
    console.log('❌ GATE_FAILED: Max retries exceeded')
    await documentInPendings(result.errors)
    throw new Error('QA_MANUAL_GATE_FAILED')
  }
}
```

### On 3 Failures

1. Document all errors in `context.md`
2. Add unresolved issues to `pendings.md`
3. GATE_FAILED - BLOCKS `qa-automation`
4. Requires manual intervention

---

## Gate 9: QA Automation [SMART RETRY]

**Phase:** 15
**Agent:** `qa-automation`
**Retry:** Smart Retry Strategy with tags

### Gate Conditions

```markdown
- [ ] Selectors read from `tests.md`
- [ ] Context inherited from qa-manual
- [ ] All `data-cy` selectors validated before running
- [ ] POMs created/updated (reuse existing where possible)
- [ ] UAT tests created for all [AUTO] ACs
- [ ] Smart Retry Strategy executed
- [ ] 100% pass rate achieved
- [ ] AC Coverage Report generated
- [ ] ALL temporary tags removed
```

### Smart Retry Strategy

Uses Cypress grep tags for targeted test execution:

```typescript
const sessionName = '2025-12-15-products-v1'
const scopeTag = `@scope-${sessionName}`
const developTag = '@in-develop'

// Step 1: Run all tests in scope
await runCypress(`--env grepTags=${scopeTag}`)

// Step 2: Tag failing tests
for (const failure of failures) {
  await addTag(failure.testFile, developTag)
  await addTag(failure.testFile, scopeTag)
}

// Step 3: Fix and retry loop
while (hasFailingTests()) {
  // Fix the failing test
  await fixTest(currentFailure)

  // Run only @in-develop tests
  const result = await runCypress(`--env grepTags=${developTag}`)

  if (result.passed) {
    // Remove @in-develop tag (keep @scope-* for final run)
    await removeTag(currentFailure.testFile, developTag)
  }
}

// Step 4: Final run of all scope tests
await runCypress(`--env grepTags=${scopeTag}`)

// Step 5: CLEANUP - Remove ALL temporary tags
await removeAllTags([developTag, scopeTag])
```

### Temporary Tags

| Tag | Purpose | When Removed |
|-----|---------|--------------|
| `@in-develop` | Tests being actively fixed | After test passes |
| `@scope-{session}` | All tests for current session | After final run |

**CRITICAL:** `code-reviewer` (Phase 16) verifies NO temporary tags remain.

### AC Coverage Report

Generated in `tests.md`:

```markdown
## AC Coverage Report

| AC ID | Description | Type | Test File | Status |
|-------|-------------|------|-----------|--------|
| AC-001 | Create product | [AUTO] | products-crud.cy.ts | ✅ |
| AC-002 | Edit product | [AUTO] | products-crud.cy.ts | ✅ |
| AC-003 | Delete product | [AUTO] | products-crud.cy.ts | ✅ |
| AC-004 | Form validation | [AUTO] | products-form.cy.ts | ✅ |
| AC-005 | Visual design | [MANUAL] | - | qa-manual ✅ |
| AC-006 | Code quality | [REVIEW] | - | code-reviewer |

**Coverage:** 4/4 [AUTO] ACs covered (100%)
```

### On Failure

1. Continue Smart Retry until all tests pass
2. If tests cannot be fixed, document in `pendings.md`
3. Ensure all temporary tags removed before proceeding
4. GATE_FAILED if 100% not achieved

---

## Gate Failure Handling

### Immediate Failures (No Retry)

For gates 1-4, 6-7:

1. Gate identifies failure condition
2. Appropriate developer agent called with fix task
3. Developer fixes issue
4. Gate re-validates
5. If still failing after fix, BLOCKS workflow

### Retry Failures (With Retry)

For gates 5, 8:

1. Gate runs validation
2. On failure, classifies error type
3. Calls appropriate developer
4. Developer fixes
5. Gate retries (max 3 attempts)
6. If 3 failures, GATE_FAILED

### Smart Retry Failures

For gate 9:

1. Tags failing tests
2. Iteratively fixes and retests
3. Removes tags as tests pass
4. Final full run
5. Cleanup all tags
6. If 100% not achieved, GATE_FAILED

---

## Recovering from GATE_FAILED

When a gate fails completely:

1. **Check `pendings.md`** - Lists unresolved issues
2. **Check `context.md`** - Shows what was tried
3. **Manual Investigation** - Human reviews the issue
4. **Fix Manually** - Make necessary changes
5. **Re-run Gate** - Use command to retry specific gate

### Re-running a Specific Gate

```bash
# Via task:execute with specific phase
/task:execute .claude/sessions/session-name --from-phase 9

# Or manually invoke the validator agent
# (launches api-tester for gate 5)
```

---

## Next Steps

- **[Workflow Phases](./04-workflow-phases.md)** - Full phase details
- **[Agents](./03-agents.md)** - Agent responsibilities
- **[PM Decisions](./09-pm-decisions.md)** - How decisions affect gates
- **[Sessions](./05-sessions.md)** - Session file structure
