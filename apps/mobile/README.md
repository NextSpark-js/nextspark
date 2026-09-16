# NextSpark Mobile Dev

A React Native (Expo) app for testing the NextSpark API with full CRUD operations on the Tasks entity.

## Prerequisites

- Node.js 18+
- pnpm
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (macOS) or Android Emulator

## Setup

1. Install dependencies:
```bash
cd apps/mobile
pnpm install
```

2. No API URL configuration is needed by default. Leave `EXPO_PUBLIC_API_URL`
unset: the client auto-detects it from the Expo dev server (and picks
`10.0.2.2` on the Android emulator, `localhost` everywhere else, including a
physical Android device reached through `adb reverse`). Only set it to override
that detection, e.g. a backend that isn't the local dev server:
```bash
# EXPO_PUBLIC_API_URL=http://192.168.x.x:3000
```

3. Make sure the NextSpark backend is running:
```bash
# From project root
pnpm dev
```

## Running the App

```bash
# Start Expo
pnpm start

# Or for specific platforms
pnpm ios      # iOS Simulator
pnpm android  # Android Emulator
pnpm web      # Web browser
```

## Test Credentials

From the devKeyring:
- **Email:** carlos.mendoza@example.com (or similar from your devKeyring)
- **Password:** Test1234

## Features

- Login with session authentication
- Team context loading
- Tasks CRUD:
  - List tasks with pull-to-refresh
  - Create new tasks
  - Edit existing tasks
  - Delete tasks
- Status and priority management

## Tech Stack

- **Framework:** Expo SDK 52 with Expo Router
- **Language:** TypeScript
- **State:** TanStack Query v5
- **Storage:** expo-secure-store (auth token)
- **UI:** React Native core components

## File Structure

```
apps/mobile/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Root layout (providers)
│   ├── index.tsx           # Entry redirect
│   ├── login.tsx           # Login screen
│   └── (app)/              # Authenticated routes
│       ├── _layout.tsx     # Auth guard + stack
│       ├── tasks.tsx       # Tasks list
│       └── task/
│           ├── create.tsx  # Create task
│           └── [id].tsx    # Edit task
├── src/
│   ├── components/         # Reusable components
│   ├── hooks/              # TanStack Query hooks
│   └── types/              # TypeScript types
└── assets/                 # App icons

# API client and context providers come from @nextsparkjs/mobile
```

## Troubleshooting

### "Network request failed"
- Check that the backend is running on port 3000
- No manual API URL configuration is needed in most cases; the client auto-detects it from the Expo dev server
- If a physical Android device does not share a network with the development machine, use `adb reverse`; the client automatically uses `localhost` for that tunnel (see `packages/mobile/README.md`)

### "Unauthorized" errors
- Token may have expired, try logging out and back in
- Verify the test user exists in the database

### Metro bundler issues
```bash
# Clear cache and restart
npx expo start --clear
```
