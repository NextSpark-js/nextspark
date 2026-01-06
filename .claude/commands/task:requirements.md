---
description: "[Step 1] Generate detailed feature requirements through interactive questions"
---

# Task Requirements - Interactive Requirements Gathering

You are starting the requirements gathering process for a new feature. This is the FIRST step before any planning or development.

**Feature Description:**
{{{ input }}}

---

## Your Mission

Conduct an **interactive requirements gathering session** to create a comprehensive `requirements.md` document that will guide all subsequent planning and development.

**This is NOT a planning phase.** You are gathering and documenting requirements ONLY.

---

## Process Overview

```
1. Ask clarifying questions about the feature
2. Gather user stories and acceptance criteria
3. Identify technical constraints and preferences
4. Define session scope (MANDATORY - always ask user)
5. Create session folder and write requirements.md
6. Get user approval before proceeding to task:plan
```

---

## Step 1: Feature Understanding

**Ask the user clarifying questions to understand:**

1. **Business Context:**
   - What problem does this feature solve?
   - Who are the target users?
   - What is the expected business impact?

2. **User Stories:**
   - As a [user type], I want [goal] so that [benefit]
   - What are the primary use cases?
   - What are the edge cases?

3. **Acceptance Criteria (with Classification - MANDATORY):**
   - What must be true for this feature to be considered complete?
   - What are the validation rules?
   - What are the error handling requirements?

   **CRITICAL: Each AC MUST be classified with one of these tags:**
   - `[AUTO]` - Can be verified with automated tests (Cypress API/UAT)
   - `[MANUAL]` - Requires manual verification (visual, UX, navigation)
   - `[REVIEW]` - Requires human review (code quality, docs, subjective)

   **Example:**
   ```markdown
   - [AUTO] User can create a product with valid data
   - [AUTO] System returns 400 for invalid input
   - [MANUAL] Form layout matches design mockup
   - [MANUAL] Loading states display correctly
   - [REVIEW] Code follows project conventions
   ```

**Use AskUserQuestion tool to gather this information:**

```typescript
await AskUserQuestion({
  questions: [
    {
      header: "User Type",
      question: "Who is the primary user of this feature?",
      options: [
        { label: "Admin/Superadmin", description: "Users with administrative access" },
        { label: "Regular User", description: "Standard authenticated users" },
        { label: "Public/Guest", description: "Unauthenticated visitors" },
        { label: "API Consumer", description: "External systems via API" }
      ],
      multiSelect: false
    },
    {
      header: "Data Storage",
      question: "Does this feature need to store data?",
      options: [
        { label: "New database table", description: "Create a new entity with migrations" },
        { label: "Extend existing table", description: "Add fields to existing entity" },
        { label: "Read-only", description: "Only reads existing data" },
        { label: "No database", description: "Purely UI or client-side" }
      ],
      multiSelect: false
    }
  ]
})
```

---

## Step 2: Technical Preferences

**Ask about technical constraints and preferences:**

1. **UI/UX:**
   - Are there specific design requirements?
   - Should it follow existing patterns in the app?
   - Mobile-first or desktop-first?

2. **Data Requirements:**
   - New entities needed?
   - Relationships with existing entities?
   - Validation rules?

3. **Integration:**
   - External APIs needed?
   - Internal service dependencies?
   - Authentication requirements?

---

## Step 3: Session Scope Definition (MANDATORY)

**CRITICAL: You MUST ask the user about scope. NEVER assume scope based on the feature description.**

Based on the user's input, you should **analyze and suggest** a scope, but **always confirm with the user**.

### 3.1 Analyze User Input for Scope Hints

Before asking, analyze the feature description to identify:
- Does it mention modifying core framework code? → Suggest Core Change
- Does it mention a specific theme? → Suggest Feature with that theme
- Does it mention creating a new plugin? → Suggest New Plugin
- Does it mention creating a new theme? → Suggest New Theme
- Is it unclear? → Default to Feature and ask which theme

### 3.2 Ask Development Type (REQUIRED)

```typescript
// ALWAYS ask - never assume
await AskUserQuestion({
  questions: [
    {
      header: "Dev Type",
      question: "What type of development is this task? (Based on your description, I suggest: [YOUR_ANALYSIS])",
      options: [
        { label: "Feature", description: "Feature in existing theme (most common)" },
        { label: "Core Change", description: "Modify core framework (core/, app/, scripts/)" },
        { label: "New Theme", description: "Create a new theme from scratch" },
        { label: "New Plugin", description: "Create a reusable plugin" },
        { label: "Plugin + Theme", description: "Create plugin AND new theme for testing" }
      ],
      multiSelect: false
    }
  ]
})
```

### 3.3 Ask Theme Selection (if applicable)

```typescript
// If Dev Type is Feature or New Theme
if (devType === 'Feature') {
  // Read .env to get current active theme as default suggestion
  const envContent = await Read('.env')
  const activeTheme = extractActiveTheme(envContent) // e.g., "default"

  await AskUserQuestion({
    questions: [{
      header: "Theme",
      question: `Which theme should this feature be developed in? (Current active: ${activeTheme})`,
      options: [
        { label: activeTheme, description: `Current active theme (Recommended)` },
        { label: "Other theme", description: "Specify a different existing theme" }
      ],
      multiSelect: false
    }]
  })
}

if (devType === 'New Theme') {
  // Ask for the new theme name
  await AskUserQuestion({
    questions: [{
      header: "Theme Name",
      question: "What should the new theme be called? (kebab-case, e.g., 'my-new-theme')",
      options: [
        { label: "Provide name", description: "I'll type the theme name" }
      ],
      multiSelect: false
    }]
  })
}
```

### 3.4 Ask Plugin Selection (if applicable)

```typescript
// If Dev Type involves plugins
if (devType === 'New Plugin' || devType === 'Plugin + Theme') {
  await AskUserQuestion({
    questions: [{
      header: "Plugin Name",
      question: "What should the plugin be called? (kebab-case, e.g., 'my-plugin')",
      options: [
        { label: "Provide name", description: "I'll type the plugin name" }
      ],
      multiSelect: false
    }]
  })
}
```

### 3.5 Confirm Final Scope

**After gathering all scope information, present the scope summary and ask for confirmation:**

```typescript
// Build scope object based on answers
const scope = {
  core: devType === 'Core Change',
  theme: (devType === 'Feature' || devType === 'New Theme') ? themeName : false,
  plugins: (devType === 'New Plugin' || devType === 'Plugin + Theme') ? [pluginName] : false
}

// Build allowed paths for display
const allowedPaths = ['.claude/sessions/**/*']
if (scope.core) allowedPaths.push('core/**/*', 'app/**/*', 'scripts/**/*', 'migrations/**/*')
if (scope.theme) allowedPaths.push(`contents/themes/${scope.theme}/**/*`)
if (scope.plugins) scope.plugins.forEach(p => allowedPaths.push(`contents/plugins/${p}/**/*`))

console.log(`
## Scope Confirmation Required

Based on your answers, the session scope will be:

**Development Type:** ${devType}
**Scope Configuration:**
- Core Access: ${scope.core ? '✅ ALLOWED' : '❌ DENIED'}
- Theme: ${scope.theme ? `✅ "${scope.theme}"` : '❌ No theme access'}
- Plugins: ${Array.isArray(scope.plugins) ? `✅ [${scope.plugins.join(', ')}]` : '❌ No plugin access'}

**Allowed Paths:**
${allowedPaths.map(p => '- ' + p).join('\n')}

**⚠️ Important:** Developers will ONLY be able to modify files in the allowed paths above.
`)

await AskUserQuestion({
  questions: [{
    header: "Confirm Scope",
    question: "Is this scope correct for your task?",
    options: [
      { label: "Yes, confirmed", description: "Proceed with this scope" },
      { label: "No, adjust", description: "Let me change the scope settings" }
    ],
    multiSelect: false
  }]
})
```

### 3.6 Document Scope in Requirements

**Store the confirmed scope in the requirements document:**

```typescript
// Add to requirements.md
const scopeSection = `
## Session Scope (CONFIRMED BY USER)

**Development Type:** ${devType}
**Scope:**
- Core: ${scope.core}
- Theme: ${scope.theme || 'false'}
- Plugins: ${JSON.stringify(scope.plugins) || 'false'}

**Allowed Paths:**
${allowedPaths.map(p => '- `' + p + '`').join('\n')}

**Confirmed:** Yes (user approved)
`
```

---

## Step 4: Create Session Folder

**Create the session folder with version (include scope in folder context):**

```typescript
// Determine folder name
const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
const featureName = slugify(input) // e.g., "product-grid-view"
const sessionPath = `.claude/sessions/${today}-${featureName}-v1/`

// Create folder
await Bash({ command: `mkdir -p "${sessionPath}"` })
```

---

## Step 5: Write requirements.md

**Use the template from tools/sessions/templates/requirements.md (include scope section):**

```typescript
await Read('.claude/tools/sessions/templates/requirements.md')

// Create requirements.md with gathered information
await Write({
  file_path: `${sessionPath}/requirements.md`,
  content: `# Feature Requirements: ${featureName}

**Session:** \`${sessionPath}\`
**Created:** ${today}
**Created By:** User (with assistant help)
**Version:** v1

---

## Business Context

### Problem Statement
${problemStatement}

### Target Users
${targetUsers}

### Business Value
${businessValue}

---

## User Stories

### Primary User Story
**As a** ${userType}
**I want** ${goal}
**So that** ${benefit}

### Additional User Stories
${additionalStories}

---

## Acceptance Criteria (CLASSIFIED - MANDATORY)

**Classification Legend:**
- \`[AUTO]\` - Automated test (Cypress API/UAT)
- \`[MANUAL]\` - Manual verification (qa-manual)
- \`[REVIEW]\` - Human review (code-reviewer, docs)

### Functional Criteria
${acceptanceCriteria_auto}

### Manual Verification
${acceptanceCriteria_manual}

### Review Items
${acceptanceCriteria_review}

**Summary:**
- AUTO: ${count_auto} criteria (will have automated tests)
- MANUAL: ${count_manual} criteria (verified by qa-manual)
- REVIEW: ${count_review} criteria (verified by code-reviewer/docs)

---

## UI/UX Requirements

${uiuxRequirements}

---

## Technical Constraints

${technicalConstraints}

---

## Data Requirements

${dataRequirements}

---

## Out of Scope

${outOfScope}

---

## Session Scope (CONFIRMED BY USER)

**Development Type:** ${devType}

**Scope Configuration:**
- **Core Access:** ${scope.core ? '✅ ALLOWED' : '❌ DENIED'}
- **Theme:** ${scope.theme ? `✅ "${scope.theme}"` : '❌ No theme access'}
- **Plugins:** ${Array.isArray(scope.plugins) ? `✅ [${scope.plugins.join(', ')}]` : '❌ No plugin access'}

**Allowed Paths:**
${allowedPaths.map(p => '- \`' + p + '\`').join('\n')}

**User Confirmed:** ✅ Yes

---

## Open Questions

${openQuestions}

---

## Approval

- [x] Requirements reviewed by user
- [x] Scope confirmed by user
- [ ] Questions clarified
- [ ] Ready for technical planning (task:plan)

---

**Next Step:** Run \`/task:plan\` to create technical implementation plan.
`
})
```

---

## Step 6: User Approval

**Present the requirements summary (including scope) and ask for approval:**

```markdown
## Requirements Summary

**Feature:** {feature-name}
**Session:** .claude/sessions/YYYY-MM-DD-feature-name-v1/

### User Stories
- [List user stories]

### Acceptance Criteria
1. [AC1]
2. [AC2]
3. [AC3]

### Session Scope (CONFIRMED)
- **Dev Type:** {Feature/Core Change/New Theme/New Plugin/Plugin+Theme}
- **Core:** {true/false}
- **Theme:** {theme-name or false}
- **Plugins:** {[plugin-names] or false}

### Out of Scope
- [What's NOT included]

---

**Please review the requirements AND scope above.**

**Options:**
1. **Approve** - Ready to proceed to `/task:plan`
2. **Modify** - Adjust specific requirements
3. **Change Scope** - Modify scope settings
4. **Add more** - Include additional requirements
```

---

## Output Format

**After gathering all requirements, output:**

```markdown
## Requirements Gathered

**Session created:** `.claude/sessions/YYYY-MM-DD-feature-name-v1/`
**Requirements file:** `requirements.md`

### Summary
- **User Stories:** X defined
- **Acceptance Criteria:** Y defined
- **Out of Scope:** Z items

### Scope (Confirmed by User)
- **Dev Type:** {type}
- **Core:** {true/false}
- **Theme:** {theme-name or false}
- **Plugins:** {[names] or false}

### Files Created
- `requirements.md` - Complete requirements document (includes scope)

### Next Step
Run `/task:plan` to create the technical implementation plan.

The Product Manager and Architecture Supervisor will use these requirements
(including the confirmed scope) to create the ClickUp task, scope.json, and technical plan.
```

---

## Key Principles

1. **Be Thorough:** Ask enough questions to fully understand the feature
2. **Be Specific:** Acceptance criteria should be measurable and testable
3. **Be Realistic:** Identify what's out of scope early
4. **Be Interactive:** Use AskUserQuestion to gather structured input
5. **ALWAYS Ask Scope:** NEVER assume scope - always ask user to confirm Dev Type, Theme, and Plugins
6. **Get Approval:** Requirements AND scope must be approved before planning

---

## Common Questions to Ask

### For CRUD Features:
- What fields are required vs optional?
- What validation rules apply?
- Who can create/read/update/delete?
- What happens when deleting related data?

### For UI Features:
- Are there mockups or design references?
- What responsive breakpoints matter?
- What loading/error states are needed?
- Any accessibility requirements?

### For API Features:
- What authentication is required?
- What are the rate limits?
- What response formats are needed?
- How should errors be handled?

---

## Remember

- This is requirements gathering, NOT planning
- Don't make technical decisions yet
- Focus on WHAT, not HOW
- Document everything for the planning phase
- Get explicit user approval before proceeding

---

**Now begin the interactive requirements gathering process for the feature described above.**
