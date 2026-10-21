/**
 * Jest Configuration for a root-first project
 *
 * This config is for npm mode (projects created via nextspark init).
 * Run with: pnpm test
 */

const path = require('path')
// Module mappers for @nextsparkjs/core (including selectors and server-only), the transform of core's ESM build and
// the transform ignore patterns. Your own mappers go after the preset's (Jest uses the first pattern that matches).
const corePreset = require('@nextsparkjs/core/jest-preset')

// Paths relative to this config file
const themeTestsRoot = __dirname
const themeRoot = path.resolve(__dirname, '../..')

const projectRoot = path.resolve(__dirname, '../..')

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

  // Module resolution
  moduleNameMapper: {
    ...corePreset.moduleNameMapper,
    '^@/entities/(.*)$': '<rootDir>/entities/$1',
    '^@/plugins/(.*)$': '<rootDir>/plugins/$1',
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
    ...corePreset.transform,
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: path.join(themeTestsRoot, 'tsconfig.jest.json'),
    }],
  },

  // Transform ignore patterns
  transformIgnorePatterns: corePreset.transformIgnorePatterns,

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
