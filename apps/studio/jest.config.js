/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  testMatch: ['<rootDir>/lib/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/studio-projects/'],
}
