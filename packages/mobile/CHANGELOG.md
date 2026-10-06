# Changelog

All notable changes to `@nextsparkjs/mobile` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
