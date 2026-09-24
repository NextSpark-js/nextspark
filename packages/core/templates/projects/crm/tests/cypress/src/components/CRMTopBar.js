/**
 * CRMTopBar - Page Object Model Class
 *
 * POM for the CRM theme top bar navigation.
 * Handles search, quick create, notifications, and user menu interactions.
 */
export class CRMTopBar {
  static selectors = {
    container: '[data-cy="crm-topbar"]',
    search: '[data-cy="crm-topbar-search"]',
    searchInput: '[data-cy="crm-topbar-search-input"]',
    searchClear: '[data-cy="crm-topbar-search-clear"]',
    quickCreate: '[data-cy="crm-topbar-quick-create"]',
    quickCreateDropdown: '[data-cy="crm-topbar-quick-create-dropdown"]',
    quickCreateLead: '[data-cy="crm-quick-create-lead"]',
    quickCreateContact: '[data-cy="crm-quick-create-contact"]',
    quickCreateCompany: '[data-cy="crm-quick-create-company"]',
    quickCreateDeal: '[data-cy="crm-quick-create-deal"]',
    quickCreateActivity: '[data-cy="crm-quick-create-activity"]',
    notifications: '[data-cy="crm-topbar-notifications"]',
    notificationsDropdown: '[data-cy="crm-topbar-notifications-dropdown"]',
    notificationsBadge: '[data-cy="crm-topbar-notifications-badge"]',
    help: '[data-cy="crm-topbar-help"]',
    themeToggle: '[data-cy="crm-topbar-theme-toggle"]',
    userMenu: '[data-cy="crm-topbar-user-menu"]',
    userMenuDropdown: '[data-cy="crm-topbar-user-menu-dropdown"]',
    userMenuProfile: '[data-cy="crm-user-menu-profile"]',
    userMenuSettings: '[data-cy="crm-user-menu-settings"]',
    userMenuSignout: '[data-cy="crm-user-menu-signout"]',
  }

  /**
   * Validate topbar is visible
   */
  validateVisible() {
    cy.get(CRMTopBar.selectors.container).should('be.visible')
    return this
  }

  /**
   * Validate topbar is not visible
   */
  validateNotVisible() {
    cy.get(CRMTopBar.selectors.container).should('not.exist')
    return this
  }

  /**
   * Search for a term
   * @param {string} term - Search term
   */
  search(term) {
    cy.get(CRMTopBar.selectors.searchInput).clear().type(term)
    return this
  }

  /**
   * Clear search input
   */
  clearSearch() {
    cy.get(CRMTopBar.selectors.searchClear).click()
    return this
  }

  /**
   * Validate search input has value
   * @param {string} value - Expected value
   */
  validateSearchValue(value) {
    cy.get(CRMTopBar.selectors.searchInput).should('have.value', value)
    return this
  }

  /**
   * Open quick create dropdown
   */
  openQuickCreate() {
    cy.get(CRMTopBar.selectors.quickCreate).click()
    cy.get(CRMTopBar.selectors.quickCreateDropdown).should('be.visible')
    return this
  }

  /**
   * Quick create an entity
   * @param {string} entity - Entity type (lead, contact, company, deal, activity)
   */
  quickCreate(entity) {
    this.openQuickCreate()
    const selector = CRMTopBar.selectors[`quickCreate${entity.charAt(0).toUpperCase() + entity.slice(1)}`]
    if (!selector) {
      throw new Error(`Invalid entity: ${entity}. Valid options: lead, contact, company, deal, activity`)
    }
    cy.get(selector).click()
    return this
  }

  /**
   * Open notifications dropdown
   */
  openNotifications() {
    cy.get(CRMTopBar.selectors.notifications).click()
    cy.get(CRMTopBar.selectors.notificationsDropdown).should('be.visible')
    return this
  }

  /**
   * Validate notifications badge count
   * @param {number} count - Expected notification count
   */
  validateNotificationCount(count) {
    if (count > 0) {
      cy.get(CRMTopBar.selectors.notificationsBadge).should('be.visible').and('contain', count)
    } else {
      cy.get(CRMTopBar.selectors.notificationsBadge).should('not.exist')
    }
    return this
  }

  /**
   * Click help button
   */
  clickHelp() {
    cy.get(CRMTopBar.selectors.help).click()
    return this
  }

  /**
   * Toggle theme
   */
  toggleTheme() {
    cy.get(CRMTopBar.selectors.themeToggle).click()
    return this
  }

  /**
   * Validate theme toggle is visible
   */
  validateThemeToggleVisible() {
    cy.get(CRMTopBar.selectors.themeToggle).should('be.visible')
    return this
  }

  /**
   * Open user menu dropdown
   */
  openUserMenu() {
    cy.get(CRMTopBar.selectors.userMenu).click()
    cy.get(CRMTopBar.selectors.userMenuDropdown).should('be.visible')
    return this
  }

  /**
   * Navigate to profile
   */
  goToProfile() {
    this.openUserMenu()
    cy.get(CRMTopBar.selectors.userMenuProfile).click()
    return this
  }

  /**
   * Navigate to settings
   */
  goToSettings() {
    this.openUserMenu()
    cy.get(CRMTopBar.selectors.userMenuSettings).click()
    return this
  }

  /**
   * Sign out via user menu
   */
  signOut() {
    this.openUserMenu()
    cy.get(CRMTopBar.selectors.userMenuSignout).click()
    return this
  }

  /**
   * Validate quick create button is visible
   */
  validateQuickCreateVisible() {
    cy.get(CRMTopBar.selectors.quickCreate).should('be.visible')
    return this
  }

  /**
   * Validate search is visible
   */
  validateSearchVisible() {
    cy.get(CRMTopBar.selectors.search).should('be.visible')
    return this
  }
}
