---
description: Automatically diagnose and fix build errors by launching appropriate developer agents
---

# Fix Build - Repair Build Errors

You are fixing build errors by analyzing error output and launching specialized agents.

**Error Description (optional):**
{{{ input }}}

---

## Your Mission

Automatically diagnose and fix build errors:

1. **Run build** to capture current errors
2. **Analyze error type** (frontend, backend, plugin, registry)
3. **Launch appropriate agent** to fix
4. **Iterate until success** (max 5 attempts)
5. **Report final status**

---

## Build Fix Protocol

### Step 1: Run Initial Build

```typescript
// Capture current build state
await Bash({
  command: 'pnpm build 2>&1',
  description: 'Run build to capture errors'
})

// Parse error output
const errors = parseBuildErrors(output)
```

### Step 2: Categorize Errors

**Frontend Errors:**
- React/Next.js component errors
- TypeScript errors in `app/`, `core/components/`
- CSS/styling errors
- Client-side hooks errors
- UI component issues

**Backend Errors:**
- API route errors (`app/api/`)
- Server-side TypeScript errors
- Database connection/migration errors
- Authentication/session errors
- Middleware errors

**Plugin Errors:**
- Plugin configuration errors (`contents/plugins/`)
- Plugin entity errors
- Plugin registry errors
- Plugin dependencies errors

**Registry/Build System Errors:**
- `core/scripts/build/registry.mjs` errors
- `core/scripts/build/theme.mjs` errors
- Registry generation failures
- Theme/plugin discovery errors

### Step 3: Launch Appropriate Agent

```typescript
// Determine agent based on error location
function determineAgent(error) {
  if (error.file.includes('app/api/') || error.file.includes('core/lib/')) {
    return 'backend-developer'
  }
  if (error.file.includes('app/components/') || error.file.includes('.tsx')) {
    return 'frontend-developer'
  }
  if (error.file.includes('contents/plugins/')) {
    return 'dev-plugin'
  }
  if (error.file.includes('scripts/') || error.file.includes('registry')) {
    return 'general-purpose'
  }
  return 'frontend-developer' // Default
}
```

### Step 4: Agent Tasks

**Frontend Developer Agent:**
```typescript
await launchAgent('frontend-developer', {
  task: 'Fix frontend build errors',
  requirements: [
    'Read affected component files',
    'Fix TypeScript/React errors',
    'Ensure imports are correct',
    'Follow .rules/components.md patterns',
    'Maintain type safety',
    'Run pnpm build to verify',
    'Continue until build succeeds'
  ]
})
```

**Backend Developer Agent:**
```typescript
await launchAgent('backend-developer', {
  task: 'Fix backend build errors',
  requirements: [
    'Read affected API routes and server files',
    'Fix TypeScript errors in backend code',
    'Ensure database connections are correct',
    'Verify authentication middleware',
    'Follow .rules/api.md patterns',
    'Run pnpm build to verify',
    'Continue until build succeeds'
  ]
})
```

**Plugin Developer Agent:**
```typescript
await launchAgent('dev-plugin', {
  task: 'Fix plugin build errors',
  requirements: [
    'Read affected plugin files',
    'Fix TypeScript errors in plugin code',
    'Verify plugin configuration',
    'Ensure entity configs are valid',
    'Follow .rules/plugins.md patterns',
    'Run pnpm build to verify',
    'Continue until build succeeds'
  ]
})
```

**General Purpose Agent (Registry/Build System):**
```typescript
await launchAgent('general-purpose', {
  task: 'Fix build system errors',
  requirements: [
    'Read build scripts and registry files',
    'Fix errors in build-registry.mjs or build-theme.mjs',
    'Verify registry generation',
    'Ensure theme/plugin discovery works',
    'Run pnpm build to verify',
    'Continue until build succeeds'
  ]
})
```

### Step 5: Iteration Loop

```typescript
const MAX_ATTEMPTS = 5

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  console.log(`Build attempt ${attempt}/${MAX_ATTEMPTS}`)

  const result = await Bash({
    command: 'pnpm build 2>&1',
    description: `Build attempt ${attempt}`
  })

  if (result.success) {
    console.log('Build successful!')
    break
  }

  // Parse remaining errors
  const remainingErrors = parseBuildErrors(result.output)

  // Categorize and launch appropriate agent
  const errorCategory = categorizeErrors(remainingErrors)
  await launchAgent(determineAgent(errorCategory), {
    task: `Fix remaining ${errorCategory} errors (attempt ${attempt})`,
    errors: remainingErrors
  })
}
```

---

## Error Pattern Reference

### Frontend Error Patterns
```
- "Type 'X' is not assignable to type 'Y'" in components/
- "Cannot find module" in app/ directory
- "Property 'X' does not exist on type 'Y'" in hooks/
- React component rendering errors
- "JSX element type 'X' does not have any construct"
```

### Backend Error Patterns
```
- Errors in app/api/ directory
- "Cannot read properties of undefined" in server code
- Database connection errors
- Authentication/session errors
- Middleware errors
```

### Plugin Error Patterns
```
- Errors in contents/plugins/[plugin]/
- Plugin configuration validation errors
- Entity registry errors for plugins
- Plugin dependency errors
```

### Registry/Build System Patterns
```
- Errors in core/scripts/build/registry.mjs
- "Failed to generate registry" messages
- Theme discovery errors
- Dynamic import violations
```

---

## Output Format

```markdown
## Build Fix Results

**Initial Errors:** ${initialErrorCount}
**Attempts:** ${attemptCount}/${MAX_ATTEMPTS}
**Final Status:** ✅ Success / ❌ Failed

### Error Resolution

| Error Type | Count | Agent Used | Status |
|------------|-------|------------|--------|
| Frontend | 5 | frontend-developer | ✅ Fixed |
| Backend | 2 | backend-developer | ✅ Fixed |
| Plugin | 0 | - | N/A |

### Files Modified

${modifiedFiles.map(f => `- \`${f.path}\` - ${f.change}`).join('\n')}

### Build Output

\`\`\`
${finalBuildOutput}
\`\`\`

### Recommendations
${recommendations.map(r => `- ${r}`).join('\n')}
```

---

## Best Practices

### DO:
- Always read the error fully before fixing
- Verify fix after each change
- Follow the .rules/ files for patterns
- Maintain type safety (no `any` unless necessary)
- Document complex fixes with comments

### DON'T:
- Skip errors without understanding them
- Use `@ts-ignore` to hide errors
- Break existing functionality
- Ignore TypeScript warnings

---

## Integration with Other Commands

Works well with:
- `/task:execute` - Continue task after fixing build
- `/task:scope-change` - If fix requires scope changes
- `/test:run` - Run tests after build succeeds

---

**Now fix the build errors described above (or run pnpm build to detect errors).**
