# Customization (v4.0)

> **Version 4.0** - Adapting the 19-phase workflow to your needs.

## Introduction

The Claude Workflow system is designed to be **highly customizable**. Every component—agents, commands, sessions, gates—can be adapted, simplified, or extended to match your team's needs.

**Core Philosophy:** "Use what helps, skip what doesn't."

---

## Workflow Simplification

### Full Workflow (19 phases)

```text
PM → Architect → Foundation → Backend → Blocks → Frontend → QA → Finalization
```

### Simplified Workflows

#### Solo Developer (6 phases)

```text
Plan → DB → Backend → Frontend → Test → Done
```

**Phases to skip:**
- PM agent (write requirements manually)
- All validators except final
- Code reviewer (self-review)
- Documentation (optional)

**Configuration:**

```json
{
  "workflow": {
    "skipPhases": [1, 3, 4, "3b", "4b", 12, 13, 16, 17, 18, 19],
    "simplifiedGates": true
  }
}
```

#### Small Team (10 phases)

```text
PM → Architect → DB → Backend → Frontend → QA Manual → QA Auto → Review → Done
```

**Phases to keep:**
- Planning (1-2)
- Database (5-6)
- Backend (7-9)
- Frontend (11-13)
- QA (14-15)
- Review (16)

**Skip:**
- Plugin phases (3-4)
- Theme phases (3b-4b)
- Block phase (10)
- Unit tests (17)
- Documentation (18-19)

---

## Agent Customization

### Minimal Agent Set (4 agents)

```text
.claude/agents/
├── planner.md        # Combined PM + Architect
├── developer.md      # Combined Backend + Frontend
├── qa.md             # Combined QA Manual + Automation
└── reviewer.md       # Code Reviewer
```

### Standard Agent Set (10 agents)

```text
.claude/agents/
├── product-manager.md
├── architecture-supervisor.md
├── db-developer.md
├── backend-developer.md
├── frontend-developer.md
├── backend-validator.md
├── qa-manual.md
├── qa-automation.md
├── code-reviewer.md
└── documentation-writer.md
```

### Full Agent Set (23+ agents)

All agents as defined in v4.0 plus custom additions.

---

## Custom Workflows by Dev Type

### Feature Development (Default)

**PM Decisions:**
- Dev Type: Feature
- DB Policy: Reset Allowed
- Requires Blocks: No

**Phases:** 14/19 (skip plugin, theme, blocks, optional finalization)

```text
1 → 2 → 5 → 6 → 7 → 8 → 9 → 11 → 12 → 13 → 14 → 15 → 16 → 17
```

---

### Plugin Development

**PM Decisions:**
- Dev Type: New Plugin
- DB Policy: Reset Allowed
- Requires Blocks: No
- Complexity: Service
- Has Entities: No

**Phases:** 16/19 (add plugin, skip theme, blocks)

```text
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 11 → 12 → 13 → 14 → 15 → 16 → 17
```

**Plugin Testing:** Uses `plugin-sandbox` theme

---

### Theme Development

**PM Decisions:**
- Dev Type: New Theme
- DB Policy: Reset Allowed
- Requires Blocks: Yes (usually)

**Phases:** 16/19 (add theme, blocks, skip plugin)

```text
1 → 2 → 3b → 4b → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17
```

---

### Core Framework Change

**PM Decisions:**
- Dev Type: Core Change
- DB Policy: Incremental Migrations
- Requires Blocks: No

**Phases:** 14/19 (same as feature, but `scope.core: true`)

**Special Considerations:**
- Extra care with migrations
- More thorough code review
- Impact analysis required

---

## Creating Custom Agents

### Agent File Structure

```markdown
---
model: sonnet
color: green
---

# Agent Name

## Role
Brief description of what this agent does.

## Responsibilities
- Responsibility 1
- Responsibility 2

## Tools
- Tool 1
- Tool 2

## Inputs
- What the agent reads

## Outputs
- What the agent produces

## Session Files
- Files this agent modifies
```

### Example: Security Specialist Agent

```markdown
---
model: sonnet
color: red
---

# Security Specialist

## Role
Validates security aspects of implementation.

## Responsibilities
- Review authentication flows
- Check for OWASP vulnerabilities
- Validate input sanitization
- Audit API security

## Tools
- Bash, Glob, Grep, Read
- Security scanning tools

## Inputs
- plan.md (technical approach)
- API routes
- Authentication code

## Outputs
- Security report in context.md
- Recommended fixes
```

---

## Creating Custom Commands

### Command File Structure

```markdown
---
description: Brief description for command list
---

# Command Name

Instructions for the command.

**Input:**
{{{ input }}}

## Phase 1: First Step
Launch agent X to do...

## Phase 2: Second Step
Launch agent Y to do...

## Output
What this command produces.
```

### Example: Security Audit Command

```markdown
---
description: Run security audit on current implementation
---

# Security Audit

Perform comprehensive security review.

**Target:**
{{{ input }}}

## Phase 1: Static Analysis
Launch `security-specialist` to:
1. Scan for OWASP vulnerabilities
2. Check authentication flows
3. Review input validation

## Phase 2: Report
Generate security report in `context.md`.

## Output
- Security findings
- Recommended fixes
- Risk assessment
```

---

## Gate Customization

### Removing Gates

To skip specific gates, add to session scope:

```json
{
  "skipGates": ["frontend-validator", "unit-test-writer"]
}
```

### Adding Custom Gates

Create validator agent and add to workflow:

```markdown
# performance-validator.md
---
model: sonnet
color: orange
---

## Role
Validates performance requirements.

## Validation Criteria
- [ ] Page load < 3s
- [ ] API response < 500ms
- [ ] Bundle size < 500KB
```

---

## Session Customization

### Minimal Session (3 files)

```text
.claude/sessions/feature-v1/
├── requirements.md    # What to build
├── progress.md        # Track completion
└── context.md         # Notes and decisions
```

### Standard Session (8 files)

Full v4.0 session structure as documented.

### Extended Session (10+ files)

```text
.claude/sessions/feature-v1/
├── requirements.md
├── clickup_task.md
├── scope.json
├── plan.md
├── progress.md
├── context.md
├── tests.md
├── pendings.md
├── security-audit.md      # Custom
├── performance-report.md  # Custom
└── deployment-plan.md     # Custom
```

---

## Retry Logic Customization

### Default Retry Points

| Gate | Default Retries |
|------|-----------------|
| api-tester | 3 |
| qa-manual | 3 |
| qa-automation | Smart (tag-based) |

### Custom Retry Configuration

```json
{
  "retryConfig": {
    "api-tester": {
      "maxRetries": 5,
      "backoff": "exponential"
    },
    "qa-automation": {
      "maxRetries": 3,
      "tagStrategy": "scope-based"
    }
  }
}
```

---

## Tool Integration

### Alternative to ClickUp

**GitHub Issues:**
```json
{
  "tools": {
    "clickup": null,
    "github": {
      "repo": "owner/repo",
      "project": "Development Board"
    }
  }
}
```

**Linear:**
```json
{
  "tools": {
    "clickup": null,
    "linear": {
      "teamId": "TEAM-123",
      "projectId": "PROJECT-456"
    }
  }
}
```

**No External Tool:**
```json
{
  "tools": {
    "clickup": null
  }
}
```

---

## Workflow Templates

### Hotfix Workflow

```bash
# Quick fix without full workflow
/fix:bug "Description of the bug"
```

Phases: Locate → Fix → Test → Review

### Documentation-Only Workflow

```bash
# Document existing feature
/doc:feature existing-feature
```

Phases: Analyze → Document → Review

### Release Workflow

```bash
# Create release
/release:version patch
```

Phases: Analyze → Version → Tag → Push

---

## Best Practices

### Start Simple

1. Begin with minimal workflow
2. Add complexity as needed
3. Remove unused components

### Document Customizations

Keep `workflow.md` updated with:
- Custom agents added
- Phases skipped
- Gates modified
- Special procedures

### Team Alignment

When customizing for teams:
1. Document all changes
2. Train team members
3. Update CLAUDE.md
4. Create onboarding guide

---

## Migration Guide

### From v3.x to v4.0

1. **Update agents.json:**
   ```bash
   cp .claude/config/agents.md .claude/config/agents.md.backup
   # Migrate values to agents.json
   ```

2. **Update commands:**
   - `/init-task` → `/task:requirements` + `/task:plan`
   - `/execute-task` → `/task:execute`

3. **Update sessions:**
   - Add new files (scope.json, tests.md, pendings.md)
   - Update file naming

4. **Test workflow:**
   ```bash
   /task:requirements Test migration
   /task:plan
   /task:execute
   ```

---

## Next Steps

- **[Agents](./03-agents.md)** - All 23 agents
- **[Commands](./06-commands.md)** - All 24 commands
- **[Quality Gates](./07-quality-gates.md)** - Gate customization
- **[PM Decisions](./09-pm-decisions.md)** - Workflow control
