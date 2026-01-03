/**
 * Modal - Page Object Model Class
 */
export class Modal {
  static selectors = {
    modal: '[role="dialog"]',
    overlay: '.fixed.inset-0',
    closeButton: '[data-cy="close-modal"]',
    modalHeader: '.modal-header',
    modalBody: '.modal-body',
    modalFooter: '.modal-footer',
    confirmButton: '[data-cy="confirm-modal"]',
    cancelButton: '[data-cy="cancel-modal"]'
  }

  validateModalVisible() {
    cy.get(Modal.selectors.modal).should('be.visible')
    cy.get(Modal.selectors.overlay).should('be.visible')
    return this
  }

  closeModal() {
    cy.get(Modal.selectors.closeButton).click()
    cy.get(Modal.selectors.modal).should('not.exist')
    return this
  }

  closeWithOverlay() {
    cy.get(Modal.selectors.overlay).click({ force: true })
    cy.get(Modal.selectors.modal).should('not.exist')
    return this
  }

  confirmAction() {
    cy.get(Modal.selectors.confirmButton).click()
    return this
  }

  cancelAction() {
    cy.get(Modal.selectors.cancelButton).click()
    cy.get(Modal.selectors.modal).should('not.exist')
    return this
  }

  validateModalContent(expectedText) {
    if (expectedText) {
      cy.get(Modal.selectors.modalBody).should('contain.text', expectedText)
    } else {
      cy.get(Modal.selectors.modalBody).should('be.visible')
    }
    return this
  }

  // ========================================
  // MÉTODOS REQUERIDOS POR LOS TESTS
  // ========================================

  /**
   * Valida la estructura del modal
   */
  validateModalStructure() {
    cy.get(Modal.selectors.modal).should('be.visible')
    cy.get(Modal.selectors.modalHeader).should('be.visible')
    cy.get(Modal.selectors.modalBody).should('be.visible')
    cy.get(Modal.selectors.modalFooter).should('be.visible')
    return this
  }

  /**
   * Valida las acciones del modal
   */
  validateModalActions() {
    cy.get(Modal.selectors.confirmButton).should('be.visible')
    cy.get(Modal.selectors.cancelButton).should('be.visible')
    cy.get(Modal.selectors.closeButton).should('be.visible')
    return this
  }

  /**
   * Valida que el modal está cerrado
   */
  validateModalClosed() {
    cy.get(Modal.selectors.modal).should('not.exist')
    cy.get(Modal.selectors.overlay).should('not.exist')
    return this
  }

  /**
   * Valida modal en modo alto contraste
   */
  validateHighContrastModal() {
    cy.get('html.dark').within(() => {
      cy.get(Modal.selectors.modal).should('be.visible')
      cy.get(Modal.selectors.modal).should('have.css', 'background-color')
    })
    return this
  }

  // ========================================
  // MISSING METHODS FROM TESTS
  // ========================================

  /**
   * Cierra modal con botón
   */
  closeWithButton() {
    cy.get(Modal.selectors.closeButton).click()
    return this
  }

  /**
   * Cierra modal con tecla Escape
   */
  closeWithEscape() {
    cy.get('body').type('{esc}')
    return this
  }

  /**
   * Valida que la acción se ejecutó
   */
  validateActionExecuted() {
    // Verificar que el modal se cerró y la acción se completó
    cy.get('[data-cy="action-success"]').should('be.visible')
      .or(() => cy.get('[data-cy="success-message"]').should('be.visible'))
    return this
  }

  /**
   * Valida que la acción se canceló
   */
  validateActionCancelled() {
    // Verificar que el modal se cerró sin ejecutar la acción
    cy.get('[data-cy="action-cancelled"]').should('not.exist')
    cy.get(Modal.selectors.modal).should('not.exist')
    return this
  }

  /**
   * Valida atrapamiento de foco
   */
  validateFocusTrapping() {
    // Verificar que el foco se mantiene dentro del modal
    cy.get(Modal.selectors.modal).within(() => {
      cy.get(Modal.selectors.cancelButton).focus()
      cy.tab()
      cy.focused().should('be.within', Modal.selectors.modal)
    })
    return this
  }

  /**
   * Valida navegación por pestañas
   */
  validateTabNavigation() {
    cy.get(Modal.selectors.cancelButton).focus()
    cy.tab()
    cy.focused().should('have.attr', 'data-cy', 'confirm-modal')
    cy.tab()
    cy.focused().should('have.attr', 'data-cy', 'close-modal')
    return this
  }

  /**
   * Valida atributos ARIA
   */
  validateAriaAttributes() {
    cy.get(Modal.selectors.modal)
      .should('have.attr', 'role', 'dialog')
      .and('have.attr', 'aria-modal', 'true')
      .and('have.attr', 'aria-labelledby')
    return this
  }

  /**
   * Valida soporte de screen reader
   */
  validateScreenReaderSupport() {
    cy.get(Modal.selectors.modal)
      .should('have.attr', 'aria-describedby')
    cy.get(Modal.selectors.modalHeader)
      .should('have.attr', 'id')
    return this
  }

  /**
   * Valida tema específico del modal
   */
  validateModalTheme(theme) {
    if (theme === 'dark') {
      cy.get('html').should('have.class', 'dark')
      cy.get(Modal.selectors.modal)
        .should('have.css', 'background-color')
        .and('not.equal', 'rgb(255, 255, 255)')
    } else {
      cy.get(Modal.selectors.modal).should('be.visible')
    }
    return this
  }
}
