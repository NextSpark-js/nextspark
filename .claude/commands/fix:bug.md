---
description: Fix a reported bug with automatic test creation and execution
---

# Fix Bug - Debug and Repair with Tests

You are fixing a reported bug with comprehensive debugging and test coverage.

**Bug Description:**
{{{ input }}}

---

## Your Mission

Fix the bug with proper validation:

1. **Understand the bug** from description and reproduction steps
2. **Locate the root cause** through investigation
3. **Create a failing test** that reproduces the bug
4. **Fix the bug** in the code
5. **Verify the test passes** after the fix
6. **Run regression tests** to ensure no new breaks

---

## Bug Fix Protocol

### Step 1: Analyze Bug Report

```typescript
const bugDescription = '{{{ input }}}'

// Extract key information
const bugInfo = {
  description: extractDescription(bugDescription),
  stepsToReproduce: extractSteps(bugDescription),
  expectedBehavior: extractExpected(bugDescription),
  actualBehavior: extractActual(bugDescription),
  affectedArea: determineArea(bugDescription)  // frontend, backend, api
}
```

### Step 2: Locate Affected Code

```typescript
// Search for related code based on bug description
const searchTerms = extractKeyTerms(bugDescription)

// Search in codebase
for (const term of searchTerms) {
  await Grep({
    pattern: term,
    path: 'app/',
    type: 'ts'
  })
}

// Read likely affected files
await Read(affectedFiles)
```

### Step 3: Understand Root Cause

```typescript
// Analyze the code flow
// Identify where the bug occurs

// Common bug patterns:
const bugPatterns = {
  'null_reference': 'Missing null check',
  'type_mismatch': 'Incorrect type handling',
  'state_bug': 'State not updated correctly',
  'race_condition': 'Async timing issue',
  'validation_gap': 'Missing input validation',
  'auth_bypass': 'Authentication check missing',
  'logic_error': 'Incorrect business logic'
}

// Document findings
console.log(`Root Cause: ${rootCause}`)
console.log(`Location: ${bugLocation}`)
```

### Step 4: Create Failing Test (TDD)

```typescript
// Determine test type
const isApiIssue = bugInfo.affectedArea === 'api'
const isUiIssue = bugInfo.affectedArea === 'frontend'

if (isApiIssue) {
  // Create API test that reproduces bug
  const apiTestPath = `contents/themes/default/tests/cypress/e2e/api/bug-${bugId}.cy.ts`

  await Write({
    file_path: apiTestPath,
    content: `/**
 * Bug Fix Test: ${bugInfo.description}
 *
 * This test reproduces and verifies the fix for:
 * ${bugDescription}
 */

describe('Bug Fix: ${bugInfo.description}', () => {
  beforeEach(() => {
    cy.loginByApi('superadmin@cypress.com', 'Test123!@#')
  })

  it('should ${expectedBehavior} (was: ${actualBehavior})', () => {
    // Steps to reproduce
    ${stepsToReproduce.map(step => `// ${step}`).join('\n    ')}

    // Test the fix
    cy.request({
      method: '${method}',
      url: '${endpoint}',
      body: ${JSON.stringify(requestBody)},
      failOnStatusCode: false
    }).then((response) => {
      // Expected behavior after fix
      expect(response.status).to.eq(${expectedStatus})
      expect(response.body).to.have.property('${expectedProperty}')
    })
  })
})
`
  })
} else {
  // Create UAT test that reproduces bug
  const uatTestPath = `contents/themes/default/tests/cypress/e2e/uat/bug-${bugId}.cy.ts`

  await Write({
    file_path: uatTestPath,
    content: `/**
 * Bug Fix Test: ${bugInfo.description}
 *
 * This test reproduces and verifies the fix for:
 * ${bugDescription}
 */

describe('Bug Fix: ${bugInfo.description}', () => {
  beforeEach(() => {
    cy.loginByUI('superadmin@cypress.com', 'Test123!@#')
  })

  it('should ${expectedBehavior} (was: ${actualBehavior})', () => {
    // Steps to reproduce
    ${stepsToReproduce.map((step, i) => `
    // Step ${i + 1}: ${step}
    cy.get('[data-cy="${stepSelector}"]').${stepAction}()`).join('\n')}

    // Verify fix
    cy.get('[data-cy="${verifySelector}"]')
      .should('${assertion}', '${expectedValue}')
  })
})
`
  })
}
```

### Step 5: Run Test to Confirm Bug

```typescript
// Run the test - it should FAIL before fix
const testResult = await Bash({
  command: `pnpm cypress run --spec "${testPath}"`,
  description: 'Confirm test fails (reproduces bug)'
})

if (testResult.success) {
  console.log('Warning: Test passed. Bug may not be reproduced correctly.')
  // Review test logic
} else {
  console.log('Test fails as expected. Bug confirmed.')
}
```

### Step 6: Implement Fix

```typescript
// Based on root cause, fix the bug
const fixType = determineFix(rootCause)

switch (fixType) {
  case 'null_check':
    await Edit({
      file_path: bugLocation,
      old_string: 'value.property',
      new_string: 'value?.property'
    })
    break

  case 'validation':
    await Edit({
      file_path: bugLocation,
      old_string: '// Process input',
      new_string: `// Validate input first
    if (!input || typeof input !== 'string') {
      throw new Error('Invalid input')
    }
    // Process input`
    })
    break

  case 'state_update':
    await Edit({
      file_path: bugLocation,
      old_string: 'setState(newValue)',
      new_string: `setState(prev => ({
      ...prev,
      ...newValue
    }))`
    })
    break

  case 'auth_check':
    await Edit({
      file_path: bugLocation,
      old_string: '// Handle request',
      new_string: `// Verify authentication
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Handle request`
    })
    break

  // More fix patterns...
}
```

### Step 7: Verify Fix

```typescript
// Run the test again - it should PASS after fix
const verifyResult = await Bash({
  command: `pnpm cypress run --spec "${testPath}"`,
  description: 'Verify test passes after fix'
})

if (!verifyResult.success) {
  console.log('Fix did not work. Investigating further...')
  // Continue debugging
} else {
  console.log('Test passes. Bug fixed!')
}
```

### Step 8: Run Regression Tests

```typescript
// Run full test suite to ensure no regressions
await Bash({
  command: 'pnpm cypress run',
  description: 'Run regression tests'
})

// Run build to ensure no type errors
await Bash({
  command: 'pnpm build',
  description: 'Verify build succeeds'
})
```

---

## Bug Categories and Fix Approaches

### Null/Undefined Errors
```typescript
// Before (bug)
const name = user.profile.name

// After (fix)
const name = user?.profile?.name ?? 'Unknown'
```

### Type Mismatches
```typescript
// Before (bug)
function process(id) { // any type
  return items[id]
}

// After (fix)
function process(id: string): Item | undefined {
  return items[id]
}
```

### State Management Bugs
```typescript
// Before (bug)
const [items, setItems] = useState([])
const addItem = (item) => {
  items.push(item)  // Mutating state directly!
  setItems(items)
}

// After (fix)
const addItem = (item) => {
  setItems(prev => [...prev, item])
}
```

### API Response Handling
```typescript
// Before (bug)
const data = await response.json()
return data.results  // No error handling

// After (fix)
const data = await response.json()
if (!response.ok) {
  throw new Error(data.message || 'Request failed')
}
return data.results ?? []
```

### Authentication Bypass
```typescript
// Before (bug)
export async function GET(request) {
  const items = await db.getAll()  // No auth check!
  return Response.json(items)
}

// After (fix)
export async function GET(request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const items = await db.getByUser(session.user.id)
  return Response.json(items)
}
```

---

## Output Format

```markdown
## Bug Fix Complete

**Bug:** ${bugDescription}
**Root Cause:** ${rootCause}
**Fix Applied:** ${fixDescription}

### Investigation Summary

**Affected Files:**
${affectedFiles.map(f => `- \`${f}\``).join('\n')}

**Root Cause Analysis:**
${rootCauseAnalysis}

### Changes Made

\`\`\`diff
${diff}
\`\`\`

### Test Coverage

**New Test:** \`${testPath}\`
**Test Status:** ✅ Passing

### Regression Testing

- **Bug Fix Test:** ✅ Passed
- **Related Tests:** ✅ X/X Passed
- **Full Suite:** ✅ Y/Y Passed
- **Build:** ✅ Success

### Verification Steps

To verify the fix manually:
1. ${verificationStep1}
2. ${verificationStep2}
3. ${verificationStep3}

### Prevention Recommendations

To prevent similar bugs:
- ${prevention1}
- ${prevention2}
```

---

## Best Practices

### DO:
- Always create a failing test BEFORE fixing
- Understand root cause, don't just patch symptoms
- Check for similar issues elsewhere in code
- Run full test suite after fix
- Document the fix clearly

### DON'T:
- Fix without understanding the cause
- Skip creating tests
- Only test the specific bug (run regression)
- Introduce new bugs while fixing
- Leave debugging code in production

---

## Integration with Session Workflow

If fixing a bug during active development:

```typescript
// Update session context
await Edit({
  file_path: `${sessionPath}/context.md`,
  new_content: `
---

### [${date}] - bug-fix

**Estado:** ✅ Bug Corregido

**Bug:** ${bugDescription}
**Root Cause:** ${rootCause}
**Fix:** ${fixDescription}

**Test Added:** \`${testPath}\`

**Files Modified:**
${modifiedFiles.map(f => `- \`${f}\``).join('\n')}
`
})
```

---

**Now fix the bug described above.**
