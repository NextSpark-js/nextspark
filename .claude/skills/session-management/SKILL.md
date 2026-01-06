---
name: session-management
description: |
  Session management for Claude Code workflow in this application.
  Covers the 8 session files, templates, progress tracking, scope enforcement, and agent coordination.
  Use this skill when creating or managing development sessions.
allowed-tools: Read, Glob, Grep, Bash
version: 1.0.0
---

# Session Management Skill

Patterns for managing Claude Code development sessions with the 19-phase workflow.

## Architecture Overview

```
SESSION MANAGEMENT:

Session Folder Structure:
.claude/sessions/{YYYY-MM-DD-feature-name-v1}/
├── requirements.md     # Business requirements and ACs
├── clickup_task.md     # ClickUp task details (or LOCAL_ONLY)
├── scope.json          # File modification permissions
├── plan.md             # Technical implementation plan
├── progress.md         # Phase progress tracking
├── context.md          # Agent communication log
├── tests.md            # Test documentation and selectors
└── pendings.md         # Items for future iterations

Templates Location:
.claude/tools/sessions/templates/
├── requirements.md
├── clickup_task.md
├── scope.json
├── plan.md
├── progress.md
├── context.md
├── tests.md
└── pendings.md

Workflow Configuration:
.claude/config/workflow.md   # 19-phase workflow definition
```

## When to Use This Skill

- Creating new development sessions
- Understanding session file structure
- Tracking development progress
- Managing agent coordination
- Enforcing scope permissions
- Documenting test results

## Session Naming Convention

```
{YYYY-MM-DD}-{feature-name}-v{N}

Examples:
- 2025-12-30-scheduled-actions-v1
- 2025-12-20-subscriptions-system-v1
- 2025-12-15-user-authentication-v2
```

## The 8 Session Files

### 1. requirements.md

Business requirements gathered by `product-manager` agent.

```markdown
# Feature Requirements: [Feature Name]

**Session:** `.claude/sessions/YYYY-MM-DD-feature-name-v1/`
**Created:** YYYY-MM-DD
**Created By:** User (with assistant help)
**Version:** v1

---

## Business Context

### Problem Statement
[What problem does this feature solve?]

### Target Users
[Who will use this feature?]

### Business Value
[Why is this important?]

---

## User Stories

### Primary User Story
**As a** [user type]
**I want** [goal/action]
**So that** [benefit/value]

---

## Acceptance Criteria (DETAILED)

### AC1: [Title]
**Given** [precondition]
**When** [action]
**Then** [expected result]

**Details:**
- [Specific behavior]

**Validation:**
- [How to verify]

---

## Technical Flags

| Flag | Value | Description |
|------|-------|-------------|
| **Requires New Selectors** | `yes` / `no` / `tbd` | New data-cy selectors needed? |
| **Selector Impact** | `new-components` / `modify-existing` / `backend-only` | Type of UI changes |

---

## Approval

- [ ] Requirements reviewed by user
- [ ] Questions clarified
- [ ] Technical Flags set
- [ ] Ready for technical planning
```

### 2. clickup_task.md

ClickUp task details (or LOCAL_ONLY mode).

```markdown
# ClickUp Task: [Feature Name]

**Task ID:** [TASK_ID] or "LOCAL_ONLY"
**List:** [List Name]
**Status:** [todo/in_progress/qa/done]
**Assignee:** [User Name]
**Priority:** [normal/high/urgent/low]
**Due Date:** [YYYY-MM-DD] or "None"

---

## Task Description
[Business description from ClickUp]

---

## Acceptance Criteria
[From requirements.md]

---

## Notes
[Additional context]
```

### 3. scope.json

Defines what files agents can modify.

```json
{
  "$schema": "Session Scope Configuration",
  "definedBy": "product-manager",
  "date": "YYYY-MM-DD",
  "scope": {
    "core": false,
    "theme": "default",
    "plugins": false
  },
  "exceptions": []
}
```

#### Scope Rules

| Scope | Paths Allowed |
|-------|---------------|
| `core: true` | `core/**/*`, `app/**/*`, `scripts/**/*`, `migrations/**/*` |
| `theme: "name"` | `contents/themes/{name}/**/*` |
| `plugins: ["name"]` | `contents/plugins/{name}/**/*` |

#### Common Scope Patterns

```json
// Feature in existing theme
{
  "scope": {
    "core": false,
    "theme": "default",
    "plugins": false
  }
}

// New plugin development
{
  "scope": {
    "core": false,
    "theme": "plugin-sandbox",
    "plugins": ["my-new-plugin"]
  }
}

// Core framework change
{
  "scope": {
    "core": true,
    "theme": false,
    "plugins": false
  }
}

// Full access (rare)
{
  "scope": {
    "core": true,
    "theme": "default",
    "plugins": ["analytics", "payment"]
  }
}
```

### 4. plan.md

Technical implementation plan created by `architecture-supervisor`.

```markdown
# Technical Plan: [Feature Name]

**Session:** `.claude/sessions/YYYY-MM-DD-feature-name-v1/`
**Created:** YYYY-MM-DD by architecture-supervisor
**Based on:** requirements.md, clickup_task.md

---

## Overview
[Technical summary of what will be implemented]

---

## Scope Analysis
- **Core:** [Modifications needed]
- **Theme:** [Theme-specific work]
- **Plugins:** [Plugin work]

---

## Implementation Phases

### Phase 1: Database (db-developer)
- [ ] Create migration: `migrations/0XX_feature.sql`
- [ ] Add sample data

### Phase 2: Backend (backend-developer)
- [ ] Create API endpoint
- [ ] Implement validation
- [ ] Add tests

### Phase 3: Frontend (frontend-developer)
- [ ] Create components
- [ ] Add translations
- [ ] Add data-cy selectors

---

## Files to Create/Modify
[List of files with descriptions]

---

## Dependencies
[External dependencies or blockers]

---

## Testing Strategy
[How this will be tested]
```

### 5. progress.md

Tracks development progress through the 19 phases.

```markdown
# Progress: [Feature Name]

**Session:** `.claude/sessions/YYYY-MM-DD-feature-name-v1/`
**ClickUp Task:** [TASK_ID]
**Started:** [YYYY-MM-DD]
**Last Updated:** [YYYY-MM-DD HH:MM]

---

## IMPORTANT: This file replaces ClickUp checklists

- All progress is tracked HERE (NOT in ClickUp)
- Developers mark items with `[x]` as they complete them
- Gates are automatically updated by validator agents

---

## PM Decisions (Phase 1)

**Theme:** [x] Existing theme: `default` / [ ] New theme
**DB Policy:** [x] Reset allowed / [ ] Incremental migrations
**Requires Blocks:** [x] No / [ ] Yes

---

## General Status

**Current Status:** [Planning/Foundation/Backend/Frontend/QA/Finalization/Done]
**Completed:** [X]% ([Y] of [Z] items)

---

## Gates Status

| Gate | Phase | Status | Last Check |
|------|-------|--------|------------|
| theme-validator | 4 | [ ] SKIP / [ ] PASS / [ ] FAIL | - |
| db-validator | 6 | [ ] PENDING / [ ] PASS / [ ] FAIL | - |
| backend-validator | 8 | [ ] PENDING / [ ] PASS / [ ] FAIL | - |
| api-tester | 9 | [ ] PENDING / [ ] PASS / [ ] FAIL | - |
| frontend-validator | 12 | [ ] PENDING / [ ] PASS / [ ] FAIL | - |
| functional-validator | 13 | [ ] PENDING / [ ] PASS / [ ] FAIL | - |
| qa-manual | 14 | [ ] PENDING / [ ] PASS / [ ] FAIL | - |
| qa-automation | 15 | [ ] PENDING / [ ] PASS / [ ] FAIL | - |

---

## Phase Progress

### BLOCK 1: PLANNING
- [x] Phase 1: product-manager - Requirements gathered
- [x] Phase 2: architecture-supervisor - Plan created

### BLOCK 2: FOUNDATION
- [ ] Phase 3: theme-creator [CONDITIONAL]
- [ ] Phase 4: theme-validator [GATE]
- [ ] Phase 5: db-developer - Migrations
- [ ] Phase 6: db-validator [GATE]

### BLOCK 3: BACKEND
- [ ] Phase 7: backend-developer - API implementation
- [ ] Phase 8: backend-validator [GATE]
- [ ] Phase 9: api-tester [GATE]

### BLOCK 4: BLOCKS [CONDITIONAL]
- [ ] Phase 10: block-developer

### BLOCK 5: FRONTEND
- [ ] Phase 11: frontend-developer - UI components
- [ ] Phase 12: frontend-validator [GATE]
- [ ] Phase 13: functional-validator [GATE]

### BLOCK 6: QA
- [ ] Phase 14: qa-manual [GATE + RETRY]
- [ ] Phase 15: qa-automation [GATE]
- [ ] Phase 15.5: bdd-docs-writer

### BLOCK 7: FINALIZATION
- [ ] Phase 16: code-reviewer
- [ ] Phase 17: unit-test-writer
- [ ] Phase 18: documentation-writer [OPTIONAL]
- [ ] Phase 19: demo-video-generator [OPTIONAL]
```

### 6. context.md

Agent communication and coordination log.

```markdown
# Context & Coordination: [Feature Name]

**Session:** `.claude/sessions/YYYY-MM-DD-feature-name-v1/`

---

## Purpose

This file serves as the **communication nexus between agents**. Each agent
that completes work MUST add an entry with:

1. Agent name
2. Date and time
3. Work summary
4. Status (Completed / With pending items / Blocked)
5. Notes for next agent

---

## Valid States

- **Completed:** Task completed, next agent can proceed
- **Completed with pending items:** Completed with non-blocking improvements
- **Blocked:** Cannot proceed, next agent must wait

---

## Coordination Log

### [YYYY-MM-DD HH:MM] - product-manager

**Status:** Completed

**Work Performed:**
- Created ClickUp task (ID: [TASK_ID])
- Defined acceptance criteria
- Created session folder

**Next Step:**
- architecture-supervisor must read requirements and create plan

---

### [YYYY-MM-DD HH:MM] - architecture-supervisor

**Status:** Completed

**Work Performed:**
- Read requirements.md and clickup_task.md
- Created technical plan in plan.md
- Created progress.md template
- Created tests.md and pendings.md

**Technical Decisions:**
- [Decision #1 and reason]

**Next Step:**
- db-developer can begin Phase 5

---

### [YYYY-MM-DD HH:MM] - [next-agent]
...
```

### 7. tests.md

Test documentation, selectors, and coverage reports.

```markdown
# Test Documentation: [Feature Name]

**Session:** `.claude/sessions/YYYY-MM-DD-feature-name-v1/`
**Last Updated:** [YYYY-MM-DD HH:MM]

---

## Test Results Summary

| Category | Passed | Failed | Coverage |
|----------|--------|--------|----------|
| API Tests | X | 0 | 100% |
| UAT Tests | Y | 0 | 100% |
| Unit Tests | Z | 0 | 85% |

---

## Data-cy Selectors

### Component: [ComponentName]

| Selector | Element | Purpose |
|----------|---------|---------|
| `feature-form` | `<form>` | Main form container |
| `feature-name-input` | `<input>` | Name input field |
| `feature-submit-btn` | `<button>` | Submit button |

---

## Test Files

### API Tests
- `cypress/e2e/api/feature.cy.ts` - [X] tests

### UAT Tests
- `cypress/e2e/uat/feature.cy.ts` - [X] tests

### Unit Tests
- `core/tests/jest/feature.test.ts` - [X] tests

---

## AC Coverage Report

| AC | Test Type | Test File | Status |
|----|-----------|-----------|--------|
| AC1 | UAT | `feature.cy.ts:15` | Pass |
| AC2 | API | `feature-api.cy.ts:30` | Pass |
| AC3 | UAT | `feature.cy.ts:45` | Pass |
```

### 8. pendings.md

Items discovered during development for future iterations.

```markdown
# Pending Items: [Feature Name]

**Session:** `.claude/sessions/YYYY-MM-DD-feature-name-v1/`
**Last Updated:** [YYYY-MM-DD HH:MM]

---

## Purpose

Document items discovered during development that are:
- Out of scope for current iteration
- Nice-to-have improvements
- Technical debt to address later
- Ideas for v2

---

## Pending Items

### P1: [Title]
**Discovered by:** [agent-name]
**Date:** [YYYY-MM-DD]
**Priority:** [high/medium/low]

**Description:**
[What needs to be done]

**Reason for deferral:**
[Why it's not in current scope]

---

### P2: [Title]
...
```

## Creating a New Session

### Manual Creation

```bash
# Create session folder
mkdir -p .claude/sessions/2025-12-30-feature-name-v1

# Copy templates
cp .claude/tools/sessions/templates/* .claude/sessions/2025-12-30-feature-name-v1/
```

### Using Script

```bash
# Run the create-session script
python .claude/skills/session-management/scripts/create-session.py \
  --name "feature-name" \
  --version 1
```

## Session Workflow Integration

```
USER REQUEST
    |
/task:requirements (Phase 1)
    | Creates: requirements.md, clickup_task.md, scope.json
/task:plan (Phase 2)
    | Creates: plan.md, progress.md, context.md, tests.md, pendings.md
/task:execute (Phases 3-19)
    | Updates: progress.md, context.md, tests.md
FEATURE COMPLETE
```

## Progress Tracking Rules

1. **Developers update progress.md** as they complete items
2. **Gates update their status** after validation
3. **context.md** is updated by each agent after completing work
4. **tests.md** is updated with selectors and results
5. **pendings.md** captures out-of-scope items

## Agent Coordination Pattern

```markdown
### [2025-12-30 14:30] - backend-developer

**Status:** Completed

**Work Performed:**
- Created migration: `migrations/017_feature.sql`
- Implemented API endpoints: POST, GET, PATCH, DELETE
- Build validated: `pnpm build` Pass

**Progress:**
- Marked 8 of 10 items in progress.md (Phase 7)

**Next Step:**
- backend-validator can begin Phase 8 validation

**Notes:**
- API key auth working correctly
- Consider adding pagination in v2
```

## Anti-Patterns

```markdown
# NEVER: Skip updating context.md
# Each agent MUST log their work

# NEVER: Modify files outside scope.json
# Check scope before editing

# NEVER: Skip gate validation
# Gates must pass before proceeding

# NEVER: Forget to update progress.md
# Mark items as you complete them

# NEVER: Put code changes in pendings.md
# Only document items, don't implement

# NEVER: Create duplicate sessions
# Use version numbers (v1, v2, v3)
```

## Checklist

Before starting session work:

- [ ] Session folder created with correct naming
- [ ] All 8 template files copied
- [ ] scope.json configured correctly
- [ ] requirements.md filled with ACs
- [ ] plan.md created by architecture-supervisor
- [ ] progress.md initialized
- [ ] context.md has first entry from product-manager

During session work:

- [ ] Update progress.md after completing items
- [ ] Add entry to context.md after each phase
- [ ] Document selectors in tests.md
- [ ] Add out-of-scope items to pendings.md
- [ ] Respect scope.json file restrictions

## Related Skills

- `scope-enforcement` - Scope validation
- `cypress-selectors` - Selector documentation
- `pom-patterns` - Test patterns for tests.md
- `documentation` - Session documentation patterns
