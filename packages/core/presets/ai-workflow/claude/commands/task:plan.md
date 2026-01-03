---
description: "[Step 2] Create ClickUp task (optional) and technical plan using PM + Architect"
---

# Task Planning - PM + Architect Phase

You are creating the technical plan for a feature that has requirements already defined.

**Session or Feature:**
{{{ input }}}

---

## Your Mission

Execute a **two-phase planning process**:

1. **Phase 1 (Product Manager):** Create ClickUp task (optional) and business context
2. **Phase 2 (Architecture Supervisor):** Create detailed technical plan

---

## Pre-Flight Check

**Before starting, verify requirements exist:**

```typescript
// Check if input is a session path or feature description
if (input.startsWith('.claude/sessions/')) {
  // Session path provided - read existing requirements
  await Read(`${input}/requirements.md`)
} else {
  // Feature description provided - prompt user
  console.log("No requirements file found. Run /task:requirements first, or provide session path.")
  return
}
```

---

## Phase 0: ClickUp Decision

**Ask user if they want ClickUp integration:**

```typescript
await AskUserQuestion({
  questions: [
    {
      header: "ClickUp",
      question: "Do you want to create a ClickUp task for this feature?",
      options: [
        { label: "Yes - Create ClickUp task", description: "Task will be synced to ClickUp with status updates" },
        { label: "No - Local only", description: "Track everything locally in session files only" }
      ],
      multiSelect: false
    }
  ]
})
```

---

## Phase 0.5: Feature Branch Decision

**Ask user about feature branch:**

```typescript
await AskUserQuestion({
  questions: [
    {
      header: "Branch",
      question: "Do you want to create a feature branch?",
      options: [
        { label: "Yes - Create branch", description: "Create feature/YYYY-MM-DD-feature-name branch" },
        { label: "No - Use current branch", description: "Continue on current branch" }
      ],
      multiSelect: false
    }
  ]
})

if (createBranch) {
  const branchName = `feature/${sessionFolder}` // e.g., feature/2025-12-11-product-grid-v1
  await Bash({ command: `git checkout -b ${branchName}` })
}
```

---

## Phase 1: Product Manager - Business Context

**Launch the `product-manager` agent:**

### Product Manager Must:

1. **Read Requirements:**
   ```typescript
   await Read(`${sessionPath}/requirements.md`)
   ```

2. **Create ClickUp Task (if enabled):**
   - Use template from `.claude/tools/clickup/templates/task.md`
   - Write description in SPANISH
   - Include: Contexto (business context), Criterios de Aceptación (numbered list)
   - Set status: `backlog`
   - Assign to: User defined in `.claude/config/agents.json` (see **User:** line)

3. **Create/Update Session Files:**
   ```
   .claude/sessions/YYYY-MM-DD-feature-name-v1/
   ├── requirements.md          # Already exists from task:requirements
   ├── clickup_task.md          # Create - ClickUp metadata OR LOCAL_ONLY
   └── context.md               # Create - Coordination log
   ```

4. **clickup_task.md Content:**
   ```markdown
   # ClickUp Task: [Feature Name]

   **Session:** `.claude/sessions/YYYY-MM-DD-feature-name-v1/`
   **Version:** v1

   ## ClickUp Integration
   **Mode:** [ENABLED / LOCAL_ONLY]
   **Task ID:** [TASK_ID or "LOCAL_ONLY"]
   **Task URL:** [URL or "N/A - Local Only"]

   ## Contexto de Negocio
   [From requirements.md - in Spanish]

   ## Criterios de Aceptación
   1. [AC1]
   2. [AC2]
   3. [AC3]
   ```

5. **Update context.md:**
   - Add PM entry with timestamp
   - Status: ✅ Completado
   - Handoff to architecture-supervisor

---

## Phase 2: Architecture Supervisor - Technical Plan

**After PM completes, launch the `architecture-supervisor` agent:**

### Architecture Supervisor Must:

1. **Read All Session Files:**
   ```typescript
   await Read(`${sessionPath}/requirements.md`)
   await Read(`${sessionPath}/clickup_task.md`)
   await Read(`${sessionPath}/context.md`)
   ```

2. **Check for Previous Versions:**
   ```typescript
   // If this is v2+, read previous session
   if (version > 1) {
     const prevSession = sessionPath.replace(`-v${version}`, `-v${version-1}`)
     await Read(`${prevSession}/pendings.md`)  // Inherited pending items
     await Read(`${prevSession}/context.md`)   // Previous decisions
   }
   ```

3. **Create Technical Plan (plan.md):**
   - Use template from `.claude/tools/sessions/templates/plan.md`
   - Include version references if v2+
   - Include all 8 phases:
     - Fase 1: Backend (backend-developer)
     - Fase 2: Frontend (frontend-developer)
     - Fase 3: Integration
     - Fase 4: Frontend Validation (frontend-validator)
     - Fase 5: Functional Validation (functional-validator)
     - Fase 6: QA Automation (qa-automation)
     - Fase 7: Code Review (code-reviewer)
     - Fase 8: Unit Testing (unit-test-writer)

4. **Create Progress Template (progress.md):**
   - Use template from `.claude/tools/sessions/templates/progress.md`
   - Pre-populate ALL checkboxes for all 8 phases

5. **Create Empty Session Files:**
   ```typescript
   // Create tests.md (empty, frontend-validator will populate)
   await Write({
     file_path: `${sessionPath}/tests.md`,
     content: testsTemplate
   })

   // Create pendings.md (empty, populated if issues found)
   await Write({
     file_path: `${sessionPath}/pendings.md`,
     content: pendingsTemplate
   })
   ```

6. **Update context.md:**
   - Add Architect entry with timestamp
   - Status: ✅ Completado
   - Technical decisions made
   - Handoff to developers

7. **NO ClickUp Writes:**
   - Architecture Supervisor does NOT update ClickUp
   - All planning stays in session files only

---

## Session Folder Structure

After both phases complete:

```
.claude/sessions/YYYY-MM-DD-feature-name-v1/
├── requirements.md      # From task:requirements
├── clickup_task.md      # PM created - Business context + ACs
├── scope.json           # PM created - Session scope definition
├── plan.md              # AR created - Technical plan (8 phases)
├── progress.md          # AR created - Progress tracking
├── context.md           # Both updated - Coordination log
├── tests.md             # AR created (empty) - For frontend-validator
└── pendings.md          # AR created (empty) - For pending items
```

**Templates location:** `.claude/tools/sessions/templates/`

---

## Version System

**If this is v2 or higher:**

1. **Read previous session's pendings.md:**
   - List pending items that should be addressed
   - Include recommendations from previous iteration

2. **Reference in plan.md:**
   ```markdown
   ## Referencias a Sesiones Anteriores

   **Versión Actual:** v2
   **Sesión Previa:** `2025-12-10-feature-name-v1`

   **Pendientes Heredados de v1:**
   - P1: [Pending item from v1]
   - P2: [Another pending item]

   **Contexto Relevante de v1:**
   - [Technical decisions that affect v2]
   - [Issues found that need resolution]
   ```

3. **Include in technical plan:**
   - Address pending items from previous version
   - Build on existing architecture decisions
   - Avoid repeating past mistakes

---

## Execution Instructions

```typescript
// Phase 0: Ask about ClickUp
const useClickUp = await askClickUpDecision()
const createBranch = await askBranchDecision()

// Phase 1: Launch Product Manager
await launchAgent('product-manager', {
  task: `Create business context for session: ${sessionPath}`,
  requirements: [
    'Read requirements.md',
    useClickUp ? 'Create ClickUp task' : 'Mark as LOCAL_ONLY',
    'Create clickup_task.md with business context',
    'Create context.md with PM entry',
    'Handoff to architecture-supervisor'
  ]
})

// Phase 2: Launch Architecture Supervisor
await launchAgent('architecture-supervisor', {
  task: `Create technical plan for session: ${sessionPath}`,
  requirements: [
    'Read all session files',
    'Check for previous versions (if v2+)',
    'Create comprehensive plan.md with 8 phases',
    'Create progress.md with all checkboxes',
    'Create empty tests.md and pendings.md',
    'Update context.md with architect entry',
    'NO ClickUp writes - session files only',
    'Handoff to developers'
  ]
})
```

---

## Output Format

```markdown
## Planning Complete

**Session:** `.claude/sessions/YYYY-MM-DD-feature-name-v1/`
**ClickUp:** [ENABLED - Task ID: xxx / LOCAL_ONLY]
**Branch:** [feature/YYYY-MM-DD-feature-name-v1 / current branch]

### Files Created
- `clickup_task.md` - Business context + ACs
- `scope.json` - Session scope definition
- `plan.md` - Technical plan (8 phases)
- `progress.md` - Progress tracking
- `context.md` - Coordination log
- `tests.md` - For frontend-validator (empty)
- `pendings.md` - For pending items (empty)

### Technical Summary
- **Complexity:** [Simple / Medium / Complex]
- **Phases:** 8 (Backend → Frontend → Integration → Validation → QA → Review → Unit Tests)
- **Key Decisions:** [List key technical decisions]

### Next Step
Run `/task:execute` to begin the 8-phase development workflow.
```

---

## Quality Checklist

Before considering planning complete:

- [ ] Requirements.md exists and was read
- [ ] ClickUp decision made (ENABLED or LOCAL_ONLY)
- [ ] scope.json created with correct scope definition
- [ ] All 8 session files created
- [ ] Technical plan includes all 8 phases
- [ ] Progress template has checkboxes for all phases
- [ ] Context file has entries from PM and AR
- [ ] Feature branch created (if requested)
- [ ] Previous version referenced (if v2+)

---

**Now execute the two-phase planning process for the session described above.**
