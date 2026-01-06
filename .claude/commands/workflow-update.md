---
description: "[Workflow] Maintain, create, or modify Claude Code AI workflow system"
---

# Workflow Maintenance

You are managing the Claude Code AI Workflow system. This includes agents, commands, configuration, and documentation.

**Request:**
{{{ input }}}

---

## Pre-Flight Checks

**Before ANY modification, verify:**

```typescript
// Step 1: Read configuration to understand project type
const config = await Read('.claude/config/agents.json')
const isCore = config.project?.isCore === true

// Step 2: If core project, check preset folder exists
if (isCore) {
  await Glob('core/presets/ai-workflow/claude/**/*')
}
```

---

## Launch Workflow Maintainer Agent

**Use the `workflow-maintainer` agent for this task.**

The agent has deep understanding of:

### Architecture
- **`.claude/`** - Developer's working directory (gitignored)
- **`core/presets/ai-workflow/claude/`** - Templates for all developers (committed)
- **JSON Configuration** - `agents.json` for credentials, `agents.example.json` for templates

### Key Directories
```
.claude/
├── agents/                 # 22+ agent definitions
├── commands/               # Slash commands
├── config/
│   ├── agents.json         # Real credentials (NEVER commit)
│   ├── agents.example.json # Template for new developers
│   └── workflow.md         # Workflow documentation
├── tools/
│   ├── clickup/            # ClickUp integration docs
│   └── sessions/templates/ # 8 session file templates
└── README.md               # System documentation
```

### Configuration Structure
```json
{
  "project": { "name": "...", "isCore": true|false },
  "testing": {
    "superadmin": { "email": "...", "password": "..." },
    "apiKey": "..."
  },
  "tools": {
    "clickup": {
      "workspaceId": "...",
      "space": { "name": "...", "id": "..." },
      "defaultList": { "name": "...", "id": "..." },
      "user": { "name": "...", "id": "..." }
    }
  }
}
```

---

## Operations

### Creating New Agent
1. Analyze what capabilities the agent needs
2. Determine where it fits in the 19-phase workflow
3. Create file in `.claude/agents/`
4. If core project, ask about syncing to preset
5. Update CLAUDE.md if needed

### Modifying Existing Agent
1. Read current agent content
2. Analyze impacts on other agents/commands
3. Make changes to `.claude/agents/`
4. If core project, sync to preset
5. Update related documentation

### Creating New Command
1. Use namespace:action pattern (e.g., `task:plan`, `db:entity`)
2. Create file in `.claude/commands/`
3. If core project, sync to preset
4. Update CLAUDE.md

### Modifying Configuration
1. Only modify `.claude/config/agents.json` for real values
2. Update structure changes in `agents.example.json`
3. If core project, update preset's example file
4. **NEVER put real credentials in committed files**

---

## CRITICAL Rules

### JSON References (Not Hardcoded Values)

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

### Core vs Derived Project

```typescript
if (config.project?.isCore === true) {
  // This is the CORE FRAMEWORK
  // Ask user before syncing changes to preset
  await AskUserQuestion({
    questions: [{
      header: "Preset Sync",
      question: "Update presets in core/presets/ai-workflow/claude/?",
      options: [
        { label: "Yes - Update both", description: "Modify .claude/ AND sync to presets" },
        { label: "No - Only .claude/", description: "Only modify local .claude/ directory" }
      ],
      multiSelect: false
    }]
  })
} else {
  // Derived project - only modify .claude/
  // Do NOT touch core/presets/
}
```

---

## Impact Analysis

When modifying the workflow system, the agent checks:

- [ ] **Other Agents**: Do any agents reference the modified agent?
- [ ] **Commands**: Do any commands invoke the modified agent?
- [ ] **Workflow**: Does the workflow documentation need updating?
- [ ] **CLAUDE.md**: Does the main documentation need updating?
- [ ] **Session Templates**: Are session file templates affected?
- [ ] **Presets**: If core project, should presets be synced?

---

## Output Format

After completing modifications:

```markdown
## Workflow Changes Complete

### Files Modified
- `.claude/agents/agent-name.md` - [Created/Updated] - Description
- `.claude/commands/command-name.md` - [Created/Updated] - Description

### Preset Sync
- [x] Synced to `core/presets/ai-workflow/claude/` (if applicable)
- [ ] Not synced (derived project or user declined)

### Impact Analysis
- **Other agents affected**: [List or "None"]
- **Commands affected**: [List or "None"]
- **Workflow changes**: [Description or "None"]

### Verification
- [x] No hardcoded configuration in agents
- [x] Valid frontmatter structure
- [x] Tools list appropriate
- [x] Workflow coherence maintained
```

---

**Now launch the `workflow-maintainer` agent to process the request above.**
