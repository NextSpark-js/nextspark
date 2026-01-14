---
description: Execute multiple independent tasks in parallel using specialized subagents
---

# Parallel Task Execution

You are executing multiple independent tasks simultaneously using subagents for maximum efficiency.

**Task Description:**
{{{ input }}}

---

## Your Mission

Execute the user's request by:

1. **Analyze** the task to identify independent subtasks
2. **Determine** the appropriate agent type for each subtask
3. **Launch** all independent agents in parallel (single message, multiple Task tool calls)
4. **Monitor** progress and collect results
5. **Consolidate** and report final results

---

## Task Analysis Protocol

### Step 1: Identify Subtasks

Parse the user's request to identify:

```typescript
// Common patterns that indicate parallelizable work:

// Pattern 1: Multiple files/folders mentioned
// "translate all files in .claude/agents/" → one agent per file

// Pattern 2: Multiple independent operations
// "update Button, Modal, and Card components" → one agent per component

// Pattern 3: Batch processing request
// "add data-cy to all forms" → one agent per form file

// Pattern 4: Analysis across multiple areas
// "review security in auth, api, and database modules" → one agent per module

// Pattern 5: Explicit list of tasks
// "1. Fix login bug 2. Update docs 3. Add tests" → one agent per item
```

### Step 2: Determine Agent Types

Match each subtask to the most appropriate agent:

| Task Type | Agent | Use Case |
|-----------|-------|----------|
| File translation/editing | `general-purpose` | Translate, refactor, update files |
| Code exploration | `Explore` | Search, understand codebase |
| Frontend components | `frontend-developer` | React/UI components |
| Backend/API | `backend-developer` | API routes, services |
| Database work | `db-developer` | Migrations, queries |
| Testing | `qa-automation` | Cypress tests |
| Unit tests | `unit-test-writer` | Jest tests |
| Documentation | `documentation-writer` | Docs, READMEs |
| Code review | `code-reviewer` | Quality analysis |
| Plugin work | `dev-plugin` | Plugin development |
| Block development | `block-developer` | Page builder blocks |

### Step 3: Launch Agents in Parallel

**CRITICAL:** Launch ALL independent agents in a SINGLE message with multiple Task tool calls.

```typescript
// ✅ CORRECT - Single message with multiple parallel agents
await Promise.all([
  Task({ subagent_type: 'general-purpose', prompt: 'Task 1...', run_in_background: true }),
  Task({ subagent_type: 'general-purpose', prompt: 'Task 2...', run_in_background: true }),
  Task({ subagent_type: 'general-purpose', prompt: 'Task 3...', run_in_background: true }),
])

// ❌ WRONG - Sequential agent launches (defeats the purpose)
await Task({ prompt: 'Task 1...' })
await Task({ prompt: 'Task 2...' })
await Task({ prompt: 'Task 3...' })
```

---

## Execution Templates

### Template A: File Batch Processing

For tasks like "translate all files in folder X":

```typescript
// 1. List files in target directory
const files = await Glob({ pattern: `${targetPath}/*.md` })

// 2. Launch one agent per file (or batch if > 10 files)
const BATCH_SIZE = 5
const batches = chunkArray(files, BATCH_SIZE)

for (const batch of batches) {
  // Launch all agents in this batch IN PARALLEL
  await launchParallelAgents(batch.map(file => ({
    subagent_type: 'general-purpose',
    description: `Process ${basename(file)}`,
    prompt: `[Task details for ${file}]`,
    run_in_background: true
  })))
}
```

### Template B: Multi-Component Update

For tasks like "update components A, B, C":

```typescript
const components = ['ComponentA', 'ComponentB', 'ComponentC']

// Launch all component updates in parallel
await launchParallelAgents(components.map(comp => ({
  subagent_type: 'frontend-developer',
  description: `Update ${comp}`,
  prompt: `Update ${comp} with [specific changes]...`,
  run_in_background: true
})))
```

### Template C: Multi-Area Analysis

For tasks like "analyze security in modules X, Y, Z":

```typescript
const areas = [
  { name: 'auth', path: 'core/lib/auth/' },
  { name: 'api', path: 'app/api/' },
  { name: 'database', path: 'core/lib/db/' }
]

// Launch analysis agents in parallel
await launchParallelAgents(areas.map(area => ({
  subagent_type: 'Explore',
  description: `Analyze ${area.name}`,
  prompt: `Analyze security in ${area.path}...`,
  run_in_background: true
})))
```

### Template D: Independent Task List

For explicit task lists:

```typescript
const tasks = [
  { desc: 'Fix login bug', agent: 'backend-developer' },
  { desc: 'Update README', agent: 'general-purpose' },
  { desc: 'Add unit tests', agent: 'unit-test-writer' }
]

// Launch all tasks in parallel
await launchParallelAgents(tasks.map(task => ({
  subagent_type: task.agent,
  description: task.desc,
  prompt: `${task.desc}: [detailed instructions]`,
  run_in_background: true
})))
```

---

## Agent Prompt Template

Each parallel agent should receive a complete, self-contained prompt:

```markdown
## Task: [Specific task name]

**Context:**
- Project: Next.js 15 + TypeScript
- Location: [file/folder path]
- Related files: [list if relevant]

**Objective:**
[Clear, specific objective]

**Requirements:**
1. [Specific requirement 1]
2. [Specific requirement 2]
3. [Specific requirement 3]

**Constraints:**
- Follow patterns in .rules/ files
- Maintain TypeScript type safety
- Do not modify unrelated code

**Expected Output:**
[What the agent should produce/modify]
```

---

## Batching Strategy

When there are many items (> 10), batch them:

| Item Count | Strategy |
|------------|----------|
| 1-5 | Launch all in parallel |
| 6-10 | Launch all in parallel (monitor closely) |
| 11-20 | Batch into groups of 5 |
| 21+ | Batch into groups of 4-5, wait between batches |

```typescript
const OPTIMAL_BATCH_SIZE = 5

function createBatches(items: string[], batchSize = OPTIMAL_BATCH_SIZE) {
  const batches = []
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize))
  }
  return batches
}
```

---

## Progress Monitoring

### For Background Agents

```typescript
// Launch agents in background
const agentIds = await launchBackgroundAgents([...])

// Check status periodically
for (const id of agentIds) {
  const result = await TaskOutput({
    task_id: id,
    block: false  // Non-blocking check
  })

  if (result.status === 'completed') {
    // Process result
  }
}

// Or wait for all to complete
for (const id of agentIds) {
  const result = await TaskOutput({
    task_id: id,
    block: true  // Wait for completion
  })
}
```

---

## Output Format

```markdown
## Parallel Execution Complete

**Task:** [Original task description]
**Strategy:** [File batch / Multi-component / Multi-area / Task list]
**Total Subtasks:** [N]
**Batches:** [N batches of M items]

### Execution Summary

| # | Subtask | Agent | Status | Duration |
|---|---------|-------|--------|----------|
| 1 | [Task 1] | general-purpose | ✅ Complete | 12s |
| 2 | [Task 2] | frontend-developer | ✅ Complete | 8s |
| 3 | [Task 3] | backend-developer | ✅ Complete | 15s |

### Results

#### Subtask 1: [Name]
[Summary of what was done]

#### Subtask 2: [Name]
[Summary of what was done]

### Files Modified
- `path/to/file1.ts` - [change description]
- `path/to/file2.ts` - [change description]

### Recommendations
- [Any follow-up actions needed]
- [Potential issues to review]
```

---

## Error Handling

```typescript
// If an agent fails, report but continue with others
const results = await Promise.allSettled(agentPromises)

const successful = results.filter(r => r.status === 'fulfilled')
const failed = results.filter(r => r.status === 'rejected')

if (failed.length > 0) {
  console.log(`${failed.length} tasks failed:`)
  failed.forEach(f => console.log(`- ${f.reason}`))
}
```

---

## Examples

### Example 1: Translate Files
```
Input: "translate all .md files in .claude/agents/ from Spanish to English"

Analysis:
- Target: .claude/agents/*.md
- Operation: Translate Spanish → English
- Agent type: general-purpose
- Strategy: Batch processing (5 files per batch)

Execution:
- Batch 1: 5 agents in parallel
- Batch 2: 5 agents in parallel
- ... continue until all files processed
```

### Example 2: Add Tests
```
Input: "add unit tests for UserService, AuthService, and PaymentService"

Analysis:
- Targets: 3 services
- Operation: Write unit tests
- Agent type: unit-test-writer
- Strategy: All 3 in parallel

Execution:
- 3 unit-test-writer agents launched simultaneously
```

### Example 3: Code Review
```
Input: "review code quality in auth module, payment module, and user module"

Analysis:
- Targets: 3 modules
- Operation: Code review
- Agent type: code-reviewer
- Strategy: All 3 in parallel

Execution:
- 3 code-reviewer agents launched simultaneously
```

---

## Best Practices

### DO:
- Launch independent tasks in a single message
- Use `run_in_background: true` for long tasks
- Provide complete context to each agent
- Batch large workloads appropriately
- Consolidate results clearly

### DON'T:
- Launch dependent tasks in parallel
- Exceed 5-6 concurrent agents
- Skip error handling
- Forget to collect results from background agents

---

**Now analyze the task above and execute it using parallel agents.**
