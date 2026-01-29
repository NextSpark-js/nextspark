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

## Auto-Sync on Update

When you run `pnpm update` in a consumer project, this package automatically syncs your `.claude/` directory via postinstall. Framework-managed files are updated while your custom files and configs are preserved.

Requirements for auto-sync:
- `.claude/` must already exist (run `nextspark setup:ai` first)
- `pnpm.onlyBuiltDependencies` must include `@nextsparkjs/ai-workflow` in your root `package.json`

You can also trigger a manual sync at any time:

```bash
nextspark sync:ai
```

## Troubleshooting

Set `NEXTSPARK_DEBUG=1` to enable verbose logging in the postinstall script:

```bash
NEXTSPARK_DEBUG=1 pnpm update @nextsparkjs/ai-workflow
```

This prints detection steps (project root, monorepo check, `.claude/` location) to help diagnose sync issues.

## For Monorepo Contributors

The `packages/ai-workflow/claude/` directory is **intentionally gitignored** (except config JSONs). The source of truth is the repo's `.claude/` working directory. Content is synced into the package at two points:

1. **`pnpm pkg:pack`** — `pack.sh` runs `sync.mjs` automatically before creating the tarball
2. **`prepack` script** — `package.json` runs `sync.mjs` as a safety net before any `npm pack`

This means the published npm package always contains all agents, commands, skills, etc. — even though git does not track them in `packages/ai-workflow/claude/`.

To sync manually (e.g. for local testing):

```bash
node packages/ai-workflow/scripts/sync.mjs
```

## Versioning

This package versions independently from `@nextsparkjs/core`. Agent, command, and skill updates ship here without requiring a core release.
