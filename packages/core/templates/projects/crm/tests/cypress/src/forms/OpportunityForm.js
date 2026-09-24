/**
 * OpportunityForm - Page Object Model Class
 *
 * POM for the opportunity/deal create/edit form in CRM theme.
 * Handles opportunity form interactions and validations.
 */
export class OpportunityForm {
  static selectors = {
    form: '[data-cy="opportunity-form"]',
    nameInput: '[data-cy="opportunity-field-name"] input',
    nameField: '[data-cy="opportunity-field-name"]',
    companySelect: '[data-cy="opportunity-field-company"]',
    companyInput: '[data-cy="opportunity-field-company"] select',
    contactSelect: '[data-cy="opportunity-field-contact"]',
    contactInput: '[data-cy="opportunity-field-contact"] select',
    pipelineSelect: '[data-cy="opportunity-field-pipeline"]',
    pipelineInput: '[data-cy="opportunity-field-pipeline"] select',
    stageSelect: '[data-cy="opportunity-field-stage"]',
    stageInput: '[data-cy="opportunity-field-stage"] select',
    amountInput: '[data-cy="opportunity-field-amount"] input',
    amountField: '[data-cy="opportunity-field-amount"]',
    probabilityInput: '[data-cy="opportunity-field-probability"] input',
    probabilityField: '[data-cy="opportunity-field-probability"]',
    expectedCloseDateInput: '[data-cy="opportunity-field-expectedCloseDate"] input',
    expectedCloseDateField: '[data-cy="opportunity-field-expectedCloseDate"]',
    descriptionInput: '[data-cy="opportunity-field-description"] textarea',
    descriptionField: '[data-cy="opportunity-field-description"]',
    ownerSelect: '[data-cy="opportunity-field-owner"]',
    ownerInput: '[data-cy="opportunity-field-owner"] select',
    prioritySelect: '[data-cy="opportunity-field-priority"]',
    priorityInput: '[data-cy="opportunity-field-priority"] select',
    submitBtn: '[data-cy="opportunity-form-submit"]',
    cancelBtn: '[data-cy="opportunity-form-cancel"]',
    error: '[data-cy="opportunity-form-error"]',
    fieldError: '[class*="error"], [data-error="true"]',
  }

  /**
   * Validate form is visible
   */
  validateVisible() {
    cy.get(OpportunityForm.selectors.form).should('be.visible')
    return this
  }

  /**
   * Validate form is not visible
   */
  validateNotVisible() {
    cy.get(OpportunityForm.selectors.form).should('not.exist')
    return this
  }

  /**
   * Fill opportunity name
   * @param {string} name - Opportunity name
   */
  fillName(name) {
    cy.get(OpportunityForm.selectors.nameInput).clear().type(name)
    return this
  }

  /**
   * Clear opportunity name
   */
  clearName() {
    cy.get(OpportunityForm.selectors.nameInput).clear()
    return this
  }

  /**
   * Select company
   * @param {string} company - Company name or ID
   */
  selectCompany(company) {
    cy.get(OpportunityForm.selectors.companyInput).select(company)
    return this
  }

  /**
   * Select contact
   * @param {string} contact - Contact name or ID
   */
  selectContact(contact) {
    cy.get(OpportunityForm.selectors.contactInput).select(contact)
    return this
  }

  /**
   * Select pipeline
   * @param {string} pipeline - Pipeline name or ID
   */
  selectPipeline(pipeline) {
    cy.get(OpportunityForm.selectors.pipelineInput).select(pipeline)
    return this
  }

  /**
   * Select stage
   * @param {string} stage - Stage name or ID
   */
  selectStage(stage) {
    cy.get(OpportunityForm.selectors.stageInput).select(stage)
    return this
  }

  /**
   * Fill opportunity amount
   * @param {string|number} amount - Opportunity amount
   */
  fillAmount(amount) {
    cy.get(OpportunityForm.selectors.amountInput).clear().type(amount.toString())
    return this
  }

  /**
   * Clear opportunity amount
   */
  clearAmount() {
    cy.get(OpportunityForm.selectors.amountInput).clear()
    return this
  }

  /**
   * Fill probability percentage
   * @param {string|number} probability - Probability (0-100)
   */
  fillProbability(probability) {
    cy.get(OpportunityForm.selectors.probabilityInput).clear().type(probability.toString())
    return this
  }

  /**
   * Clear probability
   */
  clearProbability() {
    cy.get(OpportunityForm.selectors.probabilityInput).clear()
    return this
  }

  /**
   * Fill expected close date
   * @param {string} date - Date in YYYY-MM-DD format
   */
  fillExpectedCloseDate(date) {
    cy.get(OpportunityForm.selectors.expectedCloseDateInput).clear().type(date)
    return this
  }

  /**
   * Clear expected close date
   */
  clearExpectedCloseDate() {
    cy.get(OpportunityForm.selectors.expectedCloseDateInput).clear()
    return this
  }

  /**
   * Fill opportunity description
   * @param {string} description - Opportunity description
   */
  fillDescription(description) {
    cy.get(OpportunityForm.selectors.descriptionInput).clear().type(description)
    return this
  }

  /**
   * Clear description
   */
  clearDescription() {
    cy.get(OpportunityForm.selectors.descriptionInput).clear()
    return this
  }

  /**
   * Select owner
   * @param {string} owner - Owner name or ID
   */
  selectOwner(owner) {
    cy.get(OpportunityForm.selectors.ownerInput).select(owner)
    return this
  }

  /**
   * Select priority
   * @param {string} priority - Priority (low, medium, high)
   */
  selectPriority(priority) {
    cy.get(OpportunityForm.selectors.priorityInput).select(priority)
    return this
  }

  /**
   * Submit the form
   */
  submit() {
    cy.get(OpportunityForm.selectors.submitBtn).click()
    return this
  }

  /**
   * Cancel the form
   */
  cancel() {
    cy.get(OpportunityForm.selectors.cancelBtn).click()
    return this
  }

  /**
   * Validate submit button is enabled
   */
  validateSubmitEnabled() {
    cy.get(OpportunityForm.selectors.submitBtn).should('not.be.disabled')
    return this
  }

  /**
   * Validate submit button is disabled
   */
  validateSubmitDisabled() {
    cy.get(OpportunityForm.selectors.submitBtn).should('be.disabled')
    return this
  }

  /**
   * Validate form error message
   * @param {string} message - Expected error message
   */
  validateError(message) {
    cy.get(OpportunityForm.selectors.error).should('be.visible').and('contain', message)
    return this
  }

  /**
   * Validate no form error
   */
  validateNoError() {
    cy.get(OpportunityForm.selectors.error).should('not.exist')
    return this
  }

  /**
   * Validate field error
   * @param {string} fieldName - Field name
   */
  validateFieldError(fieldName) {
    const fieldSelector = OpportunityForm.selectors[`${fieldName}Field`]
    cy.get(fieldSelector).within(() => {
      cy.get(OpportunityForm.selectors.fieldError).should('exist')
    })
    return this
  }

  /**
   * Validate no field error
   * @param {string} fieldName - Field name
   */
  validateNoFieldError(fieldName) {
    const fieldSelector = OpportunityForm.selectors[`${fieldName}Field`]
    cy.get(fieldSelector).within(() => {
      cy.get(OpportunityForm.selectors.fieldError).should('not.exist')
    })
    return this
  }

  /**
   * Validate field value
   * @param {string} fieldName - Field name (name, amount, probability, etc.)
   * @param {string} value - Expected value
   */
  validateFieldValue(fieldName, value) {
    const inputSelector = OpportunityForm.selectors[`${fieldName}Input`]
    cy.get(inputSelector).should('have.value', value)
    return this
  }

  /**
   * Fill complete opportunity form
   * @param {Object} data - Opportunity data
   * @param {string} data.name - Opportunity name
   * @param {string} data.company - Company ID
   * @param {string} data.contact - Contact ID (optional)
   * @param {string} data.pipeline - Pipeline ID
   * @param {string} data.stage - Stage ID
   * @param {number} data.amount - Amount
   * @param {number} data.probability - Probability (optional)
   * @param {string} data.expectedCloseDate - Expected close date (optional)
   * @param {string} data.description - Description (optional)
   * @param {string} data.owner - Owner ID (optional)
   * @param {string} data.priority - Priority (optional)
   */
  fillForm(data) {
    if (data.name) this.fillName(data.name)
    if (data.company) this.selectCompany(data.company)
    if (data.contact) this.selectContact(data.contact)
    if (data.pipeline) this.selectPipeline(data.pipeline)
    if (data.stage) this.selectStage(data.stage)
    if (data.amount !== undefined) this.fillAmount(data.amount)
    if (data.probability !== undefined) this.fillProbability(data.probability)
    if (data.expectedCloseDate) this.fillExpectedCloseDate(data.expectedCloseDate)
    if (data.description) this.fillDescription(data.description)
    if (data.owner) this.selectOwner(data.owner)
    if (data.priority) this.selectPriority(data.priority)
    return this
  }

  /**
   * Create an opportunity (fill and submit)
   * @param {Object} data - Opportunity data
   */
  createOpportunity(data) {
    this.fillForm(data)
    this.submit()
    return this
  }
}
