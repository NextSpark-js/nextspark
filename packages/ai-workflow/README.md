# @nextsparkjs/ai-workflow

AI workflow templates for NextSpark projects: agents, slash commands, skills and configuration for AI-assisted development, copied into your project's `.claude/` folder.

> **Stability: experimental, legacy, opt-in.** `@nextsparkjs/ai-workflow` and the `setup:ai` and `sync:ai` commands are not part of the stable 1.0 surface and may change without a deprecation period. See [Stability](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/01-stability.md).

New projects do not need it: they get small `AGENTS.md` and `CLAUDE.md` pointers and read versioned offline guides with `pnpm nextspark skills list` and `pnpm nextspark skills get <name>`. This pack is installed only when you ask for it.

## Supported editors

| Editor | Status | Target directory |
|--------|--------|------------------|
| Claude Code | Available | `.claude/` |
| Cursor | Planned | `.cursor/` |
| Antigravity | Planned | `.antigravity/` |

## Installation

```bash
pnpm exec nextspark setup:ai                    # Claude Code, the default editor
pnpm exec nextspark setup:ai --editor claude    # also: cursor, antigravity, all
```

`pnpm exec nextspark init` offers the same step at the end of the interactive wizard; `--yes` skips it. Without the CLI:

```bash
pnpm add -D @nextsparkjs/ai-workflow
node node_modules/@nextsparkjs/ai-workflow/scripts/setup.mjs [editor]
```

## Requirements

- A NextSpark project and Node.js 22.x (22.14.0 or later) or 24.x.
- Claude Code, to use what it installs.

## What gets copied

Files are copied one by one into `.claude/`. A file you created is never deleted.

| Path | Behavior |
|------|----------|
| `agents/`, `commands/`, `skills/`, `templates/`, `workflows/`, `_docs/` | Overwritten when they match a file of the package |
| `config/*.schema.json` | Always overwritten |
| `config/*.json` (your configuration) | Copied only if missing; never overwritten |
| `sessions/` | Created empty; its content is never touched |

## Updating

`pnpm exec nextspark sync:ai` copies the files again with the version you have installed (`--force` skips the confirmation).

When the package is updated, its postinstall step runs the same sync, provided `.claude/` already exists in the project (or its parent folder) and pnpm is allowed to run the package's scripts: list `@nextsparkjs/ai-workflow` in the build-script allowlist (`allowBuilds` in `pnpm-workspace.yaml` for pnpm 11 and later, `pnpm.onlyBuiltDependencies` in `package.json` for pnpm 10). Set `NEXTSPARK_DEBUG=1` to see the detection steps:

```bash
NEXTSPARK_DEBUG=1 pnpm update @nextsparkjs/ai-workflow
```

## Contributing

In the NextSpark repository `packages/ai-workflow/claude/` is gitignored except its `config` JSON files; the source is the repository's own `.claude/` folder. `pnpm pkg:pack` runs `node packages/ai-workflow/scripts/sync.mjs` before it packs, and so does the package's `prepack` script, so a published tarball carries all the agents, commands and skills.

## Documentation

- [Claude workflow guides](https://www.nextspark.dev/docs/claude-workflow/introduction)
- [NextSpark documentation](https://www.nextspark.dev/docs)

## License

MIT
