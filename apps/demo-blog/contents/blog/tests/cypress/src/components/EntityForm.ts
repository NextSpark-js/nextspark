/**
 * Generic Entity Form POM
 *
 * Page Object Model for entity create/edit forms in Blog theme.
 * Uses standardized data-cy selectors from entities.json.
 *
 * Convention: {slug}-{component}-{detail}
 * Examples: posts-form, categories-field-name, posts-form-submit
 *
 * Usage:
 *   const postForm = EntityForm.for('posts')
 *   const categoryForm = EntityForm.for('categories')
 */

// Import entity configs from theme
import entitiesConfig from '../../fixtures/entities.json'

export interface EntityConfig {
  slug: string
  singular: string
  plural: string
  tableName: string
  fields: string[]
  sections: string[]
  filters: string[]
}

export class EntityForm {
  protected config: EntityConfig
  protected slug: string

  /**
   * Create a new EntityForm POM instance from entity config
   */
  constructor(entityKey: string) {
    const config = entitiesConfig.entities[entityKey as keyof typeof entitiesConfig.entities]
    if (!config) {
      throw new Error(`Unknown entity: ${entityKey}. Available: ${Object.keys(entitiesConfig.entities).join(', ')}`)
    }
    this.config = config as EntityConfig
    this.slug = config.slug
  }

  // ============================================
  // STATIC FACTORY METHOD
  // ============================================

  /**
   * Create an EntityForm from entity key
   */
  static for(entityKey: string): EntityForm {
    return new EntityForm(entityKey)
  }

  // ============================================
  // DYNAMIC SELECTORS (from entities.json convention)
  // ============================================

  /**
   * Get selectors for this entity form following the standard convention
   */
  get selectors() {
    const slug = this.slug
    return {
      // Page and form containers
      page: `[data-cy="${slug}-form-page"]`,
      form: `[data-cy="${slug}-form"]`,
      pageTitle: '[data-cy="page-title"]',

      // Buttons
      submitButton: `[data-cy="${slug}-form-submit"]`,
      cancelButton: `[data-cy="${slug}-form-cancel"]`,

      // Sections
      section: (sectionName: string) => `[data-cy="${slug}-section-${sectionName}"]`,

      // Fields
      field: (fieldName: string) => `[data-cy="${slug}-field-${fieldName}"]`,
      fieldInput: (fieldName: string) => `[data-cy="${slug}-field-${fieldName}"] input`,
      fieldTextarea: (fieldName: string) => `[data-cy="${slug}-field-${fieldName}"] textarea`,
      fieldSelect: (fieldName: string) => `[data-cy="${slug}-field-${fieldName}"] [role="combobox"]`,
      fieldCheckbox: (fieldName: string) => `[data-cy="${slug}-field-${fieldName}"] input[type="checkbox"]`,
      fieldOption: (fieldName: string, value: string) => `[data-cy="${slug}-field-${fieldName}-option-${value}"]`,
      fieldError: (fieldName: string) => `[data-cy="${slug}-field-${fieldName}-error"]`,
    }
  }

  /**
   * Get the entity config
   */
  get entityConfig(): EntityConfig {
    return this.config
  }

  /**
   * Get available fields for this entity
   */
  get fields(): string[] {
    return this.config.fields
  }

  /**
   * Get available sections for this entity
   */
  get sections(): string[] {
    return this.config.sections
  }

  // ============================================
  // VALIDATION METHODS
  // ============================================

  /**
   * Validate the form page is visible
   */
  validatePageVisible() {
    cy.get(this.selectors.page).should('be.visible')
    return this
  }

  /**
   * Validate the form is visible
   */
  validateFormVisible() {
    cy.get(this.selectors.form).should('be.visible')
    return this
  }

  /**
   * Validate the page title text
   */
  validatePageTitle(expectedTitle: string) {
    cy.get(this.selectors.pageTitle).should('contain.text', expectedTitle)
    return this
  }

  /**
   * Validate a section is visible
   */
  validateSectionVisible(sectionName: string) {
    cy.get(this.selectors.section(sectionName)).should('be.visible')
    return this
  }

  /**
   * Validate a field is visible
   */
  validateFieldVisible(fieldName: string) {
    cy.get(this.selectors.field(fieldName)).should('be.visible')
    return this
  }

  /**
   * Validate a field has an error message
   */
  validateFieldHasError(fieldName: string, errorMessage?: string) {
    const errorSelector = this.selectors.fieldError(fieldName)
    cy.get(errorSelector).should('be.visible')
    if (errorMessage) {
      cy.get(errorSelector).should('contain.text', errorMessage)
    }
    return this
  }

  /**
   * Validate submit button is enabled
   */
  validateSubmitEnabled() {
    cy.get(this.selectors.submitButton).should('not.be.disabled')
    return this
  }

  /**
   * Validate submit button is disabled
   */
  validateSubmitDisabled() {
    cy.get(this.selectors.submitButton).should('be.disabled')
    return this
  }

  // ============================================
  // INPUT METHODS
  // ============================================

  /**
   * Type into a text input field
   */
  typeInField(fieldName: string, value: string) {
    cy.get(this.selectors.fieldInput(fieldName)).clear().type(value)
    return this
  }

  /**
   * Type into a textarea field
   */
  typeInTextarea(fieldName: string, value: string) {
    cy.get(this.selectors.fieldTextarea(fieldName)).clear().type(value)
    return this
  }

  /**
   * Clear a text input field
   */
  clearField(fieldName: string) {
    cy.get(this.selectors.fieldInput(fieldName)).clear()
    return this
  }

  /**
   * Select an option from a select/combobox field
   */
  selectOption(fieldName: string, optionValue: string) {
    cy.get(this.selectors.fieldSelect(fieldName)).click()
    cy.get(this.selectors.fieldOption(fieldName, optionValue)).click()
    return this
  }

  /**
   * Check a checkbox field
   */
  checkField(fieldName: string) {
    cy.get(this.selectors.fieldCheckbox(fieldName)).check()
    return this
  }

  /**
   * Uncheck a checkbox field
   */
  uncheckField(fieldName: string) {
    cy.get(this.selectors.fieldCheckbox(fieldName)).uncheck()
    return this
  }

  /**
   * Fill a date input field
   */
  fillDate(fieldName: string, dateString: string) {
    cy.get(this.selectors.fieldInput(fieldName)).clear().type(dateString)
    return this
  }

  // ============================================
  // FORM SUBMISSION METHODS
  // ============================================

  /**
   * Click the submit button
   */
  submit() {
    cy.get(this.selectors.submitButton).click()
    return this
  }

  /**
   * Click the cancel button
   */
  cancel() {
    cy.get(this.selectors.cancelButton).click()
    return this
  }

  // ============================================
  // BULK FILL METHODS
  // ============================================

  /**
   * Fill multiple fields at once
   */
  fillForm(data: Record<string, string | boolean>) {
    Object.entries(data).forEach(([fieldName, value]) => {
      if (typeof value === 'boolean') {
        if (value) {
          this.checkField(fieldName)
        } else {
          this.uncheckField(fieldName)
        }
      } else {
        // Try input first, then textarea
        cy.get(this.selectors.field(fieldName)).then($field => {
          const hasInput = $field.find('input:not([type="checkbox"])').length > 0
          const hasTextarea = $field.find('textarea').length > 0
          const hasSelect = $field.find('[role="combobox"]').length > 0

          if (hasInput) {
            this.typeInField(fieldName, value)
          } else if (hasTextarea) {
            this.typeInTextarea(fieldName, value)
          } else if (hasSelect) {
            this.selectOption(fieldName, value)
          }
        })
      }
    })
    return this
  }

  // ============================================
  // NAVIGATION METHODS
  // ============================================

  /**
   * Visit the create form page
   */
  visitCreate() {
    cy.visit(`/dashboard/${this.slug}/create`)
    this.validatePageVisible()
    return this
  }

  /**
   * Visit the edit form page
   */
  visitEdit(id: string) {
    cy.visit(`/dashboard/${this.slug}/${id}/edit`)
    this.validatePageVisible()
    return this
  }

  /**
   * Wait for form to be ready (all fields loaded)
   */
  waitForFormReady() {
    cy.get(this.selectors.form).should('be.visible')
    cy.get(this.selectors.submitButton).should('be.visible')
    return this
  }

  // ============================================
  // ASSERTION HELPERS
  // ============================================

  /**
   * Assert field has specific value
   */
  assertFieldValue(fieldName: string, expectedValue: string) {
    cy.get(this.selectors.fieldInput(fieldName)).should('have.value', expectedValue)
    return this
  }

  /**
   * Assert textarea has specific value
   */
  assertTextareaValue(fieldName: string, expectedValue: string) {
    cy.get(this.selectors.fieldTextarea(fieldName)).should('have.value', expectedValue)
    return this
  }

  /**
   * Assert select displays specific option
   */
  assertSelectValue(fieldName: string, expectedText: string) {
    cy.get(this.selectors.fieldSelect(fieldName)).should('contain.text', expectedText)
    return this
  }
}

export default EntityForm
