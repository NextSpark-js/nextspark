/**
 * DynamicNavigation - Page Object Model Class
 *
 * POM for the dynamic navigation sidebar component.
 * Supports both custom sections and entity-based navigation.
 */
export class DynamicNavigation {
  static selectors = {
    main: '[data-cy="nav-main"]',
    section: '[data-cy^="nav-section-"]',
    sectionLabel: '[data-cy^="nav-section-label-"]',
    sectionItem: '[data-cy^="nav-section-item-"]',
    entityLink: '[data-cy^="nav-link-entity-"]',
    dashboardLink: '[data-cy="nav-link-dashboard"]',
  }

  /**
   * Validate navigation is visible
   */
  validateNavVisible() {
    cy.get(DynamicNavigation.selectors.main).should('be.visible')
    return this
  }

  /**
   * Click on a specific section
   * @param {string} sectionId - The section ID
   */
  clickSection(sectionId) {
    cy.get(`[data-cy="nav-section-${sectionId}"]`).click()
    return this
  }

  /**
   * Click on a section item
   * @param {string} sectionId - The section ID
   * @param {string} itemId - The item ID
   */
  clickSectionItem(sectionId, itemId) {
    cy.get(`[data-cy="nav-section-item-${sectionId}-${itemId}"]`).click()
    return this
  }

  /**
   * Click on an entity link
   * @param {string} entitySlug - The entity slug
   */
  clickEntityLink(entitySlug) {
    cy.get(`[data-cy="nav-link-entity-${entitySlug}"]`).click()
    return this
  }

  /**
   * Click on dashboard link
   */
  clickDashboard() {
    cy.get(DynamicNavigation.selectors.dashboardLink).click()
    return this
  }

  /**
   * Validate section is visible
   * @param {string} sectionId - The section ID
   */
  validateSectionVisible(sectionId) {
    cy.get(`[data-cy="nav-section-${sectionId}"]`).should('be.visible')
    return this
  }

  /**
   * Validate section is not visible
   * @param {string} sectionId - The section ID
   */
  validateSectionNotVisible(sectionId) {
    cy.get(`[data-cy="nav-section-${sectionId}"]`).should('not.exist')
    return this
  }

  /**
   * Validate entity link is visible
   * @param {string} entitySlug - The entity slug
   */
  validateEntityLinkVisible(entitySlug) {
    cy.get(`[data-cy="nav-link-entity-${entitySlug}"]`).should('be.visible')
    return this
  }

  /**
   * Validate entity link is active
   * @param {string} entitySlug - The entity slug
   */
  validateEntityLinkActive(entitySlug) {
    cy.get(`[data-cy="nav-link-entity-${entitySlug}"]`)
      .should('have.attr', 'aria-current', 'page')
    return this
  }

  /**
   * Get all visible sections
   */
  getSections() {
    return cy.get(DynamicNavigation.selectors.section)
  }

  /**
   * Get all entity links
   */
  getEntityLinks() {
    return cy.get(DynamicNavigation.selectors.entityLink)
  }

  /**
   * Validate section label text
   * @param {string} sectionId - The section ID
   * @param {string} expectedText - Expected label text
   */
  validateSectionLabel(sectionId, expectedText) {
    cy.get(`[data-cy="nav-section-label-${sectionId}"]`)
      .should('contain', expectedText)
    return this
  }

  /**
   * Navigate to entity
   * @param {string} entitySlug - The entity slug
   */
  navigateToEntity(entitySlug) {
    this.clickEntityLink(entitySlug)
    cy.url().should('include', `/dashboard/${entitySlug}`)
    return this
  }
}
