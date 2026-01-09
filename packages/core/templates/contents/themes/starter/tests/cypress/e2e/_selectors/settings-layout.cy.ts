/**
 * UI Selectors Validation: Settings Layout & Sidebar
 *
 * This test validates that settings layout and sidebar selectors exist in the DOM.
 * This is a lightweight test that ONLY checks selector presence, not functionality.
 *
 * Purpose:
 * - Validate SettingsPOM layout and sidebar selectors work correctly
 * - Ensure all settings.layout.* and settings.sidebar.* selectors are implemented
 * - Run as Phase 12 sub-gate before functional tests
 *
 * Scope:
 * - Navigate to settings pages (requires login)
 * - Assert elements exist in DOM (no form submissions)
 * - Fast execution (< 30 seconds per describe block)
 *
 * Test IDs:
 * - SEL_LAY_001: Layout Selectors
 * - SEL_LAY_002: Sidebar Selectors
 */

import { SettingsPOM } from '../../src/features/SettingsPOM'
import { loginAsDefaultDeveloper } from '../../src/session-helpers'

describe('Settings Layout Selectors Validation', { tags: ['@ui-selectors', '@settings'] }, () => {
  const settings = SettingsPOM.create()

  beforeEach(() => {
    loginAsDefaultDeveloper()
  })

  // ============================================
  // SEL_LAY_001: LAYOUT SELECTORS
  // ============================================
  describe('SEL_LAY_001: Layout Selectors', { tags: '@SEL_LAY_001' }, () => {
    beforeEach(() => {
      settings.visitSettings()
      settings.waitForSettings()
    })

    it('should find layout main container', () => {
      cy.get(settings.selectors.layoutMain).should('exist')
    })

    it('should find layout nav', () => {
      cy.get(settings.selectors.layoutNav).should('exist')
    })

    it('should find back to dashboard link', () => {
      cy.get(settings.selectors.layoutBackToDashboard).should('exist')
    })

    it('should find layout header', () => {
      cy.get(settings.selectors.layoutHeader).should('exist')
    })

    it('should find layout content area', () => {
      cy.get(settings.selectors.layoutContentArea).should('exist')
    })

    it('should find layout sidebar', () => {
      cy.get(settings.selectors.layoutSidebar).should('exist')
    })

    it('should find layout page content', () => {
      cy.get(settings.selectors.layoutPageContent).should('exist')
    })
  })

  // ============================================
  // SEL_LAY_002: SIDEBAR SELECTORS
  // ============================================
  describe('SEL_LAY_002: Sidebar Selectors', { tags: '@SEL_LAY_002' }, () => {
    beforeEach(() => {
      settings.visitSettings()
      settings.waitForSettings()
    })

    it('should find sidebar nav container', () => {
      cy.get(settings.selectors.navContainer).should('exist')
    })

    it('should find sidebar header', () => {
      cy.get(settings.selectors.sidebarHeader).should('exist')
    })

    it('should find sidebar nav items container', () => {
      cy.get(settings.selectors.sidebarNavItems).should('exist')
    })

    it('should find profile nav item', () => {
      cy.get(settings.selectors.navItem('profile')).should('exist')
    })

    it('should find security nav item', () => {
      cy.get(settings.selectors.navItem('security')).should('exist')
    })

    it('should find password nav item', () => {
      cy.get(settings.selectors.navItem('password')).should('exist')
    })

    it('should find notifications nav item', () => {
      cy.get(settings.selectors.navItem('notifications')).should('exist')
    })

    it('should find api-keys nav item', () => {
      cy.get(settings.selectors.navItem('api-keys')).should('exist')
    })

    it('should find billing nav item', () => {
      cy.get(settings.selectors.navItem('billing')).should('exist')
    })

    it('should find teams nav item', () => {
      cy.get(settings.selectors.navItem('teams')).should('exist')
    })

    it('should find plans nav item', () => {
      cy.get(settings.selectors.navItem('plans')).should('exist')
    })
  })
})
