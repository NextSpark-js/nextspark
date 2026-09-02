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
| `'email-otp'` | Email → 6-digit code | Better Auth `emailOTP` plugin. Code expires in 5 minutes. First sign-in auto-creates the user (registration mode and domain rules still apply through the `user.create.before` hook). |
| `'google'` | "Continue with Google" | Also gated by `providers.google.enabled` and `GOOGLE_CLIENT_ID`. |
| `'email-password'` | Email + password form | Enables the `/signup` page, the signup link and forgot/reset password. |

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
  `loginWithOtp`; Google opens the provider URL from
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
  classic form when a theme picks `'email-password'`.
