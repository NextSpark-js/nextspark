/**
 * DashboardEntityPOM - Base class for all entity Page Object Models
 *
 * Provides standard CRUD operations for dashboard entities:
 * - Navigation (list, create, edit, detail pages)
 * - Table interactions (search, filters, pagination, row actions)
 * - Form operations (fill fields, submit, cancel)
 * - API interceptor integration for deterministic waits
 * - Bulk actions
 * - Delete confirmation dialogs
 *
 * Entity POMs should extend this class and add entity-specific methods.
 *
 * @example
 * class TasksPOM extends DashboardEntityPOM {
 *   constructor() {
 *     super('tasks')
 *   }
 *
 *   fillTaskForm(data: TaskFormData) {
 *     // Entity-specific form handling
 *   }
 * }
 */

import { BasePOM } from './BasePOM'
import { cySelector } from '../selectors'
import entitiesConfig from '../../fixtures/entities.json'
import { ApiInterceptor } from '../helpers/ApiInterceptor'

export interface EntityConfig {
  slug: string
  singular: string
  plural: string
  tableName: string
  fields: string[]
  filters: string[]
}

export abstract class DashboardEntityPOM extends BasePOM {
  protected slug: string
  protected entityConfig: EntityConfig
  protected _api: ApiInterceptor | null = null

  /**
   * Get the entity slug (public accessor)
   * Useful for building dynamic selectors and URLs in tests
   */
  get entitySlug(): string {
    return this.slug
  }

  constructor(entitySlug: string) {
    super()
    // Find entity config by slug
    const entry = Object.entries(entitiesConfig.entities).find(([, config]) => config.slug === entitySlug)
    if (!entry) {
      throw new Error(
        `Unknown entity slug: ${entitySlug}. Available: ${Object.values(entitiesConfig.entities).map(e => e.slug).join(', ')}`
      )
    }
    this.entityConfig = entry[1] as EntityConfig
    this.slug = entitySlug
  }

  // ============================================
  // API INTERCEPTOR
  // ============================================

  /**
   * Get or create ApiInterceptor instance for this entity
   */
  get api(): ApiInterceptor {
    if (!this._api) {
      this._api = new ApiInterceptor(this.slug)
    }
    return this._api
  }

  /**
   * Setup API intercepts for all CRUD operations
   * Call this BEFORE navigation
   */
  setupApiIntercepts() {
    this.api.setupCrudIntercepts()
    return this
  }

  // ============================================
  // SELECTORS (from centralized selectors.ts)
  // ============================================

  /**
   * Get all selectors for this entity, with placeholders replaced
   */
  get selectors() {
    const slug = this.slug

    return {
      // Page
      page: cySelector('entities.page.container', { slug }),
      pageTitle: cySelector('entities.page.title', { slug }),

      // Table
      tableContainer: cySelector('entities.table.container', { slug }),
      table: cySelector('entities.table.element', { slug }),
      addButton: cySelector('entities.table.addButton', { slug }),
      search: cySelector('entities.search.input', { slug }),
      searchContainer: cySelector('entities.search.container', { slug }),
      searchClear: cySelector('entities.search.clear', { slug }),
      selectAll: cySelector('entities.table.selectAll', { slug }),
      selectionCount: cySelector('entities.table.selectionCount', { slug }),
      row: (id: string) => cySelector('entities.table.row', { slug, id }),
      rowSelect: (id: string) => cySelector('entities.table.rowSelect', { slug, id }),
      rowMenu: (id: string) => cySelector('entities.table.rowMenu', { slug, id }),
      rowAction: (action: string, id: string) => cySelector('entities.table.rowAction', { slug, action, id }),
      cell: (field: string, id: string) => cySelector('entities.table.cell', { slug, field, id }),
      rowGeneric: `[data-cy^="${slug}-row-"]`,

      // Pagination
      pagination: cySelector('entities.pagination.container', { slug }),
      pageSize: cySelector('entities.pagination.pageSize', { slug }),
      pageSizeOption: (size: string) => cySelector('entities.pagination.pageSizeOption', { slug, size }),
      pageInfo: cySelector('entities.pagination.pageInfo', { slug }),
      pageFirst: cySelector('entities.pagination.first', { slug }),
      pagePrev: cySelector('entities.pagination.prev', { slug }),
      pageNext: cySelector('entities.pagination.next', { slug }),
      pageLast: cySelector('entities.pagination.last', { slug }),

      // Header (detail pages) - modes: view, edit, create
      viewHeader: cySelector('entities.header.container', { slug, mode: 'view' }),
      editHeader: cySelector('entities.header.container', { slug, mode: 'edit' }),
      createHeader: cySelector('entities.header.container', { slug, mode: 'create' }),
      backButton: cySelector('entities.header.backButton', { slug }),
      editButton: cySelector('entities.header.editButton', { slug }),
      deleteButton: cySelector('entities.header.deleteButton', { slug }),
      copyId: cySelector('entities.header.copyId', { slug }),
      title: cySelector('entities.header.title', { slug }),

      // Delete confirmation
      deleteDialog: cySelector('entities.header.deleteDialog', { slug }),
      deleteCancel: cySelector('entities.header.deleteCancel', { slug }),
      deleteConfirm: cySelector('entities.header.deleteConfirm', { slug }),

      // Form
      form: cySelector('entities.form.container', { slug }),
      field: (name: string) => cySelector('entities.form.field', { slug, name }),
      submitButton: cySelector('entities.form.submitButton', { slug }),

      // Filters
      filter: (field: string) => cySelector('entities.filter.container', { slug, field }),
      filterTrigger: (field: string) => cySelector('entities.filter.trigger', { slug, field }),
      filterContent: (field: string) => cySelector('entities.filter.content', { slug, field }),
      filterOption: (field: string, value: string) => cySelector('entities.filter.option', { slug, field, value }),
      filterBadge: (field: string, value: string) => cySelector('entities.filter.badge', { slug, field, value }),
      filterRemoveBadge: (field: string, value: string) =>
        cySelector('entities.filter.removeBadge', { slug, field, value }),
      filterClearAll: (field: string) => cySelector('entities.filter.clearAll', { slug, field }),

      // Bulk actions
      bulkBar: cySelector('entities.bulk.bar', { slug }),
      bulkCount: cySelector('entities.bulk.count', { slug }),
      bulkSelectAll: cySelector('entities.bulk.selectAll', { slug }),
      bulkStatus: cySelector('entities.bulk.statusButton', { slug }),
      bulkDelete: cySelector('entities.bulk.deleteButton', { slug }),
      bulkClear: cySelector('entities.bulk.clearButton', { slug }),

      // Bulk status dialog
      bulkStatusDialog: cySelector('entities.bulk.statusDialog', { slug }),
      bulkStatusSelect: cySelector('entities.bulk.statusSelect', { slug }),
      bulkStatusOption: (value: string) => cySelector('entities.bulk.statusOption', { slug, value }),
      bulkStatusCancel: cySelector('entities.bulk.statusCancel', { slug }),
      bulkStatusConfirm: cySelector('entities.bulk.statusConfirm', { slug }),

      // Bulk delete dialog
      bulkDeleteDialog: cySelector('entities.bulk.deleteDialog', { slug }),
      bulkDeleteCancel: cySelector('entities.bulk.deleteCancel', { slug }),
      bulkDeleteConfirm: cySelector('entities.bulk.deleteConfirm', { slug }),

      // Generic confirm dialog
      confirmDialog: cySelector('entities.confirm.dialog', { slug }),
      confirmCancel: cySelector('entities.confirm.cancel', { slug }),
      confirmAction: cySelector('entities.confirm.action', { slug }),

      // Parent delete confirmation (EntityDetailWrapper - generic, no slug)
      parentDeleteConfirm: '[data-cy="confirm-delete"]',
      parentDeleteCancel: '[data-cy="cancel-delete"]',

      // Row action selectors (generic patterns for checking existence)
      rowActionEditGeneric: `[data-cy^="${slug}-action-edit-"]`,
      rowActionDeleteGeneric: `[data-cy^="${slug}-action-delete-"]`,

      // Detail view
      detail: cySelector('entities.detail.container', { slug })
    }
  }

  // ============================================
  // NAVIGATION
  // ============================================

  /**
   * Navigate to entity list page
   */
  visitList() {
    cy.visit(`/dashboard/${this.slug}`)
    return this
  }

  /**
   * Navigate to create page
   */
  visitCreate() {
    cy.visit(`/dashboard/${this.slug}/create`)
    return this
  }

  /**
   * Navigate to edit page for specific entity
   */
  visitEdit(id: string) {
    cy.visit(`/dashboard/${this.slug}/${id}/edit`)
    return this
  }

  /**
   * Navigate to detail/view page for specific entity
   */
  visitDetail(id: string) {
    cy.visit(`/dashboard/${this.slug}/${id}`)
    return this
  }

  /**
   * Navigate to list and go to create form
   */
  goToList() {
    return this.visitList()
  }

  /**
   * Navigate to create page
   */
  goToCreate() {
    return this.visitCreate()
  }

  /**
   * Navigate to edit page
   */
  goToEdit(id: string) {
    return this.visitEdit(id)
  }

  // ============================================
  // API-AWARE NAVIGATION
  // ============================================

  /**
   * Navigate to list and wait for API response
   */
  visitListWithApiWait() {
    this.setupApiIntercepts()
    this.visitList()
    this.api.waitForList()
    return this
  }

  /**
   * Navigate to edit page and wait for form to be visible
   */
  visitEditWithApiWait(id: string) {
    this.setupApiIntercepts()
    this.visitEdit(id)
    this.waitForForm()
    return this
  }

  /**
   * Navigate to detail page and wait for content
   */
  visitDetailWithApiWait(id: string) {
    this.setupApiIntercepts()
    this.visitDetail(id)
    this.waitForDetail()
    return this
  }

  // ============================================
  // WAITS
  // ============================================

  /**
   * Wait for list page to be fully loaded
   */
  waitForList() {
    cy.url().should('include', `/dashboard/${this.slug}`)
    cy.get(this.selectors.tableContainer, { timeout: 15000 }).should('be.visible')
    return this
  }

  /**
   * Wait for form to be visible
   */
  waitForForm() {
    cy.get(this.selectors.form, { timeout: 15000 }).should('be.visible')
    return this
  }

  /**
   * Wait for detail page to be loaded
   */
  waitForDetail() {
    cy.url().should('match', new RegExp(`/dashboard/${this.slug}/[a-z0-9-]+$`))
    cy.get(this.selectors.editButton, { timeout: 15000 }).should('be.visible')
    return this
  }

  // ============================================
  // TABLE ACTIONS
  // ============================================

  /**
   * Click the Add/Create button
   */
  clickAdd() {
    cy.get(this.selectors.addButton).click()
    return this
  }

  /**
   * Type in the search input
   */
  search(term: string) {
    cy.get(this.selectors.search).clear().type(term)
    return this
  }

  /**
   * Clear the search input
   */
  clearSearch() {
    cy.get(this.selectors.searchClear).click()
    return this
  }

  /**
   * Click a specific row by ID
   */
  clickRow(id: string) {
    cy.get(this.selectors.row(id)).click()
    return this
  }

  /**
   * Find and click a row containing specific text
   */
  clickRowByText(text: string) {
    cy.contains(this.selectors.rowGeneric, text).click()
    return this
  }

  /**
   * Select a row checkbox
   */
  selectRow(id: string) {
    cy.get(this.selectors.rowSelect(id)).click()
    return this
  }

  /**
   * Open the row menu (three dots)
   */
  openRowMenu(id: string) {
    cy.get(this.selectors.rowMenu(id)).click()
    return this
  }

  /**
   * Click an action in the row menu
   */
  clickRowAction(action: string, id: string) {
    cy.get(this.selectors.rowAction(action, id)).click()
    return this
  }

  // ============================================
  // FILTERS
  // ============================================

  /**
   * Open a filter dropdown
   */
  openFilter(field: string) {
    cy.get(this.selectors.filterTrigger(field)).click()
    return this
  }

  /**
   * Select a filter option
   */
  selectFilterOption(field: string, value: string) {
    cy.get(this.selectors.filterOption(field, value)).click()
    return this
  }

  /**
   * Open filter and select option (convenience method)
   */
  selectFilter(field: string, value: string) {
    this.openFilter(field)
    this.selectFilterOption(field, value)
    return this
  }

  /**
   * Remove a filter badge
   */
  removeFilterBadge(field: string, value: string) {
    cy.get(this.selectors.filterRemoveBadge(field, value)).click()
    return this
  }

  /**
   * Clear all values for a filter
   */
  clearFilter(field: string) {
    cy.get(this.selectors.filterClearAll(field)).click()
    return this
  }

  // ============================================
  // PAGINATION
  // ============================================

  /**
   * Go to next page
   */
  nextPage() {
    cy.get(this.selectors.pageNext).click()
    return this
  }

  /**
   * Go to previous page
   */
  prevPage() {
    cy.get(this.selectors.pagePrev).click()
    return this
  }

  /**
   * Go to first page
   */
  firstPage() {
    cy.get(this.selectors.pageFirst).click()
    return this
  }

  /**
   * Go to last page
   */
  lastPage() {
    cy.get(this.selectors.pageLast).click()
    return this
  }

  /**
   * Change page size
   */
  setPageSize(size: string) {
    cy.get(this.selectors.pageSize).click()
    cy.get(this.selectors.pageSizeOption(size)).click()
    return this
  }

  // ============================================
  // FORM ACTIONS
  // ============================================

  /**
   * Fill a text input field
   */
  fillTextField(name: string, value: string) {
    cy.get(this.selectors.field(name)).find('input').clear().type(value)
    return this
  }

  /**
   * Fill a textarea field
   */
  fillTextarea(name: string, value: string) {
    cy.get(this.selectors.field(name)).find('textarea').clear().type(value)
    return this
  }

  /**
   * Select an option in a combobox/select field
   */
  selectOption(name: string, value: string) {
    cy.get(this.selectors.field(name)).find('[role="combobox"]').click()
    cy.get(`[data-cy="${this.slug}-field-${name}-option-${value}"]`).click()
    return this
  }

  /**
   * Submit the form
   */
  submitForm() {
    cy.get(this.selectors.submitButton).click()
    return this
  }

  /**
   * Create entity with data
   */
  create(data: Record<string, unknown>) {
    this.visitCreate()
    this.waitForForm()
    // Override in subclass to fill form
    this.submitForm()
    return this
  }

  /**
   * Edit entity with data
   */
  edit(id: string, data: Record<string, unknown>) {
    this.visitEdit(id)
    this.waitForForm()
    // Override in subclass to fill form
    this.submitForm()
    return this
  }

  /**
   * Delete entity by ID
   */
  delete(id: string) {
    this.visitDetail(id)
    this.waitForDetail()
    this.clickDelete()
    this.confirmDelete()
    return this
  }

  // ============================================
  // HEADER/DETAIL ACTIONS
  // ============================================

  /**
   * Click back button
   */
  clickBack() {
    cy.get(this.selectors.backButton).click()
    return this
  }

  /**
   * Click edit button
   */
  clickEdit() {
    cy.get(this.selectors.editButton).click()
    return this
  }

  /**
   * Click delete button
   */
  clickDelete() {
    cy.get(this.selectors.deleteButton).click()
    return this
  }

  /**
   * Confirm delete in dialog
   */
  confirmDelete() {
    cy.get(this.selectors.deleteConfirm).click()
    return this
  }

  /**
   * Cancel delete in dialog
   */
  cancelDelete() {
    cy.get(this.selectors.deleteCancel).click()
    return this
  }

  // ============================================
  // BULK ACTIONS
  // ============================================

  /**
   * Select all items using table header checkbox
   */
  selectAll() {
    cy.get(this.selectors.selectAll).click()
    return this
  }

  /**
   * Click bulk delete button
   */
  bulkDelete() {
    cy.get(this.selectors.bulkDelete).click()
    return this
  }

  /**
   * Confirm bulk delete
   */
  confirmBulkDelete() {
    cy.get(this.selectors.bulkDeleteConfirm).click()
    return this
  }

  /**
   * Cancel bulk delete
   */
  cancelBulkDelete() {
    cy.get(this.selectors.bulkDeleteCancel).click()
    return this
  }

  /**
   * Click bulk status button
   */
  bulkChangeStatus() {
    cy.get(this.selectors.bulkStatus).click()
    return this
  }

  /**
   * Select status in bulk status dialog
   */
  selectBulkStatus(value: string) {
    cy.get(this.selectors.bulkStatusSelect).click()
    cy.get(this.selectors.bulkStatusOption(value)).click()
    return this
  }

  /**
   * Confirm bulk status change
   */
  confirmBulkStatus() {
    cy.get(this.selectors.bulkStatusConfirm).click()
    return this
  }

  /**
   * Clear selection
   */
  clearSelection() {
    cy.get(this.selectors.bulkClear).click()
    return this
  }

  // ============================================
  // ASSERTIONS
  // ============================================

  /**
   * Assert text is visible in the list
   */
  assertInList(text: string) {
    cy.contains(text).should('be.visible')
    return this
  }

  /**
   * Assert text is not in the list
   */
  assertNotInList(text: string) {
    cy.contains(text).should('not.exist')
    return this
  }

  /**
   * Assert item exists by data
   */
  assertItemExists(data: { title?: string; name?: string }) {
    const text = data.title || data.name || ''
    return this.assertInList(text)
  }

  /**
   * Assert item does not exist by data
   */
  assertItemNotExists(data: { title?: string; name?: string }) {
    const text = data.title || data.name || ''
    return this.assertNotInList(text)
  }

  /**
   * Assert table is visible
   */
  assertTableVisible() {
    cy.get(this.selectors.table).should('be.visible')
    return this
  }

  /**
   * Assert form is visible
   */
  assertFormVisible() {
    cy.get(this.selectors.form).should('be.visible')
    return this
  }

  /**
   * Assert page title contains text
   */
  assertPageTitle(expected: string) {
    cy.get(this.selectors.title).should('contain.text', expected)
    return this
  }

  /**
   * Assert row exists
   */
  assertRowExists(id: string) {
    cy.get(this.selectors.row(id)).should('exist')
    return this
  }

  /**
   * Assert row does not exist
   */
  assertRowNotExists(id: string) {
    cy.get(this.selectors.row(id)).should('not.exist')
    return this
  }

  /**
   * Assert selection count
   */
  assertSelectionCount(count: number) {
    cy.get(this.selectors.selectionCount).should('contain.text', count.toString())
    return this
  }

  /**
   * Assert bulk bar is visible
   */
  assertBulkBarVisible() {
    cy.get(this.selectors.bulkBar).should('be.visible')
    return this
  }

  /**
   * Assert bulk bar is hidden
   */
  assertBulkBarHidden() {
    cy.get(this.selectors.bulkBar).should('not.be.visible')
    return this
  }
}

export default DashboardEntityPOM
