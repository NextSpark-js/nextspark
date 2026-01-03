/**
 * PostEditor - Blog Theme Post Create/Edit Page POM
 *
 * Handles post creation and editing with WYSIWYG editor.
 * Supports both create and edit modes with dynamic selector prefixes.
 *
 * Test cases: BLOG_POST_CREATE_001-004, BLOG_POST_UPDATE_001-004
 */
export class PostEditor {
  /**
   * Create a PostEditor instance
   * @param {string} mode - 'create' | 'edit'
   */
  constructor(mode = 'create') {
    this.mode = mode
    this.prefix = mode === 'create' ? 'post-create' : 'post-edit'
  }

  /**
   * Get selectors based on current mode
   */
  get selectors() {
    const prefix = this.prefix
    return {
      // Container
      container: `[data-cy="${prefix}-container"]`,
      header: `[data-cy="${prefix}-header"]`,

      // Navigation
      back: `[data-cy="${prefix}-back"]`,

      // Status
      status: `[data-cy="${prefix}-status"]`,
      autosaved: `[data-cy="${prefix}-autosaved"]`,

      // Actions
      settingsToggle: `[data-cy="${prefix}-settings-toggle"]`,
      save: `[data-cy="${prefix}-save"]`,
      publish: `[data-cy="${prefix}-publish"]`,
      unpublish: `[data-cy="${prefix}-unpublish"]`, // Edit mode only
      viewLive: `[data-cy="${prefix}-view-live"]`, // Edit mode only

      // Error
      error: `[data-cy="${prefix}-error"]`,
      errorDismiss: `[data-cy="${prefix}-error-dismiss"]`,

      // Editor
      title: `[data-cy="${prefix}-title"]`,
      content: `[data-cy="${prefix}-content"]`,

      // Settings Panel
      settings: `[data-cy="${prefix}-settings"]`,
      statusSelect: `[data-cy="${prefix}-status-select"]`,
      slug: `[data-cy="${prefix}-slug"]`,
      excerpt: `[data-cy="${prefix}-excerpt"]`,
      featuredImage: `[data-cy="${prefix}-featured-image"]`,
      featuredToggle: `[data-cy="${prefix}-featured-toggle"]`,

      // Delete Dialog (Edit mode only)
      delete: `[data-cy="${prefix}-delete"]`,
      deleteDialog: `[data-cy="${prefix}-delete-dialog"]`,
      deleteConfirm: `[data-cy="${prefix}-delete-confirm"]`,
      deleteCancel: `[data-cy="${prefix}-delete-cancel"]`,
    }
  }

  /**
   * Validate page is visible and loaded
   */
  validatePageVisible() {
    cy.get(this.selectors.container).should('be.visible')
    cy.get(this.selectors.header).should('be.visible')

    const urlPattern = this.mode === 'create'
      ? '/dashboard/posts/create'
      : '/dashboard/posts/.+/edit'
    cy.url().should('match', new RegExp(urlPattern))

    return this
  }

  /**
   * Click back button to return to posts list
   */
  clickBack() {
    cy.get(this.selectors.back).click()
    return this
  }

  /**
   * Fill post title
   * @param {string} title - Post title
   */
  fillTitle(title) {
    cy.get(this.selectors.title)
      .clear()
      .type(title)
    return this
  }

  /**
   * Get current title value
   */
  getTitle() {
    return cy.get(this.selectors.title).invoke('val')
  }

  /**
   * Validate title value
   * @param {string} expectedTitle - Expected title
   */
  validateTitle(expectedTitle) {
    cy.get(this.selectors.title).should('have.value', expectedTitle)
    return this
  }

  /**
   * Focus on content editor
   */
  focusContent() {
    cy.get(this.selectors.content).find('[data-cy="wysiwyg-content"]').focus()
    return this
  }

  /**
   * Type content in the WYSIWYG editor
   * @param {string} content - Content to type
   */
  typeContent(content) {
    cy.get(this.selectors.content)
      .find('[data-cy="wysiwyg-content"]')
      .focus()
      .type(content)
    return this
  }

  /**
   * Toggle settings panel visibility
   */
  toggleSettings() {
    cy.get(this.selectors.settingsToggle).click()
    return this
  }

  /**
   * Validate settings panel is visible
   */
  validateSettingsVisible() {
    cy.get(this.selectors.settings).should('be.visible')
    return this
  }

  /**
   * Validate settings panel is hidden
   */
  validateSettingsHidden() {
    cy.get(this.selectors.settings).should('not.exist')
    return this
  }

  /**
   * Set post status via dropdown
   * @param {string} status - 'draft' | 'published'
   */
  setStatus(status) {
    cy.get(this.selectors.statusSelect).click()
    cy.get(`[data-value="${status}"]`).click()
    return this
  }

  /**
   * Fill URL slug
   * @param {string} slug - URL slug
   */
  fillSlug(slug) {
    cy.get(this.selectors.slug)
      .clear()
      .type(slug)
    return this
  }

  /**
   * Validate slug value
   * @param {string} expectedSlug - Expected slug
   */
  validateSlug(expectedSlug) {
    cy.get(this.selectors.slug).should('have.value', expectedSlug)
    return this
  }

  /**
   * Fill excerpt
   * @param {string} excerpt - Post excerpt
   */
  fillExcerpt(excerpt) {
    cy.get(this.selectors.excerpt)
      .clear()
      .type(excerpt)
    return this
  }

  /**
   * Toggle featured post switch
   * @param {boolean} enabled - Whether to enable featured
   */
  toggleFeatured(enabled) {
    const expectedState = enabled ? 'checked' : 'unchecked'

    cy.get(this.selectors.featuredToggle).then($switch => {
      const currentState = $switch.attr('data-state')
      if (currentState !== expectedState) {
        // Click the switch element directly (it's already a button)
        cy.wrap($switch).click({ force: true })
      }
    })

    // Wait for state update and verify
    cy.get(this.selectors.featuredToggle, { timeout: 5000 })
      .should('have.attr', 'data-state', expectedState)

    return this
  }

  /**
   * Validate featured toggle state
   * @param {boolean} enabled - Expected state
   */
  validateFeaturedState(enabled) {
    const expectedState = enabled ? 'checked' : 'unchecked'
    cy.get(this.selectors.featuredToggle, { timeout: 5000 })
      .should('have.attr', 'data-state', expectedState)
    return this
  }

  /**
   * Click save draft button
   */
  saveDraft() {
    cy.get(this.selectors.save).click()
    return this
  }

  /**
   * Click publish button
   */
  publish() {
    cy.get(this.selectors.publish).click()
    return this
  }

  /**
   * Click unpublish button (edit mode only)
   */
  unpublish() {
    if (this.mode !== 'edit') {
      throw new Error('unpublish is only available in edit mode')
    }
    cy.get(this.selectors.unpublish).click()
    return this
  }

  /**
   * Click view live button (edit mode only)
   */
  clickViewLive() {
    if (this.mode !== 'edit') {
      throw new Error('viewLive is only available in edit mode')
    }
    cy.get(this.selectors.viewLive).click()
    return this
  }

  /**
   * Click delete button to open dialog (edit mode only)
   */
  clickDelete() {
    if (this.mode !== 'edit') {
      throw new Error('delete is only available in edit mode')
    }
    cy.get(this.selectors.delete).click()
    return this
  }

  /**
   * Confirm deletion in dialog (edit mode only)
   */
  confirmDelete() {
    cy.get(this.selectors.deleteDialog).should('be.visible')
    cy.get(this.selectors.deleteConfirm).click()
    return this
  }

  /**
   * Cancel deletion in dialog (edit mode only)
   */
  cancelDelete() {
    cy.get(this.selectors.deleteDialog).should('be.visible')
    cy.get(this.selectors.deleteCancel).click()
    return this
  }

  /**
   * Validate delete dialog is visible
   */
  validateDeleteDialogVisible() {
    cy.get(this.selectors.deleteDialog).should('be.visible')
    return this
  }

  /**
   * Validate auto-saved indicator is shown
   */
  validateAutoSaved() {
    cy.get(this.selectors.autosaved).should('be.visible')
    return this
  }

  /**
   * Validate error message is shown
   * @param {string} errorType - Error type code (e.g., 'title-required') for data-cy-error matching
   */
  validateError(errorType) {
    cy.get(this.selectors.error).should('be.visible')
    if (errorType) {
      cy.get(this.selectors.error).should('have.attr', 'data-cy-error', errorType)
    }
    return this
  }

  /**
   * Dismiss error message
   */
  dismissError() {
    cy.get(this.selectors.errorDismiss).click()
    return this
  }

  /**
   * Validate error is not visible
   */
  validateNoError() {
    cy.get(this.selectors.error).should('not.exist')
    return this
  }

  /**
   * Validate status badge shows correct status using data-cy-status attribute
   * @param {string} status - Status code: 'draft' | 'published' | 'new-draft' | 'new-post'
   */
  validateStatusBadge(status) {
    cy.get(this.selectors.status).should('have.attr', 'data-cy-status', status)
    return this
  }

  /**
   * Validate unsaved changes indicator is visible (edit mode only)
   */
  validateUnsavedChanges() {
    cy.get('[data-cy="post-unsaved-indicator"]').should('be.visible')
    return this
  }

  /**
   * Validate unsaved changes indicator is not visible
   */
  validateNoUnsavedChanges() {
    cy.get('[data-cy="post-unsaved-indicator"]').should('not.exist')
    return this
  }

  /**
   * Fill complete post form
   * @param {object} post - Post data
   */
  fillPost(post) {
    if (post.title) this.fillTitle(post.title)
    if (post.content) this.typeContent(post.content)
    if (post.slug) this.fillSlug(post.slug)
    if (post.excerpt) this.fillExcerpt(post.excerpt)
    if (post.featured !== undefined) this.toggleFeatured(post.featured)
    if (post.status) this.setStatus(post.status)
    return this
  }
}

export default PostEditor
