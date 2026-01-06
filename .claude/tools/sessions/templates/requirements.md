# Feature Requirements: [Feature Name]

**Session:** `.claude/sessions/YYYY-MM-DD-feature-name-v1/`
**Created:** YYYY-MM-DD
**Created By:** User (with assistant help)
**Version:** v1

---

## Business Context

### Problem Statement
[What problem does this feature solve? Describe the current pain point or gap.]

### Target Users
[Who will use this feature? What roles/personas?]

### Business Value
[Why is this important? What's the expected impact or ROI?]

---

## User Stories

### Primary User Story
**As a** [user type]
**I want** [goal/action]
**So that** [benefit/value]

### Additional User Stories
1. As a [user type], I want [goal] so that [benefit]
2. As a [user type], I want [goal] so that [benefit]
3. ...

---

## Acceptance Criteria (DETAILED)

### AC1: [Title - Brief description]
**Given** [precondition/initial state]
**When** [action/trigger]
**Then** [expected result/outcome]

**Details:**
- [Specific behavior 1]
- [Specific behavior 2]
- [Edge case handling]

**Validation:**
- [How to verify this AC is met]

### AC2: [Title]
**Given** [precondition]
**When** [action]
**Then** [expected result]

**Details:**
- [Specific behavior]

**Validation:**
- [Verification method]

### AC3: [Title]
...

---

## UI/UX Requirements (if applicable)

### Screens/Views
- [Screen 1]: [Description of what it shows/does]
- [Screen 2]: [Description]

### Key Interactions
- [Interaction 1]: [How user interacts, expected feedback]
- [Interaction 2]: [Description]

### Responsive Behavior
- **Desktop:** [Specific behavior]
- **Tablet:** [Specific behavior]
- **Mobile:** [Specific behavior]

---

## Technical Constraints (Optional)

### Must Use
- [Required technology/pattern/library]
- [Existing component or service to leverage]

### Must Avoid
- [Prohibited approach or pattern]
- [Known limitation to work around]

### Performance Requirements
- [Specific metrics: load time, response time, etc.]

### Security Requirements
- [Authentication needs]
- [Authorization rules]
- [Data protection requirements]

---

## Data Requirements (if applicable)

### New Entities
- [Entity name]: [Brief description of purpose]

### Entity Relationships
- [Entity A] → [Entity B]: [Relationship type and description]

### Data Validation Rules
- [Field]: [Validation rule]

---

## Integration Points (if applicable)

### Internal Systems
- [System/Service]: [How it integrates]

### External APIs
- [API name]: [Purpose of integration]

---

## Out of Scope

- [What is explicitly NOT included in this feature]
- [Future considerations that will NOT be addressed now]
- [Edge cases that will NOT be handled in this version]

---

## Open Questions

- [ ] [Question 1 that needs clarification]
- [ ] [Question 2]
- [ ] [Question 3]

---

## Technical Flags

**These flags are set by product-manager based on user answers during requirements gathering.**

| Flag | Value | Description |
|------|-------|-------------|
| **Requires New Selectors** | `yes` / `no` / `tbd` | Does this feature need new data-cy selectors? |
| **Selector Impact** | `new-components` / `modify-existing` / `backend-only` / `tbd` | Type of UI selector changes needed |

**Impact on Workflow (v4.1):**
- If `Requires New Selectors = yes` AND `Selector Impact = new-components | modify-existing`:
  - frontend-validator (Phase 12) will create and execute `@ui-selectors` tests
  - These tests validate selectors exist in DOM before qa-automation runs
  - Command: `pnpm cy:run --env grepTags="@ui-selectors"`
  - If @ui-selectors fail, frontend-validator fixes selectors and retries (max 3)

---

## Claude Code Skills [v4.3]

**Does this feature require creating or modifying Claude Code skills?**

| Question | Answer |
|----------|--------|
| **New skill needed?** | `yes` / `no` / `tbd` |
| **Skill name:** | `_________________` |
| **Modify existing skill?** | `yes` / `no` / `tbd` |
| **Existing skill to modify:** | `_________________` |

**Reason:** [Why skill is needed or why modification is required]

**Impact on Workflow (v4.3):**
- If new skill is needed → `workflow-maintainer` agent will create it
- Skills location: `.claude/skills/{skill-name}/SKILL.md`
- All related agents will reference the new skill in their "Required Skills [v4.3]" section

---

## Approval

- [ ] Requirements reviewed by user
- [ ] Questions clarified
- [ ] Technical Flags set
- [ ] Skills question answered
- [ ] Ready for technical planning (task:plan)

---

## Notes

[Any additional context, references, or notes that don't fit above]

---

**Next Step:** Run `/task:plan` to create technical implementation plan.
