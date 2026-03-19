---
disable-model-invocation: true
---

# /session:block:create

Create a new page builder block with complete file structure.

---

## Required Skills

**[MANDATORY]** Read these skills before executing:
- `.claude/skills/page-builder-blocks/SKILL.md` - Block development patterns
- `.claude/skills/block-decision-matrix/SKILL.md` - Decision framework for new vs variant
- `.claude/skills/design-system/SKILL.md` - Token mapping for styling

---

## Syntax

```
/session:block:create <block-name> [--theme <name>]
```

---

## Behavior

Creates a new block with all 5 required files following project patterns.

---

## Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  /session:block:create                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Determine target theme                                      │
│     - Use --theme or NEXT_PUBLIC_ACTIVE_THEME                   │
│     ↓                                                           │
│  2. Discover existing blocks                                    │
│     - Read 1-2 similar blocks for patterns                      │
│     ↓                                                           │
│  3. Ask about block requirements                                │
│     - What fields?                                              │
│     - What sections?                                            │
│     - Reference mock?                                           │
│     ↓                                                           │
│  4. Generate 5 files                                            │
│     - config.ts                                                 │
│     - schema.ts                                                 │
│     - fields.ts                                                 │
│     - component.tsx                                             │
│     - index.ts                                                  │
│     ↓                                                           │
│  5. Rebuild block registry                                      │
│     ↓                                                           │
│  6. Validate block structure                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example Output

```
🧱 CREATE BLOCK

Block name: hero-banner
Theme: default

─────────────────────────────────────────

📋 BLOCK REQUIREMENTS

What is the purpose of this block?
> Full-width hero section with image background and CTA

What fields does it need?
> Title, subtitle, background image, CTA button

Does it have sections (repeatable items)?
> No, single content area

Reference mock or existing block?
> Similar to existing hero block but with image background

─────────────────────────────────────────

🔍 ANALYZING PATTERNS

Reading existing blocks...
├─ hero: Title/subtitle/CTA pattern
├─ cta-section: Background image handling
└─ Found: buildSectionClasses usage

─────────────────────────────────────────

📁 CREATING FILES

contents/themes/default/blocks/hero-banner/
├─ config.ts    ✓ Created
├─ schema.ts    ✓ Created
├─ fields.ts    ✓ Created
├─ component.tsx ✓ Created
└─ index.ts     ✓ Created

─────────────────────────────────────────

🔄 REBUILDING REGISTRY

Running pnpm build:blocks...
✓ Registry updated

─────────────────────────────────────────

✅ VALIDATION

- [x] 5 files present
- [x] Schema extends baseBlockSchema
- [x] Fields match schema
- [x] Component exports default
- [x] data-cy attributes present

─────────────────────────────────────────

✓ Block 'hero-banner' created successfully

Preview at: /devtools/blocks/hero-banner
```

---

## Generated File Structure

### config.ts

```typescript
import type { BlockConfig } from '@/core/block-system/types';

export const config: BlockConfig = {
  name: 'hero-banner',
  displayName: 'Hero Banner',
  category: 'hero',
  icon: 'Image',
  defaultProps: {
    title: 'Welcome',
    subtitle: 'Your subtitle here',
  },
};
```

### schema.ts

```typescript
import { baseBlockSchema } from '@/core/block-system/schemas';
import { z } from 'zod';

export const schema = baseBlockSchema.extend({
  title: z.string().default('Welcome'),
  subtitle: z.string().optional(),
  backgroundImage: z.string().optional(),
  cta: z.object({
    label: z.string(),
    href: z.string(),
  }).optional(),
});

export type HeroBannerProps = z.infer<typeof schema>;
```

---

## Options

| Option | Description |
|--------|-------------|
| `--theme <name>` | Target theme (default: active theme) |
| `--from-mock <path>` | Generate from mock HTML |
| `--minimal` | Create minimal structure |

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:block:update` | Modify existing block |
| `/session:block:list` | List available blocks |
| `/session:block:validate` | Validate block structure |
