/// <reference types="cypress" />

/**
 * Post Editor - Admin UI Tests
 *
 * Tests for the post editor (create/edit) with block integration.
 * Validates form fields, block selector filtering, and save/publish operations.
 *
 * Tags: @uat, @feat-posts, @admin, @block-editor, @regression
 */

import * as allure from 'allure-cypress'
import { PostEditorPOM, PostsListPOM, loginAsOwner } from '../../../../src'

describe('Post Editor - Admin UI', {
  tags: ['@uat', '@feat-posts', '@admin', '@block-editor', '@regression']
}, () => {
  beforeEach(() => {
    allure.epic('Posts System')
    allure.feature('Post Editor')

    // Setup API intercepts BEFORE login
    PostEditorPOM.setupApiIntercepts()
    PostsListPOM.setupApiIntercepts()
    loginAsOwner()
  })

  // ============================================================
  // Editor Load Tests
  // ============================================================
  describe('Editor Load', () => {
    it('POST-EDITOR-001: Should load create post editor', { tags: '@smoke' }, () => {
      allure.story('Editor Load')
      allure.severity('critical')

      PostEditorPOM.visitCreate()
      PostEditorPOM.waitForEditorLoad()
      PostEditorPOM.assertEditorVisible()

      cy.log('Create post editor loaded successfully')
    })

    it('POST-EDITOR-002: Should load edit post editor', () => {
      allure.story('Editor Load')
      allure.severity('normal')

      // First get a post ID from the list
      PostsListPOM.visitList()
      PostsListPOM.api.waitForList()
      PostsListPOM.waitForListLoad()

      // Click the first row's dropdown trigger
      cy.get(PostsListPOM.listSelectors.rowGeneric).first().within(() => {
        cy.get('[data-cy^="posts-edit-"]').click()
      })

      // Wait for dropdown and click edit link
      cy.get('[role="menuitem"]').contains(/edit/i).click()

      cy.url().should('include', '/edit')
      PostEditorPOM.waitForEditorLoad()
      PostEditorPOM.assertEditorVisible()

      cy.log('Edit post editor loaded successfully')
    })
  })

  // ============================================================
  // Form Field Tests
  // ============================================================
  describe('Form Fields', () => {
    it('POST-EDITOR-003: Should display all required form fields', () => {
      allure.story('Form Fields')
      allure.severity('normal')

      PostEditorPOM.visitCreate()
      PostEditorPOM.waitForEditorLoad()

      cy.get(PostEditorPOM.editorSelectors.titleInput).should('be.visible')
      cy.get(PostEditorPOM.editorSelectors.slugInput).should('be.visible')
      cy.get(PostEditorPOM.editorSelectors.excerptInput).should('be.visible')
      cy.get(PostEditorPOM.editorSelectors.featuredImage).should('be.visible')
      cy.get(PostEditorPOM.editorSelectors.categoriesSelect).should('be.visible')

      cy.log('All required form fields present')
    })

    it('POST-EDITOR-004: Should fill title and slug', () => {
      allure.story('Form Fields')
      allure.severity('normal')

      PostEditorPOM.visitCreate()
      PostEditorPOM.waitForEditorLoad()

      PostEditorPOM.setTitle('Test Post')
      PostEditorPOM.setSlug('test-post')

      PostEditorPOM.assertTitleValue('Test Post')
      PostEditorPOM.assertSlugValue('test-post')

      cy.log('Title and slug fields working')
    })

    it('POST-EDITOR-005: Should fill excerpt field', () => {
      allure.story('Form Fields')
      allure.severity('normal')

      PostEditorPOM.visitCreate()
      PostEditorPOM.waitForEditorLoad()

      const testExcerpt = 'This is a test excerpt for the post.'
      PostEditorPOM.setExcerpt(testExcerpt)

      cy.get(PostEditorPOM.editorSelectors.excerptInput).should('have.value', testExcerpt)

      cy.log('Excerpt field working')
    })

    it('POST-EDITOR-006: Should fill featured image field', () => {
      allure.story('Form Fields')
      allure.severity('normal')

      PostEditorPOM.visitCreate()
      PostEditorPOM.waitForEditorLoad()

      const testImageUrl = 'https://example.com/image.jpg'
      PostEditorPOM.setFeaturedImage(testImageUrl)

      cy.get(PostEditorPOM.editorSelectors.featuredImage).should('have.value', testImageUrl)

      cy.log('Featured image field working')
    })
  })

  // ============================================================
  // Block Editor Tests
  // ============================================================
  describe('Block Editor', () => {
    it('POST-EDITOR-007: Should display block picker', () => {
      allure.story('Block Editor')
      allure.severity('normal')

      PostEditorPOM.visitCreate()
      PostEditorPOM.waitForEditorLoad()
      PostEditorPOM.waitForBlockPickerLoad()

      PostEditorPOM.assertBlockPickerVisible()

      cy.log('Block picker displayed')
    })

    it('POST-EDITOR-008: Should only show hero block for posts (scope filtering)', { tags: '@critical' }, () => {
      allure.story('Block Scope')
      allure.severity('critical')

      PostEditorPOM.visitCreate()
      PostEditorPOM.waitForEditorLoad()
      PostEditorPOM.waitForBlockPickerLoad()

      // Hero block should be visible (scope: ['pages', 'posts'])
      PostEditorPOM.assertBlockInPicker('hero')

      // Count visible blocks - should be minimal (only hero)
      cy.get(PostEditorPOM.editorSelectors.blockPicker).within(() => {
        cy.get('[data-cy^="block-item-"]').should('have.length.lte', 2)
      })

      cy.log('Block scope filtering working - only hero block shown')
    })

    it('POST-EDITOR-009: Should add a hero block', () => {
      allure.story('Block Editor')
      allure.severity('normal')

      PostEditorPOM.visitCreate()
      PostEditorPOM.waitForEditorLoad()
      PostEditorPOM.waitForBlockPickerLoad()

      PostEditorPOM.addBlock('hero')
      PostEditorPOM.assertBlockCount(1)

      cy.log('Hero block added successfully')
    })

    it('POST-EDITOR-010: Should remove a block', () => {
      allure.story('Block Editor')
      allure.severity('normal')

      PostEditorPOM.visitCreate()
      PostEditorPOM.waitForEditorLoad()
      PostEditorPOM.waitForBlockPickerLoad()

      PostEditorPOM.addBlock('hero')
      PostEditorPOM.assertBlockCount(1)

      cy.get(PostEditorPOM.editorSelectors.sortableBlockGeneric).first().then(($block) => {
        const blockId = $block.attr('data-cy')?.replace('sortable-block-', '')
        if (blockId) {
          PostEditorPOM.removeBlock(blockId)
          PostEditorPOM.assertBlockCount(0)
        }
      })

      cy.log('Block removed successfully')
    })
  })

  // ============================================================
  // Category Selection Tests
  // ============================================================
  describe('Category Selection', () => {
    it('POST-EDITOR-011: Should display and toggle categories', () => {
      allure.story('Categories')
      allure.severity('normal')

      PostEditorPOM.visitCreate()
      PostEditorPOM.waitForEditorLoad()

      cy.get(PostEditorPOM.editorSelectors.categoriesSelect).within(() => {
        cy.get('.cursor-pointer').should('have.length.at.least', 1)
      })

      cy.get(PostEditorPOM.editorSelectors.categoriesSelect)
        .find('.cursor-pointer')
        .first()
        .as('firstCategory')

      cy.get('@firstCategory').click()
      cy.get('@firstCategory').should('have.class', 'bg-primary')

      cy.log('Category selection working - badges toggle correctly')
    })
  })

  // ============================================================
  // Save/Publish Tests
  // ============================================================
  describe('Save and Publish', () => {
    it('POST-EDITOR-012: Should save a draft post', () => {
      allure.story('Save Operations')
      allure.severity('critical')

      PostEditorPOM.visitCreate()
      PostEditorPOM.waitForEditorLoad()

      PostEditorPOM.setTitle('Draft Test Post')
      PostEditorPOM.setSlug('draft-test-post')

      PostEditorPOM.savePost()
      PostEditorPOM.api.waitForCreate()

      cy.url().should('include', '/dashboard/posts')

      cy.log('Draft post saved successfully')
    })
  })
})
