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
  rootDir: '../../../../..',

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
  // IMPORTANT: More specific patterns MUST come before generic ones
  moduleNameMapper: {
    '^@nextsparkjs/core/(.*)$': '<rootDir>/packages/core/$1',
    '^@/contents/(.*)$': '<rootDir>/contents/$1',
    '^@/entities/(.*)$': '<rootDir>/contents/entities/$1',
    '^@/plugins/(.*)$': '<rootDir>/contents/plugins/$1',
    '^@/themes/(.*)$': '<rootDir>/contents/themes/$1',
    '^@/(.*)$': '<rootDir>/$1',
    'next/server': '<rootDir>/packages/core/tests/jest/__mocks__/next-server.js',
    '^jose$': '<rootDir>/packages/core/tests/jest/__mocks__/jose.js',
    '^jose/(.*)$': '<rootDir>/packages/core/tests/jest/__mocks__/jose.js',
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/packages/core/tests/setup.ts'],

  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json',
      },
    ],
  },

  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(uncrypto|better-auth|@noble|.*jose.*|remark.*|unified.*|.*\\.mjs$))',
    'node_modules/\\.pnpm/(?!(.*uncrypto.*|.*better-auth.*|.*@noble.*|.*jose.*|.*remark.*|.*unified.*|.*\\.mjs$))',
  ],

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
