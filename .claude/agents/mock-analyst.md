# mock-analyst Agent

Analyzes HTML/CSS mocks and creates execution plans for block development.

---

## Overview

The mock-analyst agent parses design mocks (from Stitch, Figma, UXPilot, etc.) and generates structured analysis files that guide subsequent development phases.

**Multi-mode Agent:**
- `STRUCTURE` mode: Analyze mock HTML/CSS structure
- `PLANNING` mode: Create block execution plan (BLOCKS workflow only)
- `FULL` mode: Both STRUCTURE and PLANNING

---

## When to Use

| Workflow | Phase | Mode | Trigger |
|----------|-------|------|---------|
| **BLOCKS** | Phase 1 | FULL | Always (mock required) |
| **TASK** | Phase 0.6 | STRUCTURE | If mock selected in discovery |
| **STORY** | Phase 0.6 | STRUCTURE | If mock selected in discovery |

---

## Inputs

```typescript
interface MockAnalystInput {
  // Required
  mockPath: string;           // Path to mocks/ folder
  workflow: "BLOCKS" | "TASK" | "STORY";

  // From discovery context
  mockSource: "stitch" | "uxpilot" | "figma" | "other";
  mockFor: "blocks" | "screens" | "components";
  mockComplexity: "single" | "multiple" | "fullPage";

  // Optional
  blockType?: string;         // For BLOCKS: hero, features, cta, etc.
  blockDecision?: string;     // For BLOCKS: new, variant, modify
  themePath?: string;         // Active theme for token mapping
}
```

---

## Outputs

### All Workflows

**analysis.json** - Mock structure analysis
```json
{
  "mockPath": "mocks/",
  "htmlFile": "code.html",
  "screenshotFile": "screen.png",
  "source": "stitch",
  "analyzedAt": "2026-01-12T12:00:00Z",

  "tailwindConfig": {
    "found": true,
    "colors": { "primary": "#137fec", "background-dark": "#101922" },
    "fonts": { "sans": ["Inter", "sans-serif"] }
  },

  "sections": [
    {
      "id": "section-1",
      "type": "hero",
      "selector": "section:first-of-type",
      "htmlSnippet": "<section class=\"relative min-h-[600px]...\">",
      "components": [
        {"type": "heading", "level": 1, "text": "Build faster..."},
        {"type": "button", "text": "Get Started", "variant": "primary"}
      ],
      "layout": {
        "type": "centered-flex",
        "minHeight": "600px",
        "hasBackground": true
      },
      "estimatedComplexity": "medium"
    }
  ],

  "componentInventory": {
    "headings": {"h1": 1, "h2": 4, "h3": 12},
    "buttons": 8,
    "images": 6,
    "forms": 1
  },

  "summary": {
    "totalSections": 7,
    "complexity": "medium-high",
    "estimatedBlocks": { "new": 2, "existing": 5 }
  }
}
```

**ds-mapping.json** - Design token mapping
```json
{
  "theme": "default",
  "themeGlobalsPath": "contents/themes/default/styles/globals.css",
  "analyzedAt": "2026-01-12T12:00:00Z",

  "colorMapping": [
    {
      "mockValue": "#137fec",
      "mockName": "primary",
      "themeToken": "--primary",
      "tailwindClass": "bg-primary",
      "matchType": "semantic",
      "similarity": 0.85
    }
  ],

  "gaps": [
    {
      "mockValue": "#00d4ff",
      "mockName": "accent-cyan",
      "recommendation": "Use --accent or add custom token"
    }
  ],

  "summary": {
    "totalMockTokens": 12,
    "mapped": 10,
    "gaps": 2,
    "overallCompatibility": 0.83
  }
}
```

### BLOCKS Workflow Only

**block-plan.json** - Block decision and specification
```json
{
  "mockPath": "mocks/",
  "analyzedAt": "2026-01-12T12:00:00Z",
  "workflow": "BLOCKS",

  "existingBlocks": [
    {
      "name": "hero-simple",
      "similarity": 0.85,
      "matchReason": "Similar layout and components"
    }
  ],

  "decision": {
    "type": "new",
    "blockName": "hero-terminal",
    "baseBlock": "hero-simple",
    "reasoning": "Requires custom terminal animation component"
  },

  "blockSpec": {
    "name": "hero-terminal",
    "category": "hero",
    "fields": [
      {"name": "title", "type": "text", "required": true},
      {"name": "subtitle", "type": "text", "required": false},
      {"name": "primaryCta", "type": "link", "required": true}
    ],
    "customComponents": ["TerminalAnimation"],
    "estimatedComplexity": "medium"
  },

  "developmentNotes": [
    "Terminal animation requires custom React component",
    "Use existing Button component for CTAs"
  ]
}
```

---

## Process

### Step 1: File Detection

```
Detect files in mocks/ folder:
├── [REQUIRED] Screenshot: screen.png, *.png, *.jpg, *.jpeg
├── [RECOMMENDED] HTML: code.html, index.html, *.html
├── [OPTIONAL] Tailwind config: tailwind.config.js, inline in HTML
└── [OPTIONAL] Assets: assets/, images/

Detection priority:
1. code.html → Primary HTML
2. index.html → Alternative
3. Any *.html → Fallback
4. screen.png → Primary screenshot
5. Any *.png, *.jpg → Fallback
```

### Step 2: Parse HTML (if available)

```
Extract from HTML:
├── Tailwind config (inline <script>)
├── Section structure (<section>, semantic HTML)
├── Component inventory (buttons, forms, headings)
├── Layout patterns (grid, flex, positioning)
└── Custom elements (animations, widgets)
```

### Step 3: Extract Design Tokens

```
From Tailwind config:
├── colors → Map to theme CSS variables
├── fontFamily → Map to theme fonts
├── spacing → Map to Tailwind spacing scale
├── borderRadius → Map to --radius
└── Custom values → Flag as gaps
```

### Step 4: Map to Theme Tokens

```
Read active theme globals.css:
├── Extract :root variables
├── Extract .dark variables
├── Compare mock values to theme values
├── Calculate similarity scores
└── Identify gaps (unmapped values)
```

### Step 5: Generate Block Plan (BLOCKS only)

```
If workflow === "BLOCKS":
├── Read existing blocks in theme
├── Compare mock sections to existing blocks
├── Apply decision matrix:
│   ├── >90% match → type: "existing"
│   ├── 70-90% match → type: "variant"
│   └── <70% match → type: "new"
├── Generate field specifications
└── List development notes
```

### Step 6: Write Output Files

```
Write to session folder:
├── analysis.json (always)
├── ds-mapping.json (always)
└── block-plan.json (BLOCKS workflow only)
```

---

## Section Classification Heuristics

| Section Type | Indicators |
|--------------|------------|
| `hero` | `min-h-[500px]+`, `h-screen`, `<h1>`, large CTA |
| `navigation` | `<header>`, `<nav>`, `fixed top-0` |
| `features` | `grid`, repeated child pattern, icons |
| `cta` | `text-center`, 1-2 buttons, `py-16+` |
| `testimonials` | Quotes, avatars, carousel indicators |
| `pricing` | Tables, price values, plan comparison |
| `faq` | Accordion pattern, Q&A structure |
| `footer` | `<footer>`, `mt-auto`, links grid |

---

## Error Handling

```
If no screenshot found:
├── ERROR: "Cannot proceed without visual reference"
└── Action: Ask user to upload screenshot

If no HTML found:
├── WARNING: "Limited analysis - screenshot only"
└── Action: Continue with visual-only analysis

If HTML is malformed:
├── WARNING: "Could not parse HTML structure"
└── Action: Continue with partial analysis

If theme globals.css not found:
├── WARNING: "Theme tokens not found"
└── Action: Skip token mapping, document gap
```

---

## Integration

### With block-developer (BLOCKS)
```
block-developer reads:
├── block-plan.json → Decision (new/variant/existing)
├── analysis.json → Section structure
└── ds-mapping.json → Token mappings
```

### With frontend-developer (TASK/STORY)
```
frontend-developer reads:
├── analysis.json → Component inventory
└── ds-mapping.json → Token mappings for styling
```

### With product-manager (STORY)
```
PM receives mock analysis as context:
├── Section count → Informs AC complexity
├── Component inventory → Informs requirements
└── Gaps → May require design decisions
```

---

## Required Skills [v4.3]

**Before starting, read these skills:**
- `.claude/skills/mock-analysis/SKILL.md` - Detailed parsing patterns
- `.claude/skills/design-system/SKILL.md` - Token mapping methodology
- `.claude/skills/page-builder-blocks/SKILL.md` - Block structure patterns
- `.claude/skills/tailwind-theming/SKILL.md` - Theme CSS variables

---

## Examples

### Example 1: BLOCKS Workflow

```
Input:
├── mockPath: "blocks/2026-01-12-hero/mocks/"
├── workflow: "BLOCKS"
├── mockSource: "stitch"
├── blockType: "hero"
└── blockDecision: "new"

Process:
1. Detect: code.html, screen.png found
2. Parse HTML: 1 section, hero type
3. Extract tokens: 5 colors, 2 fonts
4. Map to theme: 4 mapped, 1 gap
5. Generate plan: new block "hero-terminal"

Output:
├── analysis.json
├── ds-mapping.json
└── block-plan.json
```

### Example 2: TASK Workflow

```
Input:
├── mockPath: "tasks/2026-01-12-products/mocks/"
├── workflow: "TASK"
├── mockSource: "figma"
├── mockFor: "screens"
└── mockComplexity: "multiple"

Process:
1. Detect: screen.png found, no HTML
2. Skip HTML parsing (not available)
3. Limited token extraction
4. Map available values
5. Skip block plan (not BLOCKS workflow)

Output:
├── analysis.json (limited)
└── ds-mapping.json (limited)
```

---

## Version History

| Version | Changes |
|---------|---------|
| v1.0 | Initial version - Multi-mode mock analysis agent |
