# Session Management

Sessions provide stateful authentication for web applications, maintaining user identity across requests through secure cookies.

## Session Lifecycle

```text
Sign In → Create Session → Store in Database → Issue Cookie
    ↓
User makes requests → Validate Cookie → Load Session Data
    ↓
Session expires or Sign Out → Delete Session → Clear Cookie
```

## Session Creation

### On Sign In

When a user successfully authenticates:

```typescript
// Better Auth automatically handles session creation
await authClient.signIn.email({
  email: 'user@example.com',
  password: 'password'
})

// Better Auth creates:
// 1. Session record in database
// 2. Secure httpOnly cookie
// 3. Returns user data
```

### Session Data Structure

```typescript
interface Session {
  id: string                    // Unique session identifier
  token: string                 // Session token (stored in cookie)
  userId: string                // Associated user ID
  expiresAt: Date              // Expiration timestamp
  ipAddress?: string            // Request IP (security)
  userAgent?: string            // Browser info (security)
  createdAt: Date
  updatedAt: Date
}
```

## Session Configuration

### Better Auth Settings

```typescript
// core/lib/auth.ts
session: {
  expiresIn: 60 * 60 * 24 * 7, // 7 days (604800 seconds)
  updateAge: 60 * 60 * 24,     // 1 day (86400 seconds)
  cookieCache: {
    enabled: true,
    maxAge: 60 * 5,            // 5 minutes (300 seconds)
  },
}
```

**Settings Explained:**

- **expiresIn**: Total session lifetime before requiring re-authentication
- **updateAge**: How often to refresh the session expiration
- **cookieCache**: Client-side caching to reduce database queries

### Session Renewal

Sessions are automatically renewed:

```text
Day 0: Session created, expires Day 7
Day 1: Session accessed, expiration extended to Day 8
Day 2: Session accessed, expiration extended to Day 9
...
```

**Benefit**: Active users stay logged in; inactive sessions expire.

## Cookie Configuration

### Cookie Attributes

```typescript
defaultCookieAttributes: {
  httpOnly: true,          // Prevents JavaScript access
  secure: isProd,          // HTTPS only in production
  sameSite: "lax",         // CSRF protection
  path: "/",               // Available site-wide
}
```

**Security Features:**

| Attribute | Purpose | Production Value |
|-----------|---------|------------------|
| `httpOnly` | Prevents XSS attacks | `true` |
| `secure` | HTTPS only | `true` |
| `sameSite` | CSRF protection | `"lax"` |
| `path` | Cookie scope | `"/"` |

### Cookie Cache

The 5-minute cookie cache reduces database lookups:

```text
Request 1 (0:00): Database lookup → Cache session data
Request 2 (0:02): Use cached data (no DB query)
Request 3 (0:04): Use cached data (no DB query)
Request 4 (0:06): Cache expired → Database lookup
```

**Performance Impact:**
- Reduces database load by ~80%
- Faster response times for authenticated requests
- Automatic cache invalidation every 5 minutes

## Accessing Sessions

### In Server Components

```typescript
import { auth } from '@/core/lib/auth'
import { headers } from 'next/headers'

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers()
  })
  
  if (!session) {
    redirect('/login')
  }
  
  return (
    <div>
      <h1>Welcome, {session.user.firstName}!</h1>
      <p>Role: {session.user.role}</p>
      <p>Flags: {session.user.flags?.join(', ')}</p>
    </div>
  )
}
```

### In API Routes

```typescript
// app/api/tasks/route.ts
import { auth } from '@/core/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers
  })
  
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
  
  // Use session data
  const tasks = await getTasks(session.user.id)
  return NextResponse.json({ tasks })
}
```

### In Client Components

```typescript
'use client'

import { useSession } from '@/core/lib/auth-client'

export function UserProfile() {
  const { data: session, isPending } = useSession()
  
  if (isPending) {
    return <div>Loading...</div>
  }
  
  if (!session) {
    return <div>Not authenticated</div>
  }
  
  return (
    <div>
      <img src={session.user.image} alt="Avatar" />
      <p>{session.user.firstName} {session.user.lastName}</p>
      <p>Email: {session.user.email}</p>
    </div>
  )
}
```

### In Middleware

```typescript
// middleware.ts
import { auth } from '@/core/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers
  })
  
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard')
  
  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/profile/:path*',
    '/settings/:path*'
  ]
}
```

## Session Enhancement

### Loading User Flags

User flags are automatically loaded on sign in:

```typescript
callbacks: {
  session: {
    async onSignIn({ user, session }) {
      // Load user flags from user_metas table
      const flags = await getUserFlags(user.id)
      
      return {
        user: {
          ...user,
          flags
        },
        session
      }
    }
  }
}
```

**Available in Session:**

```typescript
session.user.flags // ['beta_tester', 'vip', ...]
```

## Concurrent Sessions

### Multiple Device Support

Users can have multiple active sessions:

```sql
-- Multiple sessions per user
SELECT * FROM "session" WHERE "userId" = 'user-123';

-- Result:
-- Desktop Chrome:  session-abc, expires 2024-01-20
-- Mobile Safari:   session-def, expires 2024-01-19
-- Laptop Firefox:  session-ghi, expires 2024-01-21
```

### Session Limits

To limit concurrent sessions:

```typescript
// Optional: Implement max sessions per user
async function createSession(userId: string) {
  const existingSessions = await getSessionsByUser(userId)
  
  if (existingSessions.length >= MAX_SESSIONS) {
    // Delete oldest session
    await deleteSession(existingSessions[0].id)
  }
  
  // Create new session
  return await auth.api.createSession({ userId })
}
```

## Session Revocation

### Sign Out (Single Session)

```typescript
'use client'

import { signOut } from '@/core/lib/auth-client'

export function SignOutButton() {
  const handleSignOut = async () => {
    await signOut()
    // Redirects to login page
  }
  
  return <button onClick={handleSignOut}>Sign Out</button>
}
```

**What Happens:**
1. Session deleted from database
2. Cookie cleared from browser
3. User redirected to login

### Sign Out All Sessions

```typescript
// Revoke all sessions for a user
async function signOutAllSessions(userId: string) {
  await query(
    'DELETE FROM "session" WHERE "userId" = $1',
    [userId]
  )
}
```

**Use Cases:**
- Password change
- Security breach
- Account takeover prevention

## Session Security

### Session Fixation Prevention

Better Auth automatically:
1. Generates new session ID on sign in
2. Invalidates old session tokens
3. Rotates session tokens on privilege escalation

### Session Hijacking Prevention

**IP Address Tracking:**

```typescript
// Optional: Validate IP address
const session = await getSession(token)
if (session.ipAddress !== request.ip) {
  // Potential session hijacking
  await invalidateSession(token)
  throw new Error('Session invalid')
}
```

**User Agent Tracking:**

```typescript
// Optional: Validate user agent
if (session.userAgent !== request.headers['user-agent']) {
  // Different browser/device
  await logSecurityEvent('user_agent_mismatch')
}
```

## Session Storage

### Database Table

```sql
CREATE TABLE "session" (
  "id" TEXT PRIMARY KEY,
  "token" TEXT UNIQUE NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX "idx_session_token" ON "session"("token");
CREATE INDEX "idx_session_userId" ON "session"("userId");
CREATE INDEX "idx_session_expiresAt" ON "session"("expiresAt");
```

### Session Cleanup

Expired sessions should be cleaned periodically:

```typescript
// Run as cron job
async function cleanExpiredSessions() {
  const result = await query(
    'DELETE FROM "session" WHERE "expiresAt" < NOW()'
  )
  console.log(`Cleaned ${result.rowCount} expired sessions`)
}

// Schedule: Every hour
// 0 * * * * node scripts/clean-sessions.js
```

## Debugging Sessions

### Check Session in DevTools

```typescript
// In browser console
document.cookie
  .split('; ')
  .find(row => row.startsWith('better-auth.session_token'))
```

### Server-Side Debugging

```typescript
// Add logging to auth configuration
advanced: {
  debug: process.env.NODE_ENV === 'development',
}

// Logs:
// - Session creation
// - Session validation
// - Session renewal
// - Cookie operations
```

### Verify Session in Database

```sql
-- Check user's active sessions
SELECT 
  id,
  "expiresAt",
  "createdAt",
  "ipAddress",
  "userAgent"
FROM "session"
WHERE "userId" = 'user-id'
AND "expiresAt" > NOW()
ORDER BY "createdAt" DESC;
```

## Performance Optimization

### Connection Pooling

```typescript
const pool = new Pool({
  max: 20,                      // Max connections
  idleTimeoutMillis: 30000,     // Close idle after 30s
  connectionTimeoutMillis: 10000 // Timeout after 10s
})
```

### Session Query Optimization

```sql
-- Optimize session lookups
CREATE INDEX "idx_session_token_expires" 
  ON "session"("token", "expiresAt");

-- Query uses index
SELECT * FROM "session" 
WHERE "token" = $1 
AND "expiresAt" > NOW();
```

## Next Steps

1. **[Permissions and Roles](./06-permissions-and-roles.md)** - User authorization
2. **[Security Best Practices](./07-security-best-practices.md)** - Session security
3. **[Testing Authentication](./08-testing-authentication.md)** - Testing sessions

---

> 💡 **Tip**: Session management is handled automatically by Better Auth. Focus on configuring timeouts and security settings that match your application's needs.
