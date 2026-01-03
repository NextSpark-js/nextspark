/**
 * EntityForm - Page Object Model Class
 *
 * Generic POM for entity create/edit forms.
 * Supports dynamic entity slugs for any entity type.
 */
export class EntityForm {
  static selectors = {
    form: '[data-cy$="-form"]',
    submitButton: '[data-cy$="-form-submit"]',
    cancelButton: '[data-cy$="-form-cancel"]',
  }

  /**
   * Get entity-specific selectors
   * @param {string} entitySlug - The entity slug (e.g., 'tasks', 'users')
   */
  static getEntitySelectors(entitySlug) {
    return {
      form: `[data-cy="${entitySlug}-form"]`,
      submitButton: `[data-cy="${entitySlug}-form-submit"]`,
      cancelButton: `[data-cy="${entitySlug}-form-cancel"]`,
    }
  }

  /**
   * @param {string} entitySlug - The entity slug
   */
  constructor(entitySlug) {
    this.entitySlug = entitySlug
    this.selectors = EntityForm.getEntitySelectors(entitySlug)
  }

  /**
   * Validate form is visible
   */
  validateFormVisible() {
    cy.get(this.selectors.form).should('be.visible')
    return this
  }

  /**
   * Validate form is hidden/not visible
   */
  validateFormHidden() {
    cy.get(this.selectors.form).should('not.exist')
    return this
  }

  /**
   * Fill a specific field
   * @param {string} fieldName - The field name
   * @param {string} value - The value to fill
   */
  fillField(fieldName, value) {
    cy.get(`[data-cy="${this.entitySlug}-field-${fieldName}"]`).within(() => {
      cy.get('input, textarea, select').first().clear().type(value)
    })
    return this
  }

  /**
   * Fill a field by its label text
   * @param {string} label - The label text
   * @param {string} value - The value to fill
   */
  fillFieldByLabel(label, value) {
    cy.get(this.selectors.form).within(() => {
      // First try to find by label text
      cy.contains('label', label).then($label => {
        const forAttr = $label.attr('for')
        if (forAttr) {
          // If label has 'for' attribute, use it
          cy.get(`#${forAttr}`).then($input => {
            this._fillInput($input, value)
          })
        } else {
          // Otherwise find input within label's parent container
          cy.wrap($label).parent().find('input, textarea, select, [role="combobox"]').first().then($input => {
            this._fillInput($input, value)
          })
        }
      })
    })
    return this
  }

  /**
   * Helper method to fill different input types
   * @private
   */
  _fillInput($input, value) {
    const tagName = $input.prop('tagName').toLowerCase()
    const inputType = $input.attr('type')
    const role = $input.attr('role')

    if (tagName === 'select') {
      cy.wrap($input).select(value)
    } else if (role === 'combobox') {
      // Custom select component
      cy.wrap($input).click()
      cy.get(`[role="option"]:contains("${value}")`).first().click()
    } else if (inputType === 'checkbox') {
      if (value === true || value === 'true' || value === 'checked') {
        cy.wrap($input).check()
      } else {
        cy.wrap($input).uncheck()
      }
    } else {
      cy.wrap($input).clear().type(value)
    }
  }

  /**
   * Clear and fill a field by its label
   * @param {string} label - The label text
   * @param {string} value - The value to fill
   */
  clearAndFillFieldByLabel(label, value) {
    return this.fillFieldByLabel(label, value)
  }

  /**
   * Clear a field by its label
   * @param {string} label - The label text
   */
  clearFieldByLabel(label) {
    cy.get(this.selectors.form).within(() => {
      cy.contains('label', label).then($label => {
        const forAttr = $label.attr('for')
        if (forAttr) {
          cy.get(`#${forAttr}`).clear()
        } else {
          cy.wrap($label).parent().find('input, textarea').first().clear()
        }
      })
    })
    return this
  }

  /**
   * Clear a specific field
   * @param {string} fieldName - The field name
   */
  clearField(fieldName) {
    cy.get(`[data-cy="${this.entitySlug}-field-${fieldName}"]`).within(() => {
      cy.get('input, textarea').first().clear()
    })
    return this
  }

  /**
   * Get field wrapper
   * @param {string} fieldName - The field name
   */
  getField(fieldName) {
    return cy.get(`[data-cy="${this.entitySlug}-field-${fieldName}"]`)
  }

  /**
   * Validate field has error
   * @param {string} fieldName - The field name or label
   * @param {string} message - Expected error message (optional)
   */
  validateFieldError(fieldName, message = null) {
    // Try by data-cy first
    cy.get('body').then($body => {
      const fieldSelector = `[data-cy="${this.entitySlug}-field-${fieldName}"]`
      if ($body.find(fieldSelector).length > 0) {
        cy.get(fieldSelector).within(() => {
          cy.get('[class*="error"], [data-error="true"], .text-destructive, [class*="destructive"]').should('exist')
          if (message) {
            cy.contains(message).should('be.visible')
          }
        })
      } else {
        // Try by label
        cy.get(this.selectors.form).within(() => {
          cy.contains('label', fieldName).parent().within(() => {
            cy.get('[class*="error"], [data-error="true"], .text-destructive, [class*="destructive"]').should('exist')
          })
        })
      }
    })
    return this
  }

  /**
   * Validate field is visible
   * @param {string} fieldName - The field name
   */
  validateFieldVisible(fieldName) {
    cy.get(`[data-cy="${this.entitySlug}-field-${fieldName}"]`).should('be.visible')
    return this
  }

  /**
   * Submit the form
   */
  submit() {
    cy.get(this.selectors.submitButton).click()
    return this
  }

  /**
   * Submit the form (alias for submit)
   */
  submitForm() {
    return this.submit()
  }

  /**
   * Cancel the form
   */
  cancel() {
    cy.get(this.selectors.cancelButton).click()
    return this
  }

  /**
   * Cancel the form (alias for cancel)
   */
  cancelForm() {
    return this.cancel()
  }

  /**
   * Validate submit button is disabled
   */
  validateSubmitDisabled() {
    cy.get(this.selectors.submitButton).should('be.disabled')
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
   * Validate submit button is enabled (alias)
   */
  validateSubmitButtonEnabled() {
    return this.validateSubmitEnabled()
  }

  /**
   * Fill multiple fields at once
   * @param {Object} fields - Object with fieldName: value pairs
   */
  fillFields(fields) {
    Object.entries(fields).forEach(([fieldName, value]) => {
      this.fillField(fieldName, value)
    })
    return this
  }

  /**
   * Select an option in a dropdown/select field
   * @param {string} fieldName - The field name
   * @param {string} value - The value or label to select
   */
  selectField(fieldName, value) {
    cy.get(`[data-cy="${this.entitySlug}-field-${fieldName}"]`).within(() => {
      // Try native select first
      cy.get('body').then(() => {
        cy.get('select').then($select => {
          if ($select.length > 0) {
            // Native select element
            cy.wrap($select).select(value)
          } else {
            // Custom select component (e.g., shadcn/ui Select)
            // Click to open dropdown
            cy.get('[role="combobox"], button, [data-trigger]').first().click()
          }
        })
      })
    })
    // For custom selects, select the option from the dropdown
    cy.get('body').then($body => {
      if ($body.find(`[role="option"]:contains("${value}")`).length > 0) {
        cy.get(`[role="option"]:contains("${value}")`).first().click()
      } else if ($body.find(`[data-value="${value}"]`).length > 0) {
        cy.get(`[data-value="${value}"]`).first().click()
      }
    })
    return this
  }

  /**
   * Check or uncheck a checkbox field
   * @param {string} fieldName - The field name
   * @param {boolean} checked - Whether to check (true) or uncheck (false)
   */
  checkField(fieldName, checked = true) {
    cy.get(`[data-cy="${this.entitySlug}-field-${fieldName}"]`).within(() => {
      cy.get('input[type="checkbox"]').then($checkbox => {
        if (checked && !$checkbox.prop('checked')) {
          cy.wrap($checkbox).check()
        } else if (!checked && $checkbox.prop('checked')) {
          cy.wrap($checkbox).uncheck()
        }
      })
    })
    return this
  }

  /**
   * Validate field has a specific value
   * @param {string} fieldName - The field name or label
   * @param {string} expectedValue - The expected value
   */
  validateFieldValue(fieldName, expectedValue) {
    cy.get('body').then($body => {
      const fieldSelector = `[data-cy="${this.entitySlug}-field-${fieldName}"]`
      if ($body.find(fieldSelector).length > 0) {
        cy.get(fieldSelector).within(() => {
          cy.get('input, textarea, select').first().should('have.value', expectedValue)
        })
      } else {
        // Try by label
        cy.get(this.selectors.form).within(() => {
          cy.contains('label', fieldName).then($label => {
            const forAttr = $label.attr('for')
            if (forAttr) {
              cy.get(`#${forAttr}`).should('have.value', expectedValue)
            } else {
              cy.wrap($label).parent().find('input, textarea, select').first().should('have.value', expectedValue)
            }
          })
        })
      }
    })
    return this
  }
}
