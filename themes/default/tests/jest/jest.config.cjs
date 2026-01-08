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
      // NPM mode: Mock core UI components (ESM can't be transformed by Jest)
      '^@nextsparkjs/core/components/ui/badge$': path.join(themeTestsRoot, '__mocks__/@nextsparkjs/core/components/ui/badge.js'),
      // NPM mode: Mock core lib modules that are ESM
      '^@nextsparkjs/core/lib/db$': path.join(themeTestsRoot, '__mocks__/@nextsparkjs/core/lib/db.js'),
      // NPM mode: explicitly resolve @nextsparkjs/core subpaths to dist directory
      // Jest doesn't respect package.json exports, so we map directly to dist files
      '^@nextsparkjs/core/lib/(.*)$': '<rootDir>/node_modules/@nextsparkjs/core/dist/lib/$1',
      '^@nextsparkjs/core/hooks/(.*)$': '<rootDir>/node_modules/@nextsparkjs/core/dist/hooks/$1',
      '^@nextsparkjs/core/components/(.*)$': '<rootDir>/node_modules/@nextsparkjs/core/dist/components/$1',
      '^@nextsparkjs/core/(.*)$': '<rootDir>/node_modules/@nextsparkjs/core/dist/$1',
      '^@nextsparkjs/core$': '<rootDir>/node_modules/@nextsparkjs/core/dist/index.js',
      '^@nextsparkjs/registries/(.*)$': path.join(themeTestsRoot, '__mocks__/@nextsparkjs/registries/$1'),
      '^@/contents/(.*)$': '<rootDir>/contents/$1',
      '^@/entities/(.*)$': '<rootDir>/contents/entities/$1',
      '^@/plugins/(.*)$': '<rootDir>/contents/plugins/$1',
      '^@/themes/(.*)$': '<rootDir>/contents/themes/$1',
      '^@/(.*)$': '<rootDir>/$1',
      // Mocks from theme-local folder
      'next/server': path.join(themeTestsRoot, '__mocks__/next-server.js'),
      'next/image': path.join(themeTestsRoot, '__mocks__/next/image.js'),
      '^jose$': path.join(themeTestsRoot, '__mocks__/jose.js'),
      '^jose/(.*)$': path.join(themeTestsRoot, '__mocks__/jose.js'),
    }
  : {
      // Monorepo mode: resolve from packages/core/src (rootDir is apps/dev)
      '^@nextsparkjs/core/(.*)$': '<rootDir>/../../packages/core/src/$1',
      '^@nextsparkjs/core$': '<rootDir>/../../packages/core/src',
      '^@nextsparkjs/registries/(.*)$': '<rootDir>/../../packages/core/tests/jest/__mocks__/@nextsparkjs/registries/$1',
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
  // In npm mode, use project's tsconfig with jsx override
  // In monorepo, use the local tsconfig.jest.json
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: isNpmMode
        ? {
            jsx: 'react-jsx',
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            module: 'ESNext',
            moduleResolution: 'bundler',
            strict: true,
            baseUrl: projectRoot,
            paths: {
              '@/*': ['./*'],
              '@/contents/*': ['./contents/*'],
            },
          }
        : path.join(themeTestsRoot, 'tsconfig.jest.json'),
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
