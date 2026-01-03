// Core support (commands, POMs)
import '@nextsparkjs/core/cypress-support'
import './commands'

// @cypress/grep for test filtering by tags
import registerCypressGrep from '@cypress/grep'
registerCypressGrep()

// Allure reporter - Always import (the plugin in cypress.config.ts controls activation)
// This import is required for allure to capture test events
import 'allure-cypress'

// Exception handlers
Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('Hydration')) return false
  if (err.message.includes('ResizeObserver')) return false
  return true
})
