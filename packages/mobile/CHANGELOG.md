# Changelog

All notable changes to `@nextsparkjs/mobile` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Upgrading from 0.1.0-beta.194

- **The client no longer sends `Authorization: Bearer <session token>`.** Core has no bearer plugin: the session cookie (native cookie store) is what authenticated, and the header was read as an API key,
  rejected after a ~100 ms delay on every request. The token is still stored (`getToken()` marks that a session exists). An app that uses an API key passes it in
  `headers` as before. **Expo web:** cookie-authenticated writes are origin-checked: add the Expo web origin to `CORS_ADDITIONAL_ORIGINS` on the API (see the README).
- **`updateProfile({ name, image })` no longer type-checks:** use `firstName`, `lastName` and `language` (`name` is derived from them; core never accepted `name` or `image` there). The `User` type gains `firstName`, `lastName` and `language`.

### Changed

- **API:** `UpdateProfileInput` is `{ firstName, lastName, language }`. `updatePreferences()` calls run one after another; across devices the last write wins.

### Fixed

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
