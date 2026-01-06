/**
 * UI Selectors Validation: DevTools (DevTools)
 *
 * This test validates that devtools selectors exist in the DOM.
 * This is a lightweight test that ONLY checks selector presence, not functionality.
 *
 * Purpose:
 * - Validate DevtoolsPOM selectors work correctly
 * - Ensure all dev.* selectors are implemented
 * - Run as Phase 12 sub-gate before functional tests
 *
 * Scope:
 * - Navigate to /devtools pages (requires developer role)
 * - Assert elements exist in DOM (no form submissions)
 * - Fast execution (< 30 seconds per describe block)
 *
 * IMPORTANT: DevTools is only accessible to users with 'developer' app role.
 */

import { DevtoolsPOM } from '../../src/features/DevtoolsPOM'
import { loginAsDefaultDeveloper } from '../../src/session-helpers'

describe('DevTools Selectors Validation', { tags: ['@ui-selectors'] }, () => {
  const dev = DevtoolsPOM.create()

  beforeEach(() => {
    loginAsDefaultDeveloper()
  })

  // ============================================
  // NAVIGATION STRUCTURE (8 selectors)
  // ============================================
  describe('Navigation Structure', () => {
    beforeEach(() => {
      cy.visit('/devtools', { timeout: 60000, failOnStatusCode: false })
      cy.url().should('include', '/devtools')
    })

    it('should find sidebar container', () => {
      cy.get(dev.selectors.sidebar).should('exist')
    })

    it('should find sidebar collapse toggle', () => {
      cy.get(dev.selectors.sidebarCollapseToggle).should('exist')
    })

    it('should find nav home item', () => {
      cy.get(dev.selectors.navHome).should('exist')
    })

    it('should find nav style gallery item', () => {
      cy.get(dev.selectors.navStyleGallery).should('exist')
    })

    it('should find nav test cases item', () => {
      cy.get(dev.selectors.navTestCases).should('exist')
    })

    it('should find nav config item', () => {
      cy.get(dev.selectors.navConfig).should('exist')
    })

    it('should find exit to dashboard link', () => {
      cy.get(dev.selectors.exitToDashboard).should('exist')
    })

    it('should find go to admin link', () => {
      cy.get(dev.selectors.goToAdmin).should('exist')
    })
  })

  // ============================================
  // HOME PAGE (4 selectors)
  // ============================================
  describe('Home Page', () => {
    beforeEach(() => {
      cy.visit('/devtools', { timeout: 60000, failOnStatusCode: false })
      cy.url().should('include', '/devtools')
    })

    it('should find home page container', () => {
      cy.get(dev.selectors.homePage).should('exist')
    })

    it('should find style gallery quick link', () => {
      cy.get(dev.selectors.homeStyleLink).should('exist')
    })

    it('should find tests quick link', () => {
      cy.get(dev.selectors.homeTestsLink).should('exist')
    })

    it('should find config quick link', () => {
      cy.get(dev.selectors.homeConfigLink).should('exist')
    })
  })

  // ============================================
  // STYLE GALLERY PAGE (8 selectors)
  // ============================================
  describe('Style Gallery Page', () => {
    beforeEach(() => {
      cy.visit('/devtools/style', { timeout: 60000, failOnStatusCode: false })
      cy.url().should('include', '/devtools/style')
    })

    it('should find style page container', () => {
      cy.get(dev.selectors.stylePage).should('exist')
    })

    it('should find components tab', () => {
      cy.get(dev.selectors.styleTabComponents).should('exist')
    })

    it('should find field types tab', () => {
      cy.get(dev.selectors.styleTabFieldTypes).should('exist')
    })

    it('should find theme tab', () => {
      cy.get(dev.selectors.styleTabTheme).should('exist')
    })

    it('should find guidelines tab', () => {
      cy.get(dev.selectors.styleTabGuidelines).should('exist')
    })

    it('should find component gallery (default tab content)', () => {
      cy.get(dev.selectors.styleComponentGallery).should('exist')
    })

    it('should find field types content when tab clicked', () => {
      cy.get(dev.selectors.styleTabFieldTypes).click()
      cy.get(dev.selectors.styleFieldTypes).should('exist')
    })

    it('should find theme preview when tab clicked', () => {
      cy.get(dev.selectors.styleTabTheme).click()
      cy.get(dev.selectors.styleThemePreview).should('exist')
    })
  })

  // ============================================
  // CONFIG VIEWER PAGE (8 selectors)
  // ============================================
  describe('Config Viewer Page', () => {
    beforeEach(() => {
      cy.visit('/devtools/config', { timeout: 60000, failOnStatusCode: false })
      cy.url().should('include', '/devtools/config')
    })

    it('should find config page container', () => {
      cy.get(dev.selectors.configPage).should('exist')
    })

    it('should find config viewer container', () => {
      cy.get(dev.selectors.configViewer).should('exist')
    })

    it('should find theme tab', () => {
      cy.get(dev.selectors.configTabTheme).should('exist')
    })

    it('should find entities tab', () => {
      cy.get(dev.selectors.configTabEntities).should('exist')
    })

    it('should find theme content (default tab)', () => {
      cy.get(dev.selectors.configThemeContent).should('exist')
    })

    it('should find entities content when tab clicked', () => {
      cy.get(dev.selectors.configTabEntities).click()
      cy.get(dev.selectors.configEntitiesContent).should('exist')
    })

    it('should find copy theme button', () => {
      cy.get(dev.selectors.configCopyTheme).should('exist')
    })

    it('should find copy entities button when on entities tab', () => {
      cy.get(dev.selectors.configTabEntities).click()
      // Wait for entities to load before checking button
      cy.get(dev.selectors.configEntitiesContent, { timeout: 10000 }).should('exist')
      cy.get(dev.selectors.configCopyEntities).should('exist')
    })
  })

  // ============================================
  // TEST CASES PAGE (3 selectors)
  // NOTE: Conditional states (loading, empty, error) removed - not testable in selector validation
  // ============================================
  describe('Test Cases Page', () => {
    beforeEach(() => {
      cy.visit('/devtools/tests', { timeout: 60000, failOnStatusCode: false })
      cy.url().should('include', '/devtools/tests')
    })

    it('should find tests page container', () => {
      cy.get(dev.selectors.testsPage).should('exist')
    })

    it('should find tests viewer container', () => {
      cy.get(dev.selectors.testsViewer).should('exist')
    })

    it('should find tests tree', () => {
      cy.get(dev.selectors.testsTree).should('exist')
    })
  })
})
