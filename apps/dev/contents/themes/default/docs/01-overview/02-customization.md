# Theme Customization

## Introduction

The default theme is designed to be highly customizable. This guide explains how to modify colors, typography, spacing, components, and functionality to match your brand and requirements.

## Configuration Files

### Theme Configuration (`theme.config.ts`)

**Primary configuration** for theme metadata, styles, and components:

```typescript
export const boilerplateThemeConfig: ThemeConfig = {
  // Metadata
  name: 'easy-home',
  displayName: 'Boilerplate',
  version: '1.0.0',
  description: 'Boilerplate app',
  author: 'NextSpark Team',

  // Plugins
  plugins: ['ai'],
  
  // Styles (OKLCH colors, fonts, spacing)
  styles: { ... },
  
  // Theme-level configuration
  config: { ... },
  
  // Component overrides
  components: { ... }
}
```

### Application Configuration (`app.config.ts`)

**Override core app settings** for this theme:

```typescript
export const APP_CONFIG_OVERRIDES = {
  // App metadata
  app: {
    name: 'Boilerplate',
    version: '1.0.0',
  },

  // Internationalization
  i18n: {
    supportedLocales: ['en', 'es'],
    defaultLocale: 'es',
    namespaces: ['common', 'dashboard', 'tasks', ...],
  },

  // API settings
  api: {
    cors: { ... }
  },

  // Documentation
  docs: {
    enabled: true,
    public: true,
    showPluginsDocsInProd: false,
  },

  // Mobile navigation
  mobileNav: {
    items: [...],
    moreSheetItems: [...]
  }
}
```

---

## Styling Customization

### 1. Colors (OKLCH System)

**Primary Colors:**

```typescript
// theme.config.ts
config: {
  colors: {
    primary: 'oklch(0.7090 0.1592 293.5412)',      // Purple
    'primary-foreground': 'oklch(1.0000 0 0)',     // White
    secondary: 'oklch(0.9073 0.0530 306.0902)',    // Light purple
    // ... more colors
  }
}
```

**Change Brand Color:**

```typescript
// From purple to blue
primary: 'oklch(0.5535 0.2164 259.8160)',  // Blue
```

**OKLCH Advantages:**
- Perceptually uniform
- Better interpolation
- Predictable lightness
- Easy to adjust hue while keeping lightness constant

**Tools:**
- [OKLCH Color Picker](https://oklch.com/)
- [Color Space Converter](https://colorspace.r-forge.r-project.org/)

### 2. Typography

**Font Families:**

```typescript
// theme.config.ts
config: {
  fonts: {
    sans: 'Open Sans, sans-serif',           // Body text
    serif: 'Source Serif 4, serif',          // Headings
    mono: 'IBM Plex Mono, monospace'         // Code
  }
}
```

**Custom Fonts:**

1. Add font files to `public/fonts/`:
   ```
   public/fonts/
   ├── custom-font.woff2
   ├── custom-font.woff
   └── custom-font-license.txt
   ```

2. Update configuration:
   ```typescript
   fonts: {
     sans: 'CustomFont, sans-serif',
   }
   ```

3. Load in CSS:
   ```css
   /* styles/globals.css */
   @font-face {
     font-family: 'CustomFont';
     src: url('/theme/fonts/custom-font.woff2') format('woff2');
     font-weight: 400;
     font-style: normal;
   }
   ```

### 3. Spacing and Layout

**Border Radius:**

```typescript
// theme.config.ts
spacing: {
  radius: '1.5rem',                // Large radius (default)
  'radius-sm': 'calc(1.5rem - 4px)',
  'radius-md': 'calc(1.5rem - 2px)',
  'radius-lg': '1.5rem',
  'radius-xl': 'calc(1.5rem + 4px)'
}

// For sharper design:
spacing: {
  radius: '0.5rem',  // Smaller radius
  ...
}
```

**Custom Spacing Variables:**

```typescript
// theme.config.ts
styles: {
  variables: {
    '--spacing-xs': '0.125rem',
    '--spacing-sm': '0.25rem',
    '--spacing-md': '0.5rem',
    '--spacing-lg': '1rem',
    '--spacing-xl': '1.5rem',
    '--spacing-2xl': '2rem'
  }
}
```

### 4. Shadows

```typescript
// theme.config.ts
breakpoints: {  // Using breakpoints for shadows (legacy)
  shadow: '0px 8px 16px -4px hsl(0 0% 0% / 0.08)',
  'shadow-lg': '0px 8px 16px -4px hsl(0 0% 0% / 0.08), 0px 4px 6px -5px hsl(0 0% 0% / 0.08)',
  // ... more shadows
}
```

**For Material Design:**
```typescript
shadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
'shadow-lg': '0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)',
```

### 5. Dark Mode

**Colors automatically adapt** using OKLCH with adjusted lightness:

```typescript
// Light mode
background: 'oklch(0.9689 0.0090 314.7819)',  // Light

// Dark mode (automatic inversion)
// Background becomes darker while maintaining hue
```

**Custom Dark Mode Colors:**

```css
/* styles/globals.css */
:root {
  --background: oklch(0.9689 0.0090 314.7819);
}

:root[data-theme="dark"] {
  --background: oklch(0.2000 0.0090 314.7819);  // Custom dark
}
```

---

## Component Customization

### Overriding Core Components

**Method 1: Theme Config Override**

```typescript
// theme.config.ts
components: {
  overrides: {
    '@/core/components/ui/button': () => 
      import('../components/overrides/Button').then(m => m.Button),
  }
}
```

**Method 2: Create Wrapper Component**

```typescript
// components/custom/BrandButton.tsx
import { Button } from '@/core/components/ui/button'
import { cn } from '@/core/lib/utils'

export function BrandButton({ className, ...props }) {
  return (
    <Button
      className={cn('rounded-full shadow-lg', className)}
      {...props}
    />
  )
}
```

### Creating Custom Components

```typescript
// components/custom/CustomHeader.tsx
export function CustomHeader() {
  return (
    <header className="bg-gradient-to-r from-primary to-secondary">
      <h1>Custom Theme Header</h1>
    </header>
  )
}

// Register in theme.config.ts
components: {
  custom: {
    CustomHeader: () => import('../components/custom/CustomHeader')
      .then(m => m.CustomHeader),
  }
}
```

---

## Mobile Navigation

### Bottom Navigation Items

```typescript
// app.config.ts
mobileNav: {
  items: [
    {
      id: 'home',
      labelKey: 'common.mobileNav.home',
      href: '/dashboard',
      icon: 'Home',
      enabled: true,
    },
    {
      id: 'tasks',
      labelKey: 'common.mobileNav.tasks',
      href: '/dashboard/tasks',
      icon: 'CheckSquare',
      enabled: true,
    },
    {
      id: 'create',
      labelKey: 'common.mobileNav.create',
      icon: 'Plus',
      isCentral: true,          // Highlighted center button
      action: 'quickCreate',
      enabled: true,
    },
    // Add custom item
    {
      id: 'projects',
      labelKey: 'common.mobileNav.projects',
      href: '/dashboard/projects',
      icon: 'FolderKanban',
      enabled: true,
    },
  ]
}
```

### More Sheet Items

```typescript
moreSheetItems: [
  {
    id: 'profile',
    labelKey: 'common.navigation.profile',
    href: '/dashboard/settings/profile',
    icon: 'User',
    enabled: true,
  },
  // Add custom option
  {
    id: 'analytics',
    labelKey: 'common.navigation.analytics',
    href: '/dashboard/analytics',
    icon: 'BarChart',
    enabled: true,
  },
]
```

---

## Entity Customization

### Modify Existing Entity (Tasks)

**Change Permissions:**

```typescript
// entities/tasks/tasks.config.ts
permissions: {
  read: ['admin', 'member'],        // Only admin and members
  create: ['admin'],                // Only admin can create
  update: ['admin'],
  delete: ['admin']
}
```

**Change UI Features:**

```typescript
ui: {
  dashboard: {
    showInMenu: true,
    showInTopbar: false  // Hide from topbar
  },
  features: {
    bulkOperations: false,  // Disable bulk operations
    importExport: true      // Enable import/export
  }
}
```

### Add New Entity

1. Create entity directory:
   ```
   entities/projects/
   ├── projects.config.ts
   ├── projects.fields.ts
   ├── messages/
   │   ├── en.json
   │   └── es.json
   └── migrations/
       └── 001_projects_table.sql
   ```

2. Configure entity (see Entity System documentation)

3. Add translations

4. Create migrations

5. Rebuild registry: `pnpm registry:build`

---

## Page Template Customization

### Modify Existing Pages

**Home Page:**

```tsx
// templates/(public)/page.tsx
export default function HomePage() {
  return (
    <div>
      <section className="hero">
        <h1>Custom Hero Section</h1>
        <p>Custom tagline for your brand</p>
      </section>
      {/* More sections */}
    </div>
  )
}
```

**Features Page:**

```tsx
// templates/(public)/features/page.tsx
const features = [
  {
    title: 'Custom Feature 1',
    description: 'Description...',
    icon: Zap
  },
  // More features
]
```

### Add New Public Pages

```tsx
// templates/(public)/about/page.tsx
export default function AboutPage() {
  return (
    <div className="container mx-auto py-12">
      <h1>About Us</h1>
      <p>Company information...</p>
    </div>
  )
}
```

Access at: `/about`

---

## Translations

### Update Existing Translations

```json
// messages/en.json
{
  "common": {
    "appName": "Your SaaS Name",
    "tagline": "Your custom tagline",
    "mobileNav": {
      "home": "Home",
      "tasks": "My Tasks",
      "create": "New"
    }
  }
}
```

### Add New Namespaces

1. **Create translation files:**
   ```
   messages/
   ├── en.json
   ├── es.json
   └── projects.en.json  # New namespace
   ```

2. **Register in config:**
   ```typescript
   // app.config.ts
   i18n: {
     namespaces: [
       'common',
       'dashboard',
       'projects',  // Add here
     ],
   }
   ```

3. **Use in components:**
   ```typescript
   import { useTranslations } from 'next-intl'
   
   const t = useTranslations('projects')
   return <h1>{t('title')}</h1>
   ```

---

## Static Assets

### Brand Assets

```
public/brand/
├── logo.svg              # Light mode logo
├── logo-dark.svg         # Dark mode logo
├── logo-text.svg         # Logo with text
├── favicon.ico           # Browser favicon
└── apple-touch-icon.png  # iOS home screen icon
```

**Usage:**

```tsx
<img src="/theme/brand/logo.svg" alt="Logo" />
```

### Images

```
public/images/
├── hero-bg.jpg
├── feature-1.png
└── feature-2.png
```

**Optimization:**
- Use next/image for automatic optimization
- WebP format for smaller sizes
- Appropriate dimensions for use case

### Fonts

```
public/fonts/
├── custom-font.woff2
├── custom-font.woff
└── custom-font-license.txt
```

---

## Plugin Configuration

### Add Plugins

```typescript
// theme.config.ts
plugins: ['ai', 'analytics', 'payments']
```

### Remove Plugins

```typescript
plugins: []  // No plugins
```

---

## Best Practices

### Colors

✅ **DO:**
- Use OKLCH color system
- Maintain consistent contrast ratios
- Test in light and dark modes
- Use semantic color names

❌ **DON'T:**
- Hardcode hex colors in components
- Use colors with poor contrast
- Ignore dark mode
- Use too many brand colors

### Typography

✅ **DO:**
- Load only necessary font weights
- Use variable fonts when possible
- Provide fallback fonts
- Optimize font loading

❌ **DON'T:**
- Load entire font families
- Use custom fonts for body text (performance)
- Forget font licenses
- Mix too many font families

### Components

✅ **DO:**
- Extend core components when possible
- Follow naming conventions
- Document custom components
- Keep components reusable

❌ **DON'T:**
- Duplicate core component code
- Create single-use components
- Ignore accessibility
- Skip TypeScript types

### Assets

✅ **DO:**
- Optimize images before uploading
- Use appropriate formats (WebP, SVG)
- Provide alt text
- Version assets in git

❌ **DON'T:**
- Commit large unoptimized images
- Use inline base64 for large images
- Forget to add licensing info
- Store secrets in public/

---

## Quick Customization Checklist

**Brand Identity:**
- [ ] Update theme name and display name
- [ ] Change primary and secondary colors
- [ ] Upload brand logo and favicon
- [ ] Update typography (if needed)
- [ ] Customize border radius

**Content:**
- [ ] Update app name in translations
- [ ] Customize public page content
- [ ] Add/modify entities
- [ ] Update mobile navigation

**Functionality:**
- [ ] Configure mobile navigation items
- [ ] Set default locale
- [ ] Enable/disable plugins
- [ ] Configure documentation visibility

**Polish:**
- [ ] Test in light and dark modes
- [ ] Verify mobile responsiveness
- [ ] Check all translations
- [ ] Test on different devices

---

## Next Steps

- **[Components](../02-features/01-components.md)** - Explore available components
- **[Styling](../02-features/02-styling.md)** - Deep dive into styling system
- **[Core Theme System](/docs/core/theme-system/introduction)** - Complete theme documentation