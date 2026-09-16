# Authentication with Better Auth

This document explains how the mobile app integrates with NextSpark's Better Auth authentication system.

## Overview

NextSpark uses [Better Auth](https://better-auth.com) for authentication. The mobile app uses a hybrid approach:
- **Session cookies** for web compatibility
- **Bearer tokens** for mobile API calls
- **Local storage** for offline session restoration

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                       LOGIN FLOW                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User enters email/password                                   │
│                    │                                             │
│                    ▼                                             │
│  2. POST /api/auth/sign-in/email                                │
│     Body: { email, password }                                    │
│                    │                                             │
│                    ▼                                             │
│  3. Server validates credentials                                 │
│     Returns: { redirect, token, user }                          │
│                    │                                             │
│                    ▼                                             │
│  4. Store token in SecureStore                                  │
│     Store user data for offline access                          │
│                    │                                             │
│                    ▼                                             │
│  5. GET /api/v1/teams                                           │
│     Fetch user's available teams                                │
│                    │                                             │
│                    ▼                                             │
│  6. Select first team, store team ID                            │
│     Navigate to authenticated app                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/email-otp/send-verification-otp` | POST | Passwordless step 1: email a 6-digit sign-in code (`{ email, type: 'sign-in' }`) |
| `/api/auth/sign-in/email-otp` | POST | Passwordless step 2: exchange the code for a session (`{ email, otp }`) |
| `/api/auth/sign-in/social` | POST | Get the Google authorization URL (`{ provider, callbackURL, disableRedirect: true }`) |
| `/api/auth/sign-in/email` | POST | Login with email/password (classic preset) |
| `/api/auth/get-session` | GET | Validate current session |
| `/api/auth/sign-out` | POST | Logout and invalidate session |
| `/api/v1/teams` | GET | Get user's teams |

## Login Methods (passwordless preset by default)

The login screen (`apps/mobile/app/login.tsx`) renders whatever `APP_CONFIG.auth.methods`
lists (`apps/mobile/src/config/app.config.ts`), in priority order. The default is the
portfolio's **passwordless preset** — no password field:

```ts
auth: {
  methods: ['email-otp', 'google'],              // default
  // methods: ['email-password', 'google'],      // classic
  // methods: ['email-otp', 'email-password', 'google'], // both, code first
}
```

The backend always serves every method; this list only shapes the UI. Keep it in
sync with the web app's `auth.methods`.

### One-time code by email

```ts
const { requestOtp, loginWithOtp } = useAuth()

await requestOtp('user@example.com')          // emails a 6-digit code (5-minute expiry)
await loginWithOtp('user@example.com', '123456') // creates the session; first sign-in creates the account
```

`loginWithOtp` stores the user and the Bearer token and loads the teams exactly
like `login()`. The code is delivered through the backend's email provider
(Resend in the default setup — `RESEND_API_KEY` / `RESEND_FROM_EMAIL`).

### Google

`authApi.getSocialSignInUrl('google', callbackURL)` returns the provider URL and
the login screen opens it with `expo-linking`. On **Expo web** the browser shares
cookies with the app, so the session created by the OAuth callback is picked up
on return. On a **native device** the browser session is not handed back to the
app by itself — wire Better Auth's Expo plugin (`@better-auth/expo`, server +
client with SecureStore) for a complete native flow; the button is the
integration point. Requires `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` on the
backend.

## API Client Implementation

The `apiClient` singleton handles all authentication concerns:

```typescript
// packages/mobile/src/api/client.ts (exported as @nextsparkjs/mobile)

class ApiClient {
  private token: string | null = null
  private teamId: string | null = null
  private storedUser: User | null = null

  // Initialize from storage on app start (keys in "Storage Keys" below)
  async init(): Promise<void> {
    this.token = await Storage.getItemAsync(TOKEN_KEY)
    this.teamId = await Storage.getItemAsync(TEAM_ID_KEY)
    const userJson = await Storage.getItemAsync(USER_KEY)
    if (userJson) {
      this.storedUser = JSON.parse(userJson)
    }
  }

  // Make authenticated request with proper headers
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      // JSON only when there is a body: Better Auth rejects an
      // application/json request with an empty body as invalid JSON
      ...(options.body != null ? { 'Content-Type': 'application/json' } : {}),
    }

    // Add Bearer token (Better Auth mobile flow)
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    // Add team context header
    if (this.teamId) {
      headers['x-team-id'] = this.teamId
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include', // Support cookie-based sessions
    })

    if (!response.ok) {
      throw new ApiError(...)
    }

    return response.json()
  }
}
```

Signing in lives in `authApi`, which stores what the response carries through
the client:

```typescript
// packages/mobile/src/api/core/auth.ts

export const authApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/api/auth/sign-in/email', {
      email,
      password,
    })

    // Better Auth returns the session token at the top level of sign-in
    // responses (`token`); older shapes nested it under `session`.
    await apiClient.setUser(response.user)
    const token = response.token ?? response.session?.token
    if (token) {
      await apiClient.setToken(token)
    }

    return response
  },
}
```

## AuthProvider Context

The `AuthProvider` manages authentication state for the entire app. `apps/mobile/app/_layout.tsx`
mounts the one from `@nextsparkjs/mobile`, and screens read it with `useAuth()`:

```typescript
// packages/mobile/src/providers/AuthProvider.tsx (exported as @nextsparkjs/mobile)

interface AuthContextValue {
  user: User | null
  team: Team | null
  teams: Team[]
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  requestOtp: (email: string) => Promise<void>
  loginWithOtp: (email: string, otp: string) => Promise<void>
  logout: () => Promise<void>
  selectTeam: (team: Team) => Promise<void>
  refreshSession: () => Promise<void>
}
```

### Session Restoration

On app launch, the provider attempts to restore the previous session. The
session and the teams come from `authApi` and `teamsApi`; `apiClient` only holds
the stored credentials:

```typescript
const restoreSession = useCallback(async () => {
  try {
    await apiClient.init()

    const hasToken = apiClient.getToken()
    const storedUser = apiClient.getStoredUser()
    if (!hasToken && !storedUser) return

    // Validate the session with the server (null when it answers 401)
    const sessionResponse = await authApi.getSession()

    if (sessionResponse?.user) {
      // Session valid - use fresh data
      setUser(sessionResponse.user)
    } else if (storedUser) {
      setUser(storedUser)
    } else {
      await apiClient.clearAuth()
      return
    }

    // Restore team selection: the stored team if still a member, else the first
    const teamsResponse = await teamsApi.getTeams()
    setTeams(teamsResponse.data)

    if (teamsResponse.data.length > 0) {
      const storedTeamId = apiClient.getTeamId()
      const storedTeam = teamsResponse.data.find(t => t.id === storedTeamId)
      await applyTeam(storedTeam ?? teamsResponse.data[0])
    } else {
      setTeam(null)
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      // Only an authentication failure clears the credentials
      await apiClient.clearAuth()
      setUser(null)
      setTeam(null)
      setTeams([])
    } else {
      // Offline or server error: keep the stored user and team
      const storedUser = apiClient.getStoredUser()
      const storedTeam = apiClient.getStoredTeam()
      if (storedUser) {
        setUser(storedUser)
        if (storedTeam) setTeam(storedTeam)
      }
    }
  }
}, [applyTeam])

useEffect(() => {
  restoreSession().finally(() => setIsLoading(false))
}, [restoreSession])
```

`refreshSession()` runs the same validation later (connectivity back, app in the
foreground) without toggling `isLoading`.

## Route Protection

The app layout guards authenticated routes:

```typescript
// apps/mobile/app/(app)/_layout.tsx

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [isAuthenticated, isLoading])

  if (isLoading || !isAuthenticated) {
    return null
  }

  // Render authenticated UI
  return (...)
}
```

## Storage Keys

Namespaced, because SecureStore only allows alphanumerics, `.`, `-` and `_`
(on web the same keys go to `localStorage`):

| Key | Purpose | Storage |
|-----|---------|---------|
| `nextspark.auth.token` | Bearer token for API calls | SecureStore |
| `nextspark.auth.teamId` | Currently selected team id (sent as `x-team-id`) | SecureStore |
| `nextspark.auth.user` | User info for offline access | SecureStore |
| `nextspark.auth.team` | Full record of the selected team, for an offline start (`@nextsparkjs/mobile`) | SecureStore |

## Request Headers

All authenticated API calls include:

```
Authorization: Bearer {session-token}
x-team-id: {team-uuid}
```

Requests with a body (`post`/`patch` with data) also send
`Content-Type: application/json`. Bodyless requests do not: Better Auth answers
an `application/json` request with an empty body with 400 (invalid JSON), which
is also why sign-out sends `{}`.

## Logout Flow

```typescript
async logout(): Promise<void> {
  try {
    // Server-side session invalidation. Better Auth only accepts this POST
    // with a JSON body, so an empty object is sent.
    await apiClient.post('/api/auth/sign-out', {})
  } catch {
    // Continue even if server call fails
  }

  // Clear local auth state (best effort, never rejects)
  await apiClient.clearAuth()
}
```

`clearAuth()` deletes the stored token, team and user and empties the native
cookie store (`clearNativeCookies()` from `@nextsparkjs/mobile`, which needs a
development build: see "Sign-out and native cookies" in
`packages/mobile/README.md`). Every step runs even if another fails, so a
SecureStore error while offline still clears the session cookie.

## Test Credentials

For development testing:

```
Email: carlos.mendoza@nextspark.dev
Password: Test1234
```

This user belongs to multiple teams, making it useful for testing team switching functionality.
