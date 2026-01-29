# Block Presets

Ready-to-use page builder blocks that can be copied directly into any theme.

## Available Blocks

| Block | Category | Description |
|-------|----------|-------------|
| `hero` | hero | Full-width hero section with title, subtitle, CTA button, and background image |
| `cta-section` | cta | Call-to-action section with title, description, and action buttons |
| `features-grid` | content | Grid layout displaying multiple features with icons, titles, and descriptions |
| `testimonials` | testimonials | Display customer testimonials with quotes, authors, and avatars |
| `text-content` | content | Rich text content block for paragraphs, lists, and formatted text |

## Usage

### 1. Copy Block to Theme

Copy the entire block folder to your theme's blocks directory:

```bash
# Copy a single block
cp -r core/templates/blocks/hero contents/themes/YOUR_THEME/blocks/

# Copy multiple blocks
cp -r core/templates/blocks/cta-section contents/themes/YOUR_THEME/blocks/
cp -r core/templates/blocks/features-grid contents/themes/YOUR_THEME/blocks/
```

### 2. Rebuild Registry

After copying blocks, rebuild the registry:

```bash
node core/scripts/build/registry.mjs
```

### 3. Rebuild Theme (for thumbnails)

The theme build process automatically copies block thumbnails:

```bash
node core/scripts/build/theme.mjs
```

Or if using dev server, thumbnails are copied automatically.

## Block Structure

Each block follows the standard 6-file structure:

```
block-name/
├── config.ts       # Metadata: slug, name, description, category, icon
├── schema.ts       # Zod validation schema (extends baseBlockSchema)
├── fields.ts       # Field definitions for the editor UI
├── component.tsx   # React component
├── index.ts        # Re-exports all modules
└── thumbnail.png   # Preview image for block picker
```

## Customization

After copying a block, you can customize it:

1. **Change metadata**: Edit `config.ts` (name, description, icon)
2. **Add/remove fields**: Modify `schema.ts` and `fields.ts`
3. **Update UI**: Modify `component.tsx`
4. **Update thumbnail**: Replace `thumbnail.png` with actual preview image

## Creating New Blocks

For creating new blocks from scratch, use the `block-developer` agent or follow the patterns in these presets.

## Notes

- Blocks extend `baseBlockSchema` for consistent base fields (title, content, cta, backgroundColor, className, id)
- Use `buildSectionClasses()` helper for consistent styling
- Include `data-cy` attributes for testing
- Thumbnails should be PNG images (current placeholders need to be replaced)
