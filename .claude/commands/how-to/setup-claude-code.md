# /how-to:setup-claude-code

Configure Claude Code AI workflow system for your project.

**Aliases:** `/how-to:setup-ai`, `/how-to:configure-claude`

---

## Syntax

```
/how-to:setup-claude-code
/how-to:setup-claude-code --validate
```

---

## Overview

This is the **first step** when starting with NextSpark. Before you can use any AI-assisted development features, you need to configure Claude Code's workflow system.

**What you'll configure:**
1. `context.json` - Monorepo vs Consumer project type
2. `workspace.json` - Your personal preferences, active user, and task manager config
3. `team.json` - Team members and their platform IDs
4. `github.json` - Git workflow conventions (branches, commits, PRs)

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /how-to:setup-claude-code                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Introduction                                                │
│     - Explain the config file structure                        │
│     - What each file does                                      │
│     ↓                                                           │
│  2. Step 1: Context Configuration                               │
│     - Determine: monorepo or consumer?                         │
│     - Create/update .claude/config/context.json                │
│     ↓                                                           │
│  3. Step 2: Team Configuration                                  │
│     - Add team members                                         │
│     - Configure platform IDs (GitHub, task manager)            │
│     - Create/update .claude/config/team.json                   │
│     ↓                                                           │
│  4. Step 3: Workspace Configuration                             │
│     - Set active user (from team.json)                         │
│     - Set language preference                                  │
│     - Configure task manager integration                       │
│     - Create/update .claude/config/workspace.json              │
│     ↓                                                           │
│  5. Step 4: GitHub Workflow Configuration                       │
│     - Configure gitflow (develop → qa → main)                  │
│     - Set branch naming conventions                            │
│     - Set commit message patterns                              │
│     - Create/update .claude/config/github.json                 │
│     ↓                                                           │
│  6. Validation                                                  │
│     - Verify all config files exist                            │
│     - Validate JSON syntax                                     │
│     - Check required fields                                    │
│     ↓                                                           │
│  8. Next Steps                                                  │
│     - Ready for /how-to:setup-database                         │
│     - Or /session:start for development                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Content

### Step 1: Context Configuration

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 STEP 1 OF 4: Project Context
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

First, let's determine your project type.

📋 MONOREPO (Core Framework Development)
   - You're developing the NextSpark framework itself
   - You CAN modify core/ directory
   - You CAN modify any theme

📋 CONSUMER (Application Development)
   - You're building an app WITH NextSpark
   - Core is READ-ONLY (via npm packages)
   - You can only modify your project

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What type of project is this?

[1] Monorepo - I'm developing NextSpark core
[2] Consumer - I'm building an app with NextSpark
```

**After selection, create `.claude/config/context.json`:**

```json
{
  "$schema": "./context.schema.json",
  "context": "monorepo"  // or "consumer"
}
```

---

### Step 2: Team Configuration

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 STEP 2 OF 4: Team Members
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Now let's configure your team. This enables:
- Proper git commit attribution
- Task manager assignment
- Code review workflows

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

How many people are on your team?

[1] Just me (solo developer)
[2] Small team (2-5 people)
[3] I'll configure this later
```

**For each team member, collect:**

```
Team Member #1:
- Full name: _______________
- Initials (for branches): __
- Role: [lead | developer | reviewer]
- GitHub username: _______________
- Task Manager ID (optional): _______________
- Can review PRs? [yes/no]
- Can merge to main? [yes/no]
```

**Create `.claude/config/team.json`:**

```json
{
  "$schema": "./team.schema.json",
  "members": [
    {
      "name": "Pablo Capello",
      "initials": "pc",
      "role": "lead",
      "ids": {
        "github": "capellopablo",
        "taskManager": "3020828",
        "slack": ""
      },
      "permissions": {
        "canReview": true,
        "canMerge": true,
        "canApproveProduction": true
      }
    }
  ],
  "roles": {
    "lead": {
      "canReview": true,
      "canMerge": true,
      "canApproveProduction": true
    },
    "developer": {
      "canReview": true,
      "canMerge": false,
      "canApproveProduction": false
    },
    "reviewer": {
      "canReview": true,
      "canMerge": false,
      "canApproveProduction": false
    }
  },
  "reviewRules": {
    "minRequired": 1,
    "requireLeadForProduction": false,
    "requireQaForProduction": false
  }
}
```

---

### Step 3: Workspace Configuration

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 STEP 3 OF 4: Your Workspace
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is YOUR personal workspace configuration.
Each developer has their own workspace.json.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Who are you? (Select from team members)

[1] Pablo Capello
[2] Other team member...

Preferred language: (use language already chosen in /how-to:start,
or read from workspace.json preferences.language if available.
Only ask if no language has been selected yet in this session.)

Do you use a task manager?

[1] No task manager
[2] ClickUp
[3] Jira
[4] Linear
[5] Asana
```

**Create `.claude/config/workspace.json`:**

```json
{
  "$schema": "./workspace.schema.json",
  "project": {
    "name": "My NextSpark App"
  },
  "activeUser": "Pablo Capello",
  "preferences": {
    "language": "es",
    "defaultWorkflow": "standard",
    "autoCommit": false,
    "verboseOutput": true
  },
  "taskManager": {
    "enabled": true,
    "provider": "clickup",
    "syncWithSession": true,
    "autoUpdateStatus": true,
    "defaultList": ""
  },
  "integrations": {
    "github": {
      "enabled": true
    }
  }
}
```

---

### Step 4: GitHub Workflow Configuration

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 STEP 4 OF 4: Git Workflow
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Let's configure your git workflow conventions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What branch strategy do you use?

[1] Gitflow (feature → develop → qa → main)
[2] GitHub Flow (feature → main)
[3] Custom (I'll configure manually)

Branch naming convention?

[1] {type}/{issue-key}-{description}-{initials}
    Example: feature/CU-abc123-add-products-pc

[2] {type}/{description}
    Example: feature/add-products

Commit message pattern?

[1] [{issue-key}] {description}
    Example: [CU-abc123] Add products entity

[2] {type}: {description}
    Example: feat: Add products entity
```

**Create `.claude/config/github.json`:**

```json
{
  "$schema": "./github.schema.json",
  "gitflow": {
    "enabled": true,
    "environments": ["develop", "qa", "main"],
    "featureBranch": {
      "baseBranch": "main",
      "targetBranch": "develop"
    },
    "hotfixBranch": {
      "baseBranch": "main",
      "targetBranch": "main",
      "skipEnvironments": true
    }
  },
  "branches": {
    "pattern": "{type}/{issue-key}-{description}-{initials}",
    "types": ["feature", "fix", "hotfix", "refactor", "docs", "test"],
    "examples": [
      "feature/CU-abc123-add-products-pc",
      "fix/CU-def456-login-error-pc",
      "hotfix/critical-payment-fix-pc"
    ]
  },
  "commits": {
    "pattern": "[{issue-key}] {description}",
    "types": ["feat", "fix", "refactor", "docs", "test", "chore"],
    "examples": [
      "[CU-abc123] Add products entity with CRUD",
      "[CU-def456] Fix login redirect issue"
    ]
  },
  "pullRequests": {
    "titlePattern": "[{issue-key}] {description}",
    "bodyTemplate": "## Summary\n\n{summary}\n\n## Changes\n\n{changes}\n\n## Testing\n\n{testing}",
    "labels": {
      "auto": true,
      "mapping": {
        "feature": "enhancement",
        "fix": "bug",
        "hotfix": "critical",
        "docs": "documentation"
      }
    }
  },
  "reviewers": {
    "source": ".claude/config/team.json",
    "askUserToSelect": true
  }
}
```

---

## Validation

After all steps are complete:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ CONFIGURATION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Validating your configuration...

✓ .claude/config/context.json     - Valid
✓ .claude/config/team.json        - Valid
✓ .claude/config/workspace.json   - Valid
✓ .claude/config/github.json      - Valid

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎉 Claude Code is ready!

Your configuration:
├── Context: monorepo
├── Active User: Pablo Capello
├── Language: Spanish
├── Task Manager: ClickUp (enabled)
└── Git Flow: feature → develop → qa → main

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do next?

[1] Continue to /how-to:setup-database
[2] Start development with /session:start
[3] Return to /how-to:start
```

---

## Config Files Summary

| File | Purpose | Shared? |
|------|---------|---------|
| `context.json` | Project type (monorepo/consumer) | Yes |
| `team.json` | Team members and roles | Yes |
| `workspace.json` | Personal preferences + task manager config | No (per developer) |
| `github.json` | Git workflow conventions | Yes |

---

## Troubleshooting

### Missing config files

```bash
# Check if .claude/config/ exists
ls -la .claude/config/

# If not, create the directory
mkdir -p .claude/config/
```

### Invalid JSON syntax

```bash
# Validate JSON files
cat .claude/config/workspace.json | jq .
```

### Team member not found

Ensure `workspace.json.activeUser` matches exactly a `team.json.members[].name`.

---

## Related Commands

| Command | Description |
|---------|-------------|
| `/how-to:setup-database` | Next step: Configure database |
| `/how-to:start` | Return to learning hub |
| `/session:start` | Start a development session |

---

## Related Skills

- `.claude/skills/github/SKILL.md` - GitHub workflow patterns
- `.claude/skills/session-management/SKILL.md` - Session configuration
