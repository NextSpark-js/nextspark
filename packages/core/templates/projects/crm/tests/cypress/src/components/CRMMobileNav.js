/**
 * CRMMobileNav - Page Object Model Class
 *
 * POM for the CRM theme mobile navigation.
 * Handles mobile topbar and bottom navigation interactions.
 */
export class CRMMobileNav {
  static selectors = {
    topbar: '[data-cy="crm-mobile-topbar"]',
    bottomNav: '[data-cy="crm-mobile-bottomnav"]',
    navDashboard: '[data-cy="crm-mobile-nav-dashboard"]',
    navLeads: '[data-cy="crm-mobile-nav-leads"]',
    navPipelines: '[data-cy="crm-mobile-nav-pipelines"]',
    navActivities: '[data-cy="crm-mobile-nav-activities"]',
    moreBtn: '[data-cy="crm-mobile-nav-more"]',
    moreSheet: '[data-cy="crm-mobile-more-sheet"]',
    moreSheetContent: '[data-cy="crm-mobile-more-sheet-content"]',
    moreContacts: '[data-cy="crm-more-nav-contacts"]',
    moreCompanies: '[data-cy="crm-more-nav-companies"]',
    moreProducts: '[data-cy="crm-more-nav-products"]',
    moreCampaigns: '[data-cy="crm-more-nav-campaigns"]',
    moreSettings: '[data-cy="crm-more-nav-settings"]',
  }

  /**
   * Validate mobile topbar is visible
   */
  validateTopbarVisible() {
    cy.get(CRMMobileNav.selectors.topbar).should('be.visible')
    return this
  }

  /**
   * Validate mobile bottom nav is visible
   */
  validateBottomNavVisible() {
    cy.get(CRMMobileNav.selectors.bottomNav).should('be.visible')
    return this
  }

  /**
   * Validate mobile navigation is visible
   */
  validateVisible() {
    this.validateTopbarVisible()
    this.validateBottomNavVisible()
    return this
  }

  /**
   * Navigate to an entity via bottom nav
   * @param {string} entity - Entity name (dashboard, leads, pipelines, activities)
   */
  navigateTo(entity) {
    const selector = CRMMobileNav.selectors[`nav${entity.charAt(0).toUpperCase() + entity.slice(1)}`]
    if (!selector) {
      throw new Error(`Invalid entity: ${entity}. Valid options: dashboard, leads, pipelines, activities. For other entities, use navigateToMore().`)
    }
    cy.get(selector).click()
    return this
  }

  /**
   * Open the more sheet
   */
  openMore() {
    cy.get(CRMMobileNav.selectors.moreBtn).click()
    cy.get(CRMMobileNav.selectors.moreSheetContent).should('be.visible')
    return this
  }

  /**
   * Close the more sheet
   */
  closeMore() {
    cy.get('body').click(0, 0)
    cy.get(CRMMobileNav.selectors.moreSheetContent).should('not.be.visible')
    return this
  }

  /**
   * Validate more sheet is visible
   */
  validateMoreSheetVisible() {
    cy.get(CRMMobileNav.selectors.moreSheetContent).should('be.visible')
    return this
  }

  /**
   * Navigate to an entity from the more sheet
   * @param {string} entity - Entity name (contacts, companies, products, campaigns, settings)
   */
  navigateToMore(entity) {
    this.openMore()
    const selector = CRMMobileNav.selectors[`more${entity.charAt(0).toUpperCase() + entity.slice(1)}`]
    if (!selector) {
      throw new Error(`Invalid entity: ${entity}. Valid options: contacts, companies, products, campaigns, settings`)
    }
    cy.get(selector).click()
    return this
  }

  /**
   * Validate navigation item is active
   * @param {string} entity - Entity name
   */
  validateNavActive(entity) {
    const selector = CRMMobileNav.selectors[`nav${entity.charAt(0).toUpperCase() + entity.slice(1)}`]
    if (selector) {
      cy.get(selector).should('have.attr', 'data-active', 'true')
    }
    return this
  }

  /**
   * Validate navigation item is not active
   * @param {string} entity - Entity name
   */
  validateNavNotActive(entity) {
    const selector = CRMMobileNav.selectors[`nav${entity.charAt(0).toUpperCase() + entity.slice(1)}`]
    if (selector) {
      cy.get(selector).should('have.attr', 'data-active', 'false')
    }
    return this
  }

  /**
   * Validate all bottom nav items are visible
   */
  validateAllNavItemsVisible() {
    cy.get(CRMMobileNav.selectors.navDashboard).should('be.visible')
    cy.get(CRMMobileNav.selectors.navLeads).should('be.visible')
    cy.get(CRMMobileNav.selectors.navPipelines).should('be.visible')
    cy.get(CRMMobileNav.selectors.navActivities).should('be.visible')
    cy.get(CRMMobileNav.selectors.moreBtn).should('be.visible')
    return this
  }
}
