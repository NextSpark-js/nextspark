# Performance Monitoring and Profiling

## Introduction

Performance monitoring and profiling are **essential for maintaining speed** as your application evolves. You can't improve what you don't measure. This guide covers tools, techniques, and strategies for identifying bottlenecks, measuring improvements, and preventing performance regressions.

**Core Principle:** Measure continuously, optimize strategically.

---

## Monitoring vs Profiling

### Understanding the Difference

```typescript
const MONITORING_VS_PROFILING = {
  monitoring: {
    what: 'Continuous measurement in production',
    when: 'All the time, real users',
    purpose: 'Detect issues, track trends',
    tools: ['Web Vitals', 'Vercel Analytics', 'Real User Monitoring'],
    metrics: ['LCP', 'INP', 'CLS', 'Page load time'],
  },
  
  profiling: {
    what: 'Detailed analysis of specific operations',
    when: 'During development, specific scenarios',
    purpose: 'Find bottlenecks, optimize code',
    tools: ['React DevTools', 'Chrome Performance', 'Lighthouse'],
    metrics: ['Component render time', 'JavaScript execution', 'Memory usage'],
  },
}
```

**Use Both:**
- **Monitoring** tells you *what* is slow
- **Profiling** tells you *why* it's slow

---

## React DevTools Profiler

### Measuring Component Performance

```typescript
// 1. Install React DevTools extension (Chrome/Firefox)
// 2. Open DevTools → Profiler tab
// 3. Click "Record" button
// 4. Interact with your app
// 5. Click "Stop" to analyze
```

### Reading the Profiler

```typescript
const PROFILER_VIEWS = {
  flamegraph: {
    description: 'Shows component render hierarchy',
    lookFor: [
      'Wide bars = component took long to render',
      'Deep nesting = many child renders',
      'Gray = did not render (good)',
      'Yellow/Orange = slow (needs optimization)',
    ],
  },
  
  rankedChart: {
    description: 'Components sorted by render time',
    lookFor: [
      'Top components = biggest bottlenecks',
      'Look for patterns (same component multiple times)',
    ],
  },
  
  commitTimeline: {
    description: 'All renders over time',
    lookFor: [
      'Tall spikes = expensive renders',
      'Frequent commits = too many re-renders',
    ],
  },
}
```

### Identifying Issues

```typescript
// ⚠️ RED FLAGS in Profiler
const PROFILER_RED_FLAGS = [
  'Component renders > 16ms (drops below 60fps)',
  'Same component renders multiple times in one commit',
  'Deep component trees rendering together',
  'Components rendering without prop changes',
  'Long "commit" times (>50ms)',
]

// Example analysis
const ANALYSIS_EXAMPLE = {
  component: 'ProductList',
  renderTime: '145ms',  // ❌ Way too slow
  renderCount: '3',     // ❌ Rendered 3 times in one update
  
  diagnosis: 'Missing React.memo, re-rendering on every parent update',
  
  solution: [
    'Wrap with React.memo',
    'Memoize callback props with useCallback',
    'Move state closer to usage',
  ],
}
```

### Programmatic Profiling

```typescript
import { Profiler, ProfilerOnRenderCallback } from 'react'

const onRender: ProfilerOnRenderCallback = (
  id,          // Component identifier
  phase,       // 'mount' or 'update'
  actualDuration,  // Time to render
  baseDuration,    // Time without memoization
  startTime,
  commitTime
) => {
  console.log(`${id} (${phase}): ${actualDuration}ms`)
  
  // Alert on slow renders
  if (actualDuration > 16) {
    console.warn(`Slow render detected: ${id} took ${actualDuration}ms`)
    
    // Send to analytics
    fetch('/api/analytics/performance', {
      method: 'POST',
      body: JSON.stringify({
        component: id,
        duration: actualDuration,
        phase,
        timestamp: Date.now(),
      }),
    })
  }
}

export default function App() {
  return (
    <Profiler id="App" onRender={onRender}>
      <Dashboard />
    </Profiler>
  )
}
```

---

## Chrome DevTools Performance Tab

### Recording a Performance Profile

```typescript
const CHROME_PERFORMANCE_WORKFLOW = {
  1: 'Open DevTools (Cmd+Option+I)',
  2: 'Go to Performance tab',
  3: 'Click "Record" (or Cmd+E)',
  4: 'Perform actions you want to analyze',
  5: 'Click "Stop" (or Cmd+E)',
  6: 'Analyze the timeline',
}
```

### Understanding the Timeline

```typescript
const TIMELINE_SECTIONS = {
  FPS: 'Frames per second (aim for 60fps)',
  CPU: 'JavaScript execution time',
  NET: 'Network requests',
  
  mainThread: {
    yellow: 'JavaScript execution',
    purple: 'Layout/Reflow',
    green: 'Painting',
    gray: 'Other/Idle',
  },
  
  interactions: {
    click: 'User clicks',
    input: 'Form inputs',
    scroll: 'Scroll events',
  },
}
```

### Finding Bottlenecks

```typescript
// Common performance issues in Chrome DevTools

const CHROME_ISSUES = {
  longTasks: {
    symptom: 'Yellow blocks > 50ms',
    cause: 'Heavy JavaScript blocking main thread',
    solution: [
      'Break up long tasks',
      'Use Web Workers',
      'Debounce/throttle events',
    ],
  },
  
  layoutThrashing: {
    symptom: 'Purple blocks after yellow (read → write → read)',
    cause: 'Forced synchronous layouts',
    solution: [
      'Batch DOM reads, then batch writes',
      'Use CSS transforms instead of layout properties',
    ],
  },
  
  excessivePainting: {
    symptom: 'Green blocks taking > 16ms',
    cause: 'Large paint areas or complex CSS',
    solution: [
      'Use will-change CSS property',
      'Reduce paint complexity',
      'Use CSS containment',
    ],
  },
}
```

### Example Analysis

```typescript
// Analyzing a slow interaction

const SLOW_INTERACTION_ANALYSIS = {
  issue: 'Button click takes 450ms to show feedback',
  
  timeline: {
    '0ms': 'Click event',
    '5ms': 'Event handler starts',
    '280ms': 'Heavy calculation (blocking)',  // ⚠️ Problem
    '285ms': 'State update',
    '320ms': 'React reconciliation',
    '350ms': 'Layout calculation',
    '420ms': 'Paint',
    '450ms': 'User sees feedback',
  },
  
  diagnosis: 'Heavy synchronous calculation blocking main thread',
  
  solution: {
    before: `
      function handleClick() {
        const result = heavyCalculation(data)  // 280ms
        setState(result)
      }
    `,
    after: `
      function handleClick() {
        // Immediate feedback
        setState({ loading: true })
        
        // Move calculation to background
        setTimeout(() => {
          const result = heavyCalculation(data)
          setState({ loading: false, result })
        }, 0)
      }
    `,
  },
  
  improvement: '450ms → 50ms perceived response time',
}
```

---

## Lighthouse

### Running Lighthouse Audits

```bash
# Method 1: Chrome DevTools
# Open DevTools → Lighthouse tab → "Analyze page load"

# Method 2: CLI
pnpm add -D lighthouse

npx lighthouse https://localhost:3000 \
  --only-categories=performance \
  --view

# Method 3: CI Integration (see below)
```

### Understanding Lighthouse Scores

```typescript
const LIGHTHOUSE_SCORES = {
  performance: {
    weight: 'Most important for speed',
    metrics: {
      LCP: 25,    // 25% weight
      TBT: 30,    // 30% weight (Total Blocking Time)
      CLS: 15,    // 15% weight
      FCP: 10,    // 10% weight (First Contentful Paint)
      SI: 10,     // 10% weight (Speed Index)
      TTI: 10,    // 10% weight (Time to Interactive)
    },
  },
  
  scoring: {
    '90-100': 'Good (Green)',
    '50-89': 'Needs Improvement (Orange)',
    '0-49': 'Poor (Red)',
  },
}
```

### Key Sections in Report

```typescript
const LIGHTHOUSE_SECTIONS = {
  metrics: {
    description: 'Core performance metrics',
    lookFor: 'Red/Orange metrics to improve',
  },
  
  opportunities: {
    description: 'Specific improvements with estimated impact',
    examples: [
      'Reduce unused JavaScript (saves 2.4s)',
      'Properly size images (saves 1.8s)',
      'Eliminate render-blocking resources (saves 1.2s)',
    ],
  },
  
  diagnostics: {
    description: 'Additional performance information',
    examples: [
      'Avoid enormous network payloads',
      'Serve images in next-gen formats',
      'Reduce JavaScript execution time',
    ],
  },
}
```

---

## Lighthouse CI

### Continuous Performance Monitoring

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI

on: [pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Build app
        run: pnpm build
      
      - name: Start server
        run: pnpm start &
      
      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            http://localhost:3000
            http://localhost:3000/dashboard
          uploadArtifacts: true
          temporaryPublicStorage: true
```

### Lighthouse CI Configuration

```javascript
// .lighthouserc.js
module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3,  // Run 3 times, take median
      startServerCommand: 'pnpm start',
      url: [
        'http://localhost:3000',
        'http://localhost:3000/dashboard',
      ],
    },
    assert: {
      assertions: {
        // Fail CI if performance < 90
        'categories:performance': ['error', { minScore: 0.9 }],
        
        // Fail if Core Web Vitals poor
        'first-contentful-paint': ['error', { maxNumericValue: 1800 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
        
        // Warn on specific issues
        'uses-responsive-images': 'warn',
        'offscreen-images': 'warn',
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
}
```

---

## Web Vitals Monitoring

### Real User Monitoring (RUM)

```typescript
// app/components/WebVitals.tsx
'use client'

import { useEffect } from 'react'
import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'web-vitals'

export function WebVitals() {
  useEffect(() => {
    const sendToAnalytics = (metric: any) => {
      // Send to your analytics service
      const body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
        navigationType: metric.navigationType,
      })

      // Use sendBeacon for reliability
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics/web-vitals', body)
      } else {
        fetch('/api/analytics/web-vitals', {
          method: 'POST',
          body,
          keepalive: true,
        })
      }
    }

    // Monitor all Core Web Vitals
    onCLS(sendToAnalytics)
    onINP(sendToAnalytics)
    onLCP(sendToAnalytics)
    onFCP(sendToAnalytics)
    onTTFB(sendToAnalytics)
  }, [])

  return null
}

// app/layout.tsx
import { WebVitals } from './components/WebVitals'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <WebVitals />
      </body>
    </html>
  )
}
```

### API Route for Web Vitals

```typescript
// app/api/analytics/web-vitals/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const metric = await request.json()

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Web Vital:', metric)
  }

  // Store in database for production
  if (process.env.NODE_ENV === 'production') {
    await storeMetric({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      timestamp: new Date(),
      url: request.headers.get('referer'),
      userAgent: request.headers.get('user-agent'),
    })
  }

  // Alert on poor performance
  if (metric.rating === 'poor') {
    await sendAlert({
      type: 'poor_web_vital',
      metric: metric.name,
      value: metric.value,
      url: request.headers.get('referer'),
    })
  }

  return NextResponse.json({ success: true })
}
```

---

## Performance Budgets

### Setting Budgets

```typescript
// performance-budget.ts
export const PERFORMANCE_BUDGETS = {
  // Bundle sizes (gzipped)
  bundles: {
    initial: 150,       // KB
    route: 100,         // KB per route
    total: 500,         // KB total
  },
  
  // Core Web Vitals
  webVitals: {
    LCP: 2500,          // ms
    INP: 200,           // ms
    CLS: 0.1,           // score
    FCP: 1800,          // ms
    TTI: 3800,          // ms
  },
  
  // Resource counts
  resources: {
    requests: 50,       // Total requests
    images: 20,         // Image requests
    scripts: 10,        // Script requests
  },
  
  // Lighthouse scores
  lighthouse: {
    performance: 90,    // Minimum score
    accessibility: 95,
    bestPractices: 90,
    seo: 95,
  },
}
```

### Enforcing Budgets

```javascript
// .lighthouserc.js
module.exports = {
  ci: {
    assert: {
      budgets: [
        {
          path: '/*',
          resourceSizes: [
            { resourceType: 'script', budget: 150 },  // KB
            { resourceType: 'image', budget: 500 },
            { resourceType: 'stylesheet', budget: 50 },
            { resourceType: 'total', budget: 1000 },
          ],
          resourceCounts: [
            { resourceType: 'script', budget: 10 },
            { resourceType: 'third-party', budget: 5 },
          ],
        },
      ],
    },
  },
}
```

---

## Memory Profiling

### Detecting Memory Leaks

```typescript
// Using Chrome DevTools Memory Profiler

const MEMORY_PROFILING_STEPS = {
  1: 'Open DevTools → Memory tab',
  2: 'Take heap snapshot (baseline)',
  3: 'Perform actions that might leak',
  4: 'Force garbage collection (trash icon)',
  5: 'Take another heap snapshot',
  6: 'Compare snapshots',
  7: 'Look for objects that should have been freed',
}

// Common memory leaks
const COMMON_LEAKS = {
  eventListeners: {
    issue: 'Event listeners not removed',
    example: `
      useEffect(() => {
        window.addEventListener('resize', handleResize)
        // ❌ Missing cleanup
      }, [])
    `,
    fix: `
      useEffect(() => {
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
      }, [])
    `,
  },
  
  timers: {
    issue: 'Timers not cleared',
    example: `
      useEffect(() => {
        const interval = setInterval(updateData, 1000)
        // ❌ Missing cleanup
      }, [])
    `,
    fix: `
      useEffect(() => {
        const interval = setInterval(updateData, 1000)
        return () => clearInterval(interval)
      }, [])
    `,
  },
  
  closures: {
    issue: 'Large objects captured in closures',
    example: `
      const largeData = fetchLargeDataset()  // 10MB
      
      const handleClick = () => {
        console.log(largeData[0])  // Captures entire 10MB
      }
    `,
    fix: `
      const largeData = fetchLargeDataset()
      const firstItem = largeData[0]  // Extract only what's needed
      
      const handleClick = () => {
        console.log(firstItem)  // Captures only small reference
      }
    `,
  },
}
```

---

## Continuous Performance Monitoring

### Setting Up Alerts

```typescript
// Alert on performance regressions
export async function checkPerformanceRegression(
  current: Metrics,
  baseline: Metrics
) {
  const THRESHOLDS = {
    LCP: 0.1,      // 10% regression
    INP: 0.15,     // 15% regression
    CLS: 0.2,      // 20% regression
  }

  const regressions: string[] = []

  if (current.LCP > baseline.LCP * (1 + THRESHOLDS.LCP)) {
    regressions.push(`LCP regressed: ${baseline.LCP}ms → ${current.LCP}ms`)
  }

  if (current.INP > baseline.INP * (1 + THRESHOLDS.INP)) {
    regressions.push(`INP regressed: ${baseline.INP}ms → ${current.INP}ms`)
  }

  if (current.CLS > baseline.CLS * (1 + THRESHOLDS.CLS)) {
    regressions.push(`CLS regressed: ${baseline.CLS} → ${current.CLS}`)
  }

  if (regressions.length > 0) {
    await sendAlert({
      type: 'performance_regression',
      regressions,
      current,
      baseline,
    })
  }
}
```

---

## Best Practices Summary

### ✅ DO

```typescript
// Profile during development
// Use React DevTools Profiler regularly

// Monitor in production
<WebVitals />  // Track real user metrics

// Set performance budgets
// Fail CI if budgets exceeded

// Clean up resources
useEffect(() => {
  const listener = () => {}
  window.addEventListener('resize', listener)
  return () => window.removeEventListener('resize', listener)
}, [])

// Alert on regressions
if (currentLCP > baselineLCP * 1.1) sendAlert()
```

### ❌ DON'T

```typescript
// Ignore production metrics
// Only test locally

// Profile without context
// Understand *why* something is slow

// Set unrealistic budgets
// LCP: 0.5s  ← Impossible for complex pages

// Forget to clean up
useEffect(() => {
  setInterval(fn, 1000)
  // Missing cleanup → memory leak
}, [])

// Skip CI checks
// Performance regressions slip through
```

---

## Monitoring Checklist

```typescript
const MONITORING_CHECKLIST = {
  development: [
    '✅ React DevTools Profiler installed',
    '✅ Chrome Performance tab profiling done',
    '✅ Lighthouse audits run regularly',
    '✅ Bundle analyzer checked',
  ],
  
  production: [
    '✅ Web Vitals monitoring active',
    '✅ Performance budgets enforced in CI',
    '✅ Alerts configured for regressions',
    '✅ Regular performance reviews scheduled',
  ],
  
  continuous: [
    '✅ Lighthouse CI in pull requests',
    '✅ Performance metrics in dashboard',
    '✅ Automated regression detection',
    '✅ Weekly performance reports',
  ],
}
```

---

## Next Steps

- **Set up monitoring:** Add Web Vitals tracking to production
- **Profile locally:** Use React DevTools to find bottlenecks
- **Configure CI:** Add Lighthouse CI to your pipeline
- **Set budgets:** Define and enforce performance budgets

**Related Documentation:**
- [Performance Overview](./01-performance-overview.md) - Overall strategy
- [Core Web Vitals](./07-core-web-vitals.md) - Key metrics to track
- [Runtime Performance](./03-runtime-performance.md) - Optimization techniques

---

**Last Updated:** 2025-11-20  
**Version:** 1.0.0  
**Status:** Complete  
**Tools:** React DevTools, Chrome DevTools, Lighthouse, Web Vitals API
