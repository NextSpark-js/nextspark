---
description: "Synchronize selectors between components, core definitions, and POM classes"
---

# do:update-selectors

**Context:** {{{ input }}}

---

## MANDATORY: Read Skills First

Read these skills completely before proceeding:

1. `.claude/skills/cypress-selectors/SKILL.md` - 3-level selector system

---

## Selector Architecture

The selector system has THREE layers:

1. **CORE_SELECTORS** - `packages/core/src/lib/selectors/` (source of truth)
2. **BLOCK_SELECTORS** - Theme block selectors
3. **THEME_SELECTORS** - Theme-specific UI selectors

---

## Common Sync Issues

### 1. Selector Used but Not Defined

**Symptom:** Console warning `[sel] Invalid selector path: "..."`

**Fix:**
1. Find usage in component: `grep -rn "sel('...')" packages/core/src/`
2. Add to appropriate domain file in `packages/core/src/lib/selectors/domains/`
3. Rebuild to regenerate types

### 2. Hardcoded Selector in Component

**Symptom:** `document.querySelector('[data-cy="..."]')` instead of using `sel()`

**Fix:**
```diff
- document.querySelector(`[data-cy="preview-block-${id}"]`)
+ document.querySelector(`[data-cy="${sel('blockEditor.previewCanvas.block', { id })}"]`)
```

### 3. Hardcoded Selector in POM

**Symptom:** Direct string selectors instead of `cySelector()`

**Fix:**
```diff
- moveUpBtn: (id: string) => `[data-cy="preview-block-${id}-move-up"]`,
+ moveUpBtn: (id: string) => cySelector('blockEditor.previewCanvas.moveUp', { id }),
```

**Note:** Generic selectors for prefix matching MUST keep the bracket format:
```ts
sortableBlockGeneric: '[data-cy^="sortable-block-"]',  // OK - needed for prefix matching
```

---

## Files to Check

| Layer | File Pattern |
|-------|--------------|
| Core Selectors | `packages/core/src/lib/selectors/domains/*.selectors.ts` |
| Component Usage | `packages/core/src/components/**/*.tsx` |
| POM Classes | `themes/*/tests/cypress/src/core/*POM.ts` |
| POM Presets | `packages/core/presets/theme/tests/cypress/src/core/*POM.ts` |

---

## Sync Workflow

1. **Find undefined selectors:**
   ```bash
   pnpm build 2>&1 | grep -i "selector"
   ```

2. **Find hardcoded selectors in POMs:**
   ```bash
   grep -n "data-cy=" themes/default/tests/cypress/src/core/*.ts
   ```

3. **Find hardcoded selectors in components:**
   ```bash
   grep -rn 'data-cy="' packages/core/src/components/ --include="*.tsx"
   ```

4. **After sync, update presets:**
   - `packages/core/presets/theme/tests/cypress/src/core/`
   - `packages/core/templates/contents/themes/starter/tests/cypress/src/core/`

---

## Verification

```bash
# Build without errors
pnpm build

# No invalid selector warnings in browser console
# Navigate to affected pages and check DevTools console

# Grep should show only defined properties, not method bodies with hardcoded strings
grep -n "data-cy=" themes/default/tests/cypress/src/core/BlockEditorBasePOM.ts
```
