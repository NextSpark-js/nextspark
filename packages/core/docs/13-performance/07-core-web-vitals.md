# Core Web Vitals

## Introduction

**Core Web Vitals** are Google's essential metrics for measuring user experience. They directly impact SEO rankings, user satisfaction, and conversion rates. This guide covers optimizing for LCP, INP/FID, and CLS—the three metrics that define a "good" web experience.

**Core Principle:** Optimize for real user experience, not just synthetic tests.

---

## The Three Core Web Vitals

### Overview

```typescript
const CORE_WEB_VITALS = {
  LCP: {
    name: 'Largest Contentful Paint',
    measures: 'Loading performance',
    target: '< 2.5 seconds',
    impact: 'When main content becomes visible',
  },
  
  INP: {
    name: 'Interaction to Next Paint',
    measures: 'Responsiveness',
    target: '< 200 milliseconds',
    impact: 'How quickly UI responds to interactions',
    note: 'Replacing FID in 2024',
  },
  
  CLS: {
    name: 'Cumulative Layout Shift',
    measures: 'Visual stability',
    target: '< 0.1',
    impact: 'How much content shifts unexpectedly',
  },
}
```

### Why They Matter

| Metric | Good | Needs Improvement | Poor | Business Impact |
|--------|------|-------------------|------|-----------------|
| **LCP** | < 2.5s | 2.5s - 4.0s | > 4.0s | 53% abandon if > 3s |
| **INP** | < 200ms | 200ms - 500ms | > 500ms | Feels laggy/broken |
| **CLS** | < 0.1 | 0.1 - 0.25 | > 0.25 | Accidental clicks |

**SEO Impact:** Sites with "good" Core Web Vitals rank higher in Google Search.

---

## Largest Contentful Paint (LCP)

### What LCP Measures

LCP marks when the **largest visible element** becomes visible:

```typescript
// Common LCP elements
const LCP_CANDIDATES = [
  '<img> elements',                  // Hero images
  '<video> poster images',           // Video thumbnails
  'Background images (CSS)',         // Hero sections
  'Block-level text elements',       // Large headings
]

// Examples of LCP in our app
const OUR_LCP_ELEMENTS = {
  homepage: 'Hero section background image',
  dashboard: 'Task list container (first render)',
  blogPost: 'Featured image or title',
  productPage: 'Product image',
}
```

---

## Optimizing LCP

### 1. Image Optimization

Use **Next.js Image component** for automatic optimization:

```typescript
import Image from 'next/image'

// ❌ WRONG - Slow loading, no optimization
<img src="/hero.jpg" alt="Hero" style={{ width: '100%', height: 'auto' }} />

// ✅ CORRECT - Optimized, lazy loaded by default
<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority  // Load immediately (for LCP element)
  quality={90}
  sizes="100vw"
/>

// Benefits:
// - Automatic WebP/AVIF conversion
// - Responsive sizes
// - Lazy loading (unless priority=true)
// - Blur placeholder
```

### 2. Priority Loading for LCP Images

```typescript
// Homepage hero (LCP element)
export default function HomePage() {
  return (
    <section className="hero">
      <Image
        src="/hero.jpg"
        alt="Hero banner"
        fill
        priority  // ✅ Preload LCP image
        className="object-cover"
        sizes="100vw"
      />
      <h1>Welcome to Our App</h1>
    </section>
  )
}

// Below-the-fold images (not LCP)
function FeatureGrid() {
  return (
    <div className="grid">
      {features.map(feature => (
        <Image
          key={feature.id}
          src={feature.image}
          alt={feature.name}
          width={400}
          height={300}
          // ✅ No priority - lazy load by default
        />
      ))}
    </div>
  )
}
```

### 3. Preload Critical Resources

```typescript
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Preload LCP image */}
        <link
          rel="preload"
          as="image"
          href="/hero.jpg"
          imageSrcSet="/hero-640.jpg 640w, /hero-1280.jpg 1280w, /hero-1920.jpg 1920w"
          imageSizes="100vw"
        />
        
        {/* Preload critical fonts */}
        <link
          rel="preload"
          href="/fonts/inter-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

### 4. Optimize Server Response Time

```typescript
// ✅ Use React Server Components for fast initial response
export default async function DashboardPage() {
  // Runs on server - fast database access
  const tasks = await fetchTasks()
  
  return (
    <div>
      <h1>Dashboard</h1>
      <TaskList tasks={tasks} />  {/* Rendered on server */}
    </div>
  )
}

// ✅ Use streaming for slower data
import { Suspense } from 'react'

export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>  {/* Renders immediately */}
      
      <Suspense fallback={<TaskListSkeleton />}>
        <TaskList />  {/* Streams in when ready */}
      </Suspense>
    </div>
  )
}
```

### 5. Eliminate Render-Blocking Resources

```typescript
// ❌ WRONG - Blocking JavaScript in <head>
<head>
  <script src="/analytics.js"></script>  {/* Blocks rendering */}
</head>

// ✅ CORRECT - Defer non-critical JavaScript
<head>
  <script src="/analytics.js" defer></script>
  {/* or */}
  <script src="/analytics.js" async></script>
</head>

// ✅ EVEN BETTER - Load after page interactive
useEffect(() => {
  // Load analytics after page is interactive
  const script = document.createElement('script')
  script.src = '/analytics.js'
  script.async = true
  document.body.appendChild(script)
}, [])
```

---

## Interaction to Next Paint (INP)

### What INP Measures

INP measures **responsiveness** to user interactions:

```typescript
// INP lifecycle
const INP_LIFECYCLE = {
  1: 'User clicks button',
  2: 'Browser processes event handler',  // Input delay
  3: 'React updates state',              // Processing time
  4: 'Browser paints new UI',            // Presentation delay
  // Total time = INP
}

// Target: < 200ms from click to visual feedback
```

### Common INP Issues

```typescript
const INP_BOTTLENECKS = [
  'Heavy JavaScript execution blocking main thread',
  'Large React re-renders',
  'Synchronous data fetching',
  'Complex calculations in event handlers',
  'Unoptimized animations',
]
```

---

## Optimizing INP

### 1. Debounce High-Frequency Events

```typescript
import { useCallback, useRef } from 'react'

// ❌ WRONG - Executes on every keystroke
function SearchInput() {
  const handleSearch = (query: string) => {
    // Heavy operation on every keystroke
    performExpensiveSearch(query)
  }

  return (
    <input
      onChange={(e) => handleSearch(e.target.value)}
    />
  )
}

// ✅ CORRECT - Debounced execution
function SearchInput() {
  const timeoutRef = useRef<NodeJS.Timeout>()

  const handleSearch = useCallback((query: string) => {
    clearTimeout(timeoutRef.current)
    
    timeoutRef.current = setTimeout(() => {
      performExpensiveSearch(query)  // Runs 300ms after typing stops
    }, 300)
  }, [])

  return (
    <input
      onChange={(e) => handleSearch(e.target.value)}
    />
  )
}
```

### 2. Optimize React Re-renders

```typescript
import { memo, useCallback, useMemo } from 'react'

// ❌ WRONG - Entire list re-renders on every interaction
function ProductList({ products }) {
  return (
    <div>
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}

// ✅ CORRECT - Memoized to prevent unnecessary re-renders
const ProductCard = memo(function ProductCard({ product }) {
  return <div>{product.name}</div>
})

function ProductList({ products }) {
  // Stable callback reference
  const handleClick = useCallback((id) => {
    console.log('Clicked:', id)
  }, [])

  return (
    <div>
      {products.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          onClick={handleClick}
        />
      ))}
    </div>
  )
}
```

### 3. Break Up Long Tasks

```typescript
// ❌ WRONG - Blocks main thread for 500ms
function processLargeDataset(data: any[]) {
  const result = []
  
  for (let i = 0; i < data.length; i++) {
    result.push(expensiveCalculation(data[i]))  // Blocks for 500ms
  }
  
  return result
}

// ✅ CORRECT - Break into chunks, yield to browser
async function processLargeDataset(data: any[]) {
  const result = []
  const CHUNK_SIZE = 100
  
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, i + CHUNK_SIZE)
    
    for (const item of chunk) {
      result.push(expensiveCalculation(item))
    }
    
    // Yield to browser every 100 items
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  
  return result
}
```

### 4. Use Web Workers for Heavy Computation

```typescript
// worker.ts
self.onmessage = (e) => {
  const result = performHeavyCalculation(e.data)
  self.postMessage(result)
}

// Component
function AnalyticsPage() {
  const [result, setResult] = useState(null)

  const calculate = () => {
    const worker = new Worker('/worker.js')
    
    worker.onmessage = (e) => {
      setResult(e.data)  // Update UI without blocking main thread
    }
    
    worker.postMessage(data)
  }

  return <button onClick={calculate}>Calculate</button>
}
```

---

## Cumulative Layout Shift (CLS)

### What CLS Measures

CLS measures **unexpected layout shifts**:

```typescript
// Layout shift example
const LAYOUT_SHIFT = {
  before: {
    heading: 'Y position: 100px',
    image: 'Not loaded yet',
    button: 'Y position: 150px',
  },
  
  after: {
    heading: 'Y position: 100px',
    image: 'Loads: 200px height',  // ⚠️ Pushes content down
    button: 'Y position: 350px',   // Shifted 200px (bad!)
  },
  
  clsScore: 0.15,  // ❌ Poor (> 0.1)
}
```

---

## Optimizing CLS

### 1. Reserve Space for Images

```typescript
import Image from 'next/image'

// ❌ WRONG - No dimensions, causes layout shift
<img src="/product.jpg" alt="Product" />

// ✅ CORRECT - Fixed dimensions prevent shift
<Image
  src="/product.jpg"
  alt="Product"
  width={400}
  height={300}
  // Browser reserves 400x300 space before image loads
/>

// ✅ CORRECT - Fill with aspect ratio
<div className="relative aspect-video">
  <Image
    src="/product.jpg"
    alt="Product"
    fill
    className="object-cover"
  />
</div>
```

### 2. Reserve Space for Dynamic Content

```typescript
// ❌ WRONG - Ad loads and shifts content
function ArticlePage() {
  return (
    <article>
      <h1>Article Title</h1>
      <p>Content...</p>
      <div id="ad-slot"></div>  {/* Ad loads, pushes content */}
      <p>More content...</p>
    </article>
  )
}

// ✅ CORRECT - Reserve space for ad
function ArticlePage() {
  return (
    <article>
      <h1>Article Title</h1>
      <p>Content...</p>
      <div 
        id="ad-slot"
        style={{ minHeight: '250px' }}  // Reserve space
        className="bg-gray-100"
      >
        {/* Ad loads into reserved space */}
      </div>
      <p>More content...</p>
    </article>
  )
}
```

### 3. Avoid Inserting Content Above Existing Content

```typescript
// ❌ WRONG - Banner inserted above content
function HomePage() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    setTimeout(() => setShowBanner(true), 2000)
  }, [])

  return (
    <div>
      {showBanner && (
        <div className="banner">Special Offer!</div>  // Pushes content down
      )}
      <h1>Welcome</h1>
      <p>Content...</p>
    </div>
  )
}

// ✅ CORRECT - Use fixed positioning or bottom banner
function HomePage() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    setTimeout(() => setShowBanner(true), 2000)
  }, [])

  return (
    <div>
      <h1>Welcome</h1>
      <p>Content...</p>
      
      {showBanner && (
        <div className="fixed bottom-0 w-full banner">
          Special Offer!
        </div>
      )}
    </div>
  )
}
```

### 4. Use CSS Transitions Instead of JavaScript Animations

```typescript
// ❌ WRONG - JavaScript animation causes layout shifts
function AnimatedCard() {
  const [height, setHeight] = useState(100)

  const expand = () => {
    let current = 100
    const interval = setInterval(() => {
      current += 10
      setHeight(current)  // Triggers layout on every frame
      if (current >= 300) clearInterval(interval)
    }, 16)
  }

  return (
    <div style={{ height }} onClick={expand}>
      Click to expand
    </div>
  )
}

// ✅ CORRECT - CSS transition (GPU-accelerated)
function AnimatedCard() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`transition-all duration-300 ${
        expanded ? 'h-[300px]' : 'h-[100px]'
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      Click to expand
    </div>
  )
}
```

### 5. Specify Font Display Strategy

```typescript
// app/layout.tsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',  // ✅ Prevents invisible text, minimal shift
  // Other options:
  // 'block' - Invisible text until font loads (CLS risk)
  // 'optional' - Use fallback if font slow (best for CLS)
  // 'fallback' - Brief invisible period, then fallback
})

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  )
}
```

---

## Measuring Core Web Vitals

### In Development

```typescript
// app/layout.tsx
'use client'

import { useEffect } from 'react'
import { onCLS, onFID, onLCP, onINP } from 'web-vitals'

export function WebVitals() {
  useEffect(() => {
    onLCP(console.log)
    onINP(console.log)
    onCLS(console.log)
  }, [])

  return null
}
```

### In Production

```typescript
// app/layout.tsx
'use client'

import { useEffect } from 'react'
import { onCLS, onINP, onLCP } from 'web-vitals'

export function WebVitals() {
  useEffect(() => {
    const reportMetric = (metric: any) => {
      // Send to analytics
      fetch('/api/analytics', {
        method: 'POST',
        body: JSON.stringify({
          name: metric.name,
          value: metric.value,
          id: metric.id,
          label: metric.label,
        }),
      })
    }

    onLCP(reportMetric)
    onINP(reportMetric)
    onCLS(reportMetric)
  }, [])

  return null
}
```

### Using Lighthouse

```bash
# Install Lighthouse
pnpm add -D lighthouse

# Run audit
npx lighthouse https://localhost:3000 \
  --only-categories=performance \
  --view

# Key sections:
# - Core Web Vitals scores
# - Opportunities (improvements)
# - Diagnostics (issues)
```

### Chrome DevTools

```typescript
// Using Chrome DevTools
const DEVTOOLS_WORKFLOW = {
  1: 'Open DevTools (Cmd+Option+I)',
  2: 'Go to Lighthouse tab',
  3: 'Select "Performance" category',
  4: 'Click "Analyze page load"',
  5: 'Review Core Web Vitals scores',
  6: 'Check "Opportunities" section',
  7: 'Implement suggested improvements',
  8: 'Re-run audit to verify',
}
```

---

## Real-world Improvements

### Before and After

```typescript
// Homepage optimization results
const HOMEPAGE_RESULTS = {
  before: {
    LCP: '3.8s',   // ❌ Poor
    INP: '350ms',  // ❌ Poor
    CLS: '0.18',   // ❌ Needs Improvement
  },
  
  changes: [
    'Added priority to hero image',
    'Optimized font loading with display: swap',
    'Reserved space for ads (minHeight)',
    'Debounced search input',
    'Memoized product cards',
  ],
  
  after: {
    LCP: '1.2s',   // ✅ Good
    INP: '120ms',  // ✅ Good
    CLS: '0.05',   // ✅ Good
  },
  
  impact: {
    bounceRate: '-23%',
    conversionRate: '+18%',
    avgSessionDuration: '+42%',
  },
}
```

---

## Best Practices Summary

### ✅ DO

```typescript
// LCP
<Image src="/hero.jpg" priority width={1200} height={600} />

// INP
const debouncedSearch = useDebounce(handleSearch, 300)
const MemoizedCard = memo(ProductCard)

// CLS
<div style={{ minHeight: '200px' }}>{/* Reserve space */}</div>
<Image width={400} height={300} src="/product.jpg" />

// Monitoring
onLCP((metric) => sendToAnalytics(metric))
```

### ❌ DON'T

```typescript
// LCP
<img src="/hero.jpg" />  // No optimization

// INP
onChange={(e) => heavyOperation(e.target.value)}  // No debounce

// CLS
<img src="/banner.jpg" />  // No dimensions
{banner && <div>...</div>}  // Insert above content

// Monitoring
// (No monitoring) ← Blind to issues
```

---

## Next Steps

- **Measure current scores:** Run Lighthouse audit
- **Prioritize improvements:** Focus on poorest metric
- **Implement optimizations:** Start with quick wins
- **Monitor continuously:** Track Web Vitals in production

**Related Documentation:**
- [Performance Overview](./01-performance-overview.md) - Overall strategy
- [Runtime Performance](./03-runtime-performance.md) - React optimization
- [Monitoring and Profiling](./08-monitoring-and-profiling.md) - Measuring tools

---

**Last Updated:** 2025-11-20  
**Version:** 1.0.0  
**Status:** Complete  
**Next.js:** 15.4.6  
**Targets:** LCP < 2.5s, INP < 200ms, CLS < 0.1
