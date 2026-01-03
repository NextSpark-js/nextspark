/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests/jest'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleNameMapper: {
    '^@nextsparkjs/core/(.*)$': '<rootDir>/src/$1',
    '^@nextsparkjs/core$': '<rootDir>/src',
    '^@/core/(.*)$': '<rootDir>/src/$1',
    '^@/core$': '<rootDir>/src',
    '^@nextsparkjs/registries/(.*)$': '<rootDir>/src/lib/registries/$1',
    '^server-only$': '<rootDir>/tests/jest/__mocks__/server-only.js',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/jest/setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
    }],
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
}
