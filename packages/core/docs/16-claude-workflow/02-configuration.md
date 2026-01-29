# Configuration (v4.0)

> **Version 4.0** - JSON-based configuration with `agents.json`.

## Introduction

The Claude Workflow system uses configuration files in `.claude/config/` to store project details, credentials, and integration settings.

**Key Changes in v4.0:**
- **JSON Format** - Configuration moved from `agents.md` to `agents.json`
- **Structured Data** - Type-safe configuration with clear schema
- **Template System** - `agents.example.json` provides template structure
- **Package-Based Setup** - Install via `@nextsparkjs/ai-workflow` package

---

## Quick Setup

### Step 1: Run Setup Command

```bash
nextspark setup:ai
```

**What This Does:**
- Installs `@nextsparkjs/ai-workflow` package (if not already installed)
- Copies agents, commands, skills, templates to `.claude/`
- Creates configuration directory structure
- Preserves any custom files you've created in `.claude/`

### Step 2: Create Your Configuration

```bash
# Copy example to create your config
cp .claude/config/agents.example.json .claude/config/agents.json
```

### Step 3: Edit Configuration

```bash
# Open in your editor
code .claude/config/agents.json
```

---

## Configuration Structure

### File Organization

```text
.claude/config/
├── agents.json          # Your configuration (git-ignored)
├── agents.example.json  # Template for new developers
├── workflow.md          # Workflow documentation (git-ignored)
└── workflow.example.md  # Template for workflow docs
```

### What's Protected vs Updated

**Updated on `nextspark setup:ai`:**
- ✅ Agent definitions (`.claude/agents/*.md`)
- ✅ Command definitions (`.claude/commands/**/*.md`)
- ✅ Skill definitions (`.claude/skills/**/*`)
- ✅ Session templates (`.claude/templates/**/*`)
- ✅ Workflow definitions (`.claude/workflows/**/*`)
- ✅ Schema files (`.claude/config/*.schema.json`)

**Never Touched (Your Customizations Safe):**
- `.claude/config/agents.json` (your credentials)
- `.claude/config/workflow.md` (your workflow)
- `.claude/sessions/[your-sessions]/` (your work)

---

## agents.json Schema

### Complete Structure

```json
{
  "project": {
    "name": "My Project",
    "isCore": false
  },
  "testing": {
    "superadmin": {
      "email": "superadmin@cypress.com",
      "password": "Test1234"
    },
    "apiKey": "sk_test_..."
  },
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

---

## Configuration Sections

### 1. Project Details

```json
{
  "project": {
    "name": "My SaaS App",
    "isCore": false
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Project name for agent context |
| `isCore` | boolean | `true` for core framework, `false` for derived projects |

**Impact of `isCore`:**
- `true` - Agents can modify `core/` and sync to presets
- `false` - Agents restricted to theme/plugin scope

---

### 2. Testing Credentials

```json
{
  "testing": {
    "superadmin": {
      "email": "superadmin@cypress.com",
      "password": "Test1234"
    },
    "apiKey": "sk_test_62fc..."
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `superadmin.email` | string | Test user email for Cypress |
| `superadmin.password` | string | Test user password |
| `apiKey` | string | API key for API testing |

**Usage:**
- QA agents use these credentials for authentication
- API tester uses `apiKey` header for API tests
- qa-manual uses credentials for Playwright login

**Security:**
- Never commit real credentials
- Use separate test database
- Rotate keys periodically

---

### 3. ClickUp Configuration (Optional)

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
      }
    }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `apiToken` | string | ClickUp personal API token |
| `workspaceId` | string | Workspace ID |
| `space.name` | string | Space name (display) |
| `space.id` | string | Space ID |
| `defaultList.name` | string | Default list name |
| `defaultList.id` | string | Default list ID |
| `user.name` | string | Your name |
| `user.id` | string | Your ClickUp user ID |
| `notificationsChannel` | object | Chat channel for notifications (optional) |

**If Not Using ClickUp:**
Set `tools.clickup` to `null` or omit it entirely:

```json
{
  "tools": {
    "clickup": null
  }
}
```

Agents will skip ClickUp interactions and use local session files only.

---

## How to Get ClickUp Values

### API Token

1. Go to ClickUp → Settings → Apps
2. Generate Personal API Token
3. Copy token (starts with `pk_`)

### Workspace ID

1. Open any ClickUp URL
2. URL format: `app.clickup.com/[WORKSPACE_ID]/...`
3. Copy the numeric ID

### Space ID

1. Open Space in ClickUp
2. URL format: `/space/[SPACE_ID]/`
3. Copy the numeric ID

### List ID

1. Open List in ClickUp
2. URL format: `/list/[LIST_ID]/`
3. Copy the numeric ID

### User ID

```bash
# Using curl
curl -H "Authorization: YOUR_TOKEN" \
  https://api.clickup.com/api/v2/user

# Response contains: "id": 3020828
```

---

## Using Configuration in Agents

### JSON References (Not Hardcoded Values)

Agents should reference configuration paths, not hardcoded values:

```markdown
# ❌ NEVER DO THIS
- Workspace ID: 90132320273
- User: Pablo Capello (ID: 3020828)
API_KEY="sk_test_62fc..."

# ✅ ALWAYS DO THIS
- **Workspace ID**: `tools.clickup.workspaceId`
- **User**: `tools.clickup.user.name` / `tools.clickup.user.id`
API_KEY="<read from agents.json: testing.apiKey>"
```

### Reading Configuration

```typescript
// In agent/command logic
const config = JSON.parse(
  readFile('.claude/config/agents.json')
)

const workspaceId = config.tools.clickup.workspaceId
const apiKey = config.testing.apiKey
const isCore = config.project.isCore
```

---

## Example Configurations

### Example 1: Feature Development (Default)

```json
{
  "project": {
    "name": "E-commerce App",
    "isCore": false
  },
  "testing": {
    "superadmin": {
      "email": "admin@test.com",
      "password": "Test1234"
    },
    "apiKey": "sk_test_abc123"
  },
  "tools": {
    "clickup": {
      "apiToken": "pk_123456",
      "workspaceId": "12345678",
      "space": {
        "name": "Development",
        "id": "87654321"
      },
      "defaultList": {
        "name": "Sprint Backlog",
        "id": "11223344"
      },
      "user": {
        "name": "Dev User",
        "id": "9999"
      }
    }
  }
}
```

### Example 2: Core Framework Development

```json
{
  "project": {
    "name": "NextSpark",
    "isCore": true
  },
  "testing": {
    "superadmin": {
      "email": "superadmin@cypress.com",
      "password": "Test1234"
    },
    "apiKey": "sk_test_core_key"
  },
  "tools": {
    "clickup": {
      "apiToken": "pk_core_token",
      "workspaceId": "90132320273",
      "space": {
        "name": "Boilerplate",
        "id": "90139892186"
      },
      "defaultList": {
        "name": "Product Backlog",
        "id": "901318980252"
      },
      "user": {
        "name": "Core Developer",
        "id": "3020828"
      }
    }
  }
}
```

### Example 3: Solo Developer (No ClickUp)

```json
{
  "project": {
    "name": "Personal Project",
    "isCore": false
  },
  "testing": {
    "superadmin": {
      "email": "test@local.dev",
      "password": "LocalTest123"
    },
    "apiKey": "local_api_key"
  },
  "tools": {
    "clickup": null
  }
}
```

---

## Security Best Practices

### Git Ignore Configuration

Verify `.gitignore` includes:

```gitignore
# Claude workflow config (NEVER commit)
.claude/config/agents.json
.claude/config/workflow.md
.claude/sessions/
```

### What to Never Commit

- API tokens (`apiToken`, `apiKey`)
- Test passwords
- User IDs
- Any file not ending in `.example.json`

### Team Setup

**For Teams:**
1. Commit only `.example.json` files
2. Each developer creates their own `agents.json`
3. Document setup process for new team members

```bash
# New team member setup
nextspark setup:ai
cp .claude/config/agents.example.json .claude/config/agents.json
# Edit agents.json with your credentials
```

---

## Validation

### Verify Configuration

```bash
# Check file exists
ls -la .claude/config/agents.json

# Validate JSON syntax
cat .claude/config/agents.json | jq .

# Check required fields
cat .claude/config/agents.json | jq '.project.name'
cat .claude/config/agents.json | jq '.testing.apiKey'
```

### Test ClickUp Connection

```bash
# Get your user info
curl -H "Authorization: YOUR_TOKEN" \
  https://api.clickup.com/api/v2/user

# List workspaces
curl -H "Authorization: YOUR_TOKEN" \
  https://api.clickup.com/api/v2/team
```

---

## Common Issues

### Problem: "Cannot parse agents.json"

**Cause:** Invalid JSON syntax

**Solution:**
```bash
# Validate JSON
cat .claude/config/agents.json | jq .
# Fix any syntax errors (trailing commas, missing quotes)
```

### Problem: "ClickUp API token invalid"

**Cause:** Token expired or incorrect

**Solution:**
1. Verify token in ClickUp Settings → Apps
2. Check for extra spaces in config
3. Regenerate token if expired

### Problem: "Workspace/Space not found"

**Cause:** Incorrect IDs

**Solution:**
1. Verify IDs are strings (not numbers)
2. Check you have access to the workspace
3. Copy IDs directly from ClickUp URLs

---

## Migration from agents.md

If upgrading from v3.x with `agents.md`:

### Step 1: Create agents.json

```bash
cp .claude/config/agents.example.json .claude/config/agents.json
```

### Step 2: Transfer Values

Map your `agents.md` values to JSON:

| agents.md | agents.json |
|-----------|-------------|
| `Project: X` | `project.name: "X"` |
| `Is Core: True` | `project.isCore: true` |
| `API token: pk_xxx` | `tools.clickup.apiToken: "pk_xxx"` |
| `Workspace ID: 123` | `tools.clickup.workspaceId: "123"` |
| `User: Name (ID: 456)` | `tools.clickup.user.name/id` |

### Step 3: Verify

```bash
cat .claude/config/agents.json | jq .
```

---

## Next Steps

- **[Agents](./03-agents.md)** - Agent definitions and responsibilities
- **[ClickUp Integration](./08-clickup-integration.md)** - Detailed ClickUp setup
- **[Commands](./06-commands.md)** - Available commands
- **[Sessions](./05-sessions.md)** - Session file structure
