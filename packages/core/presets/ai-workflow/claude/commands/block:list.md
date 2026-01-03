---
description: "[Block] List available blocks in the page builder"
---

# List Blocks

You are listing available page builder blocks.

**Request:**
{{{ input }}}

---

## Protocol

### Step 1: Determine Scope

Check the input for options:

- **`--all`** → List blocks from ALL themes
- **`--theme=X`** → List blocks from specific theme
- **Neither** → List blocks from active theme

```bash
# Get active theme if needed
grep "NEXT_PUBLIC_ACTIVE_THEME" .env .env.local 2>/dev/null
```

### Step 2: Discover Themes (if --all)

```bash
# List all available themes
ls contents/themes/
```

### Step 3: List Blocks

For each theme in scope:

```bash
# List block directories
ls contents/themes/{THEME}/blocks/

# Read config from each block
cat contents/themes/{THEME}/blocks/*/config.ts
```

### Step 4: Organize by Category

Group blocks by their category for easy scanning.

---

## Output Format

### Single Theme

```markdown
## Blocks in Theme: {theme}

**Total Blocks:** {count}

---

### Category: hero
| Slug | Name | Description | Icon |
|------|------|-------------|------|
| hero | Hero Section | Full-width hero with CTA | Rocket |

### Category: content
| Slug | Name | Description | Icon |
|------|------|-------------|------|
| features-grid | Features Grid | Display features in a grid | Grid |
| text-content | Text Content | Simple text section | Type |

### Category: cta
| Slug | Name | Description | Icon |
|------|------|-------------|------|
| cta-section | CTA Section | Call to action block | MousePointer |

### Category: testimonials
| Slug | Name | Description | Icon |
|------|------|-------------|------|
| testimonials | Testimonials | Customer testimonials | MessageSquare |

---

### Quick Reference

**Content Blocks:** features-grid, text-content
**Marketing Blocks:** hero, cta-section, testimonials

---

### Block Locations

All blocks are located in:
`contents/themes/{theme}/blocks/{slug}/`
```

### All Themes (--all)

```markdown
## Blocks Across All Themes

---

### Theme: default
**Total:** {count} blocks

| Slug | Category | Name | Icon |
|------|----------|------|------|
| hero | hero | Hero Section | Rocket |
| features-grid | content | Features Grid | Grid |

---

### Theme: blog
**Total:** {count} blocks

| Slug | Category | Name | Icon |
|------|----------|------|------|
| post-header | hero | Post Header | FileText |
| author-bio | content | Author Bio | User |

---

### Theme: crm
**Total:** {count} blocks

| Slug | Category | Name | Icon |
|------|----------|------|------|
| dashboard-hero | hero | Dashboard Hero | LayoutDashboard |
| stats-grid | stats | Stats Grid | BarChart |

---

### Summary

| Theme | Block Count | Categories |
|-------|-------------|------------|
| default | 5 | hero, content, cta, testimonials |
| blog | 3 | hero, content |
| crm | 4 | hero, stats, cta |

**Total Unique Blocks:** {sum}
```

---

## Available Categories Reference

For filtering or creating new blocks:

```
hero        - Full-width hero sections
content     - General content blocks
features    - Feature showcases
cta         - Call-to-action sections
testimonials - Customer testimonials
media       - Image/video blocks
forms       - Form blocks
navigation  - Nav menus
footer      - Footer sections
pricing     - Pricing tables
team        - Team member displays
stats       - Statistics/metrics
faq         - FAQ/Accordion
newsletter  - Newsletter signups
other       - Miscellaneous
```

---

**Now list the blocks as specified above.**
