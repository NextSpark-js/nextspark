---
description: "[BDD] Generate BDD documentation (.bdd.md) from Cypress tests"
---

# BDD Write - Generate BDD Documentation

You are generating BDD test documentation from Cypress test files.

**Target (session path or test file path):**
{{{ input }}}

---

## Your Mission

Generate `.bdd.md` documentation files from Cypress tests following the BDD Viewer format:

1. **Parse Cypress tests** to extract test cases and steps
2. **Generate bilingual Gherkin** scenarios (EN + ES)
3. **Create metadata** (frontmatter with tags, priority, coverage)
4. **Document expected results** for each test case
5. **Place .bdd.md files** alongside the source .cy.ts files

---

## Protocol

### Step 1: Determine Input Type

```typescript
// If input is a session path
if (input.includes('.claude/sessions/')) {
  // Read session context
  await Read(`${input}/requirements.md`)
  await Read(`${input}/tests.md`)

  // Find all Cypress tests in session scope
  const scope = JSON.parse(await Read(`${input}/scope.json`))
  const themePath = `contents/themes/${scope.theme}/tests/cypress/e2e`

  await Glob(`${themePath}/**/*.cy.ts`)
}

// If input is a specific file path
else if (input.endsWith('.cy.ts')) {
  await Read(input)
}

// If no input, scan default theme
else {
  await Glob('contents/themes/default/tests/cypress/e2e/**/*.cy.ts')
}
```

### Step 2: Read BDD Format Reference

```typescript
// Read existing BDD examples to understand format
await Glob('contents/themes/**/tests/cypress/e2e/**/*.bdd.md')

// Read BDD parser to understand expected structure
await Read('contents/themes/default/components/dev/bdd/parser.ts')
await Read('contents/themes/default/components/dev/bdd/types.ts')
```

### Step 3: Parse Each Cypress Test File

For each `.cy.ts` file found:

```typescript
// Read the test file
const testContent = await Read(cypressFilePath)

// Extract describe blocks -> features
// Extract it() blocks -> test cases
// Extract cy.* commands -> Gherkin steps
// Extract assertions -> expected results
```

### Step 4: Generate BDD Document

```typescript
const bddPath = cypressFilePath.replace('.cy.ts', '.bdd.md')

await Write({
  file_path: bddPath,
  content: generateBDDDocument(parsedTests)
})
```

---

## BDD Document Format

The generated `.bdd.md` file must follow this structure:

```markdown
---
feature: Feature Name
priority: high | medium | low
tags: [tag1, tag2, tag3]
grepTags: [uat, feat-xxx, smoke, regression]
coverage: N
---

# Feature Name

> Brief description of what this feature tests.

## @test FEATURE-AREA-001: Test Title

### Metadata
- **Priority:** High | Medium | Low
- **Type:** Smoke | Regression | Integration | E2E
- **Tags:** tag1, tag2

```gherkin:en
Scenario: English scenario description

Given some precondition
And another precondition
When user performs action
And another action
Then expected outcome
And another expectation
```

```gherkin:es
Scenario: Descripción del escenario en español

Given alguna precondición
And otra precondición
When el usuario realiza una acción
And otra acción
Then resultado esperado
And otra expectativa
```

### Expected Results
- Expected result 1
- Expected result 2
- Expected result 3

---

## @test FEATURE-AREA-002: Next Test Title
... (repeat pattern)
```

---

## Cypress to Gherkin Mapping

### Command Mappings

| Cypress Command | Gherkin Step (EN) | Gherkin Step (ES) |
|-----------------|-------------------|-------------------|
| `cy.visit('/path')` | Given I am on the page | Given estoy en la página |
| `cy.loginByUI()` | Given I am logged in as {role} | Given estoy logueado como {role} |
| `cy.get('[data-cy="x"]').click()` | When I click the {element} | When hago clic en {element} |
| `cy.get('[data-cy="x"]').type('text')` | When I enter "text" | When ingreso "text" |
| `cy.get('[data-cy="x"]').should('be.visible')` | Then {element} should be visible | Then {element} debería ser visible |
| `cy.get('[data-cy="x"]').should('contain', 'text')` | Then {element} should contain "text" | Then {element} debería contener "text" |
| `cy.request('POST', ...)` | Given I have created {entity} via API | Given he creado {entity} via API |
| `cy.intercept()` | Given the API response is intercepted | Given la respuesta API es interceptada |

### Priority Mapping

| Cypress Pattern | Priority |
|-----------------|----------|
| `describe('Happy Path', ...)` | high |
| `describe('Smoke', ...)` | high |
| `describe('Critical', ...)` | high |
| `describe('Validation', ...)` | medium |
| `describe('Edge Cases', ...)` | low |
| `describe('Accessibility', ...)` | low |
| Default | medium |

### Type Mapping

| Cypress Pattern | Type |
|-----------------|------|
| File path contains `api/` | integration |
| File path contains `uat/` | e2e |
| Test tags contain `@smoke` | smoke |
| Test tags contain `@regression` | regression |
| Default | e2e |

---

## Test ID Generation

Test IDs follow the pattern: `FEATURE-AREA-NNN`

```typescript
// Examples:
// File: auth/login.cy.ts
// -> AUTH-LOGIN-001, AUTH-LOGIN-002, ...

// File: page-builder/admin/block-crud.cy.ts
// -> PB-BLOCK-001, PB-BLOCK-002, ...

// File: posts/public/posts-public.cy.ts
// -> POSTS-PUBLIC-001, POSTS-PUBLIC-002, ...

function generateTestId(filePath: string, index: number): string {
  const parts = filePath
    .replace(/.*\/e2e\//, '')
    .replace('.cy.ts', '')
    .split('/')

  const feature = parts[0].toUpperCase().replace(/-/g, '')
  const area = parts.length > 1
    ? parts[parts.length - 1].toUpperCase().replace(/-/g, '').slice(0, 6)
    : 'MAIN'

  const num = String(index + 1).padStart(3, '0')

  return `${feature}-${area}-${num}`
}
```

---

## grepTags Extraction

Extract grep tags from:

1. **Test file comments:**
   ```typescript
   // @tags: uat, feat-auth, smoke
   ```

2. **Describe block strings:**
   ```typescript
   describe('@smoke @feat-auth Authentication', () => ...)
   ```

3. **it() block strings:**
   ```typescript
   it('@regression should handle edge case', () => ...)
   ```

4. **File path inference:**
   - `e2e/api/` → `@api`
   - `e2e/uat/` → `@uat`
   - Feature name → `@feat-{feature}`

---

## Output Format

After generating BDD documents, report:

```markdown
## BDD Documentation Generated

### Files Created
| Source (.cy.ts) | Generated (.bdd.md) | Tests |
|-----------------|---------------------|-------|
| `path/to/file.cy.ts` | `path/to/file.bdd.md` | 5 |
| ... | ... | ... |

### Summary
- **Total test files processed:** N
- **Total BDD documents created:** N
- **Total test cases documented:** N

### Validation
- [ ] All files have matching .bdd.md
- [ ] All scenarios have EN + ES versions
- [ ] All test IDs follow naming convention
- [ ] All frontmatter is valid YAML

### Next Steps
1. View generated docs in Dev Area `/dev/tests`
2. Review bilingual scenarios for accuracy
3. Add any missing expected results
```

---

## Error Handling

If parsing fails for a file:

```markdown
### Warnings

| File | Issue | Action |
|------|-------|--------|
| `path/file.cy.ts` | Could not parse test structure | Manual review required |
| `path/file.cy.ts` | Missing describe block | Skipped |
```

Continue processing other files even if some fail.

---

**Now generate BDD documentation for the target specified above.**
