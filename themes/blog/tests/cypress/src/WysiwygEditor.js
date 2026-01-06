/**
 * WysiwygEditor - Blog Theme Rich Text Editor POM
 *
 * Handles content editing with formatting toolbar.
 * Based on native contentEditable with document.execCommand.
 *
 * Test cases: BLOG_EDITOR_001-006
 */
export class WysiwygEditor {
  static selectors = {
    // Container
    container: '[data-cy="wysiwyg-container"]',

    // Toolbar
    toolbar: '[data-cy="wysiwyg-toolbar"]',

    // Undo/Redo
    undo: '[data-cy="wysiwyg-undo"]',
    redo: '[data-cy="wysiwyg-redo"]',

    // Text Formatting
    bold: '[data-cy="wysiwyg-bold"]',
    italic: '[data-cy="wysiwyg-italic"]',
    underline: '[data-cy="wysiwyg-underline"]',
    strikeThrough: '[data-cy="wysiwyg-strikeThrough"]',

    // Headings
    h1: '[data-cy="wysiwyg-formatBlock-h1"]',
    h2: '[data-cy="wysiwyg-formatBlock-h2"]',
    h3: '[data-cy="wysiwyg-formatBlock-h3"]',

    // Lists
    bulletList: '[data-cy="wysiwyg-insertUnorderedList"]',
    orderedList: '[data-cy="wysiwyg-insertOrderedList"]',

    // Blocks
    blockquote: '[data-cy="wysiwyg-formatBlock-blockquote"]',
    codeBlock: '[data-cy="wysiwyg-formatBlock-pre"]',

    // Media/Links
    link: '[data-cy="wysiwyg-createLink"]',
    image: '[data-cy="wysiwyg-insertImage"]',
    horizontalRule: '[data-cy="wysiwyg-insertHorizontalRule"]',

    // Preview
    previewToggle: '[data-cy="wysiwyg-preview-toggle"]',
    preview: '[data-cy="wysiwyg-preview"]',

    // Editor
    editorWrapper: '[data-cy="wysiwyg-editor-wrapper"]',
    content: '[data-cy="wysiwyg-content"]',
    placeholder: '[data-cy="wysiwyg-placeholder"]',

    // Status Bar
    statusbar: '[data-cy="wysiwyg-statusbar"]',
    shortcuts: '[data-cy="wysiwyg-shortcuts"]',
    wordcount: '[data-cy="wysiwyg-wordcount"]',
  }

  /**
   * Validate editor is visible
   */
  validateVisible() {
    cy.get(WysiwygEditor.selectors.container).should('be.visible')
    cy.get(WysiwygEditor.selectors.toolbar).should('be.visible')
    return this
  }

  /**
   * Focus the editor content area
   */
  focus() {
    cy.get(WysiwygEditor.selectors.content).focus()
    return this
  }

  /**
   * Type content into the editor
   * @param {string} text - Text to type
   */
  typeContent(text) {
    cy.get(WysiwygEditor.selectors.content)
      .focus()
      .type(text)
    return this
  }

  /**
   * Clear all content
   */
  clearContent() {
    cy.get(WysiwygEditor.selectors.content)
      .focus()
      .clear()
    return this
  }

  /**
   * Get content HTML
   */
  getContent() {
    return cy.get(WysiwygEditor.selectors.content).invoke('html')
  }

  /**
   * Validate content contains text
   * @param {string} text - Expected text
   */
  validateContentContains(text) {
    cy.get(WysiwygEditor.selectors.content).should('contain.text', text)
    return this
  }

  /**
   * Select all content
   */
  selectAll() {
    cy.get(WysiwygEditor.selectors.content)
      .focus()
      .type('{selectall}')
    return this
  }

  /**
   * Toggle bold formatting
   */
  toggleBold() {
    cy.get(WysiwygEditor.selectors.bold).click()
    return this
  }

  /**
   * Toggle italic formatting
   */
  toggleItalic() {
    cy.get(WysiwygEditor.selectors.italic).click()
    return this
  }

  /**
   * Toggle underline formatting
   */
  toggleUnderline() {
    cy.get(WysiwygEditor.selectors.underline).click()
    return this
  }

  /**
   * Toggle strikethrough formatting
   */
  toggleStrikethrough() {
    cy.get(WysiwygEditor.selectors.strikeThrough).click()
    return this
  }

  /**
   * Insert heading
   * @param {number} level - Heading level (1, 2, or 3)
   */
  insertHeading(level) {
    const headingMap = {
      1: WysiwygEditor.selectors.h1,
      2: WysiwygEditor.selectors.h2,
      3: WysiwygEditor.selectors.h3,
    }
    cy.get(headingMap[level]).click()
    return this
  }

  /**
   * Insert bullet list
   */
  insertBulletList() {
    cy.get(WysiwygEditor.selectors.bulletList).click()
    return this
  }

  /**
   * Insert ordered list
   */
  insertOrderedList() {
    cy.get(WysiwygEditor.selectors.orderedList).click()
    return this
  }

  /**
   * Insert blockquote
   */
  insertBlockquote() {
    cy.get(WysiwygEditor.selectors.blockquote).click()
    return this
  }

  /**
   * Insert code block
   */
  insertCodeBlock() {
    cy.get(WysiwygEditor.selectors.codeBlock).click()
    return this
  }

  /**
   * Insert horizontal rule
   */
  insertHorizontalRule() {
    cy.get(WysiwygEditor.selectors.horizontalRule).click()
    return this
  }

  /**
   * Insert link (will trigger browser prompt)
   * Note: In tests, you may need to stub window.prompt
   * @param {string} url - Link URL
   */
  insertLink(url) {
    cy.window().then(win => {
      cy.stub(win, 'prompt').returns(url)
    })
    cy.get(WysiwygEditor.selectors.link).click()
    return this
  }

  /**
   * Insert image (will trigger browser prompt)
   * Note: In tests, you may need to stub window.prompt
   * @param {string} url - Image URL
   */
  insertImage(url) {
    cy.window().then(win => {
      cy.stub(win, 'prompt').returns(url)
    })
    cy.get(WysiwygEditor.selectors.image).click()
    return this
  }

  /**
   * Click undo button
   */
  undo() {
    cy.get(WysiwygEditor.selectors.undo).click()
    return this
  }

  /**
   * Click redo button
   */
  redo() {
    cy.get(WysiwygEditor.selectors.redo).click()
    return this
  }

  /**
   * Use keyboard shortcut for undo
   */
  undoKeyboard() {
    cy.get(WysiwygEditor.selectors.content)
      .focus()
      .type('{ctrl+z}')
    return this
  }

  /**
   * Use keyboard shortcut for redo
   */
  redoKeyboard() {
    cy.get(WysiwygEditor.selectors.content)
      .focus()
      .type('{ctrl+shift+z}')
    return this
  }

  /**
   * Toggle preview mode
   */
  togglePreview() {
    cy.get(WysiwygEditor.selectors.previewToggle).click()
    return this
  }

  /**
   * Validate preview mode is active
   */
  validatePreviewMode() {
    cy.get(WysiwygEditor.selectors.preview).should('be.visible')
    cy.get(WysiwygEditor.selectors.content).should('not.exist')
    return this
  }

  /**
   * Validate edit mode is active
   */
  validateEditMode() {
    cy.get(WysiwygEditor.selectors.content).should('be.visible')
    cy.get(WysiwygEditor.selectors.preview).should('not.exist')
    return this
  }

  /**
   * Validate placeholder is visible
   * @param {string} text - Expected placeholder text (optional)
   */
  validatePlaceholder(text) {
    cy.get(WysiwygEditor.selectors.placeholder).should('be.visible')
    if (text) {
      cy.get(WysiwygEditor.selectors.placeholder).should('contain.text', text)
    }
    return this
  }

  /**
   * Validate placeholder is hidden (content exists)
   */
  validatePlaceholderHidden() {
    cy.get(WysiwygEditor.selectors.placeholder).should('not.exist')
    return this
  }

  /**
   * Validate word count
   * @param {number} count - Expected word count
   */
  validateWordCount(count) {
    cy.get(WysiwygEditor.selectors.wordcount)
      .should('contain.text', `${count} words`)
    return this
  }

  /**
   * Validate content contains specific HTML element
   * @param {string} tag - HTML tag name (e.g., 'h1', 'ul', 'blockquote')
   */
  validateContentHasElement(tag) {
    cy.get(WysiwygEditor.selectors.content)
      .find(tag)
      .should('exist')
    return this
  }

  /**
   * Validate bold text is present
   */
  validateHasBoldText() {
    cy.get(WysiwygEditor.selectors.content)
      .find('b, strong')
      .should('exist')
    return this
  }

  /**
   * Validate italic text is present
   */
  validateHasItalicText() {
    cy.get(WysiwygEditor.selectors.content)
      .find('i, em')
      .should('exist')
    return this
  }

  /**
   * Validate link is present
   * @param {string} url - Expected URL (optional)
   */
  validateHasLink(url) {
    const link = cy.get(WysiwygEditor.selectors.content).find('a')
    link.should('exist')
    if (url) {
      link.should('have.attr', 'href', url)
    }
    return this
  }
}

export default WysiwygEditor
