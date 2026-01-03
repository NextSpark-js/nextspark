# Customization Guide

## Color System

The theme uses **OKLCH color space** for perceptual uniformity. Colors are defined in `theme.config.ts`.

### Understanding OKLCH

```
oklch(L C H)
- L: Lightness (0-1)
- C: Chroma (0-0.4+, saturation)
- H: Hue (0-360, color angle)
```

### Color Variables

| Variable | Purpose |
|----------|---------|
| `background` | Page background |
| `foreground` | Main text color |
| `primary` | Brand/accent color |
| `secondary` | Secondary elements |
| `muted` | Subtle backgrounds |
| `destructive` | Error/danger actions |
| `border` | Border colors |
| `ring` | Focus ring color |

### Example: Changing Brand Color

```typescript
// theme.config.ts
colors: {
  // Blue primary
  primary: 'oklch(0.55 0.2 250)',

  // Green primary
  // primary: 'oklch(0.55 0.2 150)',

  // Orange primary
  // primary: 'oklch(0.65 0.2 50)',
}
```

## Adding Entities

Create a new entity in `entities/` directory:

```
entities/
└── products/
    ├── products.config.ts    # Entity configuration
    ├── products.fields.ts    # Field definitions
    ├── messages/
    │   ├── en.json           # English translations
    │   └── es.json           # Spanish translations
    └── migrations/
        └── 001_products_table.sql
```

## Adding Blocks

Create page builder blocks in `blocks/` directory:

```
blocks/
└── feature-card/
    ├── config.ts      # Block metadata
    ├── schema.ts      # Zod validation schema
    ├── fields.ts      # Editor field definitions
    ├── component.tsx  # React component
    └── thumbnail.png  # Preview image
```

## Translations

Add or modify translations in `messages/` directory:

```json
// messages/en.json
{
  "myFeature": {
    "title": "My Feature",
    "description": "Feature description"
  }
}
```

## Dashboard Configuration

Customize dashboard behavior in `dashboard.config.ts`:

- Enable/disable topbar features
- Configure sidebar behavior
- Customize settings pages
- Set up entity defaults

## Public Pages

Override public page templates in `templates/`:

```
templates/
└── (public)/
    ├── layout.tsx    # Public layout
    ├── page.tsx      # Homepage
    └── about/
        └── page.tsx  # About page
```
