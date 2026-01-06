---
description: "[Plugin] Create a new plugin - Redirects to /create:plugin"
---

# Create New Plugin

**This command redirects to `/create:plugin`**

**Input:** {{{ input }}}

---

## Redirect

Use the unified command instead:

```
/create:plugin {input}
```

Execute `/create:plugin` with the same input provided above.

---

## Why Redirect?

As of v4.3, plugin and theme creation are standalone commands outside the main workflow:
- `/create:plugin` - Creates plugin + validates inline
- `/create:theme` - Creates theme + validates inline

These commands replace the previous agent-based approach (plugin-creator, plugin-validator).
