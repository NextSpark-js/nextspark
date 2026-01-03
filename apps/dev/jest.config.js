const { existsSync } = require('fs')
const { resolve } = require('path')

// Detectar si estamos en monorepo o en proyecto que instaló via npm
const isMonorepo = existsSync(resolve(__dirname, '../../packages/core/package.json'))

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests/jest'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleNameMapper: {
    // Core testing utilities
    '^@nextsparkjs/core/testing$': isMonorepo
      ? '<rootDir>/../../packages/core/src/testing'
      : '@nextsparkjs/core/testing',
    // Core modules
    '^@nextsparkjs/core/(.*)$': isMonorepo
      ? '<rootDir>/../../packages/core/src/$1'
      : '@nextsparkjs/core/$1',
    '^@nextsparkjs/core$': isMonorepo
      ? '<rootDir>/../../packages/core/src'
      : '@nextsparkjs/core',
    // Registries
    '^@nextsparkjs/registries/(.*)$': '<rootDir>/.nextspark/registries/$1',
    // Local paths
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: [
    // Core setup first
    isMonorepo
      ? '<rootDir>/../../packages/core/tests/jest/setup.ts'
      : '@nextsparkjs/core/jest-setup',
    // Then local setup
    '<rootDir>/tests/jest/setup.ts',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
    }],
  },
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    '!**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
}
