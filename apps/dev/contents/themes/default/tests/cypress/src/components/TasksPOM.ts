/**
 * Tasks Entity POM
 *
 * Entity-specific Page Object Model for Tasks in Default theme.
 * Extends generic EntityList/EntityForm with tasks-specific methods.
 *
 * Convention: tasks-{component}-{detail}
 * Examples: tasks-form, tasks-field-title, tasks-row-{id}
 */

import entitiesConfig from '../../fixtures/entities.json'

const tasksEntity = entitiesConfig.entities.tasks
const slug = tasksEntity.slug

export interface TaskFormData {
  title: string
  description?: string
  status?: 'todo' | 'in-progress' | 'review' | 'done' | 'blocked'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: string
  estimatedHours?: string
  completed?: boolean
}

export class TasksPOM {
  // ============================================
  // STATIC CONFIG
  // ============================================

  static get entityConfig() {
    return tasksEntity
  }

  static get slug() {
    return slug
  }

  // ============================================
  // SELECTORS
  // ============================================

  static get selectors() {
    return {
      // List page (EntityList uses slug-{element} convention)
      page: `[data-cy="${slug}-list"]`,           // Container div
      table: `[data-cy="${slug}-table"]`,          // Table element
      createBtn: `[data-cy="${slug}-add"]`,        // Add/Create button
      searchInput: `[data-cy="${slug}-search"]`,   // Search input
      rowGeneric: `[data-cy^="${slug}-row-"]`,     // Any row (prefix match)
      row: (id: string) => `[data-cy="${slug}-row-${id}"]`,

      // Form page
      formPage: `[data-cy="${slug}-form-page"]`,
      form: `[data-cy="${slug}-form"]`,
      formSubmit: `[data-cy="${slug}-form-submit"]`,
      formCancel: `[data-cy="${slug}-form-cancel"]`,

      // Fields
      field: (name: string) => `[data-cy="${slug}-field-${name}"]`,
      fieldInput: (name: string) => `[data-cy="${slug}-field-${name}"] input`,
      fieldTextarea: (name: string) => `[data-cy="${slug}-field-${name}"] textarea`,
      fieldSelect: (name: string) => `[data-cy="${slug}-field-${name}"] [role="combobox"]`,
      fieldOption: (name: string, value: string) => `[data-cy="${slug}-field-${name}-option-${value}"]`,

      // Row menu actions (EntityTable patterns)
      menuTrigger: (id: string) => `[data-cy="${slug}-menu-${id}"]`,
      menuEdit: (id: string) => `[data-cy="${slug}-menu-edit-${id}"]`,
      menuDelete: (id: string) => `[data-cy="${slug}-menu-delete-${id}"]`,
      menuView: (id: string) => `[data-cy="${slug}-menu-view-${id}"]`,

      // Dialogs
      confirmDelete: `[data-cy="${slug}-confirm-delete"]`,
      confirmDeleteBtn: `[data-cy="${slug}-confirm-delete-btn"]`,
      cancelDeleteBtn: `[data-cy="${slug}-cancel-delete-btn"]`,
    }
  }

  // ============================================
  // NAVIGATION
  // ============================================

  static visitList() {
    cy.visit(`/dashboard/${slug}`)
    return this
  }

  static visitCreate() {
    cy.visit(`/dashboard/${slug}/create`)
    return this
  }

  static visitEdit(id: string) {
    cy.visit(`/dashboard/${slug}/${id}/edit`)
    return this
  }

  // ============================================
  // WAIT METHODS
  // ============================================

  static waitForListLoad() {
    cy.url().should('include', `/dashboard/${slug}`)
    cy.get(this.selectors.page, { timeout: 15000 }).should('be.visible')
    return this
  }

  static waitForFormLoad() {
    cy.get(this.selectors.form, { timeout: 15000 }).should('be.visible')
    return this
  }

  // ============================================
  // LIST INTERACTIONS
  // ============================================

  static clickCreate() {
    cy.get(this.selectors.createBtn).click()
    return this
  }

  static search(term: string) {
    cy.get(this.selectors.searchInput).clear().type(term)
    return this
  }

  static clearSearch() {
    cy.get(this.selectors.searchInput).clear()
    return this
  }

  // ============================================
  // FORM METHODS
  // ============================================

  static fillTextField(fieldName: string, value: string) {
    cy.get(this.selectors.fieldInput(fieldName)).clear().type(value)
    return this
  }

  static fillTextarea(fieldName: string, value: string) {
    cy.get(this.selectors.fieldTextarea(fieldName)).clear().type(value)
    return this
  }

  static selectOption(fieldName: string, optionValue: string) {
    cy.get(this.selectors.fieldSelect(fieldName)).click()
    cy.get(this.selectors.fieldOption(fieldName, optionValue)).click()
    return this
  }

  static submitForm() {
    cy.get(this.selectors.formSubmit).click()
    return this
  }

  static cancelForm() {
    cy.get(this.selectors.formCancel).click()
    return this
  }

  /**
   * Fill task form with provided data
   */
  static fillTaskForm(data: TaskFormData) {
    if (data.title) {
      this.fillTextField('title', data.title)
    }
    if (data.description) {
      this.fillTextarea('description', data.description)
    }
    if (data.status) {
      this.selectOption('status', data.status)
    }
    if (data.priority) {
      this.selectOption('priority', data.priority)
    }
    if (data.dueDate) {
      this.fillTextField('dueDate', data.dueDate)
    }
    if (data.estimatedHours) {
      this.fillTextField('estimatedHours', data.estimatedHours)
    }
    return this
  }

  // ============================================
  // ACTIONS
  // ============================================

  static openRowMenu(id: string) {
    cy.get(this.selectors.menuTrigger(id)).click()
    return this
  }

  static clickMenuEdit(id: string) {
    cy.get(this.selectors.menuEdit(id)).click()
    return this
  }

  static clickMenuDelete(id: string) {
    cy.get(this.selectors.menuDelete(id)).click()
    return this
  }

  static clickMenuView(id: string) {
    cy.get(this.selectors.menuView(id)).click()
    return this
  }

  static confirmDelete() {
    cy.get(this.selectors.confirmDeleteBtn).click()
    return this
  }

  static cancelDelete() {
    cy.get(this.selectors.cancelDeleteBtn).click()
    return this
  }

  /**
   * Delete a task by finding it in the list and clicking delete
   */
  static deleteTaskByText(text: string) {
    cy.contains(this.selectors.rowGeneric, text).within(() => {
      cy.get('[data-cy*="delete"], button[aria-label*="delete" i]').click()
    })
    this.confirmDelete()
    return this
  }

  /**
   * Edit a task by finding it in the list and clicking edit
   */
  static editTaskByText(text: string) {
    cy.contains(this.selectors.rowGeneric, text).within(() => {
      cy.get('[data-cy*="edit"], button[aria-label*="edit" i]').click()
    })
    return this
  }

  // ============================================
  // ASSERTIONS
  // ============================================

  static assertTaskInList(title: string) {
    cy.contains(title).should('be.visible')
    return this
  }

  static assertTaskNotInList(title: string) {
    cy.contains(title).should('not.exist')
    return this
  }

  static assertPageVisible() {
    cy.get(this.selectors.page).should('be.visible')
    return this
  }

  static assertFormVisible() {
    cy.get(this.selectors.form).should('be.visible')
    return this
  }

  static assertTableVisible() {
    cy.get(this.selectors.table).should('be.visible')
    return this
  }
}

export default TasksPOM
