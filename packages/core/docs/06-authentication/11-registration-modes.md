# Registration Modes

NextSpark provides configurable registration modes to control how new users can sign up and log in. This is configured at the theme level via `app.config.ts`.

## Overview

| Mode | Email Signup | Google OAuth Signup | Email Login | Google Login | Signup Page |
|------|-------------|-------------------|-------------|-------------|-------------|
| `open` (default) | Yes | Yes | Yes | Yes | Visible |
| `domain-restricted` | No | Only allowed domains | No | Only allowed domains | Hidden |
| `domain-open` | Only allowed domains | Only allowed domains | Only allowed domains | Only allowed domains | Visible |
| `invitation-only` | Via invite | Via invite | Yes | Configurable | Invite only |

## Mode Descriptions

### `open` (default)

Anyone can register using email+password or Google OAuth. No restrictions.

```typescript
auth: {
  registration: {
    mode: 'open',
  },
}
```

**Use case**: Public SaaS products, open beta, personal projects.

---

### `domain-restricted`

Only Google OAuth is available, restricted to specific email domains. Email+password is fully disabled. Users with allowed domains are auto-created on first Google sign-in.

```typescript
auth: {
  registration: {
    mode: 'domain-restricted',
    allowedDomains: ['mycompany.com', 'partner.com'],
  },
}
```

**Use case**: Internal tools where employees must use corporate Google accounts.

---

### `domain-open`

Both email+password and Google OAuth are available, but registration and login are restricted to specific email domains. Domain validation is enforced server-side on both signup and every login.

```typescript
auth: {
  registration: {
    mode: 'domain-open',
    allowedDomains: ['mycompany.com', 'partner.com'],
  },
}
```

**Use case**: QA environments, internal tools that need email+password access but want to restrict to known domains.

---

### `invitation-only`

Users can only register via an invitation link. The first user bootstraps the team without an invite; all subsequent users require one. Requires a working email service (Resend).

```typescript
auth: {
  registration: {
    mode: 'invitation-only',
  },
}
```

**Use case**: Private beta, closed platforms, single-tenant apps with manual onboarding.

---

## Configuration Reference

```typescript
// contents/themes/my-theme/config/app.config.ts
auth: {
  registration: {
    /**
     * Registration mode:
     * - 'open': Anyone can register (default)
     * - 'domain-restricted': Google OAuth only, restricted to allowedDomains
     * - 'domain-open': Email+password and Google OAuth, restricted to allowedDomains
     * - 'invitation-only': Registration via invite link only
     */
    mode: 'domain-open' as const,

    /**
     * Allowed email domains (without @).
     * Used by 'domain-restricted' and 'domain-open' modes.
     * Ignored for 'open' and 'invitation-only'.
     */
    allowedDomains: ['mycompany.com'],
  },
  providers: {
    google: {
      enabled: true,
    },
  },
}
```

## Enforcement Points

Registration mode restrictions are enforced at multiple layers:

1. **Route handler** (`app/api/auth/[...all]/route.ts`): Blocks email signup for `domain-restricted` and `invitation-only` modes at the API level.

2. **Database hook — user create** (`lib/auth.ts` → `databaseHooks.user.create.before`): Validates email domain for `domain-restricted` and `domain-open` modes before user creation. Blocks signup in `invitation-only` when a team already exists.

3. **Database hook — session create** (`lib/auth.ts` → `databaseHooks.session.create.before`): Validates email domain on every login attempt for `domain-restricted` and `domain-open` modes, preventing existing users outside allowed domains from logging in.

4. **Signup page** (`app/(auth)/signup/page.tsx`): Redirects to `/login` for `domain-restricted` and `invitation-only` modes.

5. **LoginForm** (`components/auth/forms/LoginForm.tsx`): Hides the email login option for `domain-restricted` mode. Shows signup link for `open` and `domain-open` modes.

## Types

```typescript
// packages/core/src/lib/config/types.ts

type RegistrationMode = 'open' | 'domain-restricted' | 'domain-open' | 'invitation-only'

interface AuthRegistrationConfig {
  mode: RegistrationMode
  allowedDomains?: string[]  // Used by 'domain-restricted' and 'domain-open'
}
```

## Helper Functions

```typescript
import {
  isRegistrationOpen,       // true for 'open' and 'domain-open'
  isSignupPageVisible,      // true for 'open' and 'domain-open'
  isEmailSignupEnabled,     // true for 'open' and 'domain-open'
  isEmailLoginVisible,      // true for all modes except 'domain-restricted'
  isDomainAllowed,          // checks email against allowedDomains list
  shouldBlockSignup,        // true for 'domain-restricted' non-OAuth signup
} from '@nextsparkjs/core/lib/auth/registration-helpers'
```

## Client-Side Access

The `PublicAuthConfig` (exposed to client components via `config-sync.ts`) only includes the mode — `allowedDomains` is intentionally stripped to prevent domain enumeration.

```typescript
import { PUBLIC_AUTH_CONFIG } from '@nextsparkjs/core/lib/config/config-sync'

// Available in client components:
PUBLIC_AUTH_CONFIG.registration.mode  // 'open' | 'domain-restricted' | 'domain-open' | 'invitation-only'
PUBLIC_AUTH_CONFIG.providers.google.enabled  // boolean
```

## Related

- [Better Auth Integration](./02-better-auth-integration.md)
- [OAuth Providers](./03-oauth-providers.md)
- [Testing Authentication](./08-testing-authentication.md)
