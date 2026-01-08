/**
 * Cypress Configuration for Starter Theme
 *
 * This config is self-contained for npm projects created with `nextspark init`.
 * Run with: pnpm cy:open or pnpm cy:run
 *
 * Filter by tags: pnpm cy:tags "@smoke" or pnpm cy:run --env grepTags="@smoke"
 */

import { defineConfig } from 'cypress'
import path from 'path'
import fs from 'fs'

// __dirname is available because ts-node processes this file as CommonJS
// (Next.js projects don't use "type": "module" in package.json)

// Paths relative to this config file
const themeRoot = path.resolve(__dirname, '..')
const projectRoot = path.resolve(__dirname, '../../../..')
const narrationsOutputDir = path.join(__dirname, 'cypress/videos/narrations')

// Load environment variables
import dotenv from 'dotenv'
dotenv.config({ path: path.join(projectRoot, '.env') })

// Server port (from .env or default 3000)
const port = process.env.PORT || 3000

export default defineConfig({
  e2e: {
    // Base URL for the application
    baseUrl: `http://localhost:${port}`,

    // Spec patterns: theme tests only
    specPattern: [
      path.join(__dirname, 'cypress/e2e/**/*.cy.{js,ts}'),
    ],

    // Support file (theme-local)
    supportFile: path.join(__dirname, 'cypress/support/e2e.ts'),

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
      // Theme info
      ACTIVE_THEME: 'starter',
      THEME_PATH: themeRoot,

      // Test user credentials (update with your test users)
      TEST_USER_EMAIL: 'owner@starter.dev',
      TEST_USER_PASSWORD: 'Test1234',

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
      const grepPlugin = await import('@cypress/grep/src/plugin.js')
      ;(grepPlugin.default || grepPlugin)(config)

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
