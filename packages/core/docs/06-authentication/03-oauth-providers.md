# OAuth Providers

This guide covers social sign-in with Better Auth: the provider map, the four built-in providers (Google, GitHub, Microsoft and Apple) with their console setup, callback URLs, profile mapping and account linking, any other Better Auth provider through the map, and a real-provider test plan for each.

## The Provider Map

Social providers are declared in `config/app.config.ts` and enabled by their credentials in the environment. Credentials never go in `app.config.ts`: it is bundled for the browser.

```typescript
// config/app.config.ts
export const APP_CONFIG_OVERRIDES = {
  auth: {
    // A login and sign-up button for each built-in provider listed here, in this order,
    // once its credentials are ready
    methods: ['email-otp', 'google', 'github', 'microsoft', 'apple'],
    providers: {
      // Built-in: `enabled: false` turns it off everywhere (button and API)
      apple: { enabled: true },
      // Any other Better Auth social provider: listed here, it works through the API, without a button
      discord: {},
      gitlab: { options: { issuer: 'https://gitlab.example.com' } },
    },
  },
}
```

| Provider | Enabled when | Button | Credentials |
|---|---|---|---|
| `google`, `github`, `microsoft`, `apple` | listed in `auth.methods` or `auth.providers`, not `enabled: false`, credentials ready | yes, when listed in `auth.methods` | see each provider below |
| any other id Better Auth knows (`discord`, `gitlab`, `linkedin`, `slack`, ...) | listed in `auth.providers`, not `enabled: false`, both variables set | no | `<ID>_CLIENT_ID`, `<ID>_CLIENT_SECRET` (`microsoft-entra-id` → `MICROSOFT_ENTRA_ID_...`) |
| an id Better Auth does not know | never: ignored with a warning at startup | no | — |

- The core default lists `providers.google`, so `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` alone keep enabling Google through the API, as they always did, and `methods` decides its button.
- Credentials alone never turn on another provider: a `GITHUB_CLIENT_ID` that belongs to another integration does nothing until `github` is listed.
- `options` are extra, non-secret Better Auth options for that provider (scopes, `prompt`, an `issuer`). They cannot replace the credentials.
- The resolution lives in `lib/auth/social-providers.ts` (`resolveSocialProviders`), and `lib/auth.ts` passes its result to Better Auth.

### Readiness

Each built-in provider has a readiness check, `isRuntimeSocialProviderAvailable(provider)` in `lib/auth/runtime-readiness.ts` (`isRuntimeGoogleAvailable()` stays for Google). It checks the variables' presence and shape and reports problems by variable name (`GITHUB_CLIENT_ID_MISSING`, `APPLE_PRIVATE_KEY_MALFORMED`, ...), never their values.

- The login and sign-up forms read `GET /api/auth/readiness` and render a button only for a ready built-in provider listed in `auth.methods`.
- The route gate answers `503 AUTH_METHOD_UNAVAILABLE` to a built-in provider's `sign-in/social` and `callback/<id>` until it is ready, before Better Auth runs.
- `nextspark build` runs the same check; `NEXTSPARK_AUTH_RUNTIME_ONLY` accepts `email`, `google`, `github`, `microsoft` and `apple` for credentials injected only at runtime.
- The map's other providers have no readiness check: missing variables leave them off with a warning, and Better Auth answers for a provider it does not serve.

### Callback URLs

Every provider returns to `<origin><basePath>/api/auth/callback/<id>`:

| App | Callback URL |
|---|---|
| no `basePath` | `https://example.com/api/auth/callback/github` |
| `basePath: '/app'` in `next.config` | `https://example.com/app/api/auth/callback/github` |
| `BETTER_AUTH_URL` with its own path | that URL + `/callback/<id>`, used as-is |

Register the exact URL for each environment (local, preview, production) in the provider's console.

### Registration Gates

Every provider's callback creates users through the same `databaseHooks.user.create.before` in `lib/auth.ts`, so the registration mode applies the same way to all of them:

- `invitation-only`: after the first user, a new address needs a pending invitation and a verified email; otherwise `/auth-error?error=SIGNUP_RESTRICTED`. An existing user still signs in.
- `domain-restricted` / `domain-open`: an address outside `allowedDomains` gets `DOMAIN_NOT_ALLOWED`, at sign-up and on every sign-in.
- The passwordless preset changes nothing here: social providers sit next to the email code.
- A provider other than Google that has not verified the address creates no account: `/auth-error?error=SOCIAL_EMAIL_UNVERIFIED`. Such an account could be waiting for the address's owner when they later sign in with an email code. Google keeps its behaviour from before the provider map.

### Account Linking

Better Auth links a provider to an existing account with the same email only when the provider says the email is verified and the existing account's email is verified too. NextSpark sets no trusted providers, so an unverified email never links: the callback goes to `/auth-error?error=account_not_linked`. The profile mappings of GitHub, Microsoft and Apple leave Better Auth's verified flag alone; Google's sets it from `email_verified`, as before.

## Google OAuth Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" > "Credentials"

### Step 2: Configure OAuth Consent Screen

1. Click "OAuth consent screen" in the left sidebar
2. Select "External" user type (or "Internal" for Google Workspace)
3. Fill in application information:
   - **App name**: Your application name
   - **User support email**: Your support email
   - **Developer contact**: Your email
4. Add scopes (optional for basic auth):
   - `./auth/userinfo.email`
   - `./auth/userinfo.profile`
5. Add test users if in testing mode
6. Save and continue

### Step 3: Create OAuth Client ID

1. Go to "Credentials" tab
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Web application"
4. Configure:
   - **Name**: Your app name (e.g., "NextSpark Web")
   - **Authorized JavaScript origins**:
     ```text
     http://localhost:3010
     http://localhost:3000
     https://your-production-domain.com
     ```text
   - **Authorized redirect URIs**:
     ```text
     http://localhost:3010/api/auth/callback/google
     http://localhost:3000/api/auth/callback/google
     https://your-production-domain.com/api/auth/callback/google
     ```text
5. Click "Create"
6. Copy the **Client ID** and **Client Secret**

### Step 4: Configure Environment Variables

Add to your `.env.local`:

```bash
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## Better Auth Configuration

### Google Provider Setup

**File**: `lib/auth/social-providers.ts` (`resolveSocialProviders`, `socialProfileMapper('google', ...)`). Better Auth receives:

```typescript
socialProviders: {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    mapProfileToUser: (profile: GoogleProfile) => {
      // Google provides given_name and family_name separately
      const firstName = profile.given_name || profile.name.split(' ')[0] || '';
      const lastName = profile.family_name || profile.name.split(' ').slice(1).join(' ') || '';
      
      return {
        email: profile.email,
        name: profile.name,
        firstName: firstName,
        lastName: lastName,
        language: I18N_CONFIG.defaultLocale,
        role: USER_ROLES_CONFIG.defaultRole,
        image: profile.picture,
        emailVerified: profile.email_verified || false,
      };
    },
  },
}
```

### Google Profile Structure

```typescript
interface GoogleProfile {
  email: string;              // User's email address
  name: string;               // Full name
  given_name?: string;        // First name
  family_name?: string;       // Last name
  picture?: string;           // Profile picture URL
  email_verified?: boolean;   // Email verification status
}
```

### Profile Mapping Explained

The `mapProfileToUser` function transforms Google's profile data to match your user model:

1. **firstName**: Uses `given_name` if available, otherwise splits `name`
2. **lastName**: Uses `family_name` if available, otherwise gets remaining parts of `name`
3. **name**: Full name for Better Auth compatibility
4. **language**: Assigns default locale from config
5. **role**: Assigns default role from config
6. **image**: Google profile picture
7. **emailVerified**: Already verified by Google

## GitHub

### Console Setup

1. GitHub → **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App** (for an organization: the organization's settings → Developer settings).
2. **Homepage URL**: your app's origin.
3. **Authorization callback URL**: `https://example.com/api/auth/callback/github` (with a `basePath`: `https://example.com/app/api/auth/callback/github`). An OAuth App takes one callback URL: create one app per environment (for example "MyApp local" with `http://localhost:3000/api/auth/callback/github`).
4. **Register application**, copy the **Client ID**, then **Generate a new client secret** and copy it (it is shown once).
5. A GitHub App works too: give it the account permission **Email addresses: read-only**, or Better Auth cannot read the user's address.

```bash
GITHUB_CLIENT_ID=Ov23li...
GITHUB_CLIENT_SECRET=...
```

```typescript
auth: { methods: ['email-otp', 'google', 'github'] }
```

### Profile and Email

- **Scopes**: `read:user` and `user:email` (Better Auth's defaults).
- **Mapping**: `firstName` / `lastName` split from the profile name (first word / the rest), or the login when the name is empty; the default role and language, as for Google.
- **Email**: Better Auth asks `/user/emails` and takes the primary address, with its `verified` flag.
  - Primary address verified: sign-up, sign-in and linking to an existing verified account with that address.
  - Primary address not verified on GitHub: no account is created (`SOCIAL_EMAIL_UNVERIFIED`) and nothing links (`account_not_linked`).
  - No address at all (the emails API answers an empty list, for example a GitHub App without the email permission): Better Auth stops with `/auth-error?error=email_not_found`, before any account.
  - A private ("Keep my email addresses private") address is still returned to the app by `/user/emails`; the `noreply` address is not used.

## Microsoft (Entra ID and personal accounts)

### Console Setup

1. [Microsoft Entra admin center](https://entra.microsoft.com/) → **Applications** → **App registrations** → **New registration**.
2. **Supported account types**:
   - "Accounts in any organizational directory and personal Microsoft accounts" for the default tenant `common`;
   - "... any organizational directory" only → `MICROSOFT_TENANT_ID=organizations`;
   - "Personal Microsoft accounts only" → `MICROSOFT_TENANT_ID=consumers`;
   - "This organizational directory only" → `MICROSOFT_TENANT_ID=<the tenant id>`.
3. **Redirect URI**: platform **Web**, `https://example.com/api/auth/callback/microsoft` (with a `basePath`: `https://example.com/app/api/auth/callback/microsoft`). Add one per environment under **Authentication**.
4. Copy the **Application (client) ID**.
5. **Certificates & secrets** → **New client secret** → copy its **Value** (not the Secret ID). It expires: note the date.
6. **Token configuration** → **Add optional claim** → ID token → `email` and `verified_primary_email`. Better Auth reads the email's verified state from `email_verified` or from `verified_primary_email` / `verified_secondary_email`; without one of them every Microsoft email counts as unverified.

```bash
MICROSOFT_CLIENT_ID=00000000-0000-0000-0000-000000000000
MICROSOFT_CLIENT_SECRET=...
# common (default), organizations, consumers, or a tenant id
MICROSOFT_TENANT_ID=common
```

```typescript
auth: { methods: ['email-otp', 'google', 'microsoft'] }
```

### Profile and Email

- **Scopes**: `openid profile email User.Read offline_access` (Better Auth's defaults); the profile photo comes from Microsoft Graph.
- **Mapping**: `given_name` / `family_name` when present, otherwise the name split; the default role and language.
- **Tenant**: for a B2B app, `MICROSOFT_TENANT_ID=organizations` (work and school accounts only) is the safe choice. Personal accounts can sign up only if their ID token carries a verified-email claim; whether they do with the optional claims of step 6 is what plan case 3 records.
- **Email**: from the ID token. On the multi-tenant endpoints Better Auth checks that the token's issuer is its own tenant.
  - Verified (see step 6): sign-up, sign-in and linking.
  - Not verified, or no verified-email claim: no new account (`SOCIAL_EMAIL_UNVERIFIED`) and no linking (`account_not_linked`). An Entra administrator can set any address on a work account, so an unverified one must not be trusted.
  - Whether personal accounts carry a verified-email claim is part of the real-provider test plan below.

## Apple

### Console Setup

Sign in with Apple needs an Apple Developer Program membership, HTTPS and a real domain: Apple accepts no `localhost` or `http` return URL. Test locally through an HTTPS tunnel with its own domain.

1. [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) → **Identifiers** → an **App ID** with the **Sign in with Apple** capability (your iOS app's, or a new one).
2. **Identifiers** → **+** → **Services IDs** → for example `com.example.web`. This is `APPLE_CLIENT_ID`.
3. Open the Services ID → enable **Sign in with Apple** → **Configure**: primary App ID from step 1, **Domains** `example.com`, **Return URLs** `https://example.com/api/auth/callback/apple` (with a `basePath`: `https://example.com/app/api/auth/callback/apple`).
4. **Keys** → **+** → **Sign in with Apple** → configure with the primary App ID → **Continue** → **Register** → **Download** the `.p8` file (downloadable once) and note the **Key ID**.
5. Your **Team ID** is at the top right of the developer account.
6. To email users who hide their address: **Services** → **Sign in with Apple for Email Communication** → register your sending domain or addresses, or mail to `@privaterelay.appleid.com` addresses is refused.

```bash
APPLE_CLIENT_ID=com.example.web
APPLE_TEAM_ID=ABCDE12345
APPLE_KEY_ID=KEY1234567
# The .p8 file's contents; in a one-line .env write its newlines as \n
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMG...\n-----END PRIVATE KEY-----"
# Optional: your iOS app's bundle id, for id tokens from native Sign in with Apple
APPLE_APP_BUNDLE_IDENTIFIER=com.example.ios
```

```typescript
auth: { methods: ['email-otp', 'google', 'apple'] }
```

### What NextSpark Does for Apple

- **Client secret**: Apple wants an ES256 JWT signed with the `.p8` key (`iss` = team id, `sub` = Services ID, `aud` = `https://appleid.apple.com`, header `kid` = key id). NextSpark signs it at startup with Node's crypto (`createAppleClientSecret` in `lib/auth/social-providers.ts`), valid for 180 days (Apple's limit is six months), and signs a new one a day before it expires on a server that runs that long. A key that is not a P-256 EC key turns Apple off with an error in the log. There is no `APPLE_CLIENT_SECRET` to rotate by hand.
- **form_post**: Apple answers with a cross-site `POST` to the callback. Better Auth turns it into a `GET` on the same callback, where the browser sends the sign-in cookies. NextSpark adds `https://appleid.apple.com` to Better Auth's trusted origins when Apple is on, as Better Auth's Apple guide asks.
- **Native apps**: with `APPLE_APP_BUNDLE_IDENTIFIER` set, id-token sign-in (`/sign-in/social` with `idToken`) accepts only tokens issued for that bundle id, not for the Services ID; the web flow is not affected.
- **Logs**: the GET callback's `user` query parameter carries the first-consent name and email, so exclude it from request logging (proxy, load balancer, access logs).
- **Key check**: readiness parses `APPLE_PRIVATE_KEY` the way the signer does, so a key that is not P-256 (an RSA key, or garbage inside the PEM armor) leaves Apple not ready: no button, and its sign-in answers 503 `APPLE_PRIVATE_KEY_MALFORMED`.
- **Rate limit**: Apple's form_post `POST /api/auth/callback/apple` is not charged to the `auth` rate limit (Better Auth only redirects it to the GET callback), so an Apple sign-in costs one request of that limit, like the others.
- **Name**: Apple sends the name only on the user's first consent, in the form post. Better Auth reads it there; the mapping splits it into `firstName` / `lastName`. Later sign-ins carry no name and do not change the stored one. If the first sign-in fails after consent, the name is lost: the user removes the app at appleid.apple.com → Sign in with Apple, and consents again.
- **Email**:
  - Shared address (`email_verified: true`): sign-up, sign-in, and linking to an existing verified account with that address.
  - Hidden address (private relay, `...@privaterelay.appleid.com`): Apple verifies it, so it signs up and signs in, but it matches no existing account: the user gets a separate account rather than a link. Under `invitation-only` an invitation to their real address does not admit them; invite the relay address or have them share their email. Under `domain-restricted` a relay address is outside `allowedDomains`.
  - An Apple account whose email Apple reports unverified (possible for Apple at Work & School accounts): no account (`SOCIAL_EMAIL_UNVERIFIED`), no linking.

## Other Providers of the Map

Any [Better Auth social provider](https://www.better-auth.com/docs/authentication/other-social-providers) can be enabled by listing it in `auth.providers` with its credentials in the environment:

```typescript
auth: {
  providers: {
    discord: {},
    // non-secret extras pass through to Better Auth
    gitlab: { options: { issuer: 'https://gitlab.example.com' } },
  },
}
```

```bash
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
GITLAB_CLIENT_ID=...
GITLAB_CLIENT_SECRET=...
```

- The callback URL is `<origin><basePath>/api/auth/callback/<id>`.
- There is no button: start the sign-in from your own UI or a client: `authClient.signIn.social({ provider: 'discord', callbackURL: '/dashboard' })`.
- The mapping splits a `name` / `given_name` / `family_name` from the profile when there is one and assigns the default role and language; the registration gates and the unverified-email rule apply as for the built-ins.
- Non-secret options a provider requires go in `options`. For example `cognito` needs `{ domain, region, userPoolId }` (`providers: { cognito: { options: { domain: 'auth.example.com', region: 'eu-west-1', userPoolId: 'eu-west-1_abc123' } } }`). A provider Better Auth refuses to build with the given options is left off with a startup warning naming its id, and the rest of auth keeps working.
- A provider that needs other credentials than a client id and secret (for example TikTok's `clientKey`) is not covered by the variable convention.

## OAuth Flow

### Sign In Process

```text
1. User clicks "Sign in with Google" button
   ↓
2. Redirected to Google consent screen
   ↓
3. User authorizes application
   ↓
4. Google redirects to callback URL with authorization code
   ↓
5. Better Auth exchanges code for access token
   ↓
6. Better Auth fetches user profile from Google
   ↓
7. mapProfileToUser transforms profile data
   ↓
8. User account created/linked in database
   ↓
9. Session created and user redirected to dashboard
```

## Implementation

### Sign In Button Component

```typescript
'use client'

import { authClient } from '@nextsparkjs/core/lib/auth-client'

export function GoogleSignInButton() {
  const handleGoogleSignIn = async () => {
    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/dashboard',
      })
    } catch (error) {
      console.error('Google sign in failed:', error)
    }
  }
  
  return (
    <button
      onClick={handleGoogleSignIn}
      className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
    >
      <GoogleIcon />
      <span>Continue with Google</span>
    </button>
  )
}
```

### With Redirect Options

```typescript
await authClient.signIn.social({
  provider: 'google',
  callbackURL: '/dashboard',
  errorCallbackURL: '/login?error=oauth_failed',
})
```

## Account Linking

### When Email Already Exists

Better Auth links a provider to an existing user with the same email when both emails are verified (see [Account Linking](#account-linking) above):

**Scenario 1: Email Account Exists**

```text
1. User signed up with an email code or email/password (verified)
2. User signs in with Google, GitHub, Microsoft or Apple using the same, verified, email
3. Better Auth links the provider account to the existing user
4. User can now sign in with either method
```

**Scenario 2: Unverified Email at the Provider**

```text
1. User has an account
2. User signs in with a provider that has not verified that email
3. No link: /auth-error?error=account_not_linked
```

### Account Table Structure

```sql
CREATE TABLE "account" (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,           -- Google user ID
  "providerId" TEXT NOT NULL,          -- "google"
  "userId" TEXT NOT NULL,              -- Your user ID
  "accessToken" TEXT,                  -- OAuth access token
  "refreshToken" TEXT,                 -- OAuth refresh token
  UNIQUE("providerId", "accountId")
);
```

## Trusted Origins

Configure allowed origins for OAuth redirects:

```typescript
trustedOrigins: [
  process.env.BETTER_AUTH_URL,
  process.env.NEXT_PUBLIC_APP_URL,
  'http://localhost:3010',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean)
```

**Important**: All OAuth callback URLs must be in `trustedOrigins`. With Apple on, NextSpark adds `https://appleid.apple.com` itself, for its form_post callback.

## Security Considerations

### State Parameter

Better Auth automatically includes a `state` parameter in OAuth requests to prevent CSRF attacks:

```text
https://accounts.google.com/o/oauth2/v2/auth?
  client_id=...
  &redirect_uri=...
  &state=random_secure_token    ← CSRF protection
  &scope=...
```

### Token Storage

OAuth tokens are stored securely:

- **Access tokens**: Stored in `account` table (not exposed to client)
- **Refresh tokens**: Stored encrypted (if applicable)
- **Session tokens**: Stored in secure httpOnly cookies

### Email Verification

An OAuth user's `emailVerified` comes from the provider: Google's `email_verified`, GitHub's verified flag on the primary address, Microsoft's verified-email claims, Apple's `email_verified`. A provider other than Google that reports the email unverified creates no account.

## Handling OAuth Errors

### Common Errors

**Error**: "Redirect URI mismatch"

**Solution**: Ensure callback URL in Google Cloud Console matches exactly:

```text
http://localhost:3010/api/auth/callback/google
```

**Error**: "Invalid client ID"

**Solution**: Verify `GOOGLE_CLIENT_ID` environment variable is set correctly.

**Error**: "Access denied"

**Solution**: User cancelled authorization. Handle gracefully:

```typescript
const searchParams = new URLSearchParams(window.location.search)
const error = searchParams.get('error')

if (error === 'access_denied') {
  // User cancelled OAuth flow
  showMessage('Sign in cancelled')
}
```

### Error Handling in Component

```typescript
'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

export function OAuthErrorHandler() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  
  useEffect(() => {
    if (error === 'oauth_account_not_linked') {
      showToast('Please sign in with your original method')
    } else if (error === 'oauth_failed') {
      showToast('Authentication failed. Please try again.')
    }
  }, [error])
  
  return null
}
```

## Testing OAuth Flow

### Local Testing

1. Start development server: `pnpm dev`
2. Navigate to login page
3. Click "Sign in with Google"
4. Use a test Google account
5. Verify redirect to dashboard
6. Check database for user and account records

### Test Accounts

For development, add test users in Google Cloud Console:
1. Go to "OAuth consent screen"
2. Scroll to "Test users"
3. Add email addresses
4. These users can sign in while app is in testing mode

## Custom OAuth Scopes

If you need additional Google APIs:

```typescript
socialProviders: {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    scopes: [
      'openid',
      'email',
      'profile',
      // Add additional scopes as needed
      'https://www.googleapis.com/auth/calendar.readonly'
    ],
    mapProfileToUser: (profile) => {
      // ...
    },
  },
}
```

**Note**: Additional scopes require app verification by Google for production use.

## Production Checklist

Before deploying to production:

- [ ] Set production redirect URIs in Google Cloud Console
- [ ] Configure `BETTER_AUTH_URL` environment variable
- [ ] Add production domain to `trustedOrigins`
- [ ] Submit app for Google OAuth verification (if using sensitive scopes)
- [ ] Test OAuth flow in production environment
- [ ] Monitor OAuth errors in logs

## Debugging

### Enable Debugging

```typescript
// Add to Better Auth configuration (development only)
advanced: {
  debug: process.env.NODE_ENV === 'development',
}
```

### Check OAuth Callback

```typescript
// Create debug endpoint to inspect callback data
// api/auth/debug/callback/route.ts
export async function GET(request: Request) {
  const url = new URL(request.url)
  const params = Object.fromEntries(url.searchParams)
  
  return Response.json({
    params,
    headers: Object.fromEntries(request.headers)
  })
}
```

### Verify Profile Mapping

```typescript
mapProfileToUser: (profile) => {
  console.log('Google profile:', profile) // Debug log
  
  const mapped = {
    email: profile.email,
    // ... rest of mapping
  }
  
  console.log('Mapped user:', mapped) // Debug log
  return mapped
}
```

## Real-Provider Test Plans

These plans need real OAuth apps and accounts, so they are not part of the automated suites. They are written to be run by a person, on a production build (`pnpm build` + `next start`), and the result recorded like Google's (case, result). The automated suites cover the same paths with the providers' endpoints stubbed: `tests/node/social-providers.test.ts` (GitHub and Apple on the real auth routes and Better Auth) and `tests/jest/lib/auth/social-*.test.ts`.

Setup for every plan: a fresh database, `teams.mode: 'multi-tenant'`, the provider listed in `auth.methods`, its variables in `.env`, and two accounts at the provider (A and B). Reset the database between sections when a case needs an empty one.

### Google (reference)

| Case | Expected |
|---|---|
| A. `invitation-only`, empty database, first user with Google | `/dashboard`, user created, owner of their team |
| B. The same user signs in again | `/dashboard`, a second session, no `SIGNUP_RESTRICTED` |
| C. A new address after the bootstrap | `/auth-error?error=SIGNUP_RESTRICTED`, no new user |
| D. An invited address signs in with Google | user created without a team of their own; opening the invitation link makes them a member |

### GitHub

| Case | Steps | Expected |
|---|---|---|
| 1. Button | `GITHUB_*` set, `github` in `methods`; then remove `GITHUB_CLIENT_SECRET` and restart | button "Continue with GitHub" on /login and /signup; without the secret no button, and `GET /api/auth/readiness` does not list `github` |
| 2. Sign-up (`open`) | account A, primary email verified on GitHub | `/dashboard`; user with `firstName`/`lastName` from the GitHub name (or the login), default role and language, `emailVerified` true, an `account` row `github` |
| 3. Sign-in | account A again | `/dashboard`, a second session, no second user |
| 4. Linking | create a user by email code with B's primary address, then sign in with GitHub as B | same user, now with a `github` account row |
| 5. No readable email | `providers: { github: { options: { disableDefaultScope: true, scope: ['read:user'] } } }` (no `user:email`), restart, sign in. Without `user:email` Better Auth cannot read `/user/emails`, so it never learns that GitHub verified the address | account whose email is private on its profile: `/auth-error?error=email_not_found`; account with a public profile email: `/auth-error?error=SOCIAL_EMAIL_UNVERIFIED`. No user either way. (GitHub only lets a verified address be primary, so the unverified-primary case cannot be produced with a real account: it is covered by `tests/node/social-providers.test.ts` only.) |
| 6. basePath callback | `basePath: '/app'`, callback URL `.../app/api/auth/callback/github` in the OAuth App | sign-in completes and returns under `/app` |
| 7. `invitation-only` | empty database: A bootstraps; then B without invitation; then invite B and sign in | A: `/dashboard`; B uninvited: `/auth-error?error=SIGNUP_RESTRICTED`, no user; B invited: user created, invitation accepted from its link |

### Microsoft

| Case | Steps | Expected |
|---|---|---|
| 1. Button | `MICROSOFT_*` set, `microsoft` in `methods`; then remove `MICROSOFT_CLIENT_ID` | button "Continue with Microsoft"; without it no button and `microsoft` not in readiness |
| 2. Sign-up, work account (`open`, tenant `common`, optional claims of step 6 added) | an Entra work account | `/dashboard`; user with `given_name`/`family_name`, verified email |
| 3. Sign-up, personal account | an outlook.com / hotmail.com account | record what happens: `/dashboard` if the ID token carries a verified-email claim; `SOCIAL_EMAIL_UNVERIFIED` if not. Record the claims the token had |
| 4. Sign-in | the account of case 2 again | `/dashboard`, no second user |
| 5. Linking | a user by email code with the work account's address, then Microsoft | linked when the email is verified (case 2); `account_not_linked` otherwise |
| 6. Tenant | `MICROSOFT_TENANT_ID=organizations`, then a personal account | refused by Microsoft or Better Auth before any user |
| 7. basePath callback | `basePath: '/app'`, redirect URI `.../app/api/auth/callback/microsoft` | sign-in completes under `/app` |
| 8. `invitation-only` | as GitHub case 7 | as GitHub case 7 |

### Apple

Run on an HTTPS domain registered in the Services ID (a tunnel works).

| Case | Steps | Expected |
|---|---|---|
| 1. Button | `APPLE_*` set, `apple` in `methods`; then set `APPLE_PRIVATE_KEY` to a placeholder | button "Continue with Apple"; with the placeholder no button and `apple` not in readiness |
| 2. Sign-up, shared email (`open`) | an Apple ID that has never consented to the Services ID; share the email | the callback arrives as a POST and ends on `/dashboard`; user with the name from the consent screen, verified email |
| 3. Sign-in | the same Apple ID again | `/dashboard`, no second user, name unchanged |
| 4. Hidden email | another Apple ID, choose "Hide My Email" | user with a `@privaterelay.appleid.com` address; no link to any existing user |
| 5. Linking | a user by email code with an Apple ID's real address, then Apple sharing that address | linked to the existing user |
| 6. Secret | after a successful sign-in, decode the `client_secret` sent to Apple (server log of a debug run, or `createAppleClientSecret` with the same key) | header `ES256` with the key id, `iss` team id, `sub` Services ID, `aud` `https://appleid.apple.com`, `exp` within six months |
| 7. basePath callback | `basePath: '/app'`, return URL `.../app/api/auth/callback/apple` | sign-in completes under `/app` |
| 8. `invitation-only` | as GitHub case 7, with the invited address shared (not hidden) | as GitHub case 7; with a hidden address the invitation does not match: `SIGNUP_RESTRICTED` |

### Another Provider of the Map (for example Discord)

| Case | Steps | Expected |
|---|---|---|
| 1. Off without credentials | `providers: { discord: {} }`, no variables | a startup warning naming `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET`; `sign-in/social` with `discord` fails in Better Auth |
| 2. API sign-in | variables set; `authClient.signIn.social({ provider: 'discord', callbackURL: '/dashboard' })` | `/dashboard`, user created; no button on /login |
| 3. Unknown id | `providers: { nope: {} }` | startup warning, the app starts, nothing else changes |
| 4. Missing required options | `providers: { cognito: {} }` with `COGNITO_CLIENT_ID`/`COGNITO_CLIENT_SECRET` set | startup warning naming `cognito`; email code and the other providers keep working |

## Next Steps

1. **[API Key Management](./04-api-keys.md)** - Alternative authentication method
2. **[Session Management](./05-session-management.md)** - How sessions work
3. **[Permissions and Roles](./06-permissions-and-roles.md)** - Role assignment after OAuth

---

> 💡 **Tip**: Google, GitHub, Microsoft and Apple are already wired in the core. Set their variables, and list GitHub, Microsoft or Apple in `auth.methods` to show their buttons.
