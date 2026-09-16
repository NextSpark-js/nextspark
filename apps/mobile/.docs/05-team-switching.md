# Team Switching

This document explains how multi-team support and team switching works in the mobile app.

## Overview

NextSpark supports multi-team organizations where a user can belong to multiple teams. The mobile app provides seamless team switching with automatic data refresh.

## Key Concepts

| Concept | Description |
|---------|-------------|
| **Team** | An organization/workspace that contains entities |
| **Team Context** | The `x-team-id` header sent with every API request |
| **Team Switching** | Changing the active team and refreshing all data |

## Team Data Structure

```typescript
// src/types/index.ts

interface Team {
  id: string           // UUID
  name: string         // Display name (e.g., "Everpoint Labs")
  slug?: string        // URL-friendly identifier
  logo?: string | null // Team logo URL
  role: string         // User's role in this team (owner, admin, member, viewer)
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       TEAM SWITCHING FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User taps team in MoreSheet                                 │
│                    │                                             │
│                    ▼                                             │
│  2. selectTeam(newTeam) called                                  │
│     └── Updates teamId in SecureStore                           │
│     └── Updates team state in AuthProvider                      │
│                    │                                             │
│                    ▼                                             │
│  3. onTeamChange callback triggered                             │
│     └── queryClient.invalidateQueries()                         │
│                    │                                             │
│                    ▼                                             │
│  4. All active queries refetch with new x-team-id               │
│     └── Dashboard stats update                                   │
│     └── Tasks list refreshes                                    │
│     └── Customers list refreshes                                │
│                    │                                             │
│                    ▼                                             │
│  5. Navigate to home to show fresh data                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## AuthProvider Implementation

The `AuthProvider` manages teams state:

```typescript
// packages/mobile/src/providers/AuthProvider.tsx (exported as @nextsparkjs/mobile)

interface AuthContextValue {
  user: User | null
  team: Team | null       // Currently selected team
  teams: Team[]           // All teams user belongs to
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  selectTeam: (team: Team) => Promise<void>  // Team switching function
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [team, setTeam] = useState<Team | null>(null)
  const [teams, setTeams] = useState<Team[]>([])

  // Select/switch team
  const selectTeam = useCallback(async (newTeam: Team) => {
    await apiClient.setTeamId(newTeam.id)  // Persist to storage
    setTeam(newTeam)                        // Update state
  }, [])

  // ... rest of provider
}
```

## API Client Team Header

Every request includes the team context:

```typescript
// packages/mobile/src/api/client.ts (exported as @nextsparkjs/mobile)

private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  if (this.token) {
    headers['Authorization'] = `Bearer ${this.token}`
  }

  // Team context - critical for data scoping
  if (this.teamId) {
    headers['x-team-id'] = this.teamId
  }

  // ...
}
```

## MoreSheet Team UI

The team selector is in the "Más Opciones" bottom sheet:

```typescript
// src/components/navigation/MoreSheet.tsx

export function MoreSheet({
  visible,
  onClose,
  onNavigate,
  onLogout,
  onTeamChange,  // Callback for data refresh
}: MoreSheetProps) {
  const { team, teams, selectTeam } = useAuth()
  const [showTeamList, setShowTeamList] = useState(false)

  const handleTeamSelect = async (selectedTeam: Team) => {
    if (selectedTeam.id !== team?.id) {
      await selectTeam(selectedTeam)     // Update team in context
      setShowTeamList(false)
      onClose()
      onTeamChange?.()                    // Trigger data refresh
    } else {
      setShowTeamList(false)
    }
  }

  // Toggle team list visibility
  const toggleTeamList = () => {
    setShowTeamList(!showTeamList)
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      {/* ... menu items ... */}

      {/* Current Team - Clickable to expand */}
      {team && teams.length > 0 && (
        <>
          <TouchableOpacity onPress={toggleTeamList}>
            <View style={styles.teamAvatar}>
              <Text>{team.name.substring(0, 2).toUpperCase()}</Text>
            </View>
            <View>
              <Text>{team.name}</Text>
              <Text>{teams.length} equipos disponibles</Text>
            </View>
            <Text>{showTeamList ? '⌄' : '⌃'}</Text>
          </TouchableOpacity>

          {/* Expandable Team List */}
          {showTeamList && teams.length > 1 && (
            <View>
              <Text>Cambiar de equipo</Text>
              {teams.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => handleTeamSelect(t)}
                  style={t.id === team.id ? styles.active : null}
                >
                  <Text>{t.name}</Text>
                  <Text>{t.role}</Text>
                  {t.id === team.id && <Text>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}
    </Modal>
  )
}
```

## App Layout Integration

The app layout handles the team change callback:

```typescript
// app/(app)/_layout.tsx

export default function AppLayout() {
  const queryClient = useQueryClient()

  const handleTeamChange = () => {
    // Invalidate ALL queries to force refetch with new team context
    queryClient.invalidateQueries()

    // Navigate to home to show refreshed data
    setActiveTab('home')
    router.replace('/(app)/')
  }

  return (
    <View>
      {/* ... */}
      <MoreSheet
        visible={moreSheetVisible}
        onClose={() => setMoreSheetVisible(false)}
        onNavigate={handleMoreNavigate}
        onLogout={handleLogout}
        onTeamChange={handleTeamChange}  // Pass callback
      />
    </View>
  )
}
```

## Query Invalidation

When team changes, all cached data is invalidated:

```typescript
queryClient.invalidateQueries()
```

This triggers:
- Tasks list to refetch → Shows new team's tasks
- Customers list to refetch → Shows new team's customers
- Dashboard stats to update → Shows correct counts

## Visual UI Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Más Opciones                                         ✕         │
│  Accede a configuraciones y funciones adicionales               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  👤 Perfil                                                       │
│  💳 Facturación                                                  │
│  🔑 Claves API                                                   │
│  ⚙  Ajustes                                                      │
│                                                                  │
│  ─────────────────────────────────────────────────────────      │
│                                                                  │
│  ┌────┐                                                         │
│  │ EV │  Everpoint Labs                                    ⌃    │
│  └────┘  👥 2 equipos disponibles                               │
│                                                                  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │
│                                                                  │
│  CAMBIAR DE EQUIPO                                              │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ ┌────┐                                                 │     │
│  │ │ EV │  Everpoint Labs                            ✓   │     │
│  │ └────┘  owner                                         │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌────┐                                                         │
│  │ CA │  Carlos Mendoza Team                                    │
│  └────┘  owner                                                  │
│                                                                  │
│  ─────────────────────────────────────────────────────────      │
│                                                                  │
│  ↪ Cerrar Sesión                                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Scoping by Team

When team changes, the Dashboard shows different data:

| Team | Tasks | Customers |
|------|-------|-----------|
| Everpoint Labs | 16 | 4 |
| Carlos Mendoza Team | 1 | 1 |

This is because entities are scoped by `teamId` in the database, and the `x-team-id` header filters the API response.

## Persistence

Team selection persists across app restarts:

```typescript
// On team select
await apiClient.setTeamId(newTeam.id)  // Stores in SecureStore

// On app init
const storedTeamId = apiClient.getTeamId()
const storedTeam = teamsResponse.data.find(t => t.id === storedTeamId)
setTeam(storedTeam || teamsResponse.data[0])  // Restore or default to first
```

## Edge Cases

### Single Team User
If user belongs to only one team:
- Team section still shows in MoreSheet
- No "Cambiar de equipo" option appears
- Shows "Equipo" instead of "X equipos disponibles"

### No Teams
If user has no teams (shouldn't happen normally):
- Team section is hidden
- App may redirect to onboarding or error state

### Team Removed While Active
If the active team is removed from user's access:
- Next API call may return 403
- App should handle by refreshing teams and selecting first available
