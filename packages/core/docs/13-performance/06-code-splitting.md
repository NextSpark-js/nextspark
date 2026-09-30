# Code Splitting

## Introduction

Code splitting is the practice of **dividing your JavaScript bundle into smaller chunks** that can be loaded on-demand. Instead of shipping all code upfront, users download only what they need for the current page, dramatically improving initial load times.

**Core Principle:** Load what you need, when you need it.

---

## Why Code Splitting Matters

### The Cost of Large Bundles

```typescript
// Without code splitting (❌ Bad)
const MONOLITHIC_BUNDLE = {
  components: [
    'HomePage',
    'Dashboard',
    'RichTextEditor',     // ← User may never use
    'ChartLibrary',       // ← User may never use
    'PDFViewer',          // ← User may never use
    'AdminPanel',         // ← Most users can't access
  ],

  // Everything downloads and parses before the page is interactive
}

// With code splitting (✅ Good)
const SPLIT_BUNDLES = {
  initial: 'Only what is needed for the first page',
  routes: {
    home: 'Loaded for home',
    dashboard: 'Loaded when visiting /dashboard',
  },
  onDemand: {
    editor: 'Loaded when user clicks "Edit"',
    charts: 'Loaded when viewing analytics',
    pdf: 'Loaded when opening PDF',
  },

  // Only the initial bundle downloads and parses before the page is interactive
}
```

**Result:** less JavaScript to download and parse before the page is interactive (measure your own routes)

---

## Next.js App Router Automatic Code Splitting

### Route-Based Splitting (Automatic)

Next.js 15 App Router **automatically code splits** by route:

```typescript
// Each route creates a separate bundle
app/
  ├── (public)/
  │   ├── page.tsx
  │   ├── features/
  │   │   └── page.tsx
  │   └── pricing/
  │       └── page.tsx
  │
  ├── dashboard/
  │   ├── page.tsx
  │   ├── tasks/
  │   │   └── page.tsx
  │   └── analytics/
  │       └── page.tsx
  │
  └── layout.tsx                      // Shared bundle, loaded once

// User visiting /dashboard only downloads:
// 1. Shared layout bundle
// 2. Dashboard page bundle
// Not the code of the other routes
```

**Key Benefits:**
- ✅ **Zero configuration** - Works out of the box
- ✅ **Parallel loading** - Routes loaded in parallel when prefetched
- ✅ **Shared chunks** - Common dependencies automatically deduplicated
- ✅ **Fast navigation** - Subsequent pages load instantly from cache

---

## React.lazy() and Suspense

### Component-Level Code Splitting

For **heavy components** not needed immediately:

```typescript
import { lazy, Suspense } from 'react'
import { Skeleton } from '@nextsparkjs/core/components/ui/skeleton'

// ❌ WRONG - Rich text editor loaded immediately
import RichTextEditor from '@/components/RichTextEditor'

export default function BlogPostPage() {
  return (
    <div>
      <h1>Edit Post</h1>
      <RichTextEditor />  // Blocks initial render
    </div>
  )
}

// ✅ CORRECT - Lazy load when component renders
const RichTextEditor = lazy(() => import('@/components/RichTextEditor'))

export default function BlogPostPage() {
  return (
    <div>
      <h1>Edit Post</h1>
      <Suspense fallback={<Skeleton className="w-full h-96" />}>
        <RichTextEditor />  // Loads asynchronously
      </Suspense>
    </div>
  )
}
```

### Multiple Lazy Components

```typescript
import { lazy, Suspense } from 'react'

// Lazy load all heavy components
const Chart = lazy(() => import('@/components/charts/Chart'))
const DataTable = lazy(() => import('@/components/tables/DataTable'))
const ExportModal = lazy(() => import('@/components/modals/ExportModal'))

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <h1>Analytics Dashboard</h1>

      {/* Each component loads independently */}
      <Suspense fallback={<ChartSkeleton />}>
        <Chart data={chartData} />
      </Suspense>

      <Suspense fallback={<TableSkeleton />}>
        <DataTable data={tableData} />
      </Suspense>

      <Suspense fallback={<div>Loading...</div>}>
        <ExportModal />
      </Suspense>
    </div>
  )
}
```

---

## Conditional Component Loading

### Load on User Interaction

Load components **only when user needs them**:

```typescript
'use client'

import { lazy, Suspense, useState } from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'

// Component loaded only when modal opens
const CreateProductModal = lazy(() =>
  import('@/components/modals/CreateProductModal')
)

export default function ProductsPage() {
  const [showModal, setShowModal] = useState(false)

  return (
    <div>
      <Button onClick={() => setShowModal(true)}>
        Create Product
      </Button>

      {showModal && (
        <Suspense fallback={<div>Loading modal...</div>}>
          <CreateProductModal
            open={showModal}
            onClose={() => setShowModal(false)}
          />
        </Suspense>
      )}
    </div>
  )
}
```

### Load Based on User Role

```typescript
'use client'

import { lazy, Suspense } from 'react'
import { useAuth } from '@nextsparkjs/core/hooks/useAuth'

// Admin panel loaded only for admins
const AdminPanel = lazy(() => import('@/components/admin/AdminPanel'))

export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <div>
      <h1>Dashboard</h1>
      
      {user?.role === 'admin' && (
        <Suspense fallback={<div>Loading admin panel...</div>}>
          <AdminPanel />
        </Suspense>
      )}
    </div>
  )
}
```

---

## Dynamic Imports for Libraries

### Load Heavy Dependencies On-Demand

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'

export default function DocumentViewer() {
  const [pdfViewer, setPdfViewer] = useState<any>(null)

  // ❌ WRONG - PDF library loaded immediately
  // import * as pdfjsLib from 'pdfjs-dist'

  // ✅ CORRECT - Load only when user views PDF
  const loadPdfViewer = async () => {
    const pdfjsLib = await import('pdfjs-dist')
    
    // Initialize and render PDF
    const pdf = await pdfjsLib.getDocument(pdfUrl).promise
    setPdfViewer(pdf)
  }

  return (
    <div>
      <Button onClick={loadPdfViewer}>
        View PDF Document
      </Button>

      {pdfViewer && <div id="pdf-container" />}
    </div>
  )
}
```

### Chart Library Example

```typescript
'use client'

import { useState } from 'react'
import type { ChartData } from 'chart.js'

export default function ChartComponent({ data }: { data: ChartData }) {
  const [ChartComponent, setChartComponent] = useState<any>(null)

  const loadChart = async () => {
    // Load Chart.js + React wrapper
    const { Chart } = await import('react-chartjs-2')
    const { Chart as ChartJS, registerables } = await import('chart.js')
    
    ChartJS.register(...registerables)
    setChartComponent(() => Chart)
  }

  if (!ChartComponent) {
    return <button onClick={loadChart}>Show Chart</button>
  }

  return <ChartComponent data={data} />
}
```

---

## Named Exports and Code Splitting

### Splitting by Named Export

```typescript
// ❌ WRONG - Imports entire file even if only using one function
import { HeavyFunction, LightFunction } from './utils'

// ✅ CORRECT - Split exports into separate files
// utils/heavy.ts
export function HeavyFunction() { /* ... */ }

// utils/light.ts
export function LightFunction() { /* ... */ }

// Import only what you need
import { LightFunction } from './utils/light'

// Heavy function can be loaded conditionally
const { HeavyFunction } = await import('./utils/heavy')
```

### Example: Icon Library Optimization

```typescript
// ❌ WRONG - Imports all icons (50KB+)
import * as Icons from 'lucide-react'

function MyComponent() {
  return <Icons.ChevronRight />  // Only uses 1 icon
}

// ✅ CORRECT - Import only needed icon
import { ChevronRight } from 'lucide-react'

function MyComponent() {
  return <ChevronRight />  // Bundles only 1 icon
}

// ✅ EVEN BETTER - Dynamic icon loading
const iconMap = {
  chevronRight: () => import('lucide-react/dist/esm/icons/chevron-right'),
  user: () => import('lucide-react/dist/esm/icons/user'),
}

async function loadIcon(name: string) {
  const { default: Icon } = await iconMap[name]()
  return Icon
}
```

---

## Prefetching Strategies

### Link Prefetching

Next.js automatically prefetches links in viewport:

```typescript
import Link from 'next/link'

export default function Navigation() {
  return (
    <nav>
      {/* ✅ Automatically prefetched when link enters viewport */}
      <Link href="/dashboard">
        Dashboard
      </Link>

      {/* ❌ Disable prefetch for rarely-visited pages */}
      <Link href="/admin" prefetch={false}>
        Admin Panel
      </Link>

      {/* ✅ Prefetch on hover (instant navigation) */}
      <Link 
        href="/tasks"
        prefetch={true}
        className="hover:underline"
      >
        Tasks
      </Link>
    </nav>
  )
}
```

### Manual Prefetching

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'

export function ProductCard({ product }: { product: Product }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const prefetchProduct = () => {
    // Prefetch route
    router.prefetch(`/products/${product.id}`)

    // Prefetch data
    queryClient.prefetchQuery({
      queryKey: ['product', product.id],
      queryFn: () => fetch(`/api/v1/products/${product.id}`).then(r => r.json()),
    })
  }

  return (
    <div
      onMouseEnter={prefetchProduct}  // Prefetch on hover
      onClick={() => router.push(`/products/${product.id}`)}
    >
      <h3>{product.name}</h3>
      <p>{product.price}</p>
    </div>
  )
}
```

---

## Measuring Code Splitting Impact

### webpack-bundle-analyzer

Visualize your bundle composition:

```bash
# Install analyzer
pnpm add -D @next/bundle-analyzer

# Configure next.config.ts
import withBundleAnalyzer from '@next/bundle-analyzer'

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

export default bundleAnalyzer(nextConfig)

# Analyze bundle
ANALYZE=true pnpm build

# Opens interactive treemap showing bundle composition
```

### What to Look For

```typescript
// Analyzing bundle-analysis.html

const RED_FLAGS = [
  '❌ Large shared chunks',
  '❌ Duplicate dependencies (same package bundled twice)',
  '❌ Heavy libraries in initial bundle (charts, editors)',
  '❌ Admin code in public routes',
  '❌ Unused code (dead imports)',
]

const GOOD_SIGNS = [
  '✅ Route bundles < 100KB each',
  '✅ Shared chunks < 150KB',
  '✅ Heavy libraries in separate chunks',
  '✅ Clear separation between routes',
]
```

### Performance Metrics

Compare the initial bundle size and FCP, TTI and LCP of your own routes before and after splitting (Lighthouse, `@next/bundle-analyzer`). The repository ships no benchmark that turns this into a figure; `scripts/performance/verify-route-js-budget.mjs` checks the route JavaScript budget.

---

## Common Pitfalls and Anti-Patterns

### ❌ WRONG Patterns

```typescript
// 1. Lazy loading above-the-fold content
const Hero = lazy(() => import('./Hero'))  // ❌ User sees blank screen

// 2. Over-splitting (too granular)
const Button = lazy(() => import('./Button'))  // ❌ Overhead > benefit

// 3. Forgetting Suspense boundary
const Chart = lazy(() => import('./Chart'))
return <Chart />  // ❌ Error: Missing Suspense boundary

// 4. Splitting shared dependencies
const Header = lazy(() => import('./Header'))  // ❌ Loaded on every page

// 5. Loading critical data lazily
const UserAuth = lazy(() => import('./UserAuth'))  // ❌ Blocks entire app
```

### ✅ CORRECT Patterns

```typescript
// 1. Eagerly load above-the-fold
import Hero from './Hero'  // ✅ Immediate

// 2. Split heavy components only
const RichTextEditor = lazy(() => import('./RichTextEditor'))  // ✅ not in the initial bundle

// 3. Always wrap in Suspense
<Suspense fallback={<Skeleton />}>
  <Chart />
</Suspense>

// 4. Keep shared code in layout
import Header from './Header'  // ✅ Loaded once

// 5. Load auth synchronously
import UserAuth from './UserAuth'  // ✅ Critical path
```

---

## Code Splitting Checklist

### Before Deploying

```typescript
const CODE_SPLITTING_CHECKLIST = {
  routes: [
    '✅ Each route < 100KB',
    '✅ Shared layout < 150KB',
    '✅ Total initial bundle < 250KB',
  ],
  
  components: [
    '✅ Heavy components lazy loaded',
    '✅ Admin code split from public routes',
    '✅ Modals loaded conditionally',
    '✅ Charts/editors loaded on-demand',
  ],
  
  dependencies: [
    '✅ Icon imports are specific (not import *)',
    '✅ Utility functions split by usage',
    '✅ No duplicate dependencies in bundles',
  ],
  
  suspense: [
    '✅ All lazy components wrapped in Suspense',
    '✅ Fallbacks provide good UX',
    '✅ Error boundaries handle load failures',
  ],
}
```

---

## Real-world Example: Dashboard

### Optimized Dashboard with Code Splitting

```typescript
// templates/dashboard/page.tsx
import { Suspense, lazy } from 'react'
import DashboardHeader from '@/components/dashboard/Header'  // Shared
import StatsCard from '@/components/dashboard/StatsCard'      // Small

// Heavy components lazy loaded
const TaskList = lazy(() => import('@/components/dashboard/TaskList'))
const Analytics = lazy(() => import('@/components/dashboard/Analytics'))
const RecentActivity = lazy(() => import('@/components/dashboard/RecentActivity'))

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Eager load - above fold */}
      <DashboardHeader />
      
      {/* Eager load - small and critical */}
      <div className="grid grid-cols-3 gap-4">
        <StatsCard title="Tasks" value={tasks.length} />
        <StatsCard title="Completed" value={completed} />
        <StatsCard title="Pending" value={pending} />
      </div>

      {/* Lazy load - below fold */}
      <Suspense fallback={<TaskListSkeleton />}>
        <TaskList />
      </Suspense>

      <Suspense fallback={<AnalyticsSkeleton />}>
        <Analytics />
      </Suspense>

      <Suspense fallback={<ActivitySkeleton />}>
        <RecentActivity />
      </Suspense>
    </div>
  )
}

// Result: the below-the-fold components are no longer part of the initial bundle
```

---

## Best Practices Summary

### ✅ DO

```typescript
// Lazy load heavy components
const Editor = lazy(() => import('./RichTextEditor'))

// Split by route (automatic)
// templates/dashboard/page.tsx → separate bundle

// Load conditionally
{showChart && <Suspense><Chart /></Suspense>}

// Import specific exports
import { Button } from '@/components/ui/button'

// Prefetch on hover
<Link href="/tasks" prefetch={true}>Tasks</Link>
```

### ❌ DON'T

```typescript
// Lazy load small components
const Button = lazy(() => import('./Button'))  // Overhead > benefit

// Import all icons
import * as Icons from 'lucide-react'

// Forget Suspense
<LazyComponent />  // Error!

// Split critical path
const Auth = lazy(() => import('./Auth'))  // Blocks app

// Over-prefetch
<Link href="/admin" prefetch={true} />  // Rarely visited
```

---

## Next Steps

- **Analyze bundle:** Run `ANALYZE=true pnpm build`
- **Identify heavy components:** Look for chunks > 100KB
- **Implement lazy loading:** Start with largest components
- **Measure impact:** Compare before/after metrics

**Related Documentation:**
- [Bundle Optimization](./02-bundle-optimization.md) - Reducing bundle size
- [Performance Overview](./01-performance-overview.md) - Overall strategy
- [Core Web Vitals](./07-core-web-vitals.md) - User-facing metrics

---

**Last Updated:** 2025-11-20  
**Version:** 1.0.0  
**Status:** Complete  
**Next.js:** 15.4.6  
**React:** 19.1.0
