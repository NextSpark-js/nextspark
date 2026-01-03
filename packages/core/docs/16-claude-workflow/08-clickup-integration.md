# ClickUp Integration (v4.0)

> **Note:** This integration is COMPLETELY OPTIONAL. The workflow works entirely with local session files.

## Introduction

ClickUp integration is **completely optional** in the Claude Workflow system. The workflow is designed to function with or without ClickUp, using local session files as the primary source of truth.

**Key Point:** You can use any project management tool (GitHub Issues, Linear, Jira, Notion) or no tool at all.

---

## JSON Configuration

### Configuration Location

ClickUp settings are stored in `agents.json`:

```json
{
  "tools": {
    "clickup": {
      "apiToken": "pk_...",
      "workspaceId": "90132320273",
      "space": {
        "name": "Product",
        "id": "90139892186"
      },
      "defaultList": {
        "name": "Product Backlog",
        "id": "901318980252"
      },
      "user": {
        "name": "John Doe",
        "id": "3020828"
      },
      "notificationsChannel": {
        "name": "Claude Notifications",
        "id": "2ky4w40h-533"
      },
      "_docs": {
        "mcp": ".claude/tools/clickup/mcp.md",
        "api": ".claude/tools/clickup/api.md",
        "taskTemplate": ".claude/tools/clickup/templates/task.md"
      }
    }
  }
}
```

### Disabling ClickUp

Set to `null` to disable:

```json
{
  "tools": {
    "clickup": null
  }
}
```

---

## JSON Path References

### Why Use JSON Paths

Agents should **never hardcode** ClickUp values:

```markdown
# ❌ NEVER DO THIS
- Workspace ID: 90132320273
- User: Pablo Capello (ID: 3020828)
- API Token: pk_123456...

# ✅ ALWAYS DO THIS
- **Workspace ID**: `tools.clickup.workspaceId`
- **User**: `tools.clickup.user.name` / `tools.clickup.user.id`
- **API Token**: `tools.clickup.apiToken`
```

### Common JSON Paths

| Path | Description |
|------|-------------|
| `tools.clickup.apiToken` | API authentication token |
| `tools.clickup.workspaceId` | Workspace ID |
| `tools.clickup.space.id` | Space ID |
| `tools.clickup.space.name` | Space name |
| `tools.clickup.defaultList.id` | Default list ID |
| `tools.clickup.defaultList.name` | Default list name |
| `tools.clickup.user.id` | Assigned user ID |
| `tools.clickup.user.name` | Assigned user name |
| `tools.clickup.notificationsChannel.id` | Chat channel ID |

---

## Agent Permissions

### Which Agents Use ClickUp

| Agent | ClickUp Operations |
|-------|-------------------|
| product-manager | Create task, update status, add comments |
| architecture-supervisor | Update task, add technical comments |
| qa-manual | Update status to "QA", create bug subtasks |
| qa-automation | Update status, add test results |
| code-reviewer | Add review comments, update status |

### Agents Without ClickUp Access

| Agent | Why No ClickUp |
|-------|----------------|
| backend-developer | Works from session files |
| frontend-developer | Works from session files |
| db-developer | Works from session files |
| block-developer | Works from session files |
| validators | Internal validation only |

---

## ClickUp MCP Integration

### What is MCP?

Model Context Protocol (MCP) allows Claude to interact with ClickUp directly through the MCP server.

### Available MCP Tools

```typescript
// From ClickUp MCP server
mcp__clickup__clickup_create_task
mcp__clickup__clickup_get_task
mcp__clickup__clickup_update_task
mcp__clickup__clickup_create_comment
mcp__clickup__clickup_get_comments
```

### Using MCP in Agents

```markdown
# In agent definition
tools: Bash, Read, Write, mcp__clickup__*

# Usage in agent
Use mcp__clickup__clickup_create_task to create a task with:
- List ID from `tools.clickup.defaultList.id`
- Assignee from `tools.clickup.user.id`
```

---

## Task Status Flow

### Status Progression

```text
To Do → In Progress → API Testing → QA → Code Review → Done
```

### Status by Phase

| Phase | Status | Agent |
|-------|--------|-------|
| 1 | To Do | product-manager |
| 2-9 | In Progress | developers |
| 9 | API Testing | api-tester |
| 14-15 | QA | qa-manual, qa-automation |
| 16 | Code Review | code-reviewer |
| 17+ | Done | code-reviewer |

---

## Setup Instructions

### Step 1: Create ClickUp Account

1. Go to [clickup.com](https://clickup.com)
2. Sign up for free account
3. Create workspace and space

### Step 2: Generate API Token

1. Profile → Settings → Apps
2. Generate API Token
3. Copy token (starts with `pk_`)

### Step 3: Get IDs

**Workspace ID:**
```text
URL: app.clickup.com/[WORKSPACE_ID]/...
```

**Space ID:**
```text
URL: /space/[SPACE_ID]/
```

**List ID:**
```text
URL: /list/[LIST_ID]/
```

**User ID:**
```bash
curl -H "Authorization: YOUR_TOKEN" \
  https://api.clickup.com/api/v2/user
```

### Step 4: Update agents.json

```json
{
  "tools": {
    "clickup": {
      "apiToken": "pk_your_token",
      "workspaceId": "12345",
      "space": {
        "name": "Your Space",
        "id": "67890"
      },
      "defaultList": {
        "name": "Product Backlog",
        "id": "11111"
      },
      "user": {
        "name": "Your Name",
        "id": "22222"
      }
    }
  }
}
```

---

## Task Template

### Default Task Structure

Tasks created by PM follow this template:

```markdown
# Task: [Feature Name]

## Business Context
[From requirements.md]

## Acceptance Criteria
[From requirements.md with AC classification]

## Technical Approach
[From plan.md summary]

## Session Files
- requirements.md
- plan.md
- progress.md
- context.md
- tests.md
- pendings.md

## Links
- Session: `.claude/sessions/YYYY-MM-DD-feature-v1/`
```

---

## Working Without ClickUp

### Session Files as Source of Truth

All workflow information is in session files:

| File | ClickUp Equivalent |
|------|-------------------|
| requirements.md | Task description |
| plan.md | Technical approach |
| progress.md | Task status |
| context.md | Comments |
| tests.md | Test results |

### Manual Workflow

```bash
# 1. Create session folder
mkdir .claude/sessions/2025-12-15-products-crud-v1

# 2. Create requirements manually
# Edit requirements.md

# 3. Run planning
/task:plan .claude/sessions/2025-12-15-products-crud-v1

# 4. Execute (no ClickUp needed)
/task:execute .claude/sessions/2025-12-15-products-crud-v1
```

---

## Troubleshooting

### API Token Issues

```bash
# Test token
curl -H "Authorization: YOUR_TOKEN" \
  https://api.clickup.com/api/v2/user
```

**Common Issues:**
- Token expired → Regenerate in Settings
- Extra spaces in config → Trim token
- Wrong token type → Use Personal Token

### Permission Errors

**Cause:** User doesn't have access to space/list

**Solution:**
1. Verify user is member of workspace
2. Check space permissions
3. Verify list is in accessible space

### Task Not Found

**Cause:** Invalid task ID or wrong workspace

**Solution:**
1. Verify task ID from URL
2. Check workspace ID matches
3. Ensure task exists

---

## Next Steps

- **[Configuration](./02-configuration.md)** - Complete agents.json setup
- **[Commands](./06-commands.md)** - Commands that use ClickUp
- **[Sessions](./05-sessions.md)** - Session file structure
- **[Customization](./10-customization.md)** - Alternative tools
