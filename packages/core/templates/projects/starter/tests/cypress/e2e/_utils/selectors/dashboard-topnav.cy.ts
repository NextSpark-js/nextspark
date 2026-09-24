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
 * - SEL_TNAV_005: Quick Create (3 selectors)
 * - SEL_TNAV_006: Loading State (1 skipped - transient state)
 * - SEL_TNAV_007: Settings Menu (3 selectors)
 *
 * NOTE: Public navbar tests (logo, signin, signup) are in public.cy.ts
 */

import { DashboardPOM } from '../../../src/features/DashboardPOM'
import { loginAsDefaultDeveloper } from '../../../src/session-helpers'

describe('Dashboard Topnav Selectors Validation', { tags: ['@ui-selectors', '@dashboard', '@topnav'] }, () => {
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
    it('should find topnav container', () => {
      cy.get(dashboard.selectors.topnavContainer).should('exist')
    })

    it('should find topnav actions container', () => {
      cy.get(dashboard.selectors.topnavActions).should('exist')
    })

    it('should find topnav search container', () => {
      cy.get(dashboard.selectors.topnavSearchContainer).should('exist')
    })
  })

  // ============================================
  // SEL_TNAV_002: TOPNAV ACTIONS (4 selectors)
  // ============================================
  describe('SEL_TNAV_002: Topnav Actions', { tags: '@SEL_TNAV_002' }, () => {
    it('should find sidebar toggle button', () => {
      cy.get(dashboard.selectors.topnavSidebarToggle).should('exist')
    })

    it('should find notifications trigger', () => {
      cy.get(dashboard.selectors.topnavNotificationsTrigger).should('exist')
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

    it('should find user menu content when opened', () => {
      cy.get(dashboard.selectors.topnavUserMenuTrigger).click()
      cy.get(dashboard.selectors.topnavUserMenuContent).should('be.visible')
    })

    it('should find profile menu item when opened', () => {
      cy.get(dashboard.selectors.topnavUserMenuTrigger).click()
      cy.get(dashboard.selectors.topnavUserMenuItem('user')).should('exist')
    })

    it('should find settings menu item when opened', () => {
      cy.get(dashboard.selectors.topnavUserMenuTrigger).click()
      cy.get(dashboard.selectors.topnavUserMenuItem('settings')).should('exist')
    })

    it('should find signOut action when opened', () => {
      cy.get(dashboard.selectors.topnavUserMenuTrigger).click()
      // Action is 'signOut' per dashboard.config.ts
      cy.get(dashboard.selectors.topnavUserMenuAction('signOut')).should('exist')
    })
  })

  // ============================================
  // SEL_TNAV_005: QUICK CREATE (3 selectors)
  // NOTE: Component renders null if user has no create permissions on any entity.
  // Developer role may not have quickCreate entities configured.
  // ============================================
  describe('SEL_TNAV_005: Quick Create', { tags: '@SEL_TNAV_005' }, () => {
    it.skip('should find quick create trigger (requires entity with create permission)', () => {
      cy.get(dashboard.selectors.topnavQuickCreateTrigger).should('exist')
    })

    it.skip('should find quick create content when opened (requires entity with create permission)', () => {
      cy.get(dashboard.selectors.topnavQuickCreateTrigger).click()
      cy.get(dashboard.selectors.topnavQuickCreateContent).should('be.visible')
    })

    it.skip('should find quick create link for entity when opened (requires entity with create permission)', () => {
      cy.get(dashboard.selectors.topnavQuickCreateTrigger).click()
      // Test with 'customers' entity (common in default theme)
      cy.get(dashboard.selectors.topnavQuickCreateLink('customers')).should('exist')
    })
  })

  // ============================================
  // SEL_TNAV_006: LOADING STATE SELECTOR (1 selector)
  // NOTE: Only visible during auth loading - transient state
  // ============================================
  describe('SEL_TNAV_006: Loading State', { tags: '@SEL_TNAV_006' }, () => {
    it.skip('SEL_TNAV_006_01: should find user loading state (only visible during auth loading)', { tags: '@SEL_TNAV_006_01' }, () => {
      cy.get(dashboard.selectors.topnavUserLoading).should('exist')
    })
  })

  // ============================================
  // SEL_TNAV_007: SETTINGS MENU (3 selectors)
  // NOTE: settingsMenu must be enabled in theme config
  // ============================================
  describe('SEL_TNAV_007: Settings Menu', { tags: '@SEL_TNAV_007' }, () => {
    it('SEL_TNAV_007_01: should find settings menu trigger', { tags: '@SEL_TNAV_007_01' }, () => {
      cy.get(dashboard.selectors.topnavSettingsMenuTrigger).should('exist')
    })

    it('SEL_TNAV_007_02: should find settings menu content when opened', { tags: '@SEL_TNAV_007_02' }, () => {
      cy.get(dashboard.selectors.topnavSettingsMenuTrigger).click()
      cy.get(dashboard.selectors.topnavSettingsMenuContent).should('be.visible')
    })

    it('SEL_TNAV_007_03: should find settings menu link when opened', { tags: '@SEL_TNAV_007_03' }, () => {
      cy.get(dashboard.selectors.topnavSettingsMenuTrigger).click()
      cy.get(dashboard.selectors.topnavSettingsMenuLink(0)).should('exist')
    })
  })
})
