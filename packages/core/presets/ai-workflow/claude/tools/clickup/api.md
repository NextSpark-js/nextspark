# 🔌 ClickUp API Reference

This section documents the most common ClickUp API endpoints so our agents can programmatically interact with tasks.

> **⚠️ IMPORTANT:** All IDs and credentials in examples below are placeholders.
> Always read actual values from `.claude/config/agents.json`:
> - `tools.clickup.workspaceId` - Workspace ID
> - `tools.clickup.space.id` - Space ID
> - `tools.clickup.defaultList.id` - List ID
> - `tools.clickup.user.id` - User ID for assignments
> - `tools.clickup.user.name` - User name
> - `tools.clickup.apiToken` - API Token

## 🔐 Authentication

### Personal Token (Recommended for Development/Testing)

Personal tokens are ideal for individual use or testing. They start with `pk_` and never expire.

**Getting a Personal Token:**
1. Log in to ClickUp
2. Go to Settings (avatar icon) → Apps → API Token
3. Click "Generate" or "Regenerate"
4. Copy the token

**Usage in Headers:**
```bash
Authorization: pk_YOUR_PERSONAL_TOKEN_HERE
```

### OAuth 2.0 (For Multi-User Applications)

**OAuth URLs:**
- Authorization URL: `https://app.clickup.com/api`
- Access Token URL: `https://api.clickup.com/api/v2/oauth/token`

**Usage in Headers:**
```bash
Authorization: Bearer {access_token}
```

---

## 📋 Main Endpoints

### 1. List Tasks

**Endpoint:** `GET https://api.clickup.com/api/v2/list/{list_id}/task`

**Description:** Gets tasks from a specific List. Responses limited to 100 tasks per page.

**Important Query Parameters:**
- `page` - Page number (default: 0)
- `order_by` - Field to sort by (created, updated, due_date)
- `reverse` - true/false for reverse order
- `subtasks` - true to include subtasks
- `statuses[]` - Filter by specific statuses
- `assignees[]` - Filter by assigned users
- `tags[]` - Filter by tags
- `include_closed` - true to include closed tasks

**cURL Example:**
```bash
curl --request GET \
  --url 'https://api.clickup.com/api/v2/list/{LIST_ID}/task?page=0&order_by=updated&reverse=true&include_closed=false' \
  --header 'Authorization: pk_YOUR_TOKEN_HERE'
```

**Node.js Example:**
```javascript
const API_TOKEN = 'pk_YOUR_TOKEN_HERE'
const LIST_ID = '{LIST_ID}' // Boilerplate list ID

async function getTasks(filters = {}) {
  const params = new URLSearchParams({
    page: filters.page || 0,
    order_by: filters.orderBy || 'updated',
    reverse: filters.reverse !== false,
    include_closed: filters.includeClosed || false,
    ...filters
  })

  const response = await fetch(
    `https://api.clickup.com/api/v2/list/${LIST_ID}/task?${params}`,
    {
      headers: {
        'Authorization': API_TOKEN
      }
    }
  )

  const data = await response.json()
  return data.tasks
}

// Usage:
const tasks = await getTasks({
  statuses: ['backlog', 'in progress'],
  assignees: ['{USER_ID}'] // {USER_NAME}
})
```

**Response (Example):**
```json
{
  "tasks": [
    {
      "id": "86a3tvqvz",
      "name": "Theme-Based Documentation System",
      "status": {
        "status": "backlog",
        "type": "custom"
      },
      "priority": {
        "priority": "high",
        "color": "#f50000"
      },
      "assignees": [
        {
          "id": {USER_ID},
          "username": "{USER_NAME}"
        }
      ],
      "tags": ["feature", "core", "documentation"],
      "date_created": "1637950000000",
      "date_updated": "1637960000000",
      "description": "## 📋 Context\n...",
      "custom_fields": []
    }
  ]
}
```

---

### 2. Create Task

**Endpoint:** `POST https://api.clickup.com/api/v2/list/{list_id}/task`

**Description:** Creates a new task in a specific List.

**Main Fields:**
- `name` (required) - Task title
- `markdown_description` - ⭐ **USE THIS FOR MARKDOWN** (renders formatting correctly)
- `description` - ❌ **AVOID** - Plain text only, markdown shows as literal symbols
- `status` - Initial status (e.g., "backlog", "in progress")
- `priority` - Priority: 1=Urgent, 2=High, 3=Normal, 4=Low
- `assignees` - Array of user IDs
- `tags` - Array of strings for tags
- `due_date` - Timestamp in milliseconds
- `start_date` - Timestamp in milliseconds
- `parent` - Parent task ID (to create a subtask)

**⚠️ CRITICAL: Always use `markdown_description` instead of `description`**
- ✅ **CORRECT:** `markdown_description: "## Header\n\n- **Bold**"`
- ❌ **WRONG:** `description: "## Header\n\n- **Bold**"` (shows symbols literally)

**cURL Example:**
```bash
curl --request POST \
  --url 'https://api.clickup.com/api/v2/list/{LIST_ID}/task' \
  --header 'Authorization: pk_YOUR_TOKEN_HERE' \
  --header 'Content-Type: application/json' \
  --data '{
    "name": "New Feature: Biometric Login",
    "markdown_description": "## 📋 Context\n\n- **Why:** Improve security and UX\n- **Impact:** Reduces login friction\n\n## ✅ Acceptance Criteria\n\n- [ ] **AC1:** User can enable biometric login\n- [ ] **AC2:** Works on iOS and Android\n\n---\n\n## 🏗️ Implementation Plan\n[Pending - architecture-supervisor]\n\n## 🧪 QA Plan\n[Pending - architecture-supervisor]",
    "status": "backlog",
    "priority": 2,
    "assignees": [{USER_ID}],
    "tags": ["feature", "authentication", "mobile"]
  }'
```

**Node.js Example:**
```javascript
async function createTask(taskData) {
  const response = await fetch(
    `https://api.clickup.com/api/v2/list/${LIST_ID}/task`,
    {
      method: 'POST',
      headers: {
        'Authorization': API_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: taskData.name,
        markdown_description: taskData.description,
        status: taskData.status || 'backlog',
        priority: taskData.priority || 3,
        assignees: taskData.assignees || [],
        tags: taskData.tags || []
      })
    }
  )

  const data = await response.json()
  return data
}

// Usage (example from product-manager agent):
const newTask = await createTask({
  name: 'Theme-Based Documentation System',
  description: `## 📋 Context

- **Why:** Documentation reduces learning curve
- **Impact:** Improves framework adoption
- **Benefits:** Unified core + theme documentation

**User Story:**
As a theme developer, I want to document my theme while users also see core docs.

## ✅ Acceptance Criteria

- [ ] **AC1:** Documentation can be public or private
- [ ] **AC2:** Files in .md format
- [ ] **AC3:** Sidebar with hierarchical navigation

---

## 🏗️ Implementation Plan
[Pending - architecture-supervisor]

## 🧪 QA Plan
[Pending - architecture-supervisor]`,
  status: 'backlog',
  priority: 2,
  assignees: [{USER_ID}],
  tags: ['feature', 'core', 'documentation']
})

console.log('✅ Task created:', newTask.id)
```

**Response:**
```json
{
  "id": "86a3tvqvz",
  "name": "Theme-Based Documentation System",
  "status": {
    "status": "backlog"
  },
  "url": "https://app.clickup.com/t/86a3tvqvz"
}
```

---

### 3. Update Task

**Endpoint:** `PUT https://api.clickup.com/api/v2/task/{task_id}`

**Description:** Updates an existing task. Include only the fields you want to modify.

**Updatable Fields:**
- `name` - New title
- `markdown_description` - ⭐ **USE THIS** for markdown descriptions
- `description` - ❌ **AVOID** - Only for plain text (markdown shows as symbols)
- `status` - Change status
- `priority` - Change priority
- `assignees` - Modify assignees (complete array)
- `tags` - Modify tags (complete array)
- `due_date` - Modify due date
- `parent` - Change parent (convert to subtask or vice versa)

**⚠️ REMINDER: Always use `markdown_description` to preserve formatting**

**cURL Example - Update Status:**
```bash
curl --request PUT \
  --url 'https://api.clickup.com/api/v2/task/86a3tvqvz' \
  --header 'Authorization: pk_YOUR_TOKEN_HERE' \
  --header 'Content-Type: application/json' \
  --data '{
    "status": "in progress"
  }'
```

**cURL Example - Update Multiple Fields:**
```bash
curl --request PUT \
  --url 'https://api.clickup.com/api/v2/task/86a3tvqvz' \
  --header 'Authorization: pk_YOUR_TOKEN_HERE' \
  --header 'Content-Type: application/json' \
  --data '{
    "name": "Documentation System (Updated)",
    "status": "in progress",
    "priority": 1,
    "assignees": [{USER_ID}, 1234567]
  }'
```

**Node.js Example:**
```javascript
async function updateTask(taskId, updates) {
  const response = await fetch(
    `https://api.clickup.com/api/v2/task/${taskId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': API_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    }
  )

  const data = await response.json()
  return data
}

// Usage (example from frontend-developer agent when starting work):
await updateTask('86a3tvqvz', {
  status: 'in progress'
})

console.log('✅ Task moved to "in progress"')
```

---

### 4. Change Task Status

**Endpoint:** `PUT https://api.clickup.com/api/v2/task/{task_id}`

**Description:** Status change is a special case of task update.

**Common Statuses:**
- `backlog` - Task pending start
- `in progress` - Under development
- `qa` - In quality testing
- `done` - Completed (ONLY humans via UI)

**cURL Example:**
```bash
# Developer starts work
curl --request PUT \
  --url 'https://api.clickup.com/api/v2/task/86a3tvqvz' \
  --header 'Authorization: pk_YOUR_TOKEN_HERE' \
  --header 'Content-Type: application/json' \
  --data '{"status": "in progress"}'

# QA starts testing
curl --request PUT \
  --url 'https://api.clickup.com/api/v2/task/86a3tvqvz' \
  --header 'Authorization: pk_YOUR_TOKEN_HERE' \
  --header 'Content-Type: application/json' \
  --data '{"status": "qa"}'

# QA finds bugs (return to development)
curl --request PUT \
  --url 'https://api.clickup.com/api/v2/task/86a3tvqvz' \
  --header 'Authorization: pk_YOUR_TOKEN_HERE' \
  --header 'Content-Type: application/json' \
  --data '{"status": "in progress"}'
```

**Node.js Example (Helpers per Agent):**
```javascript
// Helper for each agent according to workflow
const TaskStateManager = {
  // Frontend/Backend/DevPlugin agents
  async startDevelopment(taskId) {
    await updateTask(taskId, { status: 'in progress' })
    console.log('🚀 Task moved to "in progress"')
  },

  // QA Tester agent
  async startQA(taskId) {
    await updateTask(taskId, { status: 'qa' })
    console.log('🧪 Task moved to "qa"')
  },

  async returnToDev(taskId) {
    await updateTask(taskId, { status: 'in progress' })
    console.log('🐛 Task returned to "in progress" (bugs found)')
  }
}

// Usage in agents:
// Frontend/Backend Developer when starting:
await TaskStateManager.startDevelopment('86a3tvqvz')

// QA Tester when starting testing:
await TaskStateManager.startQA('86a3tvqvz')

// QA Tester if bugs are found:
await TaskStateManager.returnToDev('86a3tvqvz')
```

---

### 5. Create Subtask (Bug)

**Endpoint:** `POST https://api.clickup.com/api/v2/list/{list_id}/task`

**Description:** There's no separate endpoint for subtasks. A normal task is created with the `parent` field pointing to the parent task ID.

**Restrictions:**
- Parent CANNOT be a subtask (no nested subtasks allowed)
- Parent must be in the same list
- Limit: 1,000 subtasks per parent task

**cURL Example - Create Bug as Subtask:**
```bash
curl --request POST \
  --url 'https://api.clickup.com/api/v2/list/{LIST_ID}/task' \
  --header 'Authorization: pk_YOUR_TOKEN_HERE' \
  --header 'Content-Type: application/json' \
  --data '{
    "name": "Bug: Sidebar doesn'\''t show core documentation",
    "parent": "86a3tvqvz",
    "markdown_description": "❌ BUG FOUND\n\n**Severity:** High\n**Category:** Functional\n\n**Steps to Reproduce:**\n1. Navigate to /docs in theme\n2. Observe sidebar\n3. Only shows theme docs, NOT core docs\n\n**Expected Behavior:**\nSidebar should show core AND theme docs\n\n**Actual Behavior:**\nOnly shows theme docs\n\n**Blocking:** YES",
    "status": "backlog",
    "priority": 1,
    "tags": ["bug", "qa-found"]
  }'
```

**Node.js Example (QA Tester Agent):**
```javascript
async function createBugSubtask(parentTaskId, bugData) {
  const bugDescription = `❌ BUG FOUND

**Severity:** ${bugData.severity}
**Category:** ${bugData.category}

**Steps to Reproduce:**
${bugData.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

**Expected Behavior:**
${bugData.expected}

**Actual Behavior:**
${bugData.actual}

**Evidence:**
${bugData.evidence || 'N/A'}

**Blocking:** ${bugData.blocking ? 'YES' : 'NO'}`

  const response = await fetch(
    `https://api.clickup.com/api/v2/list/${LIST_ID}/task`,
    {
      method: 'POST',
      headers: {
        'Authorization': API_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `Bug: ${bugData.title}`,
        parent: parentTaskId,
        markdown_description: bugDescription,
        status: 'backlog',
        priority: bugData.severity === 'High' ? 1 : bugData.severity === 'Medium' ? 2 : 3,
        tags: ['bug', 'qa-found']
      })
    }
  )

  const data = await response.json()
  return data
}

// Usage (QA Tester when finding bugs):
const bugs = [
  {
    title: 'Sidebar doesn\'t show core documentation',
    severity: 'High',
    category: 'Functional',
    steps: [
      'Navigate to /docs in theme',
      'Observe sidebar',
      'Only shows theme docs, NOT core docs'
    ],
    expected: 'Sidebar should show core AND theme docs',
    actual: 'Only shows theme docs',
    blocking: true
  },
  {
    title: 'Sidebar not responsive on mobile',
    severity: 'Medium',
    category: 'Visual',
    steps: [
      'Open /docs on mobile (375px)',
      'Try to open sidebar',
      'No hamburger menu visible'
    ],
    expected: 'Sidebar accessible via hamburger menu',
    actual: 'Sidebar hidden with no way to open it',
    blocking: false
  }
]

// Create bug subtasks
for (const bug of bugs) {
  const subtask = await createBugSubtask('86a3tvqvz', bug)
  console.log(`🐛 Bug created as subtask: ${subtask.id}`)
}

// Return main task to "in progress"
await updateTask('86a3tvqvz', { status: 'in progress' })

// Notify the architect
await addComment('86a3tvqvz', `🐛 BUGS FOUND DURING QA

${bugs.length} bug sub-tasks created. See details above.

@architecture-supervisor - Please assign these bugs to the corresponding developers.`)
```

---

### 6. Create Checklist and Checklist Items

#### 6.1. Create Checklist in Task

**Endpoint:** `POST https://api.clickup.com/api/v2/task/{task_id}/checklist`

**Description:** Adds a new checklist to an existing task.

**cURL Example:**
```bash
curl --request POST \
  --url 'https://api.clickup.com/api/v2/task/86a3tvqvz/checklist' \
  --header 'Authorization: pk_YOUR_TOKEN_HERE' \
  --header 'Content-Type: application/json' \
  --data '{
    "name": "Phase 1: Database and Backend"
  }'
```

**Response:**
```json
{
  "checklist": {
    "id": "checklist_abc123",
    "name": "Phase 1: Database and Backend",
    "orderindex": 1,
    "resolved": 0,
    "unresolved": 0,
    "items": []
  }
}
```

#### 6.2. Add Items to Checklist

**Endpoint:** `POST https://api.clickup.com/api/v2/checklist/{checklist_id}/checklist_item`

**Description:** Adds an individual item to an existing checklist.

**cURL Example:**
```bash
curl --request POST \
  --url 'https://api.clickup.com/api/v2/checklist/checklist_abc123/checklist_item' \
  --header 'Authorization: pk_YOUR_TOKEN_HERE' \
  --header 'Content-Type: application/json' \
  --data '{
    "name": "Create database migration for docs table",
    "assignee": {USER_ID}
  }'
```

**Node.js Example (Architecture Supervisor):**
```javascript
async function createChecklist(taskId, checklistName) {
  const response = await fetch(
    `https://api.clickup.com/api/v2/task/${taskId}/checklist`,
    {
      method: 'POST',
      headers: {
        'Authorization': API_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: checklistName })
    }
  )

  const data = await response.json()
  return data.checklist
}

async function addChecklistItem(checklistId, itemName, assignee = null) {
  const response = await fetch(
    `https://api.clickup.com/api/v2/checklist/${checklistId}/checklist_item`,
    {
      method: 'POST',
      headers: {
        'Authorization': API_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: itemName,
        ...(assignee && { assignee })
      })
    }
  )

  const data = await response.json()
  return data
}

// Usage (Architecture Supervisor completing Implementation Plan):
const taskId = '86a3tvqvz'

// Create checklists for each phase
const phase1 = await createChecklist(taskId, 'Phase 1: Database and Backend')
await addChecklistItem(phase1.id, 'Create migration for docs table', {USER_ID})
await addChecklistItem(phase1.id, 'Implement GET /api/v1/docs endpoint', {USER_ID})
await addChecklistItem(phase1.id, 'Add dual authentication', {USER_ID})

const phase2 = await createChecklist(taskId, 'Phase 2: Frontend Components')
await addChecklistItem(phase2.id, 'Create DocsLayout component', {USER_ID})
await addChecklistItem(phase2.id, 'Create DocsSidebar component', {USER_ID})
await addChecklistItem(phase2.id, 'Implement hierarchical navigation', {USER_ID})

const phase3 = await createChecklist(taskId, 'Phase 3: Integration and Testing')
await addChecklistItem(phase3.id, 'Test API endpoints', {USER_ID})
await addChecklistItem(phase3.id, 'Run pnpm build', {USER_ID})
await addChecklistItem(phase3.id, 'Launch test-writer-fixer agent', {USER_ID})

console.log('✅ Implementation Plan created with checklists')
```

#### 6.3. Using Checklists in Markdown Description

**Important Note:** Checkboxes in the `markdown_description` field are **visual only**. For functional checklists that can be checked/unchecked in ClickUp UI, you must use the checklists endpoint.

**Example - Visual Checkboxes in Description:**
```javascript
const taskDescription = `## 📋 Context
...

## ✅ Acceptance Criteria
- [ ] **AC1:** Documentation can be public or private
- [ ] **AC2:** Files in .md format
- [ ] **AC3:** Sidebar with hierarchical navigation

---

## 🏗️ Implementation Plan
[Architecture supervisor will complete this with functional checklists]`

// These checkboxes render visually but are NOT interactive
await createTask({
  name: 'New Feature',
  markdown_description: taskDescription
})
```

**Example - Functional Checklists (Recommended):**
```javascript
// 1. Create task
const task = await createTask({
  name: 'Documentation System',
  markdown_description: '## 📋 Context\n...'
})

// 2. Add functional checklists (interactive in ClickUp UI)
const implementationChecklist = await createChecklist(
  task.id,
  '🏗️ Implementation Plan'
)

await addChecklistItem(implementationChecklist.id, '✅ AC1: Public/private documentation')
await addChecklistItem(implementationChecklist.id, '✅ AC2: .md files')
await addChecklistItem(implementationChecklist.id, '✅ AC3: Hierarchical sidebar')
```

---

### 7. Add Comments to Task

**Endpoint:** `POST https://api.clickup.com/api/v2/task/{task_id}/comment`

**Description:** Adds a comment to an existing task.

**cURL Example:**
```bash
curl --request POST \
  --url 'https://api.clickup.com/api/v2/task/86a3tvqvz/comment' \
  --header 'Authorization: pk_YOUR_TOKEN_HERE' \
  --header 'Content-Type: application/json' \
  --data '{
    "comment_text": "🚀 Starting frontend development - Phase 2\n\nBeginning implementation of DocsLayout and DocsSidebar components.",
    "notify_all": false
  }'
```

**Node.js Example:**
```javascript
async function addComment(taskId, commentText, notifyAll = false) {
  const response = await fetch(
    `https://api.clickup.com/api/v2/task/${taskId}/comment`,
    {
      method: 'POST',
      headers: {
        'Authorization': API_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        comment_text: commentText,
        notify_all: notifyAll
      })
    }
  )

  const data = await response.json()
  return data
}

// Usage in different agents:

// Frontend Developer when starting
await addComment('86a3tvqvz', '🚀 Starting frontend development - Phase 2')

// Backend Developer when finishing
await addComment('86a3tvqvz', '✅ Phase 1 completed - Build validated\n\nAll endpoints implemented and tested.')

// QA Tester when approving
await addComment('86a3tvqvz', `✅ QA TESTS COMPLETED SUCCESSFULLY

**Results:**
- All acceptance criteria met
- All functional tests passed
- Visual tests OK on desktop/mobile/tablet
- No blocking bugs found

**Status:** Ready for code review`)

// Code Reviewer when publishing review
await addComment('86a3tvqvz', `# 🔍 Code Review Completed

## 📋 Executive Summary
- **Status:** ✅ APPROVED
- **Feature Branch:** feature/docs-system
- **Critical Issues:** 0
- **Suggestions:** 3 optional optimizations

...`)
```

---

## 🎯 Usage Examples per Agent

### Product Manager Agent

```javascript
// Create initial task with context and acceptance criteria
async function createProductTask(taskDetails) {
  const task = await createTask({
    name: taskDetails.name,
    markdown_description: `## 📋 Context

- **Why:** ${taskDetails.why}
- **Impact:** ${taskDetails.impact}
- **Benefits:** ${taskDetails.benefits}

**User Story:**
${taskDetails.userStory}

---

## ✅ Acceptance Criteria

${taskDetails.acceptanceCriteria.map((ac, i) => `- [ ] **AC${i + 1}:** ${ac}`).join('\n')}

---

## 🏗️ Implementation Plan
[Pending - architecture-supervisor]

## 🧪 QA Plan
[Pending - architecture-supervisor]`,
    status: 'backlog',
    priority: taskDetails.priority,
    assignees: taskDetails.assignees,
    tags: taskDetails.tags
  })

  await addComment(task.id, '@architecture-supervisor - Task ready for technical refinement')

  return task
}
```

### Architecture Supervisor Agent

```javascript
// Complete technical plans with functional checklists
async function refineTask(taskId, implementationPlan, qaPlan) {
  // Add implementation checklists
  for (const phase of implementationPlan.phases) {
    const checklist = await createChecklist(taskId, phase.name)

    for (const item of phase.items) {
      await addChecklistItem(checklist.id, item)
    }
  }

  // Add QA checklists
  const qaChecklist = await createChecklist(taskId, '🧪 QA Plan')
  for (const testCase of qaPlan.testCases) {
    await addChecklistItem(qaChecklist.id, testCase)
  }

  await addComment(taskId, '✅ Technical refinement complete - Ready for development')
}
```

### Developer Agents (Frontend/Backend/Plugin)

```javascript
// When starting development
await updateTask(taskId, { status: 'in progress' })
await addComment(taskId, '🚀 Starting frontend development - Phase 2')

// During development (mark progress in comments)
await addComment(taskId, '✅ DocsLayout component completed\n✅ DocsSidebar component in progress')

// When finishing
await addComment(taskId, '✅ Phase 2 completed - Build validated\n\nAll components implemented and tested.')
```

### QA Tester Agent

```javascript
// When starting QA
await updateTask(taskId, { status: 'qa' })
await addComment(taskId, '🧪 Starting QA tests')

// If bugs are found
const bugs = [/* ... */]
for (const bug of bugs) {
  await createBugSubtask(taskId, bug)
}
await updateTask(taskId, { status: 'in progress' })
await addComment(taskId, `🐛 ${bugs.length} bugs found. See sub-tasks.\n\n@architecture-supervisor - Assign to developers.`)

// If approved
await addComment(taskId, '✅ QA APPROVED - Ready for code review')
```

### Code Reviewer Agent

```javascript
// Publish review
await addComment(taskId, `# 🔍 Code Review Completed

## 📋 Executive Summary
...

@${assignee} - Review complete. Decide next action.`)
```

---

## 📚 Official References

- **Main Documentation:** https://developer.clickup.com/docs
- **API Reference:** https://developer.clickup.com/reference
- **Authentication:** https://developer.clickup.com/docs/authentication
- **Tasks Overview:** https://developer.clickup.com/docs/tasks
- **FAQ:** https://developer.clickup.com/docs/faq

---

## ⚠️ Limitations and Considerations

1. **Rate Limiting:** ClickUp applies rate limits. Implement retry logic with exponential backoff.

2. **Pagination:** List endpoints return maximum 100 items. Use pagination for large sets.

3. **Request Size:** Requests with many subtasks can cause timeouts. Structure requests carefully.

4. **Custom Statuses:** Status names may vary by Space/List. Verify available statuses before using.

5. **⚠️ CRITICAL - Markdown Rendering:**
   - **ALWAYS use `markdown_description`** when creating or updating tasks with markdown
   - **NEVER use `description`** for markdown content - it shows symbols literally (##, **, --)
   - `description` only for plain text or HTML
   - If markdown isn't rendering, the task was created with wrong parameter

6. **⚠️ CRITICAL - Comments Have LIMITED Markdown Support:**
   - **Comments use a structured block format, NOT full markdown**
   - Most markdown syntax shows symbols literally (##, **, --, lists)

   **✅ WHAT WORKS in Comments:**
   - ✅ Emojis: 🧪, ✅, ❌, 📋, 🚀, 🐛, etc. (use for visual emphasis)
   - ✅ Code inline: `code here` with backticks (renders correctly)
   - ✅ Plain text with line breaks (\n)
   - ✅ Simple lists with dashes (visual only, not styled)

   **❌ WHAT DOESN'T WORK in Comments:**
   - ❌ Headers: ## Header (shows literally)
   - ❌ Bold: **text** (shows literally)
   - ❌ Italic: *text* (shows literally)
   - ❌ Markdown lists: - item (shows as plain text)
   - ❌ Code blocks: ```code``` (shows literally)

   **📝 CORRECT Comment Format:**
   ```typescript
   await clickup.addComment(taskId, `
   ✅ QA COMPLETADO

   Resultado: APROBADO

   Elementos validados:
   - Funcionalidad core: Completa
   - Seguridad: Sin vulnerabilidades
   - Performance: 1.2s (objetivo: 2s)
   - Tests: 90% coverage
   - Archivo: \`core/lib/docs/parser.ts\`

   Bugs encontrados: 0

   Estado: Listo para code review
   `)
   ```

   **❌ INCORRECT Comment Format:**
   ```typescript
   // DON'T USE THIS - shows symbols literally
   await clickup.addComment(taskId, `
   ## QA COMPLETADO

   **Resultado:** APROBADO

   ### Elementos validados:
   - **Funcionalidad:** Completa
   `)
   ```

7. **Visual vs Functional Checklists:**
    - Checkboxes in `markdown_description` are **visual only**
    - Checklists created via API are **interactive** in ClickUp UI

8. **Subtasks:**
    - CANNOT have their own subtasks (no nesting)
    - Limit of 1,000 subtasks per parent task
    - Must be in the same list as the parent