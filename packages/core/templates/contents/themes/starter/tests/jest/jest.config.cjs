/**
 * Jest Configuration for Starter Theme
 *
 * This config is for npm mode (projects created via nextspark init).
 * Run with: pnpm test:theme
 */

const path = require('path')

// Paths relative to this config file
const themeTestsRoot = __dirname
const themeRoot = path.resolve(__dirname, '../..')

// In npm mode: contents/themes/starter/tests/jest -> project root (5 levels up)
const projectRoot = path.resolve(__dirname, '../../../../..')

/** @type {import('jest').Config} */
module.exports = {
  displayName: 'theme-starter',
  rootDir: projectRoot,

  // Use roots to explicitly set test location
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

  // Module resolution for npm mode
  // Explicitly resolve @nextsparkjs/core subpaths to dist directory
  // Jest doesn't respect package.json exports, so we map directly to dist files
  moduleNameMapper: {
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
  },

  // Setup files
  setupFilesAfterEnv: [
    path.join(themeTestsRoot, 'setup.ts'),
  ],

  // Transform configuration
  // Use tsconfig.jest.json for JSX support (jsx: "react-jsx" instead of "preserve")
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: path.join(themeTestsRoot, 'tsconfig.jest.json'),
    }],
  },

  // Transform ignore patterns
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
