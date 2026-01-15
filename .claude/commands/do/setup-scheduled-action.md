---
description: "Create a new scheduled action handler"
---

# do:setup-scheduled-action

**Action Description:** {{{ input }}}

---

## MANDATORY: Read Skill First

Read `.claude/skills/scheduled-actions/SKILL.md` completely before proceeding.

---

## Key Files

| File | Purpose |
|------|---------|
| `contents/themes/{theme}/lib/scheduled-actions/handlers/` | Handler implementations |
| `contents/themes/{theme}/lib/scheduled-actions/index.ts` | Handler registration |
| `contents/themes/{theme}/config/app.config.ts` | Configuration |

---

## Handler Template

```typescript
// handlers/{name}.ts
import { registerScheduledAction } from '@/core/lib/scheduled-actions'

export function registerMyHandler() {
  registerScheduledAction('my-action:type', async (payload, action) => {
    try {
      // Implementation
      return { success: true, message: 'Done' }
    } catch (error) {
      return { success: false, message: error.message }
    }
  })
}
```

---

## Registration

Add to `index.ts`:

```typescript
import { registerMyHandler } from './handlers/my-handler'

export function registerAllHandlers() {
  // ... existing handlers
  registerMyHandler()  // Add here
}
```

---

## After Creation

1. Rebuild registry:
   ```bash
   node core/scripts/build/registry.mjs
   ```

2. Restart dev server to load handlers

---

## Verification

Use the checklist from `scheduled-actions/SKILL.md` to verify compliance.
