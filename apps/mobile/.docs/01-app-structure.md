# App Structure

This document describes the overall architecture and file structure of the NextSpark Mobile app.

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Expo SDK | 52+ | React Native framework |
| Expo Router | 4.x | File-based routing |
| TypeScript | 5.x | Type safety |
| TanStack Query | 5.x | Server state management |
| expo-secure-store | - | Secure token storage |
| NativeWind | 4.x | Tailwind CSS for React Native |
| CVA | 0.7.x | Class variance authority (same as web) |
| Lucide React Native | - | Icon library (same as web) |

> **See also:** [06-ui-system.md](./06-ui-system.md) for detailed UI architecture.

## Directory Structure

```
apps/mobile-dev/
├── app/                          # Expo Router pages
│   ├── _layout.tsx               # Root layout (providers)
│   ├── index.tsx                 # Entry redirect
│   ├── login.tsx                 # Login screen
│   └── (app)/                    # Authenticated routes group
│       ├── _layout.tsx           # App layout (TopBar, BottomTabBar, sheets)
│       ├── index.tsx             # Dashboard/Home
│       ├── tasks.tsx             # Tasks list
│       ├── customers.tsx         # Customers list
│       ├── profile.tsx           # User profile
│       ├── settings.tsx          # Settings screen
│       ├── notifications.tsx     # Notifications screen
│       ├── task/
│       │   ├── create.tsx        # Create task (modal)
│       │   └── [id].tsx          # Edit task
│       └── customer/
│           ├── create.tsx        # Create customer (modal)
│           └── [id].tsx          # Edit customer
├── src/
│   ├── api/
│   │   └── client.ts             # API client singleton
│   ├── components/
│   │   ├── ui/                   # shadcn-style UI primitives
│   │   │   ├── index.ts          # Barrel exports
│   │   │   ├── text.tsx          # Text with variants
│   │   │   ├── button.tsx        # Button with CVA variants
│   │   │   ├── input.tsx         # TextInput styled
│   │   │   ├── textarea.tsx      # Multiline TextInput
│   │   │   ├── card.tsx          # Card compound component
│   │   │   ├── badge.tsx         # Badge with status variants
│   │   │   ├── avatar.tsx        # Avatar with fallback
│   │   │   ├── separator.tsx     # Horizontal/vertical line
│   │   │   ├── switch.tsx        # Toggle switch
│   │   │   ├── checkbox.tsx      # Checkbox
│   │   │   ├── select.tsx        # Select with modal
│   │   │   ├── dialog.tsx        # Modal dialog
│   │   │   └── skeleton.tsx      # Loading skeleton
│   │   ├── TopBar.tsx            # Top navigation bar
│   │   ├── BottomTabBar.tsx      # Bottom tab navigation
│   │   ├── MoreSheet.tsx         # "More options" bottom sheet
│   │   ├── CreateSheet.tsx       # "Create entity" bottom sheet
│   │   ├── TaskCard.tsx          # Task list item
│   │   ├── TaskForm.tsx          # Task create/edit form
│   │   ├── CustomerCard.tsx      # Customer list item
│   │   └── CustomerForm.tsx      # Customer create/edit form
│   ├── constants/
│   │   └── colors.ts             # Color theme constants (legacy)
│   ├── data/
│   │   └── notifications.mock.json # Mock notifications data
│   ├── hooks/
│   │   ├── useTasks.ts           # Tasks CRUD hooks
│   │   └── useCustomers.ts       # Customers CRUD hooks
│   ├── lib/
│   │   ├── utils.ts              # cn() utility (clsx + tailwind-merge)
│   │   ├── storage.ts            # Cross-platform storage abstraction
│   │   └── alert.ts              # Cross-platform Alert polyfill
│   ├── providers/
│   │   ├── AuthProvider.tsx      # Authentication context
│   │   └── QueryProvider.tsx     # TanStack Query provider
│   ├── styles/
│   │   └── globals.css           # CSS variables + Tailwind
│   └── types/
│       └── index.ts              # TypeScript type definitions
├── .env                          # Environment variables
├── app.json                      # Expo configuration
├── babel.config.js               # Babel + NativeWind preset
├── metro.config.js               # Metro + NativeWind wrapper
├── tailwind.config.js            # Tailwind + NativeWind config
├── nativewind-env.d.ts           # NativeWind TypeScript declarations
├── package.json                  # Dependencies
└── tsconfig.json                 # TypeScript config
```

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                         SCREENS (app/)                          │
│  Login, Dashboard, Tasks, Customers, Profile, Settings          │
├─────────────────────────────────────────────────────────────────┤
│                      COMPONENTS (src/components/)               │
│  TopBar, BottomTabBar, Cards, Forms, Sheets                     │
├─────────────────────────────────────────────────────────────────┤
│                        HOOKS (src/hooks/)                       │
│  useTasks, useCustomers (TanStack Query)                        │
├─────────────────────────────────────────────────────────────────┤
│                     PROVIDERS (src/providers/)                  │
│  AuthProvider, QueryProvider                                    │
├─────────────────────────────────────────────────────────────────┤
│                      API CLIENT (src/api/)                      │
│  apiClient singleton with auth headers                          │
├─────────────────────────────────────────────────────────────────┤
│                    NEXTSPARK BACKEND                            │
│  http://localhost:5173/api/v1/*                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Routing Structure

The app uses Expo Router's file-based routing with route groups:

```
/                       → Redirects to /(app) or /login
/login                  → Login screen (unauthenticated)
/(app)/                 → Dashboard (authenticated)
/(app)/tasks            → Tasks list
/(app)/customers        → Customers list
/(app)/profile          → User profile
/(app)/settings         → Settings
/(app)/notifications    → Notifications list (modal)
/(app)/task/create      → Create task (modal)
/(app)/task/[id]        → Edit task
/(app)/customer/create  → Create customer (modal)
/(app)/customer/[id]    → Edit customer
```

## Navigation Components

### TopBar
- User avatar with initials
- Greeting message with first name
- Notification bell with unread badge (navigates to `/notifications`)
- Theme toggle (dark/light, placeholder)

### BottomTabBar
- 5 tabs: Inicio, Tareas, Crear, Clientes, Más
- Floating "Crear" button in center
- Active tab highlighting

### Bottom Sheets
- **MoreSheet**: Profile, Billing, API Keys, Settings, Team Switching, Logout
- **CreateSheet**: Quick create for Task or Customer

## State Management

| State Type | Solution | Location |
|------------|----------|----------|
| Auth State | React Context | `AuthProvider` |
| Server State | TanStack Query | `useTasks`, `useCustomers` |
| UI State | React useState | Local components |
| Persistent | expo-secure-store | Tokens, team ID |

## Environment Variables

```bash
# .env
EXPO_PUBLIC_API_URL=http://localhost:5173
```

For physical device testing, use your machine's IP:
```bash
EXPO_PUBLIC_API_URL=http://192.168.x.x:5173
```

## Color Scheme

The app uses a black/white monochrome theme via CSS variables in `src/styles/globals.css`:

```css
:root {
  --background: #FFFFFF;
  --foreground: #1a1a1a;
  --primary: #171717;
  --primary-foreground: #fafafa;
  /* ... see globals.css for full palette */
}
```

These are mapped to Tailwind classes via `tailwind.config.js`:

```tsx
// Usage in components
<View className="bg-background border-border">
  <Text className="text-foreground">Hello</Text>
  <Button className="bg-primary">Submit</Button>
</View>
```

> **See also:** [06-ui-system.md](./06-ui-system.md) for theming architecture.
