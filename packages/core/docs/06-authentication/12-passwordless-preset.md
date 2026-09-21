# Passwordless Preset (Email OTP + Google)

By default every NextSpark app signs users in **without a password**: a 6-digit
one-time code sent by email, or Google OAuth. That is the portfolio policy —
"the smoothest possible flow for forgetful users" — and it is the value of
`auth.methods` when a theme does not override it.

```text
Login page
├── Continue with Google            (methods includes 'google')
└── Sign in with Email
    ├── enter email → "Email me a sign-in code"
    └── enter 6-digit code → session (first sign-in creates the account)
```

No password field, no `/signup` page (it redirects to `/login`), no
forgot/reset-password flow.

## Configuration

```typescript
// packages/core/src/lib/config/app.config.ts (core defaults)
auth: {
  methods: ['email-otp', 'google'],   // passwordless preset — DEFAULT
  emailAndPassword: { enabled: true }, // password endpoints stay on server-side
}
```

`auth.methods` lists the login methods the templates offer, **in priority
order** — the first email method (`'email-otp'` or `'email-password'`) is the
form the login opens with. Arrays replace (they do not merge), so a theme that
wants something else lists everything it needs:

```typescript
// contents/themes/my-theme/config/app.config.ts
auth: {
  methods: ['email-password', 'google'],               // classic preset
  // methods: ['email-otp', 'email-password', 'google'], // both, code first
  // methods: ['email-otp'],                             // code only, no Google
}
```

| Value | Login UI | Notes |
|-------|----------|-------|
| `'email-otp'` | Email → 6-digit code | Better Auth `emailOTP` plugin. Code lifetime and length are configurable (see `auth.otp` below), 5 minutes / 6 digits by default. First sign-in auto-creates the user (registration mode and domain rules still apply through the `user.create.before` hook). |
| `'google'` | "Continue with Google" | Also gated by `providers.google.enabled` and `GOOGLE_CLIENT_ID`. |
| `'email-password'` | Email + password form | Enables the `/signup` page, the signup link and forgot/reset password. |

### Code lifetime and length: `auth.otp`

`resolveOtpConfig` (`lib/auth/otp-config.ts`) turns `auth.otp` into the values
the `emailOTP` plugin runs with. It is the single source these three read from,
so they cannot drift apart:

- the plugin itself (how long a code stays valid server-side),
- the login form's countdown and code input (`PUBLIC_AUTH_CONFIG.otp`),
- the OTP email's "this code expires in …" notice, in whole minutes rounded
  down ("less than a minute" under 60 seconds) so it never promises more time
  than the code has.

```typescript
auth: {
  otp: {
    expiresIn: 60 * 10, // seconds — default: 300 (5 minutes)
    otpLength: 6,       // digits — default: 6 (Better Auth allows 4-10)
  },
}
```

Both fields are optional and fall back independently; an invalid value (not a
positive number, or an `otpLength` outside 4-10) is rejected with a
`console.warn` and falls back to its default rather than breaking the plugin.

Named presets are exported from `lib/auth/auth-methods.ts`:

```typescript
import { AUTH_PRESETS, resolveAuthMethods, isPasswordlessPreset } from '@nextsparkjs/core/lib/auth/auth-methods'

AUTH_PRESETS.passwordless // ['email-otp', 'google']
AUTH_PRESETS.classic      // ['email-password', 'google']
resolveAuthMethods(AUTH_CONFIG) // validated list, defaults to passwordless
isPasswordlessPreset(methods)   // OTP offered and no password
```

Client components read `PUBLIC_AUTH_CONFIG.methods` (`lib/config/config-sync.ts`).

### Server side: `emailAndPassword.enabled`

`auth.methods` only shapes the UI and the signup page. Better Auth's password
endpoints (`sign-in/email`, `sign-up/email`, forget/reset/change-password) stay
**enabled by default**, even under the passwordless preset, so:

- existing password accounts keep working when a project switches preset,
- seeded test users, Cypress API logins and DevKeyring keep working,
- an admin can still be given a password if a project needs it.

A strictly passwordless app hard-disables them:

```typescript
auth: {
  methods: ['email-otp', 'google'],
  emailAndPassword: { enabled: false },
}
```

## Environment variables

| Variable | Needed for |
|----------|-----------|
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (`RESEND_FROM_NAME` optional) | Delivering the sign-in code. The preset reuses the existing email integration (Resend) — no extra provider. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | "Continue with Google". Without them set `providers.google.enabled: false` or drop `'google'` from `methods`. |
| `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL` | Better Auth itself (unchanged). |

See `.env.example` — the "LOGIN METHODS" section.

## How the OTP flow works

1. `LoginForm` calls `useAuth().sendOtp(email)` →
   `authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' })` →
   `POST /api/auth/email-otp/send-verification-otp`.
2. The server's `emailOTP` plugin (`lib/auth.ts`) renders the localized OTP email
   (`sendOtpVerificationEmail`) and sends it through `EmailFactory` (Resend).
3. The user types the code; `useAuth().signInWithOtp({ email, otp })` →
   `authClient.signIn.emailOtp({ email, otp })` → `POST /api/auth/sign-in/email-otp`.
4. Better Auth verifies the code, creates the user if needed (`disableSignUp:
   false`), runs the usual `databaseHooks` (registration mode, domain checks,
   team bootstrap, signup intent) and issues the session cookie.

Rate limiting: the auth route handler applies the `auth` tier (5 requests / 15
minutes per IP) to every `POST /api/auth/*`, OTP requests included.

## Templates

- **Web**: `components/auth/forms/LoginForm.tsx` renders Google + the OTP form
  (`data-cy="login-otp-*"` selectors) and switches to the password form only when
  `'email-password'` is configured. `app/(auth)/signup/page.tsx` redirects to
  `/login` under the passwordless preset.
- **Mobile**: `apps/mobile/app/login.tsx` reads `APP_CONFIG.auth.methods`
  (`src/config/app.config.ts`) and uses `useAuth().requestOtp` /
  `loginWithOtp`. The code input accepts 4 to 10 digits, every length
  `auth.otp.otpLength` allows, since the app does not read the web config.
  Google opens the provider URL from
  `authApi.getSocialSignInUrl`. Native Google needs `@better-auth/expo` to hand
  the browser session back to the app — see the mobile docs.
- **DevKeyring** (dev only) switches the email form to password mode before
  autofilling test credentials, so it keeps working under the passwordless preset.

## Testing

- `tests/jest/lib/auth/auth-methods.test.ts` — presets and resolution rules.
- `tests/jest/lib/auth-passwordless-preset.test.ts` — the preset is active by
  default and the traditional password endpoints stay enabled unless a theme
  overrides them.
- `tests/jest/components/auth/forms/LoginForm.passwordless.test.tsx` — the
  login renders OTP + Google with no password field under the preset, and the
  classic form when a theme picks `'email-password'`; also the countdown's
  tick/expiry/resend behavior.
- `tests/jest/lib/auth/otp-config.test.ts` — `resolveOtpConfig` resolution
  rules and the countdown helpers.
- `tests/jest/emails/otp-verification-expiry.test.ts` — the OTP email states
  the actual `expiresIn` it was sent, rounded down to whole minutes and
  pluralized correctly in every locale.
- `tests/jest/lib/auth-otp-email-expiry.test.ts` — the emailOTP plugin forwards
  the resolved `expiresIn` to the email template, not a hardcoded value.

## Runtime provider readiness

The auth route evaluates the resolved server `AUTH_CONFIG` together with the runtime environment before invoking Better Auth providers. `GET /api/auth/readiness` returns only a safe status and the methods that can actually be offered (`availableMethods`); it never returns credential values or detailed credential diagnostics. Login screens use this endpoint, including the configured Next.js `basePath`, and render loading, unavailable, or error states instead of buttons that are known to fail.

In production, email OTP requires a valid `RESEND_API_KEY` and a non-placeholder `RESEND_FROM_EMAIL` on a verified domain; the console provider is development-only. Google requires a valid `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Requests for unavailable providers receive a non-secret `503 AUTH_METHOD_UNAVAILABLE` response before provider code runs, while the server log records safe diagnostic codes and remediation messages.

`auth.methods` remains the list of methods advertised by the UI. It does not disable the existing email/password API: use `auth.emailAndPassword.enabled: false` to disable those endpoints, and `auth.providers.google.enabled: false` to disable Google endpoints. Session inspection and sign-out remain available even when no new login method is ready, so existing sessions can still be inspected and ended.

### Invitation registration and password recovery

`GET /api/auth/readiness` also returns two server-derived booleans in `capabilities`. They are computed from the backend switch and email delivery, never from `auth.methods`, so hiding the password field on the login screen does not disable existing invitations or recovery:

| Capability | True when | Used by |
|---|---|---|
| `invitationPasswordSignup` | `auth.emailAndPassword.enabled` is not `false` | Signup page opened with an `inviteToken` (`POST /api/v1/auth/signup-with-invite`) |
| `passwordRecovery` | `auth.emailAndPassword.enabled` is not `false` **and** email delivery is ready | `/forgot-password` (`/request-password-reset`) |

A normal signup page whose only ready method is email OTP shows an explanation and a link to the login page (keeping `callbackUrl`), because the account is created on the first OTP sign-in. Loading, error, and a missing or malformed `capabilities` object all fail closed: the shared UI shows no password action.

### Upgrading existing hosts

Hosts generated from an earlier core version own their copies of `app/api/auth/[...all]/route.ts` and `app/api/v1/auth/signup-with-invite/route.ts`; updating the package does not change them. Add the gate by hand.

`app/api/auth/[...all]/route.ts`:

```ts
import { getAuthReadinessResponse } from '@nextsparkjs/core/lib/auth/runtime-readiness'

export async function GET(req: NextRequest) {
  // First statement: also serves GET /api/auth/readiness.
  const readinessResponse = await getAuthReadinessResponse(req)
  if (readinessResponse) {
    return wrapAuthHandlerWithCors(() => Promise.resolve(readinessResponse), req)
  }
  // ...existing GET logic, then Better Auth's handler
}

export async function POST(req: NextRequest) {
  // ...existing rate limit check (keep it first)
  const readinessResponse = await getAuthReadinessResponse(req)
  if (readinessResponse) {
    return wrapAuthHandlerWithCors(() => Promise.resolve(readinessResponse), req)
  }
  // ...existing signup/OAuth handling, then Better Auth's handler
}
```

The call must run before any code that invokes Better Auth (`handlers.GET/POST`, `auth.handler`, `auth.api.*`). It returns `null` for everything it does not gate, including `get-session` and `sign-out`, so existing sessions keep working.

`app/api/v1/auth/signup-with-invite/route.ts` calls `auth.handler` directly and does not pass through the catch-all gate. Add this at the top of the `POST` handler, before reading the body:

```ts
import { AUTH_CONFIG } from '@nextsparkjs/core/lib/config'
import { isPasswordLoginEnabled } from '@nextsparkjs/core/lib/auth/auth-methods'

if (!isPasswordLoginEnabled(AUTH_CONFIG)) {
  return addCorsHeaders(
    createApiError('Password authentication is unavailable', 503, null, 'AUTH_METHOD_UNAVAILABLE'),
    req,
  )
}
```

> **Warning:** without the catch-all change, `GET /api/auth/readiness` returns 404. Login, signup, and forgot-password then show the error state and offer no sign-in action. There is no permissive fallback. Provider endpoints called directly also stay ungated until the route is updated.

This runtime gate does not replace deployment preflight. Build/start readiness enforcement and wizard provider collection are separate dependent slices; a production environment must still supply its credentials at runtime even if they were present while building.
