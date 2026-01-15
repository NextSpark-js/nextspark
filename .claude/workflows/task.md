# TASK Workflow v1.0

**T-Shirt Size:** S - M - L
**Session:** `tasks/`
**Subagents:** Selective (only when needed)
**Duration:** 30-120 minutes
**Token Estimate:** 50-200k

---

## Overview

The TASK workflow is the balanced option for medium-complexity work. It provides structure and traceability without the overhead of the full STORY workflow. Use it when you need planning and validation but not the full 14-phase process.

---

## Initial Questions (All 7)

Before starting, Claude asks **all 7 questions** to gather complete context:

```
┌─────────────────────────────────────────────────────────────────┐
│  TASK DISCOVERY (Claude asks directly)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. TASK MANAGER                                                │
│     Is there an existing task in a project management system?   │
│     - No                                                        │
│     - Yes, ClickUp (request task_id)                            │
│     - Yes, Jira (request task_id)                               │
│     - Yes, Linear (request task_id)                             │
│     - Yes, Asana (request task_id)                              │
│                                                                 │
│  2. DATABASE POLICY                                             │
│     How should the database be handled?                         │
│     - No database changes needed                                │
│     - Reset allowed (dev/staging)                               │
│     - Incremental migrations only (production)                  │
│                                                                 │
│  3. ENTITY TYPE                                                 │
│     What type of entity work?                                   │
│     - No entity changes                                         │
│     - Modify existing entity (request name)                     │
│     - New entity (⚠️ consider STORY workflow)                   │
│                                                                 │
│  4. BLOCKS                                                      │
│     Are blocks needed?                                          │
│     - No blocks needed                                          │
│     - Simple blocks (Claude creates them)                       │
│     - Complex blocks (⚠️ consider BLOCKS workflow)              │
│                                                                 │
│  5. MOCK                                                        │
│     Do you have a design mock?                                  │
│     - No                                                        │
│     - Yes, I have a mock                                        │
│       IF YES, ask conditional questions:                        │
│       ├── 5a. Mock is for:                                      │
│       │   [1] Page builder blocks (default if Q4 = blocks)      │
│       │   [2] Complete screens/pages                            │
│       │   [3] Specific components                               │
│       ├── 5b. Mock was created in:                              │
│       │   [1] Stitch                                            │
│       │   [2] UXPilot                                           │
│       │   [3] Figma                                             │
│       │   [4] Other                                             │
│       └── 5c. Number of sections/blocks:                        │
│           [1] Single block/component                            │
│           [2] Multiple (2-4)                                    │
│           [3] Full page (5+)
│                                                                 │
│  6. TESTING                                                     │
│     What testing is needed?                                     │
│     - Run existing tests only                                   │
│     - Modify existing tests                                     │
│     - Create new tests (API/UAT/Unit)                           │
│                                                                 │
│  7. DOCUMENTATION                                               │
│     What documentation is needed?                               │
│     - No documentation needed                                   │
│     - Update existing docs                                      │
│     - Create new docs (public/superadmin/skills)                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key difference from STORY:** Claude asks questions and creates requirements.md directly, without launching PM or Architecture subagents.

**Escalation triggers:**
- New entity required → Recommend STORY
- Complex blocks needed → Recommend separate block workflow
- High-risk database changes → Recommend STORY

---

## When to Use

### Criteria (ANY applies)

| Criterion | Threshold |
|-----------|-----------|
| **Files affected** | 4-15 files |
| **Layers touched** | 2 (e.g., API + UI, or DB + API) |
| **New tests needed** | Some (not comprehensive) |
| **Business risk** | Low to Medium |
| **Planning needed** | Light planning required |
| **Documentation** | Minimal or none |

### Examples

| Task | T-Shirt | Why TASK |
|------|---------|--------------|
| Add field with validation to entity | S | Config + API + UI changes |
| New simple API endpoint | S-M | Route + service + tests |
| Create page builder block | M | 5 files + registry |
| Improve query performance | M | Multiple files, needs analysis |
| Feature with UI + API (no DB) | M-L | Multiple layers but no migration |
| Fix complex bug (multiple files) | M | Needs investigation + tests |

---

## When NOT to Use

**Use TWEAK instead if:**
- 1-3 files only
- No planning needed
- No new tests needed
- Zero business risk

**Use STORY instead if:**
- New database migrations required
- New entity with full CRUD
- High business risk (payments, auth, critical flows)
- More than 15 files
- Requires all validation gates
- Multiple stakeholders involved

---

## Context Awareness

**CRITICAL:** Before starting any TASK, read `.claude/config/context.json` to understand the environment.

### Scope Validation (Phase 1: REQUIREMENTS)

Include context check when creating requirements:

```typescript
const context = await Read('.claude/config/context.json')

// Document context in requirements.md
const scopeSection = `
## Task Scope

**Context:** ${context.context}
${context.context === 'consumer' ? `**Active Theme:** \${NEXT_PUBLIC_ACTIVE_THEME}` : ''}

**Allowed Paths:**
${context.allowedPaths.map(p => `- ${p}`).join('\n')}

**Forbidden:**
${context.context === 'consumer' ? '- core/**/* (read-only)\n- Other themes' : '- None in monorepo context'}
`
```

### Monorepo TASK

When context is `monorepo`:
- **CAN** modify files across multiple themes
- **CAN** add shared utilities to `core/`
- **CAN** update core dependencies
- Multi-theme changes are allowed
- Focus on reusable patterns

### Consumer TASK

When context is `consumer`:
- **RESTRICTED** to active theme only
- **CANNOT** modify other themes (even if they exist locally)
- **CANNOT** modify `core/` (read-only in node_modules)
- If multi-theme needed → Escalate to STORY with explicit approval
- If core change needed → Document as "Core Enhancement Request"

### Path Validation During Execution

```typescript
const context = await Read('.claude/config/context.json')

// Before modifying any file
for (const filePath of filesToModify) {
  const isAllowed = context.allowedPaths.some(pattern =>
    matchGlob(filePath, pattern)
  )

  if (!isAllowed) {
    if (context.context === 'consumer') {
      // Suggest alternative in theme/plugins
      suggestAlternative(filePath)
    } else {
      // In monorepo, check if core change is intentional
      confirmCoreChange(filePath)
    }
  }
}
```

### requirements.md Context Section (MANDATORY)

Always include this section in requirements.md:

```markdown
## Context Validation

**Context:** consumer
**Active Theme:** default
**Core Version:** 0.x.x (from package.json)

### Allowed Paths
- contents/themes/default/**/*
- contents/plugins/**/*
- .claude/sessions/**/*

### Forbidden
- core/**/* (read-only)
- Other themes (e.g., contents/themes/blog)

### Core Dependencies
- [ ] No core changes needed
- [ ] Core enhancement needed: [describe and document]
```

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  TASK WORKFLOW v1.0                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 0: DISCOVERY (2-5 minutes)                               │
│  ────────────────────────────────                               │
│  [MANDATORY] Claude asks all 7 questions                        │
│  ├── Task Manager? (link external task)                         │
│  ├── Database policy? (none / reset / incremental)              │
│  ├── Entity type? (none / modify / new → escalate)              │
│  ├── Blocks? (none / simple / complex → escalate)               │
│  ├── Mock? + IF YES: 5a (for), 5b (source), 5c (complexity)     │
│  ├── Testing? (existing / modify / create)                      │
│  └── Documentation? (none / update / create)                    │
│     ↓                                                           │
│  Phase 0.5: MOCK UPLOAD PAUSE [CONDITIONAL: if mock selected]   │
│  ─────────────────────────────────────────────────────────────  │
│  [IF MOCK] Create session folder with mocks/ subfolder          │
│  ├── Display upload instructions                                │
│  ├── Wait for user to confirm "ready"                           │
│  └── Validate mock files exist                                  │
│     ↓                                                           │
│  Phase 0.6: MOCK ANALYSIS [CONDITIONAL: if mock selected]       │
│  ─────────────────────────────────────────────────────────────  │
│  [IF MOCK] Run mock-analyst                                     │
│  ├── Parse HTML structure (if available)                        │
│  ├── Extract design tokens                                      │
│  ├── Generate analysis.json                                     │
│  └── Generate ds-mapping.json                                   │
│     ↓                                                           │
│  Phase 1: REQUIREMENTS                                          │
│  ─────────────────────                                          │
│  [MANDATORY] Claude creates requirements.md                     │
│  ├── Understand the task                                        │
│  ├── Define clear Acceptance Criteria (ACs)                     │
│  ├── Create task session folder                                 │
│  ├── Document discovery answers                                 │
│  └── Create requirements.md                                     │
│     ↓                                                           │
│  Phase 2: PLAN (Light)                                          │
│  ─────────────────────                                          │
│  [MANDATORY] Claude decides approach                            │
│  ├── Identify files to modify                                   │
│  ├── Define technical approach                                  │
│  └── Update requirements.md with approach                       │
│     ↓                                                           │
│  Phase 3: EXECUTE                                               │
│  ────────────────────                                           │
│  [MANDATORY] Implement changes                                  │
│  ├── Implement backend (if needed)                              │
│  ├── Implement frontend (if needed)                             │
│  ├── Use subagents ONLY when they add value                     │
│  └── Update progress.md as you go                               │
│     ↓                                                           │
│  Phase 4: VALIDATE                                              │
│  ─────────────────────                                          │
│  [MANDATORY] Verify everything works                            │
│  ├── Build passes                                               │
│  ├── Tests pass (existing + new)                                │
│  ├── ACs verified                                               │
│  └── Quick visual check                                         │
│     ↓                                                           │
│  DONE: Ready for commit                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Session Files

### Directory Structure

```
.claude/sessions/tasks/YYYY-MM-DD-task-name/
├── requirements.md    # What needs to be done + approach
├── progress.md        # Current status and checklist
└── mocks/             # [CONDITIONAL: if mock selected]
    ├── code.html      # User uploads
    ├── screen.png     # User uploads
    ├── analysis.json  # From mock-analyst
    └── ds-mapping.json # From mock-analyst
```

### requirements.md Template

```markdown
# Task: [Task Name]

**T-Shirt Size:** S/M/L
**Created:** YYYY-MM-DD
**Workflow:** TASK

---

## Discovery Answers

| Question | Answer |
|----------|--------|
| **Task Manager** | None / ClickUp: [task_id] / Jira: [task_id] |
| **Database Policy** | None / Reset allowed / Incremental only |
| **Entity Type** | None / Modify: [entity_name] |
| **Blocks** | None / Simple blocks |
| **Mock** | None / Path: [path] |
| **Mock For** | (if mock) Blocks / Screens / Components |
| **Mock Source** | (if mock) Stitch / UXPilot / Figma / Other |
| **Mock Complexity** | (if mock) Single / Multiple / Full page |
| **Testing** | Run existing / Modify existing / Create new |
| **Documentation** | None / Update existing / Create new |

---

## Objective

[Clear description of what needs to be achieved]

---

## Acceptance Criteria

- [ ] AC1: [Specific, testable criterion]
- [ ] AC2: [Specific, testable criterion]
- [ ] AC3: [Specific, testable criterion]

---

## Scope

**Files to modify:**
- `path/to/file1.ts` - [What changes]
- `path/to/file2.tsx` - [What changes]

**Files to create:** (if any)
- `path/to/new-file.ts` - [Purpose]

**Out of scope:**
- [Explicitly list what's NOT included]

---

## Technical Approach

### Summary
[1-2 sentences explaining the approach]

### Steps
1. [First step]
2. [Second step]
3. [Third step]

### Considerations
- [Any technical considerations or trade-offs]

---

## Notes

[Any additional context or decisions made]
```

### progress.md Template

```markdown
# Progress: [Task Name]

**Status:** In Progress | Blocked | Done
**Last Updated:** YYYY-MM-DD HH:MM

---

## Checklist

### Setup
- [ ] Requirements reviewed
- [ ] Approach defined
- [ ] Session created

### Implementation
- [ ] Backend changes (if applicable)
- [ ] Frontend changes (if applicable)
- [ ] Tests updated/created

### Validation
- [ ] Build passes
- [ ] Tests pass
- [ ] ACs verified
- [ ] Visual check done

---

## Current Focus

[What you're working on right now]

---

## Blockers

[Any blockers or issues encountered]

---

## Changes Made

| File | Change | Status |
|------|--------|--------|
| `path/to/file.ts` | [Description] | Done |

```

---

## Detailed Phase Descriptions

### Phase 1: REQUIREMENTS

**Duration:** 5-15 minutes
**Goal:** Clearly define what needs to be done

```
[MANDATORY] Requirements Steps:

1. Understand the task
   - Read user's description carefully
   - Ask clarifying questions if needed
   - Identify the core problem/feature

2. Define Acceptance Criteria (ACs)
   - Each AC must be specific and testable
   - Use "User can..." or "System should..." format
   - 3-5 ACs is typical for TASK

3. Create session folder
   - Use command or manually create:
     .claude/sessions/tasks/YYYY-MM-DD-task-name/

4. Write requirements.md
   - Use the template above
   - Don't skip the "Out of scope" section
```

**Tips for good ACs:**
- ✓ "User can filter products by category"
- ✓ "API returns 400 for invalid input"
- ✗ "Make it work better" (too vague)
- ✗ "Fix the thing" (not specific)

---

### Phase 2: PLAN (Light)

**Duration:** 5-15 minutes
**Goal:** Decide HOW to implement (but don't over-plan)

```
[MANDATORY] Planning Steps:

1. Identify affected files
   - Use Grep/Glob to find relevant code
   - List all files that need changes
   - If > 15 files → Consider STORY

2. Define technical approach
   - What's the simplest solution?
   - Are there existing patterns to follow?
   - Any dependencies or order of operations?

3. Consider risks
   - What could go wrong?
   - Are there edge cases?
   - Need rollback plan?

4. Update requirements.md
   - Add "Technical Approach" section
   - Add "Scope" section with file list
```

**Light vs Full Planning:**

| Aspect | TASK (Light) | STORY (Full) |
|--------|------------------|-----------------|
| Plan document | Section in requirements.md | Separate plan.md |
| Scope file | Listed in requirements.md | scope.json |
| Phases | Not enumerated | 14 phases defined |
| PM Decisions | Not needed | Required |
| Architecture review | Informal | Formal (arch-supervisor) |

---

### Phase 3: EXECUTE

**Duration:** 15-60 minutes
**Goal:** Implement the changes

```
[MANDATORY] Execution Guidelines:

1. Follow the order
   - Backend before frontend (if both)
   - Core logic before UI
   - Tests alongside or after (not TDD required)

2. Use subagents SELECTIVELY
   - Only call subagent if complex enough
   - For simple changes, do it yourself
   - Max 2-3 subagent calls typical

3. Update progress as you go
   - Mark checklist items
   - Note any issues in "Blockers"
   - Track files changed

4. Stay in scope
   - Stick to defined ACs
   - Don't add "nice to haves"
   - Note additional improvements for later
```

#### When to Use Subagents

| Situation | Use Subagent? | Which One |
|-----------|---------------|-----------|
| Simple API endpoint | No | Do it yourself |
| Complex API with auth | Yes | `backend-developer` |
| Simple UI form | No | Do it yourself |
| Complex UI with state | Yes | `frontend-developer` |
| Adding a test | No | Do it yourself |
| Full test suite | Yes | `qa-automation` |
| Fix build error | Maybe | `fix:build` command |

#### Subagent Invocation Pattern

```
When calling a subagent in TASK:

1. Provide context
   - "I'm working on [task] in TASK workflow"
   - "The session is at tasks/YYYY-MM-DD-name"
   - "Please implement [specific thing]"

2. Be specific
   - Don't say "implement the feature"
   - Say "create POST /api/products endpoint with validation"

3. Define acceptance
   - "It should pass these tests..."
   - "It should handle these cases..."
```

---

### Phase 4: VALIDATE

**Duration:** 5-15 minutes
**Goal:** Ensure quality before commit

```
[MANDATORY] Validation Checklist:

□ TypeScript compiles
  Command: pnpm tsc --noEmit

□ Build passes
  Command: pnpm build

□ Lint passes
  Command: pnpm lint

□ Tests pass
  Command: pnpm test (or specific pattern)
  - Existing tests still work
  - New tests pass (if created)

□ ACs verified
  - Go through each AC in requirements.md
  - Mark as checked or unchecked
  - If AC not met → Fix before continuing

□ Visual verification (if UI)
  - Start dev server
  - Navigate to affected pages
  - Test happy path
  - Test one edge case
```

**If Validation Fails:**

```
Failure Type          │  Action
──────────────────────┼────────────────────────────────
Build error           │  Fix immediately
Test failure          │  Fix test or implementation
AC not met            │  Implement missing part
Visual bug            │  Fix UI issue
Performance issue     │  Note for future, or fix if critical
```

---

## Commands

### Start TASK workflow

```bash
# Explicit TASK
/session:start:task Improve product search performance

# Automatic detection (Claude evaluates)
/start Improve product search performance
```

### Key commands for TASK

| Command | Phase | Purpose |
|---------|-------|---------|
| `/session:execute` | 3 | Execute implementation |
| `/session:validate` | 4 | Run validation checks |
| `/session:status` | Any | Check progress |
| `/session:commit` | End | Prepare commit |

### Related fix commands

| Command | When to use |
|---------|-------------|
| `/session:fix:bug` | Fix bug found during validation |
| `/session:fix:build` | Fix build errors |
| `/session:fix:test` | Fix failing tests |

---

## Skills Reference

For TASK workflow, consult these skills based on task type:

| Task Type | Required Skills |
|-----------|-----------------|
| **API work** | `nextjs-api-development`, `entity-api` |
| **Entity changes** | `entity-system` |
| **UI components** | `react-patterns`, `shadcn-components` |
| **Translations** | `i18n-nextintl` |
| **Validation** | `zod-validation` |
| **Testing** | `cypress-api`, `jest-unit` |
| **Page builder** | `page-builder-blocks` |

**[MANDATORY]** Always check `core-theme-responsibilities` skill when making architecture decisions.

---

## Characteristics Summary

| Aspect | TASK Workflow |
|--------|-------------------|
| **Session files** | 2 (requirements.md, progress.md) |
| **Subagents** | Selective (0-3 calls) |
| **Planning** | Light (in requirements.md) |
| **Requirements doc** | Created |
| **Tests** | Some new (as needed) |
| **Code review** | Self-review |
| **Documentation** | Not required |
| **Typical duration** | 30-120 minutes |
| **Token estimate** | 50-200k |

---

## Comparison: TASK vs STORY

```
                        TASK              STORY
────────────────────────────────────────────────────────────
Phases                  4 informal            14 formal
Session files           2                     8+
Subagents              0-3 selective         8-10 specialized
Gates                   0 formal              4 mandatory
Planning               requirements.md       plan.md + scope.json
PM Decisions           Not needed            Required
DB Migrations          Not supported         Full support
Documentation          Optional              Conditional
Task Manager           Optional              Integrated
Duration               30-120 min            1-5 hours
Tokens                 50-200k               120-350k
```

---

## Escalation to STORY

### Signs you need STORY

1. **Database changes required**
   - Any new tables
   - Schema modifications
   - Migrations needed

2. **Scope growing**
   - Started as "simple" but keeps expanding
   - More than 15 files affected
   - Multiple developers would be needed

3. **Risk increasing**
   - Touches payments/auth
   - Affects multiple user flows
   - Business stakeholder concerns

4. **Quality requirements**
   - Full test coverage needed
   - Documentation required
   - Formal code review needed

### How to escalate

```
1. Pause TASK execution
2. Move task folder:
   mv tasks/YYYY-MM-DD-name stories/YYYY-MM-DD-name
3. Start STORY workflow:
   /session:start:story [description]
4. PM will ask about:
   - Task Manager integration
   - Database policy
   - Testing requirements
   - Documentation needs
```

---

## Examples

### Example 1: Add Field to Entity (S)

```
User: Add "phone" field to user profile

Claude's process:

Phase 1: REQUIREMENTS (5 min)
├── AC1: User can enter phone in profile form
├── AC2: Phone is saved to database
├── AC3: Phone displays in profile view
└── Create tasks/2026-01-12-add-phone-field/

Phase 2: PLAN (5 min)
├── Files: config, schema, form, view = 4 files
├── Approach: Add optional field, no validation
└── No risks identified

Phase 3: EXECUTE (20 min)
├── Update user.config.ts
├── Update user.schema.ts
├── Update ProfileForm.tsx
├── Update ProfileView.tsx
└── No subagents needed (simple changes)

Phase 4: VALIDATE (5 min)
├── pnpm build ✓
├── pnpm test ✓
├── ACs checked ✓
└── Visual verification ✓

Result: Ready for commit in ~35 minutes
```

### Example 2: New API Endpoint (M)

```
User: Create endpoint to export products as CSV

Claude's process:

Phase 1: REQUIREMENTS (10 min)
├── AC1: GET /api/v1/products/export returns CSV
├── AC2: Supports filtering by date range
├── AC3: Requires authentication
├── AC4: Returns proper headers for download
└── Create tasks/2026-01-12-products-export/

Phase 2: PLAN (10 min)
├── Files: route, service util, test = 3 files
├── Approach: New route, use existing ProductsService
├── Dependencies: csv-stringify package exists
└── Risk: Large data sets → add pagination

Phase 3: EXECUTE (40 min)
├── Create app/api/v1/products/export/route.ts
├── Add exportToCsv() to ProductsService
├── Call backend-developer for complex auth logic
├── Create API test
└── Update progress.md

Phase 4: VALIDATE (10 min)
├── pnpm build ✓
├── pnpm test ✓
├── Test with Postman ✓
├── All ACs verified ✓

Result: Ready for commit in ~70 minutes
```

### Example 3: Page Builder Block (M)

```
User: Create FAQ accordion block

Claude's process:

Phase 1: REQUIREMENTS (10 min)
├── AC1: Block appears in block selector
├── AC2: Admin can add Q&A items
├── AC3: Accordion expands/collapses on click
├── AC4: Accessible (ARIA attributes)
└── Create tasks/2026-01-12-faq-block/

Phase 2: PLAN (10 min)
├── Files: 5 block files + registry rebuild
├── Approach: Follow existing block patterns
├── Reference: Use testimonials block as template
└── Skills needed: page-builder-blocks

Phase 3: EXECUTE (45 min)
├── Read page-builder-blocks skill
├── Create blocks/faq/config.ts
├── Create blocks/faq/schema.ts
├── Create blocks/faq/fields.ts
├── Create blocks/faq/component.tsx
├── Create blocks/faq/index.ts
├── Run pnpm build:blocks
└── No subagent needed (following pattern)

Phase 4: VALIDATE (10 min)
├── pnpm build ✓
├── Registry shows new block ✓
├── Preview works in DevTools ✓
├── Accordion functionality ✓

Result: Ready for commit in ~75 minutes
```

---

## Anti-Patterns

### What TASK is NOT for

| Anti-Pattern | Why It's Wrong |
|--------------|----------------|
| "Quick" DB migration | DB needs STORY workflow |
| "Simple" new entity | Entities need full CRUD planning |
| "Fast" auth changes | Auth is always high risk |
| Skipping requirements | Leads to scope creep |
| Over-planning | You're not in STORY |

### Signs You're Using TASK Wrong

1. **No requirements.md created** → You're doing TWEAK
2. **Writing plan.md** → You might need STORY
3. **Calling 5+ subagents** → Escalate to STORY
4. **Session taking 3+ hours** → Wrong workflow
5. **Creating migrations** → Must use STORY

---

## Task Manager Integration (Optional)

TASK can optionally link to task managers:

```markdown
# In requirements.md

## Task Reference

**ClickUp:** https://app.clickup.com/t/abc123
**Status:** In Progress
```

For full task manager integration with sync, use STORY workflow.

---

## Related Documentation

- `workflows/tweak.md` - For simple adjustments
- `workflows/story.md` - For complex features
- `commands/session-start.md` - Start command
- `commands/session-execute.md` - Execution details
- `skills/README.md` - All available skills

---

## Version History

| Version | Changes |
|---------|---------|
| v1.0 | Initial English version with comprehensive detail |
