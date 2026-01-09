/**
 * UI Selectors Validation: Superadmin (Superadmin Area)
 *
 * This test validates that Superadmin selectors exist in the DOM.
 * This is a lightweight test that ONLY checks selector presence, not functionality.
 *
 * Purpose:
 * - Validate SuperadminPOM selectors work correctly
 * - Ensure all superadmin.* selectors are implemented
 * - Run as Phase 12 sub-gate before functional tests
 *
 * Scope:
 * - Navigate to superadmin pages (requires superadmin login)
 * - Assert elements exist in DOM (no form submissions)
 * - Fast execution (< 30 seconds per describe block)
 *
 * Test IDs:
 * - SEL_SADM_001: Superadmin Dashboard Selectors
 * - SEL_SADM_002: Superadmin Navigation Selectors
 * - SEL_SADM_003: Superadmin Users Page Selectors
 * - SEL_SADM_004: Superadmin Teams Page Selectors
 * - SEL_SADM_005: Superadmin Subscriptions Page Selectors
 * - SEL_SADM_006: Dynamic Selectors (Pattern Validation)
 *
 * NOTE: Requires superadmin role to access /superadmin/* pages.
 */

import { SuperadminPOM } from '../../src/features/SuperadminPOM'
import { loginAsDefaultSuperadmin } from '../../src/session-helpers'

describe('Superadmin Selectors Validation', { tags: ['@ui-selectors', '@superadmin'] }, () => {
  const superadmin = SuperadminPOM.create()

  // ============================================
  // SEL_SADM_001: SUPERADMIN DASHBOARD
  // ============================================
  describe('SEL_SADM_001: Superadmin Dashboard', { tags: '@SEL_SADM_001' }, () => {
    beforeEach(() => {
      loginAsDefaultSuperadmin()
      cy.visit('/superadmin', { timeout: 60000, failOnStatusCode: false })
      cy.url().should('include', '/superadmin')
    })

    it('should find superadmin container', () => {
      cy.get(superadmin.selectors.navContainer).should('exist')
    })

    it('should find dashboard container', () => {
      cy.get(superadmin.selectors.dashboardContainer).should('exist')
    })
  })

  // ============================================
  // SEL_SADM_002: SUPERADMIN NAVIGATION
  // ============================================
  describe('SEL_SADM_002: Superadmin Navigation', { tags: '@SEL_SADM_002' }, () => {
    beforeEach(() => {
      loginAsDefaultSuperadmin()
      cy.visit('/superadmin', { timeout: 60000, failOnStatusCode: false })
      cy.url().should('include', '/superadmin')
    })

    it('should find nav dashboard link', () => {
      cy.get(superadmin.selectors.navDashboard).should('exist')
    })

    it('should find nav users link', () => {
      cy.get(superadmin.selectors.navUsers).should('exist')
    })

    it('should find nav teams link', () => {
      cy.get(superadmin.selectors.navTeams).should('exist')
    })

    it('should find nav team-roles link', () => {
      cy.get(superadmin.selectors.navTeamRoles).should('exist')
    })

    it('should find nav subscriptions link', () => {
      cy.get(superadmin.selectors.navSubscriptions).should('exist')
    })

    it('should find exit to dashboard link', () => {
      cy.get(superadmin.selectors.exitToDashboard).should('exist')
    })
  })

  // ============================================
  // SEL_SADM_003: SUPERADMIN USERS PAGE
  // ============================================
  describe('SEL_SADM_003: Superadmin Users Page', { tags: '@SEL_SADM_003' }, () => {
    beforeEach(() => {
      loginAsDefaultSuperadmin()
      cy.visit('/superadmin/users', { timeout: 60000, failOnStatusCode: false })
      cy.url().should('include', '/superadmin/users')
    })

    it('should find users container', () => {
      cy.get(superadmin.selectors.usersContainer).should('exist')
    })

    it('should find users table', () => {
      cy.get(superadmin.selectors.usersTable).should('exist')
    })

    it('should find users search input', () => {
      cy.get(superadmin.selectors.usersSearch).should('exist')
    })
  })

  // ============================================
  // SEL_SADM_004: SUPERADMIN TEAMS PAGE
  // ============================================
  describe('SEL_SADM_004: Superadmin Teams Page', { tags: '@SEL_SADM_004' }, () => {
    beforeEach(() => {
      loginAsDefaultSuperadmin()
      cy.visit('/superadmin/teams', { timeout: 60000, failOnStatusCode: false })
      cy.url().should('include', '/superadmin/teams')
    })

    it('should find teams container', () => {
      cy.get(superadmin.selectors.teamsContainer).should('exist')
    })

    it('should find teams table', () => {
      cy.get(superadmin.selectors.teamsTable).should('exist')
    })

    it('should find teams search input', () => {
      cy.get(superadmin.selectors.teamsSearch).should('exist')
    })
  })

  // ============================================
  // SEL_SADM_005: SUPERADMIN SUBSCRIPTIONS PAGE
  // ============================================
  describe('SEL_SADM_005: Superadmin Subscriptions Page', { tags: '@SEL_SADM_005' }, () => {
    beforeEach(() => {
      loginAsDefaultSuperadmin()
      cy.visit('/superadmin/subscriptions', { timeout: 60000, failOnStatusCode: false })
      cy.url().should('include', '/superadmin/subscriptions')
    })

    it('should find subscriptions container', () => {
      cy.get(superadmin.selectors.subscriptionsContainer).should('exist')
    })

    it('should find MRR stat', () => {
      cy.get(superadmin.selectors.subscriptionsMrr).should('exist')
    })

    it('should find plan distribution section', () => {
      cy.get(superadmin.selectors.subscriptionsPlanDistribution).should('exist')
    })

    it('should find active count stat', () => {
      cy.get(superadmin.selectors.subscriptionsActiveCount).should('exist')
    })
  })

  // ============================================
  // SEL_SADM_006: DYNAMIC SELECTORS (PATTERN VALIDATION)
  // These test the selector pattern, not actual elements
  // ============================================
  describe('SEL_SADM_006: Dynamic Selectors (Pattern Validation)', { tags: '@SEL_SADM_006' }, () => {
    beforeEach(() => {
      loginAsDefaultSuperadmin()
      cy.visit('/superadmin/users', { timeout: 60000, failOnStatusCode: false })
      cy.url().should('include', '/superadmin/users')
    })

    it('should have valid userRow selector pattern', () => {
      // Just verify the selector function returns a valid string
      const selector = superadmin.selectors.userRow('test-id')
      expect(selector).to.include('superadmin-user-row')
    })

    it('should have valid userView selector pattern', () => {
      const selector = superadmin.selectors.userView('test-id')
      expect(selector).to.include('superadmin-user-view')
    })

    it('should have valid teamRow selector pattern', () => {
      const selector = superadmin.selectors.teamRow('test-id')
      expect(selector).to.include('superadmin-team-row')
    })

    it('should have valid subscriptionsPlanCount selector pattern', () => {
      const selector = superadmin.selectors.subscriptionsPlanCount('free')
      expect(selector).to.include('superadmin-subscriptions-plan-count')
    })
  })
})
