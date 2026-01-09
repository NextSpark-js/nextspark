/**
 * Cypress Configuration for {{THEME_DISPLAY_NAME}} Theme
 *
 * This config is theme-specific and used by scripts/cy.mjs.
 * Run with: NEXT_PUBLIC_ACTIVE_THEME={{THEME_SLUG}} pnpm cy:open
 */

import { defineConfig } from 'cypress'
import path from 'path'
import fs from 'fs'

// Paths relative to this config file
const themeRoot = path.resolve(__dirname, '..')
const projectRoot = path.resolve(__dirname, '../../../..')
const narrationsOutputDir = path.join(__dirname, 'cypress/videos/narrations')

// Load environment variables
import dotenv from 'dotenv'
dotenv.config({ path: path.join(projectRoot, '.env') })

// Server port (from .env or default 5173)
const port = process.env.PORT || 5173

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

    // Spec patterns: core tests + theme tests
    specPattern: [
      // Core tests (always included)
      path.join(projectRoot, 'core/tests/cypress/e2e/core/**/*.cy.{js,ts}'),
      // Theme-specific tests
      path.join(__dirname, 'cypress/e2e/**/*.cy.{js,ts}'),
    ],

    // Support file (shared across themes)
    supportFile: path.join(projectRoot, 'core/tests/cypress/support/e2e.ts'),

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
      ACTIVE_THEME: '{{THEME_SLUG}}',
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

    setupNodeEvents(on, config) {
      // Allure plugin setup (allure-cypress)
      const { allureCypress } = require('allure-cypress/reporter')
      allureCypress(on, config, {
        resultsDir: path.join(__dirname, 'cypress/allure-results'),
      })

      // @cypress/grep plugin for test filtering by tags
      require('@cypress/grep/src/plugin')(config)

      // Documentation video tasks
      on('task', {
        /**
         * Save narrations to JSON file for post-processing
         */
        saveNarrations({
          specName,
          narrations,
        }: {
          specName: string
          narrations: unknown[]
        }) {
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
