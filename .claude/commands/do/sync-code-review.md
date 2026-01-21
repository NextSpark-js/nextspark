---
description: "Sync with GitHub PR code review: evaluate, fix, and respond"
---

# /do:sync-code-review

**PR URL or Number:** {{{ input }}}

---

## MANDATORY: Read Skills First

Read `.claude/skills/github/SKILL.md` for GitHub workflow patterns.

---

## Quick Reference

### Workflow

1. **Fetch PR** → `gh pr view <number> --json comments,headRefName`
2. **Check for review** → Look for @claude code review comment
3. **If no review** → Comment `@claude` and poll for response (30s intervals, max 5min)
4. **Checkout branch** → `git checkout <headRefName>`
5. **Evaluate issues** → ACCEPT / PARTIAL / DEFER / REJECT
6. **Implement fixes** → For ACCEPT and PARTIAL issues
7. **Verify** → `pnpm build`
8. **Commit & push** → With structured message
9. **Comment on PR** → With response table

### Evaluation Criteria

| Action | When to Use |
|--------|-------------|
| **ACCEPT** | Issue is valid, fix as suggested |
| **PARTIAL** | Issue is valid, will fix differently |
| **DEFER** | Valid but out of scope |
| **REJECT** | Based on incorrect assumption or intentional design |

### Response Format

```markdown
## Code Review Response

### Changes Implemented

| Issue | Severity | Status | Details |
|-------|----------|--------|---------|
| <title> | Critical/Medium/Minor | ✅ Fixed / ⏭️ Deferred / ❌ Won't Fix | <details> |

### Explanation for Deferred/Rejected Issues

<explanations>

### Verification

- [x] All accepted issues addressed
- [x] Build passes
- [x] Ready for re-review

---
Co-Authored-By: Claude Code <noreply@anthropic.com>
```

### Commands

```bash
# Fetch PR data
gh pr view <number> --repo <owner/repo> --json number,title,comments,headRefName

# Request code review
gh pr comment <number> --body "@claude"

# Commit with attribution
git commit -m "fix: address code review feedback for PR #<number>

Co-Authored-By: Claude Code <noreply@anthropic.com>"

# Comment response
gh pr comment <number> --body "<response>"
```

---

## Example

```bash
/do:sync-code-review https://github.com/NextSpark-js/nextspark/pull/19
/do:sync-code-review 24
```
