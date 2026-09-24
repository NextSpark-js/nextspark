# /how-to:manage-test-coverage

Interactive guide to create Cypress tests, maintain coverage, and use the testing infrastructure in NextSpark.

**Aliases:** `/how-to:coverage`, `/how-to:testing-strategy`

---

## Required Skills

Before executing, these skills provide deeper context:
- `.claude/skills/cypress-e2e/SKILL.md` - End-to-end testing patterns
- `.claude/skills/cypress-api/SKILL.md` - API testing with Cypress
- `.claude/skills/cypress-selectors/SKILL.md` - 3-level selector system
- `.claude/skills/test-coverage/SKILL.md` - FEATURE_REGISTRY and coverage metrics
- `.claude/skills/pom-patterns/SKILL.md` - Page Object Model structure

---

## Syntax

```
/how-to:manage-test-coverage
/how-to:manage-test-coverage --gaps
/how-to:manage-test-coverage --selectors
```

---

## Behavior

Guides the user through the complete testing infrastructure: selectors, tests, tags, BDD documentation, registries, and coverage validation.

---

## Tutorial Structure

```
STEPS OVERVIEW (6 steps)

Step 1: The Selector System
        └── CORE, BLOCK, THEME selectors (NO HARDCODING!)

Step 2: Creating Cypress Tests
        └── Structure, POMs, and best practices

Step 3: Using Tags Effectively
        └── Tag prefixes and feature/flow connection

Step 4: BDD Documentation
        └── .bdd.md files for Devtools

Step 5: Registry & Coverage Metrics
        └── Auto-generation and coverage tracking

Step 6: Lint & Build Validations
        └── Enforcing quality in CI/CD
```

---

## Step 1: The Selector System

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: MANAGE TEST COVERAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 6: The Selector System

⚠️ CRITICAL RULE: NEVER HARDCODE SELECTORS!

All selectors come from a 3-level system.
This ensures consistency, maintainability,
and prevents brittle tests.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**📋 The 3-Level Selector Architecture:**

```
┌─────────────────────────────────────────────┐
│  Level 1: CORE_SELECTORS                    │
│  ─────────────────────────────────────────  │
│  From: @nextsparkjs/testing                 │
│  Contains: All core UI element selectors    │
│  Examples: login forms, dashboard, nav      │
└─────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│  Level 2: BLOCK_SELECTORS                   │
│  ─────────────────────────────────────────  │
│  From: Theme's block definitions            │
│  Contains: Page builder block selectors     │
│  Examples: hero-banner, features-grid       │
└─────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│  Level 3: THEME_SELECTORS                   │
│  ─────────────────────────────────────────  │
│  From: Theme-specific extensions            │
│  Contains: Custom theme UI selectors        │
│  Examples: custom widgets, layouts          │
└─────────────────────────────────────────────┘
```

**📋 Using Selectors in Tests:**

```typescript
// ✅ CORRECT: Import from selector system
import { CORE_SELECTORS } from '@nextsparkjs/testing'
import { sel } from '@/tests/cypress/support/helpers'

// Use the sel() helper for data-cy attributes
cy.get(sel(CORE_SELECTORS.auth.login.emailInput))
  .type('test@example.com')

// Or use cySelector() from POMs
this.cySelector(CORE_SELECTORS.auth.login.submitButton)
  .click()
```

```typescript
// ❌ WRONG: Hardcoded selectors
cy.get('[data-cy="login-email-input"]')  // NEVER DO THIS!
cy.get('.login-form input')               // NEVER DO THIS!
cy.get('#email')                          // NEVER DO THIS!
```

**📋 Selector Naming Convention:**

```
pattern: "{domain}-{element}-{variant}"

Examples:
• login-email-input
• login-submit-button
• dashboard-sidebar-nav
• entity-{slug}-row-{id}     ← Dynamic with placeholders
• settings-{section}-form   ← Dynamic with placeholders
```

**📋 Dynamic Selectors with Placeholders:**

```typescript
// CORE_SELECTORS has dynamic patterns
CORE_SELECTORS.entities.list.row  // "{slug}-row-{id}"

// Use entitySelectors() helper for dynamic entities
import { entitySelectors } from '@nextsparkjs/testing'

const taskSelectors = entitySelectors('tasks')
cy.get(sel(taskSelectors.row('task-123')))
```

**📋 Adding New Selectors:**

When you need a new selector:

1. **For core UI:** Add to `packages/testing/src/selectors/core-selectors.ts`
2. **For blocks:** Add to block's component with `data-cy` attribute
3. **For theme:** Add to theme's selector extension file

```typescript
// In your component:
<button data-cy="feature-action-button">
  Action
</button>

// In selectors file:
export const FEATURE_SELECTORS = {
  actionButton: 'feature-action-button'
}
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 2 (Creating Cypress Tests)
[2] Show me the full CORE_SELECTORS structure
[3] How do I add a new selector?
```

---

## Step 2: Creating Cypress Tests

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 6: Creating Cypress Tests
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NextSpark has two types of Cypress tests:
• UAT (User Acceptance Tests) - UI interactions
• API Tests - Endpoint validation
```

**📋 Test File Structure:**

```
tests/cypress/
├── e2e/
│   ├── uat/              # User acceptance tests
│   │   ├── auth/
│   │   │   ├── login.cy.ts
│   │   │   └── login.bdd.md
│   │   └── entities/
│   │       ├── tasks.cy.ts
│   │       └── tasks.bdd.md
│   └── api/              # API tests
│       └── entities/
│           ├── tasks.cy.ts
│           └── tasks.bdd.md
├── support/
│   ├── commands.ts       # Custom Cypress commands
│   └── helpers.ts        # Test helpers (sel, etc.)
└── fixtures/
    └── test-data.json    # Test data
```

**📋 UAT Test Example:**

```typescript
// tests/cypress/e2e/uat/auth/login.cy.ts
import { CORE_SELECTORS } from '@nextsparkjs/testing'
import { LoginPOM } from '@/tests/cypress/support/pom/auth/login.pom'

describe('@uat @smoke @feat-auth Login Form', () => {
  let loginPage: LoginPOM

  beforeEach(() => {
    loginPage = new LoginPOM()
    loginPage.visit()
  })

  it('@SEL_AUTH_001 should login with valid credentials', () => {
    loginPage
      .fillEmail('test@example.com')
      .fillPassword('Test1234')
      .submit()

    cy.url().should('include', '/dashboard')
  })

  it('@SEL_AUTH_002 @regression should show error for invalid email', () => {
    loginPage
      .fillEmail('invalid-email')
      .fillPassword('Test1234')
      .submit()

    loginPage.getEmailError()
      .should('be.visible')
      .and('contain', 'Invalid email')
  })
})
```

**📋 Page Object Model (POM):**

```typescript
// cypress/support/pom/auth/login.pom.ts
import { BasePOM } from '../base.pom'
import { CORE_SELECTORS } from '@nextsparkjs/testing'

export class LoginPOM extends BasePOM {
  private selectors = CORE_SELECTORS.auth.login

  visit() {
    cy.visit('/login')
    return this
  }

  fillEmail(email: string) {
    this.cySelector(this.selectors.emailInput)
      .clear()
      .type(email)
    return this
  }

  fillPassword(password: string) {
    this.cySelector(this.selectors.passwordInput)
      .clear()
      .type(password)
    return this
  }

  submit() {
    this.cySelector(this.selectors.submitButton).click()
    return this
  }

  getEmailError() {
    return this.cySelector(this.selectors.emailError)
  }
}
```

**📋 API Test Example:**

```typescript
// tests/cypress/e2e/api/entities/tasks.cy.ts
import { BaseAPIController } from '@/tests/cypress/support/api/base.controller'

describe('@api @feat-tasks Tasks API', () => {
  const api = new BaseAPIController('tasks')

  beforeEach(() => {
    cy.getApiKey().as('apiKey')
  })

  it('@TASKS_API_001 should list all tasks', function() {
    api.list(this.apiKey).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body.success).to.be.true
      expect(response.body.data).to.be.an('array')
    })
  })

  it('@TASKS_API_002 should create a task', function() {
    api.create(this.apiKey, {
      title: 'Test Task',
      status: 'pending'
    }).then((response) => {
      expect(response.status).to.eq(201)
      expect(response.body.data.title).to.eq('Test Task')
    })
  })
})
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 3 (Using Tags Effectively)
[2] Show me more POM examples
[3] How do I set up authentication in tests?
```

---

## Step 3: Using Tags Effectively

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 6: Using Tags Effectively
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tags connect tests to features and flows.
This is where everything comes together!
```

**📋 Tag Categories & Prefixes:**

```
┌─────────────────────────────────────────────┐
│  LAYER TAGS (test type)                     │
│  ─────────────────────────────────────────  │
│  @uat          User acceptance tests        │
│  @api          API/integration tests        │
│  @e2e          Full end-to-end tests        │
│  @unit         Unit tests (Jest)            │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  PRIORITY TAGS (when to run)                │
│  ─────────────────────────────────────────  │
│  @smoke        Run on EVERY deploy          │
│  @regression   Run on release candidates    │
│  @nightly      Run in nightly builds        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  FEATURE TAGS (what feature)                │
│  ─────────────────────────────────────────  │
│  @feat-auth    Authentication feature       │
│  @feat-teams   Teams management feature     │
│  @feat-tasks   Tasks entity feature         │
│  @feat-{name}  Any feature from features.json│
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  FLOW TAGS (what user journey)              │
│  ─────────────────────────────────────────  │
│  @flow-onboarding    User onboarding flow   │
│  @flow-checkout      Purchase flow          │
│  @flow-{name}        Any flow from features.json│
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  OPERATION TAGS (type of test)              │
│  ─────────────────────────────────────────  │
│  @crud         CRUD operations              │
│  @search       Search functionality         │
│  @workflow     Multi-step workflows         │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  AREA TAGS (app section)                    │
│  ─────────────────────────────────────────  │
│  @area-devtools     Devtools section        │
│  @area-superadmin   Admin panel             │
│  @area-settings     Settings section        │
└─────────────────────────────────────────────┘
```

**📋 Tag Placement Rules:**

```typescript
// Tags go in the describe() block name
describe('@uat @smoke @feat-auth Login Form', () => {

  // Individual test IDs in it() blocks
  it('@SEL_AUTH_001 should login successfully', () => {
    // ...
  })

  // Additional tags can be added per test
  it('@SEL_AUTH_002 @regression should handle errors', () => {
    // ...
  })
})
```

**📋 Connecting to features.json:**

```json
// In features.json:
{
  "features": {
    "authentication": {
      "testTags": ["@feat-auth"]  // ← This tag
    }
  }
}

// In your test:
describe('@feat-auth ...', () => {  // ← Must match!
  // Tests...
})

// The registry build will:
// 1. Find tests with @feat-auth
// 2. Link them to "authentication" feature
// 3. Update coverage metrics
```

**📋 Running Tests by Tag:**

```bash
# Run only smoke tests
pnpm cypress:run --env grepTags="@smoke"

# Run authentication feature tests
pnpm cypress:run --env grepTags="@feat-auth"

# Run all UAT tests except smoke
pnpm cypress:run --env grepTags="@uat -@smoke"

# Run onboarding flow tests
pnpm cypress:run --env grepTags="@flow-onboarding"
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 4 (BDD Documentation)
[2] Show me tag combination examples
[3] How do I choose which tags to use?
```

---

## Step 4: BDD Documentation

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 6: BDD Documentation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every .cy.ts file should have a companion .bdd.md
file for human-readable documentation.
```

**📋 BDD File Structure:**

```
cypress/e2e/uat/auth/
├── login.cy.ts       # Cypress test file
└── login.bdd.md      # BDD documentation
```

**📋 BDD Template:**

```markdown
# Login Form Validation

## Feature
User authentication through email/password login.

## Tags
- @uat
- @smoke
- @feat-auth

## Preconditions
- User account exists in the system
- User is not logged in
- Login page is accessible

## Scenarios

### 1. Successful login with email
**ID:** @SEL_AUTH_001
**Priority:** @smoke

- **Given:** Login page is displayed
- **When:** User enters valid email "test@example.com"
- **And:** User enters valid password "Test1234"
- **And:** User clicks submit button
- **Then:** User is redirected to dashboard
- **And:** Session is created

### 2. Error on invalid email format
**ID:** @SEL_AUTH_002
**Priority:** @regression

- **Given:** Login page is displayed
- **When:** User enters invalid email "not-an-email"
- **And:** User clicks submit button
- **Then:** Error message "Invalid email format" is displayed
- **And:** Email input is highlighted with error state

## Test Data
| Email | Password | Expected Result |
|-------|----------|-----------------|
| test@example.com | Test1234 | Success |
| invalid-email | Test1234 | Validation error |
| test@example.com | wrong | Auth error |

## Related Features
- Password Reset: /how-to:password-reset
- OAuth Login: /how-to:oauth-login
```

**📋 Why BDD Documentation Matters:**

```
┌─────────────────────────────────────────────┐
│  BDD docs are used in DEVTOOLS              │
│  ─────────────────────────────────────────  │
│                                             │
│  The Devtools test viewer reads .bdd.md     │
│  files to show human-readable test docs.    │
│                                             │
│  Benefits:                                  │
│  • Non-technical stakeholders can read      │
│  • QA team can verify coverage              │
│  • New developers understand intent         │
│  • Auto-generates test reports              │
└─────────────────────────────────────────────┘
```

**📋 Keeping BDD in Sync:**

After modifying tests, update the BDD:

```bash
# Use the BDD writer command
/bdd:write path/to/test.cy.ts

# Or manually update the .bdd.md file
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 5 (Registry & Coverage)
[2] Generate BDD for my test file
[3] Show me more BDD examples
```

---

## Step 5: Registry & Coverage Metrics

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 OF 6: Registry & Coverage Metrics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The registry system auto-generates coverage
metrics from your tests and features.json.
```

**📋 How It Works:**

```
┌──────────────┐
│ features.json│ ─── Defines expected features/flows
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Cypress Tests│ ─── Contains @feat-* and @flow-* tags
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Build Script │ ─── pnpm build:registries
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ testing-registry.ts                          │
│  ├── FEATURE_REGISTRY (features + test data) │
│  ├── FLOW_REGISTRY (flows + test data)       │
│  ├── TAGS_REGISTRY (all discovered tags)     │
│  └── COVERAGE_SUMMARY (metrics)              │
└──────────────────────────────────────────────┘
```

**📋 Generated Registry Example:**

```typescript
// .nextspark/registries/testing-registry.ts (auto-generated)

export const FEATURE_REGISTRY = {
  'authentication': {
    name: 'Authentication',
    category: 'core',
    testing: {
      hasTests: true,
      testCount: 15,
      files: ['login.cy.ts', 'signup.cy.ts', 'password-reset.cy.ts']
    }
  },
  'tasks': {
    name: 'Task Management',
    category: 'entities',
    testing: {
      hasTests: true,
      testCount: 8,
      files: ['tasks.cy.ts']
    }
  }
}

export const COVERAGE_SUMMARY = {
  theme: 'default',
  generatedAt: '2024-12-18T10:30:00Z',
  features: {
    total: 15,
    withTests: 12,
    withoutTests: 3
  },
  flows: {
    total: 5,
    withTests: 3,
    withoutTests: 2
  },
  tags: {
    total: 97,
    testFiles: 25
  }
}
```

**📋 Using the FeatureService:**

```typescript
import { FeatureService } from '@/core/lib/services/feature.service'

// Get coverage metrics
const coverage = FeatureService.getCoverageSummary()
console.log(`Feature coverage: ${FeatureService.getFeatureCoveragePercent()}%`)

// Find features without tests
const gaps = FeatureService.getFeaturesWithoutTests()
gaps.forEach(f => console.log(`Missing tests: ${f.name}`))

// Get all tests for a feature
const auth = FeatureService.getFeature('authentication')
console.log(`Auth has ${auth.testing.testCount} tests`)
```

**📋 Coverage Targets:**

```
┌─────────────────────────────────────────────┐
│  COVERAGE TARGETS                           │
│  ─────────────────────────────────────────  │
│                                             │
│  Critical (90%+):                           │
│  • Authentication                           │
│  • Payments/Billing                         │
│  • Permissions                              │
│                                             │
│  Important (80%+):                          │
│  • API endpoints                            │
│  • Form validations                         │
│  • Business logic                           │
│                                             │
│  General (70%+):                            │
│  • UI components                            │
│  • Utilities                                │
│  • Settings                                 │
└─────────────────────────────────────────────┘
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 6 (Lint & Build Validations)
[2] Show me my current coverage gaps
[3] How do I rebuild the registry?
```

---

## Step 6: Lint & Build Validations

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 OF 6: Lint & Build Validations
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The testing system has built-in validations
that run during lint and build.
```

**📋 Lint Rules:**

```typescript
// ESLint rules enforce testing standards

// Rule: no-hardcoded-selectors
// ❌ cy.get('[data-cy="login-button"]')
// ✅ cy.get(sel(CORE_SELECTORS.auth.login.button))

// Rule: require-test-tags
// ❌ describe('Login', () => {})
// ✅ describe('@uat @feat-auth Login', () => {})

// Rule: require-bdd-file
// ❌ login.cy.ts without login.bdd.md
// ✅ login.cy.ts with login.bdd.md
```

**📋 Build Validations:**

```bash
# During pnpm build, the system checks:

✓ All test files have required tags
✓ All @feat-* tags match features.json
✓ All @flow-* tags match features.json
✓ All .cy.ts files have .bdd.md companions
✓ No hardcoded selectors detected
✓ COVERAGE_SUMMARY generated successfully
```

**📋 CI/CD Integration:**

```yaml
# In your CI pipeline:
jobs:
  test:
    steps:
      - name: Lint tests
        run: pnpm lint:tests

      - name: Build registries
        run: pnpm build:registries

      - name: Run smoke tests
        run: pnpm cypress:run --env grepTags="@smoke"

      - name: Check coverage thresholds
        run: pnpm test:coverage-check
```

**📋 Coverage Check Script:**

```typescript
// scripts/check-coverage.ts
import { FeatureService } from '@/core/lib/services/feature.service'

const featureCoverage = FeatureService.getFeatureCoveragePercent()
const flowCoverage = FeatureService.getFlowCoveragePercent()

if (featureCoverage < 70) {
  console.error(`Feature coverage ${featureCoverage}% is below 70% threshold`)
  process.exit(1)
}

if (flowCoverage < 60) {
  console.error(`Flow coverage ${flowCoverage}% is below 60% threshold`)
  process.exit(1)
}

console.log(`✓ Coverage OK: Features ${featureCoverage}%, Flows ${flowCoverage}%`)
```

**📋 Common Validation Errors:**

```
ERROR: Unknown tag @feat-unknown in login.cy.ts
FIX: Add "unknown" feature to features.json or fix tag name

ERROR: Hardcoded selector in tasks.cy.ts:45
FIX: Import from CORE_SELECTORS instead of hardcoding

ERROR: Missing BDD file for auth/signup.cy.ts
FIX: Create auth/signup.bdd.md with test documentation

ERROR: Test without required tags in settings.cy.ts
FIX: Add @uat and @feat-* tags to describe block
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

You've learned:
• 3-level selector system (NO HARDCODING!)
• Creating UAT and API tests with POMs
• Tag system and feature/flow connection
• BDD documentation for Devtools
• Registry generation and coverage metrics
• Lint and build validations

📚 PREVIOUS STEP:
   /how-to:define-features-flows
   └── Understand features & flows concept

📚 Related tutorials:
   • /how-to:run-tests - Execute test suites
   • /how-to:create-entity - Entity tests included

🔙 Back to menu: /how-to:start
```

---

## Interactive Options

### "Show me my current coverage gaps"

Claude should run:

```bash
pnpm build:registries
```

Then analyze the generated registry to report:

```
📊 COVERAGE ANALYSIS

FEATURES WITHOUT TESTS:
  ❌ billing - No @feat-billing tests found
  ❌ notifications - No @feat-notifications tests found
  ❌ superadmin - No @feat-superadmin tests found

FLOWS WITHOUT TESTS:
  ❌ team-collaboration - No @flow-team-collaboration tests
  ❌ checkout - No @flow-checkout tests

COVERAGE SUMMARY:
  Features: 12/15 (80%)
  Flows: 3/5 (60%)

RECOMMENDATIONS:
1. Add billing tests (critical feature)
2. Add team-collaboration flow tests
3. Increase superadmin coverage
```

### "How do I choose which tags to use?"

```
📋 Tag Selection Guide:

ALWAYS include:
  • @uat or @api (test type)
  • @feat-{name} (which feature)

ADD @smoke if:
  • Critical user path
  • Must work on every deploy
  • Happy path scenarios

ADD @regression if:
  • Edge cases
  • Error scenarios
  • Less critical paths

ADD @flow-{name} if:
  • Tests multiple features
  • Represents user journey
  • Integration scenario

ADD operation tags (@crud, @search) if:
  • Want to run all CRUD tests together
  • Useful for debugging specific operations

EXAMPLE COMBINATIONS:
  • @uat @smoke @feat-auth → Critical auth test
  • @api @regression @feat-tasks @crud → Task API edge cases
  • @uat @smoke @flow-onboarding → Critical onboarding flow
```

---

## Common Questions

### "How do I add a new selector?"

```
📋 Adding a New Selector:

1. Add data-cy to your component:
   <button data-cy="my-feature-action">

2. Add to appropriate selector file:

   For CORE (all themes):
   packages/testing/src/selectors/core-selectors.ts

   For BLOCKS:
   Add to block component, follows block-{name}-{element}

   For THEME-SPECIFIC:
   tests/selectors.ts

3. Rebuild:
   pnpm build:registries

4. Use in tests:
   import { CORE_SELECTORS } from '@nextsparkjs/testing'
   cy.get(sel(CORE_SELECTORS.myFeature.action))
```

### "How do I rebuild the registry?"

```bash
# Rebuild all registries (including testing)
pnpm build:registries

# Or specifically the testing registry
node packages/core/scripts/build/registry.mjs --testing

# The script will:
# 1. Scan all .cy.ts files
# 2. Extract tags
# 3. Match with features.json
# 4. Generate testing-registry.ts
# 5. Calculate COVERAGE_SUMMARY
```

---

## Related Commands

| Command | Description |
|---------|-------------|
| `/how-to:define-features-flows` | **PREVIOUS STEP** - Understand features & flows |
| `/how-to:run-tests` | Execute Cypress test suites |
| `/test:write` | Write tests for a feature |
| `/bdd:write` | Generate BDD documentation |
