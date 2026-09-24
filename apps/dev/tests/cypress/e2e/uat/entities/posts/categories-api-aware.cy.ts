/// <reference types="cypress" />

/**
 * Categories API-Aware Tests
 *
 * Demonstrates the new API-aware POM pattern with deterministic waits
 * using cy.intercept() instead of cy.wait(ms).
 *
 * Tags: @uat, @feat-posts, @api-aware, @categories
 */

import * as allure from 'allure-cypress'
import { CategoriesPOM, loginAsOwner } from '../../../../src'

describe('Categories - API-Aware Pattern Demo', {
  tags: ['@uat', '@feat-posts', '@api-aware', '@categories']
}, () => {
  beforeEach(() => {
    allure.epic('Posts System')
    allure.feature('API-Aware Testing Pattern')

    loginAsOwner()
  })

  describe('API-Aware Navigation', () => {
    it('APIAWARE-001: Should navigate with deterministic API wait', { tags: '@smoke' }, () => {
      allure.story('API-Aware Navigation')
      allure.severity('critical')

      // Use the new API-aware navigation method
      // This replaces: visitCategoriesPage() + waitForPageLoad() + cy.wait(2000)
      CategoriesPOM.visitWithApiWait()

      // Assertions
      CategoriesPOM.assertPageVisible()
      cy.get(CategoriesPOM.listSelectors.rowGeneric).should('have.length.at.least', 1)

      cy.log('API-aware navigation works correctly')
    })
  })

  describe('API-Aware CRUD', () => {
    it('APIAWARE-002: Should create category with deterministic waits', () => {
      allure.story('API-Aware Create')

      const uniqueId = Math.random().toString(36).substring(2, 8)
      const testData = {
        name: `APITest${uniqueId}`,
        slug: `apitest${uniqueId}`
      }

      // Navigate with API wait
      CategoriesPOM.visitWithApiWait()

      // Create with API-aware method
      // This replaces: createCategory() + cy.wait(2000)
      CategoriesPOM.createCategoryWithApiWait(testData)

      // Verify category was created
      CategoriesPOM.assertCategoryInList(testData.name)

      cy.log('API-aware create works correctly')
    })

    it('APIAWARE-003: Should use ApiInterceptor directly for custom flows', () => {
      allure.story('Direct ApiInterceptor Usage')

      const uniqueId = Math.random().toString(36).substring(2, 8)
      const testData = {
        name: `DirectAPI${uniqueId}`,
        slug: `directapi${uniqueId}`
      }

      // Setup intercepts manually
      CategoriesPOM.setupApiIntercepts()

      // Navigate
      CategoriesPOM.visitCategoriesPage()
      CategoriesPOM.waitForPageLoad()

      // Wait for initial list using api directly
      CategoriesPOM.api.waitForList()

      // Open dialog and fill form
      CategoriesPOM.clickCreate()
      CategoriesPOM.waitForDialogOpen()
      CategoriesPOM.fillName(testData.name)
      CategoriesPOM.fillSlug(testData.slug)
      CategoriesPOM.saveCategory()

      // Wait for create + refresh using api directly
      CategoriesPOM.api.waitForCreate()
      CategoriesPOM.api.waitForRefresh()

      // Wait for dialog to close
      CategoriesPOM.waitForDialogClose()

      // Verify
      CategoriesPOM.assertCategoryInList(testData.name)

      cy.log('Direct ApiInterceptor usage works correctly')
    })
  })
})
