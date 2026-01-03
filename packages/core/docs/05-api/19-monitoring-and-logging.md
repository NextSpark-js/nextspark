# Monitoring and Logging

**Production monitoring • Error tracking • Performance metrics • Logging strategies**

---

## Table of Contents

- [Overview](#overview)
- [Application Logging](#application-logging)
- [Error Tracking](#error-tracking)
- [Performance Monitoring](#performance-monitoring)
- [API Metrics](#api-metrics)
- [Alerting](#alerting)
- [Log Management](#log-management)

---

## Overview

**Production-ready monitoring** for API v1.

**Key Objectives:**
- ✅ Track API performance and errors
- ✅ Monitor rate limits and quotas
- ✅ Detect and alert on anomalies
- ✅ Analyze usage patterns
- ✅ Debug production issues

**Tools:**
- **Logging:** Pino, Winston
- **Error Tracking:** Sentry
- **APM:** Vercel Analytics, New Relic
- **Metrics:** Prometheus, Grafana
- **Logs:** Logtail, Datadog

---

## Application Logging

### Structured Logging with Pino

```typescript
// lib/logger.ts
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label })
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['req.headers.authorization', 'apiKey', 'password'],
    remove: true
  }
})

// Usage in API routes
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()

  logger.info({
    requestId,
    method: request.method,
    url: request.url,
    headers: request.headers
  }, 'API request received')

  try {
    const result = await getTasks()

    logger.info({
      requestId,
      count: result.length,
      duration: Date.now() - start
    }, 'Request successful')

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    logger.error({
      requestId,
      error: error.message,
      stack: error.stack
    }, 'Request failed')

    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 }
    )
  }
}
```

### Request/Response Logging Middleware

```typescript
// middleware/logging.ts
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export function loggingMiddleware(request: NextRequest) {
  const start = Date.now()
  const requestId = crypto.randomUUID()

  // Log request
  logger.info({
    requestId,
    method: request.method,
    url: request.url,
    userAgent: request.headers.get('user-agent'),
    ip: request.headers.get('x-forwarded-for')
  }, 'Incoming request')

  // Continue to handler
  const response = NextResponse.next()

  // Log response
  const duration = Date.now() - start

  logger.info({
    requestId,
    status: response.status,
    duration
  }, 'Request completed')

  // Add request ID to response headers
  response.headers.set('X-Request-ID', requestId)

  return response
}
```

### Log Levels

```typescript
// Different log levels for different scenarios
logger.trace('Detailed debug information')
logger.debug('Debug information')
logger.info('Informational messages')
logger.warn('Warning messages')
logger.error('Error messages')
logger.fatal('Fatal errors')

// Contextual logging
logger.info({
  userId: 'usr_123',
  action: 'create_task',
  entityId: 'tsk_456'
}, 'User created task')

// Performance logging
const start = Date.now()
const result = await expensiveOperation()
logger.info({
  operation: 'expensiveOperation',
  duration: Date.now() - start,
  resultCount: result.length
}, 'Operation completed')
```

---

## Error Tracking

### Sentry Integration

```typescript
// lib/sentry.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,

  beforeSend(event, hint) {
    // Filter sensitive data
    if (event.request?.headers) {
      delete event.request.headers.authorization
      delete event.request.headers.cookie
    }

    return event
  }
})

// Usage in API routes
export async function POST(request: NextRequest) {
  try {
    const result = await createTask(data)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    // Track error in Sentry
    Sentry.captureException(error, {
      tags: {
        endpoint: '/api/v1/tasks',
        method: 'POST'
      },
      user: {
        id: session?.user?.id
      },
      extra: {
        requestBody: await request.json()
      }
    })

    return NextResponse.json(
      { success: false, error: 'Failed to create task' },
      { status: 500 }
    )
  }
}
```

### Custom Error Tracking

```typescript
// lib/error-tracking.ts
interface ErrorEvent {
  error: Error
  context: {
    userId?: string
    endpoint: string
    method: string
    requestId: string
  }
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export async function trackError(event: ErrorEvent) {
  // Log to application logs
  logger.error({
    error: event.error.message,
    stack: event.error.stack,
    context: event.context,
    severity: event.severity
  }, 'Error tracked')

  // Send to error tracking service
  await Sentry.captureException(event.error, {
    tags: {
      severity: event.severity,
      endpoint: event.context.endpoint
    },
    user: event.context.userId ? { id: event.context.userId } : undefined
  })

  // Alert if critical
  if (event.severity === 'critical') {
    await sendAlertToSlack({
      title: 'Critical Error',
      message: event.error.message,
      context: event.context
    })
  }
}
```

---

## Performance Monitoring

### Request Timing

```typescript
// lib/performance.ts
export class PerformanceMonitor {
  private marks: Map<string, number> = new Map()

  mark(name: string) {
    this.marks.set(name, Date.now())
  }

  measure(name: string, startMark: string): number {
    const start = this.marks.get(startMark)
    if (!start) throw new Error(`Start mark ${startMark} not found`)

    const duration = Date.now() - start

    logger.info({
      metric: name,
      duration,
      startMark
    }, 'Performance measurement')

    return duration
  }

  getServerTiming(): string {
    const timings: string[] = []

    this.marks.forEach((time, name) => {
      timings.push(`${name};dur=${time}`)
    })

    return timings.join(', ')
  }
}

// Usage in API route
export async function GET(request: NextRequest) {
  const perf = new PerformanceMonitor()

  perf.mark('start')

  // Database query
  perf.mark('db-start')
  const tasks = await db.findMany('tasks')
  const dbDuration = perf.measure('db-query', 'db-start')

  // Processing
  perf.mark('process-start')
  const processed = processTasks(tasks)
  const processDuration = perf.measure('processing', 'process-start')

  const totalDuration = perf.measure('total', 'start')

  return NextResponse.json(
    { success: true, data: processed },
    {
      headers: {
        'Server-Timing': perf.getServerTiming()
      }
    }
  )
}
```

### Core Web Vitals

```typescript
// lib/web-vitals.ts
import { onCLS, onFID, onLCP, onFCP, onTTFB } from 'web-vitals'

export function reportWebVitals() {
  onCLS((metric) => {
    logger.info({
      name: metric.name,
      value: metric.value,
      rating: metric.rating
    }, 'Web vital: CLS')
  })

  onFID((metric) => {
    logger.info({
      name: metric.name,
      value: metric.value,
      rating: metric.rating
    }, 'Web vital: FID')
  })

  onLCP((metric) => {
    logger.info({
      name: metric.name,
      value: metric.value,
      rating: metric.rating
    }, 'Web vital: LCP')
  })
}
```

---

## API Metrics

### Usage Metrics

```typescript
// lib/metrics.ts
import { redis } from '@/lib/redis'

export async function trackApiUsage(
  userId: string,
  endpoint: string,
  method: string
) {
  const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const hour = new Date().getHours()

  // Increment counters
  await Promise.all([
    // Daily total
    redis.incr(`metrics:daily:${date}:requests`),

    // Per user
    redis.incr(`metrics:daily:${date}:user:${userId}:requests`),

    // Per endpoint
    redis.incr(`metrics:daily:${date}:endpoint:${endpoint}:requests`),

    // Per hour
    redis.incr(`metrics:hourly:${date}:${hour}:requests`)
  ])

  // Track response time
  await redis.zadd(
    `metrics:response_times:${date}`,
    Date.now(),
    `${endpoint}:${method}`
  )
}

// Get metrics
export async function getApiMetrics(date: string) {
  const [
    totalRequests,
    endpoints,
    responseTimes
  ] = await Promise.all([
    redis.get(`metrics:daily:${date}:requests`),
    redis.keys(`metrics:daily:${date}:endpoint:*`),
    redis.zrange(`metrics:response_times:${date}`, 0, -1, 'WITHSCORES')
  ])

  return {
    totalRequests: parseInt(totalRequests || '0'),
    endpointBreakdown: endpoints,
    averageResponseTime: calculateAverage(responseTimes)
  }
}
```

### Rate Limit Metrics

```typescript
// Track rate limit hits
export async function trackRateLimitHit(
  userId: string,
  endpoint: string
) {
  const date = new Date().toISOString().split('T')[0]

  await redis.incr(`metrics:rate_limits:${date}:${userId}`)

  logger.warn({
    userId,
    endpoint,
    date
  }, 'Rate limit exceeded')
}

// Get rate limit stats
export async function getRateLimitStats(date: string) {
  const keys = await redis.keys(`metrics:rate_limits:${date}:*`)

  const stats = await Promise.all(
    keys.map(async (key) => {
      const userId = key.split(':').pop()
      const count = await redis.get(key)

      return { userId, hits: parseInt(count || '0') }
    })
  )

  return stats.sort((a, b) => b.hits - a.hits)
}
```

---

## Alerting

### Slack Alerts

```typescript
// lib/alerts.ts
export async function sendSlackAlert(alert: {
  title: string
  message: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  context?: Record<string, any>
}) {
  const colors = {
    info: '#36a64f',
    warning: '#ff9800',
    error: '#f44336',
    critical: '#d32f2f'
  }

  const webhook = process.env.SLACK_WEBHOOK_URL

  await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attachments: [{
        color: colors[alert.severity],
        title: alert.title,
        text: alert.message,
        fields: Object.entries(alert.context || {}).map(([key, value]) => ({
          title: key,
          value: String(value),
          short: true
        })),
        footer: 'API Monitoring',
        ts: Math.floor(Date.now() / 1000)
      }]
    })
  })
}

// Usage
await sendSlackAlert({
  title: 'High Error Rate',
  message: 'Error rate exceeded 5% in the last 5 minutes',
  severity: 'critical',
  context: {
    errorRate: '7.3%',
    endpoint: '/api/v1/tasks',
    period: '5 minutes'
  }
})
```

### Email Alerts

```typescript
// lib/email-alerts.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendEmailAlert(alert: {
  subject: string
  message: string
  recipients: string[]
}) {
  await resend.emails.send({
    from: 'alerts@yourdomain.com',
    to: alert.recipients,
    subject: `[API Alert] ${alert.subject}`,
    html: `
      <h2>${alert.subject}</h2>
      <p>${alert.message}</p>
      <p><small>Sent at ${new Date().toISOString()}</small></p>
    `
  })
}
```

### Alert Rules

```typescript
// lib/alert-rules.ts
export const alertRules = {
  errorRate: {
    threshold: 0.05, // 5%
    window: 5 * 60 * 1000, // 5 minutes
    severity: 'critical' as const
  },

  responseTime: {
    threshold: 2000, // 2 seconds
    percentile: 95,
    severity: 'warning' as const
  },

  rateLimitHits: {
    threshold: 100,
    window: 60 * 60 * 1000, // 1 hour
    severity: 'warning' as const
  }
}

// Check alert conditions
export async function checkAlertConditions() {
  const now = Date.now()
  const windowStart = now - alertRules.errorRate.window

  // Get error rate
  const [totalRequests, errorRequests] = await Promise.all([
    redis.zcount('requests', windowStart, now),
    redis.zcount('errors', windowStart, now)
  ])

  const errorRate = errorRequests / totalRequests

  if (errorRate > alertRules.errorRate.threshold) {
    await sendSlackAlert({
      title: 'High Error Rate Detected',
      message: `Error rate is ${(errorRate * 100).toFixed(2)}%`,
      severity: alertRules.errorRate.severity,
      context: {
        threshold: `${alertRules.errorRate.threshold * 100}%`,
        current: `${(errorRate * 100).toFixed(2)}%`,
        window: '5 minutes'
      }
    })
  }
}
```

---

## Log Management

### Log Retention

```typescript
// scripts/cleanup-logs.ts
import { redis } from '@/lib/redis'

export async function cleanupOldLogs() {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)

  // Remove old metrics
  const patterns = [
    'metrics:daily:*',
    'metrics:hourly:*',
    'metrics:response_times:*'
  ]

  for (const pattern of patterns) {
    const keys = await redis.keys(pattern)

    for (const key of keys) {
      const [, , date] = key.split(':')
      const keyDate = new Date(date).getTime()

      if (keyDate < thirtyDaysAgo) {
        await redis.del(key)
      }
    }
  }
}

// Run daily
setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000)
```

### Log Aggregation

```typescript
// lib/log-aggregation.ts
export async function aggregateLogs(startDate: string, endDate: string) {
  const logs = await fetchLogsFromStorage(startDate, endDate)

  // Aggregate by endpoint
  const byEndpoint = logs.reduce((acc, log) => {
    const endpoint = log.endpoint || 'unknown'

    if (!acc[endpoint]) {
      acc[endpoint] = {
        count: 0,
        errors: 0,
        totalDuration: 0
      }
    }

    acc[endpoint].count++
    if (log.status >= 400) acc[endpoint].errors++
    acc[endpoint].totalDuration += log.duration

    return acc
  }, {})

  // Calculate averages
  Object.keys(byEndpoint).forEach(endpoint => {
    const stats = byEndpoint[endpoint]
    stats.averageDuration = stats.totalDuration / stats.count
    stats.errorRate = stats.errors / stats.count
  })

  return byEndpoint
}
```

---

## Dashboard Example

### Metrics Dashboard

```typescript
// app/admin/metrics/page.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export default function MetricsDashboard() {
  const { data: metrics } = useQuery({
    queryKey: ['metrics', 'daily'],
    queryFn: () => api.get('/admin/metrics/daily'),
    refetchInterval: 60000 // Refresh every minute
  })

  return (
    <div className="grid grid-cols-3 gap-6">
      <MetricCard
        title="Total Requests"
        value={metrics?.totalRequests}
        change="+12%"
      />

      <MetricCard
        title="Error Rate"
        value={`${(metrics?.errorRate * 100).toFixed(2)}%`}
        change="-0.5%"
        positive={true}
      />

      <MetricCard
        title="Avg Response Time"
        value={`${metrics?.avgResponseTime}ms`}
        change="-50ms"
        positive={true}
      />

      <div className="col-span-3">
        <h3>Top Endpoints</h3>
        <EndpointTable endpoints={metrics?.topEndpoints} />
      </div>

      <div className="col-span-3">
        <h3>Error Log</h3>
        <ErrorLog errors={metrics?.recentErrors} />
      </div>
    </div>
  )
}
```

---

## Next Steps

- [Troubleshooting](./18-troubleshooting.md) - Debug production issues
- [Best Practices](./11-best-practices.md) - Production best practices
- [Testing](./17-testing-apis.md) - Testing strategies

**Documentation:** `core/docs/05-api/19-monitoring-and-logging.md`
