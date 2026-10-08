# Bundle Optimization

## Introduction

Bundle size directly impacts **loading speed, user experience, and conversion rates**. Every kilobyte of JavaScript must be downloaded, parsed, and executed before your app becomes interactive. This guide covers strategies to minimize bundle size while maintaining functionality.

**Core Principle:** Ship only the code users need, when they need it.

---

## Why Bundle Size Matters

### The Performance Cost of JavaScript

```typescript
// The journey of JavaScript to an interactive page:
const javascriptTimeline = {
  download: 'Network transfer',
  parse: 'Browser parsing',
  compile: 'JIT compilation',
  execute: 'Initial execution',
  // Every step grows with the amount of JavaScript

  // Impact:
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
- A small initial bundle keeps parse time low on mid-tier mobile
- Total < 500KB allows reasonable multi-route navigation
- Individual routes < 50KB ensure fast route transitions

---

## Next.js 16 Automatic Optimizations

### App Router Code Splitting

Next.js 16 App Router **automatically splits code by route**:

```typescript
// Each route creates a separate bundle
app/
  ├── (public)/
  │   └── page.tsx
  │       └── features/page.tsx
  │       └── pricing/page.tsx
  │
  ├── dashboard/
  │   └── page.tsx
  │       └── tasks/
  │           └── page.tsx
  │
  └── layout.tsx                      // Shared: loaded once

// ✅ User visiting /features only loads:
// - layout.tsx (shared)
// - features/page.tsx
// Not the other routes' code
```

**Key Benefit:** Users only download code for routes they visit.

### Turbopack

Next.js 16 uses Turbopack by default for `next dev` and `next build`; pass `--webpack` to opt out.

```typescript
// No flag or next.config.ts setting is needed to turn Turbopack on.

// Performance improvements:
const turbopackBenefits = {
  bundling: 'Incremental (only changed modules)',
  hmr: 'Updates only what changed',
}
```

### Production Build Optimizations

```bash
# pnpm build automatically applies:
✓ Tree shaking (dead code elimination)
✓ Minification (JavaScript and CSS)
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
  return <ChevronRight />  // Bundles only 1 icon
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
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Card, CardHeader, CardContent } from '@nextsparkjs/core/components/ui/card'
import { Dialog } from '@nextsparkjs/core/components/ui/dialog'

// Registries are exceptions (pre-compiled at build time)
import { ENTITY_REGISTRY } from '@nextsparkjs/registries/entity-registry'
```

---

## Import Optimization Strategies

### 1. Dynamic Imports for Heavy Dependencies

```typescript
// ❌ WRONG - PDF library loaded on every page
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
// ❌ WRONG - Rich text editor loaded immediately
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
import { Skeleton } from '@nextsparkjs/core/components/ui/skeleton'

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
import { Button } from '@nextsparkjs/core/components/ui/button'

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

Next.js automatically optimizes fonts:

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

Next.js 16 builds with Turbopack, which processes CSS with **Lightning CSS**:

```typescript
// Turbopack uses Lightning CSS for CSS
// No configuration needed

// Benefits:
const lightningCSSBenefits = {
  parsing: 'Native parser (Rust)',
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
    './{api,blocks,components,config,entities,lib,plugins,templates}/**/*.{ts,tsx}',
  ],
  // ✅ Tailwind automatically:
  // - Purges unused classes (tree shaking for CSS)
  // - Minifies output
  // - Optimizes selectors
}

export default config
```

**Result:** Tailwind generates only the classes your sources use, so the final CSS stays small.

### CSS-in-JS Considerations

```typescript
// ❌ AVOID - Runtime CSS-in-JS (performance cost)
import styled from 'styled-components'

const Button = styled.button`
  background: blue;
  padding: 10px;
`

// ✅ PREFER - Utility classes or CSS modules
import { cn } from '@nextsparkjs/core/lib/utils'

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
```

### Choose Smaller Alternatives

| Heavy Package | Lightweight Alternative |
|--------------|------------------------|
| moment.js | date-fns or dayjs |
| lodash | lodash-es (tree-shakeable) |
| axios | fetch API |
| uuid | crypto.randomUUID |

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

The repository does not track per-route bundle sizes by name. It checks the JavaScript each route loads with `scripts/performance/verify-route-js-budget.mjs` against `scripts/performance/apps-dev-route-js-budget.json`; for your own project use `@next/bundle-analyzer`.

---

## Best Practices Summary

### ✅ DO

```typescript
// Import specific components
import { Button } from '@nextsparkjs/core/components/ui/button'

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
// (Bundle size increased) ← Investigate!

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
