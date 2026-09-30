# Changelog

All notable changes to `@nextsparkjs/mobile` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Breaking (types, beta):** `PaginatedResponse<T>` is now `{ success, data, info }` (`ApiListResponse<T>`) and `SingleResponse<T>` is
  `{ success, data, info }` (`ApiSuccessResponse<T>`), which is what the API sends. `PaginatedResponse` used to be typed
  `{ data, meta: { total, page, limit, totalPages } }`, but the API never sent a `meta`: code that read `response.meta.*` compiled and
  got `undefined`. It now fails to compile; read the pagination from `response.info` (`page`, `limit`, `total`, `totalPages`,
  `hasNextPage`, `hasPrevPage`). The `createEntityApi` example is updated accordingly.
- The mobile template imports its entity API types (`Task`, `Customer`, ...) from `@project/contracts`, the portable contracts package
  `nextspark prepare` generates from the web project's entities (a workspace package in a web+mobile project).

### Added

- Exported `ApiInfo`, `PaginationInfo`, `ApiSuccessResponse`, `ApiListResponse` and `ApiErrorResponse` (the response envelopes; the same
  shapes as the generated `@project/contracts`).
