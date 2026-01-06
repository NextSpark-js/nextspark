---
description: Document pending items discovered during development for future iterations
---

# Task Pending - Document Deferred Items

You are documenting a pending item discovered during development that will be addressed in a future iteration.

**Session and Pending Description:**
{{{ input }}}

---

## Your Mission

Document pending items properly so they can be addressed in future versions:

1. **Capture the pending item** with full context
2. **Classify priority and category**
3. **Document impact** of not resolving now
4. **Provide recommendations** for future iteration
5. **Update pendings.md** in session folder

---

## Pending Documentation Protocol

### Step 1: Read Session Context

```typescript
const sessionPath = extractSessionPath(input)

// Read current pendings
await Read(`${sessionPath}/pendings.md`)

// Read context for understanding
await Read(`${sessionPath}/clickup_task.md`)
await Read(`${sessionPath}/plan.md`)
await Read(`${sessionPath}/progress.md`)
```

### Step 2: Classify Pending Item

**Ask user about the pending:**

```typescript
await AskUserQuestion({
  questions: [
    {
      header: "Priority",
      question: "What priority is this pending item?",
      options: [
        { label: "High", description: "Should be done in next iteration" },
        { label: "Medium", description: "Important but can wait" },
        { label: "Low", description: "Nice to have, low urgency" }
      ],
      multiSelect: false
    },
    {
      header: "Category",
      question: "What category is this pending?",
      options: [
        { label: "Feature", description: "Missing or incomplete feature" },
        { label: "Bug", description: "Known issue not blocking" },
        { label: "Refactor", description: "Code improvement opportunity" },
        { label: "Performance", description: "Optimization needed" },
        { label: "Security", description: "Security enhancement" },
        { label: "UX", description: "User experience improvement" },
        { label: "Documentation", description: "Docs needed" }
      ],
      multiSelect: false
    },
    {
      header: "Reason",
      question: "Why is this being deferred?",
      options: [
        { label: "Insufficient time", description: "Not enough time in current sprint" },
        { label: "Out of current scope", description: "Out of scope for this version" },
        { label: "Requires product decision", description: "Needs PM decision" },
        { label: "External dependency", description: "Blocked by external factor" },
        { label: "High technical complexity", description: "Too complex for current iteration" }
      ],
      multiSelect: true
    }
  ]
})
```

### Step 3: Document in pendings.md

```typescript
// Get current pending count
const currentPendings = await Read(`${sessionPath}/pendings.md`)
const pendingCount = countExistingPendings(currentPendings) + 1

await Edit({
  file_path: `${sessionPath}/pendings.md`,
  old_string: "No pending items documented for this session.",
  new_string: `### P${pendingCount}: ${pendingTitle}

**Detected by:** ${agentName}
**Date:** ${date}
**Priority:** ${priority}
**Category:** ${category}

**Description:**
${description}

**Reason for Deferring:**
${reasons.map(r => `- [x] ${r}`).join('\n')}

**Impact of Not Resolving:**
- Affected functionality: ${affectedFunctionality}
- Affected users: ${affectedUsers}
- Risk: ${riskLevel}

**Recommendation for v${version + 1}:**
1. ${recommendation1}
2. ${recommendation2}
3. ${recommendation3}

**Related Files:**
${relatedFiles.map(f => `- \`${f.path}\` - ${f.description}`).join('\n')}

**Affected Acceptance Criteria:**
${affectedACs.map(ac => `- ${ac.id}: ${ac.impact}`).join('\n')}

---

No more pending items documented for this session.`
})
```

### Step 4: Update Summary

```typescript
await Edit({
  file_path: `${sessionPath}/pendings.md`,
  old_string: `**Total Pending:** ${currentCount}
**High Priority:** ${highCount}
**Medium Priority:** ${medCount}
**Low Priority:** ${lowCount}`,
  new_string: `**Total Pending:** ${currentCount + 1}
**High Priority:** ${newHighCount}
**Medium Priority:** ${newMedCount}
**Low Priority:** ${newLowCount}`
})

// Update status
await Edit({
  file_path: `${sessionPath}/pendings.md`,
  old_string: "**Status:** No pending items",
  new_string: "**Status:** Has pending items"
})
```

### Step 5: Update Context

```typescript
await Edit({
  file_path: `${sessionPath}/context.md`,
  // Add note about new pending
  new_content: `
---

### [YYYY-MM-DD HH:MM] - task:pending

**Status:** ⚠️ Pending Documented

**Pending Added:** P${pendingCount} - ${pendingTitle}
**Priority:** ${priority}
**Category:** ${category}

**Summary:**
${description}

**Reason:**
${mainReason}

**Impact:**
${impactSummary}

**Notes:**
- Documented in pendings.md
- Will be addressed in v${version + 1}
`
})
```

---

## Pending Item Template

```markdown
### P[N]: [Pending Title]

**Detected by:** [agent-name]
**Date:** YYYY-MM-DD
**Priority:** High / Medium / Low
**Category:** Feature / Bug / Refactor / Performance / Security / UX / Documentation

**Description:**
[Detailed description of what was left unresolved]

**Reason for Deferring:**
- [ ] Insufficient time
- [ ] Out of current scope
- [ ] Requires product decision
- [ ] External dependency
- [ ] High technical complexity
- [ ] Other: [specify]

**Impact of Not Resolving:**
- Affected functionality: [description]
- Affected users: [who]
- Risk: [low/medium/high]

**Recommendation for v[X+1]:**
1. [Recommended step 1]
2. [Recommended step 2]
3. [Recommended step 3]

**Related Files:**
- `path/to/file1.ts` - [description]
- `path/to/file2.tsx` - [description]

**Affected Acceptance Criteria:**
- AC[X]: [description of how it's affected]
```

---

## Output Format

```markdown
## Pending Item Documented

**Session:** `.claude/sessions/YYYY-MM-DD-feature-name-v1/`
**Pending ID:** P[N]
**Title:** [Pending Title]

### Summary
- **Priority:** [High/Medium/Low]
- **Category:** [Category]
- **Reason:** [Main reason for deferring]

### Impact
- **Affected:** [What's affected]
- **Risk:** [Risk level]

### For Next Version
When creating v2, the PM and Architect will:
1. Read this pendings.md
2. Include this item in v2 requirements
3. Plan appropriate solution

### File Updated
- `pendings.md` - Pending P[N] added
- `context.md` - Entry added
```

---

## Best Practices for Pending Documentation

### DO:
- Be specific about what's pending
- Explain WHY it's being deferred
- Provide clear recommendations
- List affected files and ACs
- Estimate impact honestly

### DON'T:
- Use vague descriptions
- Skip the impact assessment
- Forget to update summary counts
- Leave without recommendations
- Document trivial items as pendings

---

## When to Use This Command

**Use task:pending when:**
- Feature is partially complete but time-boxed
- Edge case discovered but out of scope
- Performance optimization identified but not critical
- UX improvement suggested but not blocking
- Technical debt found during implementation

**DON'T use for:**
- Bugs that block the feature (fix now)
- Core functionality missing (expand scope)
- Security vulnerabilities (fix immediately)
- Items that should be separate features (create new session)

---

**Now document the pending item for the session described above.**
