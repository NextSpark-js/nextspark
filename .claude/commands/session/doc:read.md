# /session:doc:read

Gain context by reading documentation before working on a task.

---

## Syntax

```
/session:doc:read [topic] [--skill <name>]
```

---

## Behavior

Reads relevant documentation and skills to understand project patterns before development.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:doc:read                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Determine what to read                                      │
│     - Topic provided?                                           │
│     - Skill specified?                                          │
│     - Infer from session context?                               │
│     ↓                                                           │
│  2. Locate relevant files                                       │
│     - Skills (SKILL.md)                                         │
│     - Documentation (docs/)                                     │
│     - Architecture files (.rules/)                              │
│     ↓                                                           │
│  3. Read and summarize                                          │
│     ↓                                                           │
│  4. Present key information                                     │
│     - Patterns to follow                                        │
│     - Anti-patterns to avoid                                    │
│     - Related files                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example: Read Topic

```
/session:doc:read authentication
```

Output:

```
📚 DOCUMENTATION: Authentication

─────────────────────────────────────────

📖 RELEVANT SKILLS

## better-auth (SKILL.md)

Key patterns:
- Session-based auth for web app
- API key auth for external access
- Dual auth: both methods per endpoint

```typescript
// Dual auth pattern
const { user, team } = await authenticateRequest(req, {
  allowApiKey: true,
  allowSession: true
});
```

Anti-patterns:
- DON'T use only session auth for API endpoints
- DON'T skip team context validation

─────────────────────────────────────────

## api-bypass-layers (SKILL.md)

Multi-layer security:
1. Authentication layer
2. Authorization layer
3. Team context layer
4. RLS layer

Bypass rules:
- Superadmin bypasses team context
- Developer API key bypasses for testing

─────────────────────────────────────────

📖 RELATED DOCUMENTATION

docs/features/authentication.md
- Overview of auth flows
- Token management
- OAuth providers

docs/architecture/security.md
- Security best practices
- OWASP guidelines

─────────────────────────────────────────

📖 KEY FILES

core/lib/auth/
├─ session.ts - Session management
├─ api-key.ts - API key validation
└─ middleware.ts - Auth middleware

─────────────────────────────────────────

📌 SUMMARY FOR DEVELOPMENT

When implementing auth-related features:
1. Use authenticateRequest() helper
2. Enable both session AND API key
3. Always validate team context
4. RLS handles data isolation

Questions? Ask about specific patterns.
```

---

## Example: Read Skill

```
/session:doc:read --skill entity-system
```

Output:

```
📚 SKILL: entity-system

─────────────────────────────────────────

## Overview

Config-driven entity system for automatic CRUDs.
Creates API, UI, and types from configuration.

## Key Files

When creating an entity:
1. config.ts - Entity configuration
2. fields.ts - Field definitions
3. schema.ts - Zod validation
4. service.ts - Business logic (optional)
5. messages.ts - i18n translations

## Pattern Example

```typescript
// core/config/entities/products.ts
export const productsEntity: EntityConfig = {
  name: 'products',
  table: 'products',
  displayName: 'Products',
  fields: {
    name: { type: 'string', required: true },
    price: { type: 'number', required: true },
  }
};
```

## Anti-Patterns

- DON'T use snake_case in field names
- DON'T skip RLS configuration
- DON'T create custom API when entity system works

## Related Skills

- database-migrations
- service-layer
- nextjs-api-development
```

---

## Auto-Read for Session

When starting a session, relevant docs are auto-suggested:

```
📚 SUGGESTED READING

Based on session "new-products-entity":

1. entity-system (SKILL) - How to create entities
2. database-migrations (SKILL) - Migration patterns
3. cypress-api (SKILL) - API testing

Read now? [Yes, all / Select specific / Skip]
```

---

## Options

| Option | Description |
|--------|-------------|
| `--skill <name>` | Read specific skill |
| `--all` | Read all related docs |
| `--brief` | Summary only |

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:doc:feature` | Generate feature docs |
| `/session:start` | Start session (auto-reads) |
