/**
 * BlockEditorBasePOM - Base class for Page and Post builder POMs
 *
 * Provides common functionality for the block-based editor:
 * - Editor navigation and setup
 * - Title and slug management
 * - Block picker interactions
 * - Block manipulation (add, remove, reorder)
 * - Settings panel interactions
 * - Status management
 * - Save operations
 *
 * @example
 * class PageBuilderPOM extends BlockEditorBasePOM {
 *   protected entitySlug = 'pages'
 *
 *   publishPage() {
 *     this.setStatus('published')
 *     this.save()
 *     return this
 *   }
 * }
 */

import { BasePOM } from './BasePOM'
import { cySelector } from '../selectors'
import { ApiInterceptor } from '../helpers/ApiInterceptor'

export abstract class BlockEditorBasePOM extends BasePOM {
  /**
   * Entity slug - must be defined by subclass
   */
  protected abstract entitySlug: string

  protected _api: ApiInterceptor | null = null

  // ============================================
  // API INTERCEPTOR
  // ============================================

  get api(): ApiInterceptor {
    if (!this._api) {
      this._api = new ApiInterceptor(this.entitySlug)
    }
    return this._api
  }

  setupApiIntercepts() {
    this.api.setupCrudIntercepts()
    return this
  }

  // ============================================
  // SELECTORS (from centralized selectors.ts)
  // ============================================

  get editorSelectors() {
    return {
      // Editor main
      container: cySelector('blockEditor.container'),
      titleInput: cySelector('blockEditor.titleInput'),
      slugInput: cySelector('blockEditor.slugInput'),
      saveButton: cySelector('blockEditor.saveButton'),
      statusBadge: cySelector('blockEditor.statusBadge'),
      leftSidebarToggle: cySelector('blockEditor.leftSidebarToggle'),
      viewModeToggle: cySelector('blockEditor.viewModeToggle'),

      // Block Picker
      blockPicker: cySelector('blockEditor.blockPicker.container'),
      blockSearch: cySelector('blockEditor.blockPicker.searchInput'),
      categoryAll: cySelector('blockEditor.blockPicker.categoryAll'),
      category: (category: string) =>
        cySelector('blockEditor.blockPicker.category', { category }),
      blockItem: (slug: string) => cySelector('blockEditor.blockPicker.blockItem', { slug }),
      addBlock: (slug: string) => cySelector('blockEditor.blockPicker.addBlock', { slug }),

      // Block Canvas
      blockCanvas: cySelector('blockEditor.blockCanvas.container'),
      blockCanvasEmpty: cySelector('blockEditor.blockCanvas.empty'),

      // Preview Canvas
      previewCanvas: cySelector('blockEditor.previewCanvas.container'),
      previewCanvasEmpty: cySelector('blockEditor.previewCanvas.empty'),
      previewBlock: (id: string) => cySelector('blockEditor.previewCanvas.block', { id }),
      previewMoveUp: (id: string) => cySelector('blockEditor.previewCanvas.moveUp', { id }),
      previewMoveDown: (id: string) => cySelector('blockEditor.previewCanvas.moveDown', { id }),

      // Sortable Block
      sortableBlock: (id: string) => cySelector('blockEditor.sortableBlock.container', { id }),
      dragHandle: (id: string) => cySelector('blockEditor.sortableBlock.dragHandle', { id }),
      duplicateBlock: (id: string) => cySelector('blockEditor.sortableBlock.duplicate', { id }),
      removeBlock: (id: string) => cySelector('blockEditor.sortableBlock.remove', { id }),
      blockError: (id: string) => cySelector('blockEditor.sortableBlock.error', { id }),

      // Settings Panel
      settingsPanel: cySelector('blockEditor.settingsPanel.container'),
      settingsPanelEmpty: cySelector('blockEditor.settingsPanel.empty'),
      settingsPanelError: cySelector('blockEditor.settingsPanel.error'),
      resetProps: cySelector('blockEditor.settingsPanel.resetProps'),
      removeBlockSettings: cySelector('blockEditor.settingsPanel.removeBlock'),
      tabContent: cySelector('blockEditor.settingsPanel.tabContent'),
      tabDesign: cySelector('blockEditor.settingsPanel.tabDesign'),
      tabAdvanced: cySelector('blockEditor.settingsPanel.tabAdvanced'),

      // Page Settings
      pageSettings: cySelector('blockEditor.pageSettings.container'),
      seoTrigger: cySelector('blockEditor.pageSettings.seoTrigger'),
      metaTitle: cySelector('blockEditor.pageSettings.metaTitle'),
      metaDescription: cySelector('blockEditor.pageSettings.metaDescription'),
      metaKeywords: cySelector('blockEditor.pageSettings.metaKeywords'),
      ogImage: cySelector('blockEditor.pageSettings.ogImage'),
      customFieldsTrigger: cySelector('blockEditor.pageSettings.customFieldsTrigger'),
      customFieldKey: (index: number) =>
        cySelector('blockEditor.pageSettings.customFieldKey', { index }),
      customFieldValue: (index: number) =>
        cySelector('blockEditor.pageSettings.customFieldValue', { index }),
      customFieldRemove: (index: number) =>
        cySelector('blockEditor.pageSettings.customFieldRemove', { index }),
      addCustomField: cySelector('blockEditor.pageSettings.addCustomField'),

      // Status Selector
      statusSelector: cySelector('blockEditor.statusSelector.trigger'),
      statusOption: (value: string) =>
        cySelector('blockEditor.statusSelector.option', { value }),

      // Dynamic Form
      dynamicForm: cySelector('blockEditor.dynamicForm.container'),
      dynamicField: (name: string) =>
        cySelector('blockEditor.dynamicForm.field', { name }),
      fieldGroup: (id: string) =>
        cySelector('blockEditor.dynamicForm.fieldGroup', { id }),
      arrayGroup: (name: string) =>
        cySelector('blockEditor.dynamicForm.arrayGroup', { name }),

      // Array Field
      arrayFieldContainer: (name: string) =>
        cySelector('blockEditor.arrayField.container', { name }),
      arrayFieldItem: (name: string, index: number, field: string) =>
        cySelector('blockEditor.arrayField.item', { name, index, field }),
      arrayFieldMoveUp: (name: string, index: number) =>
        cySelector('blockEditor.arrayField.moveUp', { name, index }),
      arrayFieldMoveDown: (name: string, index: number) =>
        cySelector('blockEditor.arrayField.moveDown', { name, index }),
      arrayFieldRemove: (name: string, index: number) =>
        cySelector('blockEditor.arrayField.remove', { name, index }),
      arrayFieldAdd: (name: string) =>
        cySelector('blockEditor.arrayField.add', { name }),

      // Entity Fields Sidebar
      entityFieldsSidebar: cySelector('blockEditor.entityFieldsSidebar.container'),
      entityField: (name: string) =>
        cySelector('blockEditor.entityFieldsSidebar.field', { name }),
      entityCategory: (slug: string) =>
        cySelector('blockEditor.entityFieldsSidebar.category', { slug })
    }
  }

  // ============================================
  // NAVIGATION
  // ============================================

  visitList() {
    cy.visit(`/dashboard/${this.entitySlug}`)
    return this
  }

  visitCreate() {
    cy.visit(`/dashboard/${this.entitySlug}/create`)
    return this
  }

  visitEdit(id: string) {
    cy.visit(`/dashboard/${this.entitySlug}/${id}/edit`)
    return this
  }

  // ============================================
  // WAITS
  // ============================================

  waitForEditor() {
    cy.get(this.editorSelectors.container, { timeout: 15000 }).should('be.visible')
    return this
  }

  waitForSave() {
    this.api.waitForUpdate()
    return this
  }

  // ============================================
  // EDITOR ACTIONS
  // ============================================

  /**
   * Set the page/post title
   */
  setTitle(title: string) {
    cy.get(this.editorSelectors.titleInput).clear().type(title)
    return this
  }

  /**
   * Set the page/post slug
   */
  setSlug(slug: string) {
    cy.get(this.editorSelectors.slugInput).clear().type(slug)
    return this
  }

  /**
   * Save the page/post
   */
  save() {
    cy.get(this.editorSelectors.saveButton).click()
    return this
  }

  /**
   * Save with API wait
   */
  saveWithWait() {
    this.setupApiIntercepts()
    this.save()
    this.api.waitForUpdate()
    return this
  }

  /**
   * Set the status using the status selector
   */
  setStatus(status: string) {
    cy.get(this.editorSelectors.statusSelector).click()
    cy.get(this.editorSelectors.statusOption(status)).click()
    return this
  }

  /**
   * Toggle left sidebar
   */
  toggleLeftSidebar() {
    cy.get(this.editorSelectors.leftSidebarToggle).click()
    return this
  }

  /**
   * Toggle view mode (edit/preview)
   */
  toggleViewMode() {
    cy.get(this.editorSelectors.viewModeToggle).click()
    return this
  }

  // ============================================
  // BLOCK PICKER ACTIONS
  // ============================================

  /**
   * Search for a block in the picker
   */
  searchBlock(term: string) {
    cy.get(this.editorSelectors.blockSearch).clear().type(term)
    return this
  }

  /**
   * Clear block search
   */
  clearBlockSearch() {
    cy.get(this.editorSelectors.blockSearch).clear()
    return this
  }

  /**
   * Select a block category
   */
  selectCategory(category: string) {
    cy.get(this.editorSelectors.category(category)).click()
    return this
  }

  /**
   * Select "All" category
   */
  selectAllCategories() {
    cy.get(this.editorSelectors.categoryAll).click()
    return this
  }

  /**
   * Add a block by clicking its add button
   */
  addBlock(blockSlug: string) {
    cy.get(this.editorSelectors.addBlock(blockSlug)).click()
    return this
  }

  /**
   * Click on a block item in the picker
   */
  clickBlockItem(blockSlug: string) {
    cy.get(this.editorSelectors.blockItem(blockSlug)).click()
    return this
  }

  // ============================================
  // BLOCK MANIPULATION
  // ============================================

  /**
   * Remove a block from the canvas
   */
  removeBlock(blockId: string) {
    cy.get(this.editorSelectors.removeBlock(blockId)).click()
    return this
  }

  /**
   * Duplicate a block
   */
  duplicateBlock(blockId: string) {
    cy.get(this.editorSelectors.duplicateBlock(blockId)).click()
    return this
  }

  /**
   * Click on a sortable block to select it
   */
  selectBlock(blockId: string) {
    cy.get(this.editorSelectors.sortableBlock(blockId)).click()
    return this
  }

  /**
   * Move block up in preview
   */
  moveBlockUp(blockId: string) {
    cy.get(this.editorSelectors.previewMoveUp(blockId)).click()
    return this
  }

  /**
   * Move block down in preview
   */
  moveBlockDown(blockId: string) {
    cy.get(this.editorSelectors.previewMoveDown(blockId)).click()
    return this
  }

  // ============================================
  // SETTINGS PANEL ACTIONS
  // ============================================

  /**
   * Switch to Content tab in settings panel
   */
  openContentTab() {
    cy.get(this.editorSelectors.tabContent).click()
    return this
  }

  /**
   * Switch to Design tab in settings panel
   */
  openDesignTab() {
    cy.get(this.editorSelectors.tabDesign).click()
    return this
  }

  /**
   * Switch to Advanced tab in settings panel
   */
  openAdvancedTab() {
    cy.get(this.editorSelectors.tabAdvanced).click()
    return this
  }

  /**
   * Reset block props to defaults
   */
  resetBlockProps() {
    cy.get(this.editorSelectors.resetProps).click()
    return this
  }

  /**
   * Remove block from settings panel
   */
  removeBlockFromSettings() {
    cy.get(this.editorSelectors.removeBlockSettings).click()
    return this
  }

  /**
   * Fill a dynamic form field
   */
  fillDynamicField(name: string, value: string) {
    cy.get(this.editorSelectors.dynamicField(name)).find('input, textarea').clear().type(value)
    return this
  }

  // ============================================
  // SEO/PAGE SETTINGS
  // ============================================

  /**
   * Open SEO settings section
   */
  openSeoSettings() {
    cy.get(this.editorSelectors.seoTrigger).click()
    return this
  }

  /**
   * Set meta title
   */
  setMetaTitle(title: string) {
    cy.get(this.editorSelectors.metaTitle).clear().type(title)
    return this
  }

  /**
   * Set meta description
   */
  setMetaDescription(description: string) {
    cy.get(this.editorSelectors.metaDescription).clear().type(description)
    return this
  }

  /**
   * Set meta keywords
   */
  setMetaKeywords(keywords: string) {
    cy.get(this.editorSelectors.metaKeywords).clear().type(keywords)
    return this
  }

  /**
   * Open custom fields section
   */
  openCustomFields() {
    cy.get(this.editorSelectors.customFieldsTrigger).click()
    return this
  }

  /**
   * Add a custom field
   */
  addCustomField() {
    cy.get(this.editorSelectors.addCustomField).click()
    return this
  }

  /**
   * Fill a custom field
   */
  fillCustomField(index: number, key: string, value: string) {
    cy.get(this.editorSelectors.customFieldKey(index)).clear().type(key)
    cy.get(this.editorSelectors.customFieldValue(index)).clear().type(value)
    return this
  }

  /**
   * Remove a custom field
   */
  removeCustomField(index: number) {
    cy.get(this.editorSelectors.customFieldRemove(index)).click()
    return this
  }

  // ============================================
  // ARRAY FIELDS
  // ============================================

  /**
   * Add an item to an array field
   */
  addArrayItem(name: string) {
    cy.get(this.editorSelectors.arrayFieldAdd(name)).click()
    return this
  }

  /**
   * Remove an item from an array field
   */
  removeArrayItem(name: string, index: number) {
    cy.get(this.editorSelectors.arrayFieldRemove(name, index)).click()
    return this
  }

  /**
   * Fill an array field item
   */
  fillArrayItem(name: string, index: number, field: string, value: string) {
    cy.get(this.editorSelectors.arrayFieldItem(name, index, field)).clear().type(value)
    return this
  }

  /**
   * Move array item up
   */
  moveArrayItemUp(name: string, index: number) {
    cy.get(this.editorSelectors.arrayFieldMoveUp(name, index)).click()
    return this
  }

  /**
   * Move array item down
   */
  moveArrayItemDown(name: string, index: number) {
    cy.get(this.editorSelectors.arrayFieldMoveDown(name, index)).click()
    return this
  }

  // ============================================
  // ASSERTIONS
  // ============================================

  /**
   * Assert editor is visible
   */
  assertEditorVisible() {
    cy.get(this.editorSelectors.container).should('be.visible')
    return this
  }

  /**
   * Assert canvas is empty
   */
  assertCanvasEmpty() {
    cy.get(this.editorSelectors.blockCanvasEmpty).should('be.visible')
    return this
  }

  /**
   * Assert block exists in canvas
   */
  assertBlockExists(blockId: string) {
    cy.get(this.editorSelectors.sortableBlock(blockId)).should('exist')
    return this
  }

  /**
   * Assert block does not exist
   */
  assertBlockNotExists(blockId: string) {
    cy.get(this.editorSelectors.sortableBlock(blockId)).should('not.exist')
    return this
  }

  /**
   * Assert status badge shows specific status
   */
  assertStatus(status: string) {
    cy.get(this.editorSelectors.statusBadge).should('contain.text', status)
    return this
  }

  /**
   * Assert settings panel is visible
   */
  assertSettingsPanelVisible() {
    cy.get(this.editorSelectors.settingsPanel).should('be.visible')
    return this
  }

  /**
   * Assert settings panel shows empty state
   */
  assertSettingsPanelEmpty() {
    cy.get(this.editorSelectors.settingsPanelEmpty).should('be.visible')
    return this
  }
}

export default BlockEditorBasePOM
