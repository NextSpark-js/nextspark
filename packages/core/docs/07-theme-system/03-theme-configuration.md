# Theme Configuration

Theme configuration defines the metadata, appearance, and behavior of your theme through the `theme.config.ts` file and related configuration files.

## ThemeConfig Interface

The main configuration interface is defined in `core/types/theme.ts`:

```typescript
export interface ThemeConfig {
  name: string
  displayName: string
  version: string
  description?: string
  author?: string
  enabled?: boolean
  dependencies?: string[]
  plugins?: string[]
  styles?: {
    globals?: string
    components?: string
    variables?: Record<string, string>
  }
  colors?: ThemeColors
  typography?: ThemeTypography
  spacing?: ThemeSpacing
  components?: Record<string, any>
  config?: Record<string, any>
  [key: string]: any  // Allow additional properties
}
```

## Basic Configuration

### theme.config.ts

**Location:** `contents/themes/[theme-name]/theme.config.ts`

**Minimal Example:**

```typescript
import type { ThemeConfig } from '@/core/types/theme'

export const myThemeConfig: ThemeConfig = {
  name: 'my-theme',
  displayName: 'My Custom Theme',
  version: '1.0.0',
  description: 'A beautiful custom theme for my SaaS',
  author: 'Your Name'
}

export default myThemeConfig
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Unique theme identifier (lowercase, no spaces) |
| `displayName` | string | Human-readable name shown in UI |
| `version` | string | Semantic version (e.g., "1.0.0") |

### Optional Metadata

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | Brief theme description |
| `author` | string | Theme creator name |
| `enabled` | boolean | Whether theme is active (default: true) |
| `dependencies` | string[] | Required packages |

## Styles Configuration

### CSS File References

```typescript
styles: {
  globals: 'globals.css',        // CSS variable overrides
  components: 'components.css',  // Component-specific styles
  variables: {
    // Inline CSS variables
    '--spacing-xs': '0.125rem',
    '--spacing-sm': '0.25rem',
    '--spacing-md': '0.5rem',
    '--spacing-lg': '1rem',
    '--spacing-xl': '1.5rem',
    '--spacing-2xl': '2rem'
  }
}
```

**Properties:**

- `globals` - Path to global CSS file (relative to theme directory)
- `components` - Path to component CSS file
- `variables` - Inline CSS variable definitions

## Color Configuration

### Complete Color Scheme

```typescript
config: {
  colors: {
    // Background & Foreground
    background: 'oklch(0.9689 0.0090 314.7819)',
    foreground: 'oklch(0.3729 0.0306 259.7328)',
    
    // Card
    card: 'oklch(1.0000 0 0)',
    'card-foreground': 'oklch(0.3729 0.0306 259.7328)',
    
    // Popover
    popover: 'oklch(1.0000 0 0)',
    'popover-foreground': 'oklch(0.3729 0.0306 259.7328)',
    
    // Primary
    primary: 'oklch(0.7090 0.1592 293.5412)',
    'primary-foreground': 'oklch(1.0000 0 0)',
    
    // Secondary
    secondary: 'oklch(0.9073 0.0530 306.0902)',
    'secondary-foreground': 'oklch(0.4461 0.0263 256.8018)',
    
    // Muted
    muted: 'oklch(0.9464 0.0327 307.1745)',
    'muted-foreground': 'oklch(0.5510 0.0234 264.3637)',
    
    // Accent
    accent: 'oklch(0.9376 0.0260 321.9388)',
    'accent-foreground': 'oklch(0.3729 0.0306 259.7328)',
    
    // Destructive
    destructive: 'oklch(0.8077 0.1035 19.5706)',
    'destructive-foreground': 'oklch(1.0000 0 0)',
    
    // Border & Input
    border: 'oklch(0.9073 0.0530 306.0902)',
    input: 'oklch(0.9073 0.0530 306.0902)',
    ring: 'oklch(0.7090 0.1592 293.5412)',
    
    // Chart Colors
    'chart-1': 'oklch(0.7090 0.1592 293.5412)',
    'chart-2': 'oklch(0.6056 0.2189 292.7172)',
    'chart-3': 'oklch(0.5413 0.2466 293.0090)',
    'chart-4': 'oklch(0.4907 0.2412 292.5809)',
    'chart-5': 'oklch(0.4320 0.2106 292.7591)',
    
    // Sidebar
    sidebar: 'oklch(0.9073 0.0530 306.0902)',
    'sidebar-foreground': 'oklch(0.3729 0.0306 259.7328)',
    'sidebar-primary': 'oklch(0.7090 0.1592 293.5412)',
    'sidebar-primary-foreground': 'oklch(1.0000 0 0)',
    'sidebar-accent': 'oklch(0.9376 0.0260 321.9388)',
    'sidebar-accent-foreground': 'oklch(0.3729 0.0306 259.7328)',
    'sidebar-border': 'oklch(0.9073 0.0530 306.0902)',
    'sidebar-ring': 'oklch(0.7090 0.1592 293.5412)'
  }
}
```

### Color Formats

**OKLCH (Recommended):**

```typescript
// OKLCH: Lightness, Chroma, Hue
primary: 'oklch(0.7090 0.1592 293.5412)'
```

**Benefits:**
- Perceptually uniform
- Better gradients
- More vibrant colors
- Wide gamut support

**HSL (Also Supported):**

```typescript
// HSL: Hue, Saturation, Lightness
primary: '200 89% 47%'  // Without hsl() wrapper
```

## Typography Configuration

### Font Families

```typescript
config: {
  fonts: {
    sans: 'Open Sans, sans-serif',
    serif: 'Source Serif 4, serif',
    mono: 'IBM Plex Mono, monospace'
  }
}
```

### Complete Typography System

```typescript
typography: {
  fontFamily: {
    sans: 'Inter, system-ui, sans-serif',
    serif: 'Georgia, serif',
    mono: 'Fira Code, monospace'
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem'
  },
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75'
  }
}
```

## Spacing Configuration

### Radius Values

```typescript
config: {
  spacing: {
    radius: '1.5rem',
    'radius-sm': 'calc(1.5rem - 4px)',
    'radius-md': 'calc(1.5rem - 2px)',
    'radius-lg': '1.5rem',
    'radius-xl': 'calc(1.5rem + 4px)'
  }
}
```

### Shadow System

```typescript
config: {
  breakpoints: {  // Note: Using breakpoints for shadows
    'shadow-2xs': '0px 8px 16px -4px hsl(0 0% 0% / 0.04)',
    'shadow-xs': '0px 8px 16px -4px hsl(0 0% 0% / 0.04)',
    'shadow-sm': '0px 8px 16px -4px hsl(0 0% 0% / 0.08), 0px 1px 2px -5px hsl(0 0% 0% / 0.08)',
    shadow: '0px 8px 16px -4px hsl(0 0% 0% / 0.08), 0px 1px 2px -5px hsl(0 0% 0% / 0.08)',
    'shadow-md': '0px 8px 16px -4px hsl(0 0% 0% / 0.08), 0px 2px 4px -5px hsl(0 0% 0% / 0.08)',
    'shadow-lg': '0px 8px 16px -4px hsl(0 0% 0% / 0.08), 0px 4px 6px -5px hsl(0 0% 0% / 0.08)',
    'shadow-xl': '0px 8px 16px -4px hsl(0 0% 0% / 0.08), 0px 8px 10px -5px hsl(0 0% 0% / 0.08)',
    'shadow-2xl': '0px 8px 16px -4px hsl(0 0% 0% / 0.20)'
  }
}
```

## Component Configuration

### Overriding Core Components

```typescript
components: {
  overrides: {
    // Override Button component
    '@/core/components/ui/button': () => 
      import('./components/overrides/Button').then(m => m.Button),
    
    // Override Card with all exports
    '@/core/components/ui/card': () => 
      import('./components/overrides/Card').then(m => ({
        Card: m.Card,
        CardHeader: m.CardHeader,
        CardTitle: m.CardTitle,
        CardDescription: m.CardDescription,
        CardContent: m.CardContent,
        CardFooter: m.CardFooter
      }))
  }
}
```

### Custom Theme Components

```typescript
components: {
  custom: {
    // Custom header component
    CustomHeader: () => 
      import('./components/custom/CustomHeader').then(m => m.CustomHeader),
    
    // Custom footer component
    CustomFooter: () => 
      import('./components/custom/CustomFooter').then(m => m.CustomFooter),
    
    // Brand logo component
    BrandLogo: () => 
      import('./components/custom/BrandLogo').then(m => m.BrandLogo)
  }
}
```

## Plugin Integration

### Declaring Plugin Dependencies

```typescript
plugins: ['ai', 'analytics', 'payments']
```

**Purpose:**
- Documents which plugins the theme uses
- Enables validation during build
- Helps with dependency tracking

**Example with AI Plugin:**

```typescript
export const myThemeConfig: ThemeConfig = {
  name: 'ai-powered-theme',
  displayName: 'AI Powered Theme',
  version: '1.0.0',
  
  // Declare AI plugin dependency
  plugins: ['ai'],
  
  // AI plugin entities will be available
  // in dashboard navigation, etc.
}
```

## App Configuration Overrides

### app.config.ts

**Location:** `contents/themes/[theme-name]/app.config.ts`

**Purpose:** Override core application configuration for this theme.

```typescript
export const APP_CONFIG_OVERRIDES = {
  // Application Metadata
  app: {
    name: 'My Custom SaaS',
    version: '2.0.0',
    description: 'Custom SaaS application',
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
      'validation',
      'tasks'
    ],
  },
  
  // API Configuration
  api: {
    cors: {
      allowedOrigins: {
        development: [
          'http://localhost:3000',
          'http://localhost:5173'
        ],
        production: [
          'https://myapp.com'
        ],
      },
    },
    rateLimit: {
      enabled: true,
      maxRequests: 100,
      windowMs: 60000
    }
  },
  
  // Features
  features: {
    enableBlog: true,
    enableDocs: true,
    enableApiKeys: true,
    enableNotifications: false
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

### Merge Behavior

App config overrides are **shallow merged** with core config:

```typescript
// Core config
const coreConfig = {
  app: { name: 'NextSpark', version: '1.0.0' },
  features: { enableBlog: false }
}

// Theme override
const themeConfig = {
  app: { name: 'My SaaS' },
  features: { enableDocs: true }
}

// Result
const finalConfig = {
  app: { name: 'My SaaS' },  // name overridden, version removed
  features: { enableDocs: true }  // enableBlog removed
}
```

**Important:** Only provide properties you want to completely replace.

## Permissions Configuration

### permissions.config.ts

**Location:** `contents/themes/[theme-name]/config/permissions.config.ts`

**Purpose:** Single source of truth for all permissions and custom roles.

```typescript
import type { ThemePermissionsConfig } from '@/core/lib/permissions/types'

export const PERMISSIONS_CONFIG_OVERRIDES: ThemePermissionsConfig = {
  // ==========================================
  // CUSTOM ROLES
  // ==========================================
  roles: {
    additionalRoles: ['editor'] as const,
    hierarchy: {
      editor: 5,  // Between viewer (1) and member (10)
    },
    displayNames: {
      editor: 'common.teamRoles.editor',
    },
    descriptions: {
      editor: 'Can view team content with limited editing',
    },
  },

  // ==========================================
  // TEAM PERMISSIONS
  // ==========================================
  teams: [
    { action: 'team.view', label: 'View Team', roles: ['owner', 'admin', 'member', 'viewer', 'editor'] },
    { action: 'team.edit', label: 'Edit Team', roles: ['owner', 'admin'] },
    { action: 'team.members.invite', label: 'Invite Members', roles: ['owner', 'admin'] },
    { action: 'team.delete', label: 'Delete Team', roles: ['owner'], dangerous: true },
  ],

  // ==========================================
  // ENTITY PERMISSIONS
  // ==========================================
  entities: {
    customers: [
      { action: 'create', label: 'Create customers', roles: ['owner', 'admin'] },
      { action: 'read', label: 'View customers', roles: ['owner', 'admin', 'member', 'editor'] },
      { action: 'list', label: 'List customers', roles: ['owner', 'admin', 'member', 'editor'] },
      { action: 'update', label: 'Edit customers', roles: ['owner', 'admin'] },
      { action: 'delete', label: 'Delete customers', roles: ['owner'], dangerous: true },
    ],
    tasks: [
      { action: 'create', label: 'Create tasks', roles: ['owner', 'admin', 'member'] },
      { action: 'read', label: 'View tasks', roles: ['owner', 'admin', 'member'] },
      { action: 'update', label: 'Edit tasks', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', label: 'Delete tasks', roles: ['owner', 'admin'], dangerous: true },
    ],
  },

  // ==========================================
  // FEATURE PERMISSIONS
  // ==========================================
  features: [
    {
      action: 'page-builder.access',
      label: 'Access Page Builder',
      description: 'Can use the visual page builder',
      category: 'Page Builder',
      roles: ['owner', 'admin', 'editor', 'member'],
    },
    {
      action: 'media.upload',
      label: 'Upload Media',
      category: 'Media',
      roles: ['owner', 'admin', 'editor', 'member'],
    },
  ],

  // ==========================================
  // UI SECTIONS
  // ==========================================
  uiSections: [
    {
      id: 'teams',
      label: 'Teams',
      description: 'Team management permissions',
      categories: ['Teams'],
    },
  ],
}
```

### Key Concepts

| Section | Purpose |
|---------|---------|
| `roles` | Define custom roles beyond core (owner, admin, member, viewer) |
| `teams` | Team-level permissions (team.view, team.edit, etc.) |
| `entities` | Entity CRUD permissions (customers.create, etc.) |
| `features` | Feature-specific permissions (page-builder.access, etc.) |
| `uiSections` | Group permissions in Admin Panel UI |

### Checking Permissions

```typescript
import { PermissionService } from '@/core/lib/services/permission.service'

// Unified API for all permission types
PermissionService.canDoAction('admin', 'team.edit')           // Team permission
PermissionService.canDoAction('admin', 'customers.create')    // Entity permission
PermissionService.canDoAction('editor', 'page-builder.access') // Feature permission

// Owner has ALL permissions
PermissionService.canDoAction('owner', 'anything') // Always true
```

**See:** [Permissions Configuration](../06-authentication/10-permissions-config.md) for detailed documentation.

---

## Development Configuration

### dev.config.ts

**Location:** `contents/themes/[theme-name]/config/dev.config.ts`

**Purpose:** Contains development-only settings that should never affect production. This file is specifically designed to keep development tools and test configurations separate from production configuration.

```typescript
import type { DevConfig } from '@/core/lib/config/types'

export const DEV_CONFIG_OVERRIDES: DevConfig = {
  // =============================================================================
  // DEV KEYRING (Development/QA Only)
  // =============================================================================
  /**
   * DevKeyring - Quick login for testing
   * Users defined here will appear in the DevKeyring dropdown on the login page.
   * Only rendered in non-production environments.
   */
  devKeyring: {
    enabled: true,
    users: [
      {
        id: 'test-user',
        email: 'test@example.com',
        name: 'Test User',
        password: 'Test1234',
        teamRoles: 'My Team (owner)',
      },
      {
        id: 'admin',
        email: 'admin@example.com',
        name: 'Admin User',
        password: 'Test1234',
        teamRoles: 'My Team (admin)',
      },
    ],
  },
}

export default DEV_CONFIG_OVERRIDES
```

### DevConfig Interface

```typescript
interface DevConfig {
  /** DevKeyring configuration for quick login in development */
  devKeyring?: DevKeyringConfig

  // Future extensions:
  // debugMode?: boolean
  // mockData?: boolean
  // logLevel?: 'debug' | 'info' | 'warn' | 'error'
}

interface DevKeyringConfig {
  /** Enable/disable the DevKeyring feature */
  enabled: boolean

  /** List of test users available for quick login */
  users: DevKeyringUser[]
}

interface DevKeyringUser {
  /** Unique identifier for the user */
  id: string

  /** User's email address */
  email: string

  /** User's display name */
  name: string

  /** User's password (for auto-fill) */
  password: string

  /** Team roles description (e.g., "TeamA (admin), TeamB (member)") */
  teamRoles?: string
}
```

### Accessing Dev Config

```typescript
import { DEV_CONFIG } from '@/core/lib/config/config-sync'

// Check if DevKeyring is enabled
if (DEV_CONFIG?.devKeyring?.enabled) {
  // Access DevKeyring users
  const users = DEV_CONFIG.devKeyring.users
}
```

### Why Separate from app.config.ts?

1. **Security**: Development credentials are clearly marked as dev-only
2. **Clarity**: Production config (`app.config.ts`) contains only production settings
3. **Organization**: Config files have specific, clear purposes
4. **Future-proof**: Space for additional dev-only settings (debug mode, mock data, etc.)

### Migration from app.config.ts

If you have `devKeyring` in your `app.config.ts`, move it to `dev.config.ts`:

**Before (app.config.ts):**
```typescript
export const APP_CONFIG_OVERRIDES = {
  app: { name: 'My App' },
  devKeyring: {  // ❌ Dev config mixed with production
    enabled: true,
    users: [...]
  }
}
```

**After:**

`app.config.ts`:
```typescript
export const APP_CONFIG_OVERRIDES = {
  app: { name: 'My App' }
  // ✅ No dev-only settings
}
```

`dev.config.ts`:
```typescript
export const DEV_CONFIG_OVERRIDES: DevConfig = {
  devKeyring: {  // ✅ Dev config in dedicated file
    enabled: true,
    users: [...]
  }
}
```

---

## Dashboard Configuration

### dashboard.config.ts

**Location:** `contents/themes/[theme-name]/config/dashboard.config.ts`

**Purpose:** Customize dashboard navigation and layout.

```typescript
export const DASHBOARD_CONFIG_OVERRIDES = {
  // Navigation Structure
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
  
  // Layout Configuration
  layout: {
    sidebarCollapsible: true,
    sidebarDefaultState: 'expanded',
    showUserMenu: true,
    showNotifications: true,
    showSearch: true
  },
  
  // Features
  features: {
    showQuickActions: true,
    enableNotifications: true,
    enableCommandPalette: true,
    showRecentItems: true
  },
  
  // Widgets
  widgets: {
    dashboard: [
      'stats-overview',
      'recent-activity',
      'quick-actions'
    ]
  }
}
```

## Complete Configuration Example

### Full theme.config.ts

```typescript
import type { ThemeConfig } from '@/core/types/theme'

export const myThemeConfig: ThemeConfig = {
  // Metadata
  name: 'professional-blue',
  displayName: 'Professional Blue Theme',
  version: '1.0.0',
  description: 'A professional theme with blue accents',
  author: 'Your Company',
  
  // Plugin Dependencies
  plugins: ['ai', 'analytics'],
  
  // Styles
  styles: {
    globals: 'globals.css',
    components: 'components.css',
    variables: {
      '--spacing-lg': '1rem',
      '--spacing-xl': '1.5rem'
    }
  },
  
  // Theme Configuration
  config: {
    // Colors
    colors: {
      primary: 'oklch(0.55 0.22 250)',      // Professional blue
      secondary: 'oklch(0.85 0.05 250)',    // Light blue
      accent: 'oklch(0.65 0.18 280)',       // Purple accent
      background: 'oklch(0.98 0 0)',        // Off-white
      foreground: 'oklch(0.20 0 0)',        // Dark gray
      
      // ... other colors
    },
    
    // Typography
    fonts: {
      sans: 'Inter, system-ui, sans-serif',
      serif: 'Georgia, serif',
      mono: 'Fira Code, monospace'
    },
    
    // Spacing
    spacing: {
      radius: '0.5rem'
    }
  },
  
  // Component Overrides
  components: {
    overrides: {
      '@/core/components/ui/button': () =>
        import('./components/overrides/Button').then(m => m.Button)
    },
    custom: {
      BrandLogo: () =>
        import('./components/custom/BrandLogo').then(m => m.BrandLogo)
    }
  }
}

export default myThemeConfig
```

## Validation

The build system validates theme configuration:

**Checked:**
- Required fields present
- Valid semantic version
- CSS files exist
- Plugin dependencies available
- No circular dependencies

**Errors:**

```bash
# Missing required field
Error: Theme 'my-theme' missing required field: name

# Invalid version
Error: Theme version must be valid semver: 1.0

# CSS file not found
Error: Theme CSS file not found: globals.css

# Plugin not available
Error: Theme requires unavailable plugin: 'unknown'
```

## TypeScript Support

Full type checking for theme configuration:

```typescript
import type { ThemeConfig } from '@/core/types/theme'

// ✅ Type-safe configuration
export const config: ThemeConfig = {
  name: 'my-theme',
  displayName: 'My Theme',
  version: '1.0.0',
  
  // Autocomplete available
  styles: {
    globals: 'globals.css'
  }
}

// ❌ Type error - missing required fields
export const badConfig: ThemeConfig = {
  displayName: 'My Theme'
  // Error: Property 'name' is missing
}
```

## Next Steps

1. **[CSS Variables and Styling](./04-css-variables-and-styling.md)** - Define theme styles
2. **[Component Overrides](./05-component-overrides.md)** - Customize components
3. **[Asset Management](./06-asset-management.md)** - Add theme assets
4. **[Creating Custom Themes](./09-creating-custom-themes.md)** - Complete theme guide

---

> 💡 **Tip**: Start with minimal configuration and add features incrementally. The default theme configuration serves as an excellent reference.
