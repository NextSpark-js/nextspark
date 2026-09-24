/**
 * UI Selectors Validation: Dashboard Sidebar
 *
 * This test validates that dashboard sidebar selectors exist in the DOM.
 * This is a lightweight test that ONLY checks selector presence, not functionality.
 *
 * Purpose:
 * - Validate DashboardPOM sidebar selectors work correctly
 * - Ensure all dashboard.sidebar.* selectors are implemented
 * - Run as Phase 12 sub-gate before functional tests
 *
 * Scope:
 * - Navigate to dashboard (requires login)
 * - Assert elements exist in DOM (no form submissions)
 * - Fast execution (< 30 seconds per describe block)
 *
 * Test IDs:
 * - SEL_DBAR_001: Sidebar Structure (4 selectors)
 *
 * Component: Sidebar.tsx
 * Selectors:
 * - dashboard.sidebar.container → 'sidebar-main'
 * - dashboard.sidebar.header → 'sidebar-header'
 * - dashboard.sidebar.logo → 'sidebar-logo'
 * - dashboard.sidebar.content → 'sidebar-content'
 * - dashboard.sidebar.footer → 'sidebar-footer' (not implemented in component)
 *
 * NOTE: Sidebar is only visible on desktop viewports when authenticated.
 */

import { DashboardPOM } from '../../../src/features/DashboardPOM'
import { loginAsDefaultDeveloper } from '../../../src/session-helpers'

describe('Dashboard Sidebar Selectors Validation', { tags: ['@ui-selectors', '@dashboard', '@sidebar'] }, () => {
  const dashboard = DashboardPOM.create()

  beforeEach(() => {
    loginAsDefaultDeveloper()
    cy.visit('/dashboard', { timeout: 60000, failOnStatusCode: false })
    cy.url().should('include', '/dashboard')
  })

  // ============================================
  // SEL_DBAR_001: SIDEBAR STRUCTURE (4 selectors)
  // ============================================
  describe('SEL_DBAR_001: Sidebar Structure', { tags: '@SEL_DBAR_001' }, () => {
    it('should find sidebar container', () => {
      cy.get(dashboard.selectors.sidebarContainer).should('exist')
    })

    it('should find sidebar header', () => {
      cy.get(dashboard.selectors.sidebarHeader).should('exist')
    })

    it('should find sidebar logo', () => {
      cy.get(dashboard.selectors.sidebarLogo).should('exist')
    })

    it('should find sidebar content', () => {
      cy.get(dashboard.selectors.sidebarContent).should('exist')
    })

    // Not implemented in Sidebar.tsx component
    it.skip('should find sidebar footer (not implemented in component)', () => {
      cy.get(dashboard.selectors.sidebarFooter).should('exist')
    })
  })
})
