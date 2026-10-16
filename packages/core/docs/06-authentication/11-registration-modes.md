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

Users can only register via an invitation link. The first user bootstraps the platform without an invite: in `single-tenant` until the global team exists, in the other team modes until any team exists. If no team exists after the first user (for example with `signupIntent.skipTeamForNonOwnerIntents`, or when creating the first team fails), registration stays open until one does. After that, a new account is created only:

- through the invitation link (`/api/v1/auth/signup-with-invite`, with or without a password), or
- by a first email-code or Google sign-in for a verified address with a pending, unexpired invitation: the code or the provider proves the address, and the account then accepts its invitation instead of getting a team of its own.

A password sign-up on `/api/auth/sign-up/email` is refused with `SIGNUP_RESTRICTED`, invitation or not, since it does not prove the address. Existing users sign in as usual, with Google too; a Google sign-in for a new address without an invitation is redirected to `/auth-error?error=SIGNUP_RESTRICTED`. Once the bootstrap is over, `/signup` sends visitors to `/login`; when it comes from an invitation page it carries `callbackUrl` (a path on the app only), `fromInvite` and `email` along, so signing in returns to `/accept-invite/<token>` and accepts the invitation. Requires a working email service (Resend).

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
// config/app.config.ts
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

1. **Route handler** (`packages/core/src/routes/api/auth/[...all]/route.ts`): Blocks email signup for `domain-restricted` and `invitation-only` modes at the API level. OAuth callbacks are not gated there: they may be an existing user's sign-in, so the user-creation hook below decides for a new account.

2. **Database hook — user create** (`lib/auth.ts` → `databaseHooks.user.create.before`): Validates email domain for `domain-restricted` and `domain-open` modes before user creation. Blocks signup in `invitation-only` once the first-user bootstrap is over (`TeamService.isBootstrapDone()`, which every gate shares), unless the account comes from the invitation link or its address has a pending invitation.

3. **Database hook — session create** (`lib/auth.ts` → `databaseHooks.session.create.before`): Validates email domain on every login attempt for `domain-restricted` and `domain-open` modes, preventing existing users outside allowed domains from logging in.

4. **Signup page** (`packages/core/src/routes/(auth)/signup/page.tsx`): Redirects to `/login` for `domain-restricted` and `invitation-only` modes.

5. **LoginForm** (`components/auth/forms/LoginForm.tsx`): Hides the email login option for `domain-restricted` mode. Shows signup link for `open` and `domain-open` modes.

6. **Sign-up request** (`lib/auth/registration-guard-plugin.ts`, before `/sign-up/*` in Better Auth): refuses sign-up in `invitation-only` once the bootstrap is over, unless the request runs inside the signup context `/api/v1/auth/signup-with-invite` sets after validating the invitation on the server. A token sent by the client (header or query) is not taken as an invitation.

7. **Sign-in code request** (`lib/auth/registration-guard-plugin.ts`, before `/email-otp/send-verification-otp`): in `domain-restricted` and `domain-open`, a `sign-in` code for an address outside `allowedDomains` is refused before any email is sent.

Every refusal above answers `403` with a code in the JSON body: `DOMAIN_NOT_ALLOWED` or `SIGNUP_RESTRICTED`. A Google sign-in is redirected to `/auth-error?error=<code>` instead. The login, sign-up and auth error pages show a translated message for both codes, and no response, redirect or log names the allowed domains.

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

The list itself is never sent, but whether one domain is allowed can be learned: asking for a sign-in code for an address answers `403 DOMAIN_NOT_ALLOWED` when its domain is outside the list, without needing access to that mailbox. This is deliberate: sending a code that can never work is worse. The request is rate limited like any other auth request. Treat `allowedDomains` as something a determined caller can probe one domain at a time, not as a secret.

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
