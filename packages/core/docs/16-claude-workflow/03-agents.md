# Agents (v4.0)

> **Version 4.0** - 25 specialized agents organized by workflow block.

## Introduction

Agents are specialized AI assistants with defined roles, tools, and responsibilities within the 19-phase development workflow. Each agent handles specific phases and interacts with session files to coordinate work.

> **Note:** This is ONE approach to AI-assisted development. You can use all 25 agents, simplify to 4 core agents, or create your own. See [Customization](./10-customization.md) for adapting agents to your needs.

**Key Concepts:**
- **25 Total Agents** - 23 workflow agents + 2 utility agents
- **9 Validator Agents** - Quality gates that block progress if conditions not met
- **7 Workflow Blocks** - Agents organized by development stage
- **Session-Based Coordination** - Agents communicate via session files

---

## Quick Reference Table

| # | Agent | Phase | Block | Model | Color | Gate |
|---|-------|-------|-------|-------|-------|------|
| 1 | product-manager | 1 | Planning | sonnet | green | - |
| 2 | architecture-supervisor | 2 | Planning | opus | cyan | - |
| 3 | plugin-creator | 3 | Foundation | sonnet | cyan | - |
| 4 | plugin-validator | 4 | Foundation | sonnet | cyan | GATE |
| 5 | theme-creator | 3b | Foundation | sonnet | green | - |
| 6 | theme-validator | 4b | Foundation | sonnet | green | GATE |
| 7 | db-developer | 5 | Foundation | sonnet | blue | - |
| 8 | db-validator | 6 | Foundation | sonnet | yellow | GATE |
| 9 | backend-developer | 7 | Backend | sonnet | blue | - |
| 10 | backend-validator | 8 | Backend | sonnet | cyan | GATE |
| 11 | api-tester | 9 | Backend | sonnet | orange | GATE+RETRY |
| 12 | block-developer | 10 | Blocks | sonnet | orange | - |
| 13 | frontend-developer | 11 | Frontend | sonnet | purple | - |
| 14 | frontend-validator | 12 | Frontend | sonnet | cyan | GATE |
| 15 | functional-validator | 13 | Frontend | sonnet | yellow | GATE |
| 16 | qa-manual | 14 | QA | sonnet | green | GATE+RETRY |
| 17 | qa-automation | 15 | QA | sonnet | green | GATE |
| 18 | code-reviewer | 16 | Finalization | sonnet | red | - |
| 19 | unit-test-writer | 17 | Finalization | sonnet | purple | - |
| 20 | documentation-writer | 18 | Finalization | sonnet | cyan | - |
| 21 | demo-video-generator | 19 | Finalization | - | - | - |
| 22 | release-manager | - | Utility | sonnet | purple | - |
| 23 | workflow-maintainer | - | Utility | opus | magenta | - |

**Additional Agents (Utility):**
- `dev-plugin` - Plugin development specialist
- `qa-tester` - Legacy QA agent

---

## Block 1: Planning Agents

### 1. Product Manager

**File:** `.claude/agents/product-manager.md`
**Phase:** 1
**Model:** Sonnet
**Color:** Green

**Purpose:** Gather requirements, make PM Decisions, and initialize session.

**Responsibilities:**
1. Interact with user to understand feature requirements
2. Ask 4 mandatory PM Decision questions:
   - Dev Type (Feature / New Theme / New Plugin / Core Change)
   - DB Policy (Reset permitted / Incremental migrations)
   - Requires Blocks (Yes / No)
   - Plugin Config (if creating plugin)
3. Create session folder with 8 files
4. Write `requirements.md` with AC classification ([AUTO]/[MANUAL]/[REVIEW])
5. Create `clickup_task.md` (optional)
6. Initialize `context.md` with PM entry
7. Define `scope.json` for session boundaries

**Session Files Created:**
- `requirements.md` - Detailed requirements
- `clickup_task.md` - Business context
- `scope.json` - Session scope
- `context.md` - Coordination log (initialized)

**ClickUp Interaction:** Can create tasks, add comments (OPTIONAL)

**Tools:** Bash, Glob, Grep, Read, Edit, Write, TodoWrite, AskUserQuestion, mcp__clickup__*

---

### 2. Architecture Supervisor

**File:** `.claude/agents/architecture-supervisor.md`
**Phase:** 2
**Model:** Opus
**Color:** Cyan

**Purpose:** Create comprehensive technical plan for all 19 phases.

**Responsibilities:**
1. Read `requirements.md` and understand PM Decisions
2. Check `pendings.md` from previous versions (if v2+)
3. Create `plan.md` with technical approach
4. Create `progress.md` with tracking checkboxes for all phases
5. Initialize `tests.md` and `pendings.md` (empty)
6. Update `context.md` with architect entry
7. Document technical decisions and rationale

**Session Files Created:**
- `plan.md` - Technical plan
- `progress.md` - Progress tracking
- `tests.md` - Empty, for validators
- `pendings.md` - Empty, for future items

**ClickUp Interaction:** None (session files only)

**Tools:** Bash, Glob, Grep, Read, Edit, Write, TodoWrite, AskUserQuestion

---

## Block 2: Foundation Agents

### 3. Plugin Creator

**File:** `.claude/agents/plugin-creator.md`
**Phase:** 3 (Conditional)
**Model:** Sonnet
**Color:** Cyan
**Condition:** Only if PM Decision Dev Type = "New Plugin" or "Plugin + Theme"

**Purpose:** Scaffold new plugin using preset.

**Responsibilities:**
1. Run `pnpm create:plugin {name}` scaffolding
2. Configure `plugin.config.ts` with lifecycle hooks
3. Set up `lib/core.ts` with main logic
4. Create API routes structure
5. Configure plugin in `plugin-sandbox` theme
6. Run `node core/scripts/build/registry.mjs`

**Output:** Complete plugin in `contents/plugins/{name}/`

**Tools:** Bash, Glob, Grep, Read, Edit, Write, TodoWrite, AskUserQuestion

---

### 4. Plugin Validator [GATE]

**File:** `.claude/agents/plugin-validator.md`
**Phase:** 4 (Conditional)
**Model:** Sonnet
**Color:** Cyan
**Type:** Quality Gate - BLOCKS if failed
**Condition:** Only if Phase 3 executed

**Gate Conditions:**
- [ ] TypeScript compiles without errors
- [ ] `plugin.config.ts` exists and is valid
- [ ] Plugin appears in `PLUGIN_REGISTRY`
- [ ] Plugin enabled in `plugin-sandbox` theme
- [ ] `pnpm build` passes

**On Failure:** Calls `plugin-creator` to fix issues

**Tools:** Bash, Glob, Grep, Read, Edit, Write, TodoWrite, AskUserQuestion

---

### 5. Theme Creator

**File:** `.claude/agents/theme-creator.md`
**Phase:** 3b (Conditional)
**Model:** Sonnet
**Color:** Green
**Condition:** Only if PM Decision Dev Type = "New Theme" or "Plugin + Theme"

**Purpose:** Scaffold new theme using preset.

**Responsibilities:**
1. Run `pnpm create:theme {name}` scaffolding
2. Configure `theme.config.ts`
3. Configure `app.config.ts` (Team Mode, features)
4. Configure `dashboard.config.ts`
5. Configure `permissions.config.ts`
6. Run `node core/scripts/build/registry.mjs`

**Output:** Complete theme in `contents/themes/{name}/`

**Tools:** Bash, Glob, Grep, Read, Edit, Write, TodoWrite, AskUserQuestion

---

### 6. Theme Validator [GATE]

**File:** `.claude/agents/theme-validator.md`
**Phase:** 4b (Conditional)
**Model:** Sonnet
**Color:** Green
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

**Tools:** Bash, Glob, Grep, Read, Edit, Write, TodoWrite, AskUserQuestion

---

### 7. DB Developer

**File:** `.claude/agents/db-developer.md`
**Phase:** 5
**Model:** Sonnet
**Color:** Blue

**Purpose:** Create migrations, sample data, and test users.

**Responsibilities:**
1. Create migrations with **camelCase** field names (NOT snake_case)
2. Create abundant sample data (20+ records per entity)
3. Create test users with standard password hash
4. Configure `devKeyring` in `app.config.ts`
5. Set up team memberships (if Team Mode)

**Standard Test Users:**

| Email | Role |
|-------|------|
| owner@test.com | owner |
| admin@test.com | admin |
| member@test.com | member |
| guest@test.com | guest |
| superadmin@cypress.com | superadmin |

**Standard Password:** `Test1234`

**Standard Hash:**
```text
3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866
```

**Tools:** Bash, Glob, Grep, Read, Edit, Write, TodoWrite, AskUserQuestion

---

### 8. DB Validator [GATE]

**File:** `.claude/agents/db-validator.md`
**Phase:** 6
**Model:** Sonnet
**Color:** Yellow
**Type:** Quality Gate - BLOCKS if failed

**Gate Conditions:**
- [ ] Migrations execute successfully
- [ ] All tables exist (`pnpm db:verify`)
- [ ] Sample data exists (20+ per entity)
- [ ] Test users exist with correct hash
- [ ] Team memberships configured (if Team Mode)
- [ ] Foreign keys valid (JOINs work)
- [ ] `devKeyring` configured in `app.config.ts`

**On Failure:** Calls `db-developer` to fix issues

**Tools:** Bash, Glob, Grep, Read, Edit, Write, TodoWrite, AskUserQuestion

---

## Block 3: Backend Agents

### 9. Backend Developer

**File:** `.claude/agents/backend-developer.md`
**Phase:** 7
**Model:** Sonnet
**Color:** Blue
**Approach:** TDD (Test-Driven Development)

**Purpose:** Implement API endpoints following TDD.

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

**Requirements:**
- Dual auth (session + API key) on all routes
- Zod schemas for validation
- Proper error handling
- Rate limiting where appropriate

**Tools:** Bash, Glob, Grep, Read, Edit, Write, TodoWrite, AskUserQuestion

---

### 10. Backend Validator [GATE]

**File:** `.claude/agents/backend-validator.md`
**Phase:** 8
**Model:** Sonnet
**Color:** Cyan
**Type:** Quality Gate - BLOCKS if failed

**Gate Conditions:**
- [ ] `pnpm test -- --testPathPattern=api` passes
- [ ] `pnpm build` successful
- [ ] `tsc --noEmit` no errors
- [ ] `pnpm lint` passes
- [ ] Dual auth verified on all routes

**On Failure:** Calls `backend-developer` to fix issues

**Tools:** Bash, Glob, Grep, Read, Edit, Write, TodoWrite, AskUserQuestion

---

### 11. API Tester [GATE + RETRY]

**File:** `.claude/agents/api-tester.md`
**Phase:** 9
**Model:** Sonnet
**Color:** Orange
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

  for (const bug of result.apiBugs) {
    await launchAgent('backend-developer', {
      task: `[API-TESTER FIX] Fix: ${bug.endpoint}`
    })
  }
}
```

**On 3 Failures:** GATE_FAILED - requires manual intervention

**Tools:** Bash, Glob, Grep, Read, Edit, Write, TodoWrite, AskUserQuestion

---

## Block 4: Blocks Agents

### 12. Block Developer

**File:** `.claude/agents/block-developer.md`
**Phase:** 10 (Conditional)
**Model:** Sonnet
**Color:** Orange
**Condition:** Only if PM Decision "Requires Blocks" = Yes

**Purpose:** Create or modify page builder blocks.

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

**Output:** Block in `contents/themes/{theme}/blocks/{name}/`

**Tools:** Bash, Glob, Grep, Read, Edit, Write, TodoWrite, AskUserQuestion

---

## Block 5: Frontend Agents

### 13. Frontend Developer

**File:** `.claude/agents/frontend-developer.md`
**Phase:** 11
**Model:** Sonnet
**Color:** Purple

**Purpose:** Implement UI components and client-side logic.

**Responsibilities:**
1. Create components with shadcn/ui
2. Implement state with TanStack Query
3. Add translations (EN + ES)
4. Add `data-cy` attributes on ALL interactive elements
5. Implement loading/error states
6. Use CSS variables (no hardcoded colors)
7. Verify `pnpm build` passes

**Requirements:**
- NO hardcoded strings
- ALL interactive elements have `data-cy`
- Nomenclature: `{entity}-{component}-{detail}`
- Translations in correct namespace
- Responsive design

**Tools:** Bash, Glob, Grep, Read, Edit, Write, TodoWrite, AskUserQuestion, mcp__playwright__*

---

### 14. Frontend Validator [GATE]

**File:** `.claude/agents/frontend-validator.md`
**Phase:** 12
**Model:** Sonnet
**Color:** Cyan
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

**Tools:** Bash, Glob, Grep, Read, Edit, Write, TodoWrite, AskUserQuestion, mcp__playwright__*

---

### 15. Functional Validator [GATE]

**File:** `.claude/agents/functional-validator.md`
**Phase:** 13
**Model:** Sonnet
**Color:** Yellow
**Type:** Quality Gate - BLOCKS if failed

**Gate Conditions:**
- [ ] `progress.md` updated by developers
- [ ] Each AC from `requirements.md` verified in code
- [ ] Playwright spot-checks pass
- [ ] No major gaps between plan and implementation

**On Failure:** Reports in `context.md`, calls appropriate developer

**Tools:** Bash, Glob, Grep, Read, Edit, Write, TodoWrite, AskUserQuestion, mcp__playwright__*

---

## Block 6: QA Agents

### 16. QA Manual [GATE + RETRY]

**File:** `.claude/agents/qa-manual.md`
**Phase:** 14
**Model:** Sonnet
**Color:** Green
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
    if (error.type === 'api_error') {
      await launchAgent('backend-developer', { task: `Fix: ${error.message}` })
    } else {
      await launchAgent('frontend-developer', { task: `Fix: ${error.message}` })
    }
  }
}
```

**On 3 Failures:** Documents in `pendings.md`, BLOCKS `qa-automation`

**Tools:** Bash, Glob, Grep, Read, Edit, Write, TodoWrite, AskUserQuestion, mcp__playwright__*

---

### 17. QA Automation [GATE]

**File:** `.claude/agents/qa-automation.md`
**Phase:** 15
**Model:** Sonnet
**Color:** Green
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
```typescript
// Uses Cypress grep tags
const scopeTag = `@scope-${sessionName}`
const developTag = '@in-develop'

// 1. Run all tests
// 2. Tag failing with @in-develop + @scope-{session}
// 3. Fix → rerun @in-develop → remove if pass
// 4. Final run with @scope-{session}
// 5. CLEANUP: Remove ALL temporary tags
```

**Temporary Tags (DO NOT COMMIT):**
- `@in-develop` - Tests being actively fixed
- `@scope-{session}` - Tests for current session

**Tools:** Bash, Glob, Grep, Read, Edit, Write, TodoWrite, AskUserQuestion, mcp__playwright__*

---

## Block 7: Finalization Agents

### 18. Code Reviewer

**File:** `.claude/agents/code-reviewer.md`
**Phase:** 16
**Model:** Sonnet
**Color:** Red

**Purpose:** Comprehensive code review across multiple layers.

**Review Layers:**
1. **Layer 0:** Session scope compliance
2. **Layer 0.5:** NO temporary tags (`@in-develop`, `@scope-*`)
3. **Layer 1:** `.rules/` compliance
4. **Layer 2:** Code quality analysis
5. **Layer 3:** Security analysis
6. **Layer 4:** Performance analysis

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

**Output:** Review report IN SPANISH, ClickUp comment (optional)

**ClickUp Interaction:** Can add comments (OPTIONAL)

**Tools:** Bash, Glob, Grep, Read, Edit, Write, TodoWrite, AskUserQuestion, mcp__clickup__*

---

### 19. Unit Test Writer

**File:** `.claude/agents/unit-test-writer.md`
**Phase:** 17
**Model:** Sonnet
**Color:** Purple

**Purpose:** Write Jest unit tests for implemented code.

**Responsibilities:**
1. Analyze implemented code
2. Create tests for Zod validation schemas
3. Create tests for business logic
4. Create tests for utility functions
5. Create tests for React hooks
6. Run `pnpm test`
7. Verify 80%+ coverage

**Target Coverage:** 80%+ for implemented features

**Tools:** Bash, Glob, Grep, Read, Edit, Write, TodoWrite, AskUserQuestion

---

### 20. Documentation Writer

**File:** `.claude/agents/documentation-writer.md`
**Phase:** 18 (Optional)
**Model:** Sonnet
**Color:** Cyan

**Purpose:** Create feature documentation.

**Responsibilities:**
1. Create feature documentation
2. Document API endpoints
3. Add usage examples
4. Update `.rules/` if necessary

**Status:** SKIP by default, manually triggered

**Tools:** Bash, Glob, Grep, Read, Edit, Write, TodoWrite, AskUserQuestion

---

### 21. Demo Video Generator

**Phase:** 19 (Optional)
**Command:** `/doc:demo-feature`

**Purpose:** Create demo videos for features.

**Responsibilities:**
1. Create demo script with Cypress
2. Record demo video
3. Add narration/captions
4. Export to deliverable format

**Status:** SKIP by default, manually triggered via command

---

## Utility Agents

### 22. Release Manager

**File:** `.claude/agents/release-manager.md`
**Model:** Sonnet
**Color:** Purple

**Purpose:** Create releases with semantic versioning.

**Responsibilities:**
1. Analyze commits since last release
2. Determine version bump (MAJOR/MINOR/PATCH)
3. Create git tag
4. Execute `pnpm release`
5. Generate changelog

**Versioning Rules:**
- **PATCH:** Bug fixes, security patches, performance improvements
- **MINOR:** New features (backward-compatible), new plugins/themes
- **MAJOR:** Breaking changes, database schema changes

**Tools:** Bash, Glob, Grep, Read, Edit, Write, TodoWrite, AskUserQuestion

---

### 23. Workflow Maintainer

**File:** `.claude/agents/workflow-maintainer.md`
**Model:** Opus
**Color:** Magenta

**Purpose:** Maintain, create, and modify the Claude workflow system.

**Responsibilities:**
1. Create/modify agents in `.claude/agents/`
2. Create/modify commands in `.claude/commands/`
3. Update configuration in `.claude/config/`
4. Sync changes to `packages/ai-workflow/` (if core project)
5. Ensure workflow coherence
6. Detect core vs derived project

**Configuration Awareness:**
- Reads from `.claude/config/agents.json`
- Uses JSON path references (not hardcoded values)
- Syncs to `packages/ai-workflow/claude/` via sync script when appropriate

**Tools:** Bash, Glob, Grep, Read, Edit, Write, TodoWrite, AskUserQuestion

---

### Additional: Dev Plugin

**File:** `.claude/agents/dev-plugin.md`
**Model:** Sonnet
**Color:** Orange

**Purpose:** Plugin development specialist for ongoing work.

**When to Use:** For plugin feature development, bug fixes, and modifications (not initial creation).

---

### Additional: QA Tester (Legacy)

**File:** `.claude/agents/qa-tester.md`
**Model:** Sonnet
**Color:** Green

**Purpose:** Manual exploratory testing.

**When to Use:** Edge cases, UX validation, cross-device testing not covered by automated tests.

**Note:** Largely replaced by `qa-manual` and `qa-automation` in v4.0.

---

## Agent Interaction Matrix

### ClickUp Permissions

| Agent | Create Task | Update Status | Create Bugs | Add Comments |
|-------|-------------|---------------|-------------|--------------|
| product-manager | OPTIONAL | - | - | OPTIONAL |
| architecture-supervisor | - | - | - | - |
| All developers | - | - | - | - |
| All validators | - | - | - | - |
| qa-manual | - | - | OPTIONAL | OPTIONAL |
| qa-automation | - | - | OPTIONAL | OPTIONAL |
| code-reviewer | - | - | - | OPTIONAL |
| Human | YES | YES | YES | YES |

**Design Rationale:** 90% fewer API calls - progress tracked in session files, ClickUp for visibility only.

---

### Session File Responsibilities

| File | Created By | Updated By |
|------|-----------|------------|
| requirements.md | product-manager | functional-validator |
| clickup_task.md | product-manager | - |
| scope.json | product-manager | - |
| plan.md | architecture-supervisor | - |
| progress.md | architecture-supervisor | All agents |
| context.md | product-manager | All agents |
| tests.md | architecture-supervisor | validators, QA |
| pendings.md | architecture-supervisor | Any agent |

---

## Next Steps

- **[Workflow Phases](./04-workflow-phases.md)** - 19 phases explained
- **[Quality Gates](./07-quality-gates.md)** - Gate conditions and retry logic
- **[Commands](./06-commands.md)** - Slash commands to invoke agents
- **[Sessions](./05-sessions.md)** - Session file structure
