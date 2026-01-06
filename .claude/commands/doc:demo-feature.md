---
description: "Generate a demo video for a feature using Cypress with narration"
---

# Demo Feature Video - Documentation Generator

Generate a documentation video demonstrating a feature using Cypress automated tests with narration support.

**User Request:**
{{{ input }}}

---

## Overview

This command creates demonstration videos that show how features work. The videos include:
- Visual demonstration of the feature
- Subtitle markers (via `cy.log()`) that can be used for voice-over
- Proper pacing for viewers to follow along
- Highlight effects on important elements

---

## Phase 1: Detect Context

### Check for Active Session

First, check if there's an active development session:

```typescript
// Look for recent sessions
const sessions = await Glob('.claude/sessions/*/plan.md')

if (sessions.length > 0) {
  // Find most recent session
  const recentSession = sessions.sort().reverse()[0]
  const sessionPath = recentSession.replace('/plan.md', '')
  const sessionName = sessionPath.split('/').pop()

  // Read session files
  const planContent = await Read(`${sessionPath}/plan.md`)
  const clickupContent = await Read(`${sessionPath}/clickup_task.md`)

  // Ask user if they want to demo this feature
  const useSession = await AskUserQuestion({
    question: `Detected an active session: ${sessionName}. Do you want to create a demo of this feature?`,
    options: [
      { label: 'Yes, use this session', description: 'Create demo based on the session plan and ACs' },
      { label: 'No, another feature', description: 'Manually specify what to document' }
    ]
  })
}
```

### If No Session or User Chooses Custom

Ask for feature details:

```typescript
const featureDescription = await AskUserQuestion({
  question: 'What feature do you want to document in video?',
  // Free text input
})
```

---

## Phase 2: Define Scope

### Duration Target

```typescript
const duration = await AskUserQuestion({
  question: 'What is the target duration for the video?',
  options: [
    { label: '1-1:30 min', description: 'Very quick demo, only the essentials' },
    { label: '1:30-2 min', description: 'Concise demo with basic explanations (Recommended)' },
    { label: '2-3 min', description: 'Detailed demo with context' },
    { label: '3-5 min', description: 'Complete tutorial with multiple aspects' }
  ]
})
```

### Target Audience

```typescript
const audience = await AskUserQuestion({
  question: 'Who is the target audience for the video?',
  options: [
    { label: 'End user', description: 'Focus on UI and workflows' },
    { label: 'Administrator', description: 'Includes configuration and permissions' },
    { label: 'Developer', description: 'Includes technical aspects and API' }
  ]
})
```

### Aspects to Cover

```typescript
const aspects = await AskUserQuestion({
  question: 'What aspects should be covered? (select multiple)',
  multiSelect: true,
  options: [
    { label: 'Main flow', description: 'The most common use case' },
    { label: 'Permissions/Roles', description: 'Differences based on user role' },
    { label: 'Configuration', description: 'Settings and options' },
    { label: 'Edge cases', description: 'Validations and errors' }
  ]
})
```

### Language

```typescript
const language = await AskUserQuestion({
  question: 'What language should the subtitles be in?',
  options: [
    { label: 'Spanish', description: 'Subtitles in Spanish' },
    { label: 'English', description: 'Subtitles in English (Recommended)' }
  ]
})
```

---

## Phase 3: Analyze Feature

Based on scope, analyze the feature to document:

### If Using Session

1. Read `plan.md` for technical details
2. Read `clickup_task.md` for acceptance criteria
3. Read `tests.md` for available `data-cy` selectors
4. Identify key user flows
5. Identify users/roles to demonstrate
6. List pages/routes involved

### If Custom Feature

1. Search codebase for feature components
2. Find relevant routes in `app/`
3. Find relevant `data-cy` selectors
4. Identify available test users in DevKeyring
5. Determine permission differences if applicable

---

## Phase 4: Generate Narration Proposal

Based on the analysis, generate a narration script:

### Structure

```markdown
# Demo: {Feature Name}

**Target Duration:** {duration}
**Audience:** {audience}
**Language:** {language}

---

## Chapter 1: Introduction
- Welcome and feature context
- What the viewer will learn

## Chapter 2: {Main Flow}
- Step by step of the main flow
- Explanation of each action

## Chapter 3: {Additional Aspect}
- Based on selection (permissions, config, etc.)

## Chapter N: Conclusion
- Summary of what was demonstrated
- Next steps or related features

---

## Complete Narration

### Chapter 1: Introduction

1. "Welcome to the {Feature} demo. Today you will learn how to..."
   - Action: None (intro)
   - Estimated duration: ~X seconds

2. "{User} is a user with {role} role. Let's see how it works."
   - Action: Login
   - Estimated duration: ~X seconds

### Chapter 2: {Main Flow}

3. "We navigate to the {section} section..."
   - Action: cy.visit('/dashboard/{section}')
   - Estimated duration: ~X seconds

...

---

## Technical Data

**Test user:** {email}
**Routes involved:** {routes}
**Key selectors:**
- {selector1}: {description}
- {selector2}: {description}

---

## Timing Calculation

| Concept | Quantity | Time |
|---------|----------|------|
| Total words | {N} | {X}ms |
| Chapters | {N} | {X}ms |
| Page loads | {N} | {X}ms |
| Highlights | {N} | {X}ms |
| Cypress commands | {N} | - |
| **Calculated commandDelay** | - | {X}ms |
| **Estimated duration** | - | {X:XX} |
```

---

## Phase 5: Present and Approve

### Show Narration to User

Present the complete narration proposal with:
- Chapter structure
- Each narration text
- Estimated duration
- Technical details

### Ask for Approval

```typescript
const approval = await AskUserQuestion({
  question: 'Do you approve this narration to generate the video?',
  options: [
    { label: 'Approve and generate', description: 'Launch agent to create the Cypress test' },
    { label: 'Adjust narration', description: 'Modify texts or structure before generating' },
    { label: 'Change scope', description: 'Redefine what aspects to cover' },
    { label: 'Cancel', description: 'Do not generate video' }
  ]
})
```

### If Adjustments Needed

Allow user to specify changes:
- Add/remove narrations
- Change wording
- Adjust chapter structure
- Modify duration target

Loop back to present updated narration until approved.

---

## Phase 6: Launch Agent

Once narration is approved, launch the `demo-video-generator` agent:

```typescript
await launchAgent('demo-video-generator', {
  task: `Generate demo video for: ${featureName}`,
  prompt: `
## Approved Narration

${approvedNarrationMarkdown}

## Configuration

- Feature Name: ${featureName}
- Feature Slug: ${featureSlug}
- Target Duration: ${targetDuration}
- Language: ${language}
- Audience: ${audience}

## Technical Context

- Test User: ${testUser}
- Routes: ${routes.join(', ')}
- Selectors:
${selectors.map(s => `  - ${s.name}: ${s.selector}`).join('\n')}

## Timing Calculation

- Total Words: ${totalWords}
- Estimated Narration Time: ${narrationTimeMs}ms
- Estimated Action Time: ${actionTimeMs}ms
- Cypress Commands: ~${numCommands}
- Calculated commandDelay: ${commandDelay}ms
- Expected Duration: ${expectedDuration}

## Instructions

1. Create the Cypress test file at:
   contents/themes/default/tests/cypress/e2e/docs/tutorials/${featureSlug}.doc.cy.ts

2. Create the narration JSON at:
   contents/themes/default/tests/cypress/e2e/docs/tutorials/${featureSlug}.narration.json

3. Create the narration MD at:
   contents/themes/default/tests/cypress/e2e/docs/tutorials/${featureSlug}.narration.md

4. Use the CALCULATED commandDelay and narration times

5. Run the test and report:
   - Test success/failure
   - Video file location
   - Actual duration vs target
   - Any issues encountered
`
})
```

---

## Phase 7: Report Results

After agent completes, report to user:

```markdown
## ✅ Demo Video Generated

### Files Created

📹 **Video:** `cypress/videos/docs/tutorials/${featureSlug}.doc.cy.ts.mp4`
📝 **Test:** `cypress/e2e/docs/tutorials/${featureSlug}.doc.cy.ts`
📋 **Narration JSON:** `cypress/e2e/docs/tutorials/${featureSlug}.narration.json`
📄 **Narration MD:** `cypress/e2e/docs/tutorials/${featureSlug}.narration.md`

### Timing Results

| Metric | Value |
|--------|-------|
| Target Duration | ${targetDuration} |
| Actual Duration | ${actualDuration} |
| Difference | ${difference} |
| Status | ✅ Within target / ⚠️ Over target |

### Next Steps

1. **Review video:** Open the MP4 file to verify content
2. **Add voice-over:** Use the narration.md script for recording
3. **Generate subtitles:** Use narration.json for SRT generation
4. **Post-process:** Add AI voice-over with ElevenLabs/Google TTS

### Run Again

To regenerate the video:
\`\`\`bash
NEXT_PUBLIC_ACTIVE_THEME=default pnpm cy:run --spec "**/docs/tutorials/${featureSlug}.doc.cy.ts"
\`\`\`
```

---

## Error Handling

### Test Fails

If the Cypress test fails:
1. Report the error
2. Suggest reviewing selectors
3. Offer to regenerate with fixes

### Duration Off Target

If video duration is significantly off:
1. Report the difference
2. Explain what caused it (page loads, etc.)
3. Suggest adjustments for next iteration

### Missing Selectors

If required `data-cy` selectors don't exist:
1. List missing selectors
2. Suggest running frontend-validator first
3. Or manually add selectors before regenerating

---

## Examples

### Example 1: Demo from Active Session

```
User: /doc:demo-feature

Command: Detected active session: 2025-12-13-teams-permissions-v1
         Do you want to create a demo of this feature?

User: Yes, use this session

Command: Target duration?

User: 1:30-2 min

Command: Audience?

User: End user

Command: Aspects to cover?

User: Main flow, Permissions/Roles

Command: [Generates narration proposal]
         [Presents for approval]

User: Approve and generate

Command: [Launches demo-video-generator]
         [Reports results]
```

### Example 2: Custom Feature Demo

```
User: /doc:demo-feature create demo of the billing system

Command: No active session detected.
         What is the target duration?

User: 2-3 min

Command: Audience?

User: Administrator

Command: [Analyzes the billing feature]
         [Generates narration proposal]
         [Presents for approval]

User: Adjust narration - I want more emphasis on the reports

Command: [Adjusts narration]
         [Presents new version]

User: Approve and generate

Command: [Launches demo-video-generator]
         [Reports results]
```

---

## Reference Documentation

- **Cypress Demo System:** `contents/themes/default/tests/cypress/e2e/docs/README.md`
- **Example Test:** `contents/themes/default/tests/cypress/e2e/docs/tutorials/teams-system.doc.cy.ts`
- **Agent Instructions:** `.claude/agents/demo-video-generator.md`

---

## Notes

- Videos are generated WITHOUT audio (subtitles only via cy.log)
- For voice-over, use the .narration.md file as script
- The narration.json can be used to generate SRT subtitles
- AI voice-over services (ElevenLabs, etc.) can use the JSON timestamps
- Keep demos under 5 minutes; split longer tutorials

---

*Command version: 1.0*
*Last updated: 2025-12-13*
