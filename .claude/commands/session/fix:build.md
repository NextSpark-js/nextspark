# /session:fix:build

Fix build errors automatically.

---

## Syntax

```
/session:fix:build [--max-iterations <n>]
```

---

## Behavior

Automatically diagnoses and fixes build errors in a loop until the build passes.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:fix:build                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Run build                                                   │
│     ↓                                                           │
│  2. Parse errors                                                │
│     - TypeScript errors                                         │
│     - Import errors                                             │
│     - Config errors                                             │
│     ↓                                                           │
│  3. Categorize by type                                          │
│     - Type mismatch                                             │
│     - Missing import                                            │
│     - Missing dependency                                        │
│     - Syntax error                                              │
│     ↓                                                           │
│  4. Fix each error                                              │
│     - Apply targeted fix                                        │
│     ↓                                                           │
│  5. Re-run build                                                │
│     │                                                           │
│     ├─► Errors remain: Go to step 2                             │
│     │                                                           │
│     └─► Build passes: Done                                      │
│     ↓                                                           │
│  6. Show summary                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example Output

```
🔧 FIX BUILD ERRORS

─────────────────────────────────────────

📋 ITERATION 1

Running build...
❌ Build failed with 5 errors

Errors:
1. TS2345: products.ts:23 - Type mismatch
2. TS2307: ProductForm.tsx:5 - Missing import
3. TS2307: ProductForm.tsx:8 - Missing import
4. TS2339: ProductList.tsx:45 - Property does not exist
5. TS2345: ProductService.ts:12 - Type mismatch

─────────────────────────────────────────

🔧 FIXING ERRORS

[1/5] products.ts:23 - Type mismatch
      Fix: Cast to correct type
      ✓ Fixed

[2/5] ProductForm.tsx:5 - Missing import
      Fix: Add import for 'useForm'
      ✓ Fixed

[3/5] ProductForm.tsx:8 - Missing import
      Fix: Add import for 'zodResolver'
      ✓ Fixed

[4/5] ProductList.tsx:45 - Property does not exist
      Fix: Update property name
      ✓ Fixed

[5/5] ProductService.ts:12 - Type mismatch
      Fix: Update function signature
      ✓ Fixed

─────────────────────────────────────────

📋 ITERATION 2

Running build...
✓ Build successful

─────────────────────────────────────────

📊 SUMMARY

Iterations: 2
Errors fixed: 5
Files modified: 4

Build is now passing.
```

---

## With Max Iterations

```
/session:fix:build --max-iterations 3
```

Output when limit reached:

```
🔧 FIX BUILD ERRORS

─────────────────────────────────────────

📋 ITERATION 3

Running build...
❌ Build failed with 2 errors

⚠️ MAX ITERATIONS REACHED

Remaining errors:
1. TS2322: complex-type.ts:45 - Complex type error
2. TS2339: api-handler.ts:23 - Missing property

These errors may require manual intervention.

Options:
[1] Continue fixing (increase limit)
[2] Show detailed error analysis
[3] Stop and fix manually
```

---

## Error Categories

| Category | Auto-Fix | Example |
|----------|----------|---------|
| Missing import | Yes | `import { X } from 'y'` |
| Type mismatch | Usually | Cast or update type |
| Syntax error | Usually | Missing bracket, etc. |
| Missing property | Sometimes | Add property to interface |
| Complex type | Manual | Generic constraints |

---

## Options

| Option | Description |
|--------|-------------|
| `--max-iterations <n>` | Max fix attempts (default: 5) |
| `--dry-run` | Show fixes without applying |
| `--verbose` | Show detailed fix reasoning |

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:fix:test` | Fix failing tests |
| `/session:fix:bug` | Fix reported bug |
| `/session:validate` | Full validation |
