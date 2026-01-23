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
      // =========================================================================
      // HEADER - Top bar with title, slug, toggles, and actions
      // =========================================================================
      container: cySelector('blockEditor.header.container'),
      backButton: cySelector('blockEditor.header.backButton'),
      titleInput: cySelector('blockEditor.header.titleInput'),
      slugInput: cySelector('blockEditor.header.slugInput'),
      externalLink: cySelector('blockEditor.header.externalLink'),
      viewModeToggle: cySelector('blockEditor.header.viewToggle'),
      viewPreview: cySelector('blockEditor.header.viewPreview'),
      viewSettings: cySelector('blockEditor.header.viewSettings'),
      /** @deprecated Use viewSettings instead - v2.0 renamed viewEditor to viewSettings */
      viewEditor: cySelector('blockEditor.header.viewSettings'),
      saveButton: cySelector('blockEditor.header.saveButton'),
      publishButton: cySelector('blockEditor.header.publishButton'),
      settingsButton: cySelector('blockEditor.header.settingsButton'),
      // Status selector (in header)
      statusSelector: cySelector('blockEditor.header.statusSelector'),
      statusOption: (value: string) =>
        cySelector('blockEditor.header.statusOption', { value }),
      statusDot: cySelector('blockEditor.header.statusDot'),
      statusLabel: cySelector('blockEditor.header.statusLabel'),
      // Locale selector (in header)
      localeSelector: cySelector('blockEditor.header.localeSelector'),
      localeOption: (locale: string) =>
        cySelector('blockEditor.header.localeOption', { locale }),

      // =========================================================================
      // BLOCK PICKER - Left column "Bloques" tab
      // =========================================================================
      blockPicker: cySelector('blockEditor.blockPicker.container'),
      // Tabs (v2.0: Blocks | Patterns | Layout)
      tabBlocks: cySelector('blockEditor.blockPicker.tabBlocks'),
      tabIndicator: cySelector('blockEditor.blockPicker.tabIndicator'),
      /**
       * @deprecated tabConfig no longer exists in v2.0.
       * Entity fields moved to Settings mode (viewSettings) in center column.
       * Use tabLayout for tree view, or viewSettings for entity config.
       */
      tabConfig: cySelector('blockEditor.blockPicker.tabLayout'),
      // Search
      searchWrapper: cySelector('blockEditor.blockPicker.searchWrapper'),
      searchIcon: cySelector('blockEditor.blockPicker.searchIcon'),
      blockSearch: cySelector('blockEditor.blockPicker.searchInput'),
      blockSearchClear: cySelector('blockEditor.blockPicker.searchClear'),
      // Categories
      categoryChips: cySelector('blockEditor.blockPicker.categoryChips'),
      category: (category: string) =>
        cySelector('blockEditor.blockPicker.categoryChip', { category }),
      // Block cards
      blockItem: (slug: string) => cySelector('blockEditor.blockPicker.blockCard', { slug }),
      blockIcon: (slug: string) => cySelector('blockEditor.blockPicker.blockIcon', { slug }),
      blockName: (slug: string) => cySelector('blockEditor.blockPicker.blockName', { slug }),
      addBlock: (slug: string) => cySelector('blockEditor.blockPicker.addButton', { slug }),
      blockPickerEmpty: cySelector('blockEditor.blockPicker.empty'),
      // Generic selector for counting all categories
      categoryGeneric: '[data-cy^="block-picker-category-"]',

      // =========================================================================
      // PATTERNS TAB (in block picker)
      // =========================================================================
      tabPatterns: cySelector('blockEditor.blockPicker.tabPatterns'),
      patternsSearch: cySelector('blockEditor.blockPicker.patternsSearch'),
      patternsList: cySelector('blockEditor.blockPicker.patternsList'),
      patternsEmpty: cySelector('blockEditor.blockPicker.patternsEmpty'),
      // Pattern cards (dynamic)
      patternCard: (id: string) =>
        cySelector('blockEditor.blockPicker.patternCard', { id }),
      patternCardIcon: (id: string) =>
        cySelector('blockEditor.blockPicker.patternCardIcon', { id }),
      patternCardTitle: (id: string) =>
        cySelector('blockEditor.blockPicker.patternCardTitle', { id }),
      patternCardDescription: (id: string) =>
        cySelector('blockEditor.blockPicker.patternCardDescription', { id }),
      patternCardInsertButton: (id: string) =>
        cySelector('blockEditor.blockPicker.patternCardInsertButton', { id }),
      // Generic selector for counting patterns
      patternCardGeneric: '[data-cy^="block-picker-pattern-card-"]',

      // =========================================================================
      // TREE VIEW (Layout tab)
      // =========================================================================
      tabLayout: cySelector('blockEditor.blockPicker.tabLayout'),
      treeView: cySelector('blockEditor.treeView.container'),
      treeViewEmpty: cySelector('blockEditor.treeView.empty'),
      treeNode: (id: string) => cySelector('blockEditor.treeView.node', { id }),
      treeNodeIcon: (id: string) =>
        cySelector('blockEditor.treeView.nodeIcon', { id }),
      treeNodeName: (id: string) =>
        cySelector('blockEditor.treeView.nodeName', { id }),

      // =========================================================================
      // CONFIG PANEL - Center column - Settings mode (v2.0)
      // =========================================================================
      configPanel: cySelector('blockEditor.configPanel.container'),
      configPanelScroll: cySelector('blockEditor.configPanel.scroll'),
      // Entity Fields Section (collapsible)
      configEntitySection: cySelector('blockEditor.configPanel.entityFieldsSection.container'),
      configEntityTrigger: cySelector('blockEditor.configPanel.entityFieldsSection.trigger'),
      configEntityContent: cySelector('blockEditor.configPanel.entityFieldsSection.content'),
      configEntityField: (name: string) =>
        cySelector('blockEditor.configPanel.entityFieldsSection.field', { name }),
      // SEO Section (collapsible) - v2.0 moved from entityMetaPanel
      configSeoSection: cySelector('blockEditor.configPanel.seoMetaSection.container'),
      configSeoTrigger: cySelector('blockEditor.configPanel.seoMetaSection.trigger'),
      configSeoContent: cySelector('blockEditor.configPanel.seoMetaSection.content'),
      configMetaTitle: cySelector('blockEditor.configPanel.seoMetaSection.metaTitle'),
      configMetaDescription: cySelector('blockEditor.configPanel.seoMetaSection.metaDescription'),

      // =========================================================================
      // ENTITY FIELDS PANEL - DEPRECATED (moved to configPanel in v2.0)
      // =========================================================================
      /** @deprecated Use configEntitySection in Settings mode instead */
      entityFieldsPanel: cySelector('blockEditor.configPanel.entityFieldsSection.container'),
      /** @deprecated Use configEntityField instead */
      entityField: (name: string) =>
        cySelector('blockEditor.configPanel.entityFieldsSection.field', { name }),
      entityCategoryList: cySelector('blockEditor.entityFieldsPanel.categoryList'),
      entityCategory: (slug: string) =>
        cySelector('blockEditor.entityFieldsPanel.categoryItem', { slug }),
      entityCategoryCheckbox: (slug: string) =>
        cySelector('blockEditor.entityFieldsPanel.categoryCheckbox', { slug }),

      // =========================================================================
      // LAYOUT CANVAS - Center column - Layout mode (draggable cards)
      // =========================================================================
      layoutCanvas: cySelector('blockEditor.layoutCanvas.container'),
      layoutCanvasEmpty: cySelector('blockEditor.layoutCanvas.empty'),
      layoutDropZone: cySelector('blockEditor.layoutCanvas.dropZone'),
      // Sortable block cards
      sortableBlock: (id: string) =>
        cySelector('blockEditor.layoutCanvas.sortableBlock.container', { id }),
      sortableBlockCard: (id: string) =>
        cySelector('blockEditor.layoutCanvas.sortableBlock.card', { id }),
      dragHandle: (id: string) =>
        cySelector('blockEditor.layoutCanvas.sortableBlock.dragHandle', { id }),
      sortableBlockName: (id: string) =>
        cySelector('blockEditor.layoutCanvas.sortableBlock.name', { id }),
      duplicateBlock: (id: string) =>
        cySelector('blockEditor.layoutCanvas.sortableBlock.duplicateBtn', { id }),
      removeBlock: (id: string) =>
        cySelector('blockEditor.layoutCanvas.sortableBlock.removeBtn', { id }),
      blockError: (id: string) =>
        cySelector('blockEditor.layoutCanvas.sortableBlock.error', { id }),
      // Generic selector for counting all sortable blocks
      sortableBlockGeneric: '[data-cy^="sortable-block-"]',

      // =========================================================================
      // PREVIEW CANVAS - Center column - Preview mode (real blocks)
      // =========================================================================
      previewCanvas: cySelector('blockEditor.previewCanvas.container'),
      previewWrapper: cySelector('blockEditor.previewCanvas.wrapper'),
      previewCanvasEmpty: cySelector('blockEditor.previewCanvas.empty'),
      previewBlock: (id: string) => cySelector('blockEditor.previewCanvas.block', { id }),
      previewBlockWrapper: (id: string) =>
        cySelector('blockEditor.previewCanvas.blockWrapper', { id }),
      previewBlockSelected: (id: string) =>
        cySelector('blockEditor.previewCanvas.blockSelected', { id }),
      // Generic selector for counting all preview blocks
      previewBlockGeneric: '[data-cy^="preview-block-"]',
      // Move buttons
      moveUpBtn: (id: string) => cySelector('blockEditor.previewCanvas.moveUp', { id }),
      moveDownBtn: (id: string) => cySelector('blockEditor.previewCanvas.moveDown', { id }),
      // Floating toolbar
      floatingToolbar: (id: string) =>
        cySelector('blockEditor.previewCanvas.floatingToolbar.container', { id }),
      floatingToolbarDrag: (id: string) =>
        cySelector('blockEditor.previewCanvas.floatingToolbar.dragHandle', { id }),
      floatingToolbarName: (id: string) =>
        cySelector('blockEditor.previewCanvas.floatingToolbar.blockName', { id }),
      floatingToolbarDuplicate: (id: string) =>
        cySelector('blockEditor.previewCanvas.floatingToolbar.duplicateBtn', { id }),
      floatingToolbarDelete: (id: string) =>
        cySelector('blockEditor.previewCanvas.floatingToolbar.deleteBtn', { id }),

      // =========================================================================
      // PATTERN REFERENCE (in canvas)
      // =========================================================================
      patternReference: (ref: string) =>
        cySelector('blockEditor.patternReference.container', { ref }),
      patternReferenceBadge: (ref: string) =>
        cySelector('blockEditor.patternReference.badge', { ref }),
      patternReferenceRemove: (ref: string) =>
        cySelector('blockEditor.patternReference.remove', { ref }),
      patternReferenceLocked: (ref: string) =>
        cySelector('blockEditor.patternReference.locked', { ref }),
      patternReferenceEditLink: (ref: string) =>
        cySelector('blockEditor.patternReference.editLink', { ref }),
      // Generic selector for counting pattern references
      patternReferenceGeneric: '[data-cy^="pattern-reference-"]',

      // =========================================================================
      // ENTITY META PANEL - SEO and custom fields
      // =========================================================================
      entityMetaPanel: cySelector('blockEditor.entityMetaPanel.container'),
      // SEO section
      seoTrigger: cySelector('blockEditor.entityMetaPanel.seoSection.trigger'),
      seoContent: cySelector('blockEditor.entityMetaPanel.seoSection.content'),
      metaTitle: cySelector('blockEditor.entityMetaPanel.seoSection.metaTitle'),
      metaDescription: cySelector('blockEditor.entityMetaPanel.seoSection.metaDescription'),
      metaKeywords: cySelector('blockEditor.entityMetaPanel.seoSection.metaKeywords'),
      ogImage: cySelector('blockEditor.entityMetaPanel.seoSection.ogImage'),
      // Custom fields section
      customFieldsTrigger: cySelector('blockEditor.entityMetaPanel.customFields.trigger'),
      customFieldsContent: cySelector('blockEditor.entityMetaPanel.customFields.content'),
      customFieldKey: (index: number) =>
        cySelector('blockEditor.entityMetaPanel.customFields.fieldKey', { index }),
      customFieldValue: (index: number) =>
        cySelector('blockEditor.entityMetaPanel.customFields.fieldValue', { index }),
      customFieldRemove: (index: number) =>
        cySelector('blockEditor.entityMetaPanel.customFields.fieldRemove', { index }),
      addCustomField: cySelector('blockEditor.entityMetaPanel.customFields.addButton'),

      // =========================================================================
      // BLOCK PROPERTIES PANEL - Right column
      // =========================================================================
      blockPropertiesPanel: cySelector('blockEditor.blockPropertiesPanel.container'),
      blockPropertiesHeader: cySelector('blockEditor.blockPropertiesPanel.header'),
      blockPropertiesClose: cySelector('blockEditor.blockPropertiesPanel.closeBtn'),
      blockPropertiesIcon: cySelector('blockEditor.blockPropertiesPanel.blockIcon'),
      blockPropertiesName: cySelector('blockEditor.blockPropertiesPanel.blockName'),
      blockPropertiesTabs: cySelector('blockEditor.blockPropertiesPanel.tabs'),
      tabContent: cySelector('blockEditor.blockPropertiesPanel.tabContent'),
      tabDesign: cySelector('blockEditor.blockPropertiesPanel.tabDesign'),
      tabAdvanced: cySelector('blockEditor.blockPropertiesPanel.tabAdvanced'),
      blockPropertiesEmpty: cySelector('blockEditor.blockPropertiesPanel.empty'),
      blockPropertiesError: cySelector('blockEditor.blockPropertiesPanel.error'),
      // Dynamic form
      dynamicForm: cySelector('blockEditor.blockPropertiesPanel.form.container'),
      dynamicField: (name: string) =>
        cySelector('blockEditor.blockPropertiesPanel.form.field', { name }),
      /** @deprecated Use dynamicField instead */
      fieldInput: (name: string) =>
        cySelector('blockEditor.blockPropertiesPanel.form.field', { name }),
      fieldGroup: (id: string) =>
        cySelector('blockEditor.blockPropertiesPanel.form.fieldGroup', { id }),
      // Reset props button
      resetPropsBtn: cySelector('blockEditor.blockPropertiesPanel.resetPropsBtn'),
      // Array field
      arrayFieldContainer: (name: string) =>
        cySelector('blockEditor.blockPropertiesPanel.form.arrayField.container', { name }),
      arrayFieldItem: (name: string, index: number) =>
        cySelector('blockEditor.blockPropertiesPanel.form.arrayField.item', { name, index }),
      arrayFieldItemField: (name: string, index: number, field: string) =>
        cySelector('blockEditor.blockPropertiesPanel.form.arrayField.itemField', { name, index, field }),
      arrayFieldMoveUp: (name: string, index: number) =>
        cySelector('blockEditor.blockPropertiesPanel.form.arrayField.itemMoveUp', { name, index }),
      arrayFieldMoveDown: (name: string, index: number) =>
        cySelector('blockEditor.blockPropertiesPanel.form.arrayField.itemMoveDown', { name, index }),
      arrayFieldRemove: (name: string, index: number) =>
        cySelector('blockEditor.blockPropertiesPanel.form.arrayField.itemRemove', { name, index }),
      arrayFieldAdd: (name: string) =>
        cySelector('blockEditor.blockPropertiesPanel.form.arrayField.addButton', { name }),
      // Generic selectors for array fields (for counting/prefix matching)
      arrayFieldGeneric: '[data-cy^="block-array-"]',
      arrayFieldAddGeneric: '[data-cy$="-add"][data-cy^="block-array-"]',
      arrayFieldRemoveGeneric: '[data-cy$="-remove"][data-cy^="block-array-"]',
      arrayFieldUpGeneric: '[data-cy$="-up"][data-cy^="block-array-"]',
      arrayFieldDownGeneric: '[data-cy$="-down"][data-cy^="block-array-"]',

      // =========================================================================
      // LEGACY ALIASES (for backward compatibility - will be removed)
      // =========================================================================
      /** @deprecated Use layoutCanvas instead */
      blockCanvas: cySelector('blockEditor.layoutCanvas.container'),
      /** @deprecated Use layoutCanvasEmpty instead */
      blockCanvasEmpty: cySelector('blockEditor.layoutCanvas.empty'),
      /** @deprecated Use blockPropertiesPanel instead */
      settingsPanel: cySelector('blockEditor.blockPropertiesPanel.container'),
      /** @deprecated Use blockPropertiesEmpty instead */
      settingsPanelEmpty: cySelector('blockEditor.blockPropertiesPanel.empty'),
      /** @deprecated Use blockPropertiesError instead */
      settingsPanelError: cySelector('blockEditor.blockPropertiesPanel.error'),
      /** @deprecated Use entityMetaPanel instead */
      pageSettings: cySelector('blockEditor.entityMetaPanel.container'),
      /** @deprecated Use entityFieldsPanel instead */
      entityFieldsSidebar: cySelector('blockEditor.entityFieldsPanel.container'),
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

  /**
   * Alias for waitForEditor (legacy compatibility)
   */
  waitForEditorLoad() {
    return this.waitForEditor()
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
   * Toggle view mode (edit/preview)
   */
  toggleViewMode() {
    cy.get(this.editorSelectors.viewModeToggle).click()
    return this
  }

  /**
   * Switch to Settings mode (v2.0 - entity fields, SEO, etc.)
   * In v2.0, this shows the configPanel in the center column.
   */
  switchToSettingsMode() {
    cy.get(this.editorSelectors.viewSettings).click()
    return this
  }

  /**
   * Switch to Layout/Editor mode
   * @deprecated In v2.0, Layout is now a tab in BlockPicker (tabLayout), not a view mode.
   * Use selectLayoutTab() for tree view, or switchToSettingsMode() for entity config.
   */
  switchToLayoutMode() {
    // v2.0: "Layout" mode is now accessed via the Layout tab in left sidebar
    // This method now clicks the Layout tab for backward compatibility
    cy.get(this.editorSelectors.tabLayout).click()
    return this
  }

  /**
   * Switch to Preview mode
   */
  switchToPreviewMode() {
    cy.get(this.editorSelectors.viewPreview).click()
    return this
  }

  /**
   * Select Blocks tab in left sidebar
   */
  selectBlocksTab() {
    cy.get(this.editorSelectors.tabBlocks).click()
    return this
  }

  /**
   * Select Config/Fields tab in left sidebar
   * @deprecated In v2.0, entity fields moved to Settings mode (center column).
   * Use switchToSettingsMode() for entity config/fields.
   */
  selectConfigTab() {
    // v2.0: Config is now accessed via Settings mode, not a tab
    cy.get(this.editorSelectors.viewSettings).click()
    return this
  }

  /**
   * Select Layout tab in left sidebar (tree view)
   */
  selectLayoutTab() {
    cy.get(this.editorSelectors.tabLayout).click()
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
    cy.get(this.editorSelectors.category('all')).click()
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
    cy.get(this.editorSelectors.moveUpBtn(blockId)).click()
    return this
  }

  /**
   * Move block down in preview
   */
  moveBlockDown(blockId: string) {
    cy.get(this.editorSelectors.moveDownBtn(blockId)).click()
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
    cy.get(this.editorSelectors.resetPropsBtn).click()
    return this
  }

  /**
   * Fill a dynamic form field
   */
  fillDynamicField(name: string, value: string) {
    cy.get(this.editorSelectors.dynamicField(name)).find('input, textarea').clear().type(value)
    return this
  }

  /**
   * Alias for fillDynamicField (legacy compatibility)
   */
  fillField(name: string, value: string) {
    return this.fillDynamicField(name, value)
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
   * Assert status label shows specific status
   */
  assertStatus(status: string) {
    cy.get(this.editorSelectors.statusLabel).should('contain.text', status)
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

  /**
   * Assert block count in canvas
   */
  assertBlockCount(count: number) {
    cy.get(this.editorSelectors.sortableBlockGeneric).should('have.length', count)
    return this
  }

  /**
   * Assert preview block count
   */
  assertPreviewBlockCount(count: number) {
    cy.get(this.editorSelectors.previewBlockGeneric).should('have.length', count)
    return this
  }

  /**
   * Assert block is visible in picker
   */
  assertBlockInPicker(blockSlug: string) {
    cy.get(this.editorSelectors.blockItem(blockSlug))
      .scrollIntoView()
      .should('be.visible')
    return this
  }

  /**
   * Assert block picker is visible
   */
  assertBlockPickerVisible() {
    cy.get(this.editorSelectors.blockPicker).should('be.visible')
    return this
  }
}

export default BlockEditorBasePOM
