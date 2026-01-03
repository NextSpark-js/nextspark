/**
 * NotificationsSettings - Page Object Model Class
 *
 * POM for the notifications settings page.
 */
export class NotificationsSettings {
  static selectors = {
    page: '[data-cy="notifications-settings-page"]',
    emailToggle: '[data-cy="notifications-email-toggle"]',
    pushToggle: '[data-cy="notifications-push-toggle"]',
    categoryToggle: '[data-cy^="notifications-category-"]',
    saveButton: '[data-cy="notifications-save"]',
    successMessage: '[data-cy="notifications-success"]',
  }

  /**
   * Validate page is visible
   */
  validatePageVisible() {
    cy.get(NotificationsSettings.selectors.page).should('be.visible')
    return this
  }

  /**
   * Toggle email notifications
   */
  toggleEmail() {
    cy.get(NotificationsSettings.selectors.emailToggle).click()
    return this
  }

  /**
   * Toggle push notifications
   */
  togglePush() {
    cy.get(NotificationsSettings.selectors.pushToggle).click()
    return this
  }

  /**
   * Toggle specific notification category
   * @param {string} category - Category name
   */
  toggleCategory(category) {
    cy.get(`[data-cy="notifications-category-${category}"]`).click()
    return this
  }

  /**
   * Save notification settings
   */
  save() {
    cy.get(NotificationsSettings.selectors.saveButton).click()
    return this
  }

  /**
   * Validate success message is shown
   */
  validateSuccess() {
    cy.get(NotificationsSettings.selectors.successMessage).should('be.visible')
    return this
  }

  /**
   * Validate email toggle state
   * @param {boolean} enabled - Expected state
   */
  validateEmailEnabled(enabled) {
    cy.get(NotificationsSettings.selectors.emailToggle)
      .should(enabled ? 'be.checked' : 'not.be.checked')
    return this
  }

  /**
   * Validate push toggle state
   * @param {boolean} enabled - Expected state
   */
  validatePushEnabled(enabled) {
    cy.get(NotificationsSettings.selectors.pushToggle)
      .should(enabled ? 'be.checked' : 'not.be.checked')
    return this
  }

  /**
   * Enable all notifications
   */
  enableAll() {
    cy.get(NotificationsSettings.selectors.categoryToggle).each(($toggle) => {
      if (!$toggle.is(':checked')) {
        cy.wrap($toggle).click()
      }
    })
    return this
  }

  /**
   * Disable all notifications
   */
  disableAll() {
    cy.get(NotificationsSettings.selectors.categoryToggle).each(($toggle) => {
      if ($toggle.is(':checked')) {
        cy.wrap($toggle).click()
      }
    })
    return this
  }
}
