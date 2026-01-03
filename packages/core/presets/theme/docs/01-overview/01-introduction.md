# {{THEME_DISPLAY_NAME}} Theme

## Overview

Welcome to the **{{THEME_DISPLAY_NAME}}** theme documentation. This theme provides a complete starting point for your application.

## Features

- Modern design with light/dark mode support
- Fully responsive layout
- Customizable color palette using OKLCH
- Internationalization ready (English & Spanish)
- Entity system integration
- Page builder blocks support

## Getting Started

### 1. Activate Theme

```bash
# Set in .env.local
NEXT_PUBLIC_ACTIVE_THEME='{{THEME_SLUG}}'
```

### 2. Build Registry

```bash
pnpm registry:build
```

### 3. Start Development

```bash
pnpm dev
```

### 4. Access Application

- **Dashboard:** http://localhost:5173/dashboard
- **Home:** http://localhost:5173/

## Theme Structure

```
contents/themes/{{THEME_SLUG}}/
├── theme.config.ts        # Visual configuration
├── app.config.ts          # Application overrides
├── dashboard.config.ts    # Dashboard settings
├── styles/
│   ├── globals.css        # CSS variables
│   └── components.css     # Component styles
├── messages/
│   ├── en.json            # English translations
│   └── es.json            # Spanish translations
├── entities/              # Data entities
├── blocks/                # Page builder blocks
├── migrations/            # SQL migrations
├── public/                # Static assets
└── docs/                  # Documentation (you are here)
```

## Customization

### Colors

Edit `theme.config.ts` to customize the color palette:

```typescript
colors: {
  primary: 'oklch(0.55 0.2 250)',      // Main brand color
  background: 'oklch(0.98 0.005 250)', // Background color
  // ... more colors
}
```

### Typography

```typescript
fonts: {
  sans: 'Inter, system-ui, sans-serif',
  serif: 'Georgia, serif',
  mono: 'JetBrains Mono, monospace',
}
```

### Spacing

```typescript
spacing: {
  radius: '0.5rem',  // Border radius
  // ... more spacing values
}
```

## Next Steps

- [Customization Guide](./02-customization.md) - Detailed customization options
- [Core Documentation](/docs) - Framework documentation
