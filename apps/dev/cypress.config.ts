import { defineConfig } from 'cypress'
import { existsSync } from 'fs'
import { resolve } from 'path'

// Detectar si estamos en monorepo o en proyecto que instalo via npm
const isMonorepo = existsSync(resolve(__dirname, '../../packages/core/package.json'))

// Paths a los tests del core segun el contexto
const coreTestsPath = isMonorepo
  ? '../../packages/core/tests/cypress/e2e/**/*.cy.ts'
  : 'node_modules/@nextsparkjs/core/tests/cypress/e2e/**/*.cy.ts'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',

    // Incluir tests del core Y tests del proyecto
    specPattern: [
      coreTestsPath,
      'tests/cypress/e2e/**/*.cy.ts',
    ],

    // Support file del proyecto (que importa el del core)
    supportFile: 'tests/cypress/support/e2e.ts',

    // Fixtures del proyecto
    fixturesFolder: 'tests/cypress/fixtures',

    // Output folders
    videosFolder: 'tests/cypress/videos',
    screenshotsFolder: 'tests/cypress/screenshots',

    // Configuracion adicional
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,

    // Retry en CI
    retries: {
      runMode: 2,
      openMode: 0,
    },

    // Experimentales utiles
    experimentalRunAllSpecs: true,
  },

  // Configuracion de componentes (opcional)
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack',
    },
    specPattern: 'tests/cypress/component/**/*.cy.tsx',
  },
})
