/**
 * UI Selectors Validation: Dashboard Container
 *
 * This test validates that the dashboard container selector exists in the DOM.
 * This is a lightweight test that ONLY checks selector presence, not functionality.
 *
 * Purpose:
 * - Validate DashboardPOM container selector works correctly
 * - Ensure dashboard.container selector is implemented
 * - Run as Phase 12 sub-gate before functional tests
 *
 * Scope:
 * - Navigate to dashboard (requires login)
 * - Assert main container exists in DOM
 * - Fast execution (< 10 seconds)
 *
 * Test IDs:
 * - SEL_DCNT_001: Dashboard Container Structure (1 selector)
 *
 * Component: DashboardShell.tsx
 * Selector: dashboard.container → 'dashboard-container'
 */

import { DashboardPOM } from '../../../src/features/DashboardPOM'
import { loginAsDefaultDeveloper } from '../../../src/session-helpers'

describe('Dashboard Container Selectors Validation', { tags: ['@ui-selectors', '@dashboard', '@container'] }, () => {
  const dashboard = DashboardPOM.create()

  beforeEach(() => {
    loginAsDefaultDeveloper()
    cy.visit('/dashboard', { timeout: 60000, failOnStatusCode: false })
    cy.url().should('include', '/dashboard')
  })

  // ============================================
  // SEL_DCNT_001: DASHBOARD CONTAINER (1 selector)
  // ============================================
  describe('SEL_DCNT_001: Dashboard Container', { tags: '@SEL_DCNT_001' }, () => {
    it('should find dashboard main container', () => {
      cy.get(dashboard.selectors.container).should('exist')
    })

    it('should have dashboard container visible', () => {
      cy.get(dashboard.selectors.container).should('be.visible')
    })

    it('should have correct data-cy attribute value', () => {
      cy.get('[data-cy="dashboard-container"]').should('exist')
    })
  })
})
