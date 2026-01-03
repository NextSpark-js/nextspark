/**
 * Cypress Type Extensions
 *
 * Extends Cypress types to support @cypress/grep tags functionality.
 * This file must be in the root for IDE type checking of test files.
 */

/// <reference types="cypress" />

declare namespace Cypress {
  // @cypress/grep - extend SuiteConfigOverrides to support tags
  interface SuiteConfigOverrides {
    tags?: string | string[];
  }

  interface TestConfigOverrides {
    tags?: string | string[];
  }
}
