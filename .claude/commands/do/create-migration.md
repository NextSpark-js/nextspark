---
description: "Create a new database migration"
---

# do:create-migration

**Migration Description:** {{{ input }}}

---

## MANDATORY: Read Skill First

Read `.claude/skills/database-migrations/SKILL.md` completely before proceeding.

---

## Available Scripts

```bash
ls .claude/skills/database-migrations/scripts/
```

Common scripts:
- `validate-migration.py` - Validate migration conventions
- `generate-sample-data.py` - Generate sample data

---

## Key Conventions

From the skill, remember:

1. **IDs:** TEXT type, not UUID
2. **Timestamps:** TIMESTAMPTZ, not TIMESTAMP
3. **Field Order:** id → FK → business → system
4. **RLS:** Apply appropriate policy pattern
5. **Naming:** camelCase for tables and columns

---

## Migration Location

- Core migrations: `core/migrations/XXX_*.sql`
- Theme migrations: `contents/themes/{theme}/migrations/XXX_*.sql`

---

## After Creation

1. Validate migration:
   ```bash
   python .claude/skills/database-migrations/scripts/validate-migration.py --file <path>
   ```

2. Run migration:
   ```bash
   pnpm db:migrate
   ```

---

## Verification

Use the checklist from `database-migrations/SKILL.md` to verify compliance.
