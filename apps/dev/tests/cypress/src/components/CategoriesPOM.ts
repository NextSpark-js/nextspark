/**
 * Categories POM
 *
 * Page Object Model for Post Categories management.
 * Uses the generic Taxonomies UI component but intercepts the post-categories API.
 *
 * Architecture Note:
 * - UI Path: /dashboard/taxonomies (generic taxonomy manager component)
 * - UI Selectors: taxonomies-* / taxonomy-* (match React component data-cy)
 * - API Path: /api/v1/post-categories (specific endpoint for post categories)
 *
 * This separation allows the UI to be reusable while the API is entity-specific.
 *
 * @version 3.0 - Uses centralized selectors from cySelector()
 */

import { cySelector } from '../selectors'
import { ApiInterceptor } from '../helpers/ApiInterceptor'

export interface CategoryFormData {
  name: string
  slug?: string
  description?: string
  icon?: string
  color?: string
  parentId?: string
  order?: number
}

export class CategoriesPOM {
  // ============================================
  // API INTERCEPTOR (for deterministic waits)
  // ============================================

  private static _api: ApiInterceptor | null = null

  /**
   * Get the API interceptor instance for post-categories
   * Uses custom path since it's not a generic entity route
   */
  static get api(): ApiInterceptor {
    if (!this._api) {
      this._api = new ApiInterceptor({
        slug: 'categories',
        customPath: '/api/v1/post-categories'
      })
    }
    return this._api
  }

  /**
   * Setup API intercepts for CRUD operations
   * Call this in beforeEach BEFORE navigation
   */
  static setupApiIntercepts(): typeof CategoriesPOM {
    this.api.setupCrudIntercepts()
    return this
  }

  // ============================================
  // SELECTORS - Categories List (using centralized cySelector)
  // ============================================

  static get listSelectors() {
    return {
      page: cySelector('taxonomies.list.container'),
      table: 'table',
      createBtn: cySelector('taxonomies.list.createButton'),
      row: (id: string) => cySelector('taxonomies.list.row', { id }),
      rowGeneric: 'table tbody tr',
      editBtn: (id: string) => cySelector('taxonomies.list.editButton', { id }),
      deleteBtn: (id: string) => cySelector('taxonomies.list.deleteButton', { id }),
      confirmDelete: '[role="dialog"]',
      confirmDeleteBtn: '[role="dialog"] button:contains("Delete"), button.bg-destructive',
      cancelDeleteBtn: '[role="dialog"] button:contains("Cancel"),[role="dialog"] button[type="button"]:not(.bg-destructive)',
      emptyState: 'h3:contains("No"), div:contains("No categories")',
    }
  }

  // ============================================
  // SELECTORS - Category Form (using centralized cySelector)
  // ============================================

  static get formSelectors() {
    return {
      dialog: cySelector('taxonomies.form.dialog'),
      dialogFallback: '[role="dialog"]', // Fallback if data-cy not implemented
      nameInput: cySelector('taxonomies.form.nameInput'),
      slugInput: cySelector('taxonomies.form.slugInput'),
      descriptionInput: cySelector('taxonomies.form.descriptionInput'),
      iconInput: cySelector('taxonomies.form.iconInput'),
      colorInput: cySelector('taxonomies.form.colorInput'),
      parentSelect: cySelector('taxonomies.form.parentSelect'),
      orderInput: cySelector('taxonomies.form.orderInput'),
      saveButton: cySelector('taxonomies.form.saveButton'),
      cancelButton: cySelector('taxonomies.form.cancelButton'),
      cancelButtonFallback: '[role="dialog"] button:contains("Cancel")',
    }
  }

  // ============================================
  // SELECTORS - Confirm Delete Dialog (using centralized cySelector)
  // ============================================

  static get confirmDeleteSelectors() {
    return {
      dialog: cySelector('taxonomies.confirmDelete.dialog'),
      confirmButton: cySelector('taxonomies.confirmDelete.confirmButton'),
      cancelButton: cySelector('taxonomies.confirmDelete.cancelButton'),
    }
  }

  // ============================================
  // NAVIGATION
  // ============================================

  static visitCategoriesPage() {
    cy.visit('/dashboard/taxonomies')
    return this
  }

  // ============================================
  // API-AWARE NAVIGATION
  // ============================================

  /**
   * Visit categories page with API intercepts and wait for data load
   * Replaces: visitCategoriesPage() + waitForPageLoad() + cy.wait(...)
   */
  static visitWithApiWait(): typeof CategoriesPOM {
    this.setupApiIntercepts()
    this.visitCategoriesPage()
    this.waitForPageLoad()
    this.api.waitForList()
    return this
  }

  // ============================================
  // API-AWARE CRUD WORKFLOWS
  // ============================================

  /**
   * Create category with deterministic API waits
   * Replaces: createCategory() + cy.wait(2000)
   */
  static createCategoryWithApiWait(data: CategoryFormData): typeof CategoriesPOM {
    this.clickCreate()
    this.waitForDialogOpen()

    this.fillName(data.name)
    if (data.slug) this.fillSlug(data.slug)
    if (data.description) this.fillDescription(data.description)
    if (data.icon) this.fillIcon(data.icon)
    if (data.color) this.fillColor(data.color)

    this.saveCategory()
    this.api.waitForCreate()
    this.api.waitForRefresh()
    this.waitForDialogClose()

    return this
  }

  /**
   * Delete category with deterministic API waits
   */
  static deleteCategoryWithApiWait(id: string): typeof CategoriesPOM {
    this.clickDelete(id)
    this.confirmDelete()
    this.api.waitForDelete()
    this.api.waitForRefresh()
    return this
  }

  // ============================================
  // WAIT METHODS
  // ============================================

  static waitForPageLoad() {
    cy.url().should('include', '/dashboard/taxonomies')
    cy.get(this.listSelectors.page, { timeout: 15000 }).should('exist')
    return this
  }

  static waitForDialogOpen() {
    cy.get(this.formSelectors.dialog, { timeout: 10000 }).should('be.visible')
    return this
  }

  static waitForDialogClose() {
    cy.get(this.formSelectors.dialog, { timeout: 10000 }).should('not.exist')
    return this
  }

  // ============================================
  // LIST PAGE INTERACTIONS
  // ============================================

  static clickCreate() {
    cy.get(this.listSelectors.createBtn).click()
    return this
  }

  static clickEdit(id: string) {
    cy.get(this.listSelectors.editBtn(id)).click()
    return this
  }

  static clickDelete(id: string) {
    cy.get(this.listSelectors.deleteBtn(id)).click()
    return this
  }

  static confirmDelete() {
    cy.get(this.listSelectors.confirmDeleteBtn).click()
    return this
  }

  static cancelDelete() {
    cy.get(this.listSelectors.cancelDeleteBtn).click()
    return this
  }

  // ============================================
  // FORM INTERACTIONS
  // ============================================

  static fillName(name: string) {
    cy.get(this.formSelectors.nameInput).clear().type(name)
    return this
  }

  static fillSlug(slug: string) {
    cy.get(this.formSelectors.slugInput).clear().type(slug)
    return this
  }

  static fillDescription(description: string) {
    cy.get(this.formSelectors.descriptionInput).clear().type(description)
    return this
  }

  static fillIcon(icon: string) {
    cy.get(this.formSelectors.iconInput).clear().type(icon)
    return this
  }

  static fillColor(color: string) {
    cy.get(this.formSelectors.colorInput).clear().type(color)
    return this
  }

  static saveCategory() {
    cy.get(this.formSelectors.saveButton).click()
    return this
  }

  static cancelForm() {
    cy.get(this.formSelectors.cancelButton).click()
    return this
  }

  // ============================================
  // COMPLETE WORKFLOWS
  // ============================================

  /**
   * Create a new category with specified data
   */
  static createCategory(data: CategoryFormData) {
    this.clickCreate()
    this.waitForDialogOpen()

    this.fillName(data.name)

    if (data.slug) {
      this.fillSlug(data.slug)
    }

    if (data.description) {
      this.fillDescription(data.description)
    }

    if (data.icon) {
      this.fillIcon(data.icon)
    }

    if (data.color) {
      this.fillColor(data.color)
    }

    this.saveCategory()
    return this
  }

  /**
   * Edit an existing category
   */
  static editCategory(id: string, data: Partial<CategoryFormData>) {
    this.clickEdit(id)
    this.waitForDialogOpen()

    if (data.name) {
      this.fillName(data.name)
    }

    if (data.slug) {
      this.fillSlug(data.slug)
    }

    if (data.description) {
      this.fillDescription(data.description)
    }

    if (data.icon) {
      this.fillIcon(data.icon)
    }

    if (data.color) {
      this.fillColor(data.color)
    }

    this.saveCategory()
    return this
  }

  /**
   * Delete a category
   */
  static deleteCategory(id: string) {
    this.clickDelete(id)
    this.confirmDelete()
    return this
  }

  // ============================================
  // ASSERTIONS
  // ============================================

  static assertPageVisible() {
    cy.get(this.listSelectors.page).should('exist')
    return this
  }

  static assertCategoryInList(name: string) {
    cy.contains(this.listSelectors.rowGeneric, name).should('be.visible')
    return this
  }

  static assertCategoryNotInList(name: string) {
    cy.contains(this.listSelectors.rowGeneric, name).should('not.exist')
    return this
  }

  static assertEmptyList() {
    cy.get(this.listSelectors.emptyState).should('be.visible')
    return this
  }

  static assertDialogOpen() {
    cy.get(this.formSelectors.dialog).should('be.visible')
    return this
  }

  static assertDialogClosed() {
    cy.get(this.formSelectors.dialog).should('not.exist')
    return this
  }

  static assertColorBadgeVisible(color: string) {
    // Check for badge with the specified color (as background or border)
    cy.get(this.listSelectors.table).find(`[style*="${color}"]`).should('exist')
    return this
  }

  static assertSaveSuccess() {
    cy.contains('saved', { matchCase: false }).should('be.visible')
    return this
  }
}

export default CategoriesPOM
