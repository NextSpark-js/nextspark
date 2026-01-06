/**
 * Cypress Configuration for Productivity Theme
 *
 * This config is theme-specific and used by scripts/cy.mjs.
 * Run with: NEXT_PUBLIC_ACTIVE_THEME=productivity pnpm cy:open
 */

import { defineConfig } from 'cypress'
import path from 'path'

// Paths relative to this config file
const themeRoot = path.resolve(__dirname, '..')
const projectRoot = path.resolve(__dirname, '../../../..')

// Load environment variables
import dotenv from 'dotenv'
dotenv.config({ path: path.join(projectRoot, '.env') })

export default defineConfig({
  e2e: {
    // Base URL for the application
    baseUrl: 'http://localhost:5173',

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
      // Theme info
      ACTIVE_THEME: 'productivity',
      THEME_PATH: themeRoot,

      // Test user credentials
      TEST_USER_EMAIL: 'user@example.com',
      TEST_USER_PASSWORD: 'Testing1234',

      // Feature flags
      ENABLE_ALLURE: true,

      // API settings
      API_URL: 'http://localhost:5173/api',
      API_BASE_URL: 'http://localhost:5173',
    },

    setupNodeEvents(on, config) {
      // Allure plugin setup
      const allureWriter = require('@shelex/cypress-allure-plugin/writer')
      allureWriter(on, config)

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
