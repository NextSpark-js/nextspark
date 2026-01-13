/**
 * PostEditorPOM - Page Object Model for Post Editor (create/edit posts with blocks)
 *
 * Extends BlockEditorBasePOM with post-specific functionality:
 * - Excerpt
 * - Featured image
 * - Categories
 * - Post-specific workflows
 *
 * For list operations (search, filter, delete), use PostsPOM from entities/.
 *
 * @example
 * // Create a new post
 * PostEditorPOM.create()
 *   .visitCreate()
 *   .waitForEditor()
 *   .setTitle('My Blog Post')
 *   .setSlug('my-blog-post')
 *   .setExcerpt('A brief summary...')
 *   .addBlock('text-content')
 *   .setStatus('published')
 *   .save()
 *
 * // Edit existing post
 * PostEditorPOM.create()
 *   .visitEdit(postId)
 *   .waitForEditor()
 *   .setTitle('Updated Title')
 *   .saveWithWait()
 */

import { BlockEditorBasePOM } from '../core/BlockEditorBasePOM'
import { cySelector } from '../selectors'
import entitiesConfig from '../../fixtures/entities.json'

export interface PostFormData {
  title: string
  slug: string
  excerpt?: string
  featuredImage?: string
  categoryIds?: string[]
  status?: 'draft' | 'published' | 'archived'
  locale?: 'en' | 'es'
}

export interface BlockData {
  slug: string
  props?: Record<string, unknown>
}

export class PostEditorPOM extends BlockEditorBasePOM {
  protected entitySlug = entitiesConfig.entities.posts.slug

  // ============================================
  // FACTORY METHOD
  // ============================================

  static create(): PostEditorPOM {
    return new PostEditorPOM()
  }

  // ============================================
  // POST-SPECIFIC SELECTORS
  // ============================================

  get postSelectors() {
    return {
      // Post-specific fields (using centralized selectors)
      excerptInput: cySelector('blockEditor.postFields.excerpt'),
      featuredImage: cySelector('blockEditor.postFields.featuredImage'),
      featuredImageUpload: cySelector('blockEditor.postFields.featuredImageUpload'),
      categoriesSelect: cySelector('blockEditor.postFields.categories'),
      categoryOption: (id: string) => cySelector('blockEditor.postFields.categoryOption', { id }),
      categoryBadge: (id: string) => cySelector('blockEditor.postFields.categoryBadge', { id }),
      categoryRemove: (id: string) => cySelector('blockEditor.postFields.categoryRemove', { id }),

      // Locale (posts may also have locale)
      localeSelect: cySelector('blockEditor.localeField.select'),
      localeOption: (locale: string) => cySelector('blockEditor.localeField.option', { locale })
    }
  }

  // ============================================
  // POST-SPECIFIC METHODS
  // ============================================

  /**
   * Set post excerpt
   */
  setExcerpt(excerpt: string) {
    cy.get(this.postSelectors.excerptInput).clear().type(excerpt)
    return this
  }

  /**
   * Set featured image URL
   */
  setFeaturedImage(url: string) {
    cy.get(this.postSelectors.featuredImage).clear().type(url)
    return this
  }

  /**
   * Select categories for the post
   */
  selectCategories(categoryIds: string[]) {
    cy.get(this.postSelectors.categoriesSelect).click()
    categoryIds.forEach((id) => {
      cy.get(this.postSelectors.categoryOption(id)).click()
    })
    // Close dropdown by clicking outside
    cy.get(this.editorSelectors.container).click()
    return this
  }

  /**
   * Remove a category from the post
   */
  removeCategory(categoryId: string) {
    cy.get(this.postSelectors.categoryRemove(categoryId)).click()
    return this
  }

  /**
   * Set post locale
   */
  setLocale(locale: 'en' | 'es') {
    cy.get(this.postSelectors.localeSelect).click()
    cy.get(this.postSelectors.localeOption(locale)).click()
    return this
  }

  /**
   * Publish the post (set status to published and save)
   */
  publishPost() {
    this.setStatus('published')
    this.save()
    return this
  }

  /**
   * Publish with API wait
   */
  publishPostWithWait() {
    this.setupApiIntercepts()
    this.setStatus('published')
    this.save()
    this.api.waitForUpdate()
    return this
  }

  /**
   * Unpublish the post (set status to draft)
   */
  unpublishPost() {
    this.setStatus('draft')
    this.save()
    return this
  }

  // ============================================
  // WORKFLOW METHODS
  // ============================================

  /**
   * Create a new post with specified data and blocks
   */
  createPost(data: PostFormData, blocks: BlockData[] = []) {
    this.visitCreate()
    this.waitForEditor()

    // Set post settings
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

    if (data.locale) {
      this.setLocale(data.locale)
    }

    // Add blocks
    blocks.forEach((block) => {
      this.addBlock(block.slug)
    })

    // Set status if provided
    if (data.status) {
      this.setStatus(data.status)
    }

    this.save()
    return this
  }

  /**
   * Create post with API waits (deterministic)
   */
  createPostWithApiWait(data: PostFormData, blocks: BlockData[] = []) {
    this.setupApiIntercepts()
    this.visitCreate()
    this.waitForEditor()

    this.setTitle(data.title)
    this.setSlug(data.slug)

    if (data.excerpt) this.setExcerpt(data.excerpt)
    if (data.featuredImage) this.setFeaturedImage(data.featuredImage)
    if (data.categoryIds && data.categoryIds.length > 0) this.selectCategories(data.categoryIds)
    if (data.locale) this.setLocale(data.locale)

    blocks.forEach((block) => this.addBlock(block.slug))

    if (data.status) this.setStatus(data.status)

    this.save()
    this.api.waitForCreate()
    return this
  }

  /**
   * Edit an existing post
   */
  editPost(id: string, updates: Partial<PostFormData>) {
    this.visitEdit(id)
    this.waitForEditor()

    if (updates.title) this.setTitle(updates.title)
    if (updates.slug) this.setSlug(updates.slug)
    if (updates.excerpt) this.setExcerpt(updates.excerpt)
    if (updates.featuredImage) this.setFeaturedImage(updates.featuredImage)
    if (updates.categoryIds) this.selectCategories(updates.categoryIds)
    if (updates.locale) this.setLocale(updates.locale)
    if (updates.status) this.setStatus(updates.status)

    this.save()
    return this
  }

  /**
   * Edit post with API waits
   */
  editPostWithApiWait(id: string, updates: Partial<PostFormData>) {
    this.setupApiIntercepts()
    this.editPost(id, updates)
    this.api.waitForUpdate()
    return this
  }

  // ============================================
  // POST-SPECIFIC ASSERTIONS
  // ============================================

  /**
   * Assert post status badge shows specific status
   */
  assertPostStatus(status: 'draft' | 'published' | 'archived') {
    return this.assertStatus(status)
  }

  /**
   * Assert excerpt value
   */
  assertExcerpt(excerpt: string) {
    cy.get(this.postSelectors.excerptInput).should('have.value', excerpt)
    return this
  }

  /**
   * Assert featured image URL
   */
  assertFeaturedImage(url: string) {
    cy.get(this.postSelectors.featuredImage).should('have.value', url)
    return this
  }

  /**
   * Assert category is selected
   */
  assertCategorySelected(categoryId: string) {
    cy.get(this.postSelectors.categoryBadge(categoryId)).should('be.visible')
    return this
  }

  /**
   * Assert save was successful
   */
  assertSaveSuccess() {
    cy.contains('saved', { matchCase: false }).should('be.visible')
    return this
  }

  /**
   * Assert publish was successful
   */
  assertPublishSuccess() {
    this.assertStatus('published')
    return this
  }
}

export default PostEditorPOM
