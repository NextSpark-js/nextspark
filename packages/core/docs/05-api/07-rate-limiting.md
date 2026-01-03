# API Rate Limiting

**Rate limit strategies • Per-entity configuration • Headers • Error handling • Bypass rules • Monitoring**

---

## Table of Contents

- [Overview](#overview)
- [Rate Limit Strategies](#rate-limit-strategies)
- [Configuration](#configuration)
- [Rate Limit Headers](#rate-limit-headers)
- [Handling Rate Limits](#handling-rate-limits)
- [Bypass Rules](#bypass-rules)
- [Monitoring and Analytics](#monitoring-and-analytics)
- [Client Implementation](#client-implementation)

---

## Overview

The API v1 implements **intelligent rate limiting** to:

- **Prevent abuse** and ensure fair usage
- **Protect infrastructure** from overload
- **Provide different limits** for different authentication types
- **Allow bursting** for legitimate use cases

**Default Limits:**
- **API Key Authentication:** 1,000 requests/hour per key
- **Session Authentication:** 100 requests/hour per user
- **Unauthenticated:** 10 requests/hour per IP

**Key Features:**
- ✅ **Per-key/per-user limits** (not global)
- ✅ **Sliding window** algorithm (fair and accurate)
- ✅ **Burst allowance** (short spikes allowed)
- ✅ **Custom limits** per entity/endpoint
- ✅ **Graceful degradation** (not hard failure)

---

## Rate Limit Strategies

### 1. Sliding Window (Default)

**Most accurate** and fair approach. Tracks requests in a rolling time window.

**How it works:**
```text
Time window: 1 hour (3600 seconds)
Limit: 1000 requests

Current time: 15:30:00
Window start: 14:30:00 (1 hour ago)

Count requests in last hour → If < 1000, allow
                            → If >= 1000, reject
```

**Advantages:**
- ✅ **Fair distribution** of requests
- ✅ **Prevents gaming** the system
- ✅ **Accurate** across window boundaries

**Example:**
```text
Limit: 1000 req/hour

14:00 - User makes 500 requests
14:30 - User makes 500 requests (total: 1000)
15:00 - User tries to make 1 more request
        → Rejected! (still 1000 in last 60 minutes)
15:01 - Requests from 14:00-14:01 drop off
        → Now 999 in window, 1 request allowed
```

---

### 2. Fixed Window

**Simpler but less accurate.** Resets at fixed intervals.

**How it works:**
```text
Window: 14:00:00 - 14:59:59
Limit: 1000 requests

14:59:50 - User makes 1000 requests (at limit)
15:00:00 - Counter resets to 0
15:00:01 - User can make 1000 more requests

Result: 2000 requests in 11 seconds!
```

**Disadvantages:**
- ⚠️ **Burst abuse** at window boundaries
- ⚠️ **Unfair** distribution

**We don't use this strategy** due to these issues.

---

### 3. Token Bucket (Burst-Friendly)

**Allows short bursts** while maintaining average rate.

**How it works:**
```text
Bucket capacity: 100 tokens
Refill rate: 10 tokens/second

Request arrives:
  → If tokens available: Consume 1 token, allow request
  → If no tokens: Reject request

Tokens refill at constant rate
```

**Advantages:**
- ✅ **Allows bursts** for legitimate traffic spikes
- ✅ **Smooth over time** (average rate maintained)

**Used for:**
- Bulk import operations
- Webhook deliveries
- Background jobs

---

## Configuration

### Default Limits

**Per Authentication Type:**
```typescript
// API Key Authentication
{
  limit: 1000,
  window: '1h',  // 1 hour
  strategy: 'sliding-window'
}

// Session Authentication (Dashboard)
{
  limit: 100,
  window: '1h',
  strategy: 'sliding-window'
}

// Unauthenticated
{
  limit: 10,
  window: '1h',
  strategy: 'sliding-window'
}
```

### Per-Entity Limits

**Configure different limits for different entities:**
```typescript
// app/api/v1/[entity]/route.ts
export const rateLimits = {
  tasks: {
    GET: { limit: 1000, window: '1h' },
    POST: { limit: 100, window: '1h' },
    PATCH: { limit: 500, window: '1h' },
    DELETE: { limit: 50, window: '1h' }
  },

  // Expensive operations get lower limits
  reports: {
    GET: { limit: 50, window: '1h' },
    POST: { limit: 10, window: '1h' }
  },

  // Read-heavy endpoints get higher limits
  products: {
    GET: { limit: 5000, window: '1h' },
    POST: { limit: 100, window: '1h' }
  }
}
```

### Per-Endpoint Limits

**Custom limits for specific routes:**
```typescript
// app/api/v1/ai/generate/route.ts
export const config = {
  rateLimit: {
    limit: 20,          // Lower limit (expensive operation)
    window: '1h',
    cost: 10            // Each request costs 10 tokens
  }
}

// app/api/v1/webhooks/route.ts
export const config = {
  rateLimit: {
    limit: 1000,
    window: '1m',       // 1 minute window (burst-friendly)
    strategy: 'token-bucket',
    burst: 100          // Allow 100 request burst
  }
}
```

### Tiered Limits

**Different limits based on plan:**
```typescript
const rateLimitsByPlan = {
  free: {
    limit: 100,
    window: '1h'
  },
  pro: {
    limit: 1000,
    window: '1h'
  },
  enterprise: {
    limit: 10000,
    window: '1h'
  }
}

// Determine limit based on user's plan
export async function getRateLimitForUser(userId: string) {
  const user = await getUser(userId)
  const plan = user.subscription?.plan || 'free'
  return rateLimitsByPlan[plan]
}
```

---

## Rate Limit Headers

Every API response includes rate limit headers:

### Standard Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
X-RateLimit-Reset-After: 3599
```

**Header Descriptions:**
- `X-RateLimit-Limit` - Total requests allowed in window
- `X-RateLimit-Remaining` - Remaining requests in current window
- `X-RateLimit-Reset` - Unix timestamp when limit resets
- `X-RateLimit-Reset-After` - Seconds until limit resets

### Example Response

**Successful Request:**
```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1640995200
X-RateLimit-Reset-After: 2400

{
  "success": true,
  "data": [...]
}
```

**Rate Limited Request:**
```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1640995200
X-RateLimit-Reset-After: 300
Retry-After: 300

{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "limit": 1000,
    "window": "1h",
    "resetAt": "2025-01-15T16:00:00Z",
    "resetAfter": 300
  }
}
```

### Retry-After Header

**Standard HTTP header** indicating when to retry:

```http
Retry-After: 300  # Seconds until retry
```

**Clients should respect this header** and wait before retrying.

---

## Handling Rate Limits

### Client-Side Handling

**1. Check Rate Limit Headers**

```typescript
async function makeApiRequest(url: string) {
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  })

  // Check rate limit headers
  const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0')
  const resetAfter = parseInt(response.headers.get('X-RateLimit-Reset-After') || '0')

  if (remaining < 10) {
    console.warn(`Low rate limit! ${remaining} requests remaining. Resets in ${resetAfter}s`)
  }

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60')
    throw new RateLimitError(`Rate limit exceeded. Retry after ${retryAfter}s`)
  }

  return response.json()
}
```

**2. Exponential Backoff**

```typescript
async function makeApiRequestWithRetry(
  url: string,
  maxRetries = 3
) {
  let retries = 0

  while (retries < maxRetries) {
    try {
      return await makeApiRequest(url)
    } catch (error) {
      if (error instanceof RateLimitError && retries < maxRetries - 1) {
        retries++
        const backoff = Math.pow(2, retries) * 1000  // 2s, 4s, 8s
        console.log(`Rate limited. Retrying in ${backoff}ms...`)
        await sleep(backoff)
      } else {
        throw error
      }
    }
  }
}
```

**3. Request Queuing**

```typescript
class RateLimitedApiClient {
  private queue: Array<() => Promise<any>> = []
  private processing = false
  private requestsPerSecond = 10

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })

      this.processQueue()
    })
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return

    this.processing = true

    while (this.queue.length > 0) {
      const fn = this.queue.shift()!
      await fn()
      await sleep(1000 / this.requestsPerSecond)  // Throttle
    }

    this.processing = false
  }
}

// Usage
const client = new RateLimitedApiClient()

// All requests automatically queued and throttled
await client.enqueue(() => fetch('/api/v1/tasks'))
await client.enqueue(() => fetch('/api/v1/users'))
```

---

## Bypass Rules

### Admin Users

**Admins bypass rate limits:**
```typescript
export async function checkRateLimit(request: NextRequest) {
  const auth = await authenticateRequest(request)

  // Bypass for admins
  if (auth.user?.role === 'admin') {
    return { allowed: true, bypass: true }
  }

  // Apply rate limit for regular users
  return applyRateLimit(auth.user.id)
}
```

### Trusted IP Addresses

**Whitelist specific IPs:**
```typescript
const trustedIPs = [
  '192.168.1.100',  // Internal monitoring
  '10.0.0.50'       // Internal services
]

export async function checkRateLimit(request: NextRequest) {
  const clientIP = request.headers.get('x-forwarded-for') || request.ip

  if (trustedIPs.includes(clientIP)) {
    return { allowed: true, bypass: true }
  }

  // Apply rate limit
  return applyRateLimit(clientIP)
}
```

### Internal Service Accounts

**Service accounts get higher limits:**
```typescript
export async function getRateLimitForKey(apiKey: string) {
  const key = await getApiKey(apiKey)

  if (key.type === 'service') {
    return {
      limit: 100000,  // 100k requests/hour
      window: '1h'
    }
  }

  return {
    limit: 1000,
    window: '1h'
  }
}
```

---

## Monitoring and Analytics

### Track Rate Limit Violations

**Log all rate limit hits:**
```typescript
export async function logRateLimitViolation(
  userId: string,
  endpoint: string,
  limit: number
) {
  await db.insert('rate_limit_violations', {
    userId,
    endpoint,
    limit,
    timestamp: new Date(),
    ip: request.ip,
    userAgent: request.headers.get('user-agent')
  })

  // Alert if excessive violations
  const recentViolations = await db.query(
    'SELECT COUNT(*) FROM rate_limit_violations WHERE userId = ? AND timestamp > ?',
    [userId, new Date(Date.now() - 3600000)]  // Last hour
  )

  if (recentViolations > 10) {
    await alertAdmins(`User ${userId} has ${recentViolations} rate limit violations in last hour`)
  }
}
```

### Dashboard Analytics

**Track rate limit metrics:**
```typescript
// Metrics to track
{
  "rate_limit_hits": 142,           // Total rate limit violations
  "rate_limit_hits_by_endpoint": {
    "/api/v1/tasks": 89,
    "/api/v1/users": 53
  },
  "rate_limit_hits_by_user": {
    "usr_abc123": 67,
    "usr_def456": 42,
    "usr_ghi789": 33
  },
  "average_requests_per_user": 847,
  "peak_requests_per_minute": 142,
  "top_users_by_requests": [
    { "userId": "usr_abc123", "requests": 9842 },
    { "userId": "usr_def456", "requests": 7231 }
  ]
}
```

### Alerts

**Alert on suspicious activity:**
```typescript
export async function checkForAnomalies(userId: string) {
  const last24h = await getRequestCount(userId, 24 * 3600)
  const average = await getAverageRequestCount(userId)

  // Alert if 10x normal usage
  if (last24h > average * 10) {
    await alertAdmins(
      `Anomalous activity detected for user ${userId}: ${last24h} requests in 24h (avg: ${average})`
    )
  }
}
```

---

## Client Implementation

### JavaScript (With Rate Limit Handling)

```typescript
class ApiClient {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
    this.baseUrl = 'https://yourdomain.com/api/v1'
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    // Check rate limit headers
    this.checkRateLimits(response.headers)

    // Handle rate limit error
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60')
      throw new Error(`Rate limit exceeded. Retry after ${retryAfter}s`)
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    return response.json()
  }

  private checkRateLimits(headers: Headers) {
    const remaining = parseInt(headers.get('X-RateLimit-Remaining') || '0')
    const limit = parseInt(headers.get('X-RateLimit-Limit') || '0')
    const resetAfter = parseInt(headers.get('X-RateLimit-Reset-After') || '0')

    // Warn if low on requests
    if (remaining < limit * 0.1) {  // Less than 10% remaining
      console.warn(
        `Low rate limit: ${remaining}/${limit} remaining. Resets in ${resetAfter}s`
      )
    }
  }
}

// Usage
const client = new ApiClient('sk_live_abc123...')

try {
  const tasks = await client.request('/tasks')
  console.log(tasks)
} catch (error) {
  if (error.message.includes('Rate limit exceeded')) {
    // Handle rate limit gracefully
    console.error('Too many requests. Please wait and try again.')
  } else {
    throw error
  }
}
```

### React (With Automatic Retry)

```typescript
import { useQuery } from '@tanstack/react-query'

function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const response = await fetch('https://yourdomain.com/api/v1/tasks', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      })

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60')
        throw new Error(`Rate limited. Retry after ${retryAfter}s`)
      }

      return response.json()
    },
    retry: (failureCount, error) => {
      // Retry on rate limit errors (up to 3 times)
      if (error.message.includes('Rate limited') && failureCount < 3) {
        return true
      }
      return false
    },
    retryDelay: (attemptIndex) => {
      // Exponential backoff: 2s, 4s, 8s
      return Math.min(1000 * Math.pow(2, attemptIndex), 30000)
    }
  })
}
```

### Python (With Retry Logic)

```python
import requests
import time
from typing import Optional

class ApiClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://yourdomain.com/api/v1"

    def request(
        self,
        endpoint: str,
        method: str = "GET",
        data: Optional[dict] = None,
        max_retries: int = 3
    ):
        url = f"{self.base_url}{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.api_key}"
        }

        retries = 0
        while retries < max_retries:
            response = requests.request(
                method,
                url,
                headers=headers,
                json=data
            )

            # Check rate limit headers
            remaining = int(response.headers.get('X-RateLimit-Remaining', 0))
            limit = int(response.headers.get('X-RateLimit-Limit', 0))

            if remaining < limit * 0.1:
                print(f"Warning: Low rate limit ({remaining}/{limit} remaining)")

            # Handle rate limit
            if response.status_code == 429:
                retry_after = int(response.headers.get('Retry-After', 60))

                if retries < max_retries - 1:
                    print(f"Rate limited. Retrying after {retry_after}s...")
                    time.sleep(retry_after)
                    retries += 1
                    continue
                else:
                    raise Exception(f"Rate limit exceeded after {max_retries} retries")

            response.raise_for_status()
            return response.json()

# Usage
client = ApiClient('sk_live_abc123...')

try:
    tasks = client.request('/tasks')
    print(tasks)
except Exception as e:
    print(f"Error: {e}")
```

---

## Next Steps

- [Best Practices](./11-best-practices.md) - API best practices guide
- [Error Handling](./08-error-handling.md) - Complete error handling documentation
- [Authentication](./02-authentication.md) - API authentication
- [Monitoring](./19-monitoring-and-logging.md) - Monitoring and logging

**Documentation:** `core/docs/05-api/07-rate-limiting.md`
