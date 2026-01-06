---
description: "[Pre-Execution] Refine session requirements and/or plan before development starts"
---

# Task Refine - Pre-Development Session Refinement

You are refining a session that has been created but NOT yet started (development has not begun).

**Session Path and Refinement Request:**
{{{ input }}}

---

## Your Mission

Refine session documents based on user feedback **BEFORE** development begins. This command is for sessions in the planning phase only.

**Key Difference from scope-change:**
- `task:refine` - Session NOT started (planning phase only)
- `task:scope-change` - Session IN PROGRESS (development has begun)

---

## Process Overview

```
1. Detect session path from input
2. Read session files to understand current state
3. Determine which agents to launch (PM only, or PM + Architect)
4. Launch agents to refine documents
5. Update session files with refinements
6. Get user confirmation
```

---

## Step 1: Detect Session Path

```typescript
// Extract session path from input
// User might provide:
// - Full path: .claude/sessions/2025-12-16-posts-system-v1/
// - Just session name: 2025-12-16-posts-system-v1
// - Or it might be in context from previous conversation

const sessionPath = extractSessionPath(input)

// If no session path found, check for most recent session
if (!sessionPath) {
  const sessions = await Glob('.claude/sessions/*/')
  const mostRecent = sessions.sort().pop()
  // Ask user to confirm
}
```

---

## Step 2: Analyze Current Session State

**Read existing session files:**

```typescript
// Check what files exist
const hasRequirements = await fileExists(`${sessionPath}/requirements.md`)
const hasPlan = await fileExists(`${sessionPath}/plan.md`)
const hasProgress = await fileExists(`${sessionPath}/progress.md`)
const hasContext = await fileExists(`${sessionPath}/context.md`)

// Determine session state
let sessionState: 'requirements-only' | 'planned' | 'started'

if (hasProgress) {
  // Check if any development items are completed
  const progress = await Read(`${sessionPath}/progress.md`)
  const hasCompletedDevItems = checkForCompletedDevelopmentItems(progress)

  if (hasCompletedDevItems) {
    sessionState = 'started'
    // REDIRECT TO SCOPE-CHANGE
    console.log(`
⚠️ **Development has already started on this session.**

Use \`/task:scope-change\` instead to handle mid-development changes.
This command (\`/task:refine\`) is only for sessions that haven't started development yet.
    `)
    return
  }
}

sessionState = hasPlan ? 'planned' : 'requirements-only'
```

---

## Step 3: Read Current Documents

```typescript
// Always read requirements
const requirements = await Read(`${sessionPath}/requirements.md`)

// Read plan if exists
let plan = null
if (hasPlan) {
  plan = await Read(`${sessionPath}/plan.md`)
}

// Read context if exists
let context = null
if (hasContext) {
  context = await Read(`${sessionPath}/context.md`)
}
```

---

## Step 4: Understand Refinement Request

**Extract the refinement request from user input:**

The user's input contains:
1. Session path (explicit or implicit)
2. What they want to change/refine

Parse the refinement request and classify it:

```typescript
const refinementTypes = {
  'requirements': // Changes to ACs, user stories, scope
  'architecture': // Changes to technical approach, schema, API design
  'scope': // Changes to what's in/out of scope
  'both': // Changes that affect both requirements and technical plan
}
```

---

## Step 5: Determine Agents to Launch

```typescript
// Decision matrix
if (sessionState === 'requirements-only') {
  // Only PM agent needed - plan doesn't exist yet
  agentsToLaunch = ['product-manager']

} else if (sessionState === 'planned') {
  // Both agents needed - refine requirements AND update plan
  agentsToLaunch = ['product-manager', 'architecture-supervisor']
}
```

---

## Step 6: Launch Product Manager Agent

**ALWAYS launch PM first to refine requirements:**

```typescript
await Task({
  subagent_type: 'product-manager',
  prompt: `
## Requirements Refinement: ${sessionName}

**Session Path:** \`${sessionPath}\`
**Session State:** ${sessionState}

### Context

The user has requested to refine the requirements for this session BEFORE starting development.

### Refinement Request

${userRefinementRequest}

### Your Task (Product Manager)

1. **Read the current requirements:**
   - \`${sessionPath}/requirements.md\`
   - \`${sessionPath}/clickup_task.md\` (if exists)

2. **Analyze the refinement request:**
   - What specific changes are being requested?
   - Does it affect the Acceptance Criteria?
   - Does it affect the scope (in/out)?
   - Does it affect the data schema?
   - Are there ambiguities that need clarification?

3. **If there are ambiguities, use AskUserQuestion:**
   - Clarify any points that could be interpreted in multiple ways
   - Confirm important decisions before applying them

4. **Update the documents:**
   - \`requirements.md\` - Update ACs, scope, schema as appropriate
   - \`clickup_task.md\` - Update criteria if exists
   - \`context.md\` - Add refinement entry

5. **Document the refinement:**
   - Add section "## Refinement Log" in requirements.md
   - List the changes made
   - Date and reason for the refinement

6. **Expected output:**
   - List of changes made
   - Updated files
   - Recommendation for next step
`
})
```

---

## Step 7: Launch Architecture Supervisor (if plan exists)

**Only if session has a plan.md:**

```typescript
if (sessionState === 'planned') {
  await Task({
    subagent_type: 'architecture-supervisor',
    prompt: `
## Technical Plan Refinement: ${sessionName}

**Session Path:** \`${sessionPath}\`
**State:** Plan already exists, refining based on requirements changes

### Context

The Product Manager has just refined the requirements for this session.
You need to update the technical plan to reflect the changes.

### Original Refinement Request

${userRefinementRequest}

### Your Task (Architecture Supervisor)

1. **Read the updated documents:**
   - \`${sessionPath}/requirements.md\` (just updated by PM)
   - \`${sessionPath}/plan.md\` (current plan to refine)
   - \`${sessionPath}/progress.md\` (progress template)

2. **Identify technical impacts:**
   - Does the database schema change?
   - Does the API structure change?
   - Does the component architecture change?
   - Are there new technical decisions to make?

3. **If there are ambiguous technical decisions:**
   - Evaluate the available options
   - Use AskUserQuestion to confirm with the user
   - Document the decision and justification

4. **Update the documents:**
   - \`plan.md\` - Update phases, migrations, APIs, components
   - \`progress.md\` - Update checkboxes if there are new tasks
   - \`context.md\` - Add technical refinement entry

5. **Version the plan:**
   - Increment version in plan.md (e.g.: v1.0 → v1.1)
   - Document changes in section "## Refinement History"

6. **Expected output:**
   - List of technical changes
   - New architectural decisions (if any)
   - Updated files
`
  })
}
```

---

## Step 8: Update Context File

**Add refinement entry to context.md:**

```typescript
const contextEntry = `
---

### ${timestamp} - task:refine

**Status:** Refinement Completed

**Requested by:** User
**Refinement Type:** ${refinementType}

**Requested Changes:**
${userRefinementRequest}

**Updated Files:**
- requirements.md - ${requirementsChanges}
- ${hasPlan ? 'plan.md - ' + planChanges : 'plan.md - Does not exist yet'}
- ${hasProgress ? 'progress.md - ' + progressChanges : 'progress.md - Does not exist yet'}

**Agents Involved:**
- product-manager: Refined requirements
${hasPlan ? '- architecture-supervisor: Updated technical plan' : ''}

**Next Step:**
${hasPlan ? '- Ready for /task:execute' : '- Run /task:plan to create technical plan'}

**Notes:**
- Session NOT yet started (pre-development)
- No rework required (development has not begun)
`

await appendToFile(`${sessionPath}/context.md`, contextEntry)
```

---

## Output Format

```markdown
## Refinement Completed

**Session:** \`${sessionPath}\`
**Session State:** ${sessionState}
**Agents Used:** ${agentsUsed.join(', ')}

### Changes Made

**Requirements:**
- [List of changes in requirements]

**Technical Plan:** ${hasPlan ? '[List of changes in plan]' : 'N/A - Plan does not exist yet'}

### Updated Files
- \`requirements.md\` - Updated
- \`clickup_task.md\` - ${hasClickup ? 'Updated' : 'N/A'}
- \`plan.md\` - ${hasPlan ? 'Updated' : 'Does not exist yet'}
- \`progress.md\` - ${hasProgress ? 'Updated' : 'Does not exist yet'}
- \`context.md\` - Entry added

### Next Step

${hasPlan
  ? 'The session is ready to execute. Run `/task:execute` to begin development.'
  : 'The requirements are refined. Run `/task:plan` to create the technical plan.'
}
```

---

## When NOT to Use This Command

**Use `/task:scope-change` instead when:**
- Development has already started (Phase 5+ in progress.md)
- Code has been written
- Migrations have been executed
- API endpoints exist

**Use `/task:requirements` instead when:**
- Starting a completely new feature
- No session exists yet

---

## Key Principles

1. **Pre-Development Only:** This command is for planning phase refinements
2. **No Rework Analysis:** Since development hasn't started, no need to analyze rework
3. **Clarify Ambiguities:** Always ask user when refinement request is unclear
4. **Preserve Context:** Document all refinements in context.md
5. **Version Plans:** Increment plan version when updating (v1.0 → v1.1)
6. **Agent Selection:** PM always, Architect only if plan exists

---

## Examples

### Example 1: Refine Requirements Only

```
User: /task:refine 2025-12-16-posts-system-v1
      I want to change the categories schema to a generic taxonomy system

-> Session has requirements.md but no plan.md
-> Launch: product-manager only
-> PM updates requirements with new schema
-> Next step: /task:plan
```

### Example 2: Refine Requirements + Plan

```
User: /task:refine 2025-12-16-posts-system-v1
      I want to change the categories schema to a generic taxonomy system

-> Session has both requirements.md and plan.md
-> Launch: product-manager (first), then architecture-supervisor
-> PM updates requirements, Architect updates plan
-> Next step: /task:execute
```

---

**Now process the refinement request for the session described above.**
