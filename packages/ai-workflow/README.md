# @nextsparkjs/ai-workflow

AI workflow templates for NextSpark applications. Provides agents, commands, skills, and configuration for AI-assisted development with multiple editor support.

## Supported Editors

| Editor | Status | Directory |
|--------|--------|-----------|
| Claude Code | Active | `claude/` |
| Cursor | Planned | `cursor/` |
| Antigravity | Planned | `antigravity/` |

## Setup

### Via CLI (recommended)

```bash
nextspark setup:ai
```

### Manual

```bash
node node_modules/@nextsparkjs/ai-workflow/scripts/setup.mjs [editor]
```

**Editor options:** `claude` (default), `cursor` (coming soon), `antigravity` (coming soon), `all`

### During project init

The `nextspark init` wizard includes an optional AI workflow setup step at the end.

## What Gets Copied

When you run setup, files are copied **individually** to your project. User-created files are never deleted.

### Overwritten (framework-managed)

| Directory | Description |
|-----------|-------------|
| `agents/*.md` | Agent definitions (22+ agents) |
| `commands/**/*.md` | Slash commands and how-to guides |
| `skills/**/*` | Skill definitions |
| `templates/**/*` | Session file templates |
| `workflows/**/*` | Workflow definitions |
| `_docs/**/*` | Internal documentation |
| `config/*.schema.json` | JSON schemas (always updated) |

### Preserved (user-owned)

| Path | Description |
|------|-------------|
| `config/context.json` | Project context config |
| `config/workspace.json` | Workspace preferences |
| `config/team.json` | Team member config |
| `config/github.json` | GitHub workflow config |
| `sessions/` | Session data (never touched) |
| Custom files in any directory | Your files are never deleted |

## Structure

```
claude/
├── agents/       # Agent definitions (26+ agents)
├── commands/     # Slash commands and how-to guides
├── config/       # Configuration files + schemas
├── skills/       # Skill definitions
├── templates/    # Session file templates
├── workflows/    # Workflow definitions
├── _docs/        # Internal documentation
└── sessions/     # Created on setup (empty)
```

## For Monorepo Contributors

If you're developing the NextSpark framework itself, use the sync script to copy your working `.claude/` directory into this package before publishing:

```bash
node packages/ai-workflow/scripts/sync.mjs
```

This syncs agents, commands, skills, templates, workflows, docs, and schemas while preserving the consumer config templates (context.json, workspace.json, team.json, github.json).

## Versioning

This package versions independently from `@nextsparkjs/core`. Agent, command, and skill updates ship here without requiring a core release.
