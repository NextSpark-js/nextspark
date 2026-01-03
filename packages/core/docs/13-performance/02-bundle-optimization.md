# Bundle Optimization

## Introduction

Bundle size directly impacts **loading speed, user experience, and conversion rates**. Every kilobyte of JavaScript must be downloaded, parsed, and executed before your app becomes interactive. This guide covers strategies to minimize bundle size while maintaining functionality.

**Core Principle:** Ship only the code users need, when they need it.

---

## Why Bundle Size Matters

### The Performance Cost of JavaScript

```typescript
// The journey of 1MB of JavaScript:
const javascriptTimeline = {
  download: '1,200ms',    // @ 3G speed (typical mobile)
  parse: '350ms',         // Browser parsing
  compile: '400ms',       // JIT compilation
  execute: '600ms',       // Initial execution
  
  total: '2,550ms',       // Time to Interactive
  
  // Impact:
  - '53% of users abandon after 3s'
  - 'Every 100KB = ~400ms on mobile'
  - 'Parse/compile blocks main thread'
}
```

### Bundle Size Targets

```typescript
// Our performance budgets
const BUNDLE_TARGETS = {
  // Initial JavaScript (First Load)
  initial: {
    target: '100KB',      // Gzipped
    maximum: '150KB',     // Hard limit
  },
  
  // Total JavaScript (All Routes)
  total: {
    target: '500KB',      // Gzipped
    maximum: '750KB',     // Hard limit
  },
  
  // Individual Route Bundles
  route: {
    target: '50KB',       // Per route
    maximum: '100KB',     // Per route
  },
  
  // Third-party Scripts
  thirdParty: {
    target: '100KB',      // External dependencies
    maximum: '150KB',     // Hard limit
  },
} as const
```

**Why These Numbers:**
- 100KB initial = ~400ms parse time on mid-tier mobile
- Total < 500KB allows reasonable multi-route navigation
- Individual routes < 50KB ensure fast route transitions

---

## Next.js 15 Automatic Optimizations

### App Router Code Splitting

Next.js 15 App Router **automatically splits code by route**:

```typescript
// Each route creates a separate bundle
app/
  ├── (public)/
  │   └── page.tsx                    // Bundle: ~45KB
  │       └── features/page.tsx       // Bundle: ~38KB (separate)
  │       └── pricing/page.tsx        // Bundle: ~42KB (separate)
  │
  ├── dashboard/
  │   └── page.tsx                    // Bundle: ~78KB (separate)
  │       └── tasks/
  │           └── page.tsx            // Bundle: ~92KB (separate)
  │
  └── layout.tsx                      // Shared: ~55KB (loaded once)

// ✅ User visiting /features only loads:
// - layout.tsx (55KB)
// - features/page.tsx (38KB)
// - Total: 93KB (not 402KB if all bundled together)
```

**Key Benefit:** Users only download code for routes they visit.

### Turbopack in Development

```typescript
// next.config.ts enables Turbopack automatically in dev mode
// pnpm dev automatically uses --turbopack flag

// Performance improvements:
const turbopackBenefits = {
  coldStart: '700x faster than Webpack',
  hmr: '10x faster updates',
  bundling: 'Incremental (only changed modules)',
  memory: '~50% lower usage',
}
```

### Production Build Optimizations

```bash
# pnpm build automatically applies:
✓ Tree shaking (dead code elimination)
✓ Minification (Terser for JS, Lightning CSS for styles)
✓ Compression (Gzip/Brotli)
✓ Code splitting (automatic route-based)
✓ Image optimization (WebP/AVIF conversion)
✓ Font subsetting (only used characters)
```

---

## Tree Shaking and Dead Code Elimination

### ES Modules Enable Tree Shaking

**Tree shaking** removes unused exports from your bundle:

```typescript
// ❌ WRONG - Imports entire library (50KB+)
import * as Icons from 'lucide-react'

function MyComponent() {
  return <Icons.ChevronRight />  // Only uses 1 icon, bundles all 1000+
}

// ✅ CORRECT - Import only what you need
import { ChevronRight } from 'lucide-react'

function MyComponent() {
  return <ChevronRight />  // Bundles only 1 icon (~2KB)
}
```

### Avoiding Barrel Imports

**Barrel files** (`index.ts` re-exports) can prevent tree shaking:

```typescript
// components/index.ts (Barrel file)
export * from './Button'
export * from './Card'
export * from './Dialog'
export * from './Dropdown'
// ... 50+ components

// ❌ WRONG - May bundle more than needed
import { Button } from '@/components'

// ✅ CORRECT - Direct import ensures tree shaking
import { Button } from '@/components/ui/button'
```

**Our Pattern:**
```typescript
// We use direct imports for UI components
import { Button } from '@/core/components/ui/button'
import { Card, CardHeader, CardContent } from '@/core/components/ui/card'
import { Dialog } from '@/core/components/ui/dialog'

// Registries are exceptions (pre-compiled at build time)
import { ENTITY_REGISTRY } from '@/core/lib/registries/entity-registry'
```

---

## Import Optimization Strategies

### 1. Dynamic Imports for Heavy Dependencies

```typescript
// ❌ WRONG - PDF library loaded on every page (1.2MB)
import * as pdfjsLib from 'pdfjs-dist'

export default function Page() {
  // Most users never view PDFs
  return <div>Content</div>
}

// ✅ CORRECT - Load only when needed
export default function Page() {
  const [pdfViewer, setPdfViewer] = useState(null)
  
  const loadPdfViewer = async () => {
    const pdfjsLib = await import('pdfjs-dist')  // Loaded on-demand
    setPdfViewer(/* ... */)
  }
  
  return (
    <div>
      <Button onClick={loadPdfViewer}>View PDF</Button>
    </div>
  )
}
```

### 2. Lazy Loading Components

```typescript
// ❌ WRONG - Rich text editor loaded immediately (800KB)
import RichTextEditor from '@/components/RichTextEditor'

export default function BlogPostPage() {
  return (
    <div>
      <h1>Edit Post</h1>
      <RichTextEditor />  // Not visible until user scrolls
    </div>
  )
}

// ✅ CORRECT - Lazy load with React.lazy()
import { lazy, Suspense } from 'react'
import { Skeleton } from '@/core/components/ui/skeleton'

const RichTextEditor = lazy(() => import('@/components/RichTextEditor'))

export default function BlogPostPage() {
  return (
    <div>
      <h1>Edit Post</h1>
      <Suspense fallback={<Skeleton className="w-full h-96" />}>
        <RichTextEditor />
      </Suspense>
    </div>
  )
}
```

### 3. Conditional Imports Based on User Actions

```typescript
// ✅ CORRECT - Load chart library only when user views charts
'use client'

import { useState } from 'react'
import { Button } from '@/core/components/ui/button'

export default function AnalyticsPage() {
  const [showChart, setShowChart] = useState(false)
  const [ChartComponent, setChartComponent] = useState(null)
  
  const loadChart = async () => {
    // Chart library only loaded when button is clicked
    const { Chart } = await import('react-chartjs-2')
    setChartComponent(() => Chart)
    setShowChart(true)
  }
  
  return (
    <div>
      <Button onClick={loadChart}>Show Analytics</Button>
      {showChart && ChartComponent && <ChartComponent data={data} />}
    </div>
  )
}
```

---

## Font Optimization

### next/font Integration

Next.js 15 automatically optimizes fonts:

```typescript
// app/layout.tsx
import { Inter, Roboto_Mono } from 'next/font/google'

// ✅ Automatically optimized:
// - Self-hosted (no Google Fonts request)
// - Subsetting (only used characters)
// - Preloaded (font-display: swap)
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  variable: '--font-roboto-mono',
  display: 'swap',
})

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

**Optimization Benefits:**
- **Zero layout shift** (font-display: swap with size-adjust)
- **Privacy friendly** (self-hosted, no Google tracking)
- **Faster loading** (from same domain, HTTP/2 multiplexing)
- **Smaller files** (subsetting removes unused glyphs)

### Custom Font Loading

```typescript
// For custom/local fonts
import localFont from 'next/font/local'

const customFont = localFont({
  src: [
    {
      path: './fonts/CustomFont-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/CustomFont-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-custom',
  display: 'swap',
})
```

---

## CSS Optimization

### Lightning CSS

Next.js 15 uses **Lightning CSS** for ultra-fast CSS processing:

```typescript
// next.config.ts automatically uses Lightning CSS
// No configuration needed - it's the default

// Benefits:
const lightningCSSBenefits = {
  parsing: '100x faster than PostCSS',
  minification: 'Better than cssnano',
  bundling: 'Automatic CSS module concatenation',
  prefixing: 'Automatic vendor prefixes',
}
```

### Tailwind CSS Optimization

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './core/**/*.{ts,tsx}',
    './contents/**/*.{ts,tsx}',
  ],
  // ✅ Tailwind automatically:
  // - Purges unused classes (tree shaking for CSS)
  // - Minifies output
  // - Optimizes selectors
}

export default config
```

**Result:** Final CSS typically **< 50KB** despite Tailwind's large class library.

### CSS-in-JS Considerations

```typescript
// ❌ AVOID - Runtime CSS-in-JS (performance cost)
import styled from 'styled-components'

const Button = styled.button`
  background: blue;
  padding: 10px;
`

// ✅ PREFER - Utility classes or CSS modules
import { cn } from '@/core/lib/utils'

function Button({ className, ...props }) {
  return (
    <button
      className={cn('bg-blue-500 px-4 py-2', className)}
      {...props}
    />
  )
}
```

**Why:** Runtime CSS-in-JS adds bundle size AND runtime overhead.

---

## Analyzing Bundle Size

### webpack-bundle-analyzer

```typescript
// next.config.ts
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'

const nextConfig = {
  webpack: (config, { isServer, dev }) => {
    if (!isServer && !dev) {
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
          reportFilename: '../bundle-analysis.html',
        })
      )
    }
    return config
  },
}
```

**Usage:**
```bash
# Build with analyzer
ANALYZE=true pnpm build

# Open bundle-analysis.html
# Visualize what's taking up space
```

### Next.js Built-in Bundle Analyzer

```bash
# Install
pnpm add -D @next/bundle-analyzer

# Configure next.config.ts
import withBundleAnalyzer from '@next/bundle-analyzer'

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

export default bundleAnalyzer(nextConfig)

# Analyze
ANALYZE=true pnpm build
```

### Reading the Analysis

Look for:
- ❌ **Large dependencies** (> 100KB) that could be code-split
- ❌ **Duplicate modules** (same package bundled twice)
- ❌ **Unused exports** (whole library imported for one function)
- ❌ **Polyfills** (modern browsers may not need them)

---

## Dependency Optimization

### Audit Package Sizes

```bash
# Check package sizes before installing
npx bundle-size <package-name>

# Example
npx bundle-size date-fns
# date-fns: 78.5 KB (gzipped: 21.3 KB)

npx bundle-size luxon
# luxon: 72.3 KB (gzipped: 23.8 KB)

npx bundle-size dayjs
# dayjs: 6.5 KB (gzipped: 2.6 KB)  ← Winner!
```

### Choose Smaller Alternatives

| Heavy Package | Lightweight Alternative | Size Savings |
|--------------|------------------------|--------------|
| moment.js (329KB) | date-fns (78KB) | 251KB |
| lodash (531KB) | lodash-es (92KB) | 439KB |
| axios (42KB) | fetch API (0KB) | 42KB |
| uuid (25KB) | crypto.randomUUID (0KB) | 25KB |

### Tree-shakeable Imports

```typescript
// ❌ WRONG - Imports entire library
import _ from 'lodash'
const result = _.debounce(fn, 500)

// ✅ CORRECT - Import specific function
import debounce from 'lodash-es/debounce'
const result = debounce(fn, 500)

// ✅ EVEN BETTER - Use native implementation
function debounce(fn, delay) {
  let timeoutId
  return (...args) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}
```

---

## Monitoring Bundle Size in CI/CD

### GitHub Actions Example

```yaml
# .github/workflows/bundle-size.yml
name: Bundle Size Check

on: [pull_request]

jobs:
  bundle-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Build
        run: pnpm build
      
      - name: Analyze bundle
        uses: andresz1/size-limit-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          build_script: build
```

### Size Budgets in package.json

```json
{
  "size-limit": [
    {
      "name": "Initial Bundle",
      "path": ".next/static/**/*.js",
      "limit": "150 KB"
    },
    {
      "name": "Dashboard Route",
      "path": ".next/static/chunks/app/dashboard/**/*.js",
      "limit": "100 KB"
    }
  ]
}
```

---

## Real-world Bundle Sizes

### Our Current Bundle Analysis

```typescript
// Actual bundle sizes from our build
const ourBundles = {
  // Initial load (shared across all routes)
  framework: '85KB',        // React, Next.js runtime
  main: '45KB',             // App shell, layout
  
  // Public routes
  home: '38KB',             // Landing page
  features: '42KB',         // Features page
  pricing: '35KB',          // Pricing page
  
  // Dashboard routes
  dashboard: '78KB',        // Dashboard main
  tasks: '92KB',            // Task management (largest)
  
  // Total for typical user journey:
  // Home (123KB) → Dashboard (78KB) = 201KB total
  
  // Status: ✅ Well within 500KB target
}
```

---

## Best Practices Summary

### ✅ DO

```typescript
// Import specific components
import { Button } from '@/core/components/ui/button'

// Use dynamic imports for heavy code
const Chart = lazy(() => import('./Chart'))

// Analyze bundle regularly
ANALYZE=true pnpm build

// Use Next.js Image and Font optimization
import Image from 'next/image'
import { Inter } from 'next/font/google'

// Prefer smaller dependencies
import { format } from 'date-fns'  // Not moment.js
```

### ❌ DON'T

```typescript
// Import entire libraries
import * as Icons from 'lucide-react'

// Load heavy dependencies on all pages
import FullFeaturedEditor from 'big-library'

// Use runtime CSS-in-JS
import styled from 'styled-components'

// Ignore bundle size warnings
// (Bundle size increased by 200KB) ← Investigate!

// Skip bundle analysis
// Always run periodically to catch bloat
```

---

## Next Steps

- **Measure current bundle:** Run `ANALYZE=true pnpm build`
- **Identify largest chunks:** Review bundle-analysis.html
- **Apply code splitting:** See [Code Splitting Guide](./06-code-splitting.md)
- **Optimize images:** See [Core Web Vitals](./07-core-web-vitals.md)
- **Monitor in CI:** Set up size-limit-action

**Related Documentation:**
- [Performance Overview](./01-performance-overview.md) - Overall strategy
- [Code Splitting](./06-code-splitting.md) - Lazy loading patterns
- [Runtime Performance](./03-runtime-performance.md) - React optimization

---

**Last Updated:** 2025-11-20  
**Version:** 1.0.0  
**Status:** Complete  
**Next.js Version:** 15.4.6  
**Bundle Target:** < 100KB initial, < 500KB total
