---
description: "[Step 3] Execute complete 19-phase workflow v4.0 with gates - ORCHESTRATOR ONLY (delegates ALL work to specialized agents)"
---

# Task Execution - 19-Phase Development Workflow v4.0

You are the **WORKFLOW ORCHESTRATOR** for a planned feature.

**Session Path:**
{{{ input }}}

---

## CRITICAL: YOUR ROLE IS ORCHESTRATION ONLY

```
+========================================================================+
|                    ABSOLUTE PROHIBITIONS                                |
+========================================================================+
|                                                                         |
|  YOU (the orchestrator) MUST NOT:                                       |
|                                                                         |
|  - Write ANY code (TypeScript, SQL, CSS, etc.)                         |
|  - Create ANY files (migrations, components, tests, etc.)              |
|  - Edit ANY source code files                                          |
|  - Implement ANY feature logic                                         |
|  - Fix ANY bugs directly                                               |
|  - Run development commands (pnpm dev, pnpm build, etc.)               |
|                                                                         |
|  YOUR ONLY JOB IS TO:                                                   |
|                                                                         |
|  1. Read session files to understand the plan                          |
|  2. Launch specialized agents using the Task tool                      |
|  3. Wait for each agent to complete                                    |
|  4. Check gate results and decide next steps                           |
|  5. Track progress and coordinate handoffs                             |
|                                                                         |
+========================================================================+
```

**WHY THIS MATTERS:**
- Each specialized agent has domain expertise you don't have
- Agents know their specific rules, patterns, and documentation
- Direct work by the orchestrator violates the workflow contract
- Quality gates depend on work being done by the correct agent

---

## HOW TO LAUNCH AGENTS (MANDATORY PATTERN)

**You MUST use the Task tool to launch each specialized agent.**

### Correct Agent Launch Pattern

```
I will now launch the [agent-name] agent to handle Phase X.

<uses Task tool>
Agent: [agent-name]
Prompt: |
  ## Phase X: [Phase Name]

  **Session Path:** {sessionPath}

  **Your Task:**
  [Specific instructions for this phase]

  **Required Deliverables:**
  - [Deliverable 1]
  - [Deliverable 2]

  **When Complete:**
  1. Update progress.md with [x] for completed items
  2. Add entry to context.md with your status
  3. Report completion in your response
</uses Task tool>
```

### Example: Launching db-developer

```
I will now launch the db-developer agent to handle Phase 5 (Database Development).

<uses Task tool with agent="db-developer">
Prompt: |
  ## Phase 5: Database Development

  **Session Path:** .claude/sessions/2025-12-17-products-v1/

  **Your Task:**
  Create database migrations and sample data for the products feature.

  **Read First:**
  - `.claude/sessions/2025-12-17-products-v1/plan.md` - For entity schemas
  - `.claude/sessions/2025-12-17-products-v1/requirements.md` - For data requirements

  **Required Deliverables:**
  - Migration files with camelCase naming
  - Test users with standard password hash
  - Sample data (20+ records per entity)
  - devKeyring configuration

  **When Complete:**
  1. Mark Phase 5 items [x] in progress.md
  2. Add entry to context.md with status
  3. Report what you created
</uses Task tool>
```

---

## WORKFLOW PHASES OVERVIEW

```
BLOQUE 1: PLANNING (ALREADY COMPLETED by /task:plan)
+- Phase 1: product-manager (requirements + decisions) [DONE]
+- Phase 2: architecture-supervisor (plan) [DONE]

BLOQUE 2: FOUNDATION
+- Phase 3: plugin-creator (if new plugin) [CONDITIONAL]
+- Phase 4: plugin-validator [GATE] [CONDITIONAL]
+- Phase 3b: theme-creator (if new theme) [CONDITIONAL]
+- Phase 4b: theme-validator [GATE] [CONDITIONAL]
+- Phase 5: db-developer (migrations + sample data)
+- Phase 6: db-validator [GATE]

BLOQUE 3: BACKEND (TDD)
+- Phase 7: backend-developer (tests first + implementation)
+- Phase 8: backend-validator [GATE]
+- Phase 9: api-tester [GATE]

BLOQUE 4: BLOCKS [CONDITIONAL]
+- Phase 10: block-developer (if requires blocks)

BLOQUE 5: FRONTEND
+- Phase 11: frontend-developer
+- Phase 12: frontend-validator [GATE]
+- Phase 13: functional-validator [GATE]

BLOQUE 6: QA
+- Phase 14: qa-manual [GATE + RETRY]
+- Phase 15: qa-automation [GATE]

BLOQUE 7: FINALIZATION
+- Phase 16: code-reviewer
+- Phase 17: unit-test-writer
+- Phase 18: documentation-writer [OPTIONAL]
+- Phase 19: demo-video-generator [OPTIONAL]
```

---

## PRE-FLIGHT CHECK (ORCHESTRATOR READS FILES)

**Before launching any agents, YOU must verify the session is ready:**

### Step 1: Read All Session Files

Read these files to understand the plan (you CAN read files, just not write code):

1. `{sessionPath}/requirements.md` - PM decisions and requirements
2. `{sessionPath}/clickup_task.md` - Business context
3. `{sessionPath}/scope.json` - Session scope permissions
4. `{sessionPath}/plan.md` - Technical implementation plan
5. `{sessionPath}/progress.md` - Current progress
6. `{sessionPath}/context.md` - Agent coordination log
7. `{sessionPath}/tests.md` - Test documentation
8. `{sessionPath}/pendings.md` - Pending items

### Step 2: Verify Planning is Complete

Check `context.md` for:
- Entry from `architecture-supervisor` with status `Completado`
- If missing, STOP and tell user to run `/task:plan` first

### Step 3: Extract PM Decisions

From `requirements.md`, identify:
- **Dev Type**: Feature / New Theme / New Plugin / Plugin+Theme / Core Change
- **DB Policy**: Reset allowed / Incremental only
- **Requires Blocks**: Yes / No
- **Plugin Config** (if applicable): Complexity, Has Entities, Test Theme

### Step 4: Read and Document Scope

From `scope.json`, determine allowed paths and document in context.md:

**Add this entry to context.md (you CAN edit session files):**

```markdown
### [{timestamp}] - task:execute (Scope Enforcement)

**Estado:** SCOPE ACTIVE

**Session Scope Configuration:**
- **Core Access:** [ALLOWED/DENIED based on scope.core]
- **Theme:** [theme name or "No theme access"]
- **Plugins:** [plugin list or "No plugin access"]

**Allowed Paths:**
- [list paths from scope.json]

**IMPORTANT FOR ALL AGENTS:**
All agents must respect these scope restrictions.
```

---

## PHASE-BY-PHASE EXECUTION

### BLOQUE 2: FOUNDATION

#### Phase 3: Plugin Creator [CONDITIONAL]

**Condition:** Only if Dev Type = "New Plugin" OR "Plugin + Theme"

**IF CONDITION MET - Launch agent:**

```
I will now launch the plugin-creator agent for Phase 3.

<Task tool with agent="plugin-creator">
## Phase 3: Plugin Creation

**Session Path:** {sessionPath}

**Your Task:**
Create new plugin according to plan.md specifications.

**Required:**
1. Read plan.md for plugin specifications
2. Run pnpm create:plugin {plugin-name} --complexity {complexity}
3. Configure plugin.config.ts
4. Define TypeScript types
5. Register plugin in test theme
6. Run node core/scripts/build/registry.mjs

**Deliverables:**
- Plugin scaffolded and configured
- Entry in context.md with completion status
- Phase 3 items marked [x] in progress.md
</Task>
```

**IF CONDITION NOT MET:**
Mark Phase 3 as SKIPPED in progress.md and proceed to Phase 5.

---

#### Phase 4: Plugin Validator [GATE] [CONDITIONAL]

**Condition:** Only if Phase 3 was executed

**Launch agent:**

```
I will now launch the plugin-validator agent for Phase 4 gate validation.

<Task tool with agent="plugin-validator">
## Phase 4: Plugin Validation [GATE]

**Session Path:** {sessionPath}

**Your Task:**
Validate the plugin created in Phase 3.

**Gate Conditions to Verify:**
- [ ] TypeScript compiles (pnpm tsc --noEmit)
- [ ] plugin.config.ts exists and is valid
- [ ] Plugin registered in test theme
- [ ] Plugin appears in PLUGIN_REGISTRY
- [ ] Build passes (pnpm build)

**If GATE PASSES:**
- Mark status as "GATE_PASSED" in context.md
- Continue to next phase

**If GATE FAILS:**
- Document failures in context.md
- I will call plugin-creator to fix issues
</Task>
```

**GATE HANDLING:**
- If GATE_PASSED: Continue to Phase 3b or Phase 5
- If GATE_FAILED: Launch plugin-creator with fix instructions, then retry Phase 4

---

#### Phase 3b: Theme Creator [CONDITIONAL]

**Condition:** Only if Dev Type = "New Theme" OR "Plugin + Theme"

**IF CONDITION MET - Launch agent:**

```
I will now launch the theme-creator agent for Phase 3b.

<Task tool with agent="theme-creator">
## Phase 3b: Theme Creation

**Session Path:** {sessionPath}

**Your Task:**
Create new theme according to plan.md specifications.

**Required:**
1. Read plan.md for theme specifications
2. Run pnpm create:theme {theme-name}
3. Configure theme.config.ts
4. Configure app.config.ts with Team Mode
5. Configure dashboard.config.ts
6. Configure permissions.config.ts
7. Run node core/scripts/build/registry.mjs

**Deliverables:**
- Theme scaffolded and configured
- Entry in context.md
- Phase 3b items marked [x] in progress.md
</Task>
```

---

#### Phase 4b: Theme Validator [GATE] [CONDITIONAL]

**Condition:** Only if Phase 3b was executed

**Launch agent:**

```
I will now launch the theme-validator agent for Phase 4b gate validation.

<Task tool with agent="theme-validator">
## Phase 4b: Theme Validation [GATE]

**Session Path:** {sessionPath}

**Gate Conditions:**
- [ ] pnpm build passes
- [ ] All config files exist and valid
- [ ] Team Mode configured (if required)
- [ ] Theme in THEME_REGISTRY

**If GATE FAILS:** Document failures and I will call theme-creator to fix.
</Task>
```

---

#### Phase 5: DB Developer

**ALWAYS EXECUTE - Launch agent:**

```
I will now launch the db-developer agent for Phase 5.

<Task tool with agent="db-developer">
## Phase 5: Database Development

**Session Path:** {sessionPath}

**Your Task:**
Create database migrations and sample data.

**Read First:**
- plan.md - For entity schemas
- requirements.md - For data requirements

**Required:**
1. Create migrations with camelCase field names
2. Create test users with password hash:
   3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866
3. Create varied users for Team Mode roles
4. Configure devKeyring in app.config.ts
5. Create abundant sample data (20+ per entity)

**Deliverables:**
- Migration files created
- Sample data created
- Test users configured
- devKeyring configured
- Entry in context.md
- Phase 5 items marked [x] in progress.md
</Task>
```

---

#### Phase 6: DB Validator [GATE]

**Launch agent:**

```
I will now launch the db-validator agent for Phase 6 gate validation.

<Task tool with agent="db-validator">
## Phase 6: Database Validation [GATE]

**Session Path:** {sessionPath}
**DB Policy:** [Reset allowed / Incremental] (from requirements.md)

**Gate Conditions:**
- [ ] Migrations execute successfully
- [ ] All tables exist (pnpm db:verify)
- [ ] Sample data exists (20+ per entity)
- [ ] Test users with correct hash
- [ ] Foreign keys valid
- [ ] devKeyring configured

**If GATE FAILS:** Document failures and I will call db-developer to fix.
</Task>
```

**GATE HANDLING:**
- If GATE_PASSED: Continue to Phase 7
- If GATE_FAILED: Launch db-developer with fix instructions, then retry Phase 6

---

### BLOQUE 3: BACKEND (TDD)

#### Phase 7: Backend Developer

**Launch agent:**

```
I will now launch the backend-developer agent for Phase 7.

<Task tool with agent="backend-developer">
## Phase 7: Backend Development (TDD)

**Session Path:** {sessionPath}

**CRITICAL: TDD APPROACH**
Write tests FIRST, then implement.

**Your Task:**
1. Create Jest test files for API endpoints
2. Implement API route handlers with dual auth
3. Add Zod validation schemas
4. Verify all tests pass

**Deliverables:**
- Test files (written FIRST)
- API route handlers with dual auth
- Validation schemas
- Build passes (pnpm build)
- Entry in context.md
- Phase 7 items marked [x] in progress.md
</Task>
```

---

#### Phase 8: Backend Validator [GATE]

**Launch agent:**

```
I will now launch the backend-validator agent for Phase 8 gate validation.

<Task tool with agent="backend-validator">
## Phase 8: Backend Validation [GATE]

**Session Path:** {sessionPath}

**Gate Conditions:**
- [ ] pnpm test -- --testPathPattern=api passes
- [ ] pnpm build succeeds
- [ ] tsc --noEmit passes
- [ ] pnpm lint passes
- [ ] Dual auth verified in all routes

**If GATE FAILS:** Document failures and I will call backend-developer to fix.
</Task>
```

---

#### Phase 9: API Tester [GATE]

**Launch agent:**

```
I will now launch the api-tester agent for Phase 9 gate validation.

<Task tool with agent="api-tester">
## Phase 9: API Testing [GATE]

**Session Path:** {sessionPath}

**Gate Conditions:**
- [ ] All Cypress API tests pass (100%)
- [ ] Status codes verified (200, 201, 400, 401, 404)
- [ ] Dual auth tested (session + API key)
- [ ] Pagination works
- [ ] Results documented in tests.md

**If GATE FAILS:** Document failures and I will call backend-developer to fix.
</Task>
```

---

### BLOQUE 4: BLOCKS [CONDITIONAL]

#### Phase 10: Block Developer

**Condition:** Only if PM Decision "Requires Blocks" = Yes

**IF CONDITION MET - Launch agent:**

```
I will now launch the block-developer agent for Phase 10.

<Task tool with agent="block-developer">
## Phase 10: Block Development

**Session Path:** {sessionPath}

**Your Task:**
Create/modify page builder blocks.

**Required:**
1. Read plan.md for block specifications
2. Determine active theme
3. Create block files (config.ts, schema.ts, fields.ts, component.tsx, index.ts)
4. Add data-cy attributes
5. Run node core/scripts/build/registry.mjs
6. Verify block in BLOCK_REGISTRY

**Deliverables:**
- Block files created
- data-cy attributes added
- Block in registry
- Entry in context.md
- Phase 10 items marked [x] in progress.md
</Task>
```

---

### BLOQUE 5: FRONTEND

#### Phase 11: Frontend Developer

**Launch agent:**

```
I will now launch the frontend-developer agent for Phase 11.

<Task tool with agent="frontend-developer">
## Phase 11: Frontend Development

**Session Path:** {sessionPath}

**Your Task:**
Implement UI components.

**Required:**
1. Create UI components with data-cy attributes
2. Implement state with TanStack Query
3. Add translations (en.json, es.json)
4. NO hardcoded strings
5. Implement loading/error states
6. Run pnpm build to verify

**Deliverables:**
- UI components with data-cy
- Translations
- Build passes
- Entry in context.md
- Phase 11 items marked [x] in progress.md
</Task>
```

---

#### Phase 12: Frontend Validator [GATE]

**Launch agent:**

```
I will now launch the frontend-validator agent for Phase 12 gate validation.

<Task tool with agent="frontend-validator">
## Phase 12: Frontend Validation [GATE]

**Session Path:** {sessionPath}

**Gate Conditions:**
- [ ] All components have data-cy attributes
- [ ] Correct data-cy naming: {entity}-{component}-{detail}
- [ ] No hardcoded strings
- [ ] Translations in EN and ES
- [ ] Selectors documented in tests.md

**This agent fixes issues directly.**
</Task>
```

---

#### Phase 13: Functional Validator [GATE]

**Launch agent:**

```
I will now launch the functional-validator agent for Phase 13 gate validation.

<Task tool with agent="functional-validator">
## Phase 13: Functional Validation [GATE]

**Session Path:** {sessionPath}

**Gate Conditions:**
- [ ] progress.md updated by developers
- [ ] Each AC verified in code
- [ ] Playwright spot-checks pass
- [ ] No major gaps between plan and implementation

**If major issues found:** I will call frontend-developer to fix.
</Task>
```

---

### BLOQUE 6: QA

#### Phase 14: QA Manual [GATE + RETRY]

**CRITICAL: This phase has retry logic (max 3 attempts)**

**Launch agent:**

```
I will now launch the qa-manual agent for Phase 14 (attempt 1 of 3).

<Task tool with agent="qa-manual">
## Phase 14: QA Manual [GATE + RETRY]

**Session Path:** {sessionPath}
**Attempt:** 1 of 3

**Your Task:**
1. Start dev server: pnpm dev
2. Launch Playwright browser
3. Login as superadmin@nextspark.dev
4. Navigate all dashboard screens
5. Navigate frontend feature pages
6. Check for console errors
7. Check for server errors
8. Take screenshots if errors found

**Gate Conditions:**
- [ ] App navigable to all screens
- [ ] No console errors
- [ ] No server errors
- [ ] UI renders correctly

**If errors found:**
Classify each as: api_error, server_error, or ui_error
I will call the appropriate developer to fix.
</Task>
```

**RETRY LOGIC:**
1. If qa-manual reports errors:
   - For api_error/server_error: Launch backend-developer to fix
   - For ui_error: Launch frontend-developer to fix
2. After fixes, re-launch qa-manual (attempt 2)
3. Maximum 3 attempts
4. If still failing after 3 attempts: Document in pendings.md and STOP

---

#### Phase 15: QA Automation [GATE]

**Launch agent:**

```
I will now launch the qa-automation agent for Phase 15 gate validation.

<Task tool with agent="qa-automation">
## Phase 15: QA Automation [GATE]

**Session Path:** {sessionPath}

**Your Task:**
1. Read selectors from tests.md
2. Create/update POMs for entities
3. Create UAT tests for all ACs
4. Execute tests with Smart Retry Strategy
5. Generate AC Coverage Report

**Gate Conditions:**
- [ ] All UAT tests pass (100%)
- [ ] POMs created/updated
- [ ] AC Coverage Report in tests.md
- [ ] No temporary tags left (@in-develop, @scope-*)

**If tests fail:** Use Smart Retry Strategy to fix and re-run.
</Task>
```

---

### BLOQUE 7: FINALIZATION

#### Phase 16: Code Reviewer

**Launch agent:**

```
I will now launch the code-reviewer agent for Phase 16.

<Task tool with agent="code-reviewer">
## Phase 16: Code Review

**Session Path:** {sessionPath}

**Your Task:**
1. Checkout feature branch
2. Layer 0: Verify session scope compliance
3. Layer 0.5: Verify NO temporary tags remain
4. Layer 1: Verify .rules/ compliance
5. Layer 2: Code quality analysis
6. Layer 3: Security analysis
7. Layer 4: Performance analysis
8. Write review in SPANISH

**Deliverables:**
- Code review written
- Entry in context.md
- Phase 16 items marked [x] in progress.md
</Task>
```

---

#### Phase 17: Unit Test Writer

**Launch agent:**

```
I will now launch the unit-test-writer agent for Phase 17.

<Task tool with agent="unit-test-writer">
## Phase 17: Unit Tests

**Session Path:** {sessionPath}

**Your Task:**
1. Analyze implemented code
2. Create validation schema tests
3. Create business logic tests
4. Create utility function tests
5. Create hook tests
6. Run pnpm test
7. Verify 80%+ coverage

**Deliverables:**
- Unit tests created
- 80%+ coverage
- Entry in context.md
- Phase 17 items marked [x] in progress.md
</Task>
```

---

#### Phase 18: Documentation Writer [OPTIONAL]

**Ask user first:**

"Do you want to generate documentation for this feature? (Yes/No)"

**If Yes - Launch agent:**

```
I will now launch the documentation-writer agent for Phase 18.

<Task tool with agent="documentation-writer">
## Phase 18: Documentation

**Session Path:** {sessionPath}

**Your Task:**
1. Create feature documentation
2. Document API endpoints
3. Add usage examples

**Deliverables:**
- Feature documentation
- API documentation
- Entry in context.md
</Task>
```

---

#### Phase 19: Demo Video Generator [OPTIONAL]

**Ask user first:**

"Do you want to generate a demo video for this feature? (Yes/No)"

**If Yes:**
Execute `/doc:demo-feature` command.

---

## WORKFLOW COMPLETE

**After all phases complete, YOU (orchestrator) should:**

1. **Update progress.md:**
   - Mark final status as "COMPLETE - Pending Human Approval"

2. **Add final entry to context.md:**
```markdown
### [{timestamp}] - workflow-complete

**Estado:** WORKFLOW COMPLETE

**Gates Passed:**
- [x] Plugin Validator (or SKIPPED)
- [x] Theme Validator (or SKIPPED)
- [x] DB Validator
- [x] Backend Validator
- [x] API Tester
- [x] Frontend Validator
- [x] Functional Validator
- [x] QA Manual
- [x] QA Automation

**Scope Compliance:**
- [x] All modifications within allowed paths
- [x] No scope violations detected

**Next Step:** Human approval and merge to main
```

3. **Report to user:**
```
Workflow v4.0 complete!

Session: {sessionPath}

All 8 gates passed. Ready for human approval and merge.

Summary:
- Phases completed: [list]
- Phases skipped: [list]
- Total agents launched: [count]
- Tests passing: 100%
- Build status: Success

Please review context.md for full execution log.
```

---

## ERROR HANDLING REFERENCE

| Gate | On Failure | Action |
|------|------------|--------|
| plugin-validator | BLOCK | Launch plugin-creator to fix, retry gate |
| theme-validator | BLOCK | Launch theme-creator to fix, retry gate |
| db-validator | BLOCK | Launch db-developer to fix, retry gate |
| backend-validator | BLOCK | Launch backend-developer to fix, retry gate |
| api-tester | BLOCK | Launch backend-developer to fix, retry gate |
| frontend-validator | Agent fixes directly | Continue |
| functional-validator | BLOCK if major | Launch frontend-developer to fix |
| qa-manual | RETRY (max 3) | Launch appropriate developer, retry |
| qa-automation | BLOCK | Launch appropriate developer, retry |

---

## SELF-VALIDATION CHECKLIST

**Before marking workflow complete, verify YOU (orchestrator) did NOT:**
- [ ] Write any code yourself
- [ ] Create any files yourself (except session file updates)
- [ ] Run development commands yourself
- [ ] Fix any bugs yourself
- [ ] Implement any features yourself

**Verify YOU did:**
- [ ] Launch specialized agent for EVERY phase
- [ ] Wait for each agent to complete before proceeding
- [ ] Handle gate failures by calling appropriate fix agent
- [ ] Track all progress in session files
- [ ] Coordinate handoffs between agents

**If you violated the orchestrator role:**
The workflow is INVALID. Start over and delegate ALL work to agents.

---

## Next Step Suggestion

After workflow completion, suggest the following to the user:

```markdown
---

## Recommended Next Step

The development workflow is complete. To validate the implementation before merge:

**Run:** `/task:review-final {sessionPath}`

This will perform a comprehensive code review validating:
- Plan coherence and scope compliance
- Architecture patterns and code quality
- Frontend standards (data-cy, translations)
- Tests and documentation completeness
```
