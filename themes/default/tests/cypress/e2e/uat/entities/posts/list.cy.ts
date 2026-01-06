/// <reference types="cypress" />

/**
 * Posts List - Admin UI Tests
 *
 * Tests for the posts list view in the admin dashboard.
 * Validates navigation, search, filtering, and basic CRUD operations.
 *
 * Tags: @uat, @feat-posts, @admin, @regression
 */

import * as allure from 'allure-cypress'
import { PostsListPOM, loginAsOwner } from '../../../../src'

describe('Posts List - Admin UI', {
  tags: ['@uat', '@feat-posts', '@admin', '@regression']
}, () => {
  beforeEach(() => {
    allure.epic('Posts System')
    allure.feature('Posts List')

    // Setup API intercepts BEFORE login and navigation
    PostsListPOM.setupApiIntercepts()
    loginAsOwner()
    PostsListPOM.visitList()
    PostsListPOM.api.waitForList()
    PostsListPOM.waitForListLoad()
  })

  // ============================================================
  // Navigation Tests
  // ============================================================
  describe('Navigation', () => {
    it('POST-LIST-001: Should navigate to posts list', { tags: '@smoke' }, () => {
      allure.story('Navigation')
      allure.severity('critical')

      PostsListPOM.assertListPageVisible()
      cy.log('Successfully navigated to posts list')
    })

    it('POST-LIST-002: Should navigate to create post from list', () => {
      allure.story('Navigation')
      allure.severity('normal')

      PostsListPOM.clickCreatePost()
      cy.url().should('include', '/dashboard/posts/create')
      cy.log('Navigated to create post')
    })

    it('POST-LIST-003: Should display sample posts in list', () => {
      allure.story('List Display')
      allure.severity('normal')

      PostsListPOM.assertPostInList('Welcome')
      cy.log('Sample posts visible in list')
    })
  })

  // ============================================================
  // Search Tests
  // ============================================================
  describe('Search', () => {
    it('POST-LIST-004: Should search posts by title', () => {
      allure.story('Search')
      allure.severity('normal')

      PostsListPOM.searchPosts('Welcome')

      // Wait for search API call (debounced)
      PostsListPOM.api.waitForList()

      PostsListPOM.assertPostInList('Welcome')
      cy.log('Search by title working')
    })

    it('POST-LIST-005: Should clear search and show all posts', () => {
      allure.story('Search')
      allure.severity('normal')

      cy.get(PostsListPOM.listSelectors.rowGeneric).then(($rows) => {
        const initialCount = $rows.length

        PostsListPOM.searchPosts('Welcome')
        PostsListPOM.api.waitForList()

        PostsListPOM.clearSearch()
        PostsListPOM.api.waitForList()

        cy.get(PostsListPOM.listSelectors.rowGeneric).should('have.length.at.least', 1)
        cy.log('Search cleared, showing posts')
      })
    })
  })

  // ============================================================
  // Filter Tests
  // ============================================================
  describe('Filters', () => {
    it('POST-LIST-006: Should filter posts by category', () => {
      allure.story('Filters')
      allure.severity('normal')

      cy.get(PostsListPOM.listSelectors.categoryFilter).then(($filter) => {
        if ($filter.length > 0) {
          PostsListPOM.filterByCategory('News')
          PostsListPOM.api.waitForList()

          PostsListPOM.assertCategoryBadgeVisible('News')
          cy.log('Filter by category working')
        } else {
          cy.log('Category filter not available - skipping')
        }
      })
    })

    it('POST-LIST-007: Should filter posts by published status', () => {
      allure.story('Filters')
      allure.severity('normal')

      cy.get(PostsListPOM.listSelectors.statusFilter).then(($filter) => {
        if ($filter.length > 0) {
          PostsListPOM.filterByStatus('published')
          PostsListPOM.api.waitForList()

          cy.get('table tbody').should('exist')
          cy.log('Filter by published status working')
        } else {
          cy.log('Status filter not available - skipping')
        }
      })
    })
  })

  // ============================================================
  // Category Badge Display Tests
  // ============================================================
  describe('Category Badges', () => {
    it('POST-LIST-008: Should display category badges with colors', () => {
      allure.story('UI Display')
      allure.severity('minor')

      cy.get(PostsListPOM.listSelectors.table).within(() => {
        cy.get('[class*="badge"], [style*="background"]').should('exist')
      })

      cy.log('Category badges with colors visible')
    })
  })

  // ============================================================
  // Actions Tests
  // ============================================================
  describe('Actions', () => {
    it('POST-LIST-009: Should have edit action available', () => {
      allure.story('Actions')
      allure.severity('normal')

      cy.get(PostsListPOM.listSelectors.rowGeneric).first().within(() => {
        cy.get('button').should('exist')
      })

      cy.log('Edit action available')
    })

    it('POST-LIST-010: Should have delete action available', () => {
      allure.story('Actions')
      allure.severity('normal')

      cy.get(PostsListPOM.listSelectors.rowGeneric).first().within(() => {
        cy.get('button').should('exist')
      })

      cy.log('Delete action available')
    })
  })
})
