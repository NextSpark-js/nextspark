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

import { SuperadminPOM } from '../../../src/features/SuperadminPOM'
import { loginAsDefaultSuperadmin } from '../../../src/session-helpers'

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
      cy.get(superadmin.selectors.container).should('exist')
    })

    it('should find dashboard container', () => {
      cy.get(superadmin.selectors.dashboard.container).should('exist')
    })
  })

  // ============================================
  // SEL_SADM_002: SUPERADMIN NAVIGATION (SIDEBAR)
  // ============================================
  describe('SEL_SADM_002: Superadmin Navigation', { tags: '@SEL_SADM_002' }, () => {
    beforeEach(() => {
      loginAsDefaultSuperadmin()
      cy.visit('/superadmin', { timeout: 60000, failOnStatusCode: false })
      cy.url().should('include', '/superadmin')
    })

    it('should find nav dashboard link', () => {
      cy.get(superadmin.selectors.sidebar.nav.dashboard).should('exist')
    })

    it('should find nav users link', () => {
      cy.get(superadmin.selectors.sidebar.nav.users).should('exist')
    })

    it('should find nav teams link', () => {
      cy.get(superadmin.selectors.sidebar.nav.teams).should('exist')
    })

    it('should find nav team-roles link', () => {
      cy.get(superadmin.selectors.sidebar.nav.teamRoles).should('exist')
    })

    it('should find nav subscriptions link', () => {
      cy.get(superadmin.selectors.sidebar.nav.subscriptions).should('exist')
    })

    it('should find exit to dashboard link', () => {
      cy.get(superadmin.selectors.sidebar.exitButton).should('exist')
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
      cy.get(superadmin.selectors.users.container).should('exist')
    })

    it('should find users table', () => {
      cy.get(superadmin.selectors.users.table.element).should('exist')
    })

    it('should find users search input', () => {
      cy.get(superadmin.selectors.users.filters.search).should('exist')
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
      cy.get(superadmin.selectors.teams.container).should('exist')
    })

    it('should find teams table', () => {
      cy.get(superadmin.selectors.teams.table.element).should('exist')
    })

    it('should find teams search input', () => {
      cy.get(superadmin.selectors.teams.filters.search).should('exist')
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
      cy.get(superadmin.selectors.subscriptions.container).should('exist')
    })

    it('should find MRR stat', () => {
      cy.get(superadmin.selectors.subscriptions.stats.mrr).should('exist')
    })

    it('should find plan distribution section', () => {
      cy.get(superadmin.selectors.subscriptions.stats.planDistribution).should('exist')
    })

    it('should find active count stat', () => {
      cy.get(superadmin.selectors.subscriptions.stats.activeCount).should('exist')
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

    it('should have valid users.table.row selector pattern', () => {
      // Just verify the selector function returns a valid string
      const selector = superadmin.selectors.users.table.row('test-id')
      expect(selector).to.include('superadmin-users-row')
    })

    it('should have valid users.table.viewButton selector pattern', () => {
      const selector = superadmin.selectors.users.table.viewButton('test-id')
      expect(selector).to.include('superadmin-users-view')
    })

    it('should have valid teams.table.row selector pattern', () => {
      const selector = superadmin.selectors.teams.table.row('test-id')
      expect(selector).to.include('superadmin-teams-row')
    })

    it('should have valid subscriptions.stats.planCount selector pattern', () => {
      const selector = superadmin.selectors.subscriptions.stats.planCount('free')
      expect(selector).to.include('superadmin-subscriptions-plan')
    })
  })
})
