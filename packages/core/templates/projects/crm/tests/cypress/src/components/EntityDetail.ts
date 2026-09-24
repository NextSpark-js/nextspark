/**
 * Generic Entity Detail POM for CRM Theme
 *
 * Page Object Model for entity detail pages in CRM theme.
 * Reusable for all entities by providing the entity slug and singular name.
 *
 * Usage:
 *   const contactDetail = new EntityDetail('contacts', 'contact')
 *   const opportunityDetail = new EntityDetail('opportunities', 'opportunity')
 */

export interface EntityDetailConfig {
  /** Plural entity slug for URL (e.g., 'contacts', 'opportunities') */
  entitySlug: string
  /** Singular entity name for selectors (e.g., 'contact', 'opportunity') */
  singularName: string
  /** Custom sections this entity has (e.g., ['activities', 'notes'] for contacts) */
  sections?: string[]
}

export class EntityDetail {
  private entitySlug: string
  private singularName: string
  private sections: string[]

  /**
   * Create a new EntityDetail POM instance
   * @param entitySlug - Plural entity slug for URL (e.g., 'contacts', 'opportunities')
   * @param singularName - Singular name for selectors (e.g., 'contact', 'opportunity')
   * @param sections - Custom sections this entity has
   */
  constructor(entitySlug: string, singularName: string, sections: string[] = []) {
    this.entitySlug = entitySlug
    this.singularName = singularName
    this.sections = sections
  }

  // ============================================
  // DYNAMIC SELECTORS
  // ============================================

  /**
   * Get selectors for this entity detail page
   */
  get selectors() {
    return {
      // Page container
      page: `[data-cy="${this.singularName}-detail-page"]`,

      // Header elements
      header: `[data-cy="${this.singularName}-detail-header"]`,
      title: `[data-cy="${this.singularName}-title"]`,
      backButton: `[data-cy="${this.singularName}-back-btn"]`,
      editButton: `[data-cy="${this.singularName}-edit-btn"]`,
      deleteButton: `[data-cy="${this.singularName}-delete-btn"]`,

      // Status
      statusBadge: `[data-cy="${this.singularName}-status-badge"]`,

      // Panels
      fieldsPanel: `[data-cy="${this.singularName}-fields-panel"]`,
      descriptionPanel: `[data-cy="${this.singularName}-description-panel"]`,

      // Dynamic section selector
      section: (sectionName: string) => `[data-cy="${this.singularName}-${sectionName}-section"]`,

      // Related item in a section (e.g., contact-activity-{id})
      relatedItem: (relatedType: string, id: string) => `[data-cy="${this.singularName}-${relatedType}-${id}"]`,

      // Generic panels (stats, etc.)
      statsCards: `[data-cy="${this.singularName}-stats-cards"]`,
    }
  }

  // ============================================
  // STATIC FACTORY METHODS
  // ============================================

  /**
   * Pre-configured entity detail configurations for CRM entities
   */
  static configs: Record<string, EntityDetailConfig> = {
    // Core CRM entities
    leads: { entitySlug: 'leads', singularName: 'lead', sections: ['activities', 'notes'] },
    contacts: { entitySlug: 'contacts', singularName: 'contact', sections: ['activities', 'notes', 'opportunities'] },
    companies: { entitySlug: 'companies', singularName: 'company', sections: ['contacts', 'opportunities', 'notes'] },
    opportunities: { entitySlug: 'opportunities', singularName: 'opportunity', sections: ['activities', 'notes'] },
    activities: { entitySlug: 'activities', singularName: 'activity', sections: [] },
    campaigns: { entitySlug: 'campaigns', singularName: 'campaign', sections: ['leads', 'activities'] },
    pipelines: { entitySlug: 'pipelines', singularName: 'pipeline', sections: ['stages'] },
    products: { entitySlug: 'products', singularName: 'product', sections: [] },
    notes: { entitySlug: 'notes', singularName: 'note', sections: [] },
  }

  /**
   * Create an EntityDetail from pre-configured entity name
   */
  static for(entityName: keyof typeof EntityDetail.configs): EntityDetail {
    const config = EntityDetail.configs[entityName]
    if (!config) {
      throw new Error(`Unknown entity: ${entityName}. Available: ${Object.keys(EntityDetail.configs).join(', ')}`)
    }
    return new EntityDetail(config.entitySlug, config.singularName, config.sections)
  }

  // ============================================
  // VALIDATION METHODS
  // ============================================

  /**
   * Validate the detail page is visible
   */
  validatePageVisible() {
    cy.get(this.selectors.page).should('be.visible')
    return this
  }

  /**
   * Validate the header is visible
   */
  validateHeaderVisible() {
    cy.get(this.selectors.header).should('be.visible')
    return this
  }

  /**
   * Validate the title text
   */
  validateTitle(expectedTitle: string) {
    cy.get(this.selectors.title).should('contain.text', expectedTitle)
    return this
  }

  /**
   * Validate the status badge has specific text
   */
  validateStatus(expectedStatus: string) {
    cy.get(this.selectors.statusBadge).should('contain.text', expectedStatus)
    return this
  }

  /**
   * Validate the fields panel is visible
   */
  validateFieldsPanelVisible() {
    cy.get(this.selectors.fieldsPanel).should('be.visible')
    return this
  }

  /**
   * Validate a custom section is visible
   */
  validateSectionVisible(sectionName: string) {
    cy.get(this.selectors.section(sectionName)).should('be.visible')
    return this
  }

  /**
   * Validate edit button is visible
   */
  validateEditButtonVisible() {
    cy.get(this.selectors.editButton).should('be.visible')
    return this
  }

  /**
   * Validate delete button is visible
   */
  validateDeleteButtonVisible() {
    cy.get(this.selectors.deleteButton).should('be.visible')
    return this
  }

  /**
   * Validate edit button is not visible (user doesn't have permission)
   */
  validateEditButtonHidden() {
    cy.get(this.selectors.editButton).should('not.exist')
    return this
  }

  /**
   * Validate delete button is not visible (user doesn't have permission)
   */
  validateDeleteButtonHidden() {
    cy.get(this.selectors.deleteButton).should('not.exist')
    return this
  }

  // ============================================
  // INTERACTION METHODS
  // ============================================

  /**
   * Click the back button to return to list
   */
  clickBack() {
    cy.get(this.selectors.backButton).click()
    cy.url().should('include', `/dashboard/${this.entitySlug}`)
    return this
  }

  /**
   * Click the edit button to open edit form
   */
  clickEdit() {
    cy.get(this.selectors.editButton).click()
    cy.url().should('include', '/edit')
    return this
  }

  /**
   * Click the delete button (will open confirmation dialog)
   */
  clickDelete() {
    cy.get(this.selectors.deleteButton).click()
    return this
  }

  /**
   * Confirm deletion in the dialog
   */
  confirmDelete() {
    cy.get('[data-cy="confirm-delete-btn"]').click()
    return this
  }

  /**
   * Cancel deletion in the dialog
   */
  cancelDelete() {
    cy.get('[data-cy="cancel-delete-btn"]').click()
    return this
  }

  /**
   * Click on a related item in a section
   */
  clickRelatedItem(relatedType: string, id: string) {
    cy.get(this.selectors.relatedItem(relatedType, id)).click()
    return this
  }

  // ============================================
  // WAIT METHODS
  // ============================================

  /**
   * Wait for the detail page to load
   */
  waitForPageLoad() {
    cy.get(this.selectors.page).should('be.visible')
    return this
  }

  /**
   * Visit the detail page directly
   */
  visit(id: string) {
    cy.visit(`/dashboard/${this.entitySlug}/${id}`)
    this.waitForPageLoad()
    return this
  }

  // ============================================
  // FIELD VALUE ASSERTIONS
  // ============================================

  /**
   * Assert a field value in the fields panel
   * Uses FieldDisplay component pattern
   */
  assertFieldValue(fieldLabel: string, expectedValue: string) {
    cy.get(this.selectors.fieldsPanel)
      .contains(fieldLabel)
      .parent()
      .should('contain.text', expectedValue)
    return this
  }

  /**
   * Assert the description panel contains text
   */
  assertDescriptionContains(text: string) {
    cy.get(this.selectors.descriptionPanel).should('contain.text', text)
    return this
  }
}

export default EntityDetail
