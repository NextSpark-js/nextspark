# Token Optimization System for STORY Workflow

This document explains the token optimization strategy implemented in the STORY workflow to reduce context window consumption by developer agents.

---

## Quick Reference

```bash
# After Arc creates plan.md, run:
./skills/session-management/scripts/split-plan.sh stories/YYYY-MM-DD-name/

# Verify:
ls stories/YYYY-MM-DD-name/phases/
```

**Result:** ~76% token reduction (62,400 → 15,000 tokens)

---

## Problem Statement

### How Subagent Context Windows Work

Each time a subagent is invoked, it starts with a **fresh context window**. Unlike the orchestrator (main Claude instance), subagents do not inherit the conversation history. They only receive:

1. The prompt provided by the orchestrator
2. Any files they explicitly read during execution

This means that if 8 developer agents each need to understand the requirements and technical plan, each agent must read the source files independently.

### The Cost Without Optimization

In a typical STORY workflow:
- `requirements.md`: ~5,000 tokens
- `plan.md`: ~2,800 tokens
- **Per agent cost**: ~7,800 tokens

With 8 developer agents (db-entity, backend, frontend, validators, etc.):
- **Total: 8 × 7,800 = 62,400 tokens**

This is pure overhead - the same information read 8 times.

---

## Why Briefings Don't Work

An initial proposal was to have the orchestrator create a "briefing" file for each agent:

```
For each phase:
  1. Orchestrator reads requirements.md + plan.md
  2. Orchestrator creates briefing-phase-X.md
  3. Agent reads briefing-phase-X.md
```

**Problem:** This just moves the token cost around. The orchestrator must re-read requirements.md and plan.md before each phase to create the briefing. The total tokens consumed remain the same (or increase slightly due to write operations).

---

## The Pre-Split Solution

### Core Idea

Front-load all context extraction to a single agent (Arc), then use a **zero-cost script** to split the output into phase-specific files.

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  ONE-TIME COST (Arc - Phase 2)                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Arc reads requirements.md (~5,000 tokens)                   │
│  2. Arc creates plan.md with phase markers (~7,000 tokens)      │
│     └── Each phase section is self-contained (~800 tokens)      │
│     └── ACs are extracted per phase (not "see requirements")    │
│                                                                 │
│  Arc's total overhead: ~7,000 tokens (ONE TIME)                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  ZERO-COST OPERATION (Bash Script)                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ./skills/session-management/scripts/split-plan.sh \            │
│      stories/2026-01-12-products/                               │
│                                                                 │
│  Extracts phase sections using grep/sed:                        │
│  - phase-03-db-entity-developer.md                              │
│  - phase-05-backend-developer.md                                │
│  - phase-07-mock-analyzer.md (if mock exists)                   │
│  - phase-08-frontend-developer.md                               │
│  - ...                                                          │
│                                                                 │
│  Token cost: 0 (pure text manipulation)                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PER-AGENT COST (Developer Agents)                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Each agent reads ONLY:                                         │
│  - phases/phase-XX-name.md (~800 tokens)                        │
│  - progress.md (~200 tokens)                                    │
│                                                                 │
│  Per agent cost: ~1,000 tokens (instead of ~7,800)              │
│  8 agents × 1,000 = 8,000 tokens                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Token Comparison

| Approach | Arc Cost | Per Agent | 8 Agents | Total | Savings |
|----------|----------|-----------|----------|-------|---------|
| **No optimization** | 0 | 7,800 | 62,400 | **62,400** | - |
| **Pre-split phases** | 7,000 | 1,000 | 8,000 | **15,000** | 47,400 (76%) |

### Notes

- "Arc Cost" includes reading requirements.md and creating comprehensive plan.md
- "Per Agent" includes phase file + progress.md
- Actual savings may vary based on feature complexity
- Not all 8 phases run every time (some are CONDITIONAL/OPTIONAL)
- Larger features see greater absolute savings

---

## Phase Coverage

The system creates phase files for developer agents, NOT for validators or orchestrator phases:

| Phase | Agent | Marker? | Type | Reason |
|-------|-------|---------|------|--------|
| 03 | db-entity-developer | ✅ | SUBAGENT | Needs context to create DB/entity |
| 04 | db-entity-validator | ❌ | GATE | Validates, doesn't write code |
| 05 | backend-developer | ✅ | SUBAGENT | Needs context to create API |
| 06 | backend-validator | ❌ | GATE | Validates, doesn't write code |
| 07 | mock-analyzer | ✅ | CONDITIONAL | Needs context if mock exists |
| 08 | frontend-developer | ✅ | SUBAGENT | Needs context to create UI |
| 09 | frontend-validator | ❌ | GATE | Validates, doesn't write code |
| 10 | code-reviewer | ✅ | SUBAGENT | Needs context to review code |
| 11 | qa-manual | ❌ | ORCHESTRATOR | Has full context already |
| 12 | qa-automation | ✅ | OPTIONAL | Needs context if automation required |
| 13 | documentation-writer | ✅ | CONDITIONAL | Needs context if docs required |
| 14 | unit-test-writer | ✅ | OPTIONAL | Needs context if coverage needed |

**Total:** 8 phases with markers, 4 without (GATEs + ORCHESTRATOR)

---

## Phase Marker Format

Arc creates `plan.md` with HTML comment markers that enable script extraction:

```markdown
<!-- PHASE:03:START -->
## Phase 3: DB Entity Developer

### Objective
Create database migrations and entity configuration files for Products.

### Relevant ACs
- AC1: Products table with name, price, description fields
- AC2: Category relation (many-to-one)
- AC3: Sample data for testing (20+ products)

### Prerequisites
- None (first development phase)

### Files to Create
- `migrations/0001_create_products.sql` - Main table + indexes
- `core/entities/products/products.config.ts` - Entity config
- `core/entities/products/products.fields.ts` - Field definitions
- `core/entities/products/products.types.ts` - TypeScript types
- `core/entities/products/products.service.ts` - Service layer

### Implementation Notes
- Use TIMESTAMPTZ for all date fields
- Include RLS policies for team isolation
- Sample data should have varied prices ($10-$500)
<!-- PHASE:03:END -->
```

### Key Constraints

1. **~800 tokens maximum per phase** - Enough for context, not overwhelming
2. **Self-contained** - No "see requirements.md" references
3. **ACs extracted** - Only relevant ACs included, not AC references
4. **Prerequisites explicit** - What must exist before this phase runs

---

## Script Location

The split script is part of the session-management skill:

```
skills/session-management/scripts/split-plan.sh
```

### Usage

```bash
# From project root
./skills/session-management/scripts/split-plan.sh <session_path>

# Example
./skills/session-management/scripts/split-plan.sh stories/2026-01-12-products/

# Output
Found 8 phase markers in plan.md
  Created: phase-03-db-entity-developer.md
  Created: phase-05-backend-developer.md
  Created: phase-07-mock-analyzer.md
  Created: phase-08-frontend-developer.md
  Created: phase-10-code-reviewer.md
  Created: phase-12-qa-automation.md
  Created: phase-13-documentation-writer.md
  Created: phase-14-unit-test-writer.md

✓ Split complete: 8 phase files created in stories/2026-01-12-products/phases
```

### Output Structure

```
stories/2026-01-12-products/
├── requirements.md
├── plan.md                    # Full plan with markers
├── phases/                    # Split phase files (auto-generated)
│   ├── phase-03-db-entity-developer.md
│   ├── phase-05-backend-developer.md
│   ├── phase-07-mock-analyzer.md
│   ├── phase-08-frontend-developer.md
│   ├── phase-10-code-reviewer.md
│   ├── phase-12-qa-automation.md
│   ├── phase-13-documentation-writer.md
│   └── phase-14-unit-test-writer.md
├── progress.md
└── ...
```

---

## Agent Instructions Update

### Old Pattern (High Token Cost)

```
Agent Responsibilities:
├── Read requirements.md (5,000 tokens)
├── Read plan.md (2,800 tokens)
└── Implement feature...
```

### New Pattern (Optimized)

```
Agent Responsibilities:
├── Read phases/phase-XX-name.md (800 tokens)
│   └── Contains: Objective, Relevant ACs, Prerequisites, Files
├── Read progress.md (200 tokens)
└── Implement feature...
```

---

## When This Optimization Applies

| Workflow | Applies? | Reason |
|----------|----------|--------|
| **TWEAK** | No | No subagents, Claude implements directly |
| **TASK** | Partial | Fewer agents, lower overhead |
| **STORY** | Yes | 8+ agents, maximum benefit |

---

## Verification

After Arc creates plan.md:

```bash
# Check markers exist
grep -c "PHASE:.*:START" plan.md
# Expected: 8 markers (phases 03, 05, 07, 08, 10, 12, 13, 14)

# Run split
./skills/session-management/scripts/split-plan.sh stories/current-session/

# Verify files
ls -la stories/current-session/phases/
# Should show 8 phase files
```

---

## Troubleshooting

### No phase markers found

```
Warning: No phase markers found in plan.md
```

**Cause:** Arc didn't create plan.md with the required markers.

**Fix:** Ensure Arc (architecture-supervisor) is using the correct template. Check `templates/story/plan.md` for the marker format.

### Phase file is empty

**Cause:** Marker format incorrect (missing space, wrong phase number).

**Fix:** Check plan.md for exact format:
```markdown
<!-- PHASE:XX:START -->
content here
<!-- PHASE:XX:END -->
```

### Script not found

```
bash: ./split-plan.sh: No such file or directory
```

**Fix:** Run from project root with full path:
```bash
./skills/session-management/scripts/split-plan.sh stories/...
```

### Permission denied

```bash
chmod +x ./skills/session-management/scripts/split-plan.sh
```

---

## Related Documentation

- `workflows/story.md` - STORY workflow details
- `templates/story/plan.md` - Plan template with markers
- `skills/session-management/SKILL.md` - Session management skill

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01 | Initial implementation with 8 phase markers |
