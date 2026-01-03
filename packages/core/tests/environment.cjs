// Para uso en jest.config.js y cypress.config.ts (CommonJS)
const { existsSync } = require('fs')
const { resolve } = require('path')

function isMonorepoContext() {
  const monorepoMarker = resolve(process.cwd(), '../../packages/core/package.json')
  return existsSync(monorepoMarker)
}

function getTestPaths() {
  const isMonorepo = isMonorepoContext()

  return {
    isMonorepo,
    coreSrc: isMonorepo
      ? '<rootDir>/../../packages/core/src'
      : '@nextsparkjs/core',
    coreTests: isMonorepo
      ? '../../packages/core/tests'
      : 'node_modules/@nextsparkjs/core/tests',
    cypressSupport: isMonorepo
      ? '../../../../packages/core/tests/cypress/support'
      : '@nextsparkjs/core/cypress-support',
  }
}

module.exports = { isMonorepoContext, getTestPaths }
