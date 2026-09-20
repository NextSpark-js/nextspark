/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  displayName: 'mobile',
  // The Node crawler works for both one-shot and watch runs without exposing
  // machine-local Watchman recrawl state in test output.
  watchman: false,

  // Tests location
  roots: ['<rootDir>/tests/jest'],
  testMatch: ['**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.expo/'],

  // Module resolution - redirect Platform import to our mock
  // Screens under app/ import via '@/src/...', other modules via '@/...' (both
  // resolve to src/); the more specific pattern must come first.
  //
  // apps/mobile is installed outside the pnpm workspace, so Jest cannot
  // resolve @nextsparkjs/mobile from node_modules; redirect it to the
  // package source, the same way Metro and tsc do for this app. resolver.js
  // then pins that source's own bare imports back to apps/mobile's
  // node_modules, the same way metro.config.js's nodeModulesPaths does.
  moduleNameMapper: {
    '^@/src/(.*)$': '<rootDir>/src/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@nextsparkjs/mobile$': '<rootDir>/../../packages/mobile/src/index.ts',
    '^react-native/Libraries/Utilities/Platform$':
      '<rootDir>/tests/jest/__mocks__/platform.ts',
  },
  resolver: '<rootDir>/tests/jest/resolver.js',

  // Setup - mocks first (before test env), then setup (after test env)
  setupFiles: ['<rootDir>/tests/jest/mocks.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/jest/setup.ts'],

  // Transform React Native packages - pnpm monorepo compatible
  // Empty array = transform everything (let Babel handle it)
  transformIgnorePatterns: [],

  // Coverage
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.types.ts',
  ],
  coverageDirectory: '<rootDir>/tests/jest/coverage',

  testTimeout: 10000,
  verbose: true,
};
