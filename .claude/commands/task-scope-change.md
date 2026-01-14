---
description: "Handle scope changes during development - Update ClickUp task and trigger code review"
---

# Scope Change - Mid-Development Requirement Changes

You are handling a scope change for a feature that is **already in development**.

**Session Path and Scope Change Request:**
{{{ input }}}

---

## Your Mission

Handle scope changes for sessions where **development has already begun**. This requires:

1. **Deep analysis** of requested changes vs current progress
2. **Identify rework** that may be needed
3. **Clarify ambiguities** with the user before proceeding
4. **Update documents** using PM and Architect agents
5. **Document impact** on existing work

**Key Difference from task:refine:**
- `task:refine` - Session NOT started (planning phase only)
- `task:scope-change` - Session IN PROGRESS (development has begun)

---

## Process Overview

```
1. Detect session path and verify development has started
2. Read ALL session files including progress
3. Analyze scope change request vs current progress
4. Identify rework implications
5. Ask user to clarify ambiguities and confirm rework
6. Launch PM + Architect agents to update documents
7. Update progress.md to mark affected items for rework
8. Trigger code review if significant code exists
```

---

## Step 1: Verify Session is In Progress

```typescript
const sessionPath = extractSessionPath(input)

// Read progress to verify development has started
const progress = await Read(`${sessionPath}/progress.md`)

// Check for completed development items (not just planning)
const developmentPhases = [
  'Phase 5: DB Developer',
  'Phase 7: Backend Developer',
  'Phase 10: Block Developer',
  'Phase 11: Frontend Developer'
]

const hasStartedDevelopment = developmentPhases.some(phase => {
  const phaseSection = extractSection(progress, phase)
  return phaseSection.includes('[x]') // Has completed items
})

if (!hasStartedDevelopment) {
  // REDIRECT TO REFINE
  console.log(`
⚠️ **Development has NOT started on this session yet.**

Use \`/task-refine\` instead to refine requirements before development begins.
This command (\`/task-scope-change\`) is for sessions where development is already in progress.
  `)
  return
}

console.log(`✅ Session verified: Development is in progress.`)
```

---

## Step 2: Read ALL Session Files

```typescript
// Read everything to understand full context
const requirements = await Read(`${sessionPath}/requirements.md`)
const clickupTask = await Read(`${sessionPath}/clickup_task.md`)
const plan = await Read(`${sessionPath}/plan.md`)
const progress = await Read(`${sessionPath}/progress.md`)
const context = await Read(`${sessionPath}/context.md`)
const tests = await Read(`${sessionPath}/tests.md`)
const pendings = await Read(`${sessionPath}/pendings.md`)
```

---

## Step 3: Analyze Progress State

**Extract what has been completed:**

```typescript
const completedItems = {
  migrations: extractCompletedItems(progress, 'DB Developer'),
  backend: extractCompletedItems(progress, 'Backend Developer'),
  blocks: extractCompletedItems(progress, 'Block Developer'),
  frontend: extractCompletedItems(progress, 'Frontend Developer'),
  tests: extractCompletedItems(progress, 'API Tester'),
  gates: extractGateStatus(progress)
}

// Determine current phase
const currentPhase = determineCurrentPhase(progress)

console.log(`
## Current Progress Analysis

**Current Phase:** ${currentPhase}
**Completed Development:**
- Migrations: ${completedItems.migrations.length} items
- Backend API: ${completedItems.backend.length} items
- Blocks: ${completedItems.blocks.length} items
- Frontend: ${completedItems.frontend.length} items
- Tests: ${completedItems.tests.length} items

**Gate Status:**
${completedItems.gates.map(g => `- ${g.name}: ${g.status}`).join('\n')}
`)
```

---

## Step 4: Deep Reasoning About Scope Change Impact

**Before any changes, analyze the impact thoroughly:**

```typescript
// Parse scope change request
const scopeChangeRequest = extractScopeChangeFromInput(input)

// Analyze impact on each completed area
const impactAnalysis = {
  migrations: analyzeImpactOnMigrations(scopeChangeRequest, completedItems.migrations),
  backend: analyzeImpactOnBackend(scopeChangeRequest, completedItems.backend),
  frontend: analyzeImpactOnFrontend(scopeChangeRequest, completedItems.frontend),
  tests: analyzeImpactOnTests(scopeChangeRequest, completedItems.tests)
}

// Determine rework needed
const reworkNeeded = {
  dropTables: impactAnalysis.migrations.requiresDropTable,
  modifyTables: impactAnalysis.migrations.requiresAlterTable,
  rewriteAPIs: impactAnalysis.backend.apisToRewrite,
  modifyAPIs: impactAnalysis.backend.apisToModify,
  rewriteComponents: impactAnalysis.frontend.componentsToRewrite,
  modifyComponents: impactAnalysis.frontend.componentsToModify,
  rewriteTests: impactAnalysis.tests.testsToRewrite
}
```

---

## Step 5: Present Rework Analysis to User

**CRITICAL: Ask user to confirm before proceeding:**

```typescript
console.log(`
## Scope Change Impact Analysis

**Requested Change:**
${scopeChangeRequest}

**Current Progress That May Be Affected:**

### Database (Migrations)
${reworkNeeded.dropTables.length > 0 ? `
⚠️ **Tables to DROP and recreate:**
${reworkNeeded.dropTables.map(t => `- ${t}`).join('\n')}
` : '✅ No table drops needed'}

${reworkNeeded.modifyTables.length > 0 ? `
📝 **Tables to ALTER:**
${reworkNeeded.modifyTables.map(t => `- ${t}`).join('\n')}
` : ''}

### Backend APIs
${reworkNeeded.rewriteAPIs.length > 0 ? `
⚠️ **APIs to REWRITE:**
${reworkNeeded.rewriteAPIs.map(a => `- ${a}`).join('\n')}
` : '✅ No API rewrites needed'}

${reworkNeeded.modifyAPIs.length > 0 ? `
📝 **APIs to MODIFY:**
${reworkNeeded.modifyAPIs.map(a => `- ${a}`).join('\n')}
` : ''}

### Frontend
${reworkNeeded.rewriteComponents.length > 0 ? `
⚠️ **Components to REWRITE:**
${reworkNeeded.rewriteComponents.map(c => `- ${c}`).join('\n')}
` : '✅ No component rewrites needed'}

### Tests
${reworkNeeded.rewriteTests.length > 0 ? `
⚠️ **Tests to UPDATE:**
${reworkNeeded.rewriteTests.map(t => `- ${t}`).join('\n')}
` : ''}
`)

// Ask user to confirm
await AskUserQuestion({
  questions: [
    {
      header: "Confirm Rework",
      question: "Based on the analysis above, do you want to proceed with this scope change?",
      options: [
        { label: "Yes, proceed", description: "Accept the rework and update session documents" },
        { label: "Modify request", description: "I want to adjust my scope change request" },
        { label: "Cancel", description: "Keep current scope, don't make changes" }
      ],
      multiSelect: false
    }
  ]
})
```

---

## Step 6: Clarify Ambiguities

**If scope change has multiple interpretations, ask:**

```typescript
// Identify ambiguities in the request
const ambiguities = identifyAmbiguities(scopeChangeRequest, requirements, plan)

if (ambiguities.length > 0) {
  for (const ambiguity of ambiguities) {
    await AskUserQuestion({
      questions: [{
        header: ambiguity.category,
        question: ambiguity.question,
        options: ambiguity.options,
        multiSelect: false
      }]
    })
  }
}

// Example ambiguities to check:
// - "Does this change affect existing data?"
// - "Should existing records be migrated?"
// - "Is this a breaking change for the API?"
// - "Should we maintain backwards compatibility?"
```

---

## Step 7: Launch PM Agent for Requirements Update

```typescript
await Task({
  subagent_type: 'product-manager',
  prompt: `
## Scope Change - Requirements Update

**Session:** \`${sessionPath}\`
**Status:** Development in progress (${currentPhase})

### Context

The user has requested a scope change **during development**. This requires updating the requirements considering the work already completed.

### Requested Change

${scopeChangeRequest}

### Impact Analysis (already validated with user)

**Confirmed Rework:**
- Migrations: ${JSON.stringify(reworkNeeded.dropTables)}
- APIs: ${JSON.stringify(reworkNeeded.rewriteAPIs)}
- Components: ${JSON.stringify(reworkNeeded.rewriteComponents)}

### Your Task (Product Manager)

1. **Read current documents:**
   - \`${sessionPath}/requirements.md\`
   - \`${sessionPath}/clickup_task.md\`

2. **Update requirements.md:**
   - Add section "## Scope Change Log"
   - Document the change and its impact
   - Update affected Acceptance Criteria
   - Mark removed ACs as deprecated (do not delete)
   - Add new ACs with classification [AUTO]/[MANUAL]/[REVIEW]

3. **Update clickup_task.md:**
   - Add scope change section
   - Update acceptance criteria

4. **If ClickUp is enabled:**
   - Use mcp__clickup__* to update the task
   - Add comment notifying the change

5. **Document impact:**
   - What completed work is kept
   - What completed work needs to be redone
   - What pending work changes

6. **Update context.md with entry:**
   \`\`\`
   ### ${timestamp} - scope-change (PM)

   **Status:** ⚠️ Scope Change - Requirements Updated

   **Change:** ${scopeChangeRequest}
   **Impact:** ${impactLevel}

   **Affected ACs:**
   - Modified: [list]
   - Added: [list]
   - Deprecated: [list]

   **Rework Required:**
   - [list of items that need to be redone]
   \`\`\`
`
})
```

---

## Step 8: Launch Architect Agent for Plan Update

```typescript
await Task({
  subagent_type: 'architecture-supervisor',
  prompt: `
## Scope Change - Technical Plan Update

**Session:** \`${sessionPath}\`
**Status:** Development in progress (${currentPhase})

### Context

The Product Manager has just updated the requirements due to a scope change.
You need to update the technical plan and progress tracking.

### Requested Change

${scopeChangeRequest}

### User-Confirmed Rework

- **Migrations:** ${JSON.stringify(reworkNeeded)}
- **APIs:** ${JSON.stringify(reworkNeeded.rewriteAPIs)}
- **Frontend:** ${JSON.stringify(reworkNeeded.rewriteComponents)}

### Your Task (Architecture Supervisor)

1. **Read updated documents:**
   - \`${sessionPath}/requirements.md\` (updated by PM)
   - \`${sessionPath}/plan.md\`
   - \`${sessionPath}/progress.md\`

2. **Update plan.md:**
   - Add section "## Scope Change Impact"
   - Document required technical changes
   - Update migration schema if applicable
   - Update API design if applicable
   - Update component design if applicable
   - Increment plan version (e.g., v1.1 → v1.2)

3. **Update progress.md (CRITICAL):**
   - **Mark completed items that need rework as [ ]**
   - Add note next to each item: "[REWORK: scope change]"
   - Add new checkboxes for new tasks
   - Keep history of what had been completed

   Example:
   \`\`\`markdown
   - [ ] Create migration file (REWORK: scope change - was [x])
   - [x] Define posts schema (unaffected)
   - [ ] Create taxonomies schema (NEW: scope change)
   \`\`\`

4. **Decide on existing code:**
   - Can anything be reused?
   - What should be deleted?
   - What should be modified?

5. **If significant code is affected:**
   - Recommend triggering code-reviewer
   - Document what to review

6. **Update context.md with entry:**
   \`\`\`
   ### ${timestamp} - scope-change (Architect)

   **Status:** ⚠️ Scope Change - Plan Updated

   **Technical Changes:**
   - [list of changes to the plan]

   **Items Marked for Rework:**
   - [list of items in progress.md]

   **Technical Decisions:**
   - [new decisions if any]

   **Recommendation:**
   - ${triggerCodeReview ? 'Trigger code-reviewer' : 'No code review needed'}
   \`\`\`
`
})
```

---

## Step 9: Trigger Code Review (if needed)

```typescript
// Determine if code review is needed
const significantCodeExists =
  completedItems.backend.length > 2 ||
  completedItems.frontend.length > 2

const significantRework =
  reworkNeeded.rewriteAPIs.length > 0 ||
  reworkNeeded.rewriteComponents.length > 0

if (significantCodeExists && significantRework) {
  await Task({
    subagent_type: 'code-reviewer',
    prompt: `
## Post-Scope-Change Code Review

**Session:** \`${sessionPath}\`

### Context

A scope change has been applied to this session. A review of existing code is required to:

1. Identify code that must be modified
2. Identify code that can be reused
3. Identify code that should be deleted
4. Validate that no broken references remain

### Scope Change

${scopeChangeRequest}

### Existing Code to Review

**Backend:**
${completedItems.backend.map(b => `- ${b}`).join('\n')}

**Frontend:**
${completedItems.frontend.map(f => `- ${f}`).join('\n')}

### Your Task

1. Review affected code
2. Document findings in context.md
3. Create action list for developers
4. Identify tech debt introduced by the change
`
  })
}
```

---

## Output Format

```markdown
## Scope Change Processed

**Session:** \`${sessionPath}\`
**Previous Status:** ${currentPhase}
**Change Type:** ${changeType}
**Impact:** ${impactLevel}

### Applied Change

${scopeChangeRequest}

### Required Rework

| Area | Affected Items | Action |
|------|----------------|--------|
| Migrations | ${reworkNeeded.migrations} | ${migrationAction} |
| Backend APIs | ${reworkNeeded.apis} | ${apiAction} |
| Frontend | ${reworkNeeded.frontend} | ${frontendAction} |
| Tests | ${reworkNeeded.tests} | ${testAction} |

### Updated Files

- \`requirements.md\` - ✅ ACs updated, scope change log added
- \`clickup_task.md\` - ✅ Criteria updated
- \`plan.md\` - ✅ Technical plan updated (v${newVersion})
- \`progress.md\` - ✅ Items marked for rework
- \`context.md\` - ✅ PM and Architect entries added

### Code Review

${triggeredCodeReview
  ? '✅ Code review triggered - see context.md for findings'
  : '⏭️ No code review needed'}

### Next Steps

1. ${nextStep1}
2. ${nextStep2}
3. ${nextStep3}

### Agents Used

- product-manager: Updated requirements and ACs
- architecture-supervisor: Updated plan and progress
${triggeredCodeReview ? '- code-reviewer: Reviewed affected code' : ''}
```

---

## When to Create New Version (v2)

**Redirect to new session when:**

- Impact is "Complete pivot" (>50% rework)
- Fundamental architecture change
- User explicitly requests fresh start
- Scope change is actually a new feature

```typescript
if (impactLevel === 'complete' || reworkPercentage > 50) {
  console.log(`
⚠️ **This change is too large for a scope change.**

It is recommended to create a new version of the session:

1. Run \`/task-requirements\` with the new requirements
2. Use name: \`${sessionBaseName}-v2\`
3. Reference \`${sessionPath}/pendings.md\` in the new session
4. Document lessons learned from v1
  `)
}
```

---

## Key Principles

1. **Deep Analysis First:** Always analyze impact before making changes
2. **User Confirmation:** Never proceed without user confirming rework
3. **Clarify Ambiguities:** Ask when scope change has multiple interpretations
4. **Preserve History:** Don't delete completed items, mark them for rework
5. **Version Plans:** Increment plan version on every scope change
6. **Document Everything:** Every scope change must be logged in context.md
7. **Code Review:** Trigger review when significant code is affected

---

**Now process the scope change for the session described above.**
