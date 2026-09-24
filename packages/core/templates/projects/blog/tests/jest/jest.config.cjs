/**
 * Jest configuration for the blog install-once project template.
 *
 * The suite runs after the template payload is copied into a clean project
 * root. NEXTSPARK_REPO_ROOT lets repository CI resolve core/UI from source;
 * published projects resolve the installed packages instead.
 */

const path = require('path')
const fs = require('fs')

const testsRoot = __dirname
const projectRoot = path.resolve(__dirname, '../..')
const repoRoot = process.env.NEXTSPARK_REPO_ROOT
const useRepositorySources = Boolean(repoRoot && fs.existsSync(path.join(repoRoot, 'packages/core/src')))

const moduleNameMapper = {
  '^@/plugins/(.*)$': '<rootDir>/plugins/$1',
  '^@/(.*)$': '<rootDir>/$1',
  'next/server': path.join(testsRoot, '__mocks__/next-server.js'),
  '^jose$': path.join(testsRoot, '__mocks__/jose.js'),
  '^jose/(.*)$': path.join(testsRoot, '__mocks__/jose.js'),
}

if (useRepositorySources) {
  Object.assign(moduleNameMapper, {
    '^@nextsparkjs/core/(.*)$': path.join(repoRoot, 'packages/core/src/$1'),
    '^@nextsparkjs/core$': path.join(repoRoot, 'packages/core/src'),
    '^@nextsparkjs/ui$': path.join(repoRoot, 'packages/ui/src/index.ts'),
  })
} else {
  Object.assign(moduleNameMapper, {
    '^@nextsparkjs/core/(.*)$': '<rootDir>/node_modules/@nextsparkjs/core/dist/$1',
    '^@nextsparkjs/core$': '<rootDir>/node_modules/@nextsparkjs/core/dist/index.js',
  })
}

/** @type {import('jest').Config} */
module.exports = {
  displayName: 'project-template-blog',
  rootDir: projectRoot,

  roots: ['<rootDir>/tests/jest'],

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

  setupFilesAfterEnv: [path.join(testsRoot, 'setup.ts')],

  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      diagnostics: false,
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        types: ['jest', 'node', 'react', 'react-dom'],
        baseUrl: projectRoot,
        paths: { '@/*': ['./*'] },
      },
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
  coverageDirectory: '<rootDir>/tests/jest/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
}
