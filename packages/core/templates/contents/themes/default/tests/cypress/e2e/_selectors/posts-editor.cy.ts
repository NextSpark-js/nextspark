/**
 * POC Test: Posts Block Editor Selectors Validation
 *
 * This test validates that the new POM architecture with dynamic selectors
 * works correctly for the block-based page builder.
 *
 * Purpose:
 * - Validate selectors from BlockEditorBasePOM work correctly
 * - Ensure dynamic selector generation produces valid CSS selectors
 * - Test before migrating existing tests to new architecture
 *
 * Scope:
 * - Only login and navigate
 * - Assert elements exist in DOM (no full CRUD operations)
 */

import { PostEditorPOM } from '../../src/features/PostEditorPOM'
import { PostsPOM } from '../../src/entities/PostsPOM'
import { loginAsDefaultOwner } from '../../src/session-helpers'

describe('Posts Block Editor Selectors Validation', { tags: ['@ui-selectors'] }, () => {
  const postEditor = PostEditorPOM.create()
  const posts = PostsPOM.create()

  beforeEach(() => {
    loginAsDefaultOwner()
  })

  describe('Posts List Page Selectors (Entity POM)', () => {
    beforeEach(() => {
      posts.visitList()
      posts.waitForList()
    })

    it('should find posts table container', () => {
      cy.get(posts.selectors.tableContainer).should('exist')
    })

    it('should find posts add button', () => {
      cy.get(posts.selectors.addButton).should('exist')
    })

    it('should find posts search input', () => {
      cy.get(posts.selectors.search).should('exist')
    })

    it('should find posts pagination', () => {
      cy.get(posts.selectors.pagination).should('exist')
    })

    it('should find at least one post row', () => {
      cy.get(posts.selectors.rowGeneric).should('have.length.at.least', 1)
    })
  })

  describe('Block Editor Core Selectors', () => {
    beforeEach(() => {
      postEditor.visitCreate()
      postEditor.waitForEditor()
    })

    it('should find editor container', () => {
      cy.get(postEditor.editorSelectors.container).should('exist')
    })

    it('should find title input', () => {
      cy.get(postEditor.editorSelectors.titleInput).should('exist')
    })

    it('should find slug input', () => {
      cy.get(postEditor.editorSelectors.slugInput).should('exist')
    })

    it('should find save button', () => {
      cy.get(postEditor.editorSelectors.saveButton).should('exist')
    })

    it('should find status badge', () => {
      cy.get(postEditor.editorSelectors.statusBadge).should('exist')
    })

    it('should find left sidebar toggle', () => {
      cy.get(postEditor.editorSelectors.leftSidebarToggle).should('exist')
    })

    it('should find view mode toggle', () => {
      cy.get(postEditor.editorSelectors.viewModeToggle).should('exist')
    })
  })

  describe('Block Picker Selectors', () => {
    beforeEach(() => {
      postEditor.visitCreate()
      postEditor.waitForEditor()
    })

    it('should find block picker container', () => {
      cy.get(postEditor.editorSelectors.blockPicker).should('exist')
    })

    it('should find block search input', () => {
      cy.get(postEditor.editorSelectors.blockSearch).should('exist')
    })

    it('should find category "All" button', () => {
      cy.get(postEditor.editorSelectors.categoryAll).should('exist')
    })

    it('should find block items with dynamic selectors', () => {
      // Test a known block slug - post-content is the main content block for posts
      cy.get(postEditor.editorSelectors.blockItem('post-content')).should('exist')
      cy.get(postEditor.editorSelectors.addBlock('post-content')).should('exist')
    })

    it('should find category selectors', () => {
      // Categories should be visible
      cy.get(postEditor.editorSelectors.category('content')).should('exist')
    })
  })

  describe('Block Canvas Selectors', () => {
    beforeEach(() => {
      postEditor.visitCreate()
      postEditor.waitForEditor()
    })

    it('should find empty state when no blocks added', () => {
      cy.get(postEditor.editorSelectors.blockCanvasEmpty).should('exist')
    })

    it('should find block canvas container when block is added', () => {
      // Add a block - canvas container appears
      postEditor.addBlock('post-content')
      cy.get(postEditor.editorSelectors.blockCanvas).should('exist')
    })
  })

  describe('Settings Panel Selectors', () => {
    beforeEach(() => {
      postEditor.visitCreate()
      postEditor.waitForEditor()
    })

    it('should find settings panel empty state when no block selected', () => {
      // When no block is selected, empty state is shown
      cy.get(postEditor.editorSelectors.settingsPanelEmpty).should('exist')
    })

    it('should find settings panel container when block is selected', () => {
      // Add a block first - settings panel appears with block selected
      postEditor.addBlock('post-content')
      cy.get(postEditor.editorSelectors.settingsPanel).should('exist')
    })
  })

  // NOTE: Page Settings and SEO tests have been moved to pages-editor-selectors.cy.ts
  // These features are specific to the page builder (PageBuilderPOM)

  describe('Status Selector', () => {
    beforeEach(() => {
      postEditor.visitCreate()
      postEditor.waitForEditor()
    })

    it('should find status selector trigger', () => {
      cy.get(postEditor.editorSelectors.statusSelector).should('exist')
    })

    it('should find status options when clicked', () => {
      // Scroll into view and click - the selector may be hidden due to sidebar
      cy.get(postEditor.editorSelectors.statusSelector).scrollIntoView().click({ force: true })
      cy.get(postEditor.editorSelectors.statusOption('draft')).should('exist')
      cy.get(postEditor.editorSelectors.statusOption('published')).should('exist')
    })
  })

  describe('Block Manipulation Selectors (after adding block)', () => {
    beforeEach(() => {
      postEditor.visitCreate()
      postEditor.waitForEditor()
    })

    it('should find preview block controls after adding a block', () => {
      // Add a post-content block
      postEditor.addBlock('post-content')

      // Wait for block to appear using preview-block pattern (not sortable-block)
      // The editor uses preview-block-{id} for the canvas blocks
      cy.get('[data-cy^="preview-block-"]')
        .first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          // Extract ID - format is preview-block-{uuid}
          const match = dataCy?.match(/^preview-block-([a-f0-9-]+)$/)
          const blockId = match ? match[1] : ''
          expect(blockId).to.not.be.empty

          // Validate preview block selectors (actual selectors in DOM)
          cy.get(postEditor.editorSelectors.previewBlock(blockId)).should('exist')
          cy.get(postEditor.editorSelectors.previewMoveUp(blockId)).should('exist')
          cy.get(postEditor.editorSelectors.previewMoveDown(blockId)).should('exist')
        })
    })

    // NOTE: sortable-block, drag-handle, duplicate-block selectors don't exist in current implementation
    // The editor uses preview-block pattern instead. Skipping these tests.
    it.skip('should find sortable block controls (sortable-block selectors not implemented)', () => {
      postEditor.addBlock('post-content')
      cy.get('[data-cy^="sortable-block-"]').first().should('exist')
    })

    it('should find settings panel and tabs after adding a block', () => {
      // Add a post-content block - settings panel appears automatically
      postEditor.addBlock('post-content')

      // Settings panel should appear with tabs
      cy.get(postEditor.editorSelectors.settingsPanel).should('exist')
      cy.get(postEditor.editorSelectors.tabContent).should('exist')
      cy.get(postEditor.editorSelectors.tabDesign).should('exist')
      cy.get(postEditor.editorSelectors.tabAdvanced).should('exist')
    })

    it('should find block settings actions', () => {
      postEditor.addBlock('post-content')

      // Settings panel actions
      cy.get(postEditor.editorSelectors.resetProps).should('exist')
      cy.get(postEditor.editorSelectors.removeBlockSettings).should('exist')
    })
  })

  describe('Post-Specific Selectors', () => {
    beforeEach(() => {
      postEditor.visitCreate()
      postEditor.waitForEditor()
      // Switch to "Campos" tab to see entity fields
      cy.get('[data-cy="sidebar-fields"]').click()
    })

    it('should find excerpt input', () => {
      cy.get(postEditor.postSelectors.excerptInput).should('exist')
    })

    it('should find featured image input', () => {
      cy.get(postEditor.postSelectors.featuredImage).should('exist')
    })

    // NOTE: Categories and Locale selectors don't have data-cy attributes yet
    // These tests are skipped until the component adds proper selectors
    it.skip('should find categories select (missing data-cy)', () => {
      cy.get(postEditor.postSelectors.categoriesSelect).should('exist')
    })

    it.skip('should find locale select (missing data-cy)', () => {
      cy.get(postEditor.postSelectors.localeSelect).should('exist')
    })
  })

  describe('Edit Existing Post Selectors', () => {
    it('should find editor elements when editing an existing post', () => {
      // Get a post ID from the list
      posts.visitList()
      posts.waitForList()

      cy.get(posts.selectors.rowGeneric)
        .first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          const id = dataCy?.replace('posts-row-', '') || ''

          // Navigate to edit
          postEditor.visitEdit(id)
          postEditor.waitForEditor()

          // Validate editor is loaded with existing content
          cy.get(postEditor.editorSelectors.container).should('exist')
          cy.get(postEditor.editorSelectors.titleInput).should('exist')
          cy.get(postEditor.editorSelectors.saveButton).should('exist')
        })
    })
  })
})
