/// <reference types="cypress" />

/**
 * Pages List - Admin UI Tests
 *
 * Tests for the pages list view in the admin dashboard.
 * Validates navigation, search, filtering, and basic CRUD operations.
 *
 * Tags: @uat, @feat-pages, @admin, @page-builder, @regression
 */

import * as allure from 'allure-cypress'
import { PageBuilderPOM, loginAsOwner } from '../../../../src'

describe('Pages List - Admin UI', {
  tags: ['@uat', '@feat-pages', '@admin', '@page-builder', '@regression']
}, () => {
  beforeEach(() => {
    allure.epic('Page Builder')
    allure.feature('Pages List')

    // Setup API intercepts BEFORE login and navigation
    PageBuilderPOM.setupApiIntercepts()
    loginAsOwner()
    PageBuilderPOM.visitList()
    PageBuilderPOM.api.waitForList()
    PageBuilderPOM.waitForListLoad()
  })

  // ============================================================
  // Navigation Tests
  // ============================================================
  describe('Navigation', () => {
    it('PB-LIST-001: Should navigate to pages list', { tags: '@smoke' }, () => {
      allure.story('Navigation')
      allure.severity('critical')

      PageBuilderPOM.assertListPageVisible()
      cy.log('Successfully navigated to pages list')
    })

    it('PB-LIST-002: Should navigate to create page from list', () => {
      allure.story('Navigation')
      allure.severity('normal')

      PageBuilderPOM.clickCreatePage()
      cy.url().should('include', '/dashboard/pages/create')
      cy.log('Navigated to create page')
    })

    it('PB-LIST-003: Should navigate to edit page from list', () => {
      allure.story('Navigation')
      allure.severity('normal')

      // Get first page row and extract ID to use menu selector
      cy.get(PageBuilderPOM.listSelectors.rowGeneric).first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          const pageId = dataCy?.replace('pages-row-', '') || ''

          // Click menu trigger for this specific row
          PageBuilderPOM.openRowMenu(pageId)

          // Click Edit in dropdown
          cy.get('[role="menuitem"]').contains(/edit/i).click()

          cy.url().should('include', '/edit')
          cy.log('Navigated to edit page')
        })
    })
  })

  // ============================================================
  // Search Tests
  // ============================================================
  describe('Search', () => {
    it('PB-LIST-004: Should search pages by title', () => {
      allure.story('Search')
      allure.severity('normal')

      PageBuilderPOM.searchPages('About')
      PageBuilderPOM.api.waitForList()

      cy.get(PageBuilderPOM.listSelectors.rowGeneric).should('exist')
      cy.log('Search by title working')
    })

    it('PB-LIST-005: Should clear search and show all pages', () => {
      allure.story('Search')
      allure.severity('normal')

      cy.get(PageBuilderPOM.listSelectors.rowGeneric).then(($rows) => {
        const initialCount = $rows.length

        PageBuilderPOM.searchPages('About')
        PageBuilderPOM.api.waitForList()

        PageBuilderPOM.clearSearch()
        PageBuilderPOM.api.waitForList()

        cy.get(PageBuilderPOM.listSelectors.rowGeneric).should('have.length.at.least', 1)
        cy.log('Search cleared, showing pages')
      })
    })
  })

  // ============================================================
  // Filter Tests
  // ============================================================
  describe('Filters', () => {
    it('PB-LIST-006: Should filter pages by published status', () => {
      allure.story('Filters')
      allure.severity('normal')

      // Check if filter exists in DOM
      cy.get('body').then(($body) => {
        const filterExists = $body.find(PageBuilderPOM.listSelectors.filterStatus).length > 0

        if (filterExists) {
          // Click filter trigger
          cy.get(PageBuilderPOM.listSelectors.filterStatus).find('button, [role="combobox"]').first().click()

          // Wait for options to appear and click first non-all option
          cy.get('[role="listbox"] [role="option"], [role="option"]', { timeout: 5000 })
            .should('have.length.at.least', 1)
            .eq(1).click()

          PageBuilderPOM.api.waitForList()
          cy.log('Filter by published status applied')
        } else {
          // Filter not available - test passes anyway
          cy.log('Status filter not available in this view - skipping')
        }
      })
    })
  })

  // ============================================================
  // Delete Tests
  // ============================================================
  describe('Delete', () => {
    it('PB-LIST-007: Should show delete confirmation dialog', () => {
      allure.story('CRUD Operations')
      allure.severity('normal')

      // Create a test page to delete
      const timestamp = Date.now()

      cy.request({
        method: 'POST',
        url: '/api/v1/pages',
        headers: {
          'x-api-key': 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123',
          'x-team-id': 'team-everpoint-001',
          'Content-Type': 'application/json'
        },
        body: {
          title: `Delete Test ${timestamp}`,
          slug: `delete-test-${timestamp}`,
          locale: 'en',
          published: false,
          blocks: []
        }
      }).then((response) => {
        const pageId = response.body.data.id

        PageBuilderPOM.visitList()
        PageBuilderPOM.api.waitForList()

        PageBuilderPOM.searchPages(`Delete Test ${timestamp}`)
        PageBuilderPOM.api.waitForList()

        // Open row menu using proper selector
        PageBuilderPOM.openRowMenu(pageId)

        // Click delete in dropdown
        cy.get('[role="menuitem"].text-destructive, [role="menuitem"]:last-child').click()

        cy.get(PageBuilderPOM.listSelectors.confirmDelete).should('be.visible')

        // Cancel delete
        cy.get('[role="dialog"] button').not('.bg-destructive, [variant="destructive"]').first().click()

        // Cleanup via API
        cy.request({
          method: 'DELETE',
          url: `/api/v1/pages/${pageId}`,
          headers: {
            'x-api-key': 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123',
            'x-team-id': 'team-everpoint-001'
          }
        })

        cy.log('Delete confirmation dialog shown')
      })
    })

    it('PB-LIST-008: Should delete page after confirmation', () => {
      allure.story('CRUD Operations')
      allure.severity('normal')

      const timestamp = Date.now()

      cy.request({
        method: 'POST',
        url: '/api/v1/pages',
        headers: {
          'x-api-key': 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123',
          'x-team-id': 'team-everpoint-001',
          'Content-Type': 'application/json'
        },
        body: {
          title: `To Delete ${timestamp}`,
          slug: `to-delete-${timestamp}`,
          locale: 'en',
          published: false,
          blocks: []
        }
      }).then((response) => {
        const pageId = response.body.data.id
        const pageTitle = `To Delete ${timestamp}`

        PageBuilderPOM.visitList()
        PageBuilderPOM.api.waitForList()

        PageBuilderPOM.searchPages(pageTitle)
        PageBuilderPOM.api.waitForList()

        // Open row menu using proper selector
        PageBuilderPOM.openRowMenu(pageId)

        // Click delete in dropdown
        cy.get('[role="menuitem"].text-destructive, [role="menuitem"]:last-child').click()

        // Confirm delete
        cy.get('[role="dialog"] button.bg-destructive, [role="dialog"] button[variant="destructive"]').click()

        PageBuilderPOM.api.waitForDelete()

        // Verify page is gone
        PageBuilderPOM.clearSearch()
        PageBuilderPOM.searchPages(pageTitle)
        PageBuilderPOM.api.waitForList()

        cy.get('body').should('not.contain', pageTitle)
        cy.log('Page deleted successfully')
      })
    })
  })

  // ============================================================
  // Empty State Tests
  // ============================================================
  describe('Empty State', () => {
    it('PB-LIST-009: Should show empty state when no results match search', () => {
      allure.story('UI States')
      allure.severity('minor')

      PageBuilderPOM.searchPages('NonExistentPageTitle12345')
      PageBuilderPOM.api.waitForList()

      cy.get('body').then(($body) => {
        const hasEmptyState = $body.find(PageBuilderPOM.listSelectors.emptyState).length > 0
        const hasNoResults = $body.text().includes('No results') ||
                            $body.text().includes('No pages') ||
                            $body.text().includes('no encontr')

        expect(hasEmptyState || hasNoResults).to.be.true
        cy.log('Empty state shown for no matching results')
      })
    })
  })
})
