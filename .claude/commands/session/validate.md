---
disable-model-invocation: true
---

# /session:validate

Validate the current session state and implementation.

---

## Syntax

```
/session:validate [--full]
```

---

## Behavior

Runs validation checks on the current session implementation.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:validate                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Load session context                                        │
│     - Read scope.json                                           │
│     - Read progress.md                                          │
│     ↓                                                           │
│  2. Run validation checks                                       │
│     - TypeScript compilation                                    │
│     - Lint rules                                                │
│     - Build process                                             │
│     ↓                                                           │
│  3. Run tests (if --full)                                       │
│     - Unit tests                                                │
│     - API tests                                                 │
│     - UAT tests                                                 │
│     ↓                                                           │
│  4. Check ACs completion                                        │
│     - Compare with requirements.md                              │
│     ↓                                                           │
│  5. Generate validation report                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example Output

```
✅ SESSION VALIDATION

Session: stories/2026-01-11-new-products-entity

─────────────────────────────────────────

🔧 BUILD CHECKS

TypeScript:  ✓ No errors
Lint:        ✓ No warnings
Build:       ✓ Successful

─────────────────────────────────────────

🧪 TEST RESULTS

Unit Tests:  ✓ 12/12 passing
API Tests:   ✓ 8/8 passing
UAT Tests:   ✓ 5/5 passing

─────────────────────────────────────────

📋 AC VERIFICATION

AC1: Create product          ✓ Implemented
AC2: Upload images           ✓ Implemented
AC3: Assign categories       ✓ Implemented
AC4: List with pagination    ✓ Implemented
AC5: View-only for members   ✓ Implemented

─────────────────────────────────────────

📊 SUMMARY

All checks passed: ✓
ACs completed: 5/5 (100%)

Ready for code review.
```

---

## With Failures

```
❌ VALIDATION FAILED

─────────────────────────────────────────

🔧 BUILD CHECKS

TypeScript:  ✓ No errors
Lint:        ⚠ 2 warnings
Build:       ✓ Successful

─────────────────────────────────────────

🧪 TEST RESULTS

Unit Tests:  ✓ 12/12 passing
API Tests:   ❌ 6/8 passing
  - FAIL: POST /products (validation error)
  - FAIL: PATCH /products (missing field)
UAT Tests:   ⏸ Skipped (API failures)

─────────────────────────────────────────

📋 AC VERIFICATION

AC1: Create product          ✓ Implemented
AC2: Upload images           ⚠ Partial (max limit not enforced)
AC3: Assign categories       ✓ Implemented
AC4: List with pagination    ✓ Implemented
AC5: View-only for members   ❌ Not implemented

─────────────────────────────────────────

📊 SUMMARY

Build: ✓ Pass
Tests: ❌ 2 failures
ACs: 3/5 complete

Options:
[1] Fix issues and re-validate
[2] View detailed errors
[3] Continue anyway (not recommended)
```

---

## Options

| Option | Description |
|--------|-------------|
| `--full` | Run complete test suite |
| `--quick` | Only build checks, skip tests |
| `--ac-only` | Only check AC completion |

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:execute` | Continue implementation |
| `/session:review` | Request code review |
| `/session:close` | Close session |
