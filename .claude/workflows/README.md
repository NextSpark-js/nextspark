# Workflows

Four workflow types based on task complexity, risk, and mock requirements.

---

## Overview

| Workflow | T-Shirt | Session | Mock | Use Case |
|----------|---------|---------|------|----------|
| **TWEAK** | XS - S | `tweaks/` | No | Small adjustments, config changes, typos |
| **BLOCKS** | XS - S | `blocks/` | Required | Block development from design mocks |
| **TASK** | S - M - L | `tasks/` | Optional | Medium features, structured work |
| **STORY** | L - XL | `stories/` | Optional | Complex features, full CRUD, DB changes |

---

## Initial Questions (Graduated System)

All workflows start with **Claude asking questions** to gather context. The number of questions varies by workflow:

| Question | TWEAK | BLOCKS | TASK | STORY |
|----------|:-----:|:------:|:----:|:-----:|
| **1. Task Manager** | ✓ | ✓ | ✓ | ✓ |
| **2. Database Policy** | - | - | ✓ | ✓ |
| **3. Entity Type** | - | - | ✓ | ✓ |
| **4. Blocks** | - | ✓* | ✓ | ✓ |
| **5. Mock** | - | ✓** | ✓ | ✓ |
| **5a. Mock For** | - | - | (if mock)*** | (if mock)*** |
| **5b. Mock Source** | ✓** | ✓** | (if mock) | (if mock) |
| **5c. Mock Complexity** | - | - | (if mock) | (if mock) |
| **6. Testing** | ✓ | ✓ | ✓ | ✓ |
| **7. Documentation** | ✓ | ✓ | ✓ | ✓ |

*BLOCKS: Asks Block Type and Block Decision (more specific)
**BLOCKS: Mock is required (source always asked)
***If Q4 = blocks, defaults to "Page builder blocks"

### Key Differences

| Aspect | TWEAK | BLOCKS | TASK | STORY |
|--------|-------|--------|------|-------|
| **Questions** | 3 core | 7 block-specific | 7 standard | 7 standard |
| **Who asks** | Claude | Claude | Claude | Claude |
| **Who creates requirements** | - | - | Claude | PM subagent |
| **Who creates plan** | - | - | Claude (light) | Arc subagent |
| **Mock support** | No | Required | Optional | Optional |

### Flow by Workflow

```
TWEAK:  Claude asks 3 → Claude implements directly
BLOCKS: Claude asks 4 → Mock upload → mock-analyst → block-developer → visual-comparator
TASK:   Claude asks 7 → [Mock upload] → Claude creates requirements.md → Claude executes
STORY:  Claude asks 7 → [Mock upload] → PM creates requirements.md → Arc creates plan.md → Execute
```

---

## Decision Matrix

```
                              Files Affected
                         1-3         4-15        16+
                    ┌───────────┬───────────┬───────────┐
         None/Low   │   TWEAK   │   TASK    │   STORY   │
                    ├───────────┼───────────┼───────────┤
Risk     Medium     │   TASK    │   TASK    │   STORY   │
                    ├───────────┼───────────┼───────────┤
         High       │   TASK    │   STORY   │   STORY   │
                    └───────────┴───────────┴───────────┘
```

---

## Quick Comparison

| Aspect | TWEAK | BLOCKS | TASK | STORY |
|--------|-------|--------|------|-------|
| **Initial questions** | 3 core | 4 block-specific | All 7 | All 7 |
| **Duration** | 5-20 min | 15-60 min | 30-120 min | 1-5 hours |
| **Tokens** | 10-40k | 30-80k | 50-200k | 120-350k |
| **Session files** | Optional | 4 | 2 | 8+ |
| **Subagents** | None | 2-3 | 0-3 | 8-10 |
| **Planning** | None | None | Light (Claude) | Full (PM + Arc) |
| **Requirements doc** | No | No | Yes (Claude) | Yes (PM subagent) |
| **Mock support** | No | Required | Optional | Optional |
| **DB migrations** | No | No | No | Yes |
| **Validation gates** | Self-check | Visual (1) | Self-check | 4 mandatory |
| **Documentation** | No | No | Optional | Conditional |

---

## Commands

```bash
# Explicit workflow selection
/session:start:tweak "fix typo in login"
/session:start:blocks "hero block from Stitch mock"
/session:start:task "add phone field"
/session:start:story "new products entity"

# Automatic detection (Claude evaluates)
/session:start "description"
```

---

## Session Structure

```
.claude/sessions/
├── tweaks/                              # Small adjustments
│   └── 2024-01-12-fix-typo.md          # Optional log
│
├── blocks/                              # Block development from mocks
│   └── 2024-01-12-hero-block/
│       ├── mocks/                       # User uploads here
│       │   ├── code.html
│       │   └── screen.png
│       ├── analysis.json                # From mock-analyst
│       ├── ds-mapping.json              # From mock-analyst
│       ├── block-plan.json              # Block decision
│       └── progress.md
│
├── tasks/                               # Medium work
│   └── 2024-01-12-add-field/
│       ├── mocks/                       # Optional (if mock selected)
│       ├── requirements.md
│       └── progress.md
│
└── stories/                             # Complex features
    └── 2024-01-12-products-entity/
        ├── mocks/                       # Optional (if mock selected)
        ├── context.md
        ├── requirements.md
        ├── plan.md
        ├── scope.json
        ├── pendings.md
        ├── tests.md
        └── iterations/
            └── 01-initial/
                ├── progress.md
                └── changes.md
```

---

## Workflow Files

- [tweak.md](./tweak.md) - TWEAK workflow details
- [blocks.md](./blocks.md) - BLOCKS workflow details
- [task.md](./task.md) - TASK workflow details
- [story.md](./story.md) - STORY workflow details
