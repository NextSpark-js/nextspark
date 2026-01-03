/**
 * Cypress Configuration for Default Theme
 *
 * This config is theme-specific.
 * Run with: pnpm cy:open
 *
 * Features:
 * - @cypress/grep for test filtering by tags (--env tags="@smoke")
 * - allure-cypress for test reporting (auto-enabled when installed)
 * - webpack preprocessor for TypeScript in node_modules
 */

import { defineConfig } from 'cypress'
import path from 'path'

// Paths relative to this config file
const themeRoot = path.resolve(__dirname, '..')
const projectRoot = path.resolve(__dirname, '../../../..')

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',

    // Spec patterns - theme tests only
    specPattern: [
      path.join(__dirname, 'cypress/e2e/**/*.cy.{js,ts}'),
    ],

    // Support file (theme-specific)
    supportFile: path.join(__dirname, 'cypress/support/e2e.ts'),

    // Fixtures folder (theme-specific)
    fixturesFolder: path.join(__dirname, 'cypress/fixtures'),

    // Output folders (theme-specific)
    screenshotsFolder: path.join(__dirname, 'cypress/screenshots'),
    videosFolder: path.join(__dirname, 'cypress/videos'),

    // Viewport settings
    viewportWidth: 1280,
    viewportHeight: 720,

    // Video and screenshot settings
    video: false,
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
      ACTIVE_THEME: 'default',
      THEME_PATH: themeRoot,

      // @cypress/grep - filter specs by tags
      grepFilterSpecs: true,
      grepOmitFiltered: true,

      // Allure reporting - results generated automatically when allure-cypress is installed
      allureResultsPath: path.join(__dirname, 'cypress/allure-results'),
    },

    setupNodeEvents(on, config) {
      // ================================================
      // 1. Simplified tags syntax: --env tags="@smoke"
      //    Maps to grepTags for @cypress/grep
      // ================================================
      if (config.env.tags) {
        config.env.grepTags = config.env.tags
      }

      // ================================================
      // 2. @cypress/grep plugin for test filtering
      // ================================================
      require('@cypress/grep/src/plugin')(config)

      // ================================================
      // 3. Allure reporter (always register if available)
      //    The import in e2e.ts requires tasks to be registered
      // ================================================
      try {
        const { allureCypress } = require('allure-cypress/reporter')
        allureCypress(on, config, {
          resultsDir: config.env.allureResultsPath,
        })
      } catch (e) {
        // allure-cypress not installed - that's ok, tests will still run
      }

      // ================================================
      // 4. Webpack preprocessor for TypeScript
      //    Allows importing from @nextsparkjs/core
      // ================================================
      const webpackPreprocessor = require('@cypress/webpack-preprocessor')

      const options = {
        webpackOptions: {
          resolve: {
            extensions: ['.ts', '.tsx', '.js', '.jsx'],
          },
          module: {
            rules: [
              {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                options: {
                  transpileOnly: true,
                  // Allow ts-loader to process files from any location
                  allowTsInNodeModules: true,
                },
              },
            ],
          },
        },
      }

      on('file:preprocessor', webpackPreprocessor(options))

      return config
    },
  },
})
