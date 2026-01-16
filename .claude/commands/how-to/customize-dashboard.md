# /how-to:customize-dashboard

Interactive guide to customize the dashboard layout and navigation in NextSpark.

---

## Syntax

```
/how-to:customize-dashboard
```

---

## Behavior

Guides the user through customizing dashboard layout, sidebar navigation, menu items, and widgets.

---

## Tutorial Structure

```
STEPS OVERVIEW (4 steps)

Step 1: Understanding Dashboard Structure
        └── Layout components and config

Step 2: Customize Sidebar Navigation
        └── Add/modify menu items

Step 3: Customize Dashboard Widgets
        └── Add custom widgets and cards

Step 4: Theme the Dashboard
        └── Colors, spacing, branding
```

---

## Step 1: Understanding Dashboard Structure

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: CUSTOMIZE DASHBOARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 4: Understanding Dashboard Structure

The dashboard is composed of configurable components:

┌─────────────────────────────────────────────┐
│  HEADER                                     │
│  ─────────────────────────────────────────  │
│  Logo │ Search │ Notifications │ User Menu  │
├─────────┬───────────────────────────────────┤
│         │                                   │
│ SIDEBAR │  MAIN CONTENT                     │
│         │                                   │
│ • Home  │  ┌─────────┐  ┌─────────┐        │
│ • Entit │  │ Widget  │  │ Widget  │        │
│ • Setti │  └─────────┘  └─────────┘        │
│         │                                   │
│         │  ┌─────────────────────┐         │
│         │  │   Content Area      │         │
│         │  └─────────────────────┘         │
│         │                                   │
└─────────┴───────────────────────────────────┘

```

**📂 Dashboard Configuration Files:**

```
contents/themes/your-theme/config/
├── dashboard.config.ts    # Dashboard layout
├── navigation.config.ts   # Sidebar menus
└── widgets.config.ts      # Dashboard widgets
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 2 (Navigation)
[2] Show me the default dashboard config
[3] How does the layout system work?
```

---

## Step 2: Customize Sidebar Navigation

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 4: Customize Sidebar Navigation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Configure sidebar menu items:
```

**📋 navigation.config.ts Example:**

```typescript
// contents/themes/your-theme/config/navigation.config.ts
import type { NavigationConfig } from '@/core/types/navigation'
import {
  Home,
  Package,
  Users,
  FileText,
  Settings,
  BarChart3,
  CreditCard,
} from 'lucide-react'

export const navigationConfig: NavigationConfig = {
  // Main sidebar menu
  sidebar: [
    // Static item
    {
      label: 'dashboard.sidebar.home',  // i18n key
      href: '/dashboard',
      icon: Home,
    },

    // Section header
    {
      label: 'dashboard.sidebar.data',
      type: 'section',
    },

    // Entity items (auto-generated from entity config)
    {
      label: 'entities.products.namePlural',
      href: '/dashboard/products',
      icon: Package,
      entity: 'products',  // Links to entity
      permission: 'products.read',  // Required permission
    },
    {
      label: 'entities.customers.namePlural',
      href: '/dashboard/customers',
      icon: Users,
      entity: 'customers',
      permission: 'customers.read',
    },
    {
      label: 'entities.invoices.namePlural',
      href: '/dashboard/invoices',
      icon: FileText,
      entity: 'invoices',
      permission: 'invoices.read',
      badge: 'new',  // Show badge
    },

    // Section header
    {
      label: 'dashboard.sidebar.insights',
      type: 'section',
    },

    // Feature items
    {
      label: 'dashboard.sidebar.analytics',
      href: '/dashboard/analytics',
      icon: BarChart3,
      feature: 'advanced_analytics',  // Requires plan feature
    },

    // Nested menu (submenu)
    {
      label: 'dashboard.sidebar.settings',
      icon: Settings,
      children: [
        {
          label: 'settings.sections.profile',
          href: '/dashboard/settings/profile',
        },
        {
          label: 'settings.sections.billing',
          href: '/dashboard/settings/billing',
          icon: CreditCard,
          permission: 'team.billing.manage',
        },
        {
          label: 'settings.sections.team',
          href: '/dashboard/settings/team',
          permission: 'team.members.invite',
        },
      ],
    },
  ],

  // Quick actions in header
  quickActions: [
    {
      label: 'common.buttons.create',
      icon: Plus,
      actions: [
        { label: 'entities.products.actions.create', href: '/dashboard/products/new' },
        { label: 'entities.customers.actions.create', href: '/dashboard/customers/new' },
      ],
    },
  ],
}
```

**📋 Menu Item Options:**

| Property | Description |
|----------|-------------|
| `label` | i18n key for display text |
| `href` | Navigation URL |
| `icon` | Lucide icon component |
| `type` | 'item' (default), 'section', 'divider' |
| `permission` | Required permission to show |
| `feature` | Required plan feature to show |
| `badge` | Badge text ('new', count, etc.) |
| `children` | Submenu items |
| `entity` | Link to entity (auto-generates CRUD routes) |

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 3 (Widgets)
[2] How do I add permission-based items?
[3] How do I create nested menus?
```

---

## Step 3: Customize Dashboard Widgets

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 4: Customize Dashboard Widgets
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Configure the main dashboard home page:
```

**📋 widgets.config.ts Example:**

```typescript
// contents/themes/your-theme/config/widgets.config.ts
import type { WidgetsConfig } from '@/core/types/widgets'

export const widgetsConfig: WidgetsConfig = {
  // Dashboard home layout
  home: {
    // Grid layout for widgets
    layout: [
      // Stats row (4 columns)
      { id: 'stats', cols: 4, rows: 1 },

      // Charts row (2 columns each)
      { id: 'revenue-chart', cols: 2, rows: 2 },
      { id: 'orders-chart', cols: 2, rows: 2 },

      // Recent activity (full width)
      { id: 'recent-activity', cols: 4, rows: 2 },
    ],

    // Widget definitions
    widgets: {
      'stats': {
        type: 'stats-grid',
        title: 'dashboard.widgets.overview',
        stats: [
          {
            id: 'total-revenue',
            label: 'dashboard.stats.totalRevenue',
            query: 'analytics.totalRevenue',
            format: 'currency',
            icon: 'DollarSign',
            trend: true,
          },
          {
            id: 'total-orders',
            label: 'dashboard.stats.totalOrders',
            query: 'analytics.totalOrders',
            format: 'number',
            icon: 'ShoppingCart',
            trend: true,
          },
          {
            id: 'total-customers',
            label: 'dashboard.stats.totalCustomers',
            query: 'analytics.totalCustomers',
            format: 'number',
            icon: 'Users',
          },
          {
            id: 'conversion-rate',
            label: 'dashboard.stats.conversionRate',
            query: 'analytics.conversionRate',
            format: 'percent',
            icon: 'TrendingUp',
            trend: true,
          },
        ],
      },

      'revenue-chart': {
        type: 'chart',
        title: 'dashboard.widgets.revenueChart',
        chart: {
          type: 'line',
          query: 'analytics.revenueByDay',
          xAxis: 'date',
          yAxis: 'revenue',
          period: 'last30days',
        },
      },

      'orders-chart': {
        type: 'chart',
        title: 'dashboard.widgets.ordersChart',
        chart: {
          type: 'bar',
          query: 'analytics.ordersByDay',
          xAxis: 'date',
          yAxis: 'count',
        },
      },

      'recent-activity': {
        type: 'activity-feed',
        title: 'dashboard.widgets.recentActivity',
        limit: 10,
        entities: ['products', 'customers', 'invoices'],
      },
    },
  },

  // Entity-specific dashboard layouts
  entities: {
    products: {
      widgets: {
        'top-products': {
          type: 'table',
          title: 'Top Selling Products',
          query: 'products.topSelling',
          limit: 5,
        },
      },
    },
  },
}
```

**📋 Widget Types:**

- `stats-grid` - Key metrics cards
- `chart` - Line, bar, pie charts
- `table` - Data table widget
- `activity-feed` - Recent activity log
- `calendar` - Calendar view
- `custom` - Custom React component

**📋 Create Custom Widget:**

```typescript
// contents/themes/your-theme/components/widgets/MyCustomWidget.tsx
'use client'

import { Card, CardHeader, CardContent } from '@/core/components/ui/card'
import type { WidgetProps } from '@/core/types/widgets'

export function MyCustomWidget({ config }: WidgetProps) {
  return (
    <Card data-cy="widget-my-custom">
      <CardHeader>
        <h3>{config.title}</h3>
      </CardHeader>
      <CardContent>
        {/* Your custom content */}
      </CardContent>
    </Card>
  )
}
```

**📋 Register Custom Widget:**

```typescript
widgets: {
  'my-custom': {
    type: 'custom',
    component: 'MyCustomWidget',
    title: 'My Custom Widget',
  },
}
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 4 (Theme)
[2] How do I create chart widgets?
[3] Show me activity feed setup
```

---

## Step 4: Theme the Dashboard

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 4: Theme the Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Configure dashboard appearance:
```

**📋 dashboard.config.ts Example:**

```typescript
// contents/themes/your-theme/config/dashboard.config.ts
import type { DashboardConfig } from '@/core/types/dashboard'

export const dashboardConfig: DashboardConfig = {
  // Layout settings
  layout: {
    // Sidebar position
    sidebarPosition: 'left',  // 'left' | 'right'

    // Sidebar style
    sidebarStyle: 'fixed',  // 'fixed' | 'floating' | 'collapsible'

    // Default sidebar state
    sidebarDefaultOpen: true,

    // Header style
    headerStyle: 'fixed',  // 'fixed' | 'sticky' | 'static'

    // Content max width
    contentMaxWidth: '1400px',  // or 'full'
  },

  // Branding
  branding: {
    // Logo for sidebar
    logo: '/images/logo.svg',
    logoCollapsed: '/images/logo-icon.svg',

    // Favicon
    favicon: '/favicon.ico',

    // App name in header
    appName: 'My App',
  },

  // Header configuration
  header: {
    // Show search bar
    showSearch: true,
    searchPlaceholder: 'dashboard.search.placeholder',

    // Show notifications
    showNotifications: true,

    // Show breadcrumbs
    showBreadcrumbs: true,

    // Custom header actions
    actions: [
      {
        icon: 'HelpCircle',
        label: 'Help',
        href: '/docs',
      },
    ],
  },

  // Footer configuration
  footer: {
    show: true,
    text: '© 2024 My Company',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },

  // User menu configuration
  userMenu: {
    showAvatar: true,
    showName: true,
    showRole: true,
    items: [
      { label: 'Profile', href: '/dashboard/profile', icon: 'User' },
      { label: 'Settings', href: '/dashboard/settings', icon: 'Settings' },
      { type: 'divider' },
      { label: 'Sign Out', action: 'signout', icon: 'LogOut' },
    ],
  },
}
```

**📋 Sidebar Styles:**

- `fixed` - Always visible, fixed position
- `floating` - Overlay on mobile
- `collapsible` - Can collapse to icons only

**📋 Dashboard Colors:**

Configure in your theme's globals.css:

```css
/* contents/themes/your-theme/styles/globals.css */
:root {
  /* Dashboard-specific colors */
  --dashboard-sidebar-bg: var(--background);
  --dashboard-sidebar-border: var(--border);
  --dashboard-header-bg: var(--background);
  --dashboard-content-bg: var(--muted);
}
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

You've configured:
• Sidebar navigation with permissions
• Dashboard widgets and layout
• Branding and appearance
• Header and user menu

📚 Related tutorials:
   • /how-to:customize-theme - Design system customization
   • /how-to:customize-app - App-level settings

🔙 Back to menu: /how-to:start
```

---

## Related Commands

| Command | Action |
|---------|--------|
| `/how-to:customize-theme` | Theme customization |
| `/how-to:customize-app` | App settings |
