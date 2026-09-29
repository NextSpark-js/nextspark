/**
 * The routes the fake core package provides by default, as `@nextsparkjs/core` would declare them:
 * kind, path under src/app, and the package subpath that implements it.
 */
export const CORE_ROUTES = [
  { kind: 'layout', target: 'layout.tsx', specifier: '@fixture-core/app/layout' },
  { kind: 'error', target: 'error.tsx', specifier: '@fixture-core/app/error' },
  { kind: 'global-error', target: 'global-error.tsx', specifier: '@fixture-core/app/global-error' },
  { kind: 'page', target: 'page.tsx', specifier: '@fixture-core/app/home/page' },
  { kind: 'page', target: 'about/page.tsx', specifier: '@fixture-core/app/about/page' },
]
