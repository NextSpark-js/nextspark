---
description: "Create a new plugin"
---

# do:create-plugin

**Plugin Name:** {{{ input }}}

---

## MANDATORY: Read Skills First

Read these skills completely before proceeding:

1. `.claude/skills/create-plugin/SKILL.md` - Plugin creation
2. `.claude/skills/plugins/SKILL.md` - Plugin system overview

---

## Plugin Scaffold Command

```bash
pnpm create:plugin {plugin-name} --complexity {simple|medium|complex}
```

---

## Plugin Structure

```
contents/plugins/{plugin-name}/
├── plugin.config.ts      # Plugin configuration
├── package.json          # Plugin metadata
├── README.md             # Documentation
├── lib/                  # Plugin logic
├── components/           # UI components (if any)
├── entities/             # Entities (if any)
└── migrations/           # Migrations (if any)
```

---

## After Creation

1. Register plugin in test theme
2. Rebuild registry:
   ```bash
   node core/scripts/build/registry.mjs
   ```
3. Verify plugin appears in PLUGIN_REGISTRY

---

## Verification

Use the checklist from `create-plugin/SKILL.md` to verify compliance.
