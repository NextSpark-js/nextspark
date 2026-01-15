---
description: "Create a new theme"
---

# do:create-theme

**Theme Name:** {{{ input }}}

---

## MANDATORY: Read Skill First

Read `.claude/skills/create-theme/SKILL.md` completely before proceeding.

---

## Theme Scaffold Command

```bash
pnpm create:theme {theme-name}
```

---

## Theme Structure

```
contents/themes/{theme-name}/
├── theme.config.ts       # Theme configuration
├── config/
│   ├── app.config.ts     # Application config
│   ├── dashboard.config.ts
│   └── permissions.config.ts
├── components/           # Theme components
├── entities/             # Theme entities
├── styles/
│   └── globals.css       # Theme styles
└── lib/                  # Theme utilities
```

---

## Configuration Files

1. `theme.config.ts` - Theme metadata
2. `app.config.ts` - Team Mode, features
3. `dashboard.config.ts` - Dashboard layout
4. `permissions.config.ts` - Role permissions

---

## After Creation

1. Rebuild registry:
   ```bash
   node core/scripts/build/registry.mjs
   ```

2. Set as active theme in `.env`:
   ```
   NEXT_PUBLIC_ACTIVE_THEME={theme-name}
   ```

3. Verify theme appears in THEME_REGISTRY

---

## Verification

Use the checklist from `create-theme/SKILL.md` to verify compliance.
