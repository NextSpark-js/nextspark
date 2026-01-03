# Creating Custom Themes

This guide walks you through creating a custom theme from scratch, covering directory setup, configuration, styling, and integration with the boilerplate's theme system.

## Overview

Creating a custom theme involves:

1. **Creating theme directory structure**
2. **Configuring theme metadata**
3. **Defining CSS variable overrides**
4. **Adding optional resources** (components, entities, translations)
5. **Building and testing** the theme

**Time required:** 15-30 minutes for a basic theme

## Prerequisites

Before starting, ensure you have:

- ✅ Familiarity with the [theme structure](./02-theme-structure.md)
- ✅ Understanding of [CSS variables and styling](./04-css-variables-and-styling.md)
- ✅ The boilerplate cloned and running locally
- ✅ Node.js and pnpm installed

## Step 1: Create Theme Directory

### Choose a Theme Name

Pick a unique identifier (lowercase, no spaces):

```bash
# Good examples
my-theme
professional-blue
client-acme
summer-2024

# Bad examples
My Theme      # Contains spaces
MyTheme       # Not lowercase
my_theme      # Use hyphens, not underscores
```

### Create Directory Structure

```bash
# Navigate to themes directory
cd contents/themes

# Create theme directory
mkdir my-theme

# Create subdirectories
cd my-theme
mkdir -p config
mkdir -p styles
mkdir -p public/brand
mkdir -p messages
```

**Minimal structure:**

```text
contents/themes/my-theme/
├── config/
│   └── theme.config.ts    # Required
├── styles/
│   └── globals.css        # Required for custom colors
└── public/
    └── brand/
```

## Step 2: Create Theme Configuration

### Create theme.config.ts

This is the **required** configuration file:

```typescript
// contents/themes/my-theme/config/theme.config.ts
import type { ThemeConfig } from '@/core/types/theme'

export const myThemeConfig: ThemeConfig = {
  // Required fields
  name: 'My Custom Theme',
  displayName: 'My Custom Theme',
  version: '1.0.0',
  
  // Optional metadata
  description: 'A professional theme with custom branding',
  author: 'Your Name',
  enabled: true,
  
  // Plugin dependencies
  plugins: [],
  
  // Styles configuration
  styles: {
    globals: 'globals.css',
    components: 'components.css'
  },
  
  // Theme-specific configuration
  config: {
    // Colors (optional, can define in CSS instead)
    colors: {
      primary: 'oklch(0.55 0.22 250)',
      secondary: 'oklch(0.85 0.05 250)'
    },
    
    // Fonts (optional)
    fonts: {
      sans: 'Inter, system-ui, sans-serif',
      mono: 'Fira Code, monospace'
    },
    
    // Spacing (optional)
    spacing: {
      radius: '0.5rem'
    }
  }
}

export default myThemeConfig
```

### Configuration Fields Explained

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique theme identifier |
| `displayName` | Yes | Human-readable name |
| `version` | Yes | Semantic version (e.g., "1.0.0") |
| `description` | No | Brief theme description |
| `author` | No | Theme creator name |
| `enabled` | No | Whether theme is active (default: true) |
| `plugins` | No | Required plugins array |
| `styles` | No | CSS file references |
| `config` | No | Theme-specific configuration |

## Step 3: Define CSS Variable Overrides

### Create styles/globals.css

This file defines your theme's color scheme and visual identity:

```css
/**
 * My Custom Theme - Global Variable Overrides
 * 
 * IMPORTANT: Use HSL format without hsl() wrapper
 * Format: H S% L% (e.g., 200 89% 47%)
 */

:root {
  /* ============================================
   * Background & Foreground
   * ============================================ */
  --background: 0 0% 100%;           /* Pure white */
  --foreground: 222 47% 11%;         /* Dark blue-gray */
  
  /* ============================================
   * Card & Popover
   * ============================================ */
  --card: 0 0% 100%;
  --card-foreground: 222 47% 11%;
  
  --popover: 0 0% 100%;
  --popover-foreground: 222 47% 11%;
  
  /* ============================================
   * Primary Colors (Main brand color)
   * ============================================ */
  --primary: 221 83% 53%;            /* Vibrant blue */
  --primary-foreground: 0 0% 98%;    /* White text on primary */
  
  /* ============================================
   * Secondary Colors
   * ============================================ */
  --secondary: 210 40% 96%;          /* Light blue-gray */
  --secondary-foreground: 222 47% 11%;
  
  /* ============================================
   * Muted Colors (Subtle backgrounds)
   * ============================================ */
  --muted: 210 40% 96%;
  --muted-foreground: 215 16% 47%;
  
  /* ============================================
   * Accent Colors (Highlights)
   * ============================================ */
  --accent: 210 40% 96%;
  --accent-foreground: 222 47% 11%;
  
  /* ============================================
   * Destructive Colors (Errors, delete actions)
   * ============================================ */
  --destructive: 0 84% 60%;          /* Red */
  --destructive-foreground: 0 0% 98%;
  
  /* ============================================
   * Borders & Inputs
   * ============================================ */
  --border: 214 32% 91%;
  --input: 214 32% 91%;
  --ring: 221 83% 53%;               /* Focus ring */
  
  /* ============================================
   * Chart Colors (For data visualization)
   * ============================================ */
  --chart-1: 221 83% 53%;            /* Primary chart color */
  --chart-2: 212 95% 68%;
  --chart-3: 216 92% 60%;
  --chart-4: 210 98% 78%;
  --chart-5: 212 97% 87%;
  
  /* ============================================
   * Sidebar Colors (Dashboard navigation)
   * ============================================ */
  --sidebar: 0 0% 100%;
  --sidebar-foreground: 222 47% 11%;
  --sidebar-primary: 221 83% 53%;
  --sidebar-primary-foreground: 0 0% 98%;
  --sidebar-accent: 210 40% 96%;
  --sidebar-accent-foreground: 222 47% 11%;
  --sidebar-border: 214 32% 91%;
  --sidebar-ring: 221 83% 53%;
  
  /* ============================================
   * Border Radius
   * ============================================ */
  --radius: 0.5rem;
}

/* ============================================
 * Dark Mode
 * ============================================ */
.dark {
  --background: 222 47% 11%;         /* Dark blue-gray */
  --foreground: 0 0% 98%;            /* White */
  
  --card: 224 71% 4%;
  --card-foreground: 0 0% 98%;
  
  --popover: 224 71% 4%;
  --popover-foreground: 0 0% 98%;
  
  --primary: 217 92% 76%;            /* Lighter blue for dark mode */
  --primary-foreground: 222 47% 11%;
  
  --secondary: 222 47% 11%;
  --secondary-foreground: 0 0% 98%;
  
  --muted: 223 47% 11%;
  --muted-foreground: 215 20% 65%;
  
  --accent: 216 34% 17%;
  --accent-foreground: 0 0% 98%;
  
  --destructive: 0 63% 31%;
  --destructive-foreground: 0 0% 98%;
  
  --border: 216 34% 17%;
  --input: 216 34% 17%;
  --ring: 217 92% 76%;
  
  --chart-1: 217 92% 76%;
  --chart-2: 212 95% 68%;
  --chart-3: 216 92% 60%;
  --chart-4: 210 98% 78%;
  --chart-5: 212 97% 87%;
  
  --sidebar: 224 71% 4%;
  --sidebar-foreground: 0 0% 98%;
  --sidebar-primary: 217 92% 76%;
  --sidebar-primary-foreground: 222 47% 11%;
  --sidebar-accent: 216 34% 17%;
  --sidebar-accent-foreground: 0 0% 98%;
  --sidebar-border: 216 34% 17%;
  --sidebar-ring: 217 92% 76%;
}
```

### Critical CSS Format Notes

**✅ CORRECT Format:**

```css
--primary: 200 89% 47%;      /* HSL values only */
```

**❌ WRONG Format:**

```css
--primary: hsl(200 89% 47%);           /* With hsl() wrapper */
--primary: oklch(0.7 0.15 200);        /* OKLCH format */
--primary: #3b82f6;                    /* Hex color */
--primary: rgb(59, 130, 246);          /* RGB format */
```

**Why?** The core CSS uses `hsl(var(--primary))`, so variables must contain only the HSL values.

## Step 4: Add Component Styles (Optional)

### Create styles/components.css

Add custom component styles or overrides:

```css
/**
 * My Custom Theme - Component Styles
 */

/* Custom button styles */
.btn-gradient {
  @apply bg-gradient-to-r from-primary to-secondary;
  @apply shadow-lg hover:shadow-xl transition-all;
}

/* Custom card hover effect */
.card-hover {
  @apply transition-all duration-200;
  @apply hover:scale-[1.02] hover:shadow-lg;
}

/* Custom scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: hsl(var(--muted));
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: hsl(var(--primary));
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--primary) / 0.8);
}

/* Theme-specific gradient */
.theme-gradient {
  background: linear-gradient(
    135deg,
    hsl(var(--primary)) 0%,
    hsl(var(--secondary)) 100%
  );
}
```

## Step 5: Add Brand Assets

### Create Brand Directory

```bash
cd contents/themes/my-theme/public/brand
```

### Required Assets

| Asset | Size | Format | Purpose |
|-------|------|--------|---------|
| `logo.svg` | - | SVG | Primary logo (light mode) |
| `logo-dark.svg` | - | SVG | Dark mode logo |
| `logo-text.svg` | - | SVG | Logo with text |
| `favicon.ico` | 32x32 | ICO | Browser favicon |
| `apple-touch-icon.png` | 180x180 | PNG | iOS home screen icon |
| `og-image.png` | 1200x630 | PNG | Social media preview |

### Asset Guidelines

**Logo Files:**

```text
public/brand/
├── logo.svg              # Primary logo (transparent background)
├── logo-dark.svg         # Dark mode version
├── logo-text.svg         # With company name
├── logo-icon.svg         # Icon only (for favicons)
├── favicon.ico           # Browser favicon
├── favicon.svg           # Modern SVG favicon
├── apple-touch-icon.png  # iOS icon
└── og-image.png          # Social media preview
```

**Usage in Components:**

```tsx
import Image from 'next/image'

<Image 
  src="/theme/brand/logo.svg" 
  alt="Logo" 
  width={120} 
  height={40}
/>
```

## Step 6: Add Translations (Optional)

### Create Translation Files

```bash
mkdir -p contents/themes/my-theme/messages
```

### Create messages/en.json

```json
{
  "common": {
    "welcome": "Welcome to {appName}",
    "signIn": "Sign In",
    "signOut": "Sign Out",
    "loading": "Loading...",
    "save": "Save Changes",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit"
  },
  "dashboard": {
    "title": "Dashboard",
    "overview": "Overview",
    "stats": "Statistics",
    "recentActivity": "Recent Activity"
  },
  "features": {
    "title": "Features",
    "subtitle": "Everything you need to succeed",
    "feature1": "Fast & Reliable",
    "feature2": "Secure by Default",
    "feature3": "Easy to Use"
  },
  "navigation": {
    "home": "Home",
    "features": "Features",
    "pricing": "Pricing",
    "docs": "Documentation",
    "support": "Support"
  }
}
```

### Create messages/es.json

```json
{
  "common": {
    "welcome": "Bienvenido a {appName}",
    "signIn": "Iniciar Sesión",
    "signOut": "Cerrar Sesión",
    "loading": "Cargando...",
    "save": "Guardar Cambios",
    "cancel": "Cancelar",
    "delete": "Eliminar",
    "edit": "Editar"
  },
  "dashboard": {
    "title": "Panel",
    "overview": "Resumen",
    "stats": "Estadísticas",
    "recentActivity": "Actividad Reciente"
  },
  "features": {
    "title": "Características",
    "subtitle": "Todo lo que necesitas para tener éxito",
    "feature1": "Rápido y Confiable",
    "feature2": "Seguro por Defecto",
    "feature3": "Fácil de Usar"
  },
  "navigation": {
    "home": "Inicio",
    "features": "Características",
    "pricing": "Precios",
    "docs": "Documentación",
    "support": "Soporte"
  }
}
```

## Step 7: Configure Dashboard (Optional)

### Create dashboard.config.ts

```typescript
// contents/themes/my-theme/config/dashboard.config.ts
export const DASHBOARD_CONFIG = {
  navigation: {
    primary: [
      {
        label: 'Dashboard',
        path: '/dashboard',
        icon: 'LayoutDashboard',
        permission: 'dashboard:view'
      },
      {
        label: 'Projects',
        path: '/dashboard/projects',
        icon: 'FolderOpen',
        permission: 'projects:read',
        badge: 'new'
      },
      {
        label: 'Team',
        path: '/dashboard/team',
        icon: 'Users',
        permission: 'team:read'
      },
      {
        label: 'Analytics',
        path: '/dashboard/analytics',
        icon: 'BarChart3',
        permission: 'analytics:read'
      }
    ],
    
    secondary: [
      {
        label: 'Settings',
        path: '/dashboard/settings',
        icon: 'Settings'
      },
      {
        label: 'Help',
        path: '/dashboard/help',
        icon: 'HelpCircle'
      }
    ]
  },
  
  layout: {
    sidebarCollapsible: true,
    sidebarDefaultState: 'expanded',
    showUserMenu: true,
    showNotifications: true,
    showSearch: true
  },
  
  features: {
    showQuickActions: true,
    enableNotifications: true,
    enableCommandPalette: true,
    showRecentItems: true
  },
  
  widgets: {
    dashboard: [
      'stats-overview',
      'recent-activity',
      'quick-actions',
      'team-members'
    ]
  }
}
```

## Step 8: Override App Configuration (Optional)

### Create app.config.ts

```typescript
// contents/themes/my-theme/config/app.config.ts
export const APP_CONFIG_OVERRIDES = {
  // Application Metadata
  app: {
    name: 'My Custom SaaS',
    version: '2.0.0',
    description: 'Custom SaaS application with My Theme',
    url: 'https://myapp.com'
  },
  
  // Internationalization
  i18n: {
    supportedLocales: ['en', 'es', 'fr'],
    defaultLocale: 'en',
    namespaces: [
      'common',
      'dashboard',
      'settings',
      'auth',
      'public',
      'validation'
    ]
  },
  
  // Features
  features: {
    enableBlog: true,
    enableDocs: true,
    enableApiKeys: true,
    enableNotifications: true,
    enableAnalytics: true
  },
  
  // Dashboard
  dashboard: {
    sidebarPosition: 'left',
    showBreadcrumbs: true,
    enableQuickActions: true,
    compactMode: false
  },
  
  // SEO
  seo: {
    siteName: 'My Custom SaaS',
    siteUrl: 'https://myapp.com',
    ogImage: '/theme/brand/og-image.png',
    twitterHandle: '@myapp'
  }
}
```

## Step 9: Build and Test

### Set Active Theme

**Option 1: Environment Variable**

```bash
# .env.local
NEXT_PUBLIC_ACTIVE_THEME=my-theme
```

**Option 2: Create NPM Script**

Add to `package.json`:

```json
{
  "scripts": {
    "theme:my-theme": "cross-env NEXT_PUBLIC_ACTIVE_THEME=my-theme pnpm theme:build",
    "dev:my-theme": "cross-env NEXT_PUBLIC_ACTIVE_THEME=my-theme pnpm dev"
  }
}
```

### Build Theme

```bash
# Rebuild registry to discover new theme
pnpm registry:build

# Build theme CSS and copy assets
pnpm theme:build

# Or use custom script
pnpm theme:my-theme
```

### Start Development Server

```bash
pnpm dev

# Or with theme-specific script
pnpm dev:my-theme
```

### Verify Theme

1. **Open browser:** `http://localhost:3000`
2. **Check colors:** Verify your custom colors are applied
3. **Test dark mode:** Toggle dark mode to check dark colors
4. **Check console:** Look for theme-related errors
5. **Verify assets:** Check that logos and images load correctly

## Step 10: Create Theme Entities (Optional)

### Create Entity Directory

```bash
mkdir -p contents/themes/my-theme/entities/projects
```

### Create Entity Configuration

```typescript
// contents/themes/my-theme/entities/projects/projects.config.ts
import type { EntityConfig } from '@/core/lib/entities/types'
import { projectsFields } from './projects.fields'

export const projectsConfig: EntityConfig = {
  name: 'projects',
  displayName: 'Projects',
  pluralDisplayName: 'Projects',
  tableName: 'projects',
  fields: projectsFields,
  
  permissions: {
    read: ['admin', 'colaborator', 'member'],
    create: ['admin', 'colaborator'],
    update: ['admin', 'colaborator'],
    delete: ['admin']
  },
  
  ui: {
    icon: 'FolderOpen',
    color: 'blue',
    defaultView: 'table',
    enableSearch: true,
    enableFilters: true
  },
  
  display: {
    nameField: 'name',
    descriptionField: 'description',
    imageField: null
  }
}
```

### Create Entity Fields

```typescript
// contents/themes/my-theme/entities/projects/projects.fields.ts
import type { FieldDefinitions } from '@/core/lib/entities/types'
import { z } from 'zod'

export const projectsFields: FieldDefinitions = {
  name: {
    type: 'text',
    label: 'Project Name',
    required: true,
    placeholder: 'Enter project name',
    validation: z.string().min(3).max(100)
  },
  
  description: {
    type: 'textarea',
    label: 'Description',
    required: false,
    placeholder: 'Project description...',
    validation: z.string().max(500).optional()
  },
  
  status: {
    type: 'select',
    label: 'Status',
    required: true,
    options: [
      { value: 'planning', label: 'Planning' },
      { value: 'active', label: 'Active' },
      { value: 'completed', label: 'Completed' },
      { value: 'archived', label: 'Archived' }
    ],
    default: 'planning'
  },
  
  priority: {
    type: 'select',
    label: 'Priority',
    required: true,
    options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' }
    ],
    default: 'medium'
  },
  
  start_date: {
    type: 'date',
    label: 'Start Date',
    required: true
  },
  
  end_date: {
    type: 'date',
    label: 'End Date',
    required: false
  }
}
```

## Troubleshooting

### Theme Not Loading

**Problem:** Theme builds but doesn't apply

**Solutions:**
1. Check `NEXT_PUBLIC_ACTIVE_THEME` environment variable
2. Verify theme name matches directory name exactly
3. Run `pnpm registry:build` to regenerate registry
4. Clear browser cache (Ctrl+Shift+R / Cmd+Shift+R)
5. Restart development server

### Colors Not Updating

**Problem:** CSS builds but colors don't change

**Solutions:**
1. **Check CSS format:** Ensure using HSL without `hsl()` wrapper
2. **Clear Next.js cache:** `rm -rf .next && pnpm dev`
3. **Hard refresh browser:** Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)
4. **Check console:** Look for CSS parsing errors
5. **Verify import:** Check `core/theme-styles.css` was generated

### Registry Not Finding Theme

**Problem:** `getTheme('my-theme')` returns undefined

**Solutions:**
1. Verify `theme.config.ts` exists
2. Check file exports `default` or named export
3. Run `pnpm registry:build`
4. Check console for build errors
5. Restart dev server

### Assets Not Copying

**Problem:** Images/fonts not available

**Solutions:**
1. Verify assets are in `public/` subdirectory
2. Run `pnpm theme:build` to copy assets
3. Check `public/theme/` directory was created
4. Verify file paths use `/theme/` prefix
5. Clear browser cache

## Best Practices

### Naming Conventions

```bash
# Theme name
my-theme              # ✅ Lowercase, hyphens
My-Theme              # ❌ Uppercase
my_theme              # ❌ Underscores

# Config exports
myThemeConfig         # ✅ camelCase
MyThemeConfig         # ❌ PascalCase
```

### CSS Organization

```css
/* ✅ GOOD: Organized with comments */
:root {
  /* Primary Colors */
  --primary: 200 89% 47%;
  --primary-foreground: 0 0% 98%;
  
  /* Secondary Colors */
  --secondary: 200 18% 94%;
  --secondary-foreground: 200 18% 11%;
}

/* ❌ BAD: No organization */
:root {
  --primary: 200 89% 47%;
  --muted: 200 18% 94%;
  --border: 200 18% 87%;
}
```

### Version Management

```typescript
// Use semantic versioning
version: '1.0.0'      // ✅ Initial release
version: '1.1.0'      // ✅ Minor update
version: '2.0.0'      // ✅ Major changes

version: 'v1'         // ❌ Non-semantic
version: '1'          // ❌ Missing minor/patch
```

### Testing Checklist

- [ ] Theme builds without errors
- [ ] All colors display correctly in light mode
- [ ] All colors display correctly in dark mode
- [ ] Brand assets load properly
- [ ] Translations work (if added)
- [ ] Dashboard navigation works (if configured)
- [ ] No console errors
- [ ] Typography is readable
- [ ] Focus states are visible
- [ ] Tested on multiple browsers
- [ ] Tested responsive layouts

## Advanced Customization

### Custom Fonts

```typescript
// theme.config.ts
config: {
  fonts: {
    sans: 'Poppins, system-ui, sans-serif',
    serif: 'Merriweather, Georgia, serif',
    mono: 'JetBrains Mono, monospace'
  }
}
```

```css
/* styles/globals.css */
@font-face {
  font-family: 'Poppins';
  src: url('/theme/fonts/poppins.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

### Component Overrides

```typescript
// theme.config.ts
components: {
  overrides: {
    '@/core/components/ui/button': () =>
      import('./components/overrides/Button').then(m => m.Button)
  }
}
```

### Custom Shadows

```css
:root {
  --shadow-sm: 0 1px 2px 0 hsl(var(--foreground) / 0.05);
  --shadow-md: 0 4px 6px -1px hsl(var(--foreground) / 0.1);
  --shadow-lg: 0 10px 15px -3px hsl(var(--foreground) / 0.1);
}
```

## Next Steps

Now that you've created a custom theme:

1. **[Component Overrides](./05-component-overrides.md)** - Customize components
2. **[Asset Management](./06-asset-management.md)** - Optimize assets
3. **[Dark Mode Support](./07-dark-mode.md)** - Fine-tune dark mode
4. **[Theme Registry](./08-theme-registry.md)** - Understand registry integration

---

> 💡 **Pro Tip**: Start with the default theme as a template. Copy it, rename it, and modify gradually rather than building from scratch. This ensures you don't miss any required configuration.
