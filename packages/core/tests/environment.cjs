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
    // No cypressSupport here: Cypress infrastructure moved to
    // @nextsparkjs/testing (see 23a9bef3) and core no longer ships
    // tests/cypress/support or a "./cypress-support" export. getTestPaths()
    // has no callers in this repo; if a Cypress support path is ever needed
    // again from here, point it at @nextsparkjs/testing instead.
  }
}

module.exports = { isMonorepoContext, getTestPaths }
