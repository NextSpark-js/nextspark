/**
 * The routes the fake core package provides by default, as `@nextsparkjs/core` would declare them:
 * kind, path under src/app, and the package subpath that implements it. A layout may also declare the wrapper
 * a project override of it is composed with (`compose`).
 */
export const CORE_ROUTES = [
  { kind: 'layout', target: 'layout.tsx', specifier: '@fixture-core/app/layout' },
  { kind: 'error', target: 'error.tsx', specifier: '@fixture-core/app/error' },
  { kind: 'global-error', target: 'global-error.tsx', specifier: '@fixture-core/app/global-error' },
  { kind: 'page', target: 'page.tsx', specifier: '@fixture-core/app/home/page' },
  { kind: 'page', target: 'about/page.tsx', specifier: '@fixture-core/app/about/page' },
  { kind: 'layout', target: '(shell)/layout.tsx', specifier: '@fixture-core/app/shell/layout', compose: { wrapper: 'withShell', specifier: '@fixture-core/app/shell-layout' } },
  { kind: 'page', target: '(shell)/shell/page.tsx', specifier: '@fixture-core/app/shell/page' },
]

/** The modules the per-entity routes import in the fake core (the real ones are core's `routes/_internal/*`). */
export const ENTITY_MODULES = {
  layout: '@fixture-core/app/entity/layout-route',
  list: '@fixture-core/app/entity/list-route',
  detail: '@fixture-core/app/entity/detail-route',
  create: '@fixture-core/app/entity/create-route',
  edit: '@fixture-core/app/entity/edit-route',
  publicItem: '@fixture-core/app/entity/unused-public-item',
  publicArchive: '@fixture-core/app/entity/unused-public-archive',
  listMetadata: '@fixture-core/app/entity/list-page',
  detailMetadata: '@fixture-core/app/entity/detail-page',
  error: '@fixture-core/app/entity/error',
  loading: '@fixture-core/app/entity/loading',
}
