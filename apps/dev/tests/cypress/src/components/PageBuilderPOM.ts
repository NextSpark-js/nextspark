/**
 * Page Builder POM
 *
 * Page Object Model for the Block Editor / Page Builder system.
 * Covers admin UI workflows for creating and editing pages with blocks.
 *
 * Convention: block-editor-{component}-{detail}
 * Based on 67+ existing data-cy attributes in dashboard components.
 */

import { ApiInterceptor } from '../helpers/ApiInterceptor'

export interface PageFormData {
  title: string
  slug: string
  locale?: 'en' | 'es'
  status?: 'draft' | 'published' | 'scheduled' | 'archived'
  metaTitle?: string
  metaDescription?: string
}

export interface BlockData {
  slug: string
  props?: Record<string, unknown>
}

export class PageBuilderPOM {
  // ============================================
  // STATIC CONFIG
  // ============================================

  static get slug() {
    return 'pages'
  }

  // ============================================
  // API INTERCEPTOR (for deterministic waits)
  // ============================================

  private static _api: ApiInterceptor | null = null

  /**
   * Get the API interceptor instance for pages
   * Lazy-initialized on first access
   */
  static get api(): ApiInterceptor {
    if (!this._api) {
      this._api = new ApiInterceptor(this.slug)
    }
    return this._api
  }

  /**
   * Setup API intercepts for CRUD operations
   * Call this in beforeEach BEFORE navigation
   */
  static setupApiIntercepts(): typeof PageBuilderPOM {
    this.api.setupCrudIntercepts()
    return this
  }

  // ============================================
  // SELECTORS - Pages List
  // ============================================

  static get listSelectors() {
    // Using entity testing convention: {slug}-{component}
    // Based on createCyId(entityConfig.slug, component) from testing-utils.ts
    return {
      page: '[data-cy="pages-page"]',
      title: '[data-cy="pages-title"]',
      table: '[data-cy="pages-table"], table',
      createBtn: '[data-cy="pages-add"]',
      searchContainer: '[data-cy="pages-search"]',
      searchInput: '[data-cy="pages-search-input"]',
      filterStatus: '[data-cy="pages-filter-status"]',
      filterLocale: '[data-cy="pages-filter-locale"]',
      row: (id: string) => `[data-cy="pages-row-${id}"]`,
      rowGeneric: 'table tbody tr',
      // Row menu actions (EntityTable patterns)
      menuTrigger: (id: string) => `[data-cy="pages-menu-${id}"]`,
      menuEdit: (id: string) => `[data-cy="pages-menu-edit-${id}"]`,
      menuDelete: (id: string) => `[data-cy="pages-menu-delete-${id}"]`,
      menuView: (id: string) => `[data-cy="pages-menu-view-${id}"]`,
      confirmDelete: '[data-cy="pages-confirm-delete"], [role="dialog"]',
      confirmDeleteBtn: '[data-cy="pages-confirm-delete-btn"], [role="dialog"] button:contains("Delete"), button.bg-destructive',
      cancelDeleteBtn: '[data-cy="pages-cancel-delete-btn"], [role="dialog"] button:contains("Cancel"),[role="dialog"] button[type="button"]:not(.bg-destructive)',
      emptyState: 'td:contains("No pages")',
    }
  }

  // ============================================
  // SELECTORS - Block Editor
  // ============================================

  static get editorSelectors() {
    return {
      // Page container (builder-editor is the main editor wrapper)
      editorPage: '[data-cy="builder-editor"]',

      // Left sidebar toggle (expands/collapses block picker)
      leftSidebarToggle: '[data-cy="left-sidebar-toggle"]',

      // Mode toggles (wrapper and individual buttons)
      viewModeToggle: '[data-cy="view-mode-toggle"]',
      modeLayout: '[data-cy="mode-layout"]',
      modePreview: '[data-cy="mode-preview"]',

      // Block Picker (Left Panel)
      blockPicker: '[data-cy="block-picker"]',
      blockSearchInput: '[data-cy="block-search-input"]',
      categoryTab: (cat: string) => `[data-cy="category-${cat}"]`,
      blockItem: (slug: string) => `[data-cy="block-item-${slug}"]`,
      addBlockBtn: (slug: string) => `[data-cy="add-block-${slug}"]`,

      // Block Canvas (Center Panel - Edit Mode)
      blockCanvas: '[data-cy="block-canvas"]',
      blockCanvasEmpty: '[data-cy="block-canvas-empty"]',
      sortableBlock: (id: string) => `[data-cy="sortable-block-${id}"]`,
      dragHandle: (id: string) => `[data-cy="drag-handle-${id}"]`,
      duplicateBlock: (id: string) => `[data-cy="duplicate-block-${id}"]`,
      removeBlock: (id: string) => `[data-cy="remove-block-${id}"]`,
      sortableBlockGeneric: '[data-cy^="sortable-block-"]',

      // Preview Canvas (Center Panel - Preview Mode)
      previewCanvas: '[data-cy="block-preview-canvas"]',
      previewCanvasEmpty: '[data-cy="block-preview-canvas-empty"]',
      previewBlock: (id: string) => `[data-cy="preview-block-${id}"]`,
      moveUpBtn: (id: string) => `[data-cy="preview-block-${id}-move-up"]`,
      moveDownBtn: (id: string) => `[data-cy="preview-block-${id}-move-down"]`,
      previewBlockGeneric: '[data-cy^="preview-block-"]',

      // Settings Panel (Right Panel)
      settingsPanel: '[data-cy="block-settings-panel"]',
      settingsEmpty: '[data-cy="settings-panel-empty"]',
      resetPropsBtn: '[data-cy="reset-block-props"]',
      removeBlockSettings: '[data-cy="remove-block-settings"]',

      // Settings Tabs
      tabContent: '[data-cy="tab-content"]',
      tabDesign: '[data-cy="tab-design"]',
      tabAdvanced: '[data-cy="tab-advanced"]',

      // Field inputs in settings
      fieldInput: (name: string) => `[data-cy="field-${name}"]`,
      fieldTextarea: (name: string) => `[data-cy="field-${name}"] textarea`,
      fieldSelect: (name: string) => `[data-cy="field-${name}"] [role="combobox"]`,
      fieldCheckbox: (name: string) => `[data-cy="field-${name}"] input[type="checkbox"]`,
      fieldArray: (name: string) => `[data-cy="field-${name}-array"]`,

      // Array field controls
      arrayAddItem: (name: string) => `[data-cy="field-${name}-add-item"]`,
      arrayItem: (name: string, index: number) => `[data-cy="field-${name}-item-${index}"]`,
      arrayItemRemove: (name: string, index: number) => `[data-cy="field-${name}-item-${index}-remove"]`,
      arrayItemMoveUp: (name: string, index: number) => `[data-cy="field-${name}-item-${index}-move-up"]`,
      arrayItemMoveDown: (name: string, index: number) => `[data-cy="field-${name}-item-${index}-move-down"]`,

      // CTA group fields (collapsible)
      ctaGroupTrigger: (name: string) => `[data-cy="cta-group-${name}"]`,
      ctaGroupContent: (name: string) => `[data-cy="cta-group-${name}-content"]`,
    }
  }

  // ============================================
  // SELECTORS - Page Settings
  // ============================================

  static get pageSettingsSelectors() {
    return {
      panel: '[data-cy="page-settings-panel"]',
      // Note: In editor, these are in the top bar
      titleInput: '[data-cy="editor-title-input"]',
      slugInput: '[data-cy="editor-slug-input"]',
      localeSelect: '[data-cy="locale-select"]',

      // Status selector (dropdown)
      statusSelector: '[data-cy="status-selector"]',
      statusOption: (status: string) => `[data-cy="status-option-${status}"]`,
      statusBadge: '[data-cy="status-badge"]',

      // SEO Settings
      seoTrigger: '[data-cy="seo-settings-trigger"]',
      seoContent: '[data-cy="seo-settings-content"]',
      metaTitle: '[data-cy="seo-meta-title"]',
      metaDescription: '[data-cy="seo-meta-description"]',

      // Action buttons
      saveBtn: '[data-cy="save-btn"]',
      previewBtn: '[data-cy="preview-page-btn"]',
      deleteBtn: '[data-cy="delete-page-btn"]',
    }
  }

  // ============================================
  // NAVIGATION
  // ============================================

  static visitList() {
    cy.visit('/dashboard/pages')
    return this
  }

  static visitCreate() {
    cy.visit('/dashboard/pages/create')
    return this
  }

  static visitEdit(id: string) {
    cy.visit(`/dashboard/pages/${id}/edit`)
    return this
  }

  // ============================================
  // API-AWARE NAVIGATION
  // ============================================

  /**
   * Visit list page with API intercepts and wait for data load
   */
  static visitListWithApiWait(): typeof PageBuilderPOM {
    this.setupApiIntercepts()
    this.visitList()
    this.api.waitForList()
    return this
  }

  /**
   * Visit edit page with API intercepts
   */
  static visitEditWithApiWait(id: string): typeof PageBuilderPOM {
    this.setupApiIntercepts()
    this.visitEdit(id)
    return this
  }

  // ============================================
  // WAIT METHODS
  // ============================================

  static waitForListLoad() {
    cy.url().should('include', '/dashboard/pages')
    cy.get(this.listSelectors.page, { timeout: 15000 }).should('exist')
    return this
  }

  static waitForEditorLoad() {
    cy.get(this.editorSelectors.editorPage, { timeout: 15000 }).should('be.visible')
    return this
  }

  static waitForBlockPickerLoad() {
    cy.get(this.editorSelectors.blockPicker, { timeout: 10000 }).should('be.visible')
    return this
  }

  static waitForSettingsPanelLoad() {
    cy.get(this.editorSelectors.settingsPanel, { timeout: 10000 }).should('be.visible')
    return this
  }

  // ============================================
  // LIST PAGE INTERACTIONS
  // ============================================

  static clickCreatePage() {
    cy.get(this.listSelectors.createBtn).click()
    return this
  }

  static searchPages(term: string) {
    cy.get(this.listSelectors.searchInput).clear().type(term)
    return this
  }

  static clearSearch() {
    cy.get(this.listSelectors.searchInput).clear()
    return this
  }

  static filterByStatus(status: 'all' | 'published' | 'draft') {
    cy.get(this.listSelectors.filterStatus).click()
    cy.contains('[role="option"]', status).click()
    return this
  }

  static openRowMenu(id: string) {
    cy.get(this.listSelectors.menuTrigger(id)).click()
    return this
  }

  static clickMenuEdit(id: string) {
    cy.get(this.listSelectors.menuEdit(id)).click()
    return this
  }

  static clickMenuDelete(id: string) {
    cy.get(this.listSelectors.menuDelete(id)).click()
    return this
  }

  static clickMenuView(id: string) {
    cy.get(this.listSelectors.menuView(id)).click()
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
  // BLOCK EDITOR INTERACTIONS
  // ============================================

  /**
   * Ensures the block picker sidebar is visible (expanded)
   * If not visible, clicks the toggle to expand it
   */
  static ensureBlockPickerVisible() {
    // Use invoke to get a primitive boolean, avoiding allure-cypress serialization issues
    cy.get(this.editorSelectors.blockPicker, { timeout: 1000 })
      .should('exist')
      .invoke('is', ':visible')
      .then((isVisible: boolean) => {
        if (!isVisible) {
          cy.get(this.editorSelectors.leftSidebarToggle).click()
          cy.get(this.editorSelectors.blockPicker, { timeout: 5000 }).should('be.visible')
        }
      })
    return this
  }

  static switchToLayoutMode() {
    cy.get(this.editorSelectors.modeLayout).click()
    // Ensure block picker is visible after switching to layout mode
    this.ensureBlockPickerVisible()
    return this
  }

  static switchToPreviewMode() {
    cy.get(this.editorSelectors.modePreview).click()
    return this
  }

  static searchBlocks(term: string) {
    this.ensureBlockPickerVisible()
    cy.get(this.editorSelectors.blockSearchInput).clear().type(term)
    return this
  }

  static selectBlockCategory(category: string) {
    this.ensureBlockPickerVisible()
    cy.get(this.editorSelectors.categoryTab(category)).click()
    return this
  }

  static addBlock(slug: string) {
    this.ensureBlockPickerVisible()
    // Click on block item (not the hidden add button) to add block
    // The block item div is always visible and has onClick handler
    cy.get(this.editorSelectors.blockItem(slug))
      .scrollIntoView()
      .should('be.visible')
      .click()
    return this
  }

  static selectBlock(blockId: string) {
    cy.get(this.editorSelectors.sortableBlock(blockId)).click()
    return this
  }

  static selectPreviewBlock(blockId: string) {
    cy.get(this.editorSelectors.previewBlock(blockId)).click()
    return this
  }

  static duplicateBlock(blockId: string) {
    cy.get(this.editorSelectors.duplicateBlock(blockId)).click()
    return this
  }

  static removeBlock(blockId: string) {
    cy.get(this.editorSelectors.removeBlock(blockId)).click()
    return this
  }

  static moveBlockUp(blockId: string) {
    cy.get(this.editorSelectors.moveUpBtn(blockId)).click()
    return this
  }

  static moveBlockDown(blockId: string) {
    cy.get(this.editorSelectors.moveDownBtn(blockId)).click()
    return this
  }

  // ============================================
  // SETTINGS PANEL INTERACTIONS
  // ============================================

  static selectSettingsTab(tab: 'content' | 'design' | 'advanced') {
    const selector =
      tab === 'content'
        ? this.editorSelectors.tabContent
        : tab === 'design'
          ? this.editorSelectors.tabDesign
          : this.editorSelectors.tabAdvanced
    cy.get(selector).click()
    return this
  }

  static fillField(name: string, value: string) {
    cy.get(this.editorSelectors.fieldInput(name)).find('input, textarea').first().clear().type(value)
    return this
  }

  static fillTextarea(name: string, value: string) {
    cy.get(this.editorSelectors.fieldTextarea(name)).clear().type(value)
    return this
  }

  static selectOption(name: string, value: string) {
    cy.get(this.editorSelectors.fieldSelect(name)).click()
    cy.contains('[role="option"]', value).click()
    return this
  }

  static toggleCheckbox(name: string) {
    cy.get(this.editorSelectors.fieldCheckbox(name)).click()
    return this
  }

  static resetBlockProps() {
    cy.get(this.editorSelectors.resetPropsBtn).click()
    return this
  }

  static removeBlockFromSettings() {
    cy.get(this.editorSelectors.removeBlockSettings).click()
    return this
  }

  // ============================================
  // ARRAY FIELD INTERACTIONS
  // ============================================

  static addArrayItem(fieldName: string) {
    cy.get(this.editorSelectors.arrayAddItem(fieldName)).click()
    return this
  }

  static removeArrayItem(fieldName: string, index: number) {
    cy.get(this.editorSelectors.arrayItemRemove(fieldName, index)).click()
    return this
  }

  static moveArrayItemUp(fieldName: string, index: number) {
    cy.get(this.editorSelectors.arrayItemMoveUp(fieldName, index)).click()
    return this
  }

  static moveArrayItemDown(fieldName: string, index: number) {
    cy.get(this.editorSelectors.arrayItemMoveDown(fieldName, index)).click()
    return this
  }

  // ============================================
  // CTA GROUP INTERACTIONS
  // ============================================

  static toggleCtaGroup(name: string) {
    cy.get(this.editorSelectors.ctaGroupTrigger(name)).click()
    return this
  }

  // ============================================
  // PAGE SETTINGS INTERACTIONS
  // ============================================

  static setPageTitle(title: string) {
    cy.get(this.pageSettingsSelectors.titleInput).clear().type(title)
    return this
  }

  static setPageSlug(slug: string) {
    cy.get(this.pageSettingsSelectors.slugInput).clear().type(slug)
    return this
  }

  static setPageLocale(locale: 'en' | 'es') {
    cy.get(this.pageSettingsSelectors.localeSelect).click()
    cy.contains('[role="option"]', locale).click()
    return this
  }

  /**
   * Select a status from the dropdown
   */
  static selectStatus(status: 'draft' | 'published' | 'scheduled' | 'archived') {
    // Status selector may be partially outside viewport, use force click
    cy.get(this.pageSettingsSelectors.statusSelector)
      .should('exist')
      .click({ force: true })
    cy.get(this.pageSettingsSelectors.statusOption(status)).click()
    return this
  }

  static openSeoSettings() {
    cy.get(this.pageSettingsSelectors.seoTrigger).click()
    return this
  }

  static setMetaTitle(title: string) {
    cy.get(this.pageSettingsSelectors.metaTitle).clear().type(title)
    return this
  }

  static setMetaDescription(description: string) {
    cy.get(this.pageSettingsSelectors.metaDescription).clear().type(description)
    return this
  }

  static savePage() {
    // Wait for any pending state updates after adding blocks
    cy.wait(500)
    // The save button might be partially outside viewport, use force click
    cy.get(this.pageSettingsSelectors.saveBtn)
      .should('exist')
      .click({ force: true })
    return this
  }

  /**
   * Save page and wait for API response (deterministic)
   */
  static savePageWithApiWait(): typeof PageBuilderPOM {
    this.savePage()
    this.api.waitForUpdate()
    return this
  }

  /**
   * Change status to published and save
   */
  static publishPage() {
    this.selectStatus('published')
    this.savePage()
    return this
  }

  /**
   * Change status to draft and save (unpublish)
   */
  static unpublishPage() {
    this.selectStatus('draft')
    this.savePage()
    return this
  }

  static previewPage() {
    cy.get(this.pageSettingsSelectors.previewBtn).click()
    return this
  }

  static deletePage() {
    cy.get(this.pageSettingsSelectors.deleteBtn).click()
    return this
  }

  // ============================================
  // COMPLETE WORKFLOWS
  // ============================================

  /**
   * Create a new page with specified data and blocks
   */
  static createPage(data: PageFormData, blocks: BlockData[] = []) {
    this.visitCreate()
    this.waitForEditorLoad()

    // Set page settings
    this.setPageTitle(data.title)
    this.setPageSlug(data.slug)

    if (data.locale) {
      this.setPageLocale(data.locale)
    }

    // Add blocks
    blocks.forEach((block) => {
      this.addBlock(block.slug)
    })

    // Set status if provided
    if (data.status) {
      this.selectStatus(data.status)
    }

    // Set SEO if provided
    if (data.metaTitle || data.metaDescription) {
      this.openSeoSettings()
      if (data.metaTitle) this.setMetaTitle(data.metaTitle)
      if (data.metaDescription) this.setMetaDescription(data.metaDescription)
    }

    this.savePage()
    return this
  }

  // ============================================
  // ASSERTIONS
  // ============================================

  static assertListPageVisible() {
    cy.get(this.listSelectors.page).should('exist')
    return this
  }

  static assertEditorVisible() {
    cy.get(this.editorSelectors.editorPage).should('be.visible')
    return this
  }

  static assertBlockPickerVisible() {
    cy.get(this.editorSelectors.blockPicker).should('be.visible')
    return this
  }

  static assertBlockInCanvas(blockSlug: string) {
    cy.get(this.editorSelectors.blockCanvas).should('contain.text', blockSlug)
    return this
  }

  static assertBlockCount(count: number) {
    cy.get(this.editorSelectors.sortableBlockGeneric).should('have.length', count)
    return this
  }

  static assertPreviewBlockCount(count: number) {
    cy.get(this.editorSelectors.previewBlockGeneric).should('have.length', count)
    return this
  }

  static assertCanvasEmpty() {
    cy.get(this.editorSelectors.blockCanvasEmpty).should('be.visible')
    return this
  }

  static assertSettingsPanelEmpty() {
    cy.get(this.editorSelectors.settingsEmpty).should('be.visible')
    return this
  }

  static assertSettingsPanelHasContent() {
    cy.get(this.editorSelectors.settingsPanel).should('be.visible')
    cy.get(this.editorSelectors.settingsEmpty).should('not.exist')
    return this
  }

  static assertBlockInPicker(blockSlug: string) {
    // Scroll into view within the block picker scroll area
    cy.get(this.editorSelectors.blockItem(blockSlug))
      .scrollIntoView()
      .should('be.visible')
    return this
  }

  static assertPageInList(title: string) {
    cy.contains(this.listSelectors.rowGeneric, title).should('be.visible')
    return this
  }

  static assertPageNotInList(title: string) {
    cy.contains(this.listSelectors.rowGeneric, title).should('not.exist')
    return this
  }

  static assertEmptyList() {
    cy.get(this.listSelectors.emptyState).should('be.visible')
    return this
  }

  static assertSaveSuccess() {
    cy.contains('saved', { matchCase: false }).should('be.visible')
    return this
  }

  static assertPublishSuccess() {
    cy.contains('saved', { matchCase: false }).should('be.visible')
    return this
  }

  static assertStatusBadge(status: 'draft' | 'published' | 'scheduled' | 'archived') {
    cy.get(this.pageSettingsSelectors.statusBadge).should('contain.text', status)
    return this
  }

  static assertStatusSelected(status: string) {
    cy.get(this.pageSettingsSelectors.statusSelector).should('contain.text', status)
    return this
  }
}

export default PageBuilderPOM
