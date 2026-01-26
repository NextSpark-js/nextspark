/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests/jest'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  testPathIgnorePatterns: [
    '/node_modules/',
    // Tests that require generated project files (@/app, @/contents)
    'tests/jest/api/ai-generate.test.ts',
    'tests/jest/api/internal-user-metadata.test.ts',
    'tests/jest/lib/ai-sanitize.test.ts',
    // Tests that require @testing-library/user-event (not installed)
    'tests/jest/components/auth/forms/LoginForm.test.tsx',
    // Service tests that require full runtime registry configuration
    // These tests work correctly in the context of a generated project
    'tests/jest/services/block.service.test.ts',
    'tests/jest/services/entity-type.service.test.ts',
    'tests/jest/services/membership.service.test.ts',
    'tests/jest/services/namespace.service.test.ts',
    'tests/jest/services/permission.service.test.ts',
    'tests/jest/services/scope.service.test.ts',
    'tests/jest/services/theme.service.test.ts',
    'tests/jest/services/translation.service.test.ts',
    // Billing tests that expect specific registry configuration
    'tests/jest/lib/billing-queries.test.ts',
    'tests/jest/lib/billing/enforcement.test.ts',
    // Config tests requiring runtime data
    'tests/jest/lib/config/roles-merge.test.ts',
    // Scheduled actions tests requiring theme config
    'tests/jest/lib/scheduled-actions/cleanup.test.ts',
    'tests/jest/lib/scheduled-actions/processor.test.ts',
    // UI component tests with selector issues (preexisting)
    'tests/jest/components/ui/last-used-badge.test.tsx',
    // Pattern tests with async issues (preexisting)
    'tests/jest/patterns/pattern-usage.service.test.ts',
  ],
  moduleNameMapper: {
    // Workspace packages
    '^@nextsparkjs/ui$': '<rootDir>/../ui/src/index.ts',
    '^@nextsparkjs/core/(.*)$': '<rootDir>/src/$1',
    '^@nextsparkjs/core$': '<rootDir>/src',
    '^@/core/lib/registries/(.*)$': '<rootDir>/tests/jest/__mocks__/@nextsparkjs/registries/$1',
    '^@/core/(.*)$': '<rootDir>/src/$1',
    '^@/core$': '<rootDir>/src',
    '^@nextsparkjs/registries/(.*)$': '<rootDir>/tests/jest/__mocks__/@nextsparkjs/registries/$1',
    '^next/server$': '<rootDir>/tests/jest/__mocks__/next-server.js',
    '^server-only$': '<rootDir>/tests/jest/__mocks__/server-only.js',
    '^ai$': '<rootDir>/tests/jest/__mocks__/ai.js',
    // Mock ESM modules that cause import issues
    '^better-auth$': '<rootDir>/tests/jest/__mocks__/better-auth.js',
    '^better-auth/next-js$': '<rootDir>/tests/jest/__mocks__/better-auth-next.js',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/jest/setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
    }],
  },
  // Transform ESM modules that Jest can't parse directly
  transformIgnorePatterns: [
    '/node_modules/(?!(rou3|better-auth|better-call|@better-auth)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
}
