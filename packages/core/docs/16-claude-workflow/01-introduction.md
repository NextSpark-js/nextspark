# Claude Workflow Introduction (v4.0)

> **Version 4.0** - 19-phase workflow with 9 quality gates.

## Introduction

The Claude Workflow system is an **agent-based development methodology** that uses Claude Code to organize and execute development tasks through specialized AI agents. This system provides a structured workflow for feature development, from requirements definition to code review.

> **Important:** This documentation describes ONE possible approach to AI-assisted development. The system is **highly customizable** - you can simplify it to 3 phases for solo work, or extend it for enterprise teams. Use what helps, skip what doesn't. See [Customization](./10-customization.md) for adapting this workflow to your needs.

**v4.0 Highlights:**
- **19 Phases** organized in 7 blocks
- **9 Quality Gates** with fail-fast validation
- **23 Specialized Agents** (+ 2 utility agents)
- **24 Slash Commands** for workflow automation
- **8 Session Files** per feature
- **4 PM Decisions** controlling workflow execution
- **AC Classification** system ([AUTO]/[MANUAL]/[REVIEW])

---

## What's New in v4.0

### Comparison with Previous Versions

| Aspect | v3.x | v4.0 |
|--------|------|------|
| Phases | 5-9 | 19 |
| Quality Gates | 1 | 9 |
| Agents | 10-12 | 25 |
| Commands | 11 | 24 |
| Session Files | 4 | 8 |
| PM Decisions | 0 | 4 |
| Retry Logic | None | 3 points |
| Plugin Workflow | None | Complete system |

### Key New Features

- **Quality Gates** - Validation checkpoints that block progress if failed
- **PM Decisions** - 4 mandatory questions controlling workflow
- **AC Classification** - Tags defining how criteria are verified
- **Smart Retry** - Automatic fix-and-retry with Cypress grep tags
- **Plugin System** - Complete workflow for plugin development
- **JSON Configuration** - `agents.json` replaces `agents.md`

---

## Quick Overview

### The 7 Blocks

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    WORKFLOW v4.0 - 7 BLOCKS                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  BLOCK 1: Planning (Phases 1-2)                                         │
│  └── product-manager → architecture-supervisor                          │
│                                                                          │
│  BLOCK 2: Foundation (Phases 3-6, conditional)                          │
│  └── plugin-creator → theme-creator → db-developer → validators        │
│                                                                          │
│  BLOCK 3: Backend TDD (Phases 7-9)                                      │
│  └── backend-developer → backend-validator → api-tester [RETRY]        │
│                                                                          │
│  BLOCK 4: Blocks (Phase 10, conditional)                                │
│  └── block-developer                                                    │
│                                                                          │
│  BLOCK 5: Frontend (Phases 11-13)                                       │
│  └── frontend-developer → frontend-validator → functional-validator    │
│                                                                          │
│  BLOCK 6: QA (Phases 14-15)                                             │
│  └── qa-manual [RETRY] → qa-automation                                  │
│                                                                          │
│  BLOCK 7: Finalization (Phases 16-19)                                   │
│  └── code-reviewer → unit-test-writer → docs → demo (optional)         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### The 9 Quality Gates

| # | Gate | Phase | Retry |
|---|------|-------|-------|
| 1 | plugin-validator | 4 | No (conditional) |
| 2 | theme-validator | 4b | No (conditional) |
| 3 | db-validator | 6 | No |
| 4 | backend-validator | 8 | No |
| 5 | api-tester | 9 | Yes (3x) |
| 6 | frontend-validator | 12 | No |
| 7 | functional-validator | 13 | No |
| 8 | qa-manual | 14 | Yes (3x) |
| 9 | qa-automation | 15 | Smart |

*Gates 1-2 only execute for plugin/theme development.*

---

## Key Concepts

### 1. Agents (25 total)

Specialized AI assistants organized by workflow block:

| Block | Agents |
|-------|--------|
| Planning | product-manager, architecture-supervisor |
| Foundation | plugin-creator, plugin-validator, theme-creator, theme-validator, db-developer, db-validator |
| Backend | backend-developer, backend-validator, api-tester |
| Blocks | block-developer |
| Frontend | frontend-developer, frontend-validator, functional-validator |
| QA | qa-manual, qa-automation |
| Finalization | code-reviewer, unit-test-writer, documentation-writer, demo-video-generator |
| Utility | release-manager, dev-plugin, workflow-maintainer |

### 2. Sessions (8 files)

Each feature gets a session folder with 8 files:

```text
.claude/sessions/2025-12-15-products-crud-v1/
├── requirements.md    # PM: Requirements with AC classification
├── clickup_task.md    # PM: ClickUp task context (optional)
├── scope.json         # PM: Modification permissions
├── plan.md            # Architect: Technical implementation plan
├── progress.md        # All: Phase completion tracking
├── context.md         # All: Agent coordination log
├── tests.md           # Validators+QA: Test docs and coverage
└── pendings.md        # Any: Future iteration items
```

### 3. Commands (24 total)

Pre-defined workflows organized by category:

| Category | Commands |
|----------|----------|
| Task | requirements, plan, execute, refine, scope-change, pending |
| Database | entity, sample, fix |
| Testing | write, run, fix |
| Block | create, update, validate, list, docs |
| Plugin | create |
| Fix | build, bug |
| Doc | feature, demo-feature |
| Release | version |
| Workflow | update |

### 4. PM Decisions (4 mandatory)

Questions asked at the start of every task:

1. **Dev Type** - Feature / New Theme / New Plugin / Plugin+Theme / Core Change
2. **DB Policy** - Reset Allowed / Incremental Migrations
3. **Requires Blocks** - Yes / No
4. **Plugin Config** - Complexity, Has Entities (if plugin)

### 5. AC Classification

Every acceptance criteria tagged for verification:

| Tag | Verified By | Phase |
|-----|-------------|-------|
| `[AUTO]` | qa-automation | 15 |
| `[MANUAL]` | qa-manual | 14 |
| `[REVIEW]` | code-reviewer | 16 |

---

## Typical Workflow

### Step 1: Requirements

```bash
/task:requirements Add products CRUD functionality
```text
- PM gathers requirements
- Asks 4 PM Decisions
- Creates session folder
- Classifies acceptance criteria

### Step 2: Planning

```bash
/task:plan .claude/sessions/2025-12-15-products-crud-v1
```text
- PM creates ClickUp task (optional)
- Architect creates technical plan
- Initializes progress tracking

### Step 3: Execution

```bash
/task:execute .claude/sessions/2025-12-15-products-crud-v1
```text
- Executes 19 phases automatically
- Gates validate at checkpoints
- Retry logic on failures
- Code review and approval

### Result

- Feature implemented
- All gates passed
- Tests at 100%
- Code reviewed
- Ready for merge

---

## When to Use This Workflow

### Good Use Cases

**Complex Features**
- Multi-phase implementation (backend + frontend + DB)
- Require detailed planning
- Need quality validation

**Team Development**
- Multiple developers on same codebase
- Clear handoffs required
- Decision history needed

**Quality-Critical Projects**
- Systematic testing required
- Code review mandatory
- Complete audit trail

### When Simpler is Better

**Quick Fixes**
- Single-file changes
- Bug hotfixes
- Minor tweaks

**Prototyping**
- Rapid experimentation
- Exploring ideas
- Learning projects

---

## Requirements

### Required

- **Claude Code** - AI-powered code editor
- **NextSpark** - This project as base

### Optional

- **ClickUp Account** - For project management
- **ClickUp MCP** - Model Context Protocol integration

---

## Getting Started

### Quick Start

```bash
# 1. Run setup
npm run setup:claude

# 2. Create configuration
cp .claude/config/agents.example.json .claude/config/agents.json

# 3. Edit configuration
code .claude/config/agents.json

# 4. Start a task
/task:requirements Add user authentication
```

### Documentation Structure

| Doc | Purpose |
|-----|---------|
| **[Configuration](./02-configuration.md)** | agents.json setup |
| **[Agents](./03-agents.md)** | 23 agents by block |
| **[Workflow Phases](./04-workflow-phases.md)** | 19 phases in 7 blocks |
| **[Sessions](./05-sessions.md)** | 8 session files |
| **[Commands](./06-commands.md)** | 24 slash commands |
| **[Quality Gates](./07-quality-gates.md)** | 8 gates with retry |
| **[ClickUp Integration](./08-clickup-integration.md)** | Optional PM tool |
| **[PM Decisions](./09-pm-decisions.md)** | 4 decisions + AC |
| **[Customization](./10-customization.md)** | Adapt workflows |

---

## Philosophy

**"Fail Fast, Fix Fast"**

The v4.0 workflow is built around quality gates that catch issues early:
- Gates block progress if validation fails
- Developers fix issues immediately
- Retry logic handles transient failures
- No issues accumulate to later phases

**"Structured but Flexible"**

- 19 phases provide structure
- Conditional phases skip what's not needed
- PM Decisions control execution
- Customize to your needs

---

## Next Steps

1. **[Configuration](./02-configuration.md)** - Set up agents.json
2. **[Workflow Phases](./04-workflow-phases.md)** - Understand the 19 phases
3. **[Commands](./06-commands.md)** - Learn available commands
4. **[Quality Gates](./07-quality-gates.md)** - Understand validation
