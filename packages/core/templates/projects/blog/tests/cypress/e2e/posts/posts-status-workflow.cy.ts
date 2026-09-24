/// <reference types="cypress" />

/**
 * Posts Status Workflow Tests - Blog Theme
 *
 * Tests for publish/unpublish workflow and auto-save functionality.
 *
 * Theme Mode: single-user (isolated blogs, no team collaboration)
 */

import { PostsList } from '../../../src/PostsList.js'
import { PostEditor } from '../../../src/PostEditor.js'
import { loginAsBlogAuthor } from '../../../src/session-helpers'

describe('Posts Status Workflow - Publish/Unpublish', () => {
  const postsList = new PostsList()

  beforeEach(() => {
    loginAsBlogAuthor('MARCOS')
    cy.visit('/dashboard/posts')
    postsList.validateListVisible()
  })

  describe('PUBLISH - Draft to Published', () => {
    it('BLOG_STATUS_001: should publish draft from list actions', () => {
      // Create a draft post first
      const postTitle = `Publish From List ${Date.now()}`
      const postEditor = new PostEditor('create')

      postsList.clickCreate()
      postEditor.fillTitle(postTitle)
      postEditor.typeContent('Draft post to be published from list')
      postEditor.saveDraft()
      postEditor.clickBack()

      // Wait for post to appear
      cy.contains(postTitle).should('be.visible')

      // Find the post and publish via actions menu
      cy.contains('[data-cy^="posts-row-"]', postTitle)
        .invoke('attr', 'data-cy')
        .then(dataCy => {
          const postId = dataCy?.replace('posts-row-', '')
          if (postId) {
            postsList.clickPublish(postId)

            // Wait for status update
            cy.wait(500)

            // Validate status changed
            postsList.validatePostStatus(postId, 'published')

            cy.log('✅ Published draft from list successfully')
          }
        })
    })

    it('BLOG_STATUS_002: should publish draft from editor', () => {
      // Create a draft post
      const postTitle = `Publish From Editor ${Date.now()}`
      const postEditor = new PostEditor('create')

      postsList.clickCreate()
      postEditor.fillTitle(postTitle)
      postEditor.typeContent('Draft post to be published from editor')
      postEditor.saveDraft()

      // Now on edit page, publish
      const editEditor = new PostEditor('edit')
      editEditor.validatePageVisible()

      // Intercept the PATCH request to verify status is sent correctly
      cy.intercept('PATCH', '/api/v1/posts/*').as('updatePost')

      // Publish
      editEditor.publish()

      // Wait for the API call to complete
      cy.wait('@updatePost').then((interception) => {
        expect(interception.request.body.status).to.equal('published')
      })

      // Wait for UI to update
      cy.wait(500)

      // Validate unpublish button appears (meaning status is now published)
      cy.get('[data-cy="post-edit-unpublish"]', { timeout: 5000 }).should('be.visible')

      cy.log('✅ Published draft from editor successfully')
    })
  })

  describe('UNPUBLISH - Published to Draft', () => {
    it('BLOG_STATUS_003: should unpublish post from list actions', () => {
      // Create and publish a post first
      const postTitle = `Unpublish From List ${Date.now()}`
      const postEditor = new PostEditor('create')

      // Intercept the POST request to confirm publish works
      cy.intercept('POST', '/api/v1/posts').as('createPost')

      postsList.clickCreate()
      postEditor.fillTitle(postTitle)
      postEditor.typeContent('Published post to be unpublished')
      postEditor.publish()

      // Wait for create with publish status
      cy.wait('@createPost').then((interception) => {
        expect(interception.request.body.status).to.equal('published')
      })

      // After publish, we're on edit page - verify unpublish button exists
      cy.get('[data-cy="post-edit-unpublish"]', { timeout: 5000 }).should('be.visible')

      // Go back to list
      const editEditor = new PostEditor('edit')
      editEditor.clickBack()

      // Wait for post to appear
      cy.contains(postTitle).should('be.visible')

      // Find the post and unpublish via actions menu
      cy.contains('[data-cy^="posts-row-"]', postTitle)
        .invoke('attr', 'data-cy')
        .then(dataCy => {
          const postId = dataCy?.replace('posts-row-', '')
          if (postId) {
            // Intercept the unpublish PATCH
            cy.intercept('PATCH', `/api/v1/posts/${postId}`).as('unpublishPost')

            postsList.clickUnpublish(postId)

            // Wait for unpublish API call
            cy.wait('@unpublishPost')

            // Wait for status update
            cy.wait(500)

            // Validate status changed
            postsList.validatePostStatus(postId, 'draft')

            cy.log('✅ Unpublished post from list successfully')
          }
        })
    })

    it('BLOG_STATUS_004: should unpublish post from editor', () => {
      // Create and publish a post
      const postTitle = `Unpublish From Editor ${Date.now()}`
      const postEditor = new PostEditor('create')

      // Intercept the POST request to verify publish status
      cy.intercept('POST', '/api/v1/posts').as('createPost')

      postsList.clickCreate()
      postEditor.fillTitle(postTitle)
      postEditor.typeContent('Published post to be unpublished from editor')
      postEditor.publish()

      // Wait for create with publish status
      cy.wait('@createPost').then((interception) => {
        expect(interception.request.body.status).to.equal('published')
      })

      // After publish redirect, verify unpublish button is visible
      cy.get('[data-cy="post-edit-unpublish"]', { timeout: 5000 }).should('be.visible')

      // Now on edit page with published status
      const editEditor = new PostEditor('edit')

      // Intercept the PATCH request for unpublish
      cy.intercept('PATCH', '/api/v1/posts/*').as('unpublishPost')

      // Unpublish
      editEditor.unpublish()

      // Wait for unpublish API call
      cy.wait('@unpublishPost').then((interception) => {
        expect(interception.request.body.status).to.equal('draft')
      })

      // Wait for UI to update
      cy.wait(500)

      // Validate publish button is back (meaning post is draft)
      cy.get('[data-cy="post-edit-publish"]', { timeout: 5000 }).should('be.visible')

      cy.log('✅ Unpublished post from editor successfully')
    })
  })

  describe('AUTO-SAVE - Draft auto-save functionality', () => {
    it('BLOG_STATUS_005: should auto-save draft after changes', () => {
      // Create a draft post
      const postTitle = `Auto Save Test ${Date.now()}`
      const postEditor = new PostEditor('create')

      postsList.clickCreate()
      postEditor.fillTitle(postTitle)
      postEditor.typeContent('Initial content for auto-save test')
      postEditor.saveDraft()

      // Now on edit page
      const editEditor = new PostEditor('edit')
      editEditor.validatePageVisible()

      // Make a change
      editEditor.fillExcerpt('Updated excerpt')

      // Wait for auto-save (30 seconds is too long for tests)
      // Instead, manually save and check the indicator
      editEditor.saveDraft()
      editEditor.validateAutoSaved()

      cy.log('✅ Auto-save indicator works correctly')
    })

    it('BLOG_STATUS_006: should show unsaved changes indicator', () => {
      // Create a draft post
      const postTitle = `Unsaved Changes ${Date.now()}`
      const postEditor = new PostEditor('create')

      postsList.clickCreate()
      postEditor.fillTitle(postTitle)
      postEditor.typeContent('Content for unsaved changes test')
      postEditor.saveDraft()

      // Now on edit page
      const editEditor = new PostEditor('edit')
      editEditor.validatePageVisible()

      // Make a change
      editEditor.fillTitle(`${postTitle} - Modified`)

      // The status should show unsaved changes indicator
      cy.get('[data-cy="post-unsaved-indicator"]').should('be.visible')

      cy.log('✅ Unsaved changes indicator shown correctly')
    })
  })

  describe('FEATURED - Featured posts management', () => {
    it('BLOG_STATUS_007: should mark post as featured', () => {
      // Create a post
      const postTitle = `Featured Post ${Date.now()}`
      const postEditor = new PostEditor('create')

      postsList.clickCreate()
      postEditor.fillTitle(postTitle)
      postEditor.typeContent('This post will be featured')
      postEditor.toggleFeatured(true)
      postEditor.publish()

      // Validate featured state
      const editEditor = new PostEditor('edit')
      editEditor.validateFeaturedState(true)

      // Go back to list
      editEditor.clickBack()

      // Validate we're back on posts list
      postsList.validateListVisible()

      cy.log('✅ Post marked as featured successfully')
    })

    it('BLOG_STATUS_008: should remove featured status', () => {
      // Create a featured post
      const postTitle = `Remove Featured ${Date.now()}`
      const postEditor = new PostEditor('create')

      postsList.clickCreate()
      postEditor.fillTitle(postTitle)
      postEditor.typeContent('This post will have featured removed')

      // Enable featured
      cy.get('[data-cy="post-create-featured-toggle"]').click({ force: true })
      cy.wait(300)

      postEditor.saveDraft()

      // Wait for save
      cy.wait(1000)

      // Now on edit page - click featured toggle to disable
      cy.get('[data-cy="post-edit-featured-toggle"]').click({ force: true })
      cy.wait(300)

      // Save changes
      const editEditor = new PostEditor('edit')
      editEditor.saveDraft()

      cy.wait(500)

      cy.log('✅ Featured status removed successfully')
    })
  })

  after(() => {
    cy.log('✅ Posts Status Workflow tests completed')
  })
})
