---
description: "Reset database and run all migrations"
---

# do:reset-db

**Context:** {{{ input }}}

---

## MANDATORY: Read Skill First

Read `.claude/skills/database-migrations/SKILL.md` for migration patterns.

---

## Reset Commands

### Full Reset (Development Only)

```bash
# Drop and recreate database
pnpm db:reset

# Or manually:
pnpm db:drop
pnpm db:create
pnpm db:migrate
```

### Migration Only (Safe)

```bash
# Run pending migrations
pnpm db:migrate

# Check migration status
pnpm db:status
```

---

## Warning

**NEVER run `db:reset` on production databases.**

Only use reset in development environments.

---

## After Reset

1. Verify tables exist:
   ```bash
   pnpm db:verify
   ```

2. Check sample data:
   ```bash
   pnpm db:seed  # If available
   ```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Connection refused | Check DATABASE_URL in .env |
| Permission denied | Check database user permissions |
| Migration failed | Check SQL syntax in migration files |
