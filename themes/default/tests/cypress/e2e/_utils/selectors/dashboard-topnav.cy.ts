/**
 * UI Selectors Validation: Dashboard Topnav
 *
 * This test validates that dashboard topnav selectors exist in the DOM.
 * This is a lightweight test that ONLY checks selector presence, not functionality.
 *
 * Purpose:
 * - Validate DashboardPOM topnav selectors work correctly
 * - Ensure all dashboard.topnav.* selectors are implemented
 * - Run as Phase 12 sub-gate before functional tests
 *
 * Scope:
 * - Navigate to dashboard (requires login)
 * - Assert elements exist in DOM (no form submissions)
 * - Fast execution (< 30 seconds per describe block)
 *
 * Test IDs:
 * - SEL_TNAV_001: Topnav Structure (3 selectors)
 * - SEL_TNAV_002: Topnav Actions (4 selectors)
 * - SEL_TNAV_003: Topnav Admin Links (2 selectors - developer has access)
 * - SEL_TNAV_004: User Menu (5 selectors)
 * - SEL_TNAV_006: Loading State (1 skipped - transient state)
 *
 * NOTE: Public navbar tests (logo, signin, signup) are in public.cy.ts
 */

import { DashboardPOM } from '../../../src/features/DashboardPOM'
import { loginAsDefaultDeveloper } from '../../../src/session-helpers'

describe('Dashboard Topnav Selectors Validation', { tags: ['@ui-selectors', '@topnav'] }, () => {
  const dashboard = DashboardPOM.create()

  beforeEach(() => {
    loginAsDefaultDeveloper()
    cy.visit('/dashboard', { timeout: 60000, failOnStatusCode: false })
    cy.url().should('include', '/dashboard')
  })

  // ============================================
  // SEL_TNAV_001: TOPNAV STRUCTURE (3 selectors)
  // NOTE: Logo test moved to public.cy.ts (only visible when not logged in)
  // ============================================
  describe('SEL_TNAV_001: Topnav Structure', { tags: '@SEL_TNAV_001' }, () => {
    it('should find topnav header', () => {
      cy.get(dashboard.selectors.topnavHeader).should('exist')
    })

    it('should find topnav actions container', () => {
      cy.get(dashboard.selectors.topnavActions).should('exist')
    })

    it('should find topnav search section', () => {
      cy.get(dashboard.selectors.topnavSearchSection).should('exist')
    })
  })

  // ============================================
  // SEL_TNAV_002: TOPNAV ACTIONS (4 selectors)
  // ============================================
  describe('SEL_TNAV_002: Topnav Actions', { tags: '@SEL_TNAV_002' }, () => {
    it('should find sidebar toggle button', () => {
      cy.get(dashboard.selectors.topnavSidebarToggle).should('exist')
    })

    it('should find notifications button', () => {
      cy.get(dashboard.selectors.topnavNotifications).should('exist')
    })

    it('should find help button', () => {
      cy.get(dashboard.selectors.topnavHelp).should('exist')
    })

    it('should find theme toggle button', () => {
      cy.get(dashboard.selectors.topnavThemeToggle).should('exist')
    })
  })

  // ============================================
  // SEL_TNAV_003: TOPNAV ADMIN LINKS (2 selectors)
  // NOTE: Developer user has access (showToDevelopers: true by default)
  // ============================================
  describe('SEL_TNAV_003: Topnav Admin Links', { tags: '@SEL_TNAV_003' }, () => {
    it('should find superadmin link (developer sees with showToDevelopers)', () => {
      // Config: superadminAccess.enabled && (isSuperAdmin || (isDeveloper && showToDevelopers))
      cy.get(dashboard.selectors.topnavSuperadmin).should('exist')
    })

    it('should find devtools link (developer role)', () => {
      // Config: devtoolsAccess.enabled && isDeveloper
      cy.get(dashboard.selectors.topnavDevtools).should('exist')
    })
  })

  // ============================================
  // SEL_TNAV_004: USER MENU (4+ selectors)
  // ============================================
  describe('SEL_TNAV_004: User Menu', { tags: '@SEL_TNAV_004' }, () => {
    it('should find user menu trigger', () => {
      cy.get(dashboard.selectors.topnavUserMenuTrigger).should('exist')
    })

    it('should find user menu when opened', () => {
      cy.get(dashboard.selectors.topnavUserMenuTrigger).click()
      cy.get(dashboard.selectors.topnavUserMenu).should('be.visible')
    })

    it('should find profile menu item when opened', () => {
      cy.get(dashboard.selectors.topnavUserMenuTrigger).click()
      cy.get(dashboard.selectors.topnavMenuItem('user')).should('exist')
    })

    it('should find settings menu item when opened', () => {
      cy.get(dashboard.selectors.topnavUserMenuTrigger).click()
      cy.get(dashboard.selectors.topnavMenuItem('settings')).should('exist')
    })

    it('should find signOut action when opened', () => {
      cy.get(dashboard.selectors.topnavUserMenuTrigger).click()
      // Action is 'signOut' per dashboard.config.ts
      cy.get(dashboard.selectors.topnavMenuAction('signOut')).should('exist')
    })
  })

  // ============================================
  // SEL_TNAV_006: LOADING STATE SELECTOR (1 selector)
  // NOTE: Only visible during auth loading - transient state
  // ============================================
  describe('SEL_TNAV_006: Loading State', { tags: '@SEL_TNAV_006' }, () => {
    it.skip('should find user loading state (only visible during auth loading)', () => {
      cy.get(dashboard.selectors.topnavUserLoading).should('exist')
    })
  })
})
