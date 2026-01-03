# Frontend Performance Optimization

Performance is not just about speed—it's about user experience, SEO rankings, and business success. This guide covers our complete frontend performance strategy, from React optimizations to Core Web Vitals.

---

## 📋 Table of Contents

1. [Performance Metrics](#performance-metrics)
2. [React Performance Patterns](#react-performance-patterns)
3. [Code Splitting and Lazy Loading](#code-splitting-and-lazy-loading)
4. [Image Optimization](#image-optimization)
5. [Bundle Size Optimization](#bundle-size-optimization)
6. [Virtualization for Long Lists](#virtualization-for-long-lists)
7. [Core Web Vitals](#core-web-vitals)
8. [Monitoring and Measuring](#monitoring-and-measuring)
9. [Next.js 15 Optimizations](#nextjs-15-optimizations)
10. [Best Practices](#best-practices)
11. [Common Pitfalls](#common-pitfalls)

---

## Performance Metrics

### Key Metrics to Track

| Metric | Target | Impact |
|--------|--------|--------|
| **First Contentful Paint (FCP)** | < 1.8s | User sees content |
| **Largest Contentful Paint (LCP)** | < 2.5s | Main content visible |
| **First Input Delay (FID)** | < 100ms | Interactivity |
| **Cumulative Layout Shift (CLS)** | < 0.1 | Visual stability |
| **Time to Interactive (TTI)** | < 3.8s | Fully interactive |
| **Total Blocking Time (TBT)** | < 200ms | Main thread blocking |

### Why Performance Matters

- **53% of mobile users** abandon sites that take > 3s to load
- **100ms improvement** can increase conversion by 1%
- **Better SEO** rankings with good Core Web Vitals
- **Lower bounce rates** with faster load times

---

## React Performance Patterns

### React.memo - Prevent Unnecessary Re-renders

```typescript
import { memo } from 'react'

// ✅ CORRECT - Memoize expensive components
export const ProductCard = memo(function ProductCard({
  product,
  onAddToCart
}: ProductCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{product.name}</CardTitle>
        <CardDescription>${product.price}</CardDescription>
      </CardHeader>
      <CardContent>
        <Image
          src={product.image}
          alt={product.name}
          width={200}
          height={200}
        />
      </CardContent>
      <CardFooter>
        <Button onClick={() => onAddToCart(product.id)}>
          Add to Cart
        </Button>
      </CardFooter>
    </Card>
  )
})

// Custom comparison function for complex props
export const UserCard = memo(
  function UserCard({ user, settings }: UserCardProps) {
    return <div>{/* User card content */}</div>
  },
  (prevProps, nextProps) => {
    // Only re-render if user ID changes
    return prevProps.user.id === nextProps.user.id
  }
)
```

### useCallback - Memoize Functions

```typescript
import { useCallback, useState } from 'react'

function ProductList({ products }: { products: Product[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // ✅ CORRECT - Memoize callback to prevent child re-renders
  const handleToggleProduct = useCallback((productId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.add(productId)
      }
      return next
    })
  }, [])

  // ✅ CORRECT - Memoize callback with dependencies
  const handleBulkAction = useCallback((action: string) => {
    if (action === 'delete') {
      // Delete selected products
      console.log('Deleting:', selectedIds)
    }
  }, [selectedIds])

  return (
    <div className="space-y-4">
      {products.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          onToggle={handleToggleProduct}  // Stable reference
        />
      ))}
    </div>
  )
}

// ❌ WRONG - New function on every render
function ProductListWrong({ products }: { products: Product[] }) {
  return (
    <div>
      {products.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          onToggle={(id) => console.log(id)}  // New function every render!
        />
      ))}
    </div>
  )
}
```

### useMemo - Memoize Expensive Calculations

```typescript
import { useMemo } from 'react'

function Dashboard({ transactions }: { transactions: Transaction[] }) {
  // ✅ CORRECT - Memoize expensive calculations
  const statistics = useMemo(() => {
    const total = transactions.reduce((sum, t) => sum + t.amount, 0)
    const average = total / transactions.length
    const max = Math.max(...transactions.map(t => t.amount))
    const min = Math.min(...transactions.map(t => t.amount))

    return { total, average, max, min }
  }, [transactions])

  // ✅ CORRECT - Memoize filtered/sorted arrays
  const recentTransactions = useMemo(() =>
    transactions
      .filter(t => t.date > Date.now() - 7 * 24 * 60 * 60 * 1000)
      .sort((a, b) => b.date - a.date)
      .slice(0, 10),
    [transactions]
  )

  return (
    <div>
      <StatsCard stats={statistics} />
      <RecentList transactions={recentTransactions} />
    </div>
  )
}

// ❌ WRONG - Don't memo simple operations
function SimpleComponent({ firstName, lastName }: UserProps) {
  // ❌ WRONG - Unnecessary memo for simple string concatenation
  const fullName = useMemo(() =>
    `${firstName} ${lastName}`,
    [firstName, lastName]
  )

  // ✅ CORRECT - Just calculate directly
  const fullNameCorrect = `${firstName} ${lastName}`

  return <p>{fullNameCorrect}</p>
}
```

### When to Use What

| Pattern | Use When | Example |
|---------|----------|---------|
| **React.memo** | Component re-renders unnecessarily | List items, cards |
| **useCallback** | Passing callbacks to memoized children | Event handlers |
| **useMemo** | Expensive calculations | Filtering, sorting large arrays |

---

## Code Splitting and Lazy Loading

### Dynamic Imports with React.lazy()

```typescript
import { lazy, Suspense } from 'react'
import { Skeleton } from '@/core/components/ui/skeleton'

// ✅ CORRECT - Lazy load heavy components
const HeavyChart = lazy(() => import('@/components/charts/HeavyChart'))
const RichTextEditor = lazy(() => import('@/components/editors/RichTextEditor'))

function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>

      {/* Chart only loads when rendered */}
      <Suspense fallback={<Skeleton className="w-full h-96" />}>
        <HeavyChart data={chartData} />
      </Suspense>

      {/* Editor only loads when user needs it */}
      <Suspense fallback={<Skeleton className="w-full h-64" />}>
        <RichTextEditor />
      </Suspense>
    </div>
  )
}
```

### Route-Based Code Splitting

```typescript
// app/dashboard/analytics/page.tsx
import { lazy, Suspense } from 'react'

// Lazy load entire page sections
const AnalyticsDashboard = lazy(() =>
  import('@/components/dashboard/AnalyticsDashboard')
)

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <AnalyticsDashboard />
    </Suspense>
  )
}
```

### Conditional Component Loading

```typescript
'use client'

import { lazy, Suspense, useState } from 'react'

// Only load modal when user clicks
const CreateProductModal = lazy(() =>
  import('@/components/modals/CreateProductModal')
)

function ProductsPage() {
  const [showModal, setShowModal] = useState(false)

  return (
    <div>
      <Button onClick={() => setShowModal(true)}>
        Create Product
      </Button>

      {showModal && (
        <Suspense fallback={<ModalSkeleton />}>
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

---

## Image Optimization

### Next.js Image Component

```typescript
import Image from 'next/image'

// ✅ CORRECT - Optimized image with sizes
function ProductImage({ product }: { product: Product }) {
  return (
    <div className="relative w-full h-64">
      <Image
        src={product.image}
        alt={product.name}
        fill
        className="object-cover"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        priority={false}  // Only true for above-the-fold images
      />
    </div>
  )
}

// ✅ CORRECT - Hero image with priority loading
function HeroSection() {
  return (
    <div className="relative w-full h-96">
      <Image
        src="/hero.jpg"
        alt="Hero banner"
        fill
        className="object-cover"
        sizes="100vw"
        priority  // Loads immediately (no lazy load)
        quality={90}
      />
    </div>
  )
}
```

### Responsive Images

```typescript
function ResponsiveProductImage({ product }: { product: Product }) {
  return (
    <picture>
      {/* Mobile */}
      <source
        media="(max-width: 640px)"
        srcSet={`${product.image}?w=640 1x, ${product.image}?w=1280 2x`}
      />

      {/* Tablet */}
      <source
        media="(max-width: 1024px)"
        srcSet={`${product.image}?w=768 1x, ${product.image}?w=1536 2x`}
      />

      {/* Desktop */}
      <Image
        src={product.image}
        alt={product.name}
        width={400}
        height={300}
        className="object-cover"
      />
    </picture>
  )
}
```

### Image Loading Strategies

```typescript
// ✅ CORRECT - Lazy load off-screen images
<Image
  src="/product.jpg"
  alt="Product"
  width={300}
  height={200}
  loading="lazy"  // Browser native lazy loading
/>

// ✅ CORRECT - Eager load critical images
<Image
  src="/logo.png"
  alt="Logo"
  width={150}
  height={50}
  loading="eager"  // Load immediately
  priority
/>

// ✅ CORRECT - Blur placeholder
<Image
  src="/product.jpg"
  alt="Product"
  width={400}
  height={300}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..."
/>
```

---

## Bundle Size Optimization

### Analyze Bundle Size

```bash
# Build and analyze bundle
npm run build

# Check bundle sizes
ls -lh .next/static/chunks/
```

### Dynamic Imports for Heavy Libraries

```typescript
// ✅ CORRECT - Only load when needed
async function exportToExcel(data: any[]) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(data)
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data')
  XLSX.writeFile(workbook, 'export.xlsx')
}

// ✅ CORRECT - Lazy load chart library
const Chart = lazy(async () => {
  const { Chart } = await import('chart.js')
  return { default: Chart }
})
```

### Tree Shaking

```typescript
// ✅ CORRECT - Import only what you need
import { format } from 'date-fns'

// ❌ WRONG - Imports entire library
import * as dateFns from 'date-fns'

// ✅ CORRECT - Named imports
import { Button } from '@/core/components/ui/button'

// ❌ WRONG - Imports entire module
import * as UI from '@/core/components/ui'
```

### Remove Unused Dependencies

```bash
# Find unused dependencies
npx depcheck

# Remove unused packages
npm uninstall unused-package
```

---

## Virtualization for Long Lists

### React Window for Large Lists

```typescript
import { FixedSizeList } from 'react-window'

// ✅ CORRECT - Virtualize lists with 100+ items
function VirtualizedProductList({ products }: { products: Product[] }) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <ProductCard product={products[index]} />
    </div>
  )

  return (
    <FixedSizeList
      height={600}        // Viewport height
      itemCount={products.length}
      itemSize={120}      // Each item height
      width="100%"
    >
      {Row}
    </FixedSizeList>
  )
}
```

### Variable Size Lists

```typescript
import { VariableSizeList } from 'react-window'

function VirtualizedCommentList({ comments }: { comments: Comment[] }) {
  const listRef = useRef<VariableSizeList>(null)

  // Calculate item height dynamically
  const getItemSize = (index: number) => {
    const comment = comments[index]
    const baseHeight = 60
    const contentHeight = comment.content.length * 0.5
    return baseHeight + contentHeight
  }

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <CommentCard comment={comments[index]} />
    </div>
  )

  return (
    <VariableSizeList
      ref={listRef}
      height={800}
      itemCount={comments.length}
      itemSize={getItemSize}
      width="100%"
    >
      {Row}
    </VariableSizeList>
  )
}
```

### Infinite Scroll

```typescript
import InfiniteLoader from 'react-window-infinite-loader'
import { FixedSizeList } from 'react-window'

function InfiniteProductList() {
  const [items, setItems] = useState<Product[]>([])
  const [hasMore, setHasMore] = useState(true)

  const loadMoreItems = async (startIndex: number, stopIndex: number) => {
    const newItems = await fetchProducts(startIndex, stopIndex)
    setItems(prev => [...prev, ...newItems])
    setHasMore(newItems.length > 0)
  }

  const isItemLoaded = (index: number) => index < items.length

  const Item = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    if (!isItemLoaded(index)) {
      return <div style={style}>Loading...</div>
    }

    return (
      <div style={style}>
        <ProductCard product={items[index]} />
      </div>
    )
  }

  return (
    <InfiniteLoader
      isItemLoaded={isItemLoaded}
      itemCount={hasMore ? items.length + 1 : items.length}
      loadMoreItems={loadMoreItems}
    >
      {({ onItemsRendered, ref }) => (
        <FixedSizeList
          ref={ref}
          onItemsRendered={onItemsRendered}
          height={600}
          itemCount={items.length}
          itemSize={120}
          width="100%"
        >
          {Item}
        </FixedSizeList>
      )}
    </InfiniteLoader>
  )
}
```

---

## Core Web Vitals

### Largest Contentful Paint (LCP)

**Target: < 2.5 seconds**

```typescript
// ✅ CORRECT - Optimize LCP
function HomePage() {
  return (
    <>
      {/* Hero image - largest content, load with priority */}
      <Image
        src="/hero.jpg"
        alt="Hero"
        fill
        priority  // Preload
        sizes="100vw"
      />

      {/* Critical CSS inline */}
      <style jsx>{`
        .hero {
          /* Inline critical styles */
        }
      `}</style>
    </>
  )
}

// Preload fonts
// app/layout.tsx
export default function RootLayout({ children }: LayoutProps) {
  return (
    <html>
      <head>
        <link
          rel="preload"
          href="/fonts/inter.woff2"
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

### First Input Delay (FID) / Interaction to Next Paint (INP)

**Target: < 100ms**

```typescript
// ✅ CORRECT - Debounce expensive operations
import { useDebouncedCallback } from 'use-debounce'

function SearchInput() {
  const [query, setQuery] = useState('')

  const debouncedSearch = useDebouncedCallback(
    async (searchQuery: string) => {
      const results = await searchProducts(searchQuery)
      setResults(results)
    },
    300  // Wait 300ms after user stops typing
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    debouncedSearch(value)
  }

  return (
    <Input
      value={query}
      onChange={handleChange}
      placeholder="Search products..."
    />
  )
}
```

### Cumulative Layout Shift (CLS)

**Target: < 0.1**

```typescript
// ✅ CORRECT - Reserve space for images
<div className="relative w-full aspect-video">
  <Image
    src="/product.jpg"
    alt="Product"
    fill
    className="object-cover"
  />
</div>

// ✅ CORRECT - Reserve space for dynamic content
<div className="min-h-[200px]">
  {isLoading ? (
    <Skeleton className="h-[200px]" />
  ) : (
    <ProductList products={products} />
  )}
</div>

// ❌ WRONG - No space reservation
<div>
  {isLoading ? 'Loading...' : <ProductList products={products} />}
</div>
```

---

## Monitoring and Measuring

### Performance Monitoring Hook

```typescript
'use client'

import { useEffect } from 'react'

export function usePerformanceMonitor(componentName: string) {
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        console.log(`${componentName} - ${entry.name}:`, entry.duration)

        // Send to analytics
        if (typeof window !== 'undefined' && window.gtag) {
          window.gtag('event', 'performance', {
            component: componentName,
            metric: entry.name,
            value: Math.round(entry.duration),
          })
        }
      }
    })

    observer.observe({ entryTypes: ['measure'] })

    return () => observer.disconnect()
  }, [componentName])
}

// Usage
function HeavyComponent() {
  usePerformanceMonitor('HeavyComponent')

  useEffect(() => {
    performance.mark('heavy-start')

    // Heavy operation
    doExpensiveWork()

    performance.mark('heavy-end')
    performance.measure('heavy-operation', 'heavy-start', 'heavy-end')
  }, [])

  return <div>Content</div>
}
```

### Web Vitals Reporting

```typescript
// app/layout.tsx
'use client'

import { useReportWebVitals } from 'next/web-vitals'

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    console.log(metric)

    // Send to analytics
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', metric.name, {
        value: Math.round(metric.value),
        event_label: metric.id,
        non_interaction: true,
      })
    }
  })

  return null
}
```

### Lighthouse CI

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            https://your-site.com
            https://your-site.com/products
          budgetPath: ./lighthouse-budget.json
```

---

## Next.js 15 Optimizations

### Server Components (Default)

```typescript
// ✅ CORRECT - Use server components by default
export default async function ProductsPage() {
  const products = await fetchProducts()  // Direct database query

  return (
    <div>
      <h1>Products</h1>
      <ProductGrid products={products} />
    </div>
  )
}

// Only add 'use client' when needed
'use client'

export function InteractiveProductCard({ product }: ProductCardProps) {
  const [quantity, setQuantity] = useState(1)

  return (
    <Card>
      {/* Interactive content */}
    </Card>
  )
}
```

### Streaming with Suspense

```typescript
import { Suspense } from 'react'

export default function DashboardPage() {
  return (
    <div>
      {/* Fast content renders immediately */}
      <h1>Dashboard</h1>

      {/* Slow content streams in */}
      <Suspense fallback={<StatsSkeleton />}>
        <DashboardStats />
      </Suspense>

      <Suspense fallback={<ChartSkeleton />}>
        <RevenueChart />
      </Suspense>

      <Suspense fallback={<TableSkeleton />}>
        <RecentOrders />
      </Suspense>
    </div>
  )
}

// Each component fetches data independently
async function DashboardStats() {
  const stats = await fetchStats()  // Slow query
  return <StatsGrid stats={stats} />
}
```

### Partial Prerendering (Experimental)

```typescript
// next.config.js
module.exports = {
  experimental: {
    ppr: true,  // Partial Prerendering
  },
}

// Combines static and dynamic rendering
export default function ProductPage({ params }: { params: { id: string } }) {
  return (
    <div>
      {/* Static shell renders immediately */}
      <ProductLayout>
        {/* Dynamic content streams in */}
        <Suspense fallback={<ProductSkeleton />}>
          <ProductDetails id={params.id} />
        </Suspense>

        {/* Dynamic recommendations */}
        <Suspense fallback={<RecommendationsSkeleton />}>
          <ProductRecommendations id={params.id} />
        </Suspense>
      </ProductLayout>
    </div>
  )
}
```

---

## Best Practices

### 1. Measure Before Optimizing

✅ **CORRECT**:
```typescript
// Use performance profiler to find bottlenecks
// React DevTools > Profiler
// Chrome DevTools > Performance
```

### 2. Optimize What Matters

✅ **CORRECT** - Optimize slow components:
```typescript
// List with 1000+ items → Virtualize
<VirtualizedList items={items} />

// Heavy computation → Memoize
const result = useMemo(() => expensiveCalculation(data), [data])

// Large bundle → Code split
const HeavyComponent = lazy(() => import('./HeavyComponent'))
```

### 3. Use the Right Tool

| Problem | Solution |
|---------|----------|
| Re-rendering | React.memo |
| Unstable callbacks | useCallback |
| Expensive calculation | useMemo |
| Large bundle | Code splitting |
| Long list | Virtualization |
| Slow images | Next/Image |

---

## Common Pitfalls

### ❌ WRONG Patterns

```typescript
// 1. Over-optimization
const fullName = useMemo(() => `${firstName} ${lastName}`, [firstName, lastName])

// 2. Missing dependencies
useCallback(() => {
  doSomething(value)  // 'value' missing from deps
}, [])

// 3. Not splitting large bundles
import * as Icons from 'lucide-react'  // 50KB+ bundle

// 4. Loading all images eagerly
<Image src="/hero.jpg" priority />
<Image src="/icon1.jpg" priority />  // Only 1-2 should have priority
<Image src="/icon2.jpg" priority />

// 5. No virtualization for long lists
{items.map(item => <Item key={item.id} item={item} />)}  // 10,000 items!
```

### ✅ CORRECT Patterns

```typescript
// 1. Optimize strategically
const fullName = `${firstName} ${lastName}`  // Simple operation, no memo needed

// 2. Correct dependencies
useCallback(() => {
  doSomething(value)
}, [value])

// 3. Dynamic imports
const Icons = await import('lucide-react')
const SpecificIcon = Icons.ChevronRight

// 4. Strategic priority loading
<Image src="/hero.jpg" priority />  // Above fold only
<Image src="/icon1.jpg" loading="lazy" />
<Image src="/icon2.jpg" loading="lazy" />

// 5. Virtualize long lists
<VirtualizedList items={items} />
```

---

## Related Documentation

- **[State Management](./05-state-management.md)** - Optimized state patterns
- **[Responsive Design](./08-responsive-design.md)** - Image optimization
- **[Component Architecture](./01-component-architecture.md)** - Component organization

---

## Resources

### Tools

- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - Performance auditing
- [WebPageTest](https://www.webpagetest.org/) - Real-world performance testing
- [React DevTools Profiler](https://react.dev/learn/react-developer-tools) - Component profiling
- [Bundle Analyzer](https://www.npmjs.com/package/@next/bundle-analyzer) - Analyze bundle size

### Documentation

- [Next.js Performance](https://nextjs.org/docs/app/building-your-application/optimizing)
- [React Performance](https://react.dev/learn/render-and-commit#optimizing-performance)
- [Web.dev Performance](https://web.dev/performance/)
- [Core Web Vitals](https://web.dev/vitals/)

### Libraries

- [react-window](https://github.com/bvaughn/react-window) - Virtualization
- [use-debounce](https://github.com/xnimorz/use-debounce) - Debouncing hooks
- [next/image](https://nextjs.org/docs/api-reference/next/image) - Image optimization
