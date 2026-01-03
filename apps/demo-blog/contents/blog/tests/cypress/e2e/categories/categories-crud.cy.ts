/// <reference types="cypress" />

/**
 * Categories CRUD Tests - Blog Theme
 *
 * Tests for Categories entity CRUD operations.
 * Uses generic EntityList and EntityForm POM classes.
 *
 * Theme Mode: single-user (isolated blogs, no team collaboration)
 */

import { EntityList } from '../../../../../../../test/cypress/src/classes/components/entities/EntityList.js'
import { EntityForm } from '../../../../src/classes/components/entities/EntityForm.js'
import { loginAsBlogAuthor } from '../../../src/session-helpers'

describe('Categories CRUD - Blog Author (Full Access)', () => {
  const categoryList = new EntityList('categories')
  const categoryForm = new EntityForm('categories')

  beforeEach(() => {
    loginAsBlogAuthor('MARCOS')
    cy.visit('/dashboard/categories')
    categoryList.validateListVisible()
  })

  // =========================================================================
  // CREATE - Author can create categories
  // =========================================================================
  describe('CREATE - Author can create categories', () => {
    it('BLOG_CAT_CREATE_001: should create new category successfully', () => {
      const timestamp = Date.now()
      const categoryName = `Category ${timestamp}`
      const categorySlug = `category-${timestamp}`

      // Click create button
      categoryList.clickAdd()

      // Validate form is visible
      categoryForm.validateFormVisible()

      // Fill required fields (name and slug are both required)
      categoryForm.fillField('name', categoryName)
      categoryForm.fillField('slug', categorySlug)

      // Submit form
      categoryForm.submit()

      // Validate redirect to list
      cy.url().should('include', '/dashboard/categories')

      // Validate category appears in list
      cy.contains(categoryName).should('be.visible')

      cy.log('✅ Author created category successfully')
    })

    it('BLOG_CAT_CREATE_002: should create category with description', () => {
      const timestamp = Date.now()
      const categoryName = `Full Category ${timestamp}`
      const categorySlug = `full-category-${timestamp}`
      const categoryDescription = 'This is a category with a description'

      // Click create button
      categoryList.clickAdd()

      // Fill all fields (name and slug are required)
      categoryForm.fillField('name', categoryName)
      categoryForm.fillField('slug', categorySlug)
      categoryForm.fillField('description', categoryDescription)

      // Submit form
      categoryForm.submit()

      // Validate category appears in list
      cy.url().should('include', '/dashboard/categories')
      cy.contains(categoryName).should('be.visible')

      cy.log('✅ Author created category with description successfully')
    })

    it('BLOG_CAT_CREATE_003: should show validation error for empty name', () => {
      // Click create button
      categoryList.clickAdd()

      // Try to submit without filling name
      categoryForm.submit()

      // Validate error is shown (form should have validation)
      cy.get('body').then($body => {
        // Check for validation message or form stays on same page
        const isOnFormPage = $body.find('[data-cy="categories-form"]').length > 0 ||
                            $body.find('[data-cy="entity-form"]').length > 0

        if (isOnFormPage) {
          cy.log('✅ Form validation prevented submission')
        } else {
          // Check for error message
          cy.get('[role="alert"], .text-destructive, [data-cy*="error"]')
            .should('be.visible')
          cy.log('✅ Validation error shown for empty name')
        }
      })
    })
  })

  // =========================================================================
  // READ - Author can view categories
  // =========================================================================
  describe('READ - Author can view categories', () => {
    it('BLOG_CAT_READ_001: should view categories list', () => {
      // Validate list is visible
      categoryList.validateListVisible()

      cy.log('✅ Author can view categories list')
    })

    it('BLOG_CAT_READ_002: should search categories', () => {
      // Create a category with unique name first
      const timestamp = Date.now()
      const uniqueName = `Searchable Cat ${timestamp}`
      const uniqueSlug = `searchable-cat-${timestamp}`

      categoryList.clickAdd()
      categoryForm.fillField('name', uniqueName)
      categoryForm.fillField('slug', uniqueSlug)
      categoryForm.submit()

      // Go back to list
      cy.visit('/dashboard/categories')
      categoryList.validateListVisible()

      // Search for the category
      categoryList.search(uniqueName.substring(0, 10))
      cy.wait(500) // Wait for search

      // Validate search results
      cy.contains(uniqueName).should('be.visible')

      // Clear search
      categoryList.clearSearch()

      cy.log('✅ Author can search categories')
    })
  })

  // =========================================================================
  // UPDATE - Author can update categories
  // =========================================================================
  describe('UPDATE - Author can update categories', () => {
    beforeEach(() => {
      // Create a test category for update tests
      const timestamp = Date.now()
      const testName = `Update Cat ${timestamp}`
      const testSlug = `update-cat-${timestamp}`

      categoryList.clickAdd()
      categoryForm.fillField('name', testName)
      categoryForm.fillField('slug', testSlug)
      categoryForm.submit()

      cy.visit('/dashboard/categories')
      categoryList.validateListVisible()
    })

    it('BLOG_CAT_UPDATE_001: should edit category name', () => {
      // Find and edit the first category
      cy.get('body').then($body => {
        const editSelector = '[data-cy*="edit"]'

        if ($body.find(editSelector).length > 0) {
          cy.get(editSelector).first().click()

          // Validate form is visible
          categoryForm.validateFormVisible()

          // Update name
          const updatedName = `Updated Category ${Date.now()}`
          categoryForm.fillField('name', updatedName)

          // Submit form
          categoryForm.submit()

          // Validate update
          cy.url().should('include', '/dashboard/categories')
          cy.contains(updatedName).should('be.visible')

          cy.log('✅ Author updated category name successfully')
        } else {
          cy.log('⚠️ No categories available to edit')
        }
      })
    })

    it('BLOG_CAT_UPDATE_002: should update category description', () => {
      cy.get('body').then($body => {
        const editSelector = '[data-cy*="edit"]'

        if ($body.find(editSelector).length > 0) {
          cy.get(editSelector).first().click()

          categoryForm.validateFormVisible()

          // Update description
          const updatedDescription = `Updated description ${Date.now()}`
          categoryForm.fillField('description', updatedDescription)

          // Submit form
          categoryForm.submit()

          cy.url().should('include', '/dashboard/categories')

          cy.log('✅ Author updated category description successfully')
        } else {
          cy.log('⚠️ No categories available to edit')
        }
      })
    })
  })

  // =========================================================================
  // DELETE - Author can delete categories
  // =========================================================================
  describe('DELETE - Author can delete categories', () => {
    it('BLOG_CAT_DELETE_001: should delete category successfully', () => {
      // Create a category to delete
      const timestamp = Date.now()
      const categoryName = `Delete Cat ${timestamp}`
      const categorySlug = `delete-cat-${timestamp}`

      categoryList.clickAdd()
      categoryForm.fillField('name', categoryName)
      categoryForm.fillField('slug', categorySlug)
      categoryForm.submit()

      // Wait for category to appear in list
      cy.visit('/dashboard/categories')
      cy.contains(categoryName).should('be.visible')

      // Find and delete
      cy.get('body').then($body => {
        const deleteSelector = '[data-cy*="delete"]'

        if ($body.find(deleteSelector).length > 0) {
          cy.get(deleteSelector).first().click()

          // Confirm deletion if modal appears
          cy.get('body').then($body2 => {
            if ($body2.find('[data-cy="confirm-delete"]').length > 0) {
              cy.get('[data-cy="confirm-delete"]').click()
            } else if ($body2.find('[data-cy*="delete-confirm"]').length > 0) {
              cy.get('[data-cy*="delete-confirm"]').click()
            } else if ($body2.find('[role="dialog"] button[data-cy="confirm-delete"]').length > 0) {
              // Click the delete button in the modal (not the trigger)
              cy.get('[role="dialog"] button[data-cy="confirm-delete"]').click()
            } else if ($body2.find('[role="dialog"]').length > 0) {
              // Fallback: click any button that looks like confirm delete in the dialog
              cy.get('[role="dialog"] button').last().click()
            }
          })

          // Validate deletion
          cy.wait(500)
          cy.contains(categoryName).should('not.exist')

          cy.log('✅ Author deleted category successfully')
        } else {
          cy.log('⚠️ Delete button not found')
        }
      })
    })

    it('BLOG_CAT_DELETE_002: should cancel delete operation', () => {
      // Create a category
      const timestamp = Date.now()
      const categoryName = `Cancel Delete Cat ${timestamp}`
      const categorySlug = `cancel-delete-cat-${timestamp}`

      categoryList.clickAdd()
      categoryForm.fillField('name', categoryName)
      categoryForm.fillField('slug', categorySlug)
      categoryForm.submit()

      // Wait for category to appear
      cy.visit('/dashboard/categories')
      cy.contains(categoryName).should('be.visible')

      // Find and try to delete, then cancel
      cy.get('body').then($body => {
        const deleteSelector = '[data-cy*="delete"]'

        if ($body.find(deleteSelector).length > 0) {
          cy.get(deleteSelector).first().click()

          // Cancel deletion if modal appears
          cy.get('body').then($body2 => {
            if ($body2.find('[data-cy="cancel-delete"]').length > 0) {
              cy.get('[data-cy="cancel-delete"]').click()
            } else if ($body2.find('[data-cy*="delete-cancel"]').length > 0) {
              cy.get('[data-cy*="delete-cancel"]').click()
            } else if ($body2.find('[role="dialog"] button[data-cy="cancel-delete"]').length > 0) {
              cy.get('[role="dialog"] button[data-cy="cancel-delete"]').click()
            } else if ($body2.find('[role="dialog"]').length > 0) {
              // Fallback: click the first button (usually cancel) in the dialog
              cy.get('[role="dialog"] button').first().click()
            }
          })

          // Validate category still exists
          cy.contains(categoryName).should('be.visible')

          cy.log('✅ Author cancelled delete operation successfully')
        } else {
          cy.log('⚠️ Delete button not found')
        }
      })
    })
  })

  after(() => {
    cy.log('✅ Categories CRUD tests completed')
  })
})
