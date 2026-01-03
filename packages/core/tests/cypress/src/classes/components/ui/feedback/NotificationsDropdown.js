/**
 * NotificationsDropdown - Page Object Model Class
 *
 * POM for the notifications dropdown in the top navbar.
 */
export class NotificationsDropdown {
  static selectors = {
    trigger: '[data-cy="notifications-trigger"]',
    dropdown: '[data-cy="notifications-dropdown"]',
    list: '[data-cy="notifications-list"]',
    item: '[data-cy^="notification-item-"]',
    markAllRead: '[data-cy="notifications-mark-all-read"]',
    empty: '[data-cy="notifications-empty"]',
    badge: '[data-cy="notifications-badge"]',
    settingsLink: '[data-cy="notifications-settings-link"]',
  }

  /**
   * Validate trigger is visible
   */
  validateTriggerVisible() {
    cy.get(NotificationsDropdown.selectors.trigger).should('be.visible')
    return this
  }

  /**
   * Open notifications dropdown
   */
  open() {
    cy.get(NotificationsDropdown.selectors.trigger).click()
    cy.get(NotificationsDropdown.selectors.dropdown).should('be.visible')
    return this
  }

  /**
   * Close notifications dropdown
   */
  close() {
    cy.get('body').click(0, 0)
    cy.get(NotificationsDropdown.selectors.dropdown).should('not.be.visible')
    return this
  }

  /**
   * Click on a specific notification
   * @param {string} id - Notification ID
   */
  clickNotification(id) {
    cy.get(`[data-cy="notification-item-${id}"]`).click()
    return this
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead() {
    cy.get(NotificationsDropdown.selectors.markAllRead).click()
    return this
  }

  /**
   * Validate empty state
   */
  validateEmpty() {
    this.open()
    cy.get(NotificationsDropdown.selectors.empty).should('be.visible')
    return this
  }

  /**
   * Validate notification count
   * @param {number} count - Expected count
   */
  validateNotificationCount(count) {
    this.open()
    cy.get(NotificationsDropdown.selectors.item).should('have.length', count)
    return this
  }

  /**
   * Validate badge count
   * @param {number} count - Expected badge count
   */
  validateBadgeCount(count) {
    if (count > 0) {
      cy.get(NotificationsDropdown.selectors.badge).should('contain', count)
    } else {
      cy.get(NotificationsDropdown.selectors.badge).should('not.exist')
    }
    return this
  }

  /**
   * Validate notification exists
   * @param {string} id - Notification ID
   */
  validateNotificationExists(id) {
    this.open()
    cy.get(`[data-cy="notification-item-${id}"]`).should('exist')
    return this
  }

  /**
   * Navigate to notifications settings
   */
  goToSettings() {
    this.open()
    cy.get(NotificationsDropdown.selectors.settingsLink).click()
    cy.url().should('include', '/settings/notifications')
    return this
  }

  /**
   * Get notification item
   * @param {string} id - Notification ID
   */
  getNotification(id) {
    return cy.get(`[data-cy="notification-item-${id}"]`)
  }
}
