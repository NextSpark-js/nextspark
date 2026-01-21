---
description: "Sync with GitHub PR code review: evaluate, fix, and respond"
---

# /do:sync-code-review

**PR URL or Number:** {{{ input }}}

---

## Instructions

You will synchronize with a GitHub PR code review. Follow these steps:

### Step 1: Fetch PR Data

```bash
# If input is a URL, extract the PR number
# If input is just a number, use it directly
gh pr view <number> --repo <owner/repo> --json number,title,body,comments,reviews,state,headRefName,baseRefName
```

Parse the response to find the latest code review comment (look for @claude mentions or structured code review format with "Critical", "Medium", "Minor" severity labels).

### Step 2: Checkout PR Branch

```bash
git fetch origin <headRefName>
git checkout <headRefName>
git pull origin <headRefName>
```

### Step 3: Evaluate Each Issue

For each issue in the code review:

1. **Read the actual code** at the mentioned file/line
2. **Verify if the issue is valid** - check if the code review observation is correct
3. **Determine appropriate action**:
   - **ACCEPT**: Issue is valid, fix as suggested
   - **PARTIAL**: Issue is valid, but will fix differently (better approach)
   - **DEFER**: Valid but out of scope, create follow-up
   - **REJECT**: Issue is based on incorrect assumption or intentional design

Document your evaluation for each issue.

### Step 4: Implement Fixes

For ACCEPT and PARTIAL issues:
1. Make the code changes
2. Verify the fix doesn't break anything
3. Run build: `pnpm build`

### Step 5: Commit & Push

```bash
git add <changed-files>
git commit -m "fix: address code review feedback for PR #<number>

- <change 1>
- <change 2>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

git push origin <branch>
```

### Step 6: Comment on PR

Use gh CLI to post a response comment:

```bash
gh pr comment <number> --repo <owner/repo> --body "<response>"
```

**Comment format:**

```markdown
## Code Review Response

### Changes Implemented

| Issue | Severity | Status | Details |
|-------|----------|--------|---------|
| <issue title> | Critical/Medium/Minor | ✅ Fixed / ⏭️ Deferred / ❌ Won't Fix | <brief details> |

### Explanation for Deferred/Rejected Issues

#### <Issue Title> (Deferred/Won't Fix)
<Explanation of why this was not addressed>

### Verification

- [x] All accepted issues have been addressed
- [x] Build passes
- [x] Ready for re-review

---
Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

---

## Evaluation Criteria

### ACCEPT (Will Fix)
- Issue is technically correct
- Fix aligns with project patterns
- Clear improvement to codebase

### PARTIAL (Will Fix Differently)
- Issue is valid but suggested fix is suboptimal
- Better alternative exists

### DEFER (Create Follow-up)
- Valid issue but out of scope for current PR
- Would cause scope creep

### REJECT (Won't Fix)
- Issue based on incorrect assumptions
- Code is intentionally designed that way
- Fix would introduce worse problems

---

## Safety Checks

Before pushing:
1. **Build check**: Run `pnpm build` to catch errors
2. **Type check**: Ensure TypeScript compiles
3. **Verify branch**: Ensure you're on the correct PR branch

---

## Example

```bash
/do:sync-code-review https://github.com/NextSpark-js/nextspark/pull/19
/do:sync-code-review 19
```
