/**
 * Jest Configuration for Default Theme
 *
 * This config works in both monorepo and npm mode.
 * Run with: pnpm test:theme
 */

const path = require('path')
const fs = require('fs')

// Paths relative to this config file
const themeTestsRoot = __dirname
const themeRoot = path.resolve(__dirname, '../..')

// In monorepo: themes/default/tests/jest -> apps/dev (via symlink in contents/)
// In npm mode: contents/themes/default/tests/jest -> project root (5 levels up)
const monorepoRepoRoot = path.resolve(__dirname, '../../../..')
const npmModeRoot = path.resolve(__dirname, '../../../../..')

// Detect if running in npm mode (no packages/core folder) vs monorepo
const isNpmMode = !fs.existsSync(path.join(monorepoRepoRoot, 'packages/core'))

// In monorepo, use apps/dev as rootDir since contents/ symlinks to themes/
const monorepoAppRoot = path.join(monorepoRepoRoot, 'apps/dev')
const projectRoot = isNpmMode ? npmModeRoot : monorepoAppRoot

// Module name mapper based on mode
const moduleNameMapper = isNpmMode
  ? {
      // NPM mode: explicitly resolve @nextsparkjs/core subpaths to dist directory
      // Jest doesn't respect package.json exports, so we map directly to dist files
      '^@nextsparkjs/core/lib/(.*)$': '<rootDir>/node_modules/@nextsparkjs/core/dist/lib/$1',
      '^@nextsparkjs/core/hooks/(.*)$': '<rootDir>/node_modules/@nextsparkjs/core/dist/hooks/$1',
      '^@nextsparkjs/core/components/(.*)$': '<rootDir>/node_modules/@nextsparkjs/core/dist/components/$1',
      '^@nextsparkjs/core/(.*)$': '<rootDir>/node_modules/@nextsparkjs/core/dist/$1',
      '^@nextsparkjs/core$': '<rootDir>/node_modules/@nextsparkjs/core/dist/index.js',
      '^@/contents/(.*)$': '<rootDir>/contents/$1',
      '^@/entities/(.*)$': '<rootDir>/contents/entities/$1',
      '^@/plugins/(.*)$': '<rootDir>/contents/plugins/$1',
      '^@/themes/(.*)$': '<rootDir>/contents/themes/$1',
      '^@/(.*)$': '<rootDir>/$1',
      // Mocks from theme-local folder
      'next/server': path.join(themeTestsRoot, '__mocks__/next-server.js'),
      '^jose$': path.join(themeTestsRoot, '__mocks__/jose.js'),
      '^jose/(.*)$': path.join(themeTestsRoot, '__mocks__/jose.js'),
    }
  : {
      // Monorepo mode: resolve from packages/core/src (rootDir is apps/dev)
      '^@nextsparkjs/core/(.*)$': '<rootDir>/../../packages/core/src/$1',
      '^@nextsparkjs/core$': '<rootDir>/../../packages/core/src',
      '^@/contents/(.*)$': '<rootDir>/contents/$1',
      '^@/entities/(.*)$': '<rootDir>/contents/entities/$1',
      '^@/plugins/(.*)$': '<rootDir>/contents/plugins/$1',
      '^@/themes/(.*)$': '<rootDir>/contents/themes/$1',
      '^@/(.*)$': '<rootDir>/$1',
      // Mocks from core
      'next/server': '<rootDir>/../../packages/core/tests/jest/__mocks__/next-server.js',
      '^jose$': '<rootDir>/../../packages/core/tests/jest/__mocks__/jose.js',
      '^jose/(.*)$': '<rootDir>/../../packages/core/tests/jest/__mocks__/jose.js',
    }

// Setup files based on mode
const setupFilesAfterEnv = isNpmMode
  ? [
      // NPM mode: use theme's local setup only (it includes everything needed)
      path.join(themeTestsRoot, 'setup.ts'),
    ]
  : [
      // Monorepo mode: use local core setup (rootDir is apps/dev)
      '<rootDir>/../../packages/core/tests/jest/setup.ts',
    ]

/** @type {import('jest').Config} */
module.exports = {
  displayName: 'theme-default',
  rootDir: projectRoot,

  // Use roots to explicitly set test location (handles symlinks better)
  roots: [themeTestsRoot],

  // Test file patterns
  testMatch: [
    '**/*.{test,spec}.{js,ts,tsx}',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
  ],

  // Preset and environment
  preset: 'ts-jest',
  testEnvironment: 'jsdom',

  // Module resolution
  moduleNameMapper,

  // Setup files
  setupFilesAfterEnv,

  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: path.join(projectRoot, 'tsconfig.json'),
    }],
  },

  // Transform ignore patterns - allow TypeScript from core's jest-setup
  transformIgnorePatterns: [
    'node_modules/(?!(uncrypto|better-auth|@noble|.*jose.*|remark.*|unified.*|@nextsparkjs/core/tests|.*\\.mjs$))',
    'node_modules/\\.pnpm/(?!(.*uncrypto.*|.*better-auth.*|.*@noble.*|.*jose.*|.*remark.*|.*unified.*|@nextsparkjs.*core.*tests|.*\\.mjs$))',
  ],

  // File extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Test timeout
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Force exit after tests complete
  forceExit: true,

  // Disable watchman for symlink support
  watchman: false,

  // Coverage output directory
  coverageDirectory: path.join(themeTestsRoot, 'coverage'),
  coverageReporters: ['text', 'lcov', 'html'],
}
