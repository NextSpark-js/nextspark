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
 * NOTE: Some selectors require specific states (user menu open, specific roles).
 * signin/signup selectors only visible when NOT logged in.
 */

import { DashboardPOM } from '../../src/features/DashboardPOM'
import { loginAsDefaultOwner } from '../../src/session-helpers'

describe('Dashboard Topnav Selectors Validation', { tags: ['@ui-selectors'] }, () => {
  const dashboard = DashboardPOM.create()

  beforeEach(() => {
    loginAsDefaultOwner()
    cy.visit('/dashboard', { timeout: 60000, failOnStatusCode: false })
    cy.url().should('include', '/dashboard')
  })

  // ============================================
  // TOPNAV STRUCTURE (4 selectors)
  // ============================================
  describe('Topnav Structure', () => {
    it('should find topnav header', () => {
      cy.get(dashboard.selectors.topnavHeader).should('exist')
    })

    // NOTE: Logo only visible when NOT logged in
    it.skip('should find topnav logo (only visible when not logged in)', () => {
      cy.get(dashboard.selectors.topnavLogo).should('exist')
    })

    it('should find topnav actions container', () => {
      cy.get(dashboard.selectors.topnavActions).should('exist')
    })

    it('should find topnav search section', () => {
      cy.get(dashboard.selectors.topnavSearchSection).should('exist')
    })
  })

  // ============================================
  // TOPNAV ACTIONS (4 selectors)
  // ============================================
  describe('Topnav Actions', () => {
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
  // TOPNAV ADMIN LINKS (2 selectors)
  // NOTE: Requires superadmin (sector7) or developer role (devzone)
  // Default owner does NOT have these roles
  // ============================================
  describe('Topnav Admin Links', () => {
    it.skip('should find sector7 link (requires superadmin or developer with sector7 enabled)', () => {
      // Requires: sector7Config?.enabled && (isSuperAdmin || (isDeveloper && sector7Config?.showToDevelopers))
      cy.get(dashboard.selectors.topnavSuperadmin).should('exist')
    })

    it.skip('should find devzone link (requires developer role)', () => {
      // Requires: devZoneConfig?.enabled && isDeveloper
      cy.get(dashboard.selectors.topnavDevzone).should('exist')
    })
  })

  // ============================================
  // USER MENU (4+ selectors)
  // ============================================
  describe('User Menu', () => {
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
  // PUBLIC NAVBAR SELECTORS (2 selectors)
  // NOTE: Only visible when NOT logged in - skip for logged-in tests
  // ============================================
  describe('Public Navbar Selectors', () => {
    it.skip('should find signin button (only visible when not logged in)', () => {
      cy.get(dashboard.selectors.topnavSignin).should('exist')
    })

    it.skip('should find signup button (only visible when not logged in)', () => {
      cy.get(dashboard.selectors.topnavSignup).should('exist')
    })
  })

  // ============================================
  // LOADING STATE SELECTOR (1 selector)
  // NOTE: Only visible during auth loading
  // ============================================
  describe('Loading State Selectors', () => {
    it.skip('should find user loading state (only visible during auth loading)', () => {
      cy.get(dashboard.selectors.topnavUserLoading).should('exist')
    })
  })
})
