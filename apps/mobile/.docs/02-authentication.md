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
│     Returns: { user, session: { token } }                       │
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

The login screen (`app/login.tsx`) renders whatever `APP_CONFIG.auth.methods`
lists (`src/config/app.config.ts`), in priority order. The default is the
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
// src/api/client.ts

class ApiClient {
  private token: string | null = null
  private teamId: string | null = null
  private storedUser: User | null = null

  // Initialize from storage on app start
  async init(): Promise<void> {
    this.token = await Storage.getItemAsync('auth_token')
    this.teamId = await Storage.getItemAsync('team_id')
    const userJson = await Storage.getItemAsync('user_data')
    if (userJson) {
      this.storedUser = JSON.parse(userJson)
    }
  }

  // Make authenticated request with proper headers
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
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

  // Login implementation
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/api/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    // Store credentials
    await this.setUser(response.user)
    if (response.session?.token) {
      await this.setToken(response.session.token)
    }

    return response
  }
}
```

## AuthProvider Context

The `AuthProvider` manages authentication state for the entire app:

```typescript
// src/providers/AuthProvider.tsx

interface AuthContextValue {
  user: User | null
  team: Team | null
  teams: Team[]
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  selectTeam: (team: Team) => Promise<void>
}
```

### Session Restoration

On app launch, the provider attempts to restore the previous session:

```typescript
useEffect(() => {
  const initAuth = async () => {
    try {
      await apiClient.init()

      const hasToken = apiClient.getToken()
      const storedUser = apiClient.getStoredUser()

      if (hasToken || storedUser) {
        // Validate session with server
        const sessionResponse = await apiClient.getSession()

        if (sessionResponse?.user) {
          // Session valid - use fresh data
          setUser(sessionResponse.user)
        } else if (storedUser) {
          // Session invalid but have stored user (offline mode)
          setUser(storedUser)
        } else {
          // No valid session
          await apiClient.clearAuth()
          return
        }

        // Restore team selection
        const teamsResponse = await apiClient.getTeams()
        setTeams(teamsResponse.data)

        const storedTeamId = apiClient.getTeamId()
        const storedTeam = teamsResponse.data.find(t => t.id === storedTeamId)
        setTeam(storedTeam || teamsResponse.data[0])
      }
    } catch (error) {
      await apiClient.clearAuth()
    } finally {
      setIsLoading(false)
    }
  }

  initAuth()
}, [])
```

## Route Protection

The app layout guards authenticated routes:

```typescript
// app/(app)/_layout.tsx

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

| Key | Purpose | Storage |
|-----|---------|---------|
| `auth_token` | Bearer token for API calls | SecureStore |
| `team_id` | Currently selected team | SecureStore |
| `user_data` | User info for offline access | SecureStore |

## Request Headers

All authenticated API calls include:

```
Authorization: Bearer {session-token}
x-team-id: {team-uuid}
Content-Type: application/json
```

## Logout Flow

```typescript
async logout(): Promise<void> {
  try {
    // Server-side session invalidation
    await this.request('/api/auth/sign-out', { method: 'POST' })
  } catch {
    // Continue even if server call fails
  }

  // Clear local auth state
  await this.clearAuth()
}
```

## Test Credentials

For development testing:

```
Email: carlos.mendoza@nextspark.dev
Password: Test1234
```

This user belongs to multiple teams, making it useful for testing team switching functionality.
