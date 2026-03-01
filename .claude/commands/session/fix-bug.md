---
disable-model-invocation: true
---

# /session:fix:bug

Fix a bug with a simplified workflow.

**Aliases:** `/fix`

---

## Workflow Detection

**[MANDATORY]** This command determines workflow based on complexity:

| Evaluation | Workflow | Session |
|------------|----------|---------|
| XS-S (1-3 files, low risk) | TWEAK | tweaks/ |
| M+ (4+ files or high risk) | TASK | tasks/ |

---

## Syntax

```
/session:fix:bug <description>
```

---

## Behavior

Optimized workflow for bug fixes:
1. **Analyze** the bug
2. **Determine** T-Shirt size
3. **Implement** fix
4. **Validate** no regressions
5. **Create** test to prevent recurrence

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:fix:bug                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Analyze bug description                                     │
│     - Where does it occur?                                      │
│     - How to reproduce?                                         │
│     - What is the expected behavior?                            │
│     ↓                                                           │
│  2. Search related code                                         │
│     - Grep for relevant terms                                   │
│     - Identify affected files                                   │
│     ↓                                                           │
│  3. Evaluate complexity                                         │
│     │                                                           │
│     ├─► XS-S (1-3 files): TWEAK workflow                        │
│     │   - Direct fix                                            │
│     │   - Validate build/tests                                  │
│     │                                                           │
│     └─► M+ (4+ files or risk): TASK workflow                │
│         - Create task session                                   │
│         - Document analysis                                     │
│         - Fix with tests                                        │
│     ↓                                                           │
│  4. Implement fix                                               │
│     ↓                                                           │
│  5. Validate                                                    │
│     - Build passes                                              │
│     - Existing tests pass                                       │
│     - Bug reproduced → fixed                                    │
│     ↓                                                           │
│  6. Create regression test (if doesn't exist)                   │
│     ↓                                                           │
│  7. Ready for commit                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example

```
/session:fix:bug The submit button doesn't disable during submission
```

Output:

```
🐛 ANALYZING BUG

Description: The submit button doesn't disable during submission

─────────────────────────────────────────

🔍 ANALYSIS

Searching related code...
├─ "submit" in components... 5 files
├─ "disabled" in forms... 3 files
└─ "loading" state... 2 files

Probable file:
core/components/forms/SubmitButton.tsx

─────────────────────────────────────────

📐 EVALUATION

Affected files: ~2
Risk: Low (UI only)
T-Shirt: XS

Workflow: TWEAK

─────────────────────────────────────────

🔧 IMPLEMENTING FIX

[Reading SubmitButton.tsx]
[Identifying problem: missing isLoading prop]
[Applying fix...]

─────────────────────────────────────────

✅ VALIDATION

- Build: ✓ Passes
- Tests: ✓ 45/45 pass
- Visual: Button now disables

─────────────────────────────────────────

📝 REGRESSION TEST

Create test to prevent recurrence? [Yes/No]

> Yes

Creating test in __tests__/components/SubmitButton.test.tsx
✓ Test created

─────────────────────────────────────────

✓ Bug fixed. Ready for commit.
```

---

## With Complex Bug

```
🐛 ANALYZING BUG

Description: Orders are not being calculated correctly

─────────────────────────────────────────

🔍 ANALYSIS

Searching related code...
├─ "order" in services... 8 files
├─ "calculate" in orders... 3 files
└─ "total" in cart... 4 files

Probable files:
- core/services/orders.ts
- core/services/cart.ts
- core/api/orders/route.ts

─────────────────────────────────────────

📐 EVALUATION

Affected files: ~6
Risk: HIGH (affects revenue)
T-Shirt: M

⚠️ ALERT: This bug affects critical flow (Orders)

Recommended workflow: TASK

─────────────────────────────────────────

Proceed with TASK workflow? [Yes/Use TWEAK]

> Yes

Creating task session: tasks/2026-01-11-fix-order-calculation
```

---

## Options

| Option | Description |
|--------|-------------|
| `--quick` | Force TWEAK workflow |
| `--with-test` | Always create regression test |
| `--no-test` | Don't create test (not recommended) |

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:fix:build` | Fix build errors |
| `/session:fix:test` | Fix failing tests |
