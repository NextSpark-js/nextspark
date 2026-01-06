/**
 * PipelineForm - Page Object Model Class
 *
 * POM for the pipeline create/edit form in CRM theme.
 * Handles pipeline form interactions and validations.
 */
export class PipelineForm {
  static selectors = {
    form: '[data-cy="pipeline-form"]',
    nameInput: '[data-cy="pipeline-field-name"] input',
    nameField: '[data-cy="pipeline-field-name"]',
    typeSelect: '[data-cy="pipeline-field-type"]',
    typeInput: '[data-cy="pipeline-field-type"] select',
    descriptionInput: '[data-cy="pipeline-field-description"] textarea',
    descriptionField: '[data-cy="pipeline-field-description"]',
    isActiveCheckbox: '[data-cy="pipeline-field-isActive"] input[type="checkbox"]',
    isActiveField: '[data-cy="pipeline-field-isActive"]',
    submitBtn: '[data-cy="pipeline-form-submit"]',
    cancelBtn: '[data-cy="pipeline-form-cancel"]',
    error: '[data-cy="pipeline-form-error"]',
    fieldError: '[class*="error"], [data-error="true"]',
  }

  /**
   * Validate form is visible
   */
  validateVisible() {
    cy.get(PipelineForm.selectors.form).should('be.visible')
    return this
  }

  /**
   * Validate form is not visible
   */
  validateNotVisible() {
    cy.get(PipelineForm.selectors.form).should('not.exist')
    return this
  }

  /**
   * Fill pipeline name
   * @param {string} name - Pipeline name
   */
  fillName(name) {
    cy.get(PipelineForm.selectors.nameInput).clear().type(name)
    return this
  }

  /**
   * Clear pipeline name
   */
  clearName() {
    cy.get(PipelineForm.selectors.nameInput).clear()
    return this
  }

  /**
   * Validate name field value
   * @param {string} name - Expected name
   */
  validateNameValue(name) {
    cy.get(PipelineForm.selectors.nameInput).should('have.value', name)
    return this
  }

  /**
   * Select pipeline type
   * @param {string} type - Pipeline type (sales, marketing, support, custom)
   */
  selectType(type) {
    cy.get(PipelineForm.selectors.typeInput).select(type)
    return this
  }

  /**
   * Validate type field value
   * @param {string} type - Expected type
   */
  validateTypeValue(type) {
    cy.get(PipelineForm.selectors.typeInput).should('have.value', type)
    return this
  }

  /**
   * Fill pipeline description
   * @param {string} description - Pipeline description
   */
  fillDescription(description) {
    cy.get(PipelineForm.selectors.descriptionInput).clear().type(description)
    return this
  }

  /**
   * Clear pipeline description
   */
  clearDescription() {
    cy.get(PipelineForm.selectors.descriptionInput).clear()
    return this
  }

  /**
   * Validate description field value
   * @param {string} description - Expected description
   */
  validateDescriptionValue(description) {
    cy.get(PipelineForm.selectors.descriptionInput).should('have.value', description)
    return this
  }

  /**
   * Toggle isActive checkbox
   */
  toggleIsActive() {
    cy.get(PipelineForm.selectors.isActiveCheckbox).click()
    return this
  }

  /**
   * Set isActive checkbox
   * @param {boolean} active - True to check, false to uncheck
   */
  setIsActive(active) {
    cy.get(PipelineForm.selectors.isActiveCheckbox).then($checkbox => {
      const isChecked = $checkbox.is(':checked')
      if ((active && !isChecked) || (!active && isChecked)) {
        cy.get(PipelineForm.selectors.isActiveCheckbox).click()
      }
    })
    return this
  }

  /**
   * Validate isActive checkbox state
   * @param {boolean} checked - Expected checked state
   */
  validateIsActiveChecked(checked) {
    if (checked) {
      cy.get(PipelineForm.selectors.isActiveCheckbox).should('be.checked')
    } else {
      cy.get(PipelineForm.selectors.isActiveCheckbox).should('not.be.checked')
    }
    return this
  }

  /**
   * Submit the form
   */
  submit() {
    cy.get(PipelineForm.selectors.submitBtn).click()
    return this
  }

  /**
   * Cancel the form
   */
  cancel() {
    cy.get(PipelineForm.selectors.cancelBtn).click()
    return this
  }

  /**
   * Validate submit button is enabled
   */
  validateSubmitEnabled() {
    cy.get(PipelineForm.selectors.submitBtn).should('not.be.disabled')
    return this
  }

  /**
   * Validate submit button is disabled
   */
  validateSubmitDisabled() {
    cy.get(PipelineForm.selectors.submitBtn).should('be.disabled')
    return this
  }

  /**
   * Validate form error message
   * @param {string} message - Expected error message
   */
  validateError(message) {
    cy.get(PipelineForm.selectors.error).should('be.visible').and('contain', message)
    return this
  }

  /**
   * Validate no form error
   */
  validateNoError() {
    cy.get(PipelineForm.selectors.error).should('not.exist')
    return this
  }

  /**
   * Validate field error
   * @param {string} fieldName - Field name (name, type, description)
   */
  validateFieldError(fieldName) {
    const fieldSelector = PipelineForm.selectors[`${fieldName}Field`]
    cy.get(fieldSelector).within(() => {
      cy.get(PipelineForm.selectors.fieldError).should('exist')
    })
    return this
  }

  /**
   * Validate no field error
   * @param {string} fieldName - Field name (name, type, description)
   */
  validateNoFieldError(fieldName) {
    const fieldSelector = PipelineForm.selectors[`${fieldName}Field`]
    cy.get(fieldSelector).within(() => {
      cy.get(PipelineForm.selectors.fieldError).should('not.exist')
    })
    return this
  }

  /**
   * Fill complete pipeline form
   * @param {Object} data - Pipeline data
   * @param {string} data.name - Pipeline name
   * @param {string} data.type - Pipeline type
   * @param {string} data.description - Pipeline description (optional)
   * @param {boolean} data.isActive - Is active (optional, defaults to true)
   */
  fillForm(data) {
    if (data.name) this.fillName(data.name)
    if (data.type) this.selectType(data.type)
    if (data.description) this.fillDescription(data.description)
    if (data.isActive !== undefined) this.setIsActive(data.isActive)
    return this
  }

  /**
   * Create a pipeline (fill and submit)
   * @param {Object} data - Pipeline data
   */
  createPipeline(data) {
    this.fillForm(data)
    this.submit()
    return this
  }
}
