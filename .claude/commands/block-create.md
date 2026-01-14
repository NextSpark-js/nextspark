---
description: "[Block] Create a new page builder block with complete file structure"
---

# Create New Block

You are creating a new block for the Page Builder system.

**Block Requirements:**
{{{ input }}}

---

## Protocol

### Step 1: Determine Theme

Check if `--theme=X` was specified in the input above.

- **If specified:** Use that theme
- **If not specified:** Read `NEXT_PUBLIC_ACTIVE_THEME` from `.env` or `.env.local`
- **If no variable:** Use `"default"`

```bash
# Check for theme variable
grep "NEXT_PUBLIC_ACTIVE_THEME" .env .env.local 2>/dev/null
```

**ALWAYS confirm:** "Creating block in theme: {THEME}"

### Step 2: Parse Requirements

From the input above, extract:
- **Block name** (required)
- **Category** (if not specified, ask user)
- **Fields/functionality** description

If category is missing, ask:

```typescript
await AskUserQuestion({
  questions: [{
    header: "Category",
    question: "What category should this block belong to?",
    options: [
      { label: "hero", description: "Full-width hero sections" },
      { label: "content", description: "General content blocks" },
      { label: "features", description: "Feature showcases" },
      { label: "cta", description: "Call-to-action sections" },
      { label: "testimonials", description: "Customer testimonials" },
      { label: "pricing", description: "Pricing tables" },
      { label: "faq", description: "FAQ/Accordion sections" },
      { label: "forms", description: "Form blocks" },
      { label: "other", description: "Other block types" }
    ],
    multiSelect: false
  }]
})
```

### Step 3: Launch block-developer Agent

Launch the `block-developer` agent with full context:

```
Create a new block with:

**Theme:** {determined theme}
**Block Name:** {extracted name}
**Slug:** {kebab-case name}
**Category:** {extracted or asked category}
**Description:** {from input}
**Fields Needed:** {from input}

**IMPORTANT:**
1. First discover existing blocks in this theme to learn patterns
2. Create all 5 required files (config, schema, fields, component, index)
3. Extend baseBlockSchema - do NOT recreate base fields
4. Organize fields in order: Content → Design → Advanced
5. Include data-cy="block-{slug}" attribute
6. Run build-registry after creation
7. Verify block appears in BLOCK_REGISTRY
```

### Step 4: Verify Creation

After agent completes:
- Confirm all 5 files were created
- Verify build-registry was executed
- Check block appears in BLOCK_REGISTRY

---

## Output Format

```markdown
## Block Created: {block-name}

**Theme:** {theme}
**Location:** `contents/themes/{theme}/blocks/{slug}/`

### Files Created
- [x] config.ts - Block metadata
- [x] schema.ts - Zod validation schema
- [x] fields.ts - DynamicForm field definitions
- [x] component.tsx - React component
- [x] index.ts - Re-exports

### Block Configuration
- **Slug:** {slug}
- **Category:** {category}
- **Icon:** {icon}

### Fields
**Content Tab:**
- {list of content fields}

**Design Tab:**
- {list of design fields}

**Advanced Tab:**
- className, id (standard)

### Registry
- [x] `node core/scripts/build/registry.mjs` executed
- [x] Block appears in BLOCK_REGISTRY

### Next Steps
1. Test block in page editor
2. Create thumbnail image: `/theme/blocks/{slug}-thumbnail.png`
3. Add E2E tests if needed
```

---

## Available Categories

```
hero, content, features, cta, testimonials, media, forms,
navigation, footer, pricing, team, stats, faq, newsletter, other
```

## Available Field Types

```
text, textarea, url, email, number, select, checkbox, radio,
rich-text, image, color, date, time, datetime, array
```

## Available Icons

Use Lucide icon names: `Rocket`, `Grid`, `MessageSquare`, `DollarSign`, `Users`, `Star`, `HelpCircle`, `Mail`, `Image`, `Type`, `Layout`, etc.

---

**Now create the block as specified above.**
