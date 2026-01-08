---
title: Theme Styling
description: Comprehensive guide to styling in the default theme
---

# Theme Styling

The default theme uses a combination of Tailwind CSS v4, CSS variables, and custom styles to provide a flexible and maintainable styling system.

## Design Tokens

All design tokens are defined as CSS variables in `styles/globals.css`:

### Color System

```css
:root {
  /* Background colors */
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;

  /* Brand colors */
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;

  /* Semantic colors */
  --destructive: 0 84.2% 60.2%;
  --success: 142 76% 36%;
  --warning: 38 92% 50%;
}
```

### Spacing Scale

Follow Tailwind's default spacing scale:
- `xs`: 0.5rem (8px)
- `sm`: 0.75rem (12px)
- `md`: 1rem (16px)
- `lg`: 1.5rem (24px)
- `xl`: 2rem (32px)

### Typography

```css
.text-xs { font-size: 0.75rem; }
.text-sm { font-size: 0.875rem; }
.text-base { font-size: 1rem; }
.text-lg { font-size: 1.125rem; }
.text-xl { font-size: 1.25rem; }
```

## Dark Mode

Dark mode is automatically applied using CSS variables:

```css
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
}
```

Components automatically adapt to dark mode without additional code.

## Custom Styles

### Component-Specific Styles

Create scoped styles in the component directory:

```typescript
// components/custom-card/styles.css
.custom-card {
  @apply rounded-lg border bg-card p-6 shadow-sm;
}

.custom-card-header {
  @apply mb-4 border-b pb-4;
}
```

### Global Theme Styles

Add global styles in `styles/theme.css`:

```css
/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground));
  border-radius: 4px;
}
```

## Animation

### Built-in Animations

The theme includes several utility animations:

```typescript
<div className="animate-fade-in">Fades in</div>
<div className="animate-slide-up">Slides up</div>
<div className="animate-pulse">Pulses</div>
```

### Custom Animations

Define custom animations in `tailwind.config.ts`:

```typescript
export default {
  theme: {
    extend: {
      animation: {
        'bounce-slow': 'bounce 3s infinite',
      },
    },
  },
}
```

## Performance

### CSS Optimization

- Use Tailwind's JIT mode for minimal bundle size
- Avoid inline styles when possible
- Leverage CSS variables for theme switching

### Best Practices

- Prefer Tailwind utilities over custom CSS
- Use `@apply` for repeated utility combinations
- Keep custom CSS to a minimum
- Always scope styles to avoid conflicts