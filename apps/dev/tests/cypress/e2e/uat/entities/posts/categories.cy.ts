/// <reference types="cypress" />

/**
 * Post Categories - Admin UI Tests
 *
 * Tests for the post categories management page.
 * Validates CRUD operations for categories with icon, color, and hierarchy support.
 *
 * Tags: @uat, @feat-posts, @admin, @categories, @regression
 */

import * as allure from 'allure-cypress'
import { CategoriesPOM, loginAsOwner } from '../../../../src'

describe('Post Categories - Admin UI', {
  tags: ['@uat', '@feat-posts', '@admin', '@categories', '@regression']
}, () => {
  beforeEach(() => {
    allure.epic('Posts System')
    allure.feature('Categories Management')

    // Setup API intercepts BEFORE login and navigation
    CategoriesPOM.setupApiIntercepts()
    loginAsOwner()
    CategoriesPOM.visitCategoriesPage()
    CategoriesPOM.api.waitForList()
    CategoriesPOM.waitForPageLoad()
  })

  // ============================================================
  // Navigation Tests
  // ============================================================
  describe('Navigation', () => {
    it('CAT-001: Should navigate to categories page', { tags: '@smoke' }, () => {
      allure.story('Navigation')
      allure.severity('critical')

      CategoriesPOM.assertPageVisible()
      cy.log('Successfully navigated to categories page')
    })

    it('CAT-002: Should display categories in list', () => {
      allure.story('List Display')
      allure.severity('normal')

      // Verify categories table has content (at least one category)
      cy.get(CategoriesPOM.listSelectors.rowGeneric).should('have.length.at.least', 1)

      cy.log('Categories visible in list')
    })
  })

  // ============================================================
  // Create Category Tests
  // ============================================================
  describe('Create Category', () => {
    it('CAT-003: Should open create category dialog', () => {
      allure.story('Create')
      allure.severity('normal')

      CategoriesPOM.clickCreate()
      CategoriesPOM.waitForDialogOpen()
      CategoriesPOM.assertDialogOpen()

      cy.log('Create category dialog opened')
    })

    it('CAT-004: Should create a new category', { tags: '@smoke' }, () => {
      allure.story('Create')
      allure.severity('critical')

      // Generate unique name using random string to avoid slug conflicts
      const uniqueId = Math.random().toString(36).substring(2, 8)
      const testCategoryName = `CyTest${uniqueId}`
      const testCategorySlug = testCategoryName.toLowerCase()

      CategoriesPOM.clickCreate()
      CategoriesPOM.waitForDialogOpen()

      // Fill name and slug
      CategoriesPOM.fillName(testCategoryName)
      CategoriesPOM.fillSlug(testCategorySlug)

      // Save and wait for API response
      CategoriesPOM.saveCategory()
      CategoriesPOM.api.waitForCreate()
      CategoriesPOM.api.waitForRefresh()
      CategoriesPOM.waitForDialogClose()

      // Verify new category exists in the table
      CategoriesPOM.assertCategoryInList(testCategoryName)

      cy.log('Category created successfully')
    })

    it('CAT-005: Should validate slug field accessibility', () => {
      allure.story('Create')
      allure.severity('minor')

      CategoriesPOM.clickCreate()
      CategoriesPOM.waitForDialogOpen()

      // Fill only name
      CategoriesPOM.fillName('Auto Slug Test')

      // Check if slug input is accessible
      cy.get(CategoriesPOM.formSelectors.slugInput).should('be.visible')

      // Close dialog
      CategoriesPOM.cancelForm()
      CategoriesPOM.waitForDialogClose()

      cy.log('Slug field accessible')
    })
  })

  // ============================================================
  // Edit Category Tests
  // ============================================================
  describe('Edit Category', () => {
    it('CAT-006: Should edit an existing category', () => {
      allure.story('Edit')
      allure.severity('normal')

      // Click the first row's edit button directly
      cy.get(CategoriesPOM.listSelectors.rowGeneric).first().within(() => {
        cy.get('button').first().click()
      })

      // Wait for dialog
      CategoriesPOM.waitForDialogOpen()

      // Update name with unique value
      const updatedName = `Updated Cat ${Date.now()}`
      CategoriesPOM.fillName(updatedName)

      // Save and wait for API
      CategoriesPOM.saveCategory()
      CategoriesPOM.api.waitForUpdate()
      CategoriesPOM.api.waitForRefresh()
      CategoriesPOM.waitForDialogClose()

      // Verify updated name in list
      cy.contains(updatedName).should('be.visible')

      cy.log('Category edited successfully')
    })
  })

  // ============================================================
  // Delete Category Tests
  // ============================================================
  describe('Delete Category', () => {
    it('CAT-007: Should delete a category', () => {
      allure.story('Delete')
      allure.severity('normal')

      // Create a test category to delete using API-aware method
      const testCategory = {
        name: `Cat To Delete ${Date.now()}`,
        slug: `cat-to-delete-${Date.now()}`
      }

      CategoriesPOM.createCategoryWithApiWait(testCategory)
      CategoriesPOM.assertCategoryInList(testCategory.name)

      // Now delete it
      cy.get(CategoriesPOM.listSelectors.rowGeneric).contains(testCategory.name).closest('tr').within(() => {
        cy.get('button').eq(1).click() // Delete button
      })

      CategoriesPOM.confirmDelete()
      CategoriesPOM.api.waitForDelete()
      CategoriesPOM.api.waitForRefresh()

      // Verify category is removed
      CategoriesPOM.assertCategoryNotInList(testCategory.name)

      cy.log('Category deleted successfully')
    })

    it('CAT-008: Should cancel category deletion', () => {
      allure.story('Delete')
      allure.severity('normal')

      // Click delete button on first row (second button in the row)
      cy.get(CategoriesPOM.listSelectors.rowGeneric).first().within(() => {
        cy.get('button').eq(1).click()
      })

      // Wait for AlertDialog (uses role="alertdialog")
      cy.get('[role="alertdialog"]', { timeout: 5000 }).should('be.visible')

      // Cancel deletion by clicking cancel button
      cy.get('[role="alertdialog"]').find('button').contains(/cancel/i).click()

      // Wait for dialog to close
      cy.get('[role="alertdialog"]').should('not.exist')

      // Verify categories still exist (at least one row remains)
      cy.get(CategoriesPOM.listSelectors.rowGeneric).should('have.length.at.least', 1)

      cy.log('Category deletion cancelled')
    })
  })

  // ============================================================
  // Color Badge Tests
  // ============================================================
  describe('Color Badges', () => {
    it('CAT-009: Should display category colors in table', () => {
      allure.story('UI Display')
      allure.severity('minor')

      // Check that color badges are visible
      cy.get(CategoriesPOM.listSelectors.table).within(() => {
        // Look for color indicators (background, border, or style attributes)
        cy.get('[style*="background"], [style*="color"]').should('exist')
      })

      cy.log('Category colors visible in table')
    })
  })

  // ============================================================
  // Icon Display Tests
  // ============================================================
  describe('Icon Display', () => {
    it('CAT-010: Should display category icons in table', () => {
      allure.story('UI Display')
      allure.severity('minor')

      // Check that icons are visible (typically as SVG or icon components)
      cy.get(CategoriesPOM.listSelectors.table).within(() => {
        cy.get('svg, [class*="icon"]').should('exist')
      })

      cy.log('Category icons visible in table')
    })
  })
})
