# Security Best Practices

This guide covers the security features implemented in the authentication system and best practices for maintaining a secure application.

## Password Security

### Automatic Password Hashing

Better Auth automatically handles password hashing:

```typescript
// Better Auth uses industry-standard hashing
// No manual implementation needed

// Configuration
emailAndPassword: {
  minPasswordLength: 8,
  maxPasswordLength: 128,
}
```

**Security Features:**
- Bcrypt with automatic salt generation
- Configurable work factor
- Secure password comparison
- No plaintext storage

### Password Requirements

```typescript
// Enforced at application level
const passwordRequirements = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true
}
```

**Recommended**: Implement password strength meter in UI.

### Password Reset Security

```typescript
// Token expires after 1 hour
resetPasswordTokenExpiresIn: 60 * 60,

// Token sent via secure email
sendResetPassword: async ({ user, url, token }) => {
  // Token included in URL
  const resetUrl = `${url}?token=${token}`
  
  // Send via Resend email service
  await emailService.send({
    to: user.email,
    subject: 'Password Reset',
    html: template
  })
}
```

**Security Measures:**
- One-time use tokens
- Time-limited validity (1 hour)
- Secure token generation
- Tokens invalidated after use

## Email Verification

### Verification Enforcement

```typescript
emailAndPassword: {
  requireEmailVerification: true,
}
```

**Flow:**
1. User signs up
2. Account created but unverified
3. Verification email sent
4. User cannot access protected routes until verified
5. User clicks verification link
6. Email verified, access granted

### Verification Token Security

```typescript
emailVerification: {
  verifyTokenExpiresIn: 60 * 60 * 24, // 24 hours
}
```

**Security Features:**
- 24-hour token expiration
- One-time use tokens
- Cryptographically secure generation
- Automatic cleanup of expired tokens

## Cookie Security

### Production Cookie Configuration

```typescript
advanced: {
  useSecureCookies: process.env.NODE_ENV === 'production',
  defaultCookieAttributes: {
    httpOnly: true,    // Prevents XSS
    secure: true,      // HTTPS only (production)
    sameSite: "lax",   // CSRF protection
    path: "/",
  },
}
```

### Cookie Attributes Explained

| Attribute | Purpose | Security Benefit |
|-----------|---------|------------------|
| `httpOnly` | No JavaScript access | Prevents XSS cookie theft |
| `secure` | HTTPS only | Prevents MITM attacks |
| `sameSite: "lax"` | Restrict cross-site | CSRF protection |
| `path: "/"` | Site-wide scope | Minimal attack surface |

### Cookie Cache Security

```typescript
cookieCache: {
  enabled: true,
  maxAge: 60 * 5, // 5 minutes
}
```

**Security Trade-off:**
- **Pro**: Reduces database queries
- **Con**: 5-minute delay for session revocation
- **Mitigation**: Acceptable for most use cases

## CSRF Protection

### Built-in CSRF Protection

Better Auth automatically protects against CSRF:

```typescript
// Automatic CSRF token generation
// Validated on state-changing requests (POST, PUT, DELETE)
```

### SameSite Cookie Attribute

```typescript
sameSite: "lax"
```

**Protection Level:**
- Blocks most CSRF attacks
- Allows top-level navigation
- Prevents cross-origin POST requests

## API Key Security

### Secure Key Generation

```typescript
import { randomBytes } from 'crypto'

function generateApiKey(): string {
  // Cryptographically secure random bytes
  const randomPart = randomBytes(30).toString('base64url')
  return `sk_live_${randomPart}`
}
```

### Key Storage

```typescript
// NEVER store plaintext keys
const keyHash = await hashKey(apiKey)  // SHA-256
const keyPrefix = apiKey.substring(0, 12)  // For display

// Database storage
{
  keyHash: "sha256_hash...",  // Hashed
  keyPrefix: "sk_live_a1b2",  // Prefix only
  scopes: ["tasks:read"]
}
```

### Constant-Time Comparison

```typescript
async function validateApiKey(key: string) {
  const startTime = Date.now()
  
  try {
    // Validation logic
    if (!valid) {
      await constantTimeDelay(startTime)  // Always wait
      return null
    }
    return auth
  } catch (error) {
    await constantTimeDelay(startTime)  // Same delay
    return null
  }
}

async function constantTimeDelay(startTime: number) {
  const minDelay = 100  // 100ms minimum
  const elapsed = Date.now() - startTime
  const remaining = Math.max(0, minDelay - elapsed)
  if (remaining > 0) {
    await new Promise(resolve => setTimeout(resolve, remaining))
  }
}
```

**Security Benefit**: Prevents timing attacks to determine if keys exist.

### API Key Rate Limiting

```typescript
// Per-key rate limits
const rateLimits = {
  'tasks:read': 1000,   // requests per minute
  'tasks:write': 500,
  'admin:*': 10000
}
```

## OAuth Security

### Google OAuth Security

```typescript
socialProviders: {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  }
}
```

**Security Measures:**
- Client secret stored in environment variables
- State parameter for CSRF protection
- Trusted origins validation
- Secure token exchange

### Trusted Origins

```typescript
trustedOrigins: [
  process.env.BETTER_AUTH_URL,
  process.env.NEXT_PUBLIC_APP_URL,
  // Only trusted domains
].filter(Boolean)
```

**Purpose**: Restricts OAuth callbacks to known domains.

### Account Linking

```typescript
// Automatic secure account linking
// When same email used across providers
// Better Auth handles linking securely
```

## Session Security

### Session Fixation Prevention

Better Auth automatically:
- Generates new session ID on sign in
- Invalidates old tokens
- Rotates tokens on privilege changes

### Session Hijacking Prevention

```typescript
// Optional: Track IP and User Agent
interface Session {
  ipAddress?: string
  userAgent?: string
}

// Validate on each request
if (session.ipAddress !== request.ip) {
  // Potential hijacking
  await invalidateSession(session.id)
}
```

### Concurrent Session Management

```typescript
// Limit concurrent sessions per user
async function enforceSessionLimit(userId: string) {
  const sessions = await getSessionsByUser(userId)
  
  if (sessions.length > MAX_SESSIONS) {
    // Delete oldest sessions
    await deleteOldestSessions(userId, sessions.length - MAX_SESSIONS)
  }
}
```

## Row-Level Security (RLS)

### Database-Level Protection

```sql
-- Enable RLS on sensitive tables
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "tasks_user_isolation" ON "tasks"
  USING ("userId" = auth.uid());

-- Admin can access all data
CREATE POLICY "tasks_admin_all" ON "tasks"
  USING (auth.user_role() = 'admin');
```

**Benefits:**
- Protection even if application logic fails
- Defense in depth
- Multi-tenant data isolation

## SQL Injection Prevention

### Parameterized Queries

```typescript
// ✅ Good: Parameterized query
await query(
  'SELECT * FROM "tasks" WHERE "userId" = $1',
  [userId]
)

// ❌ Bad: String concatenation
await query(
  `SELECT * FROM "tasks" WHERE "userId" = '${userId}'`
)
```

### Using Query Builders

```typescript
// Drizzle ORM provides automatic protection
const tasks = await db
  .select()
  .from(tasksTable)
  .where(eq(tasksTable.userId, userId))
```

## XSS Prevention

### Content Security Policy

```typescript
// next.config.ts
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.yourapp.com",
    ].join('; ')
  }
]
```

### Input Sanitization

```typescript
import DOMPurify from 'isomorphic-dompurify'

// Sanitize user input before displaying
const cleanHtml = DOMPurify.sanitize(userInput)
```

## Environment Variables

### Secure Configuration

```bash
# .env.local (NEVER commit to git)

# Required
BETTER_AUTH_SECRET=your-32-char-secret
DATABASE_URL=postgresql://user:pass@host:5432/db

# OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Email
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

### Secret Generation

```bash
# Generate secure secret
openssl rand -base64 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Secret Rotation

1. Generate new secret
2. Update `BETTER_AUTH_SECRET` in environment
3. Restart application
4. Old sessions invalidated
5. Users required to sign in again

## HTTPS Enforcement

### Production Configuration

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const proto = request.headers.get('x-forwarded-proto')
  
  if (proto === 'http' && process.env.NODE_ENV === 'production') {
    const url = request.url.replace('http://', 'https://')
    return NextResponse.redirect(url, 301)
  }
  
  return NextResponse.next()
}
```

## Rate Limiting

### Login Rate Limiting

```typescript
// Track failed login attempts
const loginAttempts = new Map<string, number>()

async function checkLoginAttempts(email: string): Promise<boolean> {
  const attempts = loginAttempts.get(email) || 0
  
  if (attempts >= MAX_ATTEMPTS) {
    // Block for 15 minutes
    return false
  }
  
  return true
}

async function recordFailedLogin(email: string) {
  const attempts = loginAttempts.get(email) || 0
  loginAttempts.set(email, attempts + 1)
  
  // Clear after 15 minutes
  setTimeout(() => {
    loginAttempts.delete(email)
  }, 15 * 60 * 1000)
}
```

### API Rate Limiting

```typescript
// Using API keys' built-in rate limiting
// Or implement custom rate limiter
import rateLimit from 'express-rate-limit'

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // 100 requests per window
})
```

## Security Headers

NextSpark includes comprehensive security headers configured in `next.config.mjs`. These headers are automatically applied to all routes.

### Default Security Headers

```typescript
// next.config.mjs - headers() function
const isProduction = process.env.NODE_ENV === 'production';

// Allowed image domains (must match remotePatterns)
const allowedImageDomains = [
  'https://lh3.googleusercontent.com',
  'https://*.public.blob.vercel-storage.com',
  'https://images.unsplash.com',
  'https://upload.wikimedia.org',
  'https://i.pravatar.cc',
].join(' ');

// CSP directives - environment-aware
const cspDirectives = [
  "default-src 'self'",
  // unsafe-eval only in development (Next.js hot reload)
  `script-src 'self' 'unsafe-inline'${!isProduction ? " 'unsafe-eval'" : ''} https://js.stripe.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${allowedImageDomains}`,
  "font-src 'self' data:",
  // wss: only in development (hot reload)
  `connect-src 'self' https://api.stripe.com${!isProduction ? ' wss:' : ''}`,
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
];

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // X-XSS-Protection deprecated but kept for legacy browsers
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: cspDirectives.join('; ') },
];

// HSTS only in production (includes preload directive)
if (isProduction) {
  securityHeaders.push({
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload'
  });
}
```

### Header Purposes

| Header | Purpose | Security Benefit |
|--------|---------|------------------|
| `X-Content-Type-Options: nosniff` | Prevent MIME sniffing | Stops browsers from interpreting files as different content types |
| `X-Frame-Options: DENY` | Prevent clickjacking | Blocks the site from being embedded in iframes |
| `X-XSS-Protection: 1; mode=block` | Enable XSS filter | Legacy browser protection against reflected XSS |
| `Referrer-Policy` | Control referrer info | Limits data sent in Referer header |
| `Permissions-Policy` | Restrict browser features | Disables camera, microphone, geolocation |
| `Content-Security-Policy` | Control resource loading | Prevents XSS, data injection attacks |
| `Strict-Transport-Security` | Enforce HTTPS | Forces HTTPS connections (production only) |

### HSTS Preload

The HSTS header includes the `preload` directive, which allows your domain to be included in browser preload lists. This provides protection from the first request, before any HTTP response is received.

**Requirements for HSTS Preload submission:**

Before submitting to [hstspreload.org](https://hstspreload.org), ensure your site meets these requirements:

1. **Valid HTTPS certificate** - Must be valid and not self-signed
2. **Redirect HTTP to HTTPS** - All HTTP requests must redirect to HTTPS (301 redirect)
3. **Serve HSTS on base domain** - The header must be served on the root domain, not just subdomains
4. **Include all subdomains** - `includeSubDomains` must be present (it is by default)
5. **max-age at least 1 year** - Must be at least 31536000 seconds (it is by default)
6. **preload directive** - Must include `preload` (it is by default)

**Warning:** HSTS preload is difficult to undo. Once your domain is in browser preload lists, it can take months to remove. Only submit if you're committed to HTTPS permanently.

### Content Security Policy (CSP)

The CSP is configured with environment-aware settings:

**Production-specific hardening:**
- `unsafe-eval` is **removed** from script-src in production
- WebSocket wildcard (`wss:`) is **removed** in production
- Only specific image domains are allowed (no `https:` wildcard)

**Allowed resources:**
- **Self-hosted resources**: Scripts, styles, images from your domain
- **Stripe integration**: Scripts and iframes from `js.stripe.com`, API calls to `api.stripe.com`
- **Specific image domains**: Google, Unsplash, Vercel Blob, Wikimedia, Pravatar
- **Inline styles**: Required by shadcn/ui and many UI libraries
- **Data URIs**: For images and fonts

**Security directives:**
- `object-src 'none'`: Blocks Flash, Java, and other plugins
- `base-uri 'self'`: Prevents base tag injection attacks
- `frame-ancestors 'none'`: Prevents clickjacking

#### Customizing CSP

If you integrate additional third-party services, update the CSP in your `next.config.mjs`:

```typescript
// Example: Adding Google Analytics
const cspDirectives = [
  // ... existing directives
  `script-src 'self' 'unsafe-inline'${!isProduction ? " 'unsafe-eval'" : ''} https://js.stripe.com https://www.googletagmanager.com`,
  `connect-src 'self' https://api.stripe.com https://www.google-analytics.com${!isProduction ? ' wss:' : ''}`,
];

// Example: Adding a new image domain
const allowedImageDomains = [
  // ... existing domains
  'https://cdn.yourservice.com',
].join(' ');
```

### Testing Security Headers

Run the security headers tests:

```bash
pnpm cy:run -- --spec "**/security-headers.cy.ts"
```

Or verify manually in browser DevTools (Network tab > Response Headers).

## Audit Logging

### Authentication Events

```typescript
// Log security-relevant events
async function logAuthEvent(event: {
  userId: string
  action: string
  ipAddress: string
  userAgent: string
  success: boolean
}) {
  await query(
    `INSERT INTO "auth_audit_log" 
     ("userId", "action", "ipAddress", "userAgent", "success", "timestamp")
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [event.userId, event.action, event.ipAddress, event.userAgent, event.success]
  )
}

// Log events:
// - Login attempts (success/failure)
// - Password changes
// - Email changes
// - Role changes
// - API key creation/deletion
// - Session revocations
```

## Security Checklist

### Development

- [ ] Use environment variables for secrets
- [ ] Never commit `.env.local` files
- [ ] Use HTTPS in local development (optional)
- [ ] Enable Better Auth debug mode
- [ ] Test authentication flows thoroughly

### Production

- [ ] Enable `secure` cookies (HTTPS only)
- [ ] Set strong `BETTER_AUTH_SECRET`
- [ ] Configure CSP headers
- [ ] Enable RLS policies on all tables
- [ ] Implement rate limiting
- [ ] Set up security monitoring
- [ ] Configure backup and recovery
- [ ] Enable audit logging
- [ ] Review and rotate secrets regularly
- [ ] Monitor for suspicious activity

## Security Headers Migration Guide

If you're upgrading from an older version of NextSpark or adding security headers to an existing application, follow this guide to ensure a smooth transition.

### Phase 1: Report-Only Mode (Recommended)

Before enforcing CSP, use report-only mode to identify potential issues:

```typescript
// next.config.mjs - Use Content-Security-Policy-Report-Only first
{
  key: 'Content-Security-Policy-Report-Only',  // Not enforced, just reports
  value: cspDirectives.join('; ')
}
```

Monitor `/api/csp-report` logs for violations before switching to enforced CSP.

### Phase 2: Identify CSP Violations

Common issues when adding CSP:

| Issue | Symptom | Solution |
|-------|---------|----------|
| Inline scripts blocked | Scripts not executing | Add domain to `script-src` or use nonces |
| External images blocked | Images not loading | Add domain to `img-src` allowlist |
| Third-party widgets broken | Iframes not loading | Add domain to `frame-src` |
| API calls failing | Fetch/XHR blocked | Add domain to `connect-src` |
| Fonts not loading | @font-face failing | Add domain to `font-src` |

### Phase 3: Add Third-Party Integrations

Update CSP for common integrations:

```typescript
// Google Analytics
`script-src 'self' https://www.googletagmanager.com`,
`connect-src 'self' https://www.google-analytics.com`,

// Intercom
`script-src 'self' https://widget.intercom.io`,
`connect-src 'self' https://api.intercom.io`,
`frame-src https://widget.intercom.io`,

// Sentry
`connect-src 'self' https://*.sentry.io`,

// Cloudflare Analytics
`script-src 'self' https://static.cloudflareinsights.com`,
`connect-src 'self' https://cloudflareinsights.com`,
```

### Phase 4: Switch to Enforced Mode

Once violations are resolved:

```typescript
{
  key: 'Content-Security-Policy',  // Now enforced
  value: cspDirectives.join('; ')
}
```

### Phase 5: Monitor and Maintain

1. **Check CSP reports regularly** - Review `/api/csp-report` logs
2. **Test after dependency updates** - New library versions may require CSP changes
3. **Use security scanners** - Tools like [securityheaders.com](https://securityheaders.com) or [Mozilla Observatory](https://observatory.mozilla.org)
4. **Consider HSTS preload** - Once stable, submit to [hstspreload.org](https://hstspreload.org)

### Rollback Plan

If issues occur after enabling CSP:

1. **Immediate**: Comment out CSP header in `next.config.mjs`
2. **Investigate**: Check `/api/csp-report` logs for blocked resources
3. **Fix**: Add missing domains to appropriate directives
4. **Re-enable**: Uncomment CSP header

### X-XSS-Protection Deprecation Note

The `X-XSS-Protection` header is included for legacy browser support but is deprecated in modern browsers. It may be removed in future versions. Modern browsers rely on CSP for XSS protection instead.

See [MDN X-XSS-Protection documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-XSS-Protection) for more details.

## Next Steps

1. **[Testing Authentication](./08-testing-authentication.md)** - Test security features

---

> 💡 **Tip**: Security is a continuous process. Regularly review logs, update dependencies, and stay informed about new security best practices.
