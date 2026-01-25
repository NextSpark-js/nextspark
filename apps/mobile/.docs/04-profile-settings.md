# Profile and Settings

This document explains how user profile and application settings are integrated in the mobile app.

## Overview

The app provides two distinct screens for user configuration:

| Screen | Purpose | Access |
|--------|---------|--------|
| **Profile** | Personal user information | MoreSheet → Perfil |
| **Settings** | App preferences and account settings | MoreSheet → Ajustes |

## Profile Screen

**Location:** `app/(app)/profile.tsx`

### Features

The profile screen displays and manages user personal data:

- **Name** (first and last name)
- **Email** (read-only, from Better Auth)
- **Authentication Method** (email, OAuth provider)
- **Verification Status**
- **Language Preference**

### Data Source

User data comes from the `AuthProvider` context:

```typescript
export default function ProfileScreen() {
  const { user } = useAuth()

  // Parse name into components
  const nameParts = user?.name?.split(' ') || ['', '']
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''

  return (
    <ScrollView>
      {/* Display user info */}
      <TextInput value={firstName} editable={false} />
      <TextInput value={user?.email || ''} editable={false} />
      {/* ... */}
    </ScrollView>
  )
}
```

### UI Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  Información Personal                                            │
│  Gestiona tu información personal y preferencias...             │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 👤 Datos Personales                                       │   │
│  │    Actualiza tu nombre, país, zona horaria e idioma...   │   │
│  │                                                           │   │
│  │  Nombre                                                   │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │ Carlos                                            │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  │                                                           │   │
│  │  Apellido                                                 │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │ Mendoza                                           │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  │                                                           │   │
│  │  Email                                                    │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │ ✉ carlos.mendoza@nextspark.dev                   │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  │  No se puede cambiar                                      │   │
│  │                                                           │   │
│  │  Método de Autenticación                                  │   │
│  │  ✉ Email                                                  │   │
│  │                                                           │   │
│  │  Estado de Verificación                                   │   │
│  │  ✓ Verificado                                             │   │
│  │                                                           │   │
│  │  Idioma                                                   │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │ 文 Español                                    ⌄  │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Current Limitations

The mobile profile screen is currently **read-only**. Profile updates would require:

1. API endpoints for profile update (`PATCH /api/v1/users/me`)
2. Form state management
3. Mutation hooks similar to entity CRUD

## Settings Screen

**Location:** `app/(app)/settings.tsx`

### Features

The settings screen provides access to:

| Section | Items |
|---------|-------|
| **Cuenta** | Información Personal, Seguridad |
| **Preferencias** | Notificaciones (toggle), Modo Oscuro (toggle) |
| **Soporte** | Centro de Ayuda, Enviar Comentarios |

### Implementation

```typescript
const SETTINGS_SECTIONS = [
  {
    title: 'Cuenta',
    items: [
      {
        key: 'profile',
        label: 'Información Personal',
        description: 'Nombre, email, idioma',
        icon: '👤',
        type: 'navigation',
        screen: 'profile',
      },
      {
        key: 'security',
        label: 'Seguridad',
        description: 'Contraseña, autenticación',
        icon: '🔒',
        type: 'navigation',
      },
    ],
  },
  {
    title: 'Preferencias',
    items: [
      {
        key: 'notifications',
        label: 'Notificaciones',
        icon: '🔔',
        type: 'toggle',
      },
      {
        key: 'darkMode',
        label: 'Modo Oscuro',
        icon: '🌙',
        type: 'toggle',
      },
    ],
  },
  // ...
]
```

### Toggle State Management

Toggle preferences use local state (not persisted yet):

```typescript
const [toggleStates, setToggleStates] = useState<Record<string, boolean>>({
  notifications: true,
  darkMode: false,
})

const handleToggle = (key: string) => {
  setToggleStates((prev) => ({ ...prev, [key]: !prev[key] }))
}
```

### Navigation Handler

Navigation items route to their respective screens:

```typescript
const handleNavigation = (item: SettingItem) => {
  if (item.screen) {
    router.push(`/(app)/${item.screen}`)
  }
}
```

### UI Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  Ajustes                                                         │
│  Configura tu cuenta y preferencias                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CUENTA                                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 👤 Información Personal                              ›    │   │
│  │    Nombre, email, idioma                                  │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ 🔒 Seguridad                                         ›    │   │
│  │    Contraseña, autenticación                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  PREFERENCIAS                                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 🔔 Notificaciones                               [====]    │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ 🌙 Modo Oscuro                                  [    ]    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  SOPORTE                                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ❓ Centro de Ayuda                                   ›    │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ 💬 Enviar Comentarios                                ›    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│              NextSpark Mobile v1.0.0                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Access from MoreSheet

Both screens are accessible via the "Más" menu in the bottom navigation:

```typescript
// src/components/MoreSheet.tsx

const MENU_ITEMS: MenuItem[] = [
  { key: 'profile', label: 'Perfil', icon: '👤', screen: 'profile' },
  { key: 'billing', label: 'Facturación', icon: '💳', screen: 'billing' },
  { key: 'api-keys', label: 'Claves API', icon: '🔑', screen: 'api-keys' },
  { key: 'settings', label: 'Ajustes', icon: '⚙', screen: 'settings' },
]

const handleMenuItem = (item: MenuItem) => {
  if (item.screen) {
    onNavigate(item.screen)
    onClose()
  }
}
```

The navigation is handled in the app layout:

```typescript
// app/(app)/_layout.tsx

const handleMoreNavigate = (screen: string) => {
  switch (screen) {
    case 'profile':
      router.push('/(app)/profile')
      break
    case 'settings':
      router.push('/(app)/settings')
      break
    // ...
  }
}
```

## Future Enhancements

### Profile Updates

To enable profile editing:

1. Make fields editable
2. Add form validation
3. Create `useUpdateProfile` mutation hook
4. Call `PATCH /api/v1/users/me` endpoint

### Settings Persistence

To persist settings:

1. Store preferences in AsyncStorage
2. Create `useSettings` hook
3. Load settings on app start
4. Sync with server if needed

### Dark Mode Integration

Full dark mode would require:

1. Theme context provider
2. Dynamic color palette
3. System preference detection
4. Persistent theme preference
