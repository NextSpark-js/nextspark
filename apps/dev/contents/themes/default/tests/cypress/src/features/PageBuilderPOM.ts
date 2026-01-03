/**
 * PageBuilderPOM - Page Object Model for Page Builder (create/edit pages with blocks)
 *
 * Extends BlockEditorBasePOM with page-specific functionality:
 * - Page settings (locale, status)
 * - SEO settings
 * - Page-specific workflows
 *
 * For list operations (search, filter, delete), use PagesPOM from entities/.
 *
 * @example
 * // Create a new page
 * PageBuilderPOM.create()
 *   .visitCreate()
 *   .waitForEditor()
 *   .setTitle('About Us')
 *   .setSlug('about-us')
 *   .addBlock('hero-section')
 *   .addBlock('text-content')
 *   .setStatus('published')
 *   .save()
 *
 * // Edit existing page
 * PageBuilderPOM.create()
 *   .visitEdit(pageId)
 *   .waitForEditor()
 *   .setTitle('New Title')
 *   .saveWithWait()
 */

import { BlockEditorBasePOM } from '../core/BlockEditorBasePOM'
import { cySelector } from '../selectors'
import entitiesConfig from '../../fixtures/entities.json'

export interface PageFormData {
  title: string
  slug: string
  locale?: 'en' | 'es'
  status?: 'draft' | 'published' | 'scheduled' | 'archived'
  metaTitle?: string
  metaDescription?: string
  metaKeywords?: string
}

export interface BlockData {
  slug: string
  props?: Record<string, unknown>
}

export class PageBuilderPOM extends BlockEditorBasePOM {
  protected entitySlug = entitiesConfig.entities.pages.slug

  // ============================================
  // FACTORY METHOD
  // ============================================

  static create(): PageBuilderPOM {
    return new PageBuilderPOM()
  }

  // ============================================
  // PAGE-SPECIFIC SELECTORS
  // ============================================

  get pageSelectors() {
    return {
      // Locale (pages only) - uses centralized selectors
      localeSelect: cySelector('blockEditor.localeField.select'),
      localeOption: (locale: string) => cySelector('blockEditor.localeField.option', { locale })
    }
  }

  // ============================================
  // PAGE-SPECIFIC METHODS
  // ============================================

  /**
   * Set page locale
   */
  setLocale(locale: 'en' | 'es') {
    cy.get(this.pageSelectors.localeSelect).click()
    cy.get(this.pageSelectors.localeOption(locale)).click()
    return this
  }

  /**
   * Publish the page (set status to published and save)
   */
  publishPage() {
    this.setStatus('published')
    this.save()
    return this
  }

  /**
   * Publish with API wait
   */
  publishPageWithWait() {
    this.setupApiIntercepts()
    this.setStatus('published')
    this.save()
    this.api.waitForUpdate()
    return this
  }

  /**
   * Unpublish the page (set status to draft)
   */
  unpublishPage() {
    this.setStatus('draft')
    this.save()
    return this
  }

  /**
   * Archive the page
   */
  archivePage() {
    this.setStatus('archived')
    this.save()
    return this
  }

  // ============================================
  // WORKFLOW METHODS
  // ============================================

  /**
   * Create a new page with specified data and blocks
   */
  createPage(data: PageFormData, blocks: BlockData[] = []) {
    this.visitCreate()
    this.waitForEditor()

    // Set page settings
    this.setTitle(data.title)
    this.setSlug(data.slug)

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

    // Set SEO if provided
    if (data.metaTitle || data.metaDescription || data.metaKeywords) {
      this.openSeoSettings()
      if (data.metaTitle) this.setMetaTitle(data.metaTitle)
      if (data.metaDescription) this.setMetaDescription(data.metaDescription)
      if (data.metaKeywords) this.setMetaKeywords(data.metaKeywords)
    }

    this.save()
    return this
  }

  /**
   * Create page with API waits (deterministic)
   */
  createPageWithApiWait(data: PageFormData, blocks: BlockData[] = []) {
    this.setupApiIntercepts()
    this.visitCreate()
    this.waitForEditor()

    this.setTitle(data.title)
    this.setSlug(data.slug)

    if (data.locale) this.setLocale(data.locale)

    blocks.forEach((block) => this.addBlock(block.slug))

    if (data.status) this.setStatus(data.status)

    if (data.metaTitle || data.metaDescription || data.metaKeywords) {
      this.openSeoSettings()
      if (data.metaTitle) this.setMetaTitle(data.metaTitle)
      if (data.metaDescription) this.setMetaDescription(data.metaDescription)
      if (data.metaKeywords) this.setMetaKeywords(data.metaKeywords)
    }

    this.save()
    this.api.waitForCreate()
    return this
  }

  /**
   * Edit an existing page
   */
  editPage(id: string, updates: Partial<PageFormData>) {
    this.visitEdit(id)
    this.waitForEditor()

    if (updates.title) this.setTitle(updates.title)
    if (updates.slug) this.setSlug(updates.slug)
    if (updates.locale) this.setLocale(updates.locale)
    if (updates.status) this.setStatus(updates.status)

    if (updates.metaTitle || updates.metaDescription || updates.metaKeywords) {
      this.openSeoSettings()
      if (updates.metaTitle) this.setMetaTitle(updates.metaTitle)
      if (updates.metaDescription) this.setMetaDescription(updates.metaDescription)
      if (updates.metaKeywords) this.setMetaKeywords(updates.metaKeywords)
    }

    this.save()
    return this
  }

  /**
   * Edit page with API waits
   */
  editPageWithApiWait(id: string, updates: Partial<PageFormData>) {
    this.setupApiIntercepts()
    this.editPage(id, updates)
    this.api.waitForUpdate()
    return this
  }

  // ============================================
  // PAGE-SPECIFIC ASSERTIONS
  // ============================================

  /**
   * Assert page status badge shows specific status
   */
  assertPageStatus(status: 'draft' | 'published' | 'scheduled' | 'archived') {
    return this.assertStatus(status)
  }

  /**
   * Assert locale is selected
   */
  assertLocale(locale: 'en' | 'es') {
    cy.get(this.pageSelectors.localeSelect).should('contain.text', locale)
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

export default PageBuilderPOM
