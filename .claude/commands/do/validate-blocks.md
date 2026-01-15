---
description: "Validate page builder blocks"
---

# do:validate-blocks

**Block or Context:** {{{ input }}}

---

## MANDATORY: Read Skills First

Read these skills completely before proceeding:

1. `.claude/skills/page-builder-blocks/SKILL.md` - Block development
2. `.claude/skills/block-decision-matrix/SKILL.md` - Block decisions

---

## Block Structure

Each block must have:

```
contents/themes/{theme}/blocks/{block-name}/
├── config.ts       # Block configuration
├── schema.ts       # Zod validation schema
├── fields.ts       # Field definitions
├── component.tsx   # React component
└── index.ts        # Exports
```

---

## Validation Checklist

- [ ] All 5 required files exist
- [ ] `config.ts` has correct metadata
- [ ] `schema.ts` validates all fields
- [ ] `component.tsx` has `data-cy` attributes
- [ ] Block appears in BLOCK_REGISTRY

---

## Registry Check

```bash
# Rebuild registry
node core/scripts/build/registry.mjs

# Verify block is registered
grep "{block-name}" core/lib/registries/block-registry.ts
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| Block not in registry | Run registry rebuild |
| Schema validation fails | Check Zod schema matches fields |
| Component not rendering | Check exports in index.ts |

---

## Verification

Use the checklist from `page-builder-blocks/SKILL.md` to verify compliance.
