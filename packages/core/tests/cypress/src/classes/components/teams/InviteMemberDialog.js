/**
 * InviteMemberDialog - Page Object Model Class
 *
 * POM for the invite member dialog.
 */
export class InviteMemberDialog {
  static selectors = {
    dialog: '[data-cy="invite-member-dialog"]',
    emailInput: '[data-cy="invite-member-email"]',
    roleSelect: '[data-cy="invite-member-role"]',
    roleOption: '[data-cy^="invite-member-role-"]',
    submitButton: '[data-cy="invite-member-submit"]',
    cancelButton: '[data-cy="invite-member-cancel"]',
    successMessage: '[data-cy="invite-member-success"]',
    errorMessage: '[data-cy="invite-member-error"]',
  }

  /**
   * Validate dialog is visible
   */
  validateDialogVisible() {
    cy.get(InviteMemberDialog.selectors.dialog).should('be.visible')
    return this
  }

  /**
   * Validate dialog is not visible
   */
  validateDialogNotVisible() {
    cy.get(InviteMemberDialog.selectors.dialog).should('not.exist')
    return this
  }

  /**
   * Fill email
   * @param {string} email - Member email
   */
  fillEmail(email) {
    cy.get(InviteMemberDialog.selectors.emailInput).clear().type(email)
    return this
  }

  /**
   * Select role
   * @param {string} role - Role to select (e.g., 'admin', 'member')
   */
  selectRole(role) {
    cy.get(InviteMemberDialog.selectors.roleSelect).click()
    cy.get(`[data-cy="invite-member-role-${role}"]`).click()
    return this
  }

  /**
   * Submit the dialog
   */
  submit() {
    cy.get(InviteMemberDialog.selectors.submitButton).click()
    return this
  }

  /**
   * Cancel the dialog
   */
  cancel() {
    cy.get(InviteMemberDialog.selectors.cancelButton).click()
    return this
  }

  /**
   * Validate success message is visible
   */
  validateSuccess() {
    cy.get(InviteMemberDialog.selectors.successMessage).should('be.visible')
    return this
  }

  /**
   * Validate error message is visible
   * @param {string} message - Expected error message (optional)
   */
  validateError(message = null) {
    cy.get(InviteMemberDialog.selectors.errorMessage).should('be.visible')
    if (message) {
      cy.get(InviteMemberDialog.selectors.errorMessage).should('contain', message)
    }
    return this
  }

  /**
   * Validate submit button is disabled
   */
  validateSubmitDisabled() {
    cy.get(InviteMemberDialog.selectors.submitButton).should('be.disabled')
    return this
  }

  /**
   * Invite member with email and role
   * @param {string} email - Member email
   * @param {string} role - Role to assign
   */
  inviteMember(email, role = 'member') {
    this.fillEmail(email)
    this.selectRole(role)
    this.submit()
    return this
  }

  /**
   * Get email input value
   */
  getEmailValue() {
    return cy.get(InviteMemberDialog.selectors.emailInput).invoke('val')
  }
}
