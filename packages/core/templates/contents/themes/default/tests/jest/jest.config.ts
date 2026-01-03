/**
 * Jest Configuration for Default Theme
 *
 * This config is automatically loaded by the theme test runner.
 *
 * Usage:
 *   pnpm test:theme          # Run theme tests
 *   pnpm test:theme:watch    # Watch mode
 *   pnpm test:theme:coverage # With coverage
 */

import type { Config } from 'jest'

const config: Config = {
  displayName: 'theme-default',
  rootDir: '../../../../..',  // Points to project root (5 levels up from jest.config.ts)

  // Test file patterns
  testMatch: [
    '<rootDir>/contents/themes/default/tests/jest/**/*.{test,spec}.{js,ts,tsx}',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
  ],

  // Preset and environment
  preset: 'ts-jest',
  testEnvironment: 'jsdom',

  // Module resolution (aliases @/)
  moduleNameMapper: {
    // Project aliases
    '^@/contents/(.*)$': '<rootDir>/contents/$1',
    '^@/entities/(.*)$': '<rootDir>/contents/entities/$1',
    '^@/plugins/(.*)$': '<rootDir>/contents/plugins/$1',
    '^@/themes/(.*)$': '<rootDir>/contents/themes/$1',
    '^@/(.*)$': '<rootDir>/$1',
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/contents/themes/default/tests/jest/setup.ts'],

  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/contents/themes/default/tests/jest/tsconfig.jest.json',
      },
    ],
  },

  // File extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Test timeout
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Force exit after tests complete
  forceExit: true,

  // Coverage output directory
  coverageDirectory: '<rootDir>/contents/themes/default/tests/jest/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
}

export default config
