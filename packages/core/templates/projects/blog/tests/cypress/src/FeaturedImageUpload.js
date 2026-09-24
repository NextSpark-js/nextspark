/**
 * FeaturedImageUpload - Blog Theme Image Upload Component POM
 *
 * Handles drag & drop and file selection for featured images.
 * Supports preview, removal, and error states.
 */
export class FeaturedImageUpload {
  static selectors = {
    // Container
    container: '[data-cy="featured-image-container"]',

    // Upload Area
    dropzone: '[data-cy="featured-image-dropzone"]',
    input: '[data-cy="featured-image-input"]',

    // Preview
    preview: '[data-cy="featured-image-preview"]',
    remove: '[data-cy="featured-image-remove"]',

    // States
    loading: '[data-cy="featured-image-loading"]',
    error: '[data-cy="featured-image-error"]',
  }

  /**
   * Validate component is visible
   */
  validateVisible() {
    cy.get(FeaturedImageUpload.selectors.container).should('be.visible')
    return this
  }

  /**
   * Validate dropzone is visible (no image uploaded)
   */
  validateDropzoneVisible() {
    cy.get(FeaturedImageUpload.selectors.dropzone).should('be.visible')
    return this
  }

  /**
   * Validate preview is visible (image uploaded)
   */
  validatePreviewVisible() {
    cy.get(FeaturedImageUpload.selectors.preview).should('be.visible')
    return this
  }

  /**
   * Upload a file via file input
   * @param {string} filePath - Path to the file to upload
   */
  uploadFile(filePath) {
    cy.get(FeaturedImageUpload.selectors.input).selectFile(filePath, { force: true })
    return this
  }

  /**
   * Upload a file via drag and drop
   * @param {string} filePath - Path to the file to upload
   */
  dragAndDropFile(filePath) {
    cy.get(FeaturedImageUpload.selectors.dropzone).selectFile(filePath, {
      action: 'drag-drop',
    })
    return this
  }

  /**
   * Click dropzone to trigger file dialog
   */
  clickDropzone() {
    cy.get(FeaturedImageUpload.selectors.dropzone).click()
    return this
  }

  /**
   * Remove uploaded image
   */
  removeImage() {
    cy.get(FeaturedImageUpload.selectors.remove).click()
    return this
  }

  /**
   * Validate loading state
   */
  validateLoading() {
    cy.get(FeaturedImageUpload.selectors.loading).should('be.visible')
    return this
  }

  /**
   * Validate loading is complete
   */
  validateLoadingComplete() {
    cy.get(FeaturedImageUpload.selectors.loading).should('not.exist')
    return this
  }

  /**
   * Validate error is shown
   * @param {string} message - Expected error message (optional)
   */
  validateError(message) {
    cy.get(FeaturedImageUpload.selectors.error).should('be.visible')
    if (message) {
      cy.get(FeaturedImageUpload.selectors.error).should('contain.text', message)
    }
    return this
  }

  /**
   * Validate no error is shown
   */
  validateNoError() {
    cy.get(FeaturedImageUpload.selectors.error).should('not.exist')
    return this
  }

  /**
   * Wait for image to be uploaded and preview shown
   */
  waitForUpload() {
    cy.get(FeaturedImageUpload.selectors.loading).should('not.exist')
    cy.get(FeaturedImageUpload.selectors.preview).should('be.visible')
    return this
  }
}

export default FeaturedImageUpload
