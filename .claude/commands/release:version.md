---
description: Create a new core version release with semantic versioning
---

# Release Version - Create Core Release

You are managing a core version release following Semantic Versioning.

**Release Request:**
{{{ input }}}

---

## Your Mission

Create a new version release:

1. **Verify prerequisites** (clean git, correct branch)
2. **Analyze changes** since last release
3. **Determine version bump** (major/minor/patch)
4. **Get user approval** before executing
5. **Create release** with proper tags
6. **Push to remote** repository

---

## Prerequisites (NON-NEGOTIABLE)

### Check 1: Clean Git Working Directory

```typescript
await Bash({
  command: 'git status --porcelain',
  description: 'Check for uncommitted changes'
})

// If output is NOT empty:
// ❌ ERROR: Cannot create release with uncommitted changes.
//
// Commit all changes first:
//   1. git add .
//   2. git commit -m "your message"
//   3. Then run /release:version again
```

### Check 2: Correct Branch

```typescript
await Bash({
  command: 'git rev-parse --abbrev-ref HEAD',
  description: 'Check current branch'
})

// Must be 'main' or 'master'
// If on different branch:
// ❌ ERROR: Releases must be from main/master branch.
//
//   1. git checkout main
//   2. git merge [your-branch]
//   3. git push origin main
//   4. Then run /release:version again
```

### Check 3: Version File Exists

```typescript
await Read('core.version.json')

// If doesn't exist, create initial version
// { "version": "0.0.0" }
```

---

## Release Protocol

### Step 1: Parse User Input

```typescript
const input = '{{{ input }}}'

// Explicit version type
if (input.includes('patch')) {
  releaseType = 'patch'
} else if (input.includes('minor')) {
  releaseType = 'minor'
} else if (input.includes('major')) {
  releaseType = 'major'
}

// Specific version
const versionMatch = input.match(/v?(\d+\.\d+\.\d+)/)
if (versionMatch) {
  specificVersion = versionMatch[1]
}

// Auto-detect if not specified
if (!releaseType && !specificVersion) {
  releaseType = 'auto'  // Will analyze commits
}
```

### Step 2: Get Current Version

```typescript
const versionFile = await Read('core.version.json')
const currentVersion = JSON.parse(versionFile).version

console.log(`Current Version: v${currentVersion}`)
```

### Step 3: Analyze Changes

```typescript
// Get commits since last tag
const lastTag = await Bash({
  command: 'git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0"',
  description: 'Get last version tag'
})

const commits = await Bash({
  command: `git log ${lastTag}..HEAD --oneline`,
  description: 'Get commits since last release'
})

const filesChanged = await Bash({
  command: `git diff ${lastTag}..HEAD --name-only`,
  description: 'Get changed files'
})

// Categorize changes
const changes = {
  breaking: [],      // MAJOR: Breaking changes
  features: [],      // MINOR: New features
  fixes: [],         // PATCH: Bug fixes
  docs: [],          // No version: Documentation only
  chore: []          // No version: Maintenance
}

// Parse commits
for (const commit of commits.split('\n')) {
  if (commit.includes('BREAKING') || commit.includes('!:')) {
    changes.breaking.push(commit)
  } else if (commit.includes('feat')) {
    changes.features.push(commit)
  } else if (commit.includes('fix')) {
    changes.fixes.push(commit)
  } else if (commit.includes('docs')) {
    changes.docs.push(commit)
  } else {
    changes.chore.push(commit)
  }
}
```

### Step 4: Determine Version Bump

```typescript
function determineVersionBump(changes) {
  // SemVer rules:
  // MAJOR: Breaking changes (incompatible API changes)
  // MINOR: New features (backwards compatible)
  // PATCH: Bug fixes (backwards compatible)

  if (changes.breaking.length > 0) {
    return 'major'
  } else if (changes.features.length > 0) {
    return 'minor'
  } else if (changes.fixes.length > 0) {
    return 'patch'
  } else {
    return 'patch'  // Default for other changes
  }
}

const recommendedBump = releaseType === 'auto'
  ? determineVersionBump(changes)
  : releaseType
```

### Step 5: Calculate New Version

```typescript
function bumpVersion(current, type) {
  const [major, minor, patch] = current.split('.').map(Number)

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    default:
      return `${major}.${minor}.${patch + 1}`
  }
}

const newVersion = specificVersion || bumpVersion(currentVersion, recommendedBump)
```

### Step 6: Present Analysis and Get Approval

```typescript
console.log(`
📊 Release Analysis Complete

Current Version: v${currentVersion}
Analyzed: ${commits.length} commits, ${filesChanged.length} files changed

Changes Detected:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${changes.breaking.length > 0 ? `
[BREAKING CHANGES]
${changes.breaking.map(c => `  ⚠️ ${c}`).join('\n')}
` : ''}

${changes.features.length > 0 ? `
[NEW FEATURES]
${changes.features.map(c => `  ✓ ${c}`).join('\n')}
` : ''}

${changes.fixes.length > 0 ? `
[BUG FIXES]
${changes.fixes.map(c => `  ✓ ${c}`).join('\n')}
` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Recommendation: ${recommendedBump.toUpperCase()} version bump
New Version: v${newVersion}

Justification:
${getJustification(changes, recommendedBump)}

Do you approve this release?
  • Type 'yes' to proceed with v${newVersion}
  • Type 'no' to cancel
  • Type 'patch/minor/major' for different version
  • Type 'vX.Y.Z' for specific version
`)

const approval = await AskUserQuestion({
  questions: [{
    header: 'Release',
    question: `Create release v${newVersion}?`,
    options: [
      { label: 'Yes', description: `Release v${newVersion}` },
      { label: 'No', description: 'Cancel release' },
      { label: 'Patch', description: 'Force patch release' },
      { label: 'Minor', description: 'Force minor release' },
      { label: 'Major', description: 'Force major release' }
    ],
    multiSelect: false
  }]
})
```

### Step 7: Execute Release

```typescript
if (approval === 'Yes') {
  // Update version file
  await Write({
    file_path: 'core.version.json',
    content: JSON.stringify({ version: newVersion }, null, 2)
  })

  // Commit version change
  await Bash({
    command: `git add core.version.json && git commit -m "chore: release v${newVersion}"`,
    description: 'Commit version bump'
  })

  // Create tag
  await Bash({
    command: `git tag -a v${newVersion} -m "Release v${newVersion}"`,
    description: 'Create version tag'
  })

  // Push to remote
  await Bash({
    command: 'git push origin main --tags',
    description: 'Push release to remote'
  })

  console.log(`
✅ Release v${newVersion} Created Successfully!

Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Previous Version: v${currentVersion}
  New Version: v${newVersion}
  Release Type: ${recommendedBump.toUpperCase()}

Git Status:
  ✓ Version file updated (core.version.json)
  ✓ Commit created: "chore: release v${newVersion}"
  ✓ Tag created: v${newVersion}
  ✓ Pushed to remote: origin/main

Next Steps:
  1. ✓ Release is live on remote repository
  2. Create GitHub Release (optional):
     gh release create v${newVersion} --title "v${newVersion}" --notes "..."
  3. Announce release to team/users
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
}
```

---

## Semantic Versioning Reference

### MAJOR Version (X.0.0)
Increment when making incompatible API changes:
- Removing public API
- Changing function signatures
- Breaking database schema changes
- Removing features

### MINOR Version (x.Y.0)
Increment when adding backwards-compatible functionality:
- New features
- New API endpoints
- New optional parameters
- New components

### PATCH Version (x.y.Z)
Increment when making backwards-compatible bug fixes:
- Bug fixes
- Security patches
- Performance improvements
- Documentation updates

---

## Output Format

```markdown
## Release Created

**Version:** v${newVersion}
**Type:** ${releaseType}
**Previous:** v${currentVersion}

### Changes Included

**Breaking Changes:** ${changes.breaking.length}
${changes.breaking.map(c => `- ${c}`).join('\n')}

**New Features:** ${changes.features.length}
${changes.features.map(c => `- ${c}`).join('\n')}

**Bug Fixes:** ${changes.fixes.length}
${changes.fixes.map(c => `- ${c}`).join('\n')}

### Git Actions

- ✅ core.version.json updated
- ✅ Commit: "chore: release v${newVersion}"
- ✅ Tag: v${newVersion}
- ✅ Pushed to origin/main

### Next Steps

1. Create GitHub Release (optional):
   \`gh release create v${newVersion} --generate-notes\`
2. Announce release
3. Update changelog if maintained separately
```

---

## Error Handling

### Uncommitted Changes

```
❌ Release Failed: Uncommitted Changes

Your working directory has uncommitted changes.

Current status:
[git status output]

Steps to fix:
  1. git add .
  2. git commit -m "description"
  3. /release:version again
```

### Wrong Branch

```
❌ Release Failed: Wrong Branch

Current branch: feature/my-feature

Releases must be from main/master.

Steps to fix:
  1. git checkout main
  2. git merge feature/my-feature
  3. git push origin main
  4. /release:version again
```

### No Changes

```
⚠️ Warning: No Significant Changes

No meaningful changes found since v${currentVersion}.

Continue with patch release anyway?
```

---

## Session Integration

If releasing after completing a session:

```typescript
// Check for active session
const sessions = await Glob('.claude/sessions/*/progress.md')
const recentSession = findMostRecent(sessions)

if (recentSession) {
  // Include session context in release notes
  const sessionPlan = await Read(`${recentSession}/plan.md`)
  const featureName = extractFeatureName(sessionPlan)

  console.log(`
📝 Session Context Detected

Recent Session: ${recentSession}
Feature: ${featureName}

This release includes the ${featureName} feature.
`)
}
```

---

**Now create the release as requested above.**
