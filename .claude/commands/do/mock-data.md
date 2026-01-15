---
description: "Generate sample/mock data for entities"
---

# do:mock-data

**Entity or Context:** {{{ input }}}

---

## MANDATORY: Read Skill First

Read `.claude/skills/database-migrations/SKILL.md` completely before proceeding.

Pay special attention to the "Sample Data" section.

---

## Available Scripts

```bash
ls .claude/skills/database-migrations/scripts/
```

Use script:
```bash
python .claude/skills/database-migrations/scripts/generate-sample-data.py \
  --entity {entity} \
  --count 20
```

---

## Key Requirements

1. **Quantity:** 20+ records per entity
2. **Test Users:** Use standard password hash from skill
3. **Varied Data:** Cover different scenarios and edge cases
4. **ON CONFLICT:** Use upsert pattern for idempotency

---

## Test User Password Hash

```
3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866
```

Password: `Cypress123!`

---

## After Generation

Run sample data migration:
```bash
pnpm db:migrate
```

---

## Verification

- [ ] 20+ records created per entity
- [ ] Test users have correct password hash
- [ ] Uses ON CONFLICT clause
- [ ] Varied realistic data
