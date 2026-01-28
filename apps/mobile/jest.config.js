/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  displayName: 'mobile',

  // Tests location
  roots: ['<rootDir>/tests/jest'],
  testMatch: ['**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.expo/'],

  // Module resolution - redirect Platform import to our mock
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native/Libraries/Utilities/Platform$':
      '<rootDir>/tests/jest/__mocks__/platform.ts',
  },

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
