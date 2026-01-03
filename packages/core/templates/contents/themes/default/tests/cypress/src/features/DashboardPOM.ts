/**
 * DashboardPOM - Page Object Model for Dashboard Navigation
 *
 * Handles dashboard shell navigation and access control:
 * - Sidebar navigation links (nav-link-entity-{slug})
 * - Entity page access verification
 * - Quick create menu
 * - Dashboard page access
 *
 * Uses selectors from centralized selectors.ts
 *
 * NOTE: For CRUD operations on entities, use entity-specific POMs:
 * - CustomersPOM, TasksPOM, etc. from entities/
 * - These extend DashboardEntityPOM for full CRUD support
 *
 * NOTE: For team switching, use TeamSwitcherPOM from components/
 */

import { BasePOM } from '../core/BasePOM'
import { cySelector } from '../selectors'

export class DashboardPOM extends BasePOM {
  // ============================================
  // FACTORY METHOD
  // ============================================

  static create(): DashboardPOM {
    return new DashboardPOM()
  }

  // ============================================
  // SELECTORS
  // ============================================

  get selectors() {
    return {
      // Navigation
      navMain: cySelector('dashboard.navigation.main'),
      navDashboard: cySelector('dashboard.navigation.dashboardLink'),
      navEntity: (slug: string) => cySelector('dashboard.navigation.entityLink', { slug }),
      navSection: (id: string) => cySelector('dashboard.navigation.section', { id }),
      navSectionLabel: (id: string) => cySelector('dashboard.navigation.sectionLabel', { id }),
      navSectionItem: (sectionId: string, itemId: string) => cySelector('dashboard.navigation.sectionItem', { sectionId, itemId }),

      // Shell
      shellContainer: cySelector('dashboard.shell.container'),
      sidebarToggle: cySelector('dashboard.shell.sidebarToggle'),
      quickCreateButton: cySelector('dashboard.shell.quickCreateButton'),
      quickCreateDropdown: cySelector('dashboard.shell.quickCreateDropdown'),
      quickCreateLink: (slug: string) => cySelector('dashboard.shell.quickCreateLink', { slug }),

      // Topnav
      topnavSidebarToggle: cySelector('dashboard.topnav.sidebarToggle'),
      topnavHeader: cySelector('dashboard.topnav.header'),
      topnavLogo: cySelector('dashboard.topnav.logo'),
      topnavSearchSection: cySelector('dashboard.topnav.searchSection'),
      topnavActions: cySelector('dashboard.topnav.actions'),
      topnavNotifications: cySelector('dashboard.topnav.notifications'),
      topnavHelp: cySelector('dashboard.topnav.help'),
      topnavThemeToggle: cySelector('dashboard.topnav.themeToggle'),
      topnavAdmin: cySelector('dashboard.topnav.admin'),
      topnavDevzone: cySelector('dashboard.topnav.devzone'),
      topnavUserMenuTrigger: cySelector('dashboard.topnav.userMenuTrigger'),
      topnavUserMenu: cySelector('dashboard.topnav.userMenu'),
      topnavMenuItem: (icon: string) => cySelector('dashboard.topnav.menuItem', { icon }),
      topnavMenuAction: (action: string) => cySelector('dashboard.topnav.menuAction', { action }),
      topnavUserLoading: cySelector('dashboard.topnav.userLoading'),
      topnavSignin: cySelector('dashboard.topnav.signin'),
      topnavSignup: cySelector('dashboard.topnav.signup'),

      // Sidebar
      sidebarMain: cySelector('dashboard.sidebar.main'),
      sidebarHeader: cySelector('dashboard.sidebar.header'),
      sidebarContent: cySelector('dashboard.sidebar.content'),
      sidebarFooter: cySelector('dashboard.sidebar.footer'),

      // Mobile Topbar
      mobileTopbarHeader: cySelector('dashboard.mobile.topbar.header'),
      mobileTopbarUserProfile: cySelector('dashboard.mobile.topbar.userProfile'),
      mobileTopbarNotifications: cySelector('dashboard.mobile.topbar.notifications'),
      mobileTopbarThemeToggle: cySelector('dashboard.mobile.topbar.themeToggle'),

      // Mobile Bottom Nav
      mobileBottomNav: cySelector('dashboard.mobile.bottomNav.nav'),
      mobileBottomNavItem: (id: string) => cySelector('dashboard.mobile.bottomNav.item', { id }),

      // Mobile More Sheet
      mobileMoreSheetContent: cySelector('dashboard.mobile.moreSheet.content'),
      mobileMoreSheetItem: (id: string) => cySelector('dashboard.mobile.moreSheet.item', { id }),
      mobileMoreSheetAdmin: cySelector('dashboard.mobile.moreSheet.adminLink'),
      mobileMoreSheetTeamSwitcher: cySelector('dashboard.mobile.moreSheet.teamSwitcher'),
      mobileMoreSheetSignout: cySelector('dashboard.mobile.moreSheet.signoutButton'),

      // Mobile Quick Create
      mobileQuickCreateContent: cySelector('dashboard.mobile.quickCreateSheet.content'),
      mobileQuickCreateItem: (slug: string) => cySelector('dashboard.mobile.quickCreateSheet.item', { slug }),

      // Entity table (for verifying entity pages)
      entityPage: (slug: string) => cySelector('entities.page.container', { slug }),
      entityTable: (slug: string) => cySelector('entities.table.container', { slug }),
      entityAddButton: (slug: string) => cySelector('entities.table.addButton', { slug }),
    }
  }

  // ============================================
  // NAVIGATION
  // ============================================

  /**
   * Navigate to main dashboard
   */
  visitDashboard() {
    cy.visit('/dashboard', { timeout: 60000 })
    return this
  }

  /**
   * Navigate to an entity page
   */
  visitEntity(slug: string) {
    cy.visit(`/dashboard/${slug}`, { timeout: 60000 })
    return this
  }

  /**
   * Navigate to entity via sidebar link
   */
  clickEntityNav(slug: string) {
    cy.get(this.selectors.navEntity(slug)).click()
    return this
  }

  /**
   * Navigate to dashboard via sidebar link
   */
  clickDashboardNav() {
    cy.get(this.selectors.navDashboard).click()
    return this
  }

  // ============================================
  // QUICK CREATE
  // ============================================

  /**
   * Open quick create dropdown
   */
  openQuickCreate() {
    cy.get(this.selectors.quickCreateButton).click()
    return this
  }

  /**
   * Click quick create link for an entity
   */
  quickCreate(slug: string) {
    this.openQuickCreate()
    cy.get(this.selectors.quickCreateLink(slug)).click()
    return this
  }

  // ============================================
  // ASSERTIONS
  // ============================================

  /**
   * Assert dashboard page is visible
   */
  assertDashboardVisible() {
    cy.url().should('include', '/dashboard')
    return this
  }

  /**
   * Assert entity nav link is visible
   */
  assertEntityNavVisible(slug: string) {
    cy.get(this.selectors.navEntity(slug)).should('be.visible')
    return this
  }

  /**
   * Assert entity nav link is NOT visible (restricted access)
   */
  assertEntityNavNotVisible(slug: string) {
    cy.get(this.selectors.navEntity(slug)).should('not.exist')
    return this
  }

  /**
   * Assert entity page is accessible (table container visible)
   */
  assertEntityPageVisible(slug: string) {
    cy.get(this.selectors.entityTable(slug)).should('be.visible')
    return this
  }

  /**
   * Assert entity add button is visible (create permission)
   */
  assertEntityAddButtonVisible(slug: string) {
    cy.get(this.selectors.entityAddButton(slug)).should('be.visible')
    return this
  }

  /**
   * Assert entity add button is NOT visible (no create permission)
   */
  assertEntityAddButtonNotVisible(slug: string) {
    cy.get(this.selectors.entityAddButton(slug)).should('not.exist')
    return this
  }

  /**
   * Assert quick create button is visible
   */
  assertQuickCreateVisible() {
    cy.get(this.selectors.quickCreateButton).should('be.visible')
    return this
  }

  // ============================================
  // WAITS
  // ============================================

  /**
   * Wait for dashboard to be fully loaded
   */
  waitForDashboard() {
    cy.url().should('include', '/dashboard')
    cy.get(this.selectors.navMain, { timeout: 15000 }).should('be.visible')
    return this
  }

  /**
   * Wait for entity page to be loaded
   */
  waitForEntityPage(slug: string) {
    cy.url().should('include', `/dashboard/${slug}`)
    cy.get(this.selectors.entityTable(slug), { timeout: 15000 }).should('be.visible')
    return this
  }
}

export default DashboardPOM
