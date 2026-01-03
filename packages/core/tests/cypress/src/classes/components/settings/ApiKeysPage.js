/**
 * ApiKeysPage - Page Object Model Class
 *
 * POM for the API Keys settings page.
 */
export class ApiKeysPage {
  static selectors = {
    // Page elements
    page: '[data-cy="api-keys-page"]',
    title: '[data-cy="api-keys-title"]',
    createButton: '[data-cy="api-keys-create-button"]',
    list: '[data-cy="api-keys-list"]',
    empty: '[data-cy="api-keys-empty"]',
    emptyCreateButton: '[data-cy="api-keys-empty-create-button"]',
    row: '[data-cy^="api-keys-row-"]',

    // Create dialog elements
    dialog: '[data-cy="api-keys-dialog"]',
    dialogTitle: '[data-cy="api-keys-dialog-title"]',
    dialogForm: '[data-cy="api-keys-dialog-form"]',
    dialogName: '[data-cy="api-keys-dialog-name"]',
    dialogExpiration: '[data-cy="api-keys-dialog-expiration"]',
    dialogScopes: '[data-cy="api-keys-dialog-scopes"]',
    dialogSubmit: '[data-cy="api-keys-dialog-submit"]',
    dialogCancel: '[data-cy="api-keys-dialog-cancel"]',

    // Key display elements
    display: '[data-cy="api-keys-display"]',
    displayValue: '[data-cy="api-keys-display-value"]',
    displayCopy: '[data-cy="api-keys-display-copy"]',
    displayToggle: '[data-cy="api-keys-display-toggle"]',
    displayClose: '[data-cy="api-keys-display-close"]',

    // Details dialog
    detailsDialog: '[data-cy="api-keys-details-dialog"]',
  }

  /**
   * Validate page is visible
   */
  validatePageVisible() {
    cy.get(ApiKeysPage.selectors.page).should('be.visible')
    return this
  }

  /**
   * Open create dialog
   */
  openCreateDialog() {
    cy.get(ApiKeysPage.selectors.createButton).click()
    cy.get(ApiKeysPage.selectors.dialog).should('be.visible')
    return this
  }

  /**
   * Fill key name in dialog
   * @param {string} name - API key name
   */
  fillKeyName(name) {
    cy.get(ApiKeysPage.selectors.dialogName).clear().type(name)
    return this
  }

  /**
   * Select expiration option
   * @param {string} value - Expiration value (never, 30d, 90d, 1y, custom)
   */
  selectExpiration(value) {
    cy.get(ApiKeysPage.selectors.dialogExpiration).click()
    cy.get(`[data-cy="api-keys-dialog-expiration-${value}"]`).click()
    return this
  }

  /**
   * Toggle a permission in the dialog
   * @param {string} permission - Permission scope
   */
  togglePermission(permission) {
    cy.get(`[data-cy="api-keys-dialog-permission-${permission}"]`).click()
    return this
  }

  /**
   * Submit the create dialog
   */
  submitDialog() {
    cy.get(ApiKeysPage.selectors.dialogSubmit).click()
    return this
  }

  /**
   * Cancel the create dialog
   */
  cancelDialog() {
    cy.get(ApiKeysPage.selectors.dialogCancel).click()
    return this
  }

  /**
   * Copy displayed API key
   */
  copyDisplayedKey() {
    cy.get(ApiKeysPage.selectors.displayCopy).click()
    return this
  }

  /**
   * Toggle key visibility
   */
  toggleKeyVisibility() {
    cy.get(ApiKeysPage.selectors.displayToggle).click()
    return this
  }

  /**
   * Close key display
   */
  closeKeyDisplay() {
    cy.get(ApiKeysPage.selectors.displayClose).click()
    return this
  }

  /**
   * Open key menu
   * @param {string} keyId - API key ID
   */
  openKeyMenu(keyId) {
    cy.get(`[data-cy="api-keys-menu-trigger-${keyId}"]`).click()
    return this
  }

  /**
   * View key details
   * @param {string} keyId - API key ID
   */
  viewDetails(keyId) {
    this.openKeyMenu(keyId)
    cy.get(`[data-cy="api-keys-view-details-${keyId}"]`).click()
    return this
  }

  /**
   * Toggle key status
   * @param {string} keyId - API key ID
   */
  toggleKeyStatus(keyId) {
    this.openKeyMenu(keyId)
    cy.get(`[data-cy="api-keys-toggle-${keyId}"]`).click()
    return this
  }

  /**
   * Revoke API key
   * @param {string} keyId - API key ID
   */
  revokeKey(keyId) {
    this.openKeyMenu(keyId)
    cy.get(`[data-cy="api-keys-revoke-${keyId}"]`).click()
    return this
  }

  /**
   * Validate key is visible in list
   * @param {string} keyId - API key ID
   */
  validateKeyVisible(keyId) {
    cy.get(`[data-cy="api-keys-row-${keyId}"]`).should('be.visible')
    return this
  }

  /**
   * Validate empty state is shown
   */
  validateEmptyState() {
    cy.get(ApiKeysPage.selectors.empty).should('be.visible')
    return this
  }

  /**
   * Validate key display is shown
   */
  validateKeyDisplayVisible() {
    cy.get(ApiKeysPage.selectors.display).should('be.visible')
    return this
  }

  /**
   * Create API key with name and permissions
   * @param {string} name - API key name
   * @param {string[]} permissions - Array of permission scopes
   */
  createApiKey(name, permissions = []) {
    this.openCreateDialog()
    this.fillKeyName(name)
    permissions.forEach(permission => this.togglePermission(permission))
    this.submitDialog()
    return this
  }

  /**
   * Get row element
   * @param {string} keyId - API key ID
   */
  getKeyRow(keyId) {
    return cy.get(`[data-cy="api-keys-row-${keyId}"]`)
  }
}
