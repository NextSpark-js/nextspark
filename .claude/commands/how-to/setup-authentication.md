# /how-to:setup-authentication

Interactive guide to configure authentication with Better Auth.

---

## Required Skills

Before executing, these skills provide deeper context:
- `.claude/skills/better-auth/SKILL.md` - Authentication patterns

---

## Syntax

```
/how-to:setup-authentication
```

---

## Behavior

Guides the user through configuring authentication providers, OAuth, and security settings.

---

## Tutorial Overview

```
STEPS OVERVIEW (4 steps)

Step 1: Configure Better Auth
        └── Core auth settings

Step 2: Set Up Email/Password Auth
        └── Basic authentication

Step 3: Add OAuth Providers
        └── Google, GitHub, etc.

Step 4: Test Authentication
        └── Verify login flows
```

---

## Step 1: Configure Better Auth

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: SETUP AUTHENTICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 4: Configure Better Auth

Set up the core authentication environment:

```env
# .env.local

# REQUIRED: Auth secret (min 32 characters)
BETTER_AUTH_SECRET="your-super-secret-key-at-least-32-chars"

# REQUIRED: App URL
BETTER_AUTH_URL="http://localhost:3000"

# Optional: Trust host in production
BETTER_AUTH_TRUST_HOST="true"
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Generate a Secure Secret:

```bash
# Using OpenSSL
openssl rand -base64 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Auth Configuration:

```typescript
// contents/themes/your-theme/config/auth.config.ts
import type { AuthConfig } from '@/core/types/auth'

export const authConfig: AuthConfig = {
  // Session settings
  session: {
    strategy: 'database',  // or 'jwt'
    maxAge: 7 * 24 * 60 * 60,  // 7 days
  },

  // Email settings
  email: {
    verification: {
      required: true,
      sendOnSignup: true,
    },
  },

  // Password settings
  password: {
    minLength: 8,
    requireUppercase: true,
    requireNumber: true,
    requireSpecial: false,
  },

  // Sign-up settings
  registration: {
    enabled: true,
    requireInvite: false,
  },
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 2 (Email/Password)
[2] Show me all auth config options
[3] I'm getting auth errors
```

---

## Step 2: Email/Password Authentication

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 4: Email/Password Authentication
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Email/password auth is enabled by default. Configure email sending:

```env
# .env.local

# Email provider (Resend recommended)
RESEND_API_KEY="re_xxxx"
EMAIL_FROM="noreply@yourdomain.com"
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Sign Up a New User:

```bash
# Via API
curl -X POST http://localhost:3000/api/auth/sign-up \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123",
    "name": "Test User"
  }'
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Password Reset Flow:

```typescript
// Request password reset
await auth.api.forgotPassword({
  body: { email: 'user@example.com' }
})

// Reset with token (from email)
await auth.api.resetPassword({
  body: {
    token: 'reset-token-from-email',
    newPassword: 'NewSecurePass123'
  }
})
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Development Test Users:

Configure test users for development:

```typescript
// contents/themes/your-theme/config/app.config.ts
export const appConfig = {
  devKeyring: [
    {
      email: 'admin@test.com',
      password: 'Test1234',
      name: 'Admin User',
      role: 'superadmin',
    },
    {
      email: 'user@test.com',
      password: 'Test1234',
      name: 'Regular User',
      role: 'member',
    },
  ],
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 3 (OAuth)
[2] How do I disable email verification?
[3] Set up email templates
```

---

## Step 3: Add OAuth Providers

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 4: Add OAuth Providers
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Google OAuth:

1. Go to console.cloud.google.com
2. Create OAuth 2.0 credentials
3. Set redirect URI: http://localhost:3000/api/auth/callback/google

```env
# .env.local
GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxx"
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 GitHub OAuth:

1. Go to github.com/settings/developers
2. Create new OAuth App
3. Set callback URL: http://localhost:3000/api/auth/callback/github

```env
# .env.local
GITHUB_CLIENT_ID="Ov23xxxx"
GITHUB_CLIENT_SECRET="xxx"
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Enable Providers in Config:

```typescript
// contents/themes/your-theme/config/auth.config.ts
export const authConfig: AuthConfig = {
  providers: {
    google: {
      enabled: true,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      enabled: true,
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
  },
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Use OAuth in Login:

```typescript
'use client'

import { signIn } from '@/core/lib/auth/client'

function LoginPage() {
  return (
    <div>
      <button onClick={() => signIn.social({ provider: 'google' })}>
        Sign in with Google
      </button>
      <button onClick={() => signIn.social({ provider: 'github' })}>
        Sign in with GitHub
      </button>
    </div>
  )
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 4 (Test)
[2] Add more OAuth providers
[3] How do I handle OAuth errors?
```

---

## Step 4: Test Authentication

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 4: Test Authentication
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test all authentication flows:

```bash
# 1. Start the dev server
pnpm dev

# 2. Go to http://localhost:3000/login
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Test Checklist:

[ ] Sign up with email/password
[ ] Verify email (check console in dev)
[ ] Sign in with email/password
[ ] Sign out
[ ] Password reset flow
[ ] Sign in with Google (if configured)
[ ] Sign in with GitHub (if configured)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Check Session:

```typescript
// Server-side
import { auth } from '@/core/lib/auth'

const session = await auth.api.getSession({
  headers: request.headers,
})

// Client-side
import { useSession } from '@/core/lib/auth/client'

function MyComponent() {
  const { data: session, isPending } = useSession()

  if (isPending) return <div>Loading...</div>
  if (!session) return <div>Not logged in</div>

  return <div>Hello, {session.user.name}</div>
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

Your authentication is set up with:
• Email/password authentication
• OAuth providers (if configured)
• Session management
• Password reset flow

📚 Related tutorials:
   • /how-to:set-user-roles-and-permissions - RBAC setup
   • /how-to:customize-app - App settings

🔙 Back to menu: /how-to:start
```

---

## Related Commands

| Command | Action |
|---------|--------|
| `/how-to:set-user-roles-and-permissions` | Configure roles |
| `/how-to:customize-app` | App settings |
