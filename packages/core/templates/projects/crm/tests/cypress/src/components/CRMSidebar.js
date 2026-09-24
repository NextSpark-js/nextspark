/**
 * CRMSidebar - Page Object Model Class
 *
 * POM for the CRM theme sidebar navigation.
 * Handles desktop sidebar interactions for CRM-specific navigation.
 */
export class CRMSidebar {
  static selectors = {
    container: '[data-cy="crm-sidebar"]',
    logo: '[data-cy="crm-sidebar-logo"]',
    collapseBtn: '[data-cy="crm-sidebar-collapse-btn"]',
    navDashboard: '[data-cy="crm-sidebar-nav-dashboard"]',
    navLeads: '[data-cy="crm-sidebar-nav-leads"]',
    navContacts: '[data-cy="crm-sidebar-nav-contacts"]',
    navCompanies: '[data-cy="crm-sidebar-nav-companies"]',
    navPipelines: '[data-cy="crm-sidebar-nav-pipelines"]',
    navProducts: '[data-cy="crm-sidebar-nav-products"]',
    navCampaigns: '[data-cy="crm-sidebar-nav-campaigns"]',
    navActivities: '[data-cy="crm-sidebar-nav-activities"]',
    navSettings: '[data-cy="crm-sidebar-nav-settings"]',
    userAvatar: '[data-cy="crm-sidebar-user-avatar"]',
    userName: '[data-cy="crm-sidebar-user-name"]',
    userEmail: '[data-cy="crm-sidebar-user-email"]',
    signoutBtn: '[data-cy="crm-sidebar-signout-btn"]',
  }

  /**
   * Validate sidebar is visible
   */
  validateVisible() {
    cy.get(CRMSidebar.selectors.container).should('be.visible')
    return this
  }

  /**
   * Validate sidebar is not visible
   */
  validateNotVisible() {
    cy.get(CRMSidebar.selectors.container).should('not.exist')
    return this
  }

  /**
   * Navigate to a specific entity
   * @param {string} entity - Entity name (dashboard, leads, contacts, companies, pipelines, products, campaigns, activities, settings)
   */
  navigateTo(entity) {
    const selector = CRMSidebar.selectors[`nav${entity.charAt(0).toUpperCase() + entity.slice(1)}`]
    if (!selector) {
      throw new Error(`Invalid entity: ${entity}. Valid options: dashboard, leads, contacts, companies, pipelines, products, campaigns, activities, settings`)
    }
    cy.get(selector).click()
    return this
  }

  /**
   * Expand sidebar (if collapsed)
   */
  expand() {
    cy.get(CRMSidebar.selectors.container).then($sidebar => {
      if ($sidebar.attr('data-collapsed') === 'true') {
        cy.get(CRMSidebar.selectors.collapseBtn).click()
        cy.get(CRMSidebar.selectors.container).should('have.attr', 'data-collapsed', 'false')
      }
    })
    return this
  }

  /**
   * Collapse sidebar (if expanded)
   */
  collapse() {
    cy.get(CRMSidebar.selectors.container).then($sidebar => {
      if ($sidebar.attr('data-collapsed') === 'false') {
        cy.get(CRMSidebar.selectors.collapseBtn).click()
        cy.get(CRMSidebar.selectors.container).should('have.attr', 'data-collapsed', 'true')
      }
    })
    return this
  }

  /**
   * Check if sidebar is expanded
   */
  isExpanded() {
    return cy.get(CRMSidebar.selectors.container)
      .should('have.attr', 'data-collapsed')
      .then(collapsed => collapsed === 'false')
  }

  /**
   * Validate logo is visible
   */
  validateLogoVisible() {
    cy.get(CRMSidebar.selectors.logo).should('be.visible')
    return this
  }

  /**
   * Validate user info is displayed
   * @param {string} name - Expected user name
   * @param {string} email - Expected user email
   */
  validateUserInfo(name, email) {
    cy.get(CRMSidebar.selectors.userName).should('contain', name)
    cy.get(CRMSidebar.selectors.userEmail).should('contain', email)
    return this
  }

  /**
   * Validate user avatar is visible
   */
  validateUserAvatarVisible() {
    cy.get(CRMSidebar.selectors.userAvatar).should('be.visible')
    return this
  }

  /**
   * Sign out via sidebar
   */
  signOut() {
    cy.get(CRMSidebar.selectors.signoutBtn).click()
    return this
  }

  /**
   * Validate navigation item is active
   * @param {string} entity - Entity name
   */
  validateNavActive(entity) {
    const selector = CRMSidebar.selectors[`nav${entity.charAt(0).toUpperCase() + entity.slice(1)}`]
    cy.get(selector).should('have.attr', 'data-active', 'true')
    return this
  }

  /**
   * Validate navigation item is not active
   * @param {string} entity - Entity name
   */
  validateNavNotActive(entity) {
    const selector = CRMSidebar.selectors[`nav${entity.charAt(0).toUpperCase() + entity.slice(1)}`]
    cy.get(selector).should('have.attr', 'data-active', 'false')
    return this
  }
}
