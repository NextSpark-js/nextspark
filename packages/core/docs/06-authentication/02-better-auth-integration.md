# Better Auth Integration

This guide covers the complete Better Auth v1.3.5 configuration in NextSpark, including database setup, user model customization, email verification, password reset, and session management.

## Installation

Better Auth is already included in the project:

```json
{
  "dependencies": {
    "better-auth": "^1.3.5",
    "pg": "^8.16.0"
  }
}
```

## Configuration Files

### Server Configuration

**File**: `core/lib/auth.ts`

This file contains the main Better Auth server configuration.

### Client Configuration

**File**: `core/lib/auth-client.ts`

This file exports the client-side auth hooks and utilities.

## Database Setup

###

 PostgreSQL Connection Pool

Better Auth requires a PostgreSQL connection with the `pgbouncer=true` parameter for Supabase compatibility:

```typescript
// core/lib/auth.ts
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL!;
const connectionString = databaseUrl.includes('?')
  ? `${databaseUrl}&pgbouncer=true`
  : `${databaseUrl}?pgbouncer=true`;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 20,
});
```

**Key Points:**
- `pgbouncer=true` - Required for Supabase transaction pooler compatibility
- `max: 20` - Maximum 20 concurrent connections
- `idleTimeoutMillis: 30000` - Close idle connections after 30 seconds
- `ssl: { rejectUnauthorized: false }` - Required for Supabase SSL

## Better Auth Configuration

### Main Configuration Object

```typescript
export const auth = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL,
  
  // User model configuration
  user: {
    modelName: "users",
    additionalFields: { /* ... */ }
  },
  
  // Email/password authentication
  emailAndPassword: { /* ... */ },
  
  // Email verification
  emailVerification: { /* ... */ },
  
  // Social providers
  socialProviders: { /* ... */ },
  
  // Session configuration
  session: { /* ... */ },
  
  // Callbacks
  callbacks: { /* ... */ },
  
  // Advanced settings
  advanced: { /* ... */ },
  
  // Plugins
  plugins: [nextCookies()]
});
```

## User Model Configuration

### Additional Fields

Better Auth allows extending the user model with custom fields:

```typescript
user: {
  modelName: "users", // Use plural table name
  additionalFields: {
    firstName: {
      type: "string",
      required: false,
      input: true, // Allow during signup
    },
    lastName: {
      type: "string",
      required: false,
      input: true,
    },
    language: {
      type: "string",
      required: false,
      input: true,
      defaultValue: I18N_CONFIG.defaultLocale,
    },
    role: {
      type: "string",
      required: false,
      input: false, // Don't allow users to set their own role
      defaultValue: USER_ROLES_CONFIG.defaultRole,
    },
  },
}
```

**Field Options:**
- `type` - Field data type: `string`, `number`, `boolean`, `date`
- `required` - Whether field is required
- `input` - Allow users to provide value during signup
- `defaultValue` - Default value if not provided

**Purpose:**
- `firstName` / `lastName` - Separate name fields for better UX
- `language` - User's preferred language for i18n
- `role` - User role for permissions (set server-side only)

## Email/Password Authentication

### Configuration

```typescript
emailAndPassword: {
  enabled: true,
  requireEmailVerification: true,
  minPasswordLength: 8,
  maxPasswordLength: 128,
  resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
  
  sendResetPassword: async ({ user, url, token }) => {
    const resetUrl = `${url}?token=${token}`;
    const template = emailTemplates.resetPassword({
      userName: user.firstName || '',
      resetUrl: resetUrl,
      appName: process.env.NEXT_PUBLIC_APP_NAME || 'Your App',
      expiresIn: '1 hour'
    });
    
    await emailService.send({
      to: user.email,
      ...template
    });
  },
}
```

**Security Settings:**
- `minPasswordLength: 8` - Minimum password length
- `maxPasswordLength: 128` - Maximum password length
- `requireEmailVerification: true` - Users must verify email before access
- `resetPasswordTokenExpiresIn: 3600` - Reset tokens expire after 1 hour

### Password Reset Flow

```text
1. User requests password reset
2. Better Auth generates secure token
3. sendResetPassword callback sends email
4. User clicks link with token
5. Better Auth validates token
6. User sets new password
```

## Email Verification

### Configuration

```typescript
emailVerification: {
  sendVerificationEmail: async ({ user, token }) => {
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;
    const template = emailTemplates.verifyEmail({
      userName: user.firstName || '',
      verificationUrl: verifyUrl,
      appName: process.env.NEXT_PUBLIC_APP_NAME || 'Your App'
    });
    
    await emailService.send({
      to: user.email,
      ...template
    });
  },
  verifyTokenExpiresIn: 60 * 60 * 24, // 24 hours
}
```

**Flow:**
1. User signs up with email/password
2. Better Auth generates verification token
3. `sendVerificationEmail` callback sends email via Resend
4. User clicks verification link
5. Better Auth verifies token and updates `emailVerified` field

**Token Expiration**: 24 hours (configurable)

## Email Service Integration

The system uses a factory pattern for email providers:

```typescript
import { EmailFactory } from './email';

const emailService = EmailFactory.create();
```

**Email Templates** (`core/lib/email.ts`):

```typescript
export const emailTemplates = {
  verifyEmail: ({ userName, verificationUrl, appName }) => ({
    subject: `Welcome to ${appName}!`,
    html: `
      <h1>Hi ${userName || 'there'}!</h1>
      <p>Please verify your email address:</p>
      <a href="${verificationUrl}">Verify Email</a>
    `
  }),
  
  resetPassword: ({ userName, resetUrl, appName, expiresIn }) => ({
    subject: `Reset your ${appName} password`,
    html: `
      <h1>Hi ${userName || 'there'}!</h1>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>This link expires in ${expiresIn}.</p>
    `
  })
};
```

## Session Configuration

### Session Settings

```typescript
session: {
  expiresIn: 60 * 60 * 24 * 7, // 1 week
  updateAge: 60 * 60 * 24, // 1 day
  cookieCache: {
    enabled: true,
    maxAge: 60 * 5, // 5 minutes
  },
}
```

**Settings Explained:**
- `expiresIn: 604800` - Sessions last 7 days
- `updateAge: 86400` - Session refreshed every 24 hours
- `cookieCache.maxAge: 300` - Cookie cached for 5 minutes to reduce DB queries

### Cookie Cache Benefits

The cookie cache stores session data in the cookie itself for 5 minutes:

- **Reduces database queries** - No DB lookup for cached sessions
- **Improves performance** - Faster authentication checks
- **Auto-invalidation** - Cache expires after 5 minutes

## Callbacks System

### onSignIn Callback

Load user flags when user signs in:

```typescript
callbacks: {
  session: {
    async onSignIn({ user, session }) {
      try {
        const flags = await getUserFlags(user.id);
        
        return {
          user: {
            ...user,
            flags
          },
          session
        };
      } catch (error) {
        console.error('Error loading user flags:', error);
        return {
          user: {
            ...user,
            flags: []
          },
          session
        };
      }
    }
  }
}
```

**Purpose**: Attach user flags to session for entity permission checks.

### onSessionUpdate Callback

Refresh user flags on session update:

```typescript
async onSessionUpdate({ user, session }) {
  try {
    const flags = await getUserFlags(user.id);
    
    return {
      user: {
        ...user,
        flags
      },
      session
    };
  } catch (error) {
    console.error('Error loading user flags:', error);
    return {
      user: {
        ...user,
        flags: user.flags || []
      },
      session
    };
  }
}
```

## Advanced Configuration

### Trusted Origins

Configure allowed origins for CORS:

```typescript
trustedOrigins: [
  process.env.BETTER_AUTH_URL,
  process.env.NEXT_PUBLIC_APP_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3008',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3008',
].filter(Boolean)
```

### Cookie Settings

```typescript
advanced: {
  crossSubDomainCookies: {
    enabled: false,
  },
  useSecureCookies: process.env.NODE_ENV === 'production',
  defaultCookieAttributes: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: "lax",
    path: "/",
  },
}
```

**Cookie Attributes:**
- `httpOnly: true` - Prevents JavaScript access (XSS protection)
- `secure: true` - HTTPS only in production
- `sameSite: "lax"` - CSRF protection
- `path: "/"` - Cookie available site-wide

## Plugins

### Next.js Cookies Plugin

Required for Next.js cookie handling:

```typescript
import { nextCookies } from "better-auth/next-js";

plugins: [
  nextCookies() // MUST be the last plugin
]
```

**Important**: This plugin must be the last in the plugins array.

## Client Configuration

### Auth Client Setup

**File**: `core/lib/auth-client.ts`

```typescript
import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "./auth";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173",
  plugins: [
    inferAdditionalFields<typeof auth>()
  ]
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  forgetPassword,
  resetPassword,
  verifyEmail,
  sendVerificationEmail,
} = authClient;
```

**inferAdditionalFields Plugin**: Automatically infers TypeScript types for custom user fields.

### Using Auth Hooks

```typescript
'use client'

import { useSession, signIn, signOut } from '@/core/lib/auth-client'

export function UserProfile() {
  const { data: session, isPending } = useSession()
  
  if (isPending) return <div>Loading...</div>
  
  if (!session) {
    return <button onClick={() => signIn.email({
      email: 'user@example.com',
      password: 'password'
    })}>
      Sign In
    </button>
  }
  
  return (
    <div>
      <p>Welcome, {session.user.firstName}!</p>
      <p>Role: {session.user.role}</p>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  )
}
```

## TypeScript Types

### Session Types

```typescript
// Inferred from Better Auth configuration
export type Session = typeof auth.$Infer.Session;

// Extended with custom fields
export type SessionUser = typeof auth.$Infer.Session.user & {
  name?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  timezone?: string;
  language?: string;
  flags?: UserFlag[];
};
```

## Environment Variables

Required environment variables:

```bash
# Required
BETTER_AUTH_SECRET=your-32-char-secret-key
DATABASE_URL=postgresql://user:pass@host:5432/db

# Recommended
BETTER_AUTH_URL=https://your-app.com
NEXT_PUBLIC_APP_URL=https://your-app.com
NEXT_PUBLIC_APP_NAME=Your App Name

# For email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxx

# For OAuth (see OAuth Providers guide)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**Generating BETTER_AUTH_SECRET:**

```bash
# Generate a secure 32-character secret
openssl rand -base64 32
```

## Server-Side Usage

### In Server Components

```typescript
import { auth } from '@/core/lib/auth'

export default async function ServerPage() {
  const session = await auth.api.getSession({
    headers: await headers()
  })
  
  if (!session) {
    redirect('/login')
  }
  
  return <div>Hello, {session.user.firstName}!</div>
}
```

### In API Routes

```typescript
import { auth } from '@/core/lib/auth'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers
  })
  
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  return Response.json({ user: session.user })
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
  
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*']
}
```

## Troubleshooting

### Common Issues

**Issue**: "Database connection failed"

```typescript
// Solution: Verify DATABASE_URL and pgbouncer parameter
const connectionString = databaseUrl.includes('?')
  ? `${databaseUrl}&pgbouncer=true`
  : `${databaseUrl}?pgbouncer=true`;
```

**Issue**: "Verification emails not sending"

```typescript
// Solution: Check Resend API key and email templates
console.log('Email service:', emailService);
console.log('Template:', template);
```

**Issue**: "Session not persisting"

```typescript
// Solution: Verify cookie settings and HTTPS in production
advanced: {
  useSecureCookies: process.env.NODE_ENV === 'production',
}
```

## Next Steps

1. **[OAuth Providers](./03-oauth-providers.md)** - Set up Google OAuth
2. **[Session Management](./05-session-management.md)** - Deep dive into sessions
3. **[Security Best Practices](./07-security-best-practices.md)** - Security implementation

---

> 💡 **Tip**: Better Auth handles password hashing, token generation, and security automatically. Focus on configuring the callbacks and email templates for your specific needs.
