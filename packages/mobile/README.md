# @nextsparkjs/mobile

Mobile app infrastructure for NextSpark: an API client, authentication and query providers, an entity API factory and a few utilities for Expo apps that connect to a NextSpark backend.

> **Stability: experimental.** Mobile (Expo SDK 58, React Native 0.88) becomes stable only when a real sign-in from the app passes in an iOS or Android simulator; CI today type-checks and tests the mobile app but does not sign in from a simulator. `nextspark add:mobile` is an experimental helper. See [Stability](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/01-stability.md) and the [support matrix](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/02-support-matrix.md#mobile).

## Installation

```bash
# Add a mobile app to your NextSpark project (experimental helper)
pnpm exec nextspark add:mobile

# Or install the package in an Expo app yourself
pnpm add @nextsparkjs/mobile
```

## Requirements

- Node.js 22.x (22.14.0 or later) or 24.x, and a NextSpark web project as the backend.
- Expo SDK 58 with React Native 0.88 is the only pair tested. The peer ranges are wider (`expo >=54.0.0`, `react-native >=0.75.0`) and still accept SDK 54 and later.
- Peer dependencies: `react` ^19.1.0, `@tanstack/react-query` ^5, `expo-constants` >=18, `expo-device` >=8, `expo-secure-store` >=15 and, optional, `@preeternal/react-native-cookie-manager` >=6.3.0 (see [Sign-out and native cookies](#sign-out-and-native-cookies)).

## Quick Start

### 1. Configure the API URL

In `app.config.ts`:

```typescript
export default {
  // ...
  extra: {
    // In development, leave EXPO_PUBLIC_API_URL unset to auto-detect the local
    // backend. Release builds must set it (see "Environment Configuration").
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
  },
}
```

### 2. Set up the providers

In `app/_layout.tsx`. `AuthProvider` reads the query client, so it goes inside `QueryProvider`:

```typescript
import { AuthProvider, QueryProvider } from '@nextsparkjs/mobile'

export default function RootLayout() {
  return (
    <QueryProvider>
      <AuthProvider>
        <Stack />
      </AuthProvider>
    </QueryProvider>
  )
}
```

### 3. Sign in

NextSpark sign-in is passwordless by default: the app asks for a one-time code by email and exchanges it for a session. `login(email, password)` works only when the backend enables email and password in `auth.methods`.

```typescript
import { useAuth } from '@nextsparkjs/mobile'

function LoginScreen() {
  const { requestOtp, loginWithOtp } = useAuth()

  // 1. email the code
  const sendCode = (email: string) => requestOtp(email)
  // 2. sign in with the code (the first sign-in creates the account)
  const verify = (email: string, code: string) => loginWithOtp(email, code)

  // ...
}
```

`validateOtpCode(code)` checks the format (4 to 10 digits, Better Auth's range) before you send it.

### 4. Create entity APIs

```typescript
import { createEntityApi } from '@nextsparkjs/mobile'
import type { Task } from './types'

export const tasksApi = createEntityApi<Task>('tasks')

const { data, info } = await tasksApi.list({ page: 1, limit: 10 })
const task = await tasksApi.get(id)
await tasksApi.create({ title: 'New Task' })
```

## API Reference

### Providers

#### `AuthProvider`
Authentication context provider. Wrap your app with it to enable authentication. Must be rendered inside `QueryProvider`.

**Props:**
- `children: ReactNode` - Your app components

#### `useAuth()`
Returns the authentication context:

- `user: User | null` - Current authenticated user
- `team: Team | null` - Current team
- `teams: Team[]` - The user's teams
- `isAuthenticated: boolean` - Whether the user is logged in
- `isLoading: boolean` - Whether auth is loading
- `requestOtp(email): Promise<void>` - Email a one-time sign-in code
- `loginWithOtp(email, otp): Promise<void>` - Sign in with the emailed code (creates the account on first use)
- `login(email, password): Promise<void>` - Sign in with email and password, when the backend enables it
- `logout(): Promise<void>` - Sign out
- `selectTeam(team: Team): Promise<void>` - Switch to a different team (cancels and resets the query cache, so screens show their loading state until the new team's data arrives)
- `refreshSession(): Promise<void>` - Re-validate the session with the server without toggling `isLoading`: a session restored offline is confirmed or cleared

#### `QueryProvider`
TanStack Query provider for data fetching. Configures default options for queries and mutations.

**Props:**
- `children: ReactNode` - Your app components
- `client?: QueryClient` - Use your own client (for example one with a `MutationCache`, or a fresh client per test) instead of the shared `queryClient`. `defaultOptions` is ignored when a client is passed.
- `defaultOptions?: DefaultOptions` - Merged over the defaults (`staleTime` 5 minutes, `retry: 1` for queries, `retry: 0` for mutations, no refetch on window focus) in a client the provider creates. Without either prop the shared client is used, unchanged. `defaultOptions` is read once at mount; a changed value is ignored while the provider stays mounted.

### API Client

#### `apiClient`
Singleton HTTP client for API requests.

**Methods:**
- `init(): Promise<void>` - Initialize the client (load stored credentials)
- `get<T>(endpoint, params?): Promise<T>` - GET request; `params` become the query string
- `post<T>(endpoint, data?): Promise<T>` - POST request
- `patch<T>(endpoint, data?): Promise<T>` - PATCH request
- `delete<T>(endpoint): Promise<T>` - DELETE request
- `setToken(token): Promise<void>` - Store the session token (a marker that a session exists; requests authenticate with the session cookie and send no `Authorization` header)
- `setTeamId(teamId): Promise<void>` - Set the current team ID
- `clearAuth(): Promise<void>` - Clear all authentication data: the stored token, team and user, and the native cookie store (see [Sign-out and native cookies](#sign-out-and-native-cookies))

`getApiUrl()` returns the resolved API URL and `ApiError` is what failed requests throw.

#### `createEntityApi<T, CreateInput, UpdateInput>(entity: string)`
Factory function to create a CRUD API for an entity. `CreateInput` and `UpdateInput` default to `Partial<T>`.

**Parameters:**
- `entity: string` - Entity path (e.g., 'tasks', 'users'); requests go to `/api/v1/<entity>`

**Returns:** `EntityApi<T, CreateInput, UpdateInput>` with methods:
- `list(params?): Promise<PaginatedResponse<T>>` - List entities: `{ success, data, info }`, the pagination (`page`, `limit`, `total`, `totalPages`, `hasNextPage`, `hasPrevPage`) in `info`. `params` takes `page`, `limit`, `search`, `sort`, `order` and any other filter
- `get(id): Promise<T>` - Get a single entity
- `create(data): Promise<T>` - Create an entity
- `update(id, data): Promise<T>` - Update an entity
- `delete(id): Promise<void>` - Delete an entity

**Example:**
```typescript
import { createEntityApi } from '@nextsparkjs/mobile'

interface Task {
  id: string
  title: string
  status: 'pending' | 'completed'
}

export const tasksApi = createEntityApi<Task>('tasks')

// Usage
const tasks = await tasksApi.list({ page: 1, limit: 10 })
const task = await tasksApi.get('task-id')
await tasksApi.create({ title: 'New Task', status: 'pending' })
```

### Utilities

#### `Storage`
Secure storage wrapper: Expo SecureStore on native, `localStorage` on web (which XSS can read).

**Methods:**
- `Storage.getItemAsync(key): Promise<string | null>` - Get an item
- `Storage.setItemAsync(key, value): Promise<void>` - Set an item
- `Storage.deleteItemAsync(key): Promise<void>` - Remove an item

#### `alert({ title, message?, buttons? })`
Show an alert dialog. On web it uses `window.alert` and `window.confirm`.

```typescript
import { alert } from '@nextsparkjs/mobile'

alert({ title: 'Success', message: 'Task created successfully' })
```

#### `confirm(title, message?)`
Show a confirmation dialog; resolves to `true` when confirmed.

```typescript
import { confirm } from '@nextsparkjs/mobile'

const confirmed = await confirm('Delete Task', 'Are you sure?')
if (confirmed) {
  // Delete task
}
```

#### `confirmDestructive(title, message?, destructiveButtonText?)`
Show a destructive confirmation dialog (red action).

```typescript
import { confirmDestructive } from '@nextsparkjs/mobile'

const confirmed = await confirmDestructive('Delete All', 'This cannot be undone')
```

#### `clearNativeCookies()`
Empties the app's native cookie store, as `apiClient.clearAuth()` does on sign-out. Never rejects. See [Sign-out and native cookies](#sign-out-and-native-cookies).

## Core Services

Pre-built API services for the core endpoints:

### `authApi`
- `login(email, password): Promise<LoginResponse>`
- `sendOtp(email): Promise<void>`
- `loginWithOtp(email, otp): Promise<OtpLoginResponse>`
- `getSocialSignInUrl('google', callbackURL): Promise<string>` - On a native device the browser session is not handed back to the app without Better Auth's Expo plugin on both sides; on Expo web it completes
- `logout(): Promise<void>`
- `getSession(): Promise<SessionResponse | null>`

### `teamsApi`
- `getTeams(): Promise<TeamsResponse>`
- `switchTeam(teamId): Promise<void>`

## TypeScript Support

Type definitions ship with the package.

```typescript
import type {
  User,
  Team,
  AuthSession,
  PaginatedResponse,
  EntityListParams
} from '@nextsparkjs/mobile'
```

## Sign-out and native cookies

React Native's `fetch` keeps the cookies the server sets, Better Auth's session cookie among them, in the platform cookie store (`NSHTTPCookieStorage` on iOS, the `CookieManager` Android shares with WebViews). Clearing the stored token alone leaves that cookie authenticating requests, so `clearAuth()` (which `logout()` calls after the server request) also empties the native cookie store. The app ends up signed out even when the sign-out request fails: no network, server down.

Emptying the store uses [`@preeternal/react-native-cookie-manager`](https://github.com/Preeternal/react-native-cookie-manager), an optional peer dependency. The mobile template already declares it; in an existing app:

```bash
pnpm add @preeternal/react-native-cookie-manager
```

It is a native module: **it needs a [development build](https://docs.expo.dev/develop/development-builds/introduction/) and does not work in Expo Go**, which does not include its native code. Without it (Expo Go, or an app that does not install it), sign-out still clears SecureStore, logs a one-time warning, and leaves the native cookies until they expire. On web the browser owns the cookies and nothing is cleared.

`clearAuth()` removes every cookie in the native store, not only the API's.

### Expo web and the origin check

Requests authenticate with the session cookie and send no `Authorization` header. From Expo web the browser sends an `Origin`, and core checks it on cookie-authenticated writes (`POST`, `PUT`, `PATCH`, `DELETE`): add the Expo web origin (for example `http://localhost:8081`) to `CORS_ADDITIONAL_ORIGINS` (or `api.cors.additionalOrigins`) on the API, or those writes get 403 `ORIGIN_NOT_ALLOWED`. Native iOS and Android requests send `Origin: <the API's own origin>` (the client adds it: Better Auth answers 403 `MISSING_OR_NULL_ORIGIN` to a cookie-authenticated POST without one). That origin is trusted when the API host is the one in `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL`; if the app talks to a different host (for example `api.example.com` while the site is `app.example.com`), add the API's origin to `CORS_ADDITIONAL_ORIGINS` too, or native requests get 403 `INVALID_ORIGIN`.

## Environment Configuration

The API URL is resolved in this order:

1. **app.config.ts** `extra.apiUrl`
2. **Environment variable** `EXPO_PUBLIC_API_URL`
3. **Auto-detect** from Expo dev server: uses the LAN host Expo reports as-is on every platform, including a physical Android device on the same network. The Android emulator is the one exception — a loopback host there (Expo started with `--localhost`, which a physical device reaches through `adb reverse tcp:8081 tcp:8081`; the tunnel alone leaves the host as the LAN address) is translated to its `10.0.2.2` alias for the host machine
4. **Fallback** to `http://localhost:3000` (`http://10.0.2.2:3000` on the Android emulator)

Steps 3 and 4 apply in development only (`__DEV__` true). A release build needs step 1 or 2: with neither, the client throws "API URL is not configured" when it loads, instead of sending every request to a localhost URL. Set the variable at build time (it is read when `app.config.ts` is evaluated, so EAS needs it in the profile's `env` (below) or as an EAS environment variable).

**Development:**
```bash
# Optional: only set this to force a URL other than the auto-detected local backend
# EXPO_PUBLIC_API_URL=http://192.168.x.x:3000
```

**Production (EAS Build):**
```json
// eas.json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.yourapp.com"
      }
    }
  }
}
```

Both the `preview` and `production` profiles produce release builds, so each needs `EXPO_PUBLIC_API_URL`, in the profile's `env` or as an EAS environment variable.

## Android permissions

Native libraries add Android permissions through their own manifests (camera, audio recording, external storage), and they end up in the release build whether or not your app uses them. The `android` block of the template `app.config.ts` has a `blockedPermissions` list, empty by default, with the usual candidates commented out.

To review it, run a prebuild (`pnpm exec expo prebuild --platform android`) and read the merged manifest under `android/app/build/intermediates/merged_manifests/` after a release build, or `android/app/src/main/AndroidManifest.xml` for what Expo itself wrote. Every `uses-permission` entry your app has no feature for (for example `RECORD_AUDIO` when nothing records audio) goes in `blockedPermissions`:

```typescript
android: {
  blockedPermissions: ['android.permission.RECORD_AUDIO'],
}
```

Block only what the app does not use: a blocked permission that a feature needs makes that feature fail on Android.

## Examples

### Complete Sign-In Flow

```typescript
import { alert, useAuth } from '@nextsparkjs/mobile'
import { useState } from 'react'

export default function LoginScreen() {
  const { requestOtp, loginWithOtp } = useAuth()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)

  const handleSend = async () => {
    await requestOtp(email)
    setCodeSent(true)
  }

  const handleVerify = async () => {
    try {
      await loginWithOtp(email, code)
      // Navigation handled by AuthProvider
    } catch (error) {
      alert({ title: 'Sign-in failed', message: (error as Error).message })
    }
  }

  return (
    // Your UI
  )
}
```

### Using Entity API with React Query

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksApi } from './entities/tasks/api'

export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.list(),
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
```

## Running on a simulator or emulator

Sign-out clears the native cookie store with a native module, so the app needs a [development build](https://docs.expo.dev/develop/development-builds/introduction/), not Expo Go. The template ships `expo-dev-client` for it:

```bash
cd mobile
pnpm ios       # expo run:ios, needs Xcode and CocoaPods
pnpm android   # expo run:android, needs Android Studio and an emulator
```

**The first run is slow, and nothing prints for a while.** Measured on an Apple Silicon Mac with Xcode 26.3 and a cold CocoaPods cache: `pod install` took about 14 minutes (it downloads about 800 MB of React Native and Hermes binaries from Maven), and the native Xcode build another 15 minutes or so. Later runs reuse the pods and the build products. After the first `expo run:ios`, `pnpm start` is enough to serve Metro to the installed build; to use Expo Go instead, run `expo start --go` (the native cookie module will not work there).

**Xcode 26.3 does not build a freshly generated project (support note).** A project generated today resolves `expo-modules-jsi` 58.0.22, whose Swift sources fail to compile with Xcode 26.3: `JavaScriptObject.swift:946:36: error: sending 'slot' risks causing data races`, in the `Build ExpoModulesJSI xcframework` build step of `xcodebuild` (and so of `expo run:ios`); `pod install` finishes without error. The error is in Expo's package, and NextSpark has no simple way around it: switching the package to Swift 5 language mode only trades it for another compile error. It needs a patch release of Expo's package or a newer Xcode. A project whose lockfile keeps an older `expo-modules-jsi` (the development app pins 58.0.15) builds with Xcode 26.3.

**The bundler port.** `expo run:ios` starts Metro on 8081. `--port <n>` moves it, and the app has to be told where to find it. The `expo-dev-client` launcher takes that from the link the CLI opens. A debug build without `expo-dev-client` (a project created before the template added it) ignores that link and shows "No script URL provided": add the dependency (`pnpm add expo-dev-client`) and rebuild, or point the app at Metro for the simulator:

```bash
xcrun simctl spawn <udid> defaults write <bundle id> RCT_jsLocation localhost:<port>
# back to the default (8081):
xcrun simctl spawn <udid> defaults delete <bundle id> RCT_jsLocation
```

The value is stored in the simulator and survives restarts. Get `<udid>` from `xcrun simctl list devices booted`; `booted` can stand in for it only when exactly one simulator is running.

**Against a production build of the web app, use HTTPS.** In production core marks the session cookie `Secure` (`secure` is on when `NODE_ENV=production`), and iOS does not send a `Secure` cookie over `http://localhost`: the code is accepted, then the first request after it (`GET /api/v1/teams`) fails with 401 and the app shows "Request failed with status 401". Measured on the iOS simulator with `next start` on `http://localhost`; the same build behind a local TLS proxy signed in. By that code `next dev` is not affected (not measured). For a local production check, put a TLS proxy in front, set `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to its `https://` origin (the second is read at build time), and trust its CA in the simulator with `xcrun simctl keychain <udid> add-root-cert ca.pem`. The sign-in endpoints are rate limited, so repeated attempts in a row end in 429.

On the Android emulator the API is at `http://10.0.2.2:3000` (see [Environment Configuration](#environment-configuration)).

## Troubleshooting

### Cannot connect to API

1. Check API URL configuration in `app.config.ts`
2. Verify backend is running
3. Check network connectivity
4. On iOS simulator, use `http://localhost:3000`
5. On Android emulator, use `http://10.0.2.2:3000`

### Authentication not persisting

The package uses Expo SecureStore which requires:
- `expo-secure-store` installed
- Plugin configured in `app.config.ts`

```typescript
export default {
  plugins: ['expo-secure-store'],
}
```

## Documentation

- This README is the package reference.
- [Stability](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/01-stability.md) and the [support matrix](https://github.com/NextSpark-js/nextspark/blob/main/packages/core/docs/22-stability-and-support/02-support-matrix.md#mobile)
- [`apps/mobile`](https://github.com/NextSpark-js/nextspark/tree/main/apps/mobile), the repository's development app, with its own README
- [NextSpark documentation](https://www.nextspark.dev/docs)

## Contributing

### Repository structure

When developing the package, it's important to understand the different directories:

```
packages/mobile/
├── src/                    # Package source code (published to npm)
│   ├── api/                # API client and entity factory
│   ├── providers/          # AuthProvider, QueryProvider
│   ├── hooks/              # useAuth hook
│   └── lib/                # Storage, Alert utilities
├── templates/              # Scaffolding templates for `nextspark add:mobile`
│   ├── app/                # Expo Router pages, gitignored: `pnpm sync:mobile-templates --sync` copies it from apps/mobile/app
│   └── src/                # Example entities and components
└── dist/                   # Compiled output, gitignored: created by `pnpm build`

apps/mobile/                # Monorepo development app (NOT distributed)
├── app/                    # Uses local source for development
└── src/                    # Local copies for hot reload & debugging
```

**Key distinction:**
- **`packages/mobile/src/`** → Published to npm as `@nextsparkjs/mobile`
- **`packages/mobile/templates/`** → Copied to user projects via `nextspark add:mobile`
- **`apps/mobile/`** → Internal dev app with local source (for package development)

The templates correctly use `@nextsparkjs/mobile` imports, while `apps/mobile` uses local paths for development convenience.

## License

MIT
