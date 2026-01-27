# @nextsparkjs/mobile

Mobile app infrastructure for NextSpark. Provides API client, authentication providers, and utilities for building Expo apps that connect to your NextSpark backend.

## Installation

```bash
# Add mobile app to your NextSpark project
npx nextspark add:mobile

# Or install manually
npm install @nextsparkjs/mobile
```

## Quick Start

### 1. Configure API URL

In `app.config.ts`:

```typescript
export default {
  // ...
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5173',
  },
}
```

### 2. Setup Providers

In `app/_layout.tsx`:

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

### 3. Use Authentication

```typescript
import { useAuth } from '@nextsparkjs/mobile'

function LoginScreen() {
  const { login, isLoading } = useAuth()

  const handleLogin = async () => {
    await login('user@example.com', 'password')
  }

  // ...
}
```

### 4. Create Entity APIs

```typescript
import { createEntityApi } from '@nextsparkjs/mobile'
import type { Task } from './types'

export const tasksApi = createEntityApi<Task>('tasks')

// Use in queries
const { data } = await tasksApi.list()
const task = await tasksApi.get(id)
await tasksApi.create({ title: 'New Task' })
```

## API Reference

### Providers

#### `AuthProvider`
Authentication context provider. Wrap your app with this provider to enable authentication.

**Props:**
- `children: ReactNode` - Your app components

**Context Value:**
- `user: User | null` - Current authenticated user
- `team: Team | null` - Current team
- `isAuthenticated: boolean` - Whether user is logged in
- `isLoading: boolean` - Whether auth is loading
- `login(email, password): Promise<void>` - Login user
- `logout(): Promise<void>` - Logout user
- `selectTeam(teamId): Promise<void>` - Switch to different team

#### `QueryProvider`
TanStack Query provider for data fetching. Configures default options for queries and mutations.

**Props:**
- `children: ReactNode` - Your app components

### Hooks

#### `useAuth()`
Hook to access authentication context.

```typescript
const { user, team, isAuthenticated, login, logout, selectTeam } = useAuth()
```

### API Client

#### `apiClient`
Singleton HTTP client for API requests.

**Methods:**
- `init(): Promise<void>` - Initialize client (load stored credentials)
- `get<T>(endpoint, config?): Promise<T>` - GET request
- `post<T>(endpoint, data, config?): Promise<T>` - POST request
- `patch<T>(endpoint, data, config?): Promise<T>` - PATCH request
- `delete<T>(endpoint, config?): Promise<T>` - DELETE request
- `setToken(token): Promise<void>` - Set authentication token
- `setTeamId(teamId): Promise<void>` - Set current team ID
- `clearAuth(): Promise<void>` - Clear all authentication data

#### `createEntityApi<T>(entity: string)`
Factory function to create CRUD API for an entity.

**Parameters:**
- `entity: string` - Entity name (e.g., 'tasks', 'users')

**Returns:** `EntityApi<T>` with methods:
- `list(params?): Promise<PaginatedResponse<T>>` - List entities
- `get(id): Promise<T>` - Get single entity
- `create(data): Promise<T>` - Create entity
- `update(id, data): Promise<T>` - Update entity
- `delete(id): Promise<void>` - Delete entity

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
Secure storage wrapper using Expo SecureStore.

**Methods:**
- `Storage.getItem(key): Promise<string | null>` - Get item
- `Storage.setItem(key, value): Promise<void>` - Set item
- `Storage.removeItem(key): Promise<void>` - Remove item

#### `alert(title, message?)`
Show alert dialog.

```typescript
import { alert } from '@nextsparkjs/mobile'

alert('Success', 'Task created successfully')
```

#### `confirm(title, message?)`
Show confirmation dialog.

```typescript
import { confirm } from '@nextsparkjs/mobile'

const confirmed = await confirm('Delete Task', 'Are you sure?')
if (confirmed) {
  // Delete task
}
```

#### `confirmDestructive(title, message?)`
Show destructive confirmation dialog (red action).

```typescript
import { confirmDestructive } from '@nextsparkjs/mobile'

const confirmed = await confirmDestructive('Delete All', 'This cannot be undone')
```

## Core Services

Pre-built API services for common entities:

### `authApi`
- `login(email, password): Promise<LoginResponse>`
- `logout(): Promise<void>`
- `getSession(): Promise<SessionResponse>`

### `teamsApi`
- `getTeams(): Promise<PaginatedResponse<Team>>`
- `switchTeam(teamId): Promise<void>`

### `usersApi`
- `getCurrentUser(): Promise<User>`
- `updateProfile(data): Promise<User>`

## TypeScript Support

Full TypeScript support with generated type definitions.

```typescript
import type {
  User,
  Team,
  Session,
  PaginatedResponse,
  EntityQueryParams
} from '@nextsparkjs/mobile'
```

## Environment Configuration

The API URL is resolved in this order:

1. **app.config.ts** `extra.apiUrl`
2. **Environment variable** `EXPO_PUBLIC_API_URL`
3. **Auto-detect** from Expo dev server
4. **Fallback** to `http://localhost:5173`

**Development:**
```bash
# .env
EXPO_PUBLIC_API_URL=http://localhost:5173
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

## Examples

### Complete Login Flow

```typescript
import { useAuth } from '@nextsparkjs/mobile'
import { useState } from 'react'

export default function LoginScreen() {
  const { login, isLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = async () => {
    try {
      await login(email, password)
      // Navigation handled by AuthProvider
    } catch (error) {
      alert('Login Failed', error.message)
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

## Troubleshooting

### Cannot connect to API

1. Check API URL configuration in `app.config.ts`
2. Verify backend is running
3. Check network connectivity
4. On iOS simulator, use `http://localhost:5173`
5. On Android emulator, use `http://10.0.2.2:5173`

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

Full documentation: https://nextspark.dev/docs/mobile

## License

MIT
