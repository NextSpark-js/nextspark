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
      // Main container
      container: cySelector('dashboard.container'),

      // Navigation
      navContainer: cySelector('dashboard.navigation.container'),
      navDashboard: cySelector('dashboard.navigation.dashboardLink'),
      navEntity: (slug: string) => cySelector('dashboard.navigation.entityLink', { slug }),
      navSection: (id: string) => cySelector('dashboard.navigation.section', { id }),
      navSectionLabel: (id: string) => cySelector('dashboard.navigation.sectionLabel', { id }),
      navSectionItem: (sectionId: string, itemId: string) => cySelector('dashboard.navigation.sectionItem', { sectionId, itemId }),

      // Topnav
      topnavContainer: cySelector('dashboard.topnav.container'),
      topnavSidebarToggle: cySelector('dashboard.topnav.sidebarToggle'),
      topnavLogo: cySelector('dashboard.topnav.logo'),
      topnavSearchContainer: cySelector('dashboard.topnav.search.container'),
      topnavActions: cySelector('dashboard.topnav.actions'),
      topnavNotificationsTrigger: cySelector('dashboard.topnav.notifications.trigger'),
      topnavQuickCreateTrigger: cySelector('dashboard.topnav.quickCreate.trigger'),
      topnavQuickCreateContent: cySelector('dashboard.topnav.quickCreate.content'),
      topnavQuickCreateLink: (slug: string) => cySelector('dashboard.topnav.quickCreate.link', { slug }),
      topnavUserMenuTrigger: cySelector('dashboard.topnav.userMenu.trigger'),
      topnavUserMenuContent: cySelector('dashboard.topnav.userMenu.content'),
      topnavUserMenuItem: (icon: string) => cySelector('dashboard.topnav.userMenu.item', { icon }),
      topnavUserMenuAction: (action: string) => cySelector('dashboard.topnav.userMenu.action', { action }),
      topnavHelp: cySelector('dashboard.topnav.help'),
      topnavThemeToggle: cySelector('dashboard.topnav.themeToggle'),
      topnavSuperadmin: cySelector('dashboard.topnav.superadmin'),
      topnavDevtools: cySelector('dashboard.topnav.devtools'),
      topnavUserLoading: cySelector('dashboard.topnav.userLoading'),
      topnavSignin: cySelector('dashboard.topnav.signin'),
      topnavSignup: cySelector('dashboard.topnav.signup'),
      // Topnav settings menu
      topnavSettingsMenuTrigger: cySelector('dashboard.topnav.settingsMenu.trigger'),
      topnavSettingsMenuContent: cySelector('dashboard.topnav.settingsMenu.content'),
      topnavSettingsMenuItem: (index: number) => cySelector('dashboard.topnav.settingsMenu.item', { index }),
      topnavSettingsMenuLink: (index: number) => cySelector('dashboard.topnav.settingsMenu.link', { index }),
      // Topnav mobile menu
      topnavMobileMenuToggle: cySelector('dashboard.topnav.mobileMenu.toggle'),
      topnavMobileMenuContainer: cySelector('dashboard.topnav.mobileMenu.container'),
      topnavMobileMenuActions: cySelector('dashboard.topnav.mobileMenu.actions'),
      topnavMobileMenuUserInfo: cySelector('dashboard.topnav.mobileMenu.userInfo'),
      topnavMobileMenuLinkProfile: cySelector('dashboard.topnav.mobileMenu.linkProfile'),
      topnavMobileMenuLinkSettings: cySelector('dashboard.topnav.mobileMenu.linkSettings'),
      topnavMobileMenuLinkBilling: cySelector('dashboard.topnav.mobileMenu.linkBilling'),
      topnavMobileMenuSignout: cySelector('dashboard.topnav.mobileMenu.signout'),
      topnavMobileMenuSuperadmin: cySelector('dashboard.topnav.mobileMenu.superadmin'),
      topnavMobileMenuDevtools: cySelector('dashboard.topnav.mobileMenu.devtools'),

      // Sidebar
      sidebarContainer: cySelector('dashboard.sidebar.container'),
      sidebarHeader: cySelector('dashboard.sidebar.header'),
      sidebarLogo: cySelector('dashboard.sidebar.logo'),
      sidebarContent: cySelector('dashboard.sidebar.content'),
      sidebarFooter: cySelector('dashboard.sidebar.footer'),

      // Mobile Topbar
      mobileTopbarContainer: cySelector('dashboard.mobile.topbar.container'),
      mobileTopbarUserProfile: cySelector('dashboard.mobile.topbar.userProfile'),
      mobileTopbarNotifications: cySelector('dashboard.mobile.topbar.notifications'),
      mobileTopbarThemeToggle: cySelector('dashboard.mobile.topbar.themeToggle'),

      // Mobile Bottom Nav
      mobileBottomNavContainer: cySelector('dashboard.mobile.bottomNav.container'),
      mobileBottomNavItem: (id: string) => cySelector('dashboard.mobile.bottomNav.item', { id }),

      // Mobile More Sheet
      mobileMoreSheetContainer: cySelector('dashboard.mobile.moreSheet.container'),
      mobileMoreSheetItem: (id: string) => cySelector('dashboard.mobile.moreSheet.item', { id }),
      mobileMoreSheetSuperadminLink: cySelector('dashboard.mobile.moreSheet.superadminLink'),
      mobileMoreSheetTeamSwitcher: cySelector('dashboard.mobile.moreSheet.teamSwitcher'),
      mobileMoreSheetSignoutButton: cySelector('dashboard.mobile.moreSheet.signoutButton'),

      // Mobile Quick Create Sheet
      mobileQuickCreateSheetContainer: cySelector('dashboard.mobile.quickCreateSheet.container'),
      mobileQuickCreateSheetItem: (slug: string) => cySelector('dashboard.mobile.quickCreateSheet.item', { slug }),

      // Entity table (for verifying entity pages)
      entityPage: (slug: string) => cySelector('entities.page.container', { slug }),
      entityTable: (slug: string) => cySelector('entities.table.container', { slug }),
      entityAddButton: (slug: string) => cySelector('entities.table.addButton', { slug }),

      // Legacy aliases (for backward compatibility during transition)
      /** @deprecated Use navContainer instead */
      navMain: cySelector('dashboard.navigation.container'),
      /** @deprecated Use topnavQuickCreateTrigger instead */
      quickCreateButton: cySelector('dashboard.topnav.quickCreate.trigger'),
      /** @deprecated Use topnavQuickCreateContent instead */
      quickCreateDropdown: cySelector('dashboard.topnav.quickCreate.content'),
      /** @deprecated Use topnavQuickCreateLink instead */
      quickCreateLink: (slug: string) => cySelector('dashboard.topnav.quickCreate.link', { slug }),
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
    cy.get(this.selectors.topnavQuickCreateTrigger).click()
    return this
  }

  /**
   * Click quick create link for an entity
   */
  quickCreate(slug: string) {
    this.openQuickCreate()
    cy.get(this.selectors.topnavQuickCreateLink(slug)).click()
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
    cy.get(this.selectors.topnavQuickCreateTrigger).should('be.visible')
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
    cy.get(this.selectors.navContainer, { timeout: 15000 }).should('be.visible')
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
