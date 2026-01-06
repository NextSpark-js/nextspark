---
description: Generate comprehensive documentation for a completed feature using session workflow
---

# Document Feature - Generate Documentation

You are generating documentation for a completed and approved feature.

**Session Path or Feature Name:**
{{{ input }}}

---

## Your Mission

Generate comprehensive documentation for a completed feature:

1. **Validate completion** (QA passed, code reviewed)
2. **Read session files** to understand the feature
3. **Validate against code** (not just plan)
4. **Determine documentation tier** (core, theme, plugin)
5. **Create/update documentation** in appropriate location

---

## Prerequisites

**CRITICAL**: Only use this command for features that have:
- ✅ Passed QA testing (qa-automation marked as ✅ Completed)
- ✅ Passed code review (code-reviewer marked as ✅ Completed)
- ✅ Been approved by stakeholders

**DO NOT use for:**
- Features still in development
- Features that haven't been tested
- Features with failing tests

---

## Documentation Protocol

### Step 1: Locate Session

```typescript
const input = '{{{ input }}}'

// Determine session path
let sessionPath
if (input.includes('.claude/sessions/')) {
  sessionPath = input
} else {
  // Search for session by name
  const sessions = await Glob('.claude/sessions/*/')
  sessionPath = sessions.find(s => s.includes(input))
}

if (!sessionPath) {
  throw new Error(`Session not found: ${input}`)
}
```

### Step 2: Validate Completion

```typescript
// Read context.md to check completion status
await Read(`${sessionPath}/context.md`)

// Verify QA completed
const qaComplete = context.includes('qa-automation') &&
                   (context.includes('✅ Completed') || context.includes('✅ Tests Passed'))

// Verify Code Review completed
const crComplete = context.includes('code-reviewer') &&
                   (context.includes('✅ Completed') || context.includes('⚠️ Approved'))

if (!qaComplete || !crComplete) {
  console.log(`
⚠️ Warning: Feature not fully approved

Current status:
- QA Testing: ${qaComplete ? '✅' : '⚠️ Pending'}
- Code Review: ${crComplete ? '✅' : '⚠️ Pending'}

Continue anyway? (Only recommended if both are ✅)
`)
}
```

### Step 3: Read Session Files

```typescript
// Read all session documentation
const requirements = await Read(`${sessionPath}/requirements.md`)
const clickupTask = await Read(`${sessionPath}/clickup_task.md`)
const plan = await Read(`${sessionPath}/plan.md`)
const progress = await Read(`${sessionPath}/progress.md`)
const tests = await Read(`${sessionPath}/tests.md`)

// Extract key information
const featureName = extractFeatureName(requirements)
const acceptanceCriteria = extractACs(clickupTask)
const technicalPlan = extractPlan(plan)
const implementedFiles = extractFilesFromProgress(progress)
const testResults = extractTestResults(tests)
```

### Step 4: Validate Against Code

```typescript
// CRITICAL: Session files may differ from actual implementation

for (const file of implementedFiles) {
  const actualCode = await Read(file)

  // Verify:
  // - File exists
  // - Functions/components match description
  // - API endpoints work as documented
  // - Props/parameters are accurate
}

// Extract real implementation details
const apiEndpoints = await Glob('app/api/v1/**/*.ts')
const components = await Glob('app/components/**/*.tsx')
```

### Step 5: Determine Documentation Tier

```typescript
// Based on where code was implemented
function determineTier(files) {
  const tiers = {
    core: files.some(f => f.startsWith('core/')),
    theme: files.some(f => f.includes('contents/themes/')),
    plugin: files.some(f => f.includes('contents/plugins/'))
  }

  // A feature can require documentation in multiple tiers
  return Object.entries(tiers)
    .filter(([_, included]) => included)
    .map(([tier]) => tier)
}

// Documentation locations
const docLocations = {
  core: 'core/docs/',
  theme: (theme) => `contents/themes/${theme}/docs/`,
  plugin: (plugin) => `contents/plugins/${plugin}/docs/`
}
```

### Step 6: Launch Documentation Writer

```typescript
await launchAgent('documentation-writer', {
  task: `Generate documentation for: ${featureName}`,
  requirements: [
    'Read session files for context (READ-ONLY)',
    'Validate against actual implementation code',
    'Create documentation in appropriate tier(s)',
    'Follow documentation system structure',
    'Include working code examples from real implementation',
    'Add API reference with actual endpoints',
    'Include troubleshooting from QA feedback',
    'Do NOT modify session files'
  ],
  sessionPath: sessionPath,
  tiers: determineTier(implementedFiles)
})
```

---

## Documentation Structure

### Core Documentation

**Location:** `core/docs/{section-number}-{topic}/`

```markdown
---
title: Feature Name
description: Brief description of the feature
---

## Overview

What this feature does and why it exists.

## Prerequisites

- Required dependencies
- Environment setup

## Installation

Step-by-step installation if needed.

## Usage

### Basic Usage

\`\`\`typescript
// Real code example from implementation
\`\`\`

### Advanced Usage

\`\`\`typescript
// More complex example
\`\`\`

## API Reference

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/resource | List all |
| POST | /api/v1/resource | Create new |

### Request/Response

\`\`\`typescript
// Request
{
  "name": "string",
  "description": "string"
}

// Response
{
  "data": { ... },
  "success": true
}
\`\`\`

## Components

### ComponentName

\`\`\`typescript
interface Props {
  prop1: string
  prop2?: number
}
\`\`\`

**Usage:**
\`\`\`tsx
<ComponentName prop1="value" />
\`\`\`

## Configuration

Available configuration options.

## Database Schema

If database changes were made.

## Internationalization

Translation keys used.

## Testing

How to test this feature.

## Troubleshooting

Common issues and solutions (from QA feedback).

## Related

Links to related documentation.
```

---

## Output Format

```markdown
## Documentation Generated

**Feature:** ${featureName}
**Session:** \`${sessionPath}\`

### Documentation Created

📚 **Core Documentation:**
- Location: \`${coreDocPath}\`
- Sections: Overview, API Reference, Components

🎨 **Theme Documentation:**
- Location: \`${themeDocPath}\`
- Sections: UI Components, Styling

🧩 **Plugin Documentation:**
- Location: \`${pluginDocPath}\`
- Sections: Installation, Configuration

### Validation

- ✅ Code verified vs session plan
- ✅ Examples extracted from real implementation
- ✅ API Reference validated against endpoints
- ✅ Test results incorporated

### Files Created

${createdFiles.map(f => `- \`${f}\``).join('\n')}

### Next Steps

1. Review generated documentation
2. Rebuild docs registry: \`pnpm docs:build\`
3. Preview at /docs
4. Collect user feedback for improvements
```

---

## Documentation Tiers Reference

### Core Docs Sections

```
01 - fundamentals
02 - getting-started
03 - registry-system
04 - api
05 - authentication
06 - themes
07 - plugins
08 - frontend
09 - backend
10 - i18n
11 - testing
12 - performance
13 - deployment
```

### Theme Docs Sections

```
01 - overview
02 - components
03 - features
04 - customization
05 - examples
```

### Plugin Docs Sections

```
01 - overview
02 - installation
03 - configuration
04 - api
05 - examples
```

---

## Best Practices

### DO:
- Validate code matches session description
- Extract real examples from implementation
- Include troubleshooting from QA
- Cross-reference related docs
- Use clear, concise language

### DON'T:
- Copy session files as documentation
- Include implementation details users don't need
- Skip code validation
- Document features that aren't complete
- Modify session files

---

## Error Handling

### Session Not Found

```
❌ Error: Session not found for '${featureName}'

The folder .claude/sessions/${featureName}/ does not exist.

Solutions:
1. Verify the feature name (use kebab-case)
2. List available sessions: ls .claude/sessions/
3. Run /task:plan to create a new session
```

### Feature Not Complete

```
⚠️ Warning: Feature '${featureName}' not fully completed

Current status:
- QA Testing: ${qaStatus}
- Code Review: ${crStatus}

Recommendation: Wait for QA and Code Review to complete before documenting.

Continue anyway? (y/n)
```

### Code Mismatch

```
⚠️ Warning: Implementation differs from session plan

Discrepancies found:
- ${discrepancy1}
- ${discrepancy2}

Documentation will reflect ACTUAL implementation, not plan.
```

---

**Now generate documentation for the feature/session described above.**
