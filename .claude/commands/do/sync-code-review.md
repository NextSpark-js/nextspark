---
description: "Sync with GitHub PR code review: evaluate, fix, and respond"
---

# /do:sync-code-review

**PR URL or Number:** {{{ input }}}

---

## Related Skills

See `.claude/skills/github/SKILL.md` for general GitHub workflow patterns (branches, commits, PRs).

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
10. **Request re-review** → Comment `@claude` again to validate fixes

### Evaluation Criteria

| Action | When to Use |
|--------|-------------|
| **ACCEPT** | Issue is valid, fix as suggested |
| **PARTIAL** | Issue is valid, will fix differently |
| **DEFER** | Valid but out of scope |
| **REJECT** | Based on incorrect assumption or intentional design |

### Evaluation Process

1. **Read the code review carefully** - Identify all reported issues (vulnerabilities, race conditions, bugs, style issues, etc.)
2. **Perform your own analysis** - For each issue, verify if it's correctly reported:
   - Is the issue real or a false positive?
   - Does the suggested fix make sense?
   - Are there better alternatives?
3. **Prioritize by severity** - Critical (security/data loss) > Medium (bugs) > Minor (style)
4. **Decide action for each** - ACCEPT, PARTIAL, DEFER, or REJECT with reasoning

### Response Format

```markdown
## Code Review Response

### Changes Implemented

| Issue | Severity | Status | Details |
|-------|----------|--------|---------|
| <title> | Critical/Medium/Minor | ✅ Fixed / ⏭️ Deferred / ❌ Won't Fix | <details> |

### Explanation for Deferred/Rejected Issues

> For each DEFER or REJECT, explain your reasoning to reach agreement with the reviewer.

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

# Poll for review response (30s intervals, max 5min)
for i in {1..10}; do
  REVIEW=$(gh pr view <number> --json comments --jq '.comments[-1].body' | grep -i "code review complete")
  if [ -n "$REVIEW" ]; then
    echo "Review received"
    break
  fi
  echo "Waiting for review... ($i/10)"
  sleep 30
done

# Commit with attribution
git commit -m "fix: address code review feedback for PR #<number>

Co-Authored-By: Claude Code <noreply@anthropic.com>"

# Comment response
gh pr comment <number> --body "<response>"

# Request re-review after fixes
gh pr comment <number> --body "@claude"
```

---

## Example

```bash
/do:sync-code-review https://github.com/NextSpark-js/nextspark/pull/19
/do:sync-code-review 19
```
