/**
 * CreateTeamDialog - Page Object Model Class
 *
 * POM for the create team dialog.
 */
export class CreateTeamDialog {
  static selectors = {
    dialog: '[data-cy="create-team-dialog"]',
    nameInput: '[data-cy="create-team-name"]',
    slugInput: '[data-cy="create-team-slug"]',
    submitButton: '[data-cy="create-team-submit"]',
    cancelButton: '[data-cy="create-team-cancel"]',
    errorMessage: '[data-cy="create-team-error"]',
  }

  /**
   * Validate dialog is visible
   */
  validateDialogVisible() {
    cy.get(CreateTeamDialog.selectors.dialog).should('be.visible')
    return this
  }

  /**
   * Validate dialog is not visible
   */
  validateDialogNotVisible() {
    cy.get(CreateTeamDialog.selectors.dialog).should('not.exist')
    return this
  }

  /**
   * Fill team name
   * @param {string} name - Team name
   */
  fillName(name) {
    cy.get(CreateTeamDialog.selectors.nameInput).clear().type(name)
    return this
  }

  /**
   * Fill team slug
   * @param {string} slug - Team slug
   */
  fillSlug(slug) {
    cy.get(CreateTeamDialog.selectors.slugInput).clear().type(slug)
    return this
  }

  /**
   * Submit the dialog
   */
  submit() {
    cy.get(CreateTeamDialog.selectors.submitButton).click()
    return this
  }

  /**
   * Cancel the dialog
   */
  cancel() {
    cy.get(CreateTeamDialog.selectors.cancelButton).click()
    return this
  }

  /**
   * Validate error message is visible
   * @param {string} message - Expected error message (optional)
   */
  validateError(message = null) {
    cy.get(CreateTeamDialog.selectors.errorMessage).should('be.visible')
    if (message) {
      cy.get(CreateTeamDialog.selectors.errorMessage).should('contain', message)
    }
    return this
  }

  /**
   * Validate submit button is disabled
   */
  validateSubmitDisabled() {
    cy.get(CreateTeamDialog.selectors.submitButton).should('be.disabled')
    return this
  }

  /**
   * Validate submit button is enabled
   */
  validateSubmitEnabled() {
    cy.get(CreateTeamDialog.selectors.submitButton).should('not.be.disabled')
    return this
  }

  /**
   * Fill and submit team creation
   * @param {string} name - Team name
   * @param {string} slug - Team slug (optional)
   */
  createTeam(name, slug = null) {
    this.fillName(name)
    if (slug) {
      this.fillSlug(slug)
    }
    this.submit()
    return this
  }

  /**
   * Get name input value
   */
  getNameValue() {
    return cy.get(CreateTeamDialog.selectors.nameInput).invoke('val')
  }

  /**
   * Get slug input value
   */
  getSlugValue() {
    return cy.get(CreateTeamDialog.selectors.slugInput).invoke('val')
  }
}
