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
cd apps/mobile-dev
pnpm install
```

2. Configure the API URL in `.env`:
```bash
# For simulator
EXPO_PUBLIC_API_URL=http://localhost:3000

# For physical device (use your machine's IP)
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000
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
apps/mobile-dev/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Root layout (providers)
│   ├── index.tsx           # Entry redirect
│   ├── login.tsx           # Login screen
│   └── (app)/              # Authenticated routes
│       ├── _layout.tsx     # Auth guard + stack
│       ├── index.tsx       # Tasks list
│       └── task/
│           ├── create.tsx  # Create task
│           └── [id].tsx    # Edit task
├── src/
│   ├── api/client.ts       # API client
│   ├── components/         # Reusable components
│   ├── hooks/              # TanStack Query hooks
│   ├── providers/          # Context providers
│   └── types/              # TypeScript types
└── assets/                 # App icons
```

## Troubleshooting

### "Network request failed"
- Check that the backend is running on port 3000
- For physical devices, use your machine's local IP instead of localhost
- Ensure your device is on the same network

### "Unauthorized" errors
- Token may have expired, try logging out and back in
- Verify the test user exists in the database

### Metro bundler issues
```bash
# Clear cache and restart
npx expo start --clear
```
