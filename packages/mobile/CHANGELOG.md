# Changelog

All notable changes to `@nextsparkjs/mobile` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0-beta.198] - 2026-10-09

### Upgrading from 0.1.0-beta.197

- **A native build needs `expo-dev-client`.** `expo run:ios` and `expo run:android` build a debug app that opens the bundler through the `expo-dev-client` launcher; without it the app ignores the link the CLI opens and shows "No script URL provided". New projects have it. An existing project adds it with `pnpm add expo-dev-client@~6.0.21` (Expo SDK 54) in `mobile/` and rebuilds.

### Added

- The template ships `expo-dev-client` (`~6.0.21`, Expo SDK 54), and the generated monorepo lists it in `mobile/package.json`. The `ios` and `android` scripts run `expo run:ios` and `expo run:android` (a native build) instead of `expo start --ios` and `--android`.

### Fixed

- The authenticated top bar keeps below the status bar: it uses the top safe area inset, so on a phone with a notch or Dynamic Island the clock no longer overlaps the greeting, and the status icons no longer overlap the header buttons. An existing project takes the fix by copying `src/components/navigation/TopBar.tsx` from the template.

### Documentation

- The README has a "Running on a simulator or emulator" section: the development build, the 14 minutes of the first `pod install` and 15 of the first native build measured on a cold cache, how the bundler port reaches the app (`--port` and `RCT_jsLocation`), why a production build of the web app needs HTTPS (the `Secure` session cookie is not sent over `http://localhost`), and the Android emulator address.

## [0.1.0-beta.197] - 2026-10-08

No changes; version aligned with core.

## [0.1.0-beta.196] - 2026-10-07

No changes; version aligned with core.

## [0.1.0-beta.195] - 2026-10-07

### Upgrading from 0.1.0-beta.194

- **The client no longer sends `Authorization: Bearer <session token>`.** Core has no bearer plugin: the session cookie (native cookie store) is what authenticated, and the header was read as an API key,
  rejected after a ~100 ms delay on every request. The token is still stored, but it no longer says a session exists: the app asks the server (see Fixed). An app that uses an API key passes it in
  `headers` as before. **Expo web:** cookie-authenticated writes are origin-checked: add the Expo web origin to `CORS_ADDITIONAL_ORIGINS` on the API (see the README).
- **`updateProfile({ name, image })` no longer type-checks:** use `firstName`, `lastName` and `language` (`name` is derived from them; core never accepted `name` or `image` there). The `User` type gains `firstName`, `lastName` and `language`.

### Changed

- **API:** `UpdateProfileInput` is `{ firstName, lastName, language }`. `updatePreferences()` calls run one after another; across devices the last write wins.

### Fixed

- **Signing in again with a session still active, and signing out, work from native apps.** The client sends `Origin: <API origin>` on native (never on web, never over an `Origin` you set): Better Auth refused
  cookie-authenticated POSTs without one (403 `MISSING_OR_NULL_ORIGIN`). Sign-out now revokes the session on the server; before, the server answered 403 and the app only cleared local state.
  If the API host differs from `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL`, add it to `CORS_ADDITIONAL_ORIGINS`.
- **Session after reinstalling the app (iOS):** the Keychain outlives an uninstall, so the stored token and user made a fresh install believe it was signed in and the first call got a 401. `apiClient.init()` now clears
  credentials found with no cookie in the native cookie store (which an uninstall does empty; needs `@preeternal/react-native-cookie-manager`, otherwise the server decides), and `restoreSession` treats Better Auth's
  answer of "no session" (200 with a `null` body, which `authApi.getSession()` used to turn into a `TypeError`) as signed out instead of falling back to the stored user; any other body (a proxy's page, a 204) is not an answer and keeps the stored state. A server that cannot be reached still keeps the stored user. `init()` clears only the stored credentials, not the cookies of other hosts.
  New `hasNativeCookies(url)` in `@nextsparkjs/mobile/lib`.
- **API:** `usersApi.getCurrentUser()` and `updateProfile()` call `/api/v1/users/me`, which core now serves (#209). `getPreferences()`/`updatePreferences()` no longer call `/api/v1/users/me/preferences`, which no core route backs:
  they read and write the user's `preferences` metadata (`/api/v1/users/:id/meta/preferences`).

## [0.1.0-beta.194] - 2026-10-06

### Fixed

- **Template:** ships `__tests__/utils.test.ts` and a Jest `transformIgnorePatterns` that works under pnpm, so a new project's `pnpm test` passes. `react-native-worklets` is pinned to `0.5.1` and `@types/react` to `~19.1.10` (what Expo SDK 54 expects; `expo-doctor` 18/18).

## [0.1.0-beta.192] - 2026-09-30

### Breaking

- **Types (beta):** `PaginatedResponse<T>` is now `{ success, data, info }` (`ApiListResponse<T>`) and `SingleResponse<T>` is
  `{ success, data, info }` (`ApiSuccessResponse<T>`), which is what the API sends. `PaginatedResponse` used to be typed
  `{ data, meta: { total, page, limit, totalPages } }`, but the API never sent a `meta`: code that read `response.meta.*` compiled and
  got `undefined`. It now fails to compile; read the pagination from `response.info` (`page`, `limit`, `total`, `totalPages`,
  `hasNextPage`, `hasPrevPage`). The `createEntityApi` example is updated accordingly.

### Added

- Exported `ApiInfo`, `PaginationInfo`, `ApiSuccessResponse`, `ApiListResponse` and `ApiErrorResponse` (the response envelopes; the same
  shapes as the generated `@project/contracts`).

### Changed

- The mobile template imports its entity API types (`Task`, `Customer`, ...) from `@project/contracts`, the portable contracts package
  `nextspark prepare` generates from the web project's entities (a workspace package in a web+mobile project).

### Fixed

- The template's `package.json` declares the packages its own configs make Metro load (`react-native-css-interop`, `react-native-worklets`,
  `babel-preset-expo`, `expo-device`); under pnpm's isolated layout `expo export` failed on a fresh project without them.
