# /session:block:list

List available blocks in the page builder.

---

## Syntax

```
/session:block:list [--theme <name>] [--category <name>]
```

---

## Behavior

Shows all available blocks in a theme, organized by category.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:block:list                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Determine theme                                             │
│     ↓                                                           │
│  2. Scan blocks directory                                       │
│     ↓                                                           │
│  3. Read each block's config                                    │
│     ↓                                                           │
│  4. Organize by category                                        │
│     ↓                                                           │
│  5. Display formatted list                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example Output

```
🧱 AVAILABLE BLOCKS

Theme: default
Location: contents/themes/default/blocks/

─────────────────────────────────────────

## Hero (3 blocks)

hero
├─ Display: Hero Section
├─ Fields: title, subtitle, cta
└─ Preview: /devtools/blocks/hero

hero-banner
├─ Display: Hero Banner
├─ Fields: title, subtitle, backgroundImage, cta, overlay
└─ Preview: /devtools/blocks/hero-banner

hero-video
├─ Display: Hero Video
├─ Fields: title, subtitle, videoUrl, cta
└─ Preview: /devtools/blocks/hero-video

─────────────────────────────────────────

## Content (5 blocks)

text-block
├─ Display: Text Block
├─ Fields: content, alignment
└─ Preview: /devtools/blocks/text-block

features-grid
├─ Display: Features Grid
├─ Fields: title, features[]
└─ Preview: /devtools/blocks/features-grid

testimonials
├─ Display: Testimonials
├─ Fields: title, items[]
└─ Preview: /devtools/blocks/testimonials

faq
├─ Display: FAQ Accordion
├─ Fields: title, items[]
└─ Preview: /devtools/blocks/faq

pricing
├─ Display: Pricing Table
├─ Fields: title, plans[]
└─ Preview: /devtools/blocks/pricing

─────────────────────────────────────────

## CTA (2 blocks)

cta-section
├─ Display: Call to Action
├─ Fields: title, description, buttons[]
└─ Preview: /devtools/blocks/cta-section

newsletter
├─ Display: Newsletter Signup
├─ Fields: title, description, placeholder
└─ Preview: /devtools/blocks/newsletter

─────────────────────────────────────────

📊 SUMMARY

Total blocks: 10
Categories: 3

Blocks with sections: 4
  - features-grid, testimonials, faq, pricing
```

---

## Filter by Category

```
/session:block:list --category hero
```

Output:

```
🧱 BLOCKS: Hero Category

Theme: default

─────────────────────────────────────────

hero
├─ Display: Hero Section
├─ Fields: title, subtitle, cta
└─ Preview: /devtools/blocks/hero

hero-banner
├─ Display: Hero Banner
├─ Fields: title, subtitle, backgroundImage, cta, overlay
└─ Preview: /devtools/blocks/hero-banner

hero-video
├─ Display: Hero Video
├─ Fields: title, subtitle, videoUrl, cta
└─ Preview: /devtools/blocks/hero-video

─────────────────────────────────────────

Total: 3 blocks in 'hero' category
```

---

## Options

| Option | Description |
|--------|-------------|
| `--theme <name>` | List blocks from specific theme |
| `--category <name>` | Filter by category |
| `--json` | Output as JSON |
| `--detailed` | Show all fields and types |

---

## Detailed Output

```
/session:block:list --detailed
```

Shows complete field definitions:

```
hero
├─ Display: Hero Section
├─ Category: hero
├─ Fields:
│   ├─ title: string (required, default: "Welcome")
│   ├─ subtitle: string (optional)
│   └─ cta: object (optional)
│       ├─ label: string (required)
│       └─ href: string (required)
└─ Preview: /devtools/blocks/hero
```

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:block:create` | Create new block |
| `/session:block:update` | Modify block |
| `/session:block:validate` | Validate blocks |
