/**
 * Customers Entity POM
 *
 * Entity-specific Page Object Model for Customers in Default theme.
 * Extends generic EntityList/EntityForm with customer-specific methods.
 * Includes API-aware methods for deterministic testing with cy.intercept().
 *
 * Convention: customers-{component}-{detail}
 * Examples: customers-form, customers-field-name, customers-row-{id}
 */

import entitiesConfig from '../../fixtures/entities.json'
import { ApiInterceptor } from '../helpers/ApiInterceptor'

const customersEntity = entitiesConfig.entities.customers
const slug = customersEntity.slug

export interface CustomerFormData {
  name: string
  account: string
  office: string
  phone?: string
  salesRep?: string
  visitDays?: string[]
  contactDays?: string[]
}

export class CustomersPOM {
  // ============================================
  // STATIC CONFIG
  // ============================================

  static get entityConfig() {
    return customersEntity
  }

  static get slug() {
    return slug
  }

  // ============================================
  // API INTERCEPTOR (for deterministic waits)
  // ============================================

  private static _api: ApiInterceptor | null = null

  /**
   * Get the API interceptor instance for customers
   * Lazy-initialized on first access
   */
  static get api(): ApiInterceptor {
    if (!this._api) {
      this._api = new ApiInterceptor(slug)
    }
    return this._api
  }

  /**
   * Setup API intercepts for CRUD operations
   * Call this in beforeEach BEFORE navigation
   */
  static setupApiIntercepts(): typeof CustomersPOM {
    this.api.setupCrudIntercepts()
    return this
  }

  // ============================================
  // SELECTORS
  // ============================================

  static get selectors() {
    return {
      // List page (matches EntityList.tsx createCyId patterns)
      page: `[data-cy="${slug}-list"]`,
      table: `[data-cy="${slug}-table"]`,
      createBtn: `[data-cy="${slug}-add"]`,
      searchInput: `[data-cy="${slug}-search"]`,
      rowGeneric: `[data-cy^="${slug}-row-"]`,
      row: (id: string) => `[data-cy="${slug}-row-${id}"]`,

      // Form page (EntityForm patterns)
      formPage: `[data-cy="${slug}-form-page"]`,
      form: `[data-cy="${slug}-form"]`,
      formSubmit: `[data-cy="${slug}-form-submit"]`,
      formCancel: `[data-cy="${slug}-form-cancel"]`,

      // Fields (EntityForm field patterns)
      field: (name: string) => `[data-cy="${slug}-field-${name}"]`,
      fieldInput: (name: string) => `[data-cy="${slug}-field-${name}"] input`,
      fieldTextarea: (name: string) => `[data-cy="${slug}-field-${name}"] textarea`,
      fieldSelect: (name: string) => `[data-cy="${slug}-field-${name}"] [role="combobox"]`,
      fieldOption: (name: string, value: string) => `[data-cy="${slug}-field-${name}-option-${value}"]`,

      // Detail page actions (EntityDetail patterns)
      detailEdit: `[data-cy="${slug}-edit"]`,
      detailDelete: `[data-cy="${slug}-delete"]`,

      // Row menu actions (EntityTable patterns)
      menuTrigger: (id: string) => `[data-cy="${slug}-menu-${id}"]`,
      menuEdit: (id: string) => `[data-cy="${slug}-menu-edit-${id}"]`,
      menuDelete: (id: string) => `[data-cy="${slug}-menu-delete-${id}"]`,
      menuView: (id: string) => `[data-cy="${slug}-menu-view-${id}"]`,

      // Dialogs (EntityDetailWrapper patterns)
      confirmDelete: `[data-cy="confirm-delete"]`,
      confirmDeleteBtn: `[data-cy="confirm-delete"]`,
      cancelDeleteBtn: `[data-cy="cancel-delete"]`,
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

  static visitDetail(id: string) {
    cy.visit(`/dashboard/${slug}/${id}`)
    return this
  }

  // ============================================
  // API-AWARE NAVIGATION
  // ============================================

  /**
   * Visit list page with API intercepts and wait for data load
   * Replaces: visitList() + cy.wait(2000)
   */
  static visitListWithApiWait(): typeof CustomersPOM {
    this.setupApiIntercepts()
    this.visitList()
    this.api.waitForList()
    return this
  }

  /**
   * Visit edit page with API wait for data load
   */
  static visitEditWithApiWait(id: string): typeof CustomersPOM {
    this.setupApiIntercepts()
    this.visitEdit(id)
    this.waitForFormLoad()
    return this
  }

  /**
   * Visit detail page with API wait for data load
   */
  static visitDetailWithApiWait(id: string): typeof CustomersPOM {
    this.setupApiIntercepts()
    this.visitDetail(id)
    this.waitForDetailLoad()
    return this
  }

  // ============================================
  // API-AWARE CRUD WORKFLOWS
  // ============================================

  /**
   * Create customer with deterministic API waits
   * Replaces: fillForm() + submit() + cy.wait(2000)
   */
  static createWithApiWait(data: CustomerFormData): typeof CustomersPOM {
    this.clickCreate()
    this.waitForFormLoad()
    this.fillCustomerForm(data)
    this.submitForm()
    this.api.waitForCreate()
    this.api.waitForRefresh()
    return this
  }

  /**
   * Update customer with deterministic API waits
   * Note: Does NOT include waitForRefresh() as behavior varies by UI
   * (may stay on form or redirect to list). Add .api.waitForRefresh() if needed.
   */
  static updateWithApiWait(data: Partial<CustomerFormData>): typeof CustomersPOM {
    if (data.name) this.fillTextField('name', data.name)
    if (data.account) this.fillTextField('account', data.account)
    if (data.office) this.fillTextField('office', data.office)
    if (data.phone) this.fillTextField('phone', data.phone)
    if (data.salesRep) this.fillTextField('salesRep', data.salesRep)
    this.submitForm()
    this.api.waitForUpdate()
    return this
  }

  /**
   * Delete customer with deterministic API waits
   * Flow: Navigate to detail page -> Click delete -> Confirm -> Wait for delete
   */
  static deleteWithApiWait(id: string): typeof CustomersPOM {
    this.visitDetailWithApiWait(id)
    this.clickDetailDelete()
    this.confirmDelete()
    this.api.waitForDelete()
    return this
  }

  /**
   * Delete customer from list by name (with API waits)
   * Finds customer, navigates to detail, deletes
   */
  static deleteByNameWithApiWait(name: string): typeof CustomersPOM {
    this.clickCustomerInList(name)
    this.waitForDetailLoad()
    this.clickDetailDelete()
    this.confirmDelete()
    this.api.waitForDelete()
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

  static waitForDetailLoad() {
    cy.url().should('match', new RegExp(`/dashboard/${slug}/[a-z0-9-]+$`))
    cy.get(this.selectors.detailEdit, { timeout: 15000 }).should('be.visible')
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

  // ============================================
  // DETAIL PAGE INTERACTIONS
  // ============================================

  /**
   * Click edit button on detail page
   * (EntityDetail pattern - edit/delete are on detail page, not list)
   * Uses .first() because there may be multiple edit buttons (header + quick actions)
   */
  static clickDetailEdit() {
    cy.get(this.selectors.detailEdit).first().click()
    return this
  }

  /**
   * Click delete button on detail page
   * Uses .first() because there may be multiple delete buttons
   */
  static clickDetailDelete() {
    cy.get(this.selectors.detailDelete).first().click()
    return this
  }

  /**
   * Click customer name in list to navigate to detail page
   */
  static clickCustomerInList(name: string) {
    cy.contains(this.selectors.rowGeneric, name).within(() => {
      cy.get('a').first().click()
    })
    return this
  }

  /**
   * Fill customer form with provided data
   */
  static fillCustomerForm(data: CustomerFormData) {
    if (data.name) {
      this.fillTextField('name', data.name)
    }
    if (data.account) {
      this.fillTextField('account', data.account)
    }
    if (data.office) {
      this.fillTextField('office', data.office)
    }
    if (data.phone) {
      this.fillTextField('phone', data.phone)
    }
    if (data.salesRep) {
      this.fillTextField('salesRep', data.salesRep)
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
   * Delete a customer by finding it in the list and clicking delete
   */
  static deleteCustomerByText(text: string) {
    cy.contains(this.selectors.rowGeneric, text).within(() => {
      cy.get('[data-cy*="delete"], button[aria-label*="delete" i]').click()
    })
    this.confirmDelete()
    return this
  }

  /**
   * Edit a customer by finding it in the list and clicking edit
   */
  static editCustomerByText(text: string) {
    cy.contains(this.selectors.rowGeneric, text).within(() => {
      cy.get('[data-cy*="edit"], button[aria-label*="edit" i]').click()
    })
    return this
  }

  // ============================================
  // ASSERTIONS
  // ============================================

  static assertCustomerInList(name: string) {
    cy.contains(name).should('be.visible')
    return this
  }

  static assertCustomerNotInList(name: string) {
    cy.contains(name).should('not.exist')
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

export default CustomersPOM
