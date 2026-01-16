---
description: "Create a new API endpoint"
---

# do:create-api

**Endpoint Description:** {{{ input }}}

---

## MANDATORY: Read Skills First

Read these skills completely before proceeding:

1. `.claude/skills/nextjs-api-development/SKILL.md` - API patterns
2. `.claude/skills/entity-api/SKILL.md` - Entity-specific endpoints (if applicable)

---

## Available Scripts

```bash
ls .claude/skills/nextjs-api-development/scripts/
```

Common scripts:
- `scaffold-endpoint.py` - Generate endpoint files
- `generate-crud-tests.py` - Generate Cypress tests
- `validate-api.py` - Validate API structure

---

## Key Patterns

From the skill, remember:

1. **Wrapper:** Use `withApiLogging`
2. **CORS:** Always use `addCorsHeaders(response)`
3. **Auth:** Use `authenticateRequest(req)` for dual auth
4. **Response:** Use `createApiResponse()` and `createApiError()`
5. **Validation:** Use Zod schemas

---

## Endpoint Location

- Custom endpoints: `app/api/v1/(contents)/{endpoint}/route.ts`
- Core endpoints: `app/api/v1/{endpoint}/route.ts`

---

## After Creation

1. Add API scopes to `core/lib/api/keys.ts`
2. Generate tests:
   ```bash
   python .claude/skills/nextjs-api-development/scripts/generate-crud-tests.py --entity {entity}
   ```

---

## Verification

Use the checklist from `nextjs-api-development/SKILL.md` to verify compliance.
