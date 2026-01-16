# /session:review

Request or perform code review for the session.

---

## Required Skills

**[MANDATORY]** Reference these skills during review:
- `.claude/skills/service-layer/SKILL.md` - Validate service patterns
- `.claude/skills/react-patterns/SKILL.md` - Validate component patterns
- `.claude/skills/zod-validation/SKILL.md` - Validate schema usage
- `.claude/skills/tanstack-query/SKILL.md` - Validate data fetching patterns

For security review:
- `.claude/skills/api-bypass-layers/SKILL.md` - Multi-layer security validation
- `.claude/skills/better-auth/SKILL.md` - Authentication patterns
- `.claude/skills/permissions-system/SKILL.md` - Authorization validation

---

## Syntax

```
/session:review [--self]
```

---

## Behavior

Initiates code review process for the current session changes.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:review                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Collect changes                                             │
│     - Read scope.json                                           │
│     - Get modified files                                        │
│     ↓                                                           │
│  2. Analyze changes                                             │
│     - Code quality                                              │
│     - Security patterns                                         │
│     - Performance implications                                  │
│     - Best practices                                            │
│     ↓                                                           │
│  3. Generate review report                                      │
│     - Issues found                                              │
│     - Suggestions                                               │
│     - Approval status                                           │
│     ↓                                                           │
│  4. Update session status                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example Output

```
🔍 CODE REVIEW

Session: stories/2026-01-11-new-products-entity
Files changed: 12
Lines added: 450
Lines removed: 23

─────────────────────────────────────────

📋 REVIEW CATEGORIES

## Security ✓
No security issues found.

## Performance ⚠
- ProductsService.ts:45 - Consider caching for
  frequently accessed products
- Suggestion: Add index on `categoryId`

## Code Quality ✓
- Follows existing patterns
- Proper TypeScript types
- Good error handling

## Best Practices ⚠
- products.cy.ts:12 - Missing negative test case
- ProductForm.tsx:89 - Consider extracting validation

─────────────────────────────────────────

📊 SUMMARY

Critical Issues:  0
Warnings:         2
Suggestions:      2

─────────────────────────────────────────

Review Status: APPROVED WITH SUGGESTIONS

Proceed to close session? [Yes/Address suggestions first]
```

---

## With Critical Issues

```
❌ CODE REVIEW - CHANGES REQUIRED

─────────────────────────────────────────

## Security ❌

CRITICAL: SQL injection vulnerability
Location: ProductsService.ts:67

```typescript
// BAD - Direct string interpolation
const query = `SELECT * FROM products WHERE name = '${name}'`;

// GOOD - Use parameterized queries
const query = `SELECT * FROM products WHERE name = $1`;
```

## Performance ❌

CRITICAL: N+1 query detected
Location: ProductsList.tsx:34
- Each product triggers separate category fetch
- Solution: Use eager loading or batch fetch

─────────────────────────────────────────

📊 SUMMARY

Critical Issues:  2
Warnings:         1
Suggestions:      3

─────────────────────────────────────────

Review Status: CHANGES REQUIRED

You must fix critical issues before proceeding.
Run /session:execute to address the issues.
```

---

## Options

| Option | Description |
|--------|-------------|
| `--self` | Self-review mode (Claude reviews) |
| `--detailed` | Show line-by-line analysis |
| `--security-only` | Focus on security review |

---

## Task Manager Integration

If `taskManager.enabled`:

```
📋 POSTING REVIEW

ClickUp: #abc123

Posting review comment...
✓ Review posted

Updating status to "In Review"...
✓ Status updated
```

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:validate` | Validate before review |
| `/session:execute` | Fix review issues |
| `/session:close` | Close after approval |
