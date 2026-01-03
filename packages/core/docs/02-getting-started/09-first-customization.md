# First Customization

## Introduction

Hands-on tutorial to make your first customizations. You'll learn how to customize theme styles, create pages, work with entities, and understand the project structure.

**Prerequisites:**
- ✅ Project installed and running (`pnpm dev`)
- ✅ Server accessible at http://localhost:5173
- ✅ Basic understanding of React and TypeScript

---

## Quick Project Tour

**Key directories:**
```text
nextspark/
├── app/                    # Next.js App Router
│   ├── (public)/          # Public pages (no auth)
│   ├── (protected)/       # Protected pages (requires auth)
│   └── api/               # API routes
├── core/                   # Core application code
│   ├── components/        # Reusable components
│   ├── lib/               # Utilities, registries
│   └── docs/              # Documentation (you're here!)
├── contents/              # Your customization layer
│   ├── themes/           # Theme customizations
│   └── plugins/          # Plugin integrations
└── scripts/              # Build scripts
```

**Customization philosophy:**
- ✅ Edit files in `contents/` directory
- ✅ Use theme variables for styling
- ✅ Compose components upward
- ❌ Never edit auto-generated files

---

## Customization 1: Theme Colors

**What you'll do:** Change primary brand color

### Step 1: Locate Theme Styles

```bash
# Navigate to theme styles
cd contents/themes/default/styles/
```

**Files:**
- `globals.css` - CSS variables, base styles
- `components.css` - Component-specific styles
- `utilities.css` - Utility classes

### Step 2: Edit CSS Variables

**Open:** `contents/themes/default/styles/globals.css`

**Find the primary color:**
```css
@layer base {
  :root {
    --primary: 221.2 83.2% 53.3%;     /* Default blue */
    --primary-foreground: 210 40% 98%;
  }
}
```

**Change to brand color (example: purple):**
```css
@layer base {
  :root {
    --primary: 271 91% 65%;           /* Purple */
    --primary-foreground: 210 40% 98%;
  }
}
```

**HSL values explained:**
- `271` - Hue (0-360)
- `91%` - Saturation
- `65%` - Lightness

**Tip:** Use [HSL Color Picker](https://www.w3schools.com/colors/colors_hsl.asp)

### Step 3: See Changes

**Watch mode auto-rebuilds:**
```text
[THEME] ✓ Change detected in globals.css
[THEME] ✓ Rebuilding theme... (0.8s)
[THEME] ✓ Theme CSS updated
```

**Browser auto-reloads** - No manual refresh needed!

### Step 4: Verify

Visit http://localhost:5173 and check:
- ✅ Buttons now purple
- ✅ Links now purple
- ✅ Primary UI elements updated

---

## Customization 2: Creating a New Page

**What you'll do:** Add a custom "About" page

### Step 1: Choose Location

**Two options:**

**Public page (no auth required):**
```text
app/(public)/about/page.tsx
```

**Protected page (auth required):**
```text
app/(protected)/about/page.tsx
```

We'll create a public page.

### Step 2: Create Page File

**Create:** `app/(public)/about/page.tsx`

```typescript
import type { Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/core/components/ui/card'

export const metadata: Metadata = {
  title: 'About',
  description: 'Learn more about our platform',
}

export default function AboutPage() {
  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>About Our Platform</CardTitle>
          <CardDescription>
            Building amazing SaaS applications made easy
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            NextSpark provides a solid foundation for building
            modern web applications with Next.js 15, TypeScript, and PostgreSQL.
          </p>

          <div className="space-y-2">
            <h3 className="font-semibold">Key Features:</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Complete authentication system</li>
              <li>Dynamic entity registry</li>
              <li>Theme customization</li>
              <li>Plugin architecture</li>
              <li>PostgreSQL with RLS</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Step 3: Verify Page

**Visit:** http://localhost:5173/about

**You should see:**
- ✅ Page renders correctly
- ✅ Metadata in browser tab
- ✅ Card component styled

### Step 4: Add Navigation Link

**Edit:** `contents/themes/default/config/app.config.ts`

**Find navigation config:**
```typescript
export const appConfig = {
  name: 'NextSpark',
  navigation: {
    main: [
      { label: 'Home', href: '/' },
      { label: 'Features', href: '/features' },
      // Add your link here:
      { label: 'About', href: '/about' },
    ],
  },
}
```

**Server restart required:**
```bash
# Ctrl+C to stop
pnpm dev
```

**Verify navigation:**
- Visit http://localhost:5173
- Check navigation bar
- Click "About" link

---

## Customization 3: Understanding Entities

**What are entities?**
- Database-backed resources (users, tasks, products, etc.)
- Auto-generate CRUD API endpoints
- Dynamic navigation and UI

**Example entity location:**
```text
contents/themes/default/entities/tasks/
├── tasks.config.ts       # Entity configuration
├── migrations/           # Database migrations
│   └── 001_create_tasks.sql
└── components/           # Entity-specific components
    └── TaskList.tsx
```

### Step 1: Explore Task Entity

**Open:** `contents/themes/default/entities/tasks/tasks.config.ts`

```typescript
export const tasksEntityConfig = {
  // Basic info
  name: 'tasks',
  label: 'Tasks',
  labelPlural: 'Tasks',

  // Database
  tableName: 'tasks',
  primaryKey: 'id',

  // Fields
  fields: [
    {
      name: 'title',
      type: 'string',
      label: 'Title',
      required: true,
      maxLength: 200,
    },
    {
      name: 'completed',
      type: 'boolean',
      label: 'Completed',
      defaultValue: false,
    },
  ],

  // Features
  features: {
    list: true,      // List page
    create: true,    // Create form
    read: true,      // Detail page
    update: true,    // Edit form
    delete: true,    // Delete action
  },
}
```

### Step 2: Access Entity via API

**Entities auto-generate API endpoints:**

```bash
# List all tasks (protected)
GET /api/v1/tasks

# Create task (protected)
POST /api/v1/tasks

# Get single task (protected)
GET /api/v1/tasks/:id

# Update task (protected)
PATCH /api/v1/tasks/:id

# Delete task (protected)
DELETE /api/v1/tasks/:id
```

### Step 3: Test Entity Endpoint

**Using browser/Postman:**

1. Log in to http://localhost:5173/sign-in
2. Open browser DevTools → Application → Cookies
3. Copy session cookie value
4. Make API request:

```bash
curl http://localhost:5173/api/v1/tasks \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN"
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Sample task",
      "completed": false,
      "userId": "uuid",
      "createdAt": "2025-11-19T...",
      "updatedAt": "2025-11-19T..."
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 50
  }
}
```

### Step 4: Use Entity in Component

**Server Component (recommended):**

```typescript
// app/(protected)/dashboard/page.tsx
import { EntityList } from '@/core/components/entities/EntityList'
import { ENTITY_REGISTRY } from '@/core/lib/registries/entity-registry'

export default async function DashboardPage() {
  const taskConfig = ENTITY_REGISTRY.tasks

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">My Tasks</h1>
      <EntityList entityName="tasks" config={taskConfig} />
    </div>
  )
}
```

**Client Component with TanStack Query:**

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'

function TaskList() {
  const { data, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const res = await fetch('/api/v1/tasks')
      if (!res.ok) throw new Error('Failed to fetch tasks')
      return res.json()
    },
  })

  if (isLoading) return <div>Loading tasks...</div>

  return (
    <ul>
      {data?.data?.map((task: any) => (
        <li key={task.id}>{task.title}</li>
      ))}
    </ul>
  )
}
```

---

## Customization 4: Theme Configuration

**What you'll do:** Customize theme metadata

### Step 1: Open Theme Config

**File:** `contents/themes/default/config/theme.config.ts`

```typescript
export const themeConfig = {
  // Theme metadata
  name: 'default',
  displayName: 'Default Theme',
  description: 'Clean and modern default theme',
  version: '1.0.0',

  // Author info
  author: {
    name: 'Your Name',
    url: 'https://yourwebsite.com',
  },

  // Theme features
  features: {
    darkMode: true,
    rtl: false,
    multiLanguage: true,
  },

  // Color scheme
  colors: {
    primary: 'blue',
    secondary: 'gray',
  },
}
```

### Step 2: Customize Metadata

**Change author info:**
```typescript
author: {
  name: 'Your Company',
  url: 'https://yourcompany.com',
},
```

**Enable RTL (if needed):**
```typescript
features: {
  darkMode: true,
  rtl: true,           // Enable right-to-left
  multiLanguage: true,
},
```

### Step 3: Rebuild and Restart

```bash
# Ctrl+C to stop server
pnpm registry:build   # Rebuild registries
pnpm dev              # Restart server
```

---

## Customization 5: App Configuration

**What you'll do:** Customize app name and settings

### Step 1: Open App Config

**File:** `contents/themes/default/config/app.config.ts`

```typescript
export const appConfig = {
  // App identity
  name: 'NextSpark',
  description: 'Modern SaaS application',
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173',

  // Navigation
  navigation: {
    main: [
      { label: 'Home', href: '/' },
      { label: 'Features', href: '/features' },
      { label: 'Pricing', href: '/pricing' },
    ],
    footer: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },

  // Settings
  settings: {
    itemsPerPage: 50,
    maxUploadSize: 5242880, // 5MB
    sessionTimeout: 3600000, // 1 hour
  },
}
```

### Step 2: Customize App Name

```typescript
name: 'My Awesome SaaS',
description: 'Build amazing things',
```

### Step 3: Add Footer Links

```typescript
footer: [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Contact', href: '/contact' },
  { label: 'Documentation', href: '/docs' },
],
```

### Step 4: Restart Server

```bash
# Registry config changes require restart
# Ctrl+C to stop
pnpm dev
```

---

## Customization 6: Component Styling

**What you'll do:** Customize a component's appearance

### Step 1: Choose Component Approach

**✅ Recommended: Wrap shadcn/ui components**
```typescript
// core/components/custom/BrandButton.tsx
import { Button } from '@/core/components/ui/button'
import { cn } from '@/core/lib/utils'

export function BrandButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(
        'rounded-full',        // Custom: fully rounded
        'shadow-lg',           // Custom: larger shadow
        'hover:scale-105',     // Custom: scale on hover
        'transition-transform', // Custom: smooth animation
        className
      )}
      {...props}
    />
  )
}
```

**Usage:**
```typescript
import { BrandButton } from '@/core/components/custom/BrandButton'

export default function Page() {
  return (
    <BrandButton>Click Me</BrandButton>
  )
}
```

### Step 2: Use Theme Variables

```typescript
// Always use theme variables
className="bg-primary text-primary-foreground"  // ✅ Good
className="bg-blue-500 text-white"              // ❌ Bad (hardcoded)
```

**Available variables:**
- `primary`, `primary-foreground`
- `secondary`, `secondary-foreground`
- `accent`, `accent-foreground`
- `destructive`, `destructive-foreground`
- `muted`, `muted-foreground`
- `card`, `card-foreground`
- `popover`, `popover-foreground`
- `border`, `input`, `ring`

### Step 3: Responsive Design

```typescript
className={cn(
  'text-sm md:text-base lg:text-lg',    // Responsive text
  'p-4 md:p-6 lg:p-8',                  // Responsive padding
  'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3', // Responsive grid
)}
```

---

## Common Customization Patterns

### Pattern 1: Adding a Hero Section

```typescript
// app/(public)/page.tsx
export default function HomePage() {
  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="container py-20 text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-6">
          Build Your SaaS
          <span className="text-primary"> Faster</span>
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Complete authentication, database, and UI components ready to use.
        </p>
        <div className="flex gap-4 justify-center">
          <Button size="lg">Get Started</Button>
          <Button size="lg" variant="outline">Learn More</Button>
        </div>
      </section>
    </div>
  )
}
```

### Pattern 2: Custom Layout

```typescript
// app/(public)/layout.tsx
import { Header } from '@/core/components/layout/Header'
import { Footer } from '@/core/components/layout/Footer'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
```

### Pattern 3: Custom Hook

```typescript
// core/hooks/useCustomFeature.ts
'use client'

import { useState, useEffect } from 'react'

export function useCustomFeature() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Your custom logic
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Fetch logic
      setData(result)
    } finally {
      setLoading(false)
    }
  }

  return { data, loading, refetch: fetchData }
}
```

---

## Best Practices

**Styling:**
- ✅ Use theme variables only
- ✅ Compose shadcn/ui components
- ✅ Use `cn()` utility for class merging
- ❌ Never modify shadcn/ui components directly
- ❌ Never use hardcoded colors

**Components:**
- ✅ Server Components by default
- ✅ Client Components only when needed (`'use client'`)
- ✅ Proper TypeScript types
- ✅ Accessibility (ARIA labels, keyboard nav)
- ❌ No runtime dynamic imports for content

**File Organization:**
- ✅ Custom code in `contents/` or `core/components/custom/`
- ✅ Page routes in `app/` directory
- ✅ Reusable components in `core/components/`
- ❌ Never edit auto-generated files

**Performance:**
- ✅ Use React.memo for expensive components
- ✅ Lazy load heavy components
- ✅ Optimize images (next/image)
- ✅ Use TanStack Query for data fetching
- ❌ No useEffect for data fetching

---

## Troubleshooting Customizations

**Changes not appearing:**
1. Check if file watcher is running
2. Hard refresh browser (Cmd+Shift+R)
3. Restart dev server if registry changed
4. Clear .next cache: `rm -rf .next`

**Styling not working:**
1. Verify using theme variables
2. Check CSS file syntax
3. Rebuild theme: `pnpm theme:build`
4. Check browser DevTools for CSS errors

**Type errors:**
1. Run type check: `pnpm type-check`
2. Check import paths
3. Restart TypeScript server in IDE
4. Check `tsconfig.json` paths

**Build errors:**
1. Check registry build: `pnpm registry:build`
2. Verify entity config syntax
3. Check for circular imports
4. Clear build cache: `rm -rf .next`

**See:** [Troubleshooting Guide](./08-troubleshooting.md)

---

## Next Steps

Now that you've made your first customizations:

1. **Explore Entities**: [Core Concepts → Entity System](../01-fundamentals/01-core-concepts.md#entity-system)
2. **Advanced Theming**: [Customization → Theme System](../03-customization/02-theme-system.md)
3. **API Development**: [API Development → Creating Endpoints](../04-api-development/02-creating-endpoints.md)
4. **Deploy**: [Deployment Guide](./07-deployment.md)

---

## Summary

**What you learned:**
- ✅ Change theme colors via CSS variables
- ✅ Create new pages in App Router
- ✅ Understand entity system and API
- ✅ Customize theme and app config
- ✅ Style components properly
- ✅ Follow best practices

**Key takeaways:**
- Edit files in `contents/` directory
- Use theme variables for styling
- Compose shadcn/ui components upward
- Never edit auto-generated files
- Restart server for registry changes

**Continue reading** to learn advanced customizations!

---

## Customization 7: Plugin Integration

**What you'll do:** Activate and configure a plugin

### Step 1: List Available Plugins

**Check plugins directory:**
```bash
ls contents/plugins/
# Should see available plugins (e.g., ai/)
```

**View plugin structure:**
```text
contents/plugins/ai/
├── plugin.config.ts    # Plugin metadata
├── api/               # Plugin API routes
├── components/        # Plugin components
├── messages/          # Translations
└── .env.example       # Environment variables
```

### Step 2: Configure Plugin Environment

**Copy environment template:**
```bash
# For AI plugin
cp contents/plugins/ai/.env.example contents/plugins/ai/.env
```

**Edit `.env` file:**
```bash
# Add your API keys
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
AI_MODEL=gpt-4
```

### Step 3: Enable Plugin

**Edit:** `contents/plugins/ai/plugin.config.ts`

```typescript
export const aiPluginConfig = {
  id: 'ai',
  name: 'AI Assistant',
  enabled: true,  // ✅ Set to true
  version: '1.0.0',

  features: {
    textGeneration: true,
    imageAnalysis: true,
    codeCompletion: false  // Disable if not needed
  }
}
```

### Step 4: Use Plugin in Code

**Import plugin from registry:**
```typescript
import { PLUGIN_REGISTRY } from '@/core/lib/registries/plugin-registry'

// Access plugin
const aiPlugin = PLUGIN_REGISTRY.ai

// Use plugin API
const result = await aiPlugin.api.generateText({
  prompt: 'Write a product description',
  maxTokens: 100
})
```

**Use plugin component:**
```typescript
import { AIAssistant } from '@/contents/plugins/ai/components/AIAssistant'

export default function Page() {
  return <AIAssistant placeholder="Ask me anything..." />
}
```

### Step 5: Rebuild and Restart

```bash
pnpm registry:build
pnpm dev
```

---

## Customization 8: Advanced Theme Customization

**What you'll do:** Deep theme customization

### Step 1: Dark Mode Customization

**Edit:** `contents/themes/default/styles/globals.css`

```css
/* Customize dark mode colors */
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;

  --primary: 271 91% 65%;         /* Purple in dark mode */
  --primary-foreground: 210 40% 98%;

  --card: 222.2 84% 6%;
  --card-foreground: 210 40% 98%;

  /* Custom: Add purple accent */
  --accent: 280 90% 70%;
  --accent-foreground: 222.2 84% 4.9%;
}
```

### Step 2: Custom Fonts

**Add font files:**
```bash
# Add fonts to theme public directory
mkdir -p contents/themes/default/public/fonts/
# Copy .woff2 files there
```

**Update CSS:**
```css
@layer base {
  @font-face {
    font-family: 'CustomFont';
    src: url('/theme/fonts/CustomFont-Regular.woff2') format('woff2');
    font-weight: 400;
    font-style: normal;
  }

  @font-face {
    font-family: 'CustomFont';
    src: url('/theme/fonts/CustomFont-Bold.woff2') format('woff2');
    font-weight: 700;
    font-style: normal;
  }

  :root {
    --font-sans: 'CustomFont', system-ui, sans-serif;
  }
}
```

### Step 3: Custom Layouts

**Create layout override:**

**File:** `contents/themes/default/templates/layouts/CustomDashboard.tsx`

```typescript
import { ReactNode } from 'react'
import { Header } from '@/core/components/layout/Header'
import { Sidebar } from '@/core/components/layout/Sidebar'

export function CustomDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r">
        <Sidebar />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

**Use in page:**
```typescript
import { CustomDashboardLayout } from '@/contents/themes/default/templates/layouts/CustomDashboard'

export default function Page() {
  return (
    <CustomDashboardLayout>
      {/* Your content */}
    </CustomDashboardLayout>
  )
}
```

### Step 4: Component Overrides

**Create component override:**

**File:** `contents/themes/default/components/overrides/Button.tsx`

```typescript
import * as React from 'react'
import { Button as BaseButton } from '@/core/components/ui/button'
import { cn } from '@/core/lib/utils'

// Custom Button that extends base Button
export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof BaseButton>
>(({ className, ...props }, ref) => {
  return (
    <BaseButton
      ref={ref}
      className={cn(
        // Custom styles for all buttons in theme
        'transition-all duration-200',
        'hover:shadow-md',
        className
      )}
      {...props}
    />
  )
})

Button.displayName = 'Button'
```

---

## Customization 9: Custom API Routes

**What you'll do:** Create custom API endpoints

### Step 1: Create Custom Route

**File:** `app/api/custom/analytics/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/core/lib/auth'

export async function GET(request: NextRequest) {
  // 1. Authenticate request
  const session = await auth.api.getSession({
    headers: request.headers
  })

  if (!session?.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // 2. Your custom logic
  const analytics = {
    totalTasks: 50,
    completedTasks: 30,
    activeProjects: 5
  }

  // 3. Return response
  return NextResponse.json({
    data: analytics,
    meta: {
      userId: session.user.id,
      timestamp: new Date().toISOString()
    }
  })
}
```

### Step 2: Add Database Queries

```typescript
import { db } from '@/core/lib/db'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Execute database query
  const result = await db.query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'completed') as completed
    FROM tasks
    WHERE user_id = $1
  `, [session.user.id])

  return NextResponse.json({ data: result.rows[0] })
}
```

### Step 3: Handle POST Requests

```typescript
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse request body
  const body = await request.json()

  // Validate input
  if (!body.name) {
    return NextResponse.json(
      { error: 'Name is required' },
      { status: 400 }
    )
  }

  // Process and return
  const result = await processData(body)
  return NextResponse.json({ data: result }, { status: 201 })
}
```

### Step 4: Use Custom API in Frontend

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'

function AnalyticsDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: async () => {
      const res = await fetch('/api/custom/analytics')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    }
  })

  if (isLoading) return <div>Loading...</div>

  return (
    <div className="grid grid-cols-3 gap-4">
      <StatCard label="Total Tasks" value={data.data.totalTasks} />
      <StatCard label="Completed" value={data.data.completedTasks} />
      <StatCard label="Active Projects" value={data.data.activeProjects} />
    </div>
  )
}
```

---

## Customization 10: Internationalization

**What you'll do:** Add multi-language support

### Step 1: Add New Locale

**Create translation file:**

**File:** `contents/themes/default/messages/fr.json`

```json
{
  "common.welcome": "Bienvenue",
  "common.getStarted": "Commencer",
  "common.learnMore": "En savoir plus",

  "nav.home": "Accueil",
  "nav.features": "Fonctionnalités",
  "nav.pricing": "Tarifs",

  "auth.login": "Se connecter",
  "auth.signup": "S'inscrire",
  "auth.logout": "Se déconnecter"
}
```

### Step 2: Update Locale Config

**Edit:** `middleware.ts` or i18n config

```typescript
export const locales = ['en', 'es', 'fr']  // Add 'fr'
export const defaultLocale = 'en'
```

### Step 3: Use Translations in Components

```typescript
import { useTranslations } from 'next-intl'

export default function Page() {
  const t = useTranslations('common')

  return (
    <div>
      <h1>{t('welcome')}</h1>
      <button>{t('getStarted')}</button>
    </div>
  )
}
```

### Step 4: Add Entity Translations

**File:** `contents/themes/default/entities/tasks/messages/fr.json`

```json
{
  "tasks.name": "Tâches",
  "tasks.singular": "Tâche",
  "tasks.field.title": "Titre",
  "tasks.field.description": "Description",
  "tasks.field.status": "Statut",
  "tasks.actions.create": "Créer une tâche",
  "tasks.messages.create.success": "Tâche créée avec succès"
}
```

**Update entity config:**

```typescript
// tasks.config.ts
export const tasksEntityConfig = {
  // ...
  i18n: {
    fallbackLocale: 'en',
    loaders: {
      en: () => import('./messages/en.json'),
      es: () => import('./messages/es.json'),
      fr: () => import('./messages/fr.json')  // Add French
    }
  }
}
```

---

## Customization 11: Performance Optimization

**What you'll do:** Optimize app performance

### Step 1: Image Optimization

```typescript
import Image from 'next/image'

// ✅ Optimized
export function ProductCard({ product }: { product: Product }) {
  return (
    <div>
      <Image
        src={product.imageUrl}
        alt={product.name}
        width={400}
        height={300}
        priority={false}  // Only true for above-fold images
        quality={85}      // Balance quality vs size
        placeholder="blur"
        blurDataURL="/placeholder.jpg"
      />
    </div>
  )
}
```

### Step 2: Code Splitting

```typescript
import dynamic from 'next/dynamic'

// Lazy load heavy component
const HeavyChart = dynamic(() => import('./HeavyChart'), {
  loading: () => <Skeleton className="h-96" />,
  ssr: false  // Only load on client if needed
})

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <HeavyChart data={chartData} />
    </div>
  )
}
```

### Step 3: React Server Components Strategy

```typescript
// ✅ Server Component (default)
export default async function ProductsPage() {
  // Fetch data on server
  const products = await fetchProducts()

  return (
    <div>
      <ProductList products={products} />  {/* Pass data to client */}
    </div>
  )
}

// ✅ Client Component (only when needed)
'use client'

export function ProductList({ products }: { products: Product[] }) {
  const [filter, setFilter] = useState('')

  return (
    <div>
      <input value={filter} onChange={(e) => setFilter(e.target.value)} />
      {products.filter(p => p.name.includes(filter)).map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
```

### Step 4: Caching Strategy

```typescript
// Server Component with caching
export default async function Page() {
  // Revalidate every hour
  const data = await fetch('https://api.example.com/data', {
    next: { revalidate: 3600 }
  })

  return <div>{/* ... */}</div>
}

// Or use React cache
import { cache } from 'react'

const getProducts = cache(async () => {
  const res = await fetch('https://api.example.com/products')
  return res.json()
})
```

---

## Customization 12: Advanced Entity Features

**What you'll do:** Use advanced entity capabilities

### Step 1: Entity Relationships

```typescript
// projects.fields.ts
export const projectFields: FieldDefinition[] = [
  // ... other fields
  {
    name: 'client_id',
    type: 'relationship',
    relationshipType: 'manyToOne',
    targetEntity: 'clients',
    display: {
      label: 'Client',
      showInList: true,
      showInDetail: true,
      showInForm: true
    },
    api: {
      filterable: true,
      sortable: true
    }
  }
]
```

### Step 2: Custom Validation

```typescript
// projects.config.ts
export const projectEntityConfig = {
  // ...
  validation: {
    custom: {
      deadline: (value, context) => {
        if (new Date(value) < new Date()) {
          return 'Deadline must be in the future'
        }
        return true
      },
      budget: (value, context) => {
        if (value < 0) {
          return 'Budget must be positive'
        }
        if (value > 1000000) {
          return 'Budget exceeds maximum allowed (1M)'
        }
        return true
      }
    }
  }
}
```

### Step 3: Computed Fields

```typescript
{
  name: 'daysUntilDeadline',
  type: 'computed',
  compute: (record) => {
    if (!record.deadline) return null
    const diff = new Date(record.deadline) - new Date()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  },
  display: {
    label: 'Days Remaining',
    showInList: true,
    showInDetail: true,
    showInForm: false  // Computed fields aren't editable
  }
}
```

### Step 4: Lifecycle Hooks

```typescript
export const projectEntityConfig = {
  // ...
  hooks: {
    beforeCreate: async (data, context) => {
      // Add timestamps, generate slug, etc.
      return {
        ...data,
        slug: generateSlug(data.name),
        createdBy: context.user.id
      }
    },

    afterCreate: async (record, context) => {
      // Send notifications, create related records
      await sendNotification({
        userId: record.user_id,
        message: `Project "${record.name}" created`
      })

      // Create initial tasks
      await createDefaultTasks(record.id)
    },

    beforeUpdate: async (data, record, context) => {
      // Validate changes, audit log
      if (data.status === 'archived' && record.status !== 'completed') {
        throw new Error('Can only archive completed projects')
      }
      return data
    },

    afterDelete: async (record, context) => {
      // Cleanup related resources
      await deleteRelatedFiles(record.id)
      await deleteRelatedTasks(record.id)
    }
  }
}
```

---

## Customization 13: Deployment Customization

**What you'll do:** Customize for production

### Step 1: Environment-Specific Configs

```typescript
// theme.config.ts
const isProd = process.env.NODE_ENV === 'production'

export const themeConfig = {
  name: 'default',
  features: {
    analytics: isProd,           // Only in production
    debugMode: !isProd,          // Only in development
    mockData: !isProd,           // Use mock data in dev
    errorReporting: isProd       // Sentry/error tracking in prod
  }
}
```

### Step 2: Build Optimizations

**Next.js config optimizations:**

```javascript
// next.config.js
module.exports = {
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    minimumCacheTTL: 60 * 60 * 24 * 365  // 1 year
  },

  // Tree-shaking
  experimental: {
    optimizePackageImports: ['@/core/components/ui']
  },

  // Bundle analyzer (when needed)
  webpack: (config, { isServer }) => {
    if (process.env.ANALYZE) {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false
        })
      )
    }
    return config
  }
}
```

### Step 3: Production Checklist

**Before deploying:**

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Registry built (`pnpm registry:build`)
- [ ] Tests passing (`pnpm test`)
- [ ] Build successful (`pnpm build`)
- [ ] Bundle size checked (`ANALYZE=true pnpm build`)
- [ ] Performance audit (Lighthouse >90)
- [ ] Security headers configured
- [ ] Error tracking configured (Sentry)
- [ ] Analytics configured (GA/Plausible)

**Vercel deployment:**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

**Environment variables in Vercel dashboard:**
```text
DATABASE_URL=...
BETTER_AUTH_SECRET=...
NEXT_PUBLIC_APP_URL=https://yourdomain.com
RESEND_API_KEY=...
```

---

## Advanced Customization Summary

**You've now learned:**

**Plugin System:**
- ✅ Activate and configure plugins
- ✅ Use plugin APIs and components
- ✅ Integrate third-party services

**Advanced Theming:**
- ✅ Dark mode customization
- ✅ Custom fonts integration
- ✅ Layout overrides
- ✅ Component customization

**Custom APIs:**
- ✅ Create custom endpoints
- ✅ Authentication in routes
- ✅ Database queries
- ✅ Frontend integration

**Internationalization:**
- ✅ Add new locales
- ✅ Translate entities
- ✅ Use translations in components

**Performance:**
- ✅ Image optimization
- ✅ Code splitting
- ✅ Server Components strategy
- ✅ Caching implementation

**Advanced Entities:**
- ✅ Relationships
- ✅ Custom validation
- ✅ Computed fields
- ✅ Lifecycle hooks

**Deployment:**
- ✅ Environment configs
- ✅ Build optimizations
- ✅ Production checklist

---

## Final Next Steps

**Master the platform:**

1. **Build a Complete Feature** → [First Project Tutorial](./04-first-project.md)
   - Full-stack entity from scratch
   - Database to UI in 30 minutes

2. **Deep Dive Topics:**
   - [Entity System](../04-entities/01-introduction.md)
   - [API Development](../05-api/01-introduction.md)
   - [Theme System](../07-theme-system/01-introduction.md)
   - [Plugin Development](../08-plugin-system/01-introduction.md)

3. **Advanced Patterns:**
   - [Performance Optimization](../13-performance/01-overview.md)
   - [Testing Strategy](../12-testing/01-overview.md)
   - [Deployment Guide](../14-deployment/01-overview.md)

4. **Production Ready:**
   - Security best practices
   - Monitoring and logging
   - Scaling strategies
   - Backup and recovery

---

## Summary

**Complete Customization Journey:**

**Basic Customizations (Sections 1-6):**
- Theme colors and styling
- Creating pages
- Understanding entities
- Theme and app configuration
- Component styling

**Advanced Customizations (Sections 7-13):**
- Plugin integration and activation
- Advanced theming (dark mode, fonts, layouts)
- Custom API routes and endpoints
- Multi-language support (i18n)
- Performance optimization techniques
- Advanced entity features (relationships, hooks)
- Production deployment customization

**Total Coverage:**
- 13 comprehensive customization sections
- 50+ code examples
- Beginner to production-ready
- ~1,840 lines of hands-on guidance

**Key Philosophy:**
- Edit in `contents/` directory
- Use theme variables
- Compose shadcn/ui upward
- Never edit auto-generated files
- Registry-based everything
- Zero runtime I/O

**You're now ready to:**
- Build production SaaS applications
- Customize every aspect of the platform
- Deploy scalable applications
- Integrate third-party services

**Next:** [First Project Tutorial](./04-first-project.md) 🚀

---

**Last Updated**: 2025-11-20
**Version**: 2.0.0
**Status**: Complete
