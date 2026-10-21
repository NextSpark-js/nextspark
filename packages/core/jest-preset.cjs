/**
 * Jest preset for the tests of a project that installs @nextsparkjs/core.
 *
 *   const preset = require('@nextsparkjs/core/jest-preset')
 *   module.exports = {
 *     ...preset,
 *     moduleNameMapper: { ...preset.moduleNameMapper, '^@/(.*)$': '<rootDir>/$1' },
 *   }
 *
 * It maps core's subpaths to the built package (Jest 29 does not follow every condition of `exports`), including
 * `@nextsparkjs/core/selectors`, whose file is not at the path the generic mapper would build, and `server-only`, which
 * throws outside a React Server Components build. It also transforms core's ESM build so Jest can load it. It sets no
 * test environment, setup file or project aliases: those stay in the project's config.
 */
const path = require('path')

const root = __dirname
const dist = path.join(root, 'dist')
const mocks = path.join(root, 'tests', 'jest', '__mocks__')

module.exports = {
  moduleNameMapper: {
    // More specific subpaths first: Jest uses the first pattern that matches
    '^@nextsparkjs/core/selectors$': path.join(dist, 'lib/selectors/index.js'),
    '^@nextsparkjs/core/lib/selectors$': path.join(dist, 'lib/selectors/index.js'),
    '^@nextsparkjs/core/selectors/(.*)$': path.join(dist, 'lib/selectors/by-domain/$1.js'),
    // Exported as ./actions, built to lib/actions
    '^@nextsparkjs/core/actions$': path.join(dist, 'lib/actions/index.js'),
    '^@nextsparkjs/core/(.*)$': path.join(dist, '$1'),
    '^@nextsparkjs/core$': path.join(dist, 'index.js'),
    '^server-only$': path.join(mocks, 'server-only.js'),
  },
  // core's build is ESM: rewrite it to CommonJS (the project's own .ts/.tsx transform is not touched)
  transform: {
    '^.+\\.[cm]?jsx?$': path.join(root, 'jest-esm-transform.cjs'),
  },
  // Dependencies stay untransformed except core's build and the ESM-only packages that tests of auth code reach
  transformIgnorePatterns: [
    '/node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?(?:@nextsparkjs/core/|uncrypto|better-auth|@noble|jose|remark|unified|[^/]*\\.mjs$))',
  ],
}
