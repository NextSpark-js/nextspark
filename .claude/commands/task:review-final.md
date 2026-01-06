---
description: Final code review after completing the workflow - validates plan, scope, patterns and quality
---

# Task Review Final - Post-Workflow Validation

ultrathink You are performing a final code review after completing the development workflow.

**Session to review:**
{{{ input }}}

---

## Your Mission

Perform a comprehensive final review validating all implementation aspects before considering the task complete.

---

## Review Protocol

### Step 1: Load Session Context

```typescript
const sessionPath = `.claude/sessions/${sessionName}/`

// Load all session files
await Read(`${sessionPath}/requirements.md`)
await Read(`${sessionPath}/plan.md`)
await Read(`${sessionPath}/scope.json`)
await Read(`${sessionPath}/tests.md`)
await Read(`${sessionPath}/context.md`)
await Read(`${sessionPath}/pendings.md`)
```

---

## Review Checklist

### 1. Plan Coherence
- [ ] Implementation matches `plan.md` exactly
- [ ] All items in `requirements.md` addressed
- [ ] ACs fulfilled (AUTO/MANUAL/REVIEW classification respected)
- [ ] No undocumented assumptions or ambiguities
- [ ] No features added beyond scope

### 2. Scope Compliance
- [ ] `scope.json` permissions respected (core/theme/plugins)
- [ ] Files modified only in allowed locations
- [ ] No cross-boundary violations

### 3. Architecture & Patterns
- [ ] No dynamic imports from `@/contents` (use registries)
- [ ] `.rules/` patterns applied correctly
- [ ] TypeScript strict compliance (no unjustified `any`)
- [ ] Proper error handling without over-engineering

### 4. Code Quality
- [ ] No `console.log`, `debugger`, or temp comments
- [ ] No dead code or unused imports
- [ ] No TODOs left unaddressed (document in `pendings.md` if deferred)
- [ ] Performance considerations applied
- [ ] Security best practices followed

### 5. Frontend (if applicable)
- [ ] Translations in correct namespace (no overwrites)
- [ ] `data-cy` on all interactive elements
- [ ] Selectors registered in `contents/themes/{THEME}/tests/cypress/fixtures/selectors.json`
- [ ] Accessibility attributes present

### 6. Tests & Documentation
- [ ] Tests cover ACs per `tests.md`
- [ ] `pendings.md` documents any deferred items
- [ ] `context.md` reflects implementation decisions

---

## Output Format

Report findings with severity levels:

```markdown
## Final Review Report

**Session:** `.claude/sessions/YYYY-MM-DD-feature-name/`
**Reviewed:** YYYY-MM-DD HH:MM
**Verdict:** ✅ APPROVED | ⚠️ NEEDS FIXES | ❌ BLOCKED

### Summary
| Area | Status | Notes |
|------|--------|-------|
| Plan Coherence | ✅/⚠️/❌ | ... |
| Scope Compliance | ✅/⚠️/❌ | ... |
| Architecture | ✅/⚠️/❌ | ... |
| Code Quality | ✅/⚠️/❌ | ... |
| Frontend | ✅/⚠️/❌/N/A | ... |
| Tests | ✅/⚠️/❌ | ... |

### Issues Found

#### ❌ Blockers (must fix)
- [Issue description with file:line reference]

#### ⚠️ Warnings (should fix)
- [Issue description with file:line reference]

#### 💡 Suggestions (optional)
- [Improvement suggestion]

### Files Reviewed
- `path/to/file.ts` - [status]

### Recommendation
[Clear next steps if issues found, or confirmation if approved]
```

---

## Severity Definitions

| Level | Meaning | Action Required |
|-------|---------|-----------------|
| ✅ OK | Meets all criteria | None |
| ⚠️ Warning | Minor issue, non-blocking | Should fix before merge |
| ❌ Blocker | Critical issue | Must fix before proceeding |

---

## Post-Review Actions

**If ✅ APPROVED:**
- Task ready for merge/deployment
- Update `progress.md` with completion status

**If ⚠️ NEEDS FIXES:**
- List specific fixes required
- Re-run review after fixes

**If ❌ BLOCKED:**
- Identify blocking issues
- May require plan revision
- Escalate if architectural concerns

---

**Now perform the final review for the session specified above.**

---

## Post-Review: Next Steps

After completing the review, suggest these options to the user:

```markdown
---

## What's Next?

The code review is complete. Here are your options:

### Learn About the Implementation
**Run:** `/task:explain {sessionPath}`

Get an interactive code walkthrough that explains how the feature works, step by step. Ideal for:
- Understanding the implementation details
- Learning the patterns and architecture used
- Onboarding team members to the new code

### See the Feature in Action
**Run:** `/task:demo {sessionPath}`

Watch a live visual demonstration using Playwright. This will:
- Start the dev server
- Login with appropriate test users
- Navigate through the feature screens
- Show the feature working end-to-end

---

Choose one or proceed to merge!
```
