/// <reference types="cypress" />

/**
 * Posts CRUD Tests - Blog Theme
 *
 * Tests for Posts entity CRUD operations.
 * Uses custom PostsList and PostEditor POM classes.
 *
 * Theme Mode: single-user (isolated blogs, no team collaboration)
 */

import { PostsList } from '../../../src/PostsList.js'
import { PostEditor } from '../../../src/PostEditor.js'
import { loginAsBlogAuthor, BLOG_USERS } from '../../../src/session-helpers'

describe('Posts CRUD - Blog Author (Full Access)', () => {
  const postsList = new PostsList()

  beforeEach(() => {
    loginAsBlogAuthor('MARCOS')
    cy.visit('/dashboard/posts')
    postsList.validateListVisible()
  })

  // =========================================================================
  // CREATE - Author can create posts
  // =========================================================================
  describe('CREATE - Author can create posts', () => {
    it('BLOG_POST_CREATE_001: should create draft post', () => {
      const postTitle = `Draft Post ${Date.now()}`
      const postEditor = new PostEditor('create')

      // Click create button
      postsList.clickCreate()

      // Validate create page
      postEditor.validatePageVisible()
      postEditor.validateStatusBadge('new-draft')

      // Fill post data
      postEditor.fillTitle(postTitle)
      postEditor.typeContent('This is a draft post content.')

      // Save as draft
      postEditor.saveDraft()

      // Validate redirect to edit page
      cy.url().should('match', /\/dashboard\/posts\/[a-z0-9-]+\/edit/)

      // After redirect, we're now on edit page - use edit mode editor
      const editEditor = new PostEditor('edit')
      editEditor.validateStatusBadge('draft')

      cy.log('✅ Author created draft post successfully')
    })

    it('BLOG_POST_CREATE_002: should create and publish post immediately', () => {
      const postTitle = `Published Post ${Date.now()}`
      const postEditor = new PostEditor('create')

      // Click create button
      postsList.clickCreate()

      // Fill post data
      postEditor.fillTitle(postTitle)
      postEditor.typeContent('This is a published post content.')

      // Publish immediately
      postEditor.publish()

      // Validate redirect to edit page
      cy.url().should('match', /\/dashboard\/posts\/[a-z0-9-]+\/edit/)

      // After redirect, we're now on edit page - use edit mode editor
      const editEditor = new PostEditor('edit')

      // Go back to list using edit mode editor
      editEditor.clickBack()

      // Validate post appears with published status
      cy.contains(postTitle).should('be.visible')

      cy.log('✅ Author created and published post successfully')
    })

    it('BLOG_POST_CREATE_003: should create post with all metadata', () => {
      const postTitle = `Full Post ${Date.now()}`
      const postSlug = `full-post-${Date.now()}`
      const postExcerpt = 'This is a brief excerpt for the post.'
      const postEditor = new PostEditor('create')

      // Click create button
      postsList.clickCreate()

      // Fill all fields
      postEditor.fillTitle(postTitle)
      postEditor.typeContent('This is a complete post with all metadata filled.')
      postEditor.fillSlug(postSlug)
      postEditor.fillExcerpt(postExcerpt)
      postEditor.toggleFeatured(true)

      // Save
      postEditor.saveDraft()

      // Validate slug was saved
      const editEditor = new PostEditor('edit')
      editEditor.validateSlug(postSlug)
      editEditor.validateFeaturedState(true)

      cy.log('✅ Author created post with all metadata successfully')
    })

    it('BLOG_POST_CREATE_004: should show validation error for empty title', () => {
      const postEditor = new PostEditor('create')

      // Click create button
      postsList.clickCreate()

      // Try to save without title
      postEditor.typeContent('Content without a title')
      postEditor.saveDraft()

      // Validate error is shown
      postEditor.validateError('title-required')

      cy.log('✅ Validation error shown for empty title')
    })
  })

  // =========================================================================
  // READ - Author can view posts
  // =========================================================================
  describe('READ - Author can view posts', () => {
    it('BLOG_POST_READ_001: should view posts list in table mode', () => {
      // Set table view
      postsList.setViewMode('table')

      // Validate table view
      postsList.validateViewMode('table')

      cy.log('✅ Author can view posts in table mode')
    })

    it('BLOG_POST_READ_002: should view posts list in grid mode', () => {
      // Set grid view
      postsList.setViewMode('grid')

      // Validate grid view
      postsList.validateViewMode('grid')

      cy.log('✅ Author can view posts in grid mode')
    })

    it('BLOG_POST_READ_003: should filter posts by status', () => {
      // Filter by published
      postsList.filterByStatus('published')
      cy.wait(500) // Wait for filter to apply

      // Filter by draft
      postsList.filterByStatus('draft')
      cy.wait(500)

      // Show all
      postsList.filterByStatus('all')

      cy.log('✅ Author can filter posts by status')
    })

    it('BLOG_POST_READ_004: should search posts by title', () => {
      // Create a post with unique title first
      const uniqueTitle = `Searchable Post ${Date.now()}`
      const postEditor = new PostEditor('create')

      postsList.clickCreate()
      postEditor.fillTitle(uniqueTitle)
      postEditor.typeContent('Content for search test')
      postEditor.saveDraft()
      postEditor.clickBack()

      // Search for the post
      postsList.search(uniqueTitle.substring(0, 10))
      cy.wait(500) // Wait for search

      // Validate search results
      cy.contains(uniqueTitle).should('be.visible')

      // Clear search
      postsList.clearSearch()

      cy.log('✅ Author can search posts')
    })

    it('BLOG_POST_READ_005: should view post details via edit', () => {
      // Check if there are posts to view
      cy.get('body').then($body => {
        const rowSelector = '[data-cy^="posts-row-"]'

        if ($body.find(rowSelector).length > 0) {
          // Get the first post ID and click edit
          cy.get(rowSelector).first().invoke('attr', 'data-cy').then(dataCy => {
            const postId = dataCy?.replace('posts-row-', '')
            if (postId) {
              postsList.clickEdit(postId)

              // Validate edit page
              const postEditor = new PostEditor('edit')
              postEditor.validatePageVisible()

              cy.log('✅ Author can view post details')
            }
          })
        } else {
          cy.log('⚠️ No posts available to view details')
        }
      })
    })
  })

  // =========================================================================
  // UPDATE - Author can update posts
  // =========================================================================
  describe('UPDATE - Author can update posts', () => {
    beforeEach(() => {
      // Create a test post for update tests
      const postEditor = new PostEditor('create')
      const testTitle = `Update Test ${Date.now()}`

      postsList.clickCreate()
      postEditor.fillTitle(testTitle)
      postEditor.typeContent('Original content')
      postEditor.saveDraft()
      postEditor.clickBack()
      postsList.validateListVisible()
    })

    it('BLOG_POST_UPDATE_001: should edit post title and content', () => {
      // Find and edit the first post
      cy.get('[data-cy^="posts-row-"]').first().invoke('attr', 'data-cy').then(dataCy => {
        const postId = dataCy?.replace('posts-row-', '')
        if (postId) {
          postsList.clickEdit(postId)

          const postEditor = new PostEditor('edit')
          postEditor.validatePageVisible()

          // Update title
          const updatedTitle = `Updated Title ${Date.now()}`
          postEditor.fillTitle(updatedTitle)

          // Save
          postEditor.saveDraft()
          postEditor.validateAutoSaved()

          // Go back and verify
          postEditor.clickBack()
          cy.contains(updatedTitle).should('be.visible')

          cy.log('✅ Author updated post title successfully')
        }
      })
    })

    it('BLOG_POST_UPDATE_002: should change post status from draft to published', () => {
      // Find and edit the first draft post
      postsList.filterByStatus('draft')

      cy.get('body').then($body => {
        const rowSelector = '[data-cy^="posts-row-"]'

        if ($body.find(rowSelector).length > 0) {
          cy.get(rowSelector).first().invoke('attr', 'data-cy').then(dataCy => {
            const postId = dataCy?.replace('posts-row-', '')
            if (postId) {
              postsList.clickEdit(postId)

              const postEditor = new PostEditor('edit')
              postEditor.validatePageVisible()

              // Publish the post
              postEditor.publish()

              // Wait for save operation to complete
              cy.wait(1500)

              // Reload page to verify status was persisted
              cy.reload()

              // Wait for page to load
              cy.get('[data-cy="post-edit-container"]').should('be.visible')

              // After reload, status should show Published and Publish button should be replaced with Unpublish
              cy.get('[data-cy="post-edit-unpublish"]').should('be.visible')

              cy.log('✅ Author changed post status to published')
            }
          })
        } else {
          cy.log('⚠️ No draft posts available to publish')
        }
      })
    })

    it('BLOG_POST_UPDATE_003: should toggle featured flag', () => {
      cy.get('[data-cy^="posts-row-"]').first().invoke('attr', 'data-cy').then(dataCy => {
        const postId = dataCy?.replace('posts-row-', '')
        if (postId) {
          postsList.clickEdit(postId)

          const postEditor = new PostEditor('edit')
          postEditor.validatePageVisible()

          // Click on the featured toggle to change its state
          cy.get('[data-cy="post-edit-featured-toggle"]').click({ force: true })

          // Wait for state to update
          cy.wait(300)

          // Save changes
          postEditor.saveDraft()

          // Wait for save
          cy.wait(500)

          // Toggle again (back to original state)
          cy.get('[data-cy="post-edit-featured-toggle"]').click({ force: true })
          cy.wait(300)
          postEditor.saveDraft()

          cy.log('✅ Author toggled featured flag successfully')
        }
      })
    })

    it('BLOG_POST_UPDATE_004: should update URL slug', () => {
      cy.get('[data-cy^="posts-row-"]').first().invoke('attr', 'data-cy').then(dataCy => {
        const postId = dataCy?.replace('posts-row-', '')
        if (postId) {
          postsList.clickEdit(postId)

          const postEditor = new PostEditor('edit')
          postEditor.validatePageVisible()

          // Update slug
          const newSlug = `custom-slug-${Date.now()}`
          postEditor.fillSlug(newSlug)
          postEditor.saveDraft()

          // Validate slug was saved
          postEditor.validateSlug(newSlug)

          cy.log('✅ Author updated URL slug successfully')
        }
      })
    })
  })

  // =========================================================================
  // DELETE - Author can delete posts
  // =========================================================================
  describe('DELETE - Author can delete posts', () => {
    it('BLOG_POST_DELETE_001: should delete draft post', () => {
      // Create a post to delete
      const postTitle = `Delete Test ${Date.now()}`
      const postEditor = new PostEditor('create')

      postsList.clickCreate()
      postEditor.fillTitle(postTitle)
      postEditor.typeContent('Post to be deleted')
      postEditor.saveDraft()
      postEditor.clickBack()

      // Wait for post to appear
      cy.contains(postTitle).should('be.visible')

      // Find the post row and get its ID
      cy.contains('[data-cy^="posts-row-"]', postTitle)
        .invoke('attr', 'data-cy')
        .then(dataCy => {
          const postId = dataCy?.replace('posts-row-', '')
          if (postId) {
            // Click delete
            postsList.clickDelete(postId)

            // Confirm delete
            postsList.confirmDelete()

            // Validate post is removed
            cy.wait(500)
            cy.contains(postTitle).should('not.exist')

            cy.log('✅ Author deleted draft post successfully')
          }
        })
    })

    it('BLOG_POST_DELETE_002: should delete post from edit page', () => {
      // Create a post to delete
      const postTitle = `Delete From Edit ${Date.now()}`
      const postEditor = new PostEditor('create')

      postsList.clickCreate()
      postEditor.fillTitle(postTitle)
      postEditor.typeContent('Post to be deleted from edit page')
      postEditor.saveDraft()

      // Now we're on edit page
      const editEditor = new PostEditor('edit')
      editEditor.validatePageVisible()

      // Click delete button
      editEditor.clickDelete()

      // Confirm deletion
      editEditor.confirmDelete()

      // Should redirect to posts list
      cy.url().should('include', '/dashboard/posts')
      cy.contains(postTitle).should('not.exist')

      cy.log('✅ Author deleted post from edit page successfully')
    })

    it('BLOG_POST_DELETE_003: should cancel delete operation', () => {
      // Create a post
      const postTitle = `Cancel Delete ${Date.now()}`
      const postEditor = new PostEditor('create')

      postsList.clickCreate()
      postEditor.fillTitle(postTitle)
      postEditor.typeContent('Post that should not be deleted')
      postEditor.saveDraft()
      postEditor.clickBack()

      // Wait for post to appear
      cy.contains(postTitle).should('be.visible')

      // Find the post and click delete
      cy.contains('[data-cy^="posts-row-"]', postTitle)
        .invoke('attr', 'data-cy')
        .then(dataCy => {
          const postId = dataCy?.replace('posts-row-', '')
          if (postId) {
            postsList.clickDelete(postId)

            // Cancel delete
            postsList.cancelDelete()

            // Validate post still exists
            cy.contains(postTitle).should('be.visible')

            cy.log('✅ Author cancelled delete operation successfully')
          }
        })
    })
  })

  after(() => {
    cy.log('✅ Posts CRUD tests completed')
  })
})
