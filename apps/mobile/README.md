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
unset: the client auto-detects it from the Expo dev server's own address, as
Metro reports it - a LAN address in Metro's default mode, which is what the
Android emulator gets too. The emulator only gets translated to its
`10.0.2.2` host alias when Metro's own address is loopback instead (Expo
started with `--localhost`), since it is a separate machine from a loopback
address's point of view; every other platform, physical Android devices on
the same Wi-Fi included, always uses the address as reported. Only set it to
override that detection:
```bash
# EXPO_PUBLIC_API_URL=http://192.168.x.x:3000
```
If a physical Android device instead reaches Metro through `adb reverse
tcp:8081 tcp:8081` while Metro is started with `--localhost`, the client
notices the dev server's own address is loopback and uses `localhost`
automatically - the tunnel by itself does not change what Metro reports as
its own address. But if Metro stays in its default LAN mode and only the
backend port is tunneled (`adb reverse tcp:3000 tcp:3000`), nothing tells the
client that tunnel exists — set `EXPO_PUBLIC_API_URL=http://localhost:3000`
explicitly in that case (see "Network request failed" below).

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
- If a physical Android device does not share a network with the development machine, tunnel both ports with `adb reverse tcp:8081 tcp:8081` and `adb reverse tcp:3000 tcp:3000`, and start Expo with `--localhost` so Metro's own address is loopback too - the client detects that and uses `localhost` automatically (see `packages/mobile/README.md`)
- If only the backend port is tunneled (`adb reverse tcp:3000 tcp:3000`) while Metro stays in its default LAN mode, the client cannot tell that tunnel apart from a plain LAN device and still resolves the LAN address: set `EXPO_PUBLIC_API_URL=http://localhost:3000` explicitly

### "Unauthorized" errors
- Token may have expired, try logging out and back in
- Verify the test user exists in the database

### Metro bundler issues
```bash
# Clear cache and restart
npx expo start --clear
```
