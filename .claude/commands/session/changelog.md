# /session:changelog

Generate a simple, complete changelog for the current feature branch.

---

## Syntax

```
/session:changelog
```

---

## Behavior

Generate a changelog summarizing everything done in the current feature branch. The audience is the development team — keep it concise, concrete, and complete.

---

## Steps

### 1. Gather context

Run these commands to understand the full scope:

```bash
# Get the base branch
BASE=$(git merge-base origin/main HEAD 2>/dev/null || git merge-base origin/master HEAD 2>/dev/null)

# All commits (excluding version bumps)
git log --oneline --reverse $BASE..HEAD | grep -v "^.* chore: bump"

# Overall stats
git diff --stat $BASE..HEAD | tail -3

# Check for an existing PR
gh pr list --head $(git branch --show-current) --json number,title,url --jq '.[0]'
```

If a PR exists, also read its body for additional context:
```bash
gh pr view <number> --json body --jq '.body'
```

### 2. Generate changelog

Write the changelog using this exact format:

```
## Changelog `<version>`

- **Feature/change title**: one-line description of what it does and why it matters
- **Feature/change title**: one-line description
- ...repeat for every meaningful change

**Migration notes for existing projects:**
- Step-by-step instructions for any manual changes needed
- Config additions, dependency updates, etc.
- Only include this section if there ARE breaking/manual changes
```

### 3. Format rules

- **One bullet per logical change** — group related commits into a single bullet
- **Skip version bump commits** — they are noise
- **Bold the title** of each bullet, plain text for the description
- **Use present tense** — "adds", "fixes", "removes" (not "added", "fixed")
- **Be specific** — name the files, commands, or packages involved
- **No emojis**
- **No sub-bullets** inside changelog items (keep it flat)
- **Version number** comes from the latest package version on the branch
- **Migration notes** section only appears if existing consumer projects need manual changes (config additions, dependency changes, breaking API changes, etc.)

---

## Example Output

```
## Changelog `0.1.0-beta.92`

- **New `@nextsparkjs/ai-workflow` package**: agents, commands, skills and workflows now distributed as a standalone npm package
- **Auto-sync for `.claude/`**: running `pnpm update` automatically syncs AI workflow files, same pattern as core does with `/app`
- **New `nextspark sync:ai` command**: manual sync with `--editor` and `--force` options
- **Core template cleanup**: legacy AI workflow files removed from `@nextsparkjs/core`, presets consolidated into `templates/`
- **Fix postinstall for pnpm v10 workspaces**: postinstall scripts for core and ai-workflow now work correctly in consumer projects with pnpm workspaces (web-only and web-mobile)

**Migration notes for existing projects:**
- Add to your root `package.json`:
  ```json
  "pnpm": {
    "onlyBuiltDependencies": ["@nextsparkjs/core", "@nextsparkjs/ai-workflow"]
  }
  ```
- Install the new package: `pnpm add -D -w @nextsparkjs/ai-workflow@latest`
```

---

## Anti-patterns

- DO NOT list every commit individually
- DO NOT include "bumped to version X" bullets
- DO NOT write paragraphs — one line per bullet
- DO NOT include implementation details (file paths, function names) unless they are user-facing (CLI commands, config keys)
- DO NOT skip changes — every non-bump commit should be represented in at least one bullet

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:review` | Code review before changelog |
| `/session:close` | Close session after changelog |
