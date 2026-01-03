/**
 * MobileNav - Page Object Model Class
 *
 * POM for mobile navigation components (bottom nav and more sheet).
 */
export class MobileNav {
  static selectors = {
    bottomNav: '[data-cy="mobile-bottom-nav"]',
    moreButton: '[data-cy="mobile-more-button"]',
    moreSheet: '[data-cy="mobile-more-sheet"]',
    navItem: '[data-cy^="mobile-nav-"]',
    sheetItem: '[data-cy^="mobile-sheet-"]',
  }

  /**
   * Validate bottom nav is visible
   */
  validateBottomNavVisible() {
    cy.get(MobileNav.selectors.bottomNav).should('be.visible')
    return this
  }

  /**
   * Validate bottom nav is not visible (desktop view)
   */
  validateBottomNavNotVisible() {
    cy.get(MobileNav.selectors.bottomNav).should('not.be.visible')
    return this
  }

  /**
   * Click nav item
   * @param {string} itemId - Nav item ID
   */
  clickNavItem(itemId) {
    cy.get(`[data-cy="mobile-nav-${itemId}"]`).click()
    return this
  }

  /**
   * Open more sheet
   */
  openMoreSheet() {
    cy.get(MobileNav.selectors.moreButton).click()
    cy.get(MobileNav.selectors.moreSheet).should('be.visible')
    return this
  }

  /**
   * Close more sheet
   */
  closeMoreSheet() {
    cy.get('body').click(0, 0)
    cy.get(MobileNav.selectors.moreSheet).should('not.be.visible')
    return this
  }

  /**
   * Click sheet item
   * @param {string} itemId - Sheet item ID
   */
  clickSheetItem(itemId) {
    cy.get(`[data-cy="mobile-sheet-${itemId}"]`).click()
    return this
  }

  /**
   * Validate nav item is visible
   * @param {string} itemId - Nav item ID
   */
  validateNavItemVisible(itemId) {
    cy.get(`[data-cy="mobile-nav-${itemId}"]`).should('be.visible')
    return this
  }

  /**
   * Validate sheet item is visible
   * @param {string} itemId - Sheet item ID
   */
  validateSheetItemVisible(itemId) {
    this.openMoreSheet()
    cy.get(`[data-cy="mobile-sheet-${itemId}"]`).should('be.visible')
    return this
  }

  /**
   * Validate nav item is active
   * @param {string} itemId - Nav item ID
   */
  validateNavItemActive(itemId) {
    cy.get(`[data-cy="mobile-nav-${itemId}"]`)
      .should('have.attr', 'aria-current', 'page')
    return this
  }

  /**
   * Navigate to dashboard via mobile nav
   */
  navigateToDashboard() {
    this.clickNavItem('dashboard')
    cy.url().should('include', '/dashboard')
    return this
  }

  /**
   * Set mobile viewport
   */
  setMobileViewport() {
    cy.viewport('iphone-6')
    return this
  }

  /**
   * Set tablet viewport
   */
  setTabletViewport() {
    cy.viewport('ipad-2')
    return this
  }
}
