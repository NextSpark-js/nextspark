# Workflow Phases (v4.0)

> **Version 4.0** - 19 phases with 9 quality gates organized in 7 blocks.

## Overview

The Claude Workflow v4.0 provides a comprehensive **19-phase development approach** organized into **7 logical blocks**. Each block represents a distinct stage of development with specific agents and quality gates.

> **Note:** This is ONE approach to workflow organization. You can simplify to 6 phases for solo work, or extend with custom phases for enterprise teams. See [Customization](./10-customization.md) for adapting this workflow to your needs.

**Key Concepts:**
- **19 Phases** - Complete development lifecycle
- **9 Quality Gates** - Validation checkpoints (2 conditional for plugin/theme)
- **7 Blocks** - Logical groupings of related phases
- **Conditional Phases** - Some phases only execute based on PM Decisions
- **Retry Logic** - Automatic fix-and-retry for certain gates

---

## Complete Workflow Diagram

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    WORKFLOW v4.0 - 19 PHASES WITH GATES                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ╔═══════════════════════════════════════════════════════════════════╗  │
│  ║  BLOCK 1: PLANNING (Phases 1-2)                                   ║  │
│  ╠═══════════════════════════════════════════════════════════════════╣  │
│  ║  1. product-manager: Requirements + PM Decisions                  ║  │
│  ║     • Dev Type: Feature / New Theme / New Plugin / Core Change    ║  │
│  ║     • DB Policy: Reset vs Incremental                             ║  │
│  ║     • Blocks: Requires page builder blocks?                       ║  │
│  ║     • Plugin Config: Complexity, Has Entities                     ║  │
│  ║  2. architecture-supervisor: Technical plan with 19 phases        ║  │
│  ╚═══════════════════════════════════════════════════════════════════╝  │
│                                    │                                     │
│  ╔═══════════════════════════════════════════════════════════════════╗  │
│  ║  BLOCK 2: FOUNDATION (Phases 3-6, conditional)                    ║  │
│  ╠═══════════════════════════════════════════════════════════════════╣  │
│  ║  3. plugin-creator (if Dev Type = New Plugin)                     ║  │
│  ║  4. plugin-validator ─────────────────────────────── [GATE 1]     ║  │
│  ║  3b. theme-creator (if Dev Type = New Theme)                      ║  │
│  ║  4b. theme-validator ─────────────────────────────── [GATE 2]     ║  │
│  ║  5. db-developer (migrations + sample data + test users)          ║  │
│  ║  6. db-validator ─────────────────────────────────── [GATE 3]     ║  │
│  ╚═══════════════════════════════════════════════════════════════════╝  │
│                                    │                                     │
│  ╔═══════════════════════════════════════════════════════════════════╗  │
│  ║  BLOCK 3: BACKEND TDD (Phases 7-9)                                ║  │
│  ╠═══════════════════════════════════════════════════════════════════╣  │
│  ║  7. backend-developer (tests FIRST, then implementation)          ║  │
│  ║  8. backend-validator ────────────────────────────── [GATE 4]     ║  │
│  ║  9. api-tester ───────────────────────────── [GATE 5 + RETRY]     ║  │
│  ╚═══════════════════════════════════════════════════════════════════╝  │
│                                    │                                     │
│  ╔═══════════════════════════════════════════════════════════════════╗  │
│  ║  BLOCK 4: BLOCKS (Phase 10, conditional)                          ║  │
│  ╠═══════════════════════════════════════════════════════════════════╣  │
│  ║  10. block-developer (if PM Decision "Requires Blocks" = Yes)     ║  │
│  ╚═══════════════════════════════════════════════════════════════════╝  │
│                                    │                                     │
│  ╔═══════════════════════════════════════════════════════════════════╗  │
│  ║  BLOCK 5: FRONTEND (Phases 11-13)                                 ║  │
│  ╠═══════════════════════════════════════════════════════════════════╣  │
│  ║  11. frontend-developer                                           ║  │
│  ║  12. frontend-validator ──────────────────────────── [GATE 6]     ║  │
│  ║  13. functional-validator ────────────────────────── [GATE 7]     ║  │
│  ╚═══════════════════════════════════════════════════════════════════╝  │
│                                    │                                     │
│  ╔═══════════════════════════════════════════════════════════════════╗  │
│  ║  BLOCK 6: QA (Phases 14-15)                                       ║  │
│  ╠═══════════════════════════════════════════════════════════════════╣  │
│  ║  14. qa-manual ───────────────────────────── [GATE 8 + RETRY]     ║  │
│  ║  15. qa-automation ───────────────────────────────── [GATE 9]     ║  │
│  ╚═══════════════════════════════════════════════════════════════════╝  │
│                                    │                                     │
│  ╔═══════════════════════════════════════════════════════════════════╗  │
│  ║  BLOCK 7: FINALIZATION (Phases 16-19)                             ║  │
│  ╠═══════════════════════════════════════════════════════════════════╣  │
│  ║  16. code-reviewer                                                ║  │
│  ║  17. unit-test-writer                                             ║  │
│  ║  18. documentation-writer (OPTIONAL)                              ║  │
│  ║  19. demo-video-generator (OPTIONAL)                              ║  │
│  ╚═══════════════════════════════════════════════════════════════════╝  │
│                                    │                                     │
│                                    ▼                                     │
│                         HUMAN APPROVAL & MERGE                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Block 1: Planning (Phases 1-2)

Planning phases establish requirements and technical approach before any code is written.

### Phase 1: Product Manager

**Agent:** `product-manager`
**Model:** Sonnet
**Color:** Green

**Purpose:** Gather requirements and make critical PM Decisions that affect the entire workflow.

**Responsibilities:**
1. Interact with user to understand feature requirements
2. Ask 4 mandatory PM Decision questions
3. Create session folder with 8 files
4. Write `requirements.md` with classified ACs
5. Create `clickup_task.md` (optional)
6. Initialize `context.md` with PM entry
7. Define `scope.json` for session boundaries

**PM Decisions (Mandatory):**

| Decision | Options | Impact |
|----------|---------|--------|
| **Dev Type** | Feature / New Theme / New Plugin / Core Change | Determines which phases execute |
| **DB Policy** | Reset permitted / Incremental migrations | How db-validator handles schema |
| **Requires Blocks** | Yes / No | Whether Phase 10 executes |
| **Plugin Config** | Complexity, Has Entities | Plugin scaffolding options |

**Outputs:**
- `requirements.md` - Detailed requirements with AC classification
- `clickup_task.md` - Business context (optional)
- `scope.json` - Session scope definition
- `context.md` - Initialized coordination log

---

### Phase 2: Architecture Supervisor

**Agent:** `architecture-supervisor`
**Model:** Opus
**Color:** Cyan

**Purpose:** Create comprehensive technical plan covering all 19 phases.

**Responsibilities:**
1. Read `requirements.md` and understand PM Decisions
2. Check `pendings.md` from previous versions (if v2+)
3. Create `plan.md` with technical approach
4. Create `progress.md` with tracking checkboxes
5. Initialize `tests.md` and `pendings.md`
6. Update `context.md` with architect entry

**Inputs:**
- `requirements.md` - What to build
- `clickup_task.md` - Business context
- `scope.json` - Boundaries
- Previous session's `pendings.md` (if v2+)

**Outputs:**
- `plan.md` - Technical plan for all phases
- `progress.md` - Progress tracking template
- `tests.md` - Empty, for validators
- `pendings.md` - Empty, for future items

---

## Block 2: Foundation (Phases 3-6)

Foundation phases set up the infrastructure: themes, plugins, and database.

### Phase 3: Plugin Creator (Conditional)

**Agent:** `plugin-creator`
**Condition:** Only if PM Decision Dev Type = "New Plugin" or "Plugin + Theme"
**Status:** SKIP if not creating a plugin

**Responsibilities:**
1. Run `pnpm create:plugin {name}` scaffolding
2. Configure `plugin.config.ts` with lifecycle hooks
3. Set up `lib/core.ts` with main logic
4. Create API routes structure
5. Configure plugin in `plugin-sandbox` theme
6. Run `node core/scripts/build/registry.mjs`

**Outputs:**
- Complete plugin structure in `contents/plugins/{name}/`
- Plugin registered in `plugin-sandbox`

---

### Phase 3b: Theme Creator (Conditional)

**Agent:** `theme-creator`
**Condition:** Only if PM Decision Dev Type = "New Theme" or "Plugin + Theme"
**Status:** SKIP if not creating a theme

**Responsibilities:**
1. Run `pnpm create:theme {name}` scaffolding
2. Configure `theme.config.ts`
3. Configure `app.config.ts` (Team Mode, features)
4. Configure `dashboard.config.ts`
5. Configure `permissions.config.ts`
6. Run `node core/scripts/build/registry.mjs`

**Outputs:**
- Complete theme structure in `contents/themes/{name}/`
- Theme registered in `THEME_REGISTRY`

---

### Phase 4: Plugin Validator [GATE]

**Agent:** `plugin-validator`
**Type:** Quality Gate - BLOCKS if failed
**Condition:** Only if Phase 3 executed

**Gate Conditions:**
- [ ] TypeScript compiles without errors
- [ ] `plugin.config.ts` exists and is valid
- [ ] Plugin appears in `PLUGIN_REGISTRY`
- [ ] Plugin enabled in `plugin-sandbox` theme
- [ ] `pnpm build` passes

**On Failure:** Calls `plugin-creator` to fix issues

---

### Phase 4b: Theme Validator [GATE]

**Agent:** `theme-validator`
**Type:** Quality Gate - BLOCKS if failed
**Condition:** Only if Phase 3b executed

**Gate Conditions:**
- [ ] `pnpm build` passes without errors
- [ ] `theme.config.ts` exists and is valid
- [ ] `app.config.ts` exists and is valid
- [ ] `dashboard.config.ts` exists and is valid
- [ ] `permissions.config.ts` exists and is valid
- [ ] Team Mode configured (if enabled)
- [ ] Theme appears in `THEME_REGISTRY`

**On Failure:** Calls `theme-creator` to fix issues

---

### Phase 5: DB Developer

**Agent:** `db-developer`
**Model:** Sonnet
**Color:** Blue

**Responsibilities:**
1. Create migrations with **camelCase** field names
2. Create abundant sample data (20+ records per entity)
3. Create test users with standard password hash
4. Configure `devKeyring` in `app.config.ts`
5. Set up team memberships (if Team Mode)

**Standard Test Users:**

| Email | Role | Password |
|-------|------|----------|
| owner@test.com | owner | Test1234 |
| admin@test.com | admin | Test1234 |
| member@test.com | member | Test1234 |
| guest@test.com | guest | Test1234 |
| superadmin@cypress.com | superadmin | Test1234 |

**Password Hash (for all test users):**
```text
3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866
```

---

### Phase 6: DB Validator [GATE]

**Agent:** `db-validator`
**Type:** Quality Gate - BLOCKS if failed

**Gate Conditions:**
- [ ] Migrations execute successfully
- [ ] All tables exist (`pnpm db:verify`)
- [ ] Sample data exists (20+ per entity)
- [ ] Test users exist with correct hash
- [ ] Team memberships configured (if Team Mode)
- [ ] Foreign keys valid (JOINs work)
- [ ] `devKeyring` configured

**On Failure:** Calls `db-developer` to fix issues

---

## Block 3: Backend TDD (Phases 7-9)

Backend phases follow Test-Driven Development: write tests first, then implement.

### Phase 7: Backend Developer

**Agent:** `backend-developer`
**Model:** Sonnet
**Color:** Blue
**Approach:** TDD (Test-Driven Development)

**Process:**
1. **Write Tests FIRST:**
   - Create `__tests__/api/{entity}.test.ts`
   - POST tests (201, 400, 401)
   - GET tests (200, 401, 404)
   - PATCH tests (200, 400, 401, 404)
   - DELETE tests (200, 401, 404)

2. **Then Implement:**
   - Create route handler with dual auth
   - Create Zod validation schemas
   - Implement CRUD handlers
   - Verify all tests pass

**Outputs:**
- API route handlers
- Zod schemas
- Jest unit tests
- Dual auth (session + API key)

---

### Phase 8: Backend Validator [GATE]

**Agent:** `backend-validator`
**Type:** Quality Gate - BLOCKS if failed

**Gate Conditions:**
- [ ] `pnpm test -- --testPathPattern=api` passes
- [ ] `pnpm build` successful
- [ ] `tsc --noEmit` no errors
- [ ] `pnpm lint` passes
- [ ] Dual auth verified on all routes

**On Failure:** Calls `backend-developer` to fix issues

---

### Phase 9: API Tester [GATE + RETRY]

**Agent:** `api-tester`
**Type:** Quality Gate with Retry Logic (max 3 attempts)

**Gate Conditions:**
- [ ] Cypress API tests pass (100%)
- [ ] All status codes tested (200, 201, 400, 401, 404)
- [ ] Dual auth tested (session + API key)
- [ ] Pagination tested
- [ ] Results documented in `tests.md`

**Retry Logic:**
```typescript
const MAX_RETRIES = 3

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  const result = await runAPITests()

  if (result.allPassed) break

  // Call backend-developer to fix each failing test
  for (const bug of result.apiBugs) {
    await launchAgent('backend-developer', {
      task: `[API-TESTER FIX] Fix: ${bug.endpoint} ${bug.method}`,
      context: bug
    })
  }
}
```

**On 3 Failures:** GATE_FAILED - requires manual intervention

---

## Block 4: Blocks (Phase 10)

Page builder block development phase.

### Phase 10: Block Developer (Conditional)

**Agent:** `block-developer`
**Condition:** Only if PM Decision "Requires Blocks" = Yes
**Status:** SKIP if no blocks needed

**Responsibilities:**
1. Determine active theme
2. Analyze existing blocks for patterns
3. Create block files:
   - `config.ts` - Block configuration
   - `schema.ts` - Extends `baseBlockSchema`
   - `fields.ts` - Form field definitions
   - `component.tsx` - React component with `data-cy`
   - `index.ts` - Exports
4. Run `node core/scripts/build/registry.mjs`
5. Verify block in `BLOCK_REGISTRY`
6. Test block in page builder

**Outputs:**
- Complete block in `contents/themes/{theme}/blocks/{name}/`
- Block registered in registry

---

## Block 5: Frontend (Phases 11-13)

Frontend development and validation phases.

### Phase 11: Frontend Developer

**Agent:** `frontend-developer`
**Model:** Sonnet
**Color:** Purple

**Responsibilities:**
1. Create components with shadcn/ui
2. Implement state with TanStack Query
3. Add translations (EN + ES)
4. Add `data-cy` attributes on all interactive elements
5. Implement loading/error states
6. Use CSS variables (no hardcoded colors)
7. Verify `pnpm build` passes

**Requirements:**
- NO hardcoded strings
- ALL interactive elements have `data-cy`
- Translations in correct namespace
- Responsive design

---

### Phase 12: Frontend Validator [GATE]

**Agent:** `frontend-validator`
**Type:** Quality Gate - BLOCKS if failed

**Gate Conditions:**
- [ ] ALL components have `data-cy` attributes
- [ ] Nomenclature: `{entity}-{component}-{detail}`
- [ ] NO hardcoded strings
- [ ] Translations exist in EN and ES
- [ ] Translations in correct namespace
- [ ] NO next-intl errors
- [ ] Selectors documented in `tests.md`

**On Failure:** Calls `frontend-developer` to fix issues

---

### Phase 13: Functional Validator [GATE]

**Agent:** `functional-validator`
**Type:** Quality Gate - BLOCKS if failed

**Gate Conditions:**
- [ ] `progress.md` updated by developers
- [ ] Each AC from `requirements.md` verified in code
- [ ] Playwright spot-checks pass
- [ ] No major gaps between plan and implementation

**On Failure:** Reports in `context.md`, calls appropriate developer

---

## Block 6: QA (Phases 14-15)

Quality assurance phases with manual and automated testing.

### Phase 14: QA Manual [GATE + RETRY]

**Agent:** `qa-manual`
**Type:** Quality Gate with Retry Logic (max 3 attempts)

**Gate Conditions:**
- [ ] Dev server starts without errors
- [ ] All dashboard screens load
- [ ] All frontend pages load
- [ ] NO console errors
- [ ] NO server errors
- [ ] UI renders correctly

**Retry Logic:**
```typescript
const MAX_RETRIES = 3

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  const result = await performQACheck()

  if (result.allPassed) break

  for (const error of result.errors) {
    if (error.type === 'api_error' || error.type === 'server_error') {
      await launchAgent('backend-developer', { task: `Fix: ${error.message}` })
    } else {
      await launchAgent('frontend-developer', { task: `Fix: ${error.message}` })
    }
  }
}
```

**On 3 Failures:** Documents in `pendings.md`, BLOCKS `qa-automation`

---

### Phase 15: QA Automation [GATE]

**Agent:** `qa-automation`
**Type:** Quality Gate - BLOCKS if failed

**Gate Conditions:**
- [ ] Read selectors from `tests.md`
- [ ] Inherit context from qa-manual
- [ ] Validate `data-cy` selectors BEFORE running tests
- [ ] POMs created/updated (reuse existing)
- [ ] UAT tests created for `[AUTO]` ACs
- [ ] Tests executed with Smart Retry Strategy
- [ ] 100% pass rate achieved
- [ ] AC Coverage Report generated in `tests.md`
- [ ] Temporary tags removed

**Smart Retry Strategy:**

Uses Cypress grep tags for targeted retries:

```typescript
const sessionName = '2025-12-15-products-v1'
const scopeTag = `@scope-${sessionName}`
const developTag = '@in-develop'

// 1. Run all tests in file
// 2. Tag failing tests with @in-develop + @scope-{session}
// 3. LOOP: fix → run --env grepTags=@in-develop → remove tag if pass
// 4. FINAL RUN: --env grepTags=@scope-{session}
// 5. CLEANUP: Remove ALL temporary tags
```

**Temporary Tags (DO NOT COMMIT):**
- `@in-develop` - Tests being actively fixed
- `@scope-{session}` - Tests for current session scope

**Important:** `code-reviewer` (Phase 16) verifies no temporary tags remain.

---

## Block 7: Finalization (Phases 16-19)

Final phases for review, testing, and documentation.

### Phase 16: Code Reviewer

**Agent:** `code-reviewer`
**Model:** Sonnet
**Color:** Red

**Review Layers:**
1. **Layer 0:** Session scope compliance
2. **Layer 0.5:** NO temporary tags (`@in-develop`, `@scope-*`)
3. **Layer 1:** `.rules/` compliance
4. **Layer 2:** Code quality analysis
5. **Layer 3:** Security analysis
6. **Layer 4:** Performance analysis

**Responsibilities:**
1. Checkout feature branch
2. Execute all review layers
3. Write review report IN SPANISH
4. Publish to ClickUp (if enabled)

**Layer 0.5 - Tag Cleanup Verification:**
```typescript
// BLOCKS if temporary tags found
const remainingTags = await Grep({
  pattern: '@in-develop|@scope-',
  path: 'contents/themes/',
  glob: '*.cy.ts'
})

if (remainingTags.length > 0) {
  throw new Error('TEMPORARY_TAGS_NOT_CLEANED')
}
```

---

### Phase 17: Unit Test Writer

**Agent:** `unit-test-writer`
**Model:** Sonnet
**Color:** Purple

**Responsibilities:**
1. Analyze implemented code
2. Create tests for Zod validation schemas
3. Create tests for business logic
4. Create tests for utility functions
5. Create tests for React hooks
6. Run `pnpm test`
7. Verify 80%+ coverage

**Target Coverage:** 80%+ for implemented features

---

### Phase 18: Documentation Writer (Optional)

**Agent:** `documentation-writer`
**Status:** SKIP by default

**Responsibilities:**
1. Create feature documentation
2. Document API endpoints
3. Add usage examples
4. Update `.rules/` if necessary

---

### Phase 19: Demo Video Generator (Optional)

**Command:** `/doc:demo-feature`
**Status:** SKIP by default

**Responsibilities:**
1. Create demo script with Cypress
2. Record demo video
3. Add narration/captions
4. Export to deliverable format

---

## Conditional Phase Execution

Based on PM Decisions, phases are EXECUTED or SKIPPED:

| Dev Type | Phases 3-4 (Plugin) | Phases 3b-4b (Theme) | Phase 10 (Blocks) |
|----------|---------------------|----------------------|-------------------|
| **Feature** | SKIP | SKIP | If "Requires Blocks" = Yes |
| **New Theme** | SKIP | EXECUTE | If "Requires Blocks" = Yes |
| **New Plugin** | EXECUTE | SKIP | If "Requires Blocks" = Yes |
| **Plugin + Theme** | EXECUTE | EXECUTE | If "Requires Blocks" = Yes |
| **Core Change** | SKIP | SKIP | If "Requires Blocks" = Yes |

---

## Gates Summary Table

| Gate | Phase | Agent | Validates | On Failure |
|------|-------|-------|-----------|------------|
| 1 | 4 | plugin-validator | TypeScript, registry, sandbox | → plugin-creator |
| 2 | 4b | theme-validator | Build, configs, Team Mode | → theme-creator |
| 3 | 6 | db-validator | Migrations, sample data, test users | → db-developer |
| 4 | 8 | backend-validator | Jest, build, tsc, lint, dual auth | → backend-developer |
| 5 | 9 | api-tester | Cypress API 100% | → backend-developer (retry) |
| 6 | 12 | frontend-validator | data-cy, translations | → frontend-developer |
| 7 | 13 | functional-validator | AC vs code coherence | → appropriate dev |
| 8 | 14 | qa-manual | Navigation, errors, UI | → retry (max 3) |
| 9 | 15 | qa-automation | Cypress UAT 100%, POMs | → fix tests or dev |

---

## Example Execution Flow

### Feature Development (Most Common)

```text
Phase 1:  product-manager ────────────────────┐
Phase 2:  architecture-supervisor ────────────┤ BLOCK 1
                                              │
Phase 3:  [SKIP - not creating plugin] ───────┤
Phase 4:  [SKIP] ─────────────────────────────┤
Phase 3b: [SKIP - not creating theme] ────────┤ BLOCK 2
Phase 4b: [SKIP] ─────────────────────────────┤
Phase 5:  db-developer ───────────────────────┤
Phase 6:  db-validator [GATE] ────────────────┘

Phase 7:  backend-developer ──────────────────┐
Phase 8:  backend-validator [GATE] ───────────┤ BLOCK 3
Phase 9:  api-tester [GATE] ──────────────────┘

Phase 10: [SKIP or EXECUTE based on Blocks] ── BLOCK 4

Phase 11: frontend-developer ─────────────────┐
Phase 12: frontend-validator [GATE] ──────────┤ BLOCK 5
Phase 13: functional-validator [GATE] ────────┘

Phase 14: qa-manual [GATE] ───────────────────┐ BLOCK 6
Phase 15: qa-automation [GATE] ───────────────┘

Phase 16: code-reviewer ──────────────────────┐
Phase 17: unit-test-writer ───────────────────┤ BLOCK 7
Phase 18: [OPTIONAL] ─────────────────────────┤
Phase 19: [OPTIONAL] ─────────────────────────┘

          HUMAN APPROVAL & MERGE
```

---

## Next Steps

- **[Quality Gates](./07-quality-gates.md)** - Detailed gate conditions and retry logic
- **[PM Decisions](./09-pm-decisions.md)** - Understanding the 4 mandatory decisions
- **[Agents](./03-agents.md)** - Complete agent reference
- **[Commands](./06-commands.md)** - Slash commands to execute workflow
