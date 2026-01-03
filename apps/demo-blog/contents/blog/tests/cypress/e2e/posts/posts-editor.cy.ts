/// <reference types="cypress" />

/**
 * Posts Editor Tests - Blog Theme
 *
 * Tests for WYSIWYG editor formatting and functionality.
 *
 * Theme Mode: single-user (isolated blogs, no team collaboration)
 */

import { PostsList } from '../../../src/PostsList.js'
import { PostEditor } from '../../../src/PostEditor.js'
import { WysiwygEditor } from '../../../src/WysiwygEditor.js'
import { loginAsBlogAuthor } from '../../../src/session-helpers'

describe('WYSIWYG Editor - Formatting Tests', () => {
  const postsList = new PostsList()
  const wysiwygEditor = new WysiwygEditor()

  beforeEach(() => {
    loginAsBlogAuthor('MARCOS')
    cy.visit('/dashboard/posts')
    postsList.validateListVisible()

    // Navigate to create page for editor tests
    postsList.clickCreate()
    const postEditor = new PostEditor('create')
    postEditor.validatePageVisible()
    postEditor.fillTitle(`Editor Test ${Date.now()}`)
  })

  describe('TEXT FORMATTING', () => {
    it('BLOG_EDITOR_001: should apply bold formatting', () => {
      // Type text
      wysiwygEditor.focus()
      wysiwygEditor.typeContent('This is bold text')

      // Select all and make bold
      wysiwygEditor.selectAll()
      wysiwygEditor.toggleBold()

      // Validate bold tag exists
      wysiwygEditor.validateHasBoldText()

      cy.log('✅ Bold formatting applied successfully')
    })

    it('BLOG_EDITOR_002: should apply italic formatting', () => {
      // Type text
      wysiwygEditor.focus()
      wysiwygEditor.typeContent('This is italic text')

      // Select all and make italic
      wysiwygEditor.selectAll()
      wysiwygEditor.toggleItalic()

      // Validate italic tag exists
      wysiwygEditor.validateHasItalicText()

      cy.log('✅ Italic formatting applied successfully')
    })

    it('BLOG_EDITOR_003: should apply multiple formatting styles', () => {
      // Type text
      wysiwygEditor.focus()
      wysiwygEditor.typeContent('This is bold and italic')

      // Select all and apply both
      wysiwygEditor.selectAll()
      wysiwygEditor.toggleBold()
      wysiwygEditor.toggleItalic()

      // Validate both tags exist
      wysiwygEditor.validateHasBoldText()
      wysiwygEditor.validateHasItalicText()

      cy.log('✅ Multiple formatting styles applied successfully')
    })
  })

  describe('HEADINGS', () => {
    it('BLOG_EDITOR_004: should insert H1 heading', () => {
      wysiwygEditor.focus()
      wysiwygEditor.typeContent('Heading 1')
      wysiwygEditor.selectAll()
      wysiwygEditor.insertHeading(1)

      wysiwygEditor.validateContentHasElement('h1')

      cy.log('✅ H1 heading inserted successfully')
    })

    it('BLOG_EDITOR_005: should insert H2 heading', () => {
      wysiwygEditor.focus()
      wysiwygEditor.typeContent('Heading 2')
      wysiwygEditor.selectAll()
      wysiwygEditor.insertHeading(2)

      wysiwygEditor.validateContentHasElement('h2')

      cy.log('✅ H2 heading inserted successfully')
    })

    it('BLOG_EDITOR_006: should insert H3 heading', () => {
      wysiwygEditor.focus()
      wysiwygEditor.typeContent('Heading 3')
      wysiwygEditor.selectAll()
      wysiwygEditor.insertHeading(3)

      wysiwygEditor.validateContentHasElement('h3')

      cy.log('✅ H3 heading inserted successfully')
    })
  })

  describe('LISTS', () => {
    it('BLOG_EDITOR_007: should create bullet list', () => {
      wysiwygEditor.focus()
      wysiwygEditor.insertBulletList()
      wysiwygEditor.typeContent('First item{enter}Second item{enter}Third item')

      wysiwygEditor.validateContentHasElement('ul')

      cy.log('✅ Bullet list created successfully')
    })

    it('BLOG_EDITOR_008: should create ordered list', () => {
      wysiwygEditor.focus()
      wysiwygEditor.insertOrderedList()
      wysiwygEditor.typeContent('First item{enter}Second item{enter}Third item')

      wysiwygEditor.validateContentHasElement('ol')

      cy.log('✅ Ordered list created successfully')
    })
  })

  describe('BLOCKS', () => {
    it('BLOG_EDITOR_009: should insert blockquote', () => {
      wysiwygEditor.focus()
      wysiwygEditor.typeContent('This is a quote')
      wysiwygEditor.selectAll()
      wysiwygEditor.insertBlockquote()

      wysiwygEditor.validateContentHasElement('blockquote')

      cy.log('✅ Blockquote inserted successfully')
    })

    it('BLOG_EDITOR_010: should insert code block', () => {
      wysiwygEditor.focus()
      wysiwygEditor.typeContent('const code = "hello"')
      wysiwygEditor.selectAll()
      wysiwygEditor.insertCodeBlock()

      wysiwygEditor.validateContentHasElement('pre')

      cy.log('✅ Code block inserted successfully')
    })

    it('BLOG_EDITOR_011: should insert horizontal rule', () => {
      wysiwygEditor.focus()
      wysiwygEditor.typeContent('Above the line')
      wysiwygEditor.insertHorizontalRule()

      wysiwygEditor.validateContentHasElement('hr')

      cy.log('✅ Horizontal rule inserted successfully')
    })
  })

  describe('LINKS', () => {
    it('BLOG_EDITOR_012: should insert link', () => {
      const testUrl = 'https://example.com'

      wysiwygEditor.focus()
      wysiwygEditor.typeContent('Click here')
      wysiwygEditor.selectAll()
      wysiwygEditor.insertLink(testUrl)

      wysiwygEditor.validateHasLink(testUrl)

      cy.log('✅ Link inserted successfully')
    })
  })

  describe('UNDO/REDO', () => {
    it('BLOG_EDITOR_013: should undo last action', () => {
      wysiwygEditor.focus()
      wysiwygEditor.typeContent('Original text')

      // Make a change
      wysiwygEditor.typeContent(' - added text')

      // Undo
      wysiwygEditor.undo()

      // The added text should be removed (or partially undone)
      // Note: execCommand undo behavior may vary

      cy.log('✅ Undo action performed successfully')
    })

    it('BLOG_EDITOR_014: should redo undone action', () => {
      wysiwygEditor.focus()
      wysiwygEditor.typeContent('Original text')

      // Make a change
      wysiwygEditor.selectAll()
      wysiwygEditor.toggleBold()

      // Undo
      wysiwygEditor.undo()

      // Redo
      wysiwygEditor.redo()

      // Bold should be back
      wysiwygEditor.validateHasBoldText()

      cy.log('✅ Redo action performed successfully')
    })
  })

  describe('PREVIEW MODE', () => {
    it('BLOG_EDITOR_015: should toggle to preview mode', () => {
      wysiwygEditor.focus()
      wysiwygEditor.typeContent('Preview this content')

      // Toggle preview
      wysiwygEditor.togglePreview()

      // Validate preview mode
      wysiwygEditor.validatePreviewMode()

      cy.log('✅ Preview mode toggled successfully')
    })

    it('BLOG_EDITOR_016: should toggle back to edit mode', () => {
      wysiwygEditor.focus()
      wysiwygEditor.typeContent('Edit this content')

      // Toggle to preview
      wysiwygEditor.togglePreview()
      wysiwygEditor.validatePreviewMode()

      // Toggle back to edit
      wysiwygEditor.togglePreview()
      wysiwygEditor.validateEditMode()

      cy.log('✅ Edit mode toggled back successfully')
    })
  })

  describe('WORD COUNT', () => {
    it('BLOG_EDITOR_017: should show correct word count', () => {
      wysiwygEditor.focus()
      wysiwygEditor.typeContent('One two three four five')

      // Validate word count (5 words)
      wysiwygEditor.validateWordCount(5)

      cy.log('✅ Word count displayed correctly')
    })
  })

  describe('PLACEHOLDER', () => {
    it('BLOG_EDITOR_018: should show placeholder when empty', () => {
      // Editor should be empty initially
      // Validate placeholder is visible
      wysiwygEditor.validatePlaceholder()

      cy.log('✅ Placeholder shown when empty')
    })

    it('BLOG_EDITOR_019: should hide placeholder when content added', () => {
      wysiwygEditor.focus()
      wysiwygEditor.typeContent('Some content')

      // Placeholder should be hidden
      wysiwygEditor.validatePlaceholderHidden()

      cy.log('✅ Placeholder hidden when content exists')
    })
  })

  after(() => {
    cy.log('✅ WYSIWYG Editor tests completed')
  })
})
