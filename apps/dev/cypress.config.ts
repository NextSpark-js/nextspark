import { defineConfig } from 'cypress'
import path from 'path'
import dotenv from 'dotenv'

// Load environment variables from apps/dev/.env
dotenv.config({ path: path.resolve(__dirname, '.env') })

// Server port (from .env or default 3000)
const port = process.env.PORT || 3000

// Use active theme's tests (from themes/default or environment variable)
const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default'
const themeTestsPath = `../../themes/${activeTheme}/tests/cypress/e2e/**/*.cy.ts`

export default defineConfig({
  e2e: {
    baseUrl: `http://localhost:${port}`,

    // Tests from the active theme
    specPattern: [
      themeTestsPath,
    ],

    // Support file from the active theme
    supportFile: `../../themes/${activeTheme}/tests/cypress/support/e2e.ts`,

    // Fixtures from the active theme
    fixturesFolder: `../../themes/${activeTheme}/tests/cypress/fixtures`,

    // Output folders (keep in apps/dev for easy access)
    videosFolder: 'cypress/videos',
    screenshotsFolder: 'cypress/screenshots',

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

  // Component testing (optional - uses theme's component tests if available)
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack',
    },
    specPattern: `../../themes/${activeTheme}/tests/cypress/component/**/*.cy.tsx`,
  },
})
