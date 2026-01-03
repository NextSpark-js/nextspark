# ClickUp MCP - Guide for Subagents

## [CONFIG] Pre-established Configuration

**BEFORE any operation with ClickUp, read `.claude/config/agents.json` to get:**

```
Workspace ID: tools.clickup.workspaceId
Space ID: tools.clickup.space.id
List ID: tools.clickup.defaultList.id
User ID: tools.clickup.user.id
User Name: tools.clickup.user.name
API Token: tools.clickup.apiToken
```

> **⚠️ IMPORTANT:** All IDs in examples below use placeholders like `{WORKSPACE_ID}`, `{LIST_ID}`, etc.
> Always read actual values from `.claude/config/agents.json`.

**[NO] NEVER** search for these values manually with `getWorkspaceHierarchy()` or `searchSpaces()`.

---

## [IMPORTANT] MCP Tools vs API Workaround

**ALWAYS try MCP tools first, use API as backup ONLY if MCP fails.**

### Workflow for All ClickUp Operations:

1. **First Attempt:** Use MCP tool (e.g., `mcp__clickup__clickup_create_task`)
2. **If Error:** "No such tool available" or MCP connection fails
3. **Fallback:** Use ClickUp API directly with curl

### Common Operations with API Fallback:

**Get API Token from config/agents.json:**
```bash
API_TOKEN="{API_TOKEN}"
```

**Create Task (if MCP fails):**
```bash
curl -X POST \
  'https://api.clickup.com/api/v2/list/{LIST_ID}/task' \
  -H "Authorization: $API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Task Name",
    "description": "Task description with plans",
    "status": "backlog",
    "assignees": [{USER_ID}]
  }'
```

**Update Task (if MCP fails):**
```bash
curl -X PUT \
  'https://api.clickup.com/api/v2/task/TASK_ID' \
  -H "Authorization: $API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "description": "Updated description with checkboxes marked",
    "status": "in progress"
  }'
```

**Add Comment to Task (if MCP fails):**
```bash
curl -X POST \
  'https://api.clickup.com/api/v2/task/TASK_ID/comment' \
  -H "Authorization: $API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "comment_text": "Comment here"
  }'
```

**Update Task Status (if MCP fails):**
```bash
curl -X PUT \
  'https://api.clickup.com/api/v2/task/TASK_ID' \
  -H "Authorization: $API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "status": "qa"
  }'
```

**Send Chat Message (if MCP fails):**
```bash
curl -X POST \
  'https://api.clickup.com/api/v3/workspaces/{WORKSPACE_ID}/chat/channels/2ky4w40h-533/messages' \
  -H "Authorization: $API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "[@{USER_NAME}](#user_mention#{USER_ID}) Message here"
  }'
```

**[CRITICAL] When to Use API Workaround:**
- ✅ MCP tool returns "No such tool available" error
- ✅ MCP connection is temporarily unavailable
- ✅ Need to ensure task completion (can't be blocked by MCP issues)
- ❌ **NOT as first option** - always try MCP first

**[TIP] API Documentation:**
- ClickUp API v2: https://clickup.com/api/clickupreference/operation/CreateTask/
- ClickUp API v3 (chat): https://clickup.com/api/clickupreference/operation/SendChatMessage/

---

## [TASKS] How to Find Tasks

### Method 1: Universal Search (RECOMMENDED)

**Usage:** Find tasks by keyword or filters in the workspace.

```typescript
// Search all tasks in the Boilerplate Space
await mcp__clickup__clickup_search({
  workspace_id: "{WORKSPACE_ID}",
  keywords: "API", // Optional: search by keyword
  filters: {
    asset_types: ["task"],
    location: {
      projects: ["{SPACE_ID}"] // Space ID
    }
  }
})
```

**Advantages:**
- [YES] Works reliably
- [YES] Returns summary of all tasks
- [YES] Includes hierarchy (space > list > task)
- [YES] Shows statuses, assignees, URLs

**Example response:**
```json
{
  "results": [
    {
      "id": "86acqpbg8",
      "name": "Test task - ClickUp API",
      "status": "ideation",
      "assignees": [],
      "url": "https://app.clickup.com/t/86acqpbg8",
      "hierarchy": {
        "project": {"id": "{SPACE_ID}", "name": "Boilerplate"},
        "subcategory": {"id": "{LIST_ID}", "name": "Product Backlog"}
      }
    }
  ]
}
```

---

### Method 2: Get Tasks with Filters

**Usage:** Get tasks with specific filters (statuses, assignees, tags).

```typescript
// Get tasks from Boilerplate Space with filters
await mcp__clickup__clickup_get_workspace_tasks({
  workspace_id: "{WORKSPACE_ID}",
  space_ids: ["{SPACE_ID}"],
  detail_level: "summary", // or "detailed"
  include_closed: true, // include closed tasks
  statuses: ["in progress", "qa", "backlog"] // filter by status
})
```

**[WARNING] Note:** This method may not return results if filters are too specific. Use `clickup_search` as a reliable alternative.

---

### Method 3: Get Task by ID

**Usage:** Get complete details of a specific task.

```typescript
await mcp__clickup__clickup_get_task({
  task_id: "86acqpbg8",
  workspace_id: "{WORKSPACE_ID}",
  detail_level: "detailed", // includes description, custom fields, etc.
  subtasks: true // include subtasks
})
```

**When to use:**
- [YES] When you already have the task ID (from notification or previous search)
- [YES] To read Implementation Plan, QA Plan, Acceptance Criteria
- [YES] To get checklists and custom fields

---

## [CASES] Common Use Cases

### 1. View all tasks from Product Backlog

```typescript
const tasks = await mcp__clickup__clickup_search({
  workspace_id: "{WORKSPACE_ID}",
  filters: {
    asset_types: ["task"],
    location: {
      projects: ["{SPACE_ID}"], // Space: Boilerplate
      subcategories: ["{LIST_ID}"] // List: Product Backlog
    }
  }
})
```

### 2. Search tasks assigned to you

```typescript
const myTasks = await mcp__clickup__clickup_search({
  workspace_id: "{WORKSPACE_ID}",
  filters: {
    asset_types: ["task"],
    assignees: ["me"], // use "me" or the user ID
    location: {
      projects: ["{SPACE_ID}"]
    }
  }
})
```

### 3. Search tasks by status

```typescript
const tasksInProgress = await mcp__clickup__clickup_search({
  workspace_id: "{WORKSPACE_ID}",
  filters: {
    asset_types: ["task"],
    task_statuses: ["active"], // "unstarted", "active", "done", "closed"
    location: {
      projects: ["{SPACE_ID}"]
    }
  }
})
```

### 4. Search tasks by keyword

```typescript
const apiTasks = await mcp__clickup__clickup_search({
  workspace_id: "{WORKSPACE_ID}",
  keywords: "API",
  filters: {
    asset_types: ["task"],
    location: {
      projects: ["{SPACE_ID}"]
    }
  }
})
```

### 5. Read complete task (for development)

```typescript
// Step 1: Search task by name
const searchResults = await mcp__clickup__clickup_search({
  workspace_id: "{WORKSPACE_ID}",
  keywords: "API Rate Limiting",
  filters: {
    asset_types: ["task"],
    location: {
      projects: ["{SPACE_ID}"]
    }
  }
})

const taskId = searchResults.results[0].id

// Step 2: Get complete details
const task = await mcp__clickup__clickup_get_task({
  task_id: taskId,
  workspace_id: "{WORKSPACE_ID}",
  detail_level: "detailed",
  subtasks: true
})

// Now you have:
// - task.description (with Context, ACs, Implementation Plan, QA Plan)
// - task.status
// - task.assignees
// - task.custom_fields
// - task.subtasks
```

---

## [PROGRESS] How to Mark Progress (Check Lists)

**To mark checklist items as completed, you must update the task description with `- [x]` instead of `- [ ]`.**

### Step 1: Read current task

```typescript
const task = await mcp__clickup__clickup_get_task({
  task_id: taskId,
  workspace_id: "{WORKSPACE_ID}",
  detail_level: "detailed"
})

// task.description contains the markdown with checklists
```

### Step 2: Update description marking items as completed

```typescript
// Replace `- [ ]` with `- [x]` for completed items
const updatedDescription = task.description.replace(
  '- [ ] Crear migración para tabla notifications',
  '- [x] Crear migración para tabla notifications'
)

// Or update multiple items at once
let description = task.description
description = description.replace('- [ ] Implementar endpoint POST', '- [x] Implementar endpoint POST')
description = description.replace('- [ ] Implementar endpoint GET', '- [x] Implementar endpoint GET')

await mcp__clickup__clickup_update_task({
  task_id: taskId,
  workspace_id: "{WORKSPACE_ID}",
  markdown_description: description
})
```

**[TIPS] Best Practices:**
- [YES] Mark items as completed IMMEDIATELY after finishing them
- [YES] Add a comment when completing a phase (e.g., "Phase 1 completed")
- [NO] Don't mark items as completed before actually finishing them
- [NO] Don't forget to use `markdown_description` parameter (NOT `description`)

---

## [REVIEW] How to Leave Code Review Comments

**Use `clickup_create_task_comment` to add code review feedback.**

### Template for Code Review Comment

```typescript
await mcp__clickup__clickup_create_task_comment({
  task_id: taskId,
  workspace_id: "{WORKSPACE_ID}",
  comment_text: `
# 🔍 Code Review Completada

## 📋 Resumen Ejecutivo
- **Estado:** ✅ APROBADO / ⚠️ APROBADO CON SUGERENCIAS / 🚨 CAMBIOS REQUERIDOS
- **Feature Branch:** \`feature/feature-name\`
- **Archivos Revisados:** X archivos
- **Problemas Críticos:** 0
- **Sugerencias de Seguridad:** X
- **Optimizaciones de Performance:** X

---

## 🚨 Problemas Críticos (DEBEN SER CORREGIDOS)
✅ No se encontraron problemas críticos

---

## ⚠️ Sugerencias de Seguridad
[List security suggestions here or ✅ No issues found]

---

## 💡 Sugerencias de Performance (OPCIONALES)
[List performance suggestions here or ✅ Performance is acceptable]

---

## ✅ Lo Que Se Hizo Bien
- [Positive observation 1]
- [Positive observation 2]

---

## 📊 Métricas
- **Archivos Modificados:** X
- **Cobertura de Tests:** X%
- **Impacto en Bundle Size:** +XKB gzipped

---

## 🎯 Próximos Pasos
[Action items or approval status]

---

**Reviewer:** code-reviewer agent
**Fecha:** ${new Date().toISOString().split('T')[0]}
  `
})
```

**[IMPORTANT] Remember:**
- [YES] Always write code reviews in SPANISH
- [YES] Be specific about file names and line numbers
- [YES] Include code examples for suggestions
- [YES] Mention what was done well, not just problems
- [YES] Clearly separate critical issues from optional suggestions
- [NO] Don't change task status (code-reviewer can't move tasks to "done")

### Quick Comment Example

For simple progress updates:

```typescript
await mcp__clickup__clickup_create_task_comment({
  task_id: taskId,
  workspace_id: "{WORKSPACE_ID}",
  comment_text: "✅ Fase 1: Backend completado - Build validado sin errores"
})
```

---

## [CHAT] How to Send Chat Notifications

**Use `clickup_send_chat_message` to send notifications to chat channels with user mentions.**

### Send Message with User Tag (CORRECT FORMAT)

```typescript
// Get configuration from config/agents.json
const channelId = "2ky4w40h-533" // Claude Notifications channel
const userId = "{USER_ID}" // {USER_NAME} user ID
const userName = "{USER_NAME}"

await mcp__clickup__clickup_send_chat_message({
  workspace_id: "{WORKSPACE_ID}",
  channel_id: channelId,
  content: `[@${userName}](#user_mention#${userId}) 👋 Hola!

La tarea está lista para revisión.

🔗 **Ver tarea:** https://app.clickup.com/t/TASK_ID

---
🤖 *Mensaje enviado por Claude Code*`
})
```

**[CRITICAL] User Tag Format:**
- **✅ CORRECT:** `[@Nombre de Usuario](#user_mention#user_id)`
- **✅ Example:** `[@{USER_NAME}](#user_mention#{USER_ID})`
- **✅ Example:** `[@Federico Gonzalez](#user_mention#105980506)`
- **❌ WRONG:** `@user_id` (doesn't work)
- **❌ WRONG:** `<@user_id>` (Slack format, doesn't work in ClickUp)
- **❌ WRONG:** `@username` (doesn't work)

**[TIP] User mentions:**
- Place the tag at the beginning of the message for best visibility
- User will receive a notification in ClickUp
- The mention appears as a clickable link in the chat

**[TIP] When to Send Notifications:**
- Task is ready for review (QA completed)
- Critical issues found during code review
- Task blocked waiting for input
- Important milestones reached

### API Workaround (If MCP Tool Fails)

If you encounter "No such tool available" error with the MCP tool, you can use the API directly:

```bash
# Read API token from config/agents.json
API_TOKEN="{API_TOKEN}"

# Send message with user tag using curl
curl -X POST \
  'https://api.clickup.com/api/v3/workspaces/{WORKSPACE_ID}/chat/channels/2ky4w40h-533/messages' \
  -H "Authorization: $API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "[@{USER_NAME}](#user_mention#{USER_ID}) Mensaje aquí 🤖"
  }'
```

**[IMPORTANT] When to use API workaround:**
- MCP tool returns "No such tool available" error
- MCP connection is temporarily unavailable
- Need to ensure message delivery for critical notifications

**[TIP] The API uses the same format for user tags as the MCP tool**

---

## [WORKFLOW] Typical Subagent Workflow

### Architecture Supervisor (Refinement)

```typescript
// 1. Read assigned task
const task = await mcp__clickup__clickup_get_task({
  task_id: taskId,
  workspace_id: "{WORKSPACE_ID}",
  detail_level: "detailed"
})

// 2. Add Implementation Plan and QA Plan
await mcp__clickup__clickup_update_task({
  task_id: taskId,
  workspace_id: "{WORKSPACE_ID}",
  description: updatedDescriptionWithPlans
})

// 3. Keep in "backlog"
```

### Frontend/Backend Developer (Development)

```typescript
// 1. Read task
const task = await mcp__clickup__clickup_get_task({
  task_id: taskId,
  workspace_id: "{WORKSPACE_ID}",
  detail_level: "detailed"
})

// 2. Move to "in progress"
await mcp__clickup__clickup_update_task_status({
  task_id: taskId,
  workspace_id: "{WORKSPACE_ID}",
  status: "in progress"
})

// 3. Add comment
await mcp__clickup__clickup_create_task_comment({
  task_id: taskId,
  workspace_id: "{WORKSPACE_ID}",
  comment_text: "Starting backend development - Phase 1"
})

// 4. Check off checklist items as you complete them
```

### QA Tester (Testing)

```typescript
// 1. Read task and QA Plan
const task = await mcp__clickup__clickup_get_task({
  task_id: taskId,
  workspace_id: "{WORKSPACE_ID}",
  detail_level: "detailed"
})

// 2. Move to "qa" (ONLY QA can do this)
await mcp__clickup__clickup_update_task_status({
  task_id: taskId,
  workspace_id: "{WORKSPACE_ID}",
  status: "qa"
})

// 3. Run tests and check off checklist items

// 4. If bugs, create sub-tasks and return to "in progress"
```

---

## [TIPS] Tips for Subagents

1. **Always use `clickup_search`** as first option to find tasks
2. **Never search for workspace/space/list IDs** - they are in `config/agents.json`
3. **Use `detail_level: "summary"`** for quick searches
4. **Use `detail_level: "detailed"`** when you need to read complete plans
5. **Include `subtasks: true`** if the task may have bugs as sub-tasks
6. **All comments in SPANISH** when interacting with ClickUp

---

## [WARNING] Known Limitations

- `clickup_get_workspace_tasks` with `list_ids` may not return results
- **Solution:** Use `clickup_search` with location filters

---

## [DOCS] Complete Documentation

For all available parameters and advanced options, see the MCP tool definitions in the system.
