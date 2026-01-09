/**
 * Cypress Configuration for Default Theme
 *
 * This config works in both monorepo and npm mode.
 * Run with: pnpm cy:open or pnpm cy:run
 *
 * Filter by tags: pnpm cy:tags "@smoke" or pnpm cy:run --env grepTags="@smoke"
 */

import { defineConfig } from 'cypress'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

// ESM/CJS compatibility: Create __dirname for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Paths relative to this config file
const themeRoot = path.resolve(__dirname, '..')
const narrationsOutputDir = path.join(__dirname, 'cypress/videos/narrations')

// Detect if running in npm mode vs monorepo
// In monorepo: themes/default/tests -> 3 levels up to repo root
// In npm mode: contents/themes/default/tests -> 4 levels up to project root
const monorepoRoot = path.resolve(__dirname, '../../..')
const npmRoot = path.resolve(__dirname, '../../../..')
const isNpmMode = !fs.existsSync(path.join(monorepoRoot, 'packages/core'))
const projectRoot = isNpmMode ? npmRoot : monorepoRoot

// Load environment variables
// In monorepo: apps/dev/.env | In npm mode: .env at project root
import dotenv from 'dotenv'
const envPath = isNpmMode
  ? path.join(projectRoot, '.env')
  : path.join(projectRoot, 'apps/dev/.env')
dotenv.config({ path: envPath })

// Server port (from .env or default 3000)
const port = process.env.PORT || 3000

// Extract CYPRESS_ prefixed variables from process.env
// Cypress auto-strips the CYPRESS_ prefix when accessing via Cypress.env()
const cypressEnvVars: Record<string, string> = {}
Object.entries(process.env).forEach(([key, value]) => {
  if (key.startsWith('CYPRESS_') && value) {
    // Remove CYPRESS_ prefix for Cypress.env() access
    const cypressKey = key.replace('CYPRESS_', '')
    cypressEnvVars[cypressKey] = value
  }
})

export default defineConfig({
  e2e: {
    // Base URL for the application
    baseUrl: `http://localhost:${port}`,

    // Spec patterns: theme tests (core tests only in monorepo)
    specPattern: isNpmMode
      ? [
          // npm mode: only theme tests
          path.join(__dirname, 'cypress/e2e/**/*.cy.{js,ts}'),
        ]
      : [
          // Monorepo: core tests + theme tests
          path.join(projectRoot, 'packages/core/tests/cypress/e2e/core/**/*.cy.{js,ts}'),
          path.join(__dirname, 'cypress/e2e/**/*.cy.{js,ts}'),
        ],

    // Support file (theme-local in npm mode, core in monorepo)
    supportFile: isNpmMode
      ? path.join(__dirname, 'cypress/support/e2e.ts')
      : path.join(projectRoot, 'packages/core/tests/cypress/support/e2e.ts'),

    // Fixtures folder (theme-specific)
    fixturesFolder: path.join(__dirname, 'cypress/fixtures'),

    // Output folders (theme-specific)
    downloadsFolder: path.join(__dirname, 'cypress/downloads'),
    screenshotsFolder: path.join(__dirname, 'cypress/screenshots'),
    videosFolder: path.join(__dirname, 'cypress/videos'),

    // Viewport settings
    viewportWidth: 1280,
    viewportHeight: 720,

    // Video and screenshot settings
    video: true,
    screenshotOnRunFailure: true,

    // Timeouts
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    pageLoadTimeout: 30000,

    // Browser settings
    chromeWebSecurity: false,

    // Test isolation
    testIsolation: true,

    // Retry settings
    retries: {
      runMode: 1,
      openMode: 0,
    },

    // Environment variables
    env: {
      // Spread CYPRESS_ prefixed vars from .env (e.g., CYPRESS_DEVELOPER_EMAIL -> DEVELOPER_EMAIL)
      ...cypressEnvVars,

      // Theme info
      ACTIVE_THEME: 'default',
      THEME_PATH: themeRoot,

      // Feature flags
      ENABLE_ALLURE: true,

      // Allure reporting
      allureResultsPath: path.join(__dirname, 'cypress/allure-results'),

      // API settings
      API_URL: `http://localhost:${port}/api`,
      API_BASE_URL: `http://localhost:${port}`,

      // @cypress/grep - filter specs by tags
      grepFilterSpecs: true,
      grepOmitFiltered: true,
    },

    async setupNodeEvents(on, config) {
      // Allure plugin setup (allure-cypress)
      const { allureCypress } = await import('allure-cypress/reporter')
      allureCypress(on, config, {
        resultsDir: path.join(__dirname, 'cypress/allure-results'),
      })

      // @cypress/grep plugin for test filtering by tags
      // v5.x uses named export { plugin } from '@cypress/grep/plugin'
      const { plugin: grepPlugin } = await import('@cypress/grep/plugin')
      grepPlugin(config)

      // Documentation video tasks
      on('task', {
        /**
         * Save narrations to JSON file for post-processing
         */
        saveNarrations({ specName, narrations }: { specName: string; narrations: unknown[] }) {
          // Ensure output directory exists
          if (!fs.existsSync(narrationsOutputDir)) {
            fs.mkdirSync(narrationsOutputDir, { recursive: true })
          }

          const filename = `${specName}-narrations.json`
          const filepath = path.join(narrationsOutputDir, filename)

          fs.writeFileSync(filepath, JSON.stringify(narrations, null, 2))
          console.log(`📝 Narrations saved to: ${filepath}`)

          return null
        },

        /**
         * Add narration entry (called per narration)
         */
        addNarration(narration: unknown) {
          // This could be used for real-time streaming to a narration service
          console.log('🎙️ Narration:', narration)
          return null
        },
      })

      return config
    },
  },

  // Component testing (future use)
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack',
    },
  },
})
