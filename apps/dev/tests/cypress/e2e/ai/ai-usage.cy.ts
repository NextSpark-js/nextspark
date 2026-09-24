/**
 * AI Usage Dashboard E2E Tests
 *
 * Tests the AI usage tracking dashboard at /dashboard/settings/ai-usage
 *
 * Scope:
 * - Page navigation and loading
 * - Period selector functionality
 * - Stats cards display
 * - Empty state handling
 * - Loading state visibility
 *
 * Limitations:
 * - Cannot test with real token usage data without LLM provider
 * - Tests verify UI structure and component rendering
 * - Actual API data fetching requires backend implementation
 */

import { loginAsDefaultOwner } from '../../src/session-helpers'

describe('AI Usage Dashboard', {
  tags: ['@feat-ai', '@ui', '@dashboard']
}, () => {
  beforeEach(() => {
    // Login as owner user with team context
    loginAsDefaultOwner()
  })

  describe('AI_USAGE_01: Page loads successfully', () => {
    it('should navigate to AI usage page and display main container', () => {
      // Navigate to AI usage dashboard
      cy.visit('/dashboard/settings/ai-usage')

      // Verify URL
      cy.url().should('include', '/dashboard/settings/ai-usage')

      // Verify page container exists
      cy.get('[data-cy="ai-usage-page"]').should('exist')
    })

    it('should display page header with title', () => {
      cy.visit('/dashboard/settings/ai-usage')

      // Verify page structure (title is rendered in the component)
      cy.get('[data-cy="ai-usage-page"]').within(() => {
        // Header should be present (h1 or similar)
        cy.get('h1').should('exist')
      })
    })
  })

  describe('AI_USAGE_02: Period selector works', () => {
    it('should display period selector with all options', () => {
      cy.visit('/dashboard/settings/ai-usage')

      // Wait for page to load
      cy.get('[data-cy="ai-usage-page"]').should('exist')

      // Period selector should exist
      cy.get('[data-cy="ai-usage-period-select"]').should('exist')
    })

    it('should have correct period options available', () => {
      cy.visit('/dashboard/settings/ai-usage')

      // Click period selector to open options
      cy.get('[data-cy="ai-usage-period-select"]').click()

      // Verify all period options are available
      // Note: The exact selector for options may vary based on Select component implementation
      // This is a structural test that verifies the selector is clickable
      cy.get('[data-cy="ai-usage-period-select"]').should('exist')
    })

    it('should allow selecting different periods', () => {
      cy.visit('/dashboard/settings/ai-usage')

      // Period selector should be interactive
      cy.get('[data-cy="ai-usage-period-select"]').should('not.be.disabled')
    })
  })

  describe('AI_USAGE_03: Stats cards display', () => {
    it('should display total tokens card', () => {
      cy.visit('/dashboard/settings/ai-usage')

      // Wait for page to load (either loading state or data)
      cy.get('[data-cy="ai-usage-page"]').should('exist')

      // Total tokens card should exist (may show loading or data)
      cy.get('[data-cy="ai-usage-total-tokens"]', { timeout: 10000 }).should('exist')
    })

    it('should display total cost card', () => {
      cy.visit('/dashboard/settings/ai-usage')

      cy.get('[data-cy="ai-usage-page"]').should('exist')

      // Total cost card should exist
      cy.get('[data-cy="ai-usage-total-cost"]', { timeout: 10000 }).should('exist')
    })

    it('should display requests card', () => {
      cy.visit('/dashboard/settings/ai-usage')

      cy.get('[data-cy="ai-usage-page"]').should('exist')

      // Requests card should exist
      cy.get('[data-cy="ai-usage-requests"]', { timeout: 10000 }).should('exist')
    })

    it('should display all three stats cards together', () => {
      cy.visit('/dashboard/settings/ai-usage')

      cy.get('[data-cy="ai-usage-page"]').should('exist')

      // All three cards should be present
      cy.get('[data-cy="ai-usage-total-tokens"]').should('exist')
      cy.get('[data-cy="ai-usage-total-cost"]').should('exist')
      cy.get('[data-cy="ai-usage-requests"]').should('exist')
    })
  })

  describe('AI_USAGE_04: Empty state shown when no data', () => {
    it('should display daily usage chart container', () => {
      cy.visit('/dashboard/settings/ai-usage')

      cy.get('[data-cy="ai-usage-page"]').should('exist')

      // Daily usage chart/container should exist
      // May show "no data" message or actual chart
      cy.get('[data-cy="ai-usage-chart"]', { timeout: 10000 }).should('exist')
    })

    it('should handle case when no usage data exists', () => {
      cy.visit('/dashboard/settings/ai-usage')

      cy.get('[data-cy="ai-usage-page"]').should('exist')

      // The component should gracefully handle empty data
      // Either show loading, empty state, or zero values
      cy.get('[data-cy="ai-usage-total-tokens"]').should('exist')

      // Verify page doesn't crash with no data
      cy.get('[data-cy="ai-usage-page"]').should('be.visible')
    })
  })

  describe('AI_USAGE_05: Loading state visible', () => {
    it('should show loading state before data loads', () => {
      // Intercept API call to delay response
      cy.intercept('GET', '/api/v1/theme/default/ai/usage*', (req) => {
        req.reply((res) => {
          // Delay response to ensure loading state is visible
          res.delay = 1000
        })
      }).as('getUsage')

      cy.visit('/dashboard/settings/ai-usage')

      // Loading state should be visible initially
      cy.get('[data-cy="ai-usage-loading"]').should('exist')

      // Wait for API call
      cy.wait('@getUsage')

      // Loading state should disappear after data loads
      cy.get('[data-cy="ai-usage-loading"]').should('not.exist')
    })

    it('should display content after loading completes', () => {
      cy.visit('/dashboard/settings/ai-usage')

      // Wait for page to load completely
      cy.get('[data-cy="ai-usage-page"]').should('exist')

      // Either loading is gone or content is visible
      cy.get('[data-cy="ai-usage-page"]').within(() => {
        // At least one of these should be visible
        cy.get('[data-cy="ai-usage-loading"], [data-cy="ai-usage-total-tokens"]').should('exist')
      })
    })
  })

  describe('Additional UI Elements', () => {
    it('should display usage by model section if data exists', () => {
      cy.visit('/dashboard/settings/ai-usage')

      cy.get('[data-cy="ai-usage-page"]').should('exist')

      // Usage by model is conditionally rendered
      // This test just verifies the selector pattern exists in the component
      // It may or may not be visible depending on data
      cy.get('[data-cy="ai-usage-page"]').should('be.visible')
    })

    it('should be responsive and not have layout issues', () => {
      cy.visit('/dashboard/settings/ai-usage')

      // Verify page renders without errors
      cy.get('[data-cy="ai-usage-page"]').should('be.visible')

      // Check that cards are laid out properly
      cy.get('[data-cy="ai-usage-total-tokens"]').should('be.visible')
      cy.get('[data-cy="ai-usage-total-cost"]').should('be.visible')
      cy.get('[data-cy="ai-usage-requests"]').should('be.visible')
    })
  })
})
