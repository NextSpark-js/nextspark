# OAuth Providers

This guide covers setting up Google OAuth authentication with Better Auth, including obtaining credentials, configuration, profile mapping, and handling OAuth flows.

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
     http://localhost:5173
     http://localhost:3000
     https://your-production-domain.com
     ```text
   - **Authorized redirect URIs**:
     ```text
     http://localhost:5173/api/auth/callback/google
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

**File**: `core/lib/auth.ts`

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

import { authClient } from '@/core/lib/auth-client'

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

Better Auth automatically handles account linking when a user signs in with Google using an email that already exists in the system:

**Scenario 1: Email/Password Account Exists**

```text
1. User signed up with email/password
2. User tries to sign in with Google using same email
3. Better Auth links Google account to existing user
4. User can now sign in with either method
```

**Scenario 2: Multiple OAuth Providers**

```text
1. User signed in with Google
2. User tries to sign in with another provider (if added) using same email
3. Better Auth links accounts
4. User has multiple sign-in options
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
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean)
```

**Important**: All OAuth callback URLs must be in `trustedOrigins`.

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

Google OAuth users have `emailVerified: true` automatically since Google has already verified the email.

## Handling OAuth Errors

### Common Errors

**Error**: "Redirect URI mismatch"

**Solution**: Ensure callback URL in Google Cloud Console matches exactly:

```text
http://localhost:5173/api/auth/callback/google
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
// app/api/auth/debug/callback/route.ts
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

## Next Steps

1. **[API Key Management](./04-api-keys.md)** - Alternative authentication method
2. **[Session Management](./05-session-management.md)** - How sessions work
3. **[Permissions and Roles](./06-permissions-and-roles.md)** - Role assignment after OAuth

---

> 💡 **Tip**: Google OAuth is already configured in the boilerplate. You only need to obtain your Google Cloud credentials and set the environment variables to enable it.
