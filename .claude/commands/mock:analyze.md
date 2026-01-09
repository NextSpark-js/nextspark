---
description: "[Mock] Analyze design system tokens from a mock (standalone)"
---

# Analyze Mock Design System

Standalone command to analyze design tokens from a mock folder.
Useful for any design-to-code task, not just block conversion.

**Input:**
{{{ input }}}

---

## Protocol

### Step 1: Parse Input

Extract mock path from input above.

- **If path provided:** Use it (e.g., `_tmp/mocks/stitch/landing-page`)
- **If no path:** Ask user for the mock location

```typescript
await AskUserQuestion({
  questions: [{
    header: "Mock Path",
    question: "Enter the path to the mock folder:",
    options: [
      { label: "_tmp/mocks/", description: "Browse available mocks in _tmp/mocks/" },
      { label: "Other path", description: "Specify a different location" }
    ],
    multiSelect: false
  }]
})
```

### Step 2: Validate Mock Folder

```bash
# Check folder exists
ls -la {mockPath}

# Check for required files
ls {mockPath}/code.html {mockPath}/index.html 2>/dev/null
ls {mockPath}/screen.png {mockPath}/screenshot.* 2>/dev/null
```

If missing files, error with helpful message:

```markdown
## Error: Invalid Mock Folder

The folder `{mockPath}` is missing required files.

**Expected structure:**
```
{mockPath}/
├── code.html    # Main HTML markup (REQUIRED)
└── screen.png   # Visual screenshot (REQUIRED for comparison)
```

**Available mocks:**
{list from _tmp/mocks/}
```

### Step 3: Determine Theme

```bash
grep "NEXT_PUBLIC_ACTIVE_THEME" .env .env.local 2>/dev/null | head -1 | cut -d'=' -f2
```

Default to "default" if not found.

**Confirm:**
```markdown
Using theme: {THEME}
Theme globals: contents/themes/{THEME}/styles/globals.css
```

### Step 4: Launch ds-analyst Agent

Launch the `ds-analyst` agent:

```
Analyze design tokens from mock:

**Mock Path:** {mockPath}
**Theme:** {THEME}
**Output Path:** {mockPath}

Read the design-system skill first, then:
1. Read theme tokens from globals.css
2. Parse mock HTML and extract Tailwind config
3. Create color, typography, spacing mappings
4. Identify gaps (tokens without good matches)
5. Generate ds-mapping.json

Return the complete mapping summary.
```

Wait for agent completion.

### Step 5: Present Results

Read generated `ds-mapping.json` and present summary:

```markdown
## Design System Analysis Complete

**Mock:** {mockPath}
**Theme:** {THEME}
**Analyzed:** {timestamp}

### Compatibility Score: {score}%

### Token Mapping Summary

| Category | Mock Tokens | Mapped | Gaps |
|----------|-------------|--------|------|
| Colors | {n} | {n} | {n} |
| Typography | {n} | {n} | {n} |
| Spacing | {n} | {n} | {n} |
| Radius | {n} | {n} | {n} |

### Color Mappings

| Mock Color | Theme Token | Tailwind Class | Match Type |
|------------|-------------|----------------|------------|
| #137fec (primary) | --primary | bg-primary | semantic |
| #101922 (bg-dark) | --background | bg-background | closest (88%) |
| ... | ... | ... | ... |

### Gaps Identified

{For each gap:}
**1. {mockValue}** ({mockName})
- **Usage:** {where it's used}
- **Closest:** `{token}` ({similarity}%)
- **Recommendations:**
  - A: Use `{tailwindClass}` (closest match)
  - B: Add `{variable}` to theme
  - C: Use inline `text-[{value}]` (not recommended)

### Files Generated

- `{mockPath}/ds-mapping.json`

### Next Steps

1. **Review gaps** and decide on resolutions (A, B, or C for each)
2. **If converting to blocks:** Run `/mock:to-blocks {mockPath}`
3. **If other use:** Use ds-mapping.json for your implementation
```

---

## Output Files

| File | Location | Purpose |
|------|----------|---------|
| ds-mapping.json | {mockPath}/ | Complete token mapping data |

---

## Usage Examples

```bash
# Analyze a Stitch mock
/mock:analyze _tmp/mocks/stitch/landing-page

# Analyze email template design
/mock:analyze _tmp/mocks/email-template

# Analyze PDF template design
/mock:analyze _tmp/designs/pdf-invoice
```

---

## Related Commands

- `/mock:to-blocks` - Full mock-to-blocks conversion (uses this analysis)
- `/block:create` - Create a single block manually

---

**Now analyze the mock specified above.**
