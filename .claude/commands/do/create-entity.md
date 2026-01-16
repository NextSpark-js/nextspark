---
description: "Create a new entity with all required files"
---

# do:create-entity

**Entity Name:** {{{ input }}}

---

## MANDATORY: Read Skills First

Read these skills completely before proceeding:

1. `.claude/skills/entity-system/SKILL.md` - Entity configuration
2. `.claude/skills/database-migrations/SKILL.md` - Migration patterns

---

## Available Scripts

Check for automation scripts:

```bash
ls .claude/skills/entity-system/scripts/
```

Common scripts:
- `scaffold-entity.py` - Generate entity files
- `generate-migration.py` - Generate migration SQL

---

## Files to Create

```
contents/themes/{theme}/entities/{entity}/
├── {entity}.config.ts    # Entity configuration
├── {entity}.fields.ts    # Field definitions
├── {entity}.types.ts     # TypeScript types
├── messages/
│   ├── en.json           # English translations
│   └── es.json           # Spanish translations
└── migrations/
    └── XXX_{entity}_table.sql
```

---

## After Creation

1. Run registry rebuild:
   ```bash
   node core/scripts/build/registry.mjs
   ```

2. Run migrations:
   ```bash
   pnpm db:migrate
   ```

---

## Verification

Use the checklist from `entity-system/SKILL.md` to verify compliance.
