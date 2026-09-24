/**
 * Post Editor POM
 *
 * Page Object Model for the Post Editor (create/edit posts with blocks).
 * Reuses Page Builder patterns for block management.
 *
 * Convention: post-{component}-{element}
 * Based on selectors documented in tests.md
 */

import { ApiInterceptor } from '../helpers/ApiInterceptor'

export interface PostFormData {
  title: string
  slug: string
  excerpt?: string
  featuredImage?: string
  categoryIds?: string[]
  published?: boolean
  locale?: 'en' | 'es'
}

export interface BlockData {
  slug: string
  props?: Record<string, unknown>
}

export class PostEditorPOM {
  // ============================================
  // STATIC CONFIG
  // ============================================

  static get slug() {
    return 'posts'
  }

  // ============================================
  // API INTERCEPTOR (for deterministic waits)
  // ============================================

  private static _api: ApiInterceptor | null = null

  /**
   * Get the API interceptor instance for posts
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
  static setupApiIntercepts(): typeof PostEditorPOM {
    this.api.setupCrudIntercepts()
    return this
  }

  // ============================================
  // SELECTORS - Post Editor
  // ============================================

  static get editorSelectors() {
    return {
      // Editor container
      editor: '[data-cy="post-editor"]',

      // Post form fields
      titleInput: '[data-cy="post-title-input"]',
      slugInput: '[data-cy="post-slug-input"]',
      excerptInput: '[data-cy="post-excerpt-input"]',
      featuredImage: '[data-cy="post-featured-image"]',
      categoriesSelect: '[data-cy="post-categories-select"]',
      publishToggle: '[data-cy="post-publish-toggle"]',
      saveButton: '[data-cy="post-save-button"]',
      publishButton: '[data-cy="post-publish-button"]',

      // Block editor (reuses page builder components)
      blockSelector: '[data-cy="post-block-selector"]',
      blockEditor: '[data-cy="post-block-editor"]',

      // From PageBuilderPOM patterns
      blockPicker: '[data-cy="block-picker"]',
      blockSearchInput: '[data-cy="block-search-input"]',
      blockItem: (slug: string) => `[data-cy="block-item-${slug}"]`,
      addBlockBtn: (slug: string) => `[data-cy="add-block-${slug}"]`,

      blockCanvas: '[data-cy="block-canvas"]',
      sortableBlock: (id: string) => `[data-cy="sortable-block-${id}"]`,
      removeBlock: (id: string) => `[data-cy="remove-block-${id}"]`,
      sortableBlockGeneric: '[data-cy^="sortable-block-"]',

      // Settings panel
      settingsPanel: '[data-cy="block-settings-panel"]',
      fieldInput: (name: string) => `[data-cy="field-${name}"]`,
    }
  }

  // ============================================
  // NAVIGATION
  // ============================================

  static visitCreate() {
    cy.visit('/dashboard/posts/create')
    return this
  }

  static visitEdit(id: string) {
    cy.visit(`/dashboard/posts/${id}/edit`)
    return this
  }

  // ============================================
  // API-AWARE NAVIGATION
  // ============================================

  /**
   * Visit create page with API intercepts
   */
  static visitCreateWithApiWait(): typeof PostEditorPOM {
    this.setupApiIntercepts()
    this.visitCreate()
    return this
  }

  /**
   * Visit edit page with API intercepts
   */
  static visitEditWithApiWait(id: string): typeof PostEditorPOM {
    this.setupApiIntercepts()
    this.visitEdit(id)
    return this
  }

  // ============================================
  // WAIT METHODS
  // ============================================

  static waitForEditorLoad() {
    cy.get(this.editorSelectors.editor, { timeout: 15000 }).should('be.visible')
    return this
  }

  static waitForBlockPickerLoad() {
    cy.get(this.editorSelectors.blockPicker, { timeout: 10000 }).should('be.visible')
    return this
  }

  // ============================================
  // POST FORM INTERACTIONS
  // ============================================

  static setTitle(title: string) {
    cy.get(this.editorSelectors.titleInput).clear().type(title)
    return this
  }

  static setSlug(slug: string) {
    cy.get(this.editorSelectors.slugInput).clear().type(slug)
    return this
  }

  static setExcerpt(excerpt: string) {
    cy.get(this.editorSelectors.excerptInput).clear().type(excerpt)
    return this
  }

  static setFeaturedImage(url: string) {
    cy.get(this.editorSelectors.featuredImage).clear().type(url)
    return this
  }

  static selectCategories(categoryNames: string[]) {
    // Click on categories select to open
    cy.get(this.editorSelectors.categoriesSelect).click()

    // Select each category
    categoryNames.forEach((name) => {
      cy.contains('[role="option"]', name).click()
    })

    // Click outside to close
    cy.get(this.editorSelectors.editor).click()
    return this
  }

  static togglePublish() {
    cy.get(this.editorSelectors.publishToggle).click()
    return this
  }

  static savePost() {
    cy.get(this.editorSelectors.saveButton).click()
    return this
  }

  static publishPost() {
    cy.get(this.editorSelectors.publishButton).click()
    return this
  }

  // ============================================
  // API-AWARE SAVE OPERATIONS
  // ============================================

  /**
   * Save post and wait for API response
   */
  static savePostWithApiWait(): typeof PostEditorPOM {
    this.savePost()
    this.api.waitForCreate()
    return this
  }

  /**
   * Update post and wait for API response
   */
  static updatePostWithApiWait(): typeof PostEditorPOM {
    this.savePost()
    this.api.waitForUpdate()
    return this
  }

  // ============================================
  // BLOCK EDITOR INTERACTIONS
  // ============================================

  static searchBlocks(term: string) {
    cy.get(this.editorSelectors.blockSearchInput).clear().type(term)
    return this
  }

  static addBlock(slug: string) {
    cy.get(this.editorSelectors.addBlockBtn(slug)).click()
    return this
  }

  static selectBlock(blockId: string) {
    cy.get(this.editorSelectors.sortableBlock(blockId)).click()
    return this
  }

  static removeBlock(blockId: string) {
    cy.get(this.editorSelectors.removeBlock(blockId)).click()
    return this
  }

  static fillBlockField(fieldName: string, value: string) {
    cy.get(this.editorSelectors.fieldInput(fieldName)).find('input, textarea').first().clear().type(value)
    return this
  }

  // ============================================
  // COMPLETE WORKFLOWS
  // ============================================

  /**
   * Create a new post with specified data and blocks
   */
  static createPost(data: PostFormData, blocks: BlockData[] = []) {
    this.visitCreate()
    this.waitForEditorLoad()

    // Set post fields
    this.setTitle(data.title)
    this.setSlug(data.slug)

    if (data.excerpt) {
      this.setExcerpt(data.excerpt)
    }

    if (data.featuredImage) {
      this.setFeaturedImage(data.featuredImage)
    }

    if (data.categoryIds && data.categoryIds.length > 0) {
      this.selectCategories(data.categoryIds)
    }

    // Add blocks
    blocks.forEach((block) => {
      this.addBlock(block.slug)
    })

    // Publish or save
    if (data.published) {
      this.publishPost()
    } else {
      this.savePost()
    }

    return this
  }

  /**
   * Create post with API wait for deterministic testing
   */
  static createPostWithApiWait(data: PostFormData, blocks: BlockData[] = []): typeof PostEditorPOM {
    this.setupApiIntercepts()
    this.visitCreate()
    this.waitForEditorLoad()

    this.setTitle(data.title)
    this.setSlug(data.slug)

    if (data.excerpt) this.setExcerpt(data.excerpt)
    if (data.featuredImage) this.setFeaturedImage(data.featuredImage)

    blocks.forEach((block) => this.addBlock(block.slug))

    this.savePost()
    this.api.waitForCreate()
    return this
  }

  // ============================================
  // ASSERTIONS
  // ============================================

  static assertEditorVisible() {
    cy.get(this.editorSelectors.editor).should('be.visible')
    return this
  }

  static assertBlockPickerVisible() {
    cy.get(this.editorSelectors.blockPicker).should('be.visible')
    return this
  }

  static assertBlockInPicker(blockSlug: string) {
    cy.get(this.editorSelectors.blockItem(blockSlug)).should('be.visible')
    return this
  }

  static assertBlockNotInPicker(blockSlug: string) {
    cy.get(this.editorSelectors.blockItem(blockSlug)).should('not.exist')
    return this
  }

  static assertBlockCount(count: number) {
    cy.get(this.editorSelectors.sortableBlockGeneric).should('have.length', count)
    return this
  }

  static assertTitleValue(title: string) {
    cy.get(this.editorSelectors.titleInput).should('have.value', title)
    return this
  }

  static assertSlugValue(slug: string) {
    cy.get(this.editorSelectors.slugInput).should('have.value', slug)
    return this
  }

  static assertSaveSuccess() {
    cy.contains('saved', { matchCase: false }).should('be.visible')
    return this
  }

  static assertPublishSuccess() {
    cy.contains('published', { matchCase: false }).should('be.visible')
    return this
  }
}

export default PostEditorPOM
