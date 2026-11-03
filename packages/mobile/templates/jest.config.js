/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  // pnpm keeps packages under node_modules/.pnpm/<name>@<version>/node_modules/<name>, so the
  // allowlist may be preceded by that prefix
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@nextsparkjs/.*))',
  ],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // @nextsparkjs/mobile is ESM with an `import` export condition only; Jest resolves with `require`
    // and would fail with ERR_PACKAGE_PATH_NOT_EXPORTED. Point it at the built files Metro loads.
    // The allowlist above makes Jest transform them.
    '^@nextsparkjs/mobile$': '<rootDir>/node_modules/@nextsparkjs/mobile/dist/index.js',
    '^@nextsparkjs/mobile/(.*)$': '<rootDir>/node_modules/@nextsparkjs/mobile/dist/$1/index.js',
  },
};
