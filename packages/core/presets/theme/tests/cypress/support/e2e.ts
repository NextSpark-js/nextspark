/**
 * Cypress E2E Support File
 *
 * This file is loaded automatically before test files.
 * Use it to load plugins, add global hooks, and import commands.
 */

// Import custom commands
import './commands'

// Import documentation commands (optional - for demo videos)
// import './doc-commands'

// Disable uncaught exception handling to prevent test failures
// from application errors that don't affect test assertions
Cypress.on('uncaught:exception', (err) => {
  // Returning false here prevents Cypress from failing the test
  // You may want to be more selective about which errors to ignore
  console.error('Uncaught exception:', err.message)
  return false
})
