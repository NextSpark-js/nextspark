# Logging

## Introduction

Logging provides visibility into application behavior and helps debug issues in production. **Current status:** Basic console logging with Vercel logs; structured logging planned for future.

---

## Current Logging Approach

### Console Logging

```typescript
// Current logging method
console.log('Info message')
console.error('Error message')
console.warn('Warning message')

// Logs appear in:
// - Vercel deployment logs (server-side)
// - Browser console (client-side)
```

---

## Accessing Logs

### Via Vercel CLI

```bash
# View real-time logs
vercel logs

# View logs for specific deployment
vercel logs [deployment-url]

# Follow logs (continuous)
vercel logs --follow
```

### Via Vercel Dashboard

```bash
# 1. Go to project in Vercel Dashboard
# 2. Deployments tab
# 3. Select deployment
# 4. Click "Logs" tab
# 5. Filter by:
#    - Time range
#    - Log level
#    - Search text
```

---

## Log Types

### Server-Side Logs

```typescript
// API routes, server components
export async function GET(request: Request) {
  console.log('API called:', request.url)  // Appears in Vercel logs
  return Response.json({ data: 'result' })
}
```

### Client-Side Logs

```typescript
// Browser console
'use client'

export default function Component() {
  console.log('Component rendered')  // Appears in browser console
  return <div>Content</div>
}
```

---

## Log Levels

### Current Usage

```typescript
// Basic log levels
console.log('General information')    // Info
console.warn('Warning message')       // Warning
console.error('Error occurred')       // Error
console.debug('Debug information')    // Debug (if enabled)
```

---

## Planned Logging Improvements

### Structured Logging

```typescript
// Planned: Structured log format
const PLANNED_LOGGING = {
  library: 'Pino or Winston',
  format: 'JSON structured logs',
  levels: ['error', 'warn', 'info', 'debug'],
  context: 'User ID, request ID, timestamps',
  aggregation: 'Centralized log storage',
  search: 'Full-text log search',
}

// Example planned format:
logger.info('User login', {
  userId: 'user-123',
  email: 'user@example.com',
  timestamp: '2025-11-20T10:00:00Z',
  requestId: 'req-abc-123',
})
```

---

## Best Practices

### Current Recommendations

```typescript
// ✅ DO: Log important events
console.log('User authenticated:', userId)
console.log('Task created:', taskId)

// ✅ DO: Log errors with context
console.error('Failed to save task:', error.message, { taskId, userId })

// ❌ DON'T: Log sensitive data
console.log('Password:', password)  // NEVER
console.log('API key:', apiKey)     // NEVER

// ❌ DON'T: Log too verbosely
console.log('Loop iteration:', i)  // Avoid in loops
```

---

## Debugging in Production

### Using Vercel Logs

```bash
# Search logs for specific user
vercel logs | grep "user-123"

# Search for errors
vercel logs | grep "ERROR"

# View logs for specific time range
# Use dashboard for time-based filtering
```

---

## Quick Reference

### Commands

```bash
# View logs
vercel logs

# Follow logs (live)
vercel logs --follow

# Logs for specific deployment
vercel logs [deployment-url]
```

### Log Locations

```bash
# Server-side logs
Vercel Dashboard → Deployments → Logs

# Client-side logs
Browser DevTools → Console

# Database logs
Supabase Dashboard → Logs
```

---

**Last Updated:** 2025-11-20  
**Version:** 1.0.0  
**Status:** Basic (Structured Logging Planned)
