/**
 * UI Selectors Validation: Dashboard Navigation
 *
 * This test validates that dashboard navigation selectors exist in the DOM.
 * This is a lightweight test that ONLY checks selector presence, not functionality.
 *
 * Purpose:
 * - Validate DashboardPOM navigation selectors work correctly
 * - Ensure all dashboard.navigation.* selectors are implemented
 * - Run as Phase 12 sub-gate before functional tests
 *
 * Scope:
 * - Navigate to dashboard (requires login)
 * - Assert elements exist in DOM (no form submissions)
 * - Fast execution (< 30 seconds per describe block)
 *
 * Test IDs:
 * - SEL_DASH_001: Navigation Structure
 * - SEL_DASH_002: Entity Links
 * - SEL_DASH_003: Navigation Sections (skipped - requires customSidebarSections which replaces default nav)
 *
 * NOTE: Entity links are dynamic based on permissions.
 * Section selectors require knowing the exact section IDs from theme config.
 */

import { DashboardPOM } from '../../../src/features/DashboardPOM'
import { loginAsDefaultDeveloper } from '../../../src/session-helpers'

describe('Dashboard Navigation Selectors Validation', { tags: ['@ui-selectors', '@dashboard', '@navigation'] }, () => {
  const dashboard = DashboardPOM.create()

  beforeEach(() => {
    loginAsDefaultDeveloper()
    cy.visit('/dashboard', { timeout: 60000, failOnStatusCode: false })
    cy.url().should('include', '/dashboard')
  })

  // ============================================
  // SEL_DASH_001: NAVIGATION STRUCTURE
  // ============================================
  describe('SEL_DASH_001: Navigation Structure', { tags: '@SEL_DASH_001' }, () => {
    it('should find nav container', () => {
      cy.get(dashboard.selectors.navContainer).should('exist')
    })

    it('should find dashboard link', () => {
      cy.get(dashboard.selectors.navDashboard).should('exist')
    })
  })

  // ============================================
  // SEL_DASH_002: ENTITY LINKS
  // ============================================
  describe('SEL_DASH_002: Entity Links', { tags: '@SEL_DASH_002' }, () => {
    it('should find tasks entity link', () => {
      cy.get(dashboard.selectors.navEntity('tasks')).should('exist')
    })

    it('should find customers entity link', () => {
      cy.get(dashboard.selectors.navEntity('customers')).should('exist')
    })

    it('should find posts entity link', () => {
      cy.get(dashboard.selectors.navEntity('posts')).should('exist')
    })

    it('should find pages entity link', () => {
      cy.get(dashboard.selectors.navEntity('pages')).should('exist')
    })
  })

  // ============================================
  // SEL_DASH_003: NAVIGATION SECTIONS
  // ============================================
  /**
   * SKIPPED: These tests require `customSidebarSections` in app.config.ts
   *
   * IMPORTANT: Enabling `customSidebarSections` REPLACES the default entity-based
   * navigation entirely. The sidebar will only show what's defined in the sections.
   *
   * Requirements to enable these tests:
   * 1. Add `customSidebarSections` array to app.config.ts
   * 2. Add all required translation keys (navigation.{sectionId}, navigation.{itemId})
   * 3. Update tests with the actual section/item IDs from your config
   *
   * Example config:
   * ```
   * customSidebarSections: [
   *   {
   *     id: 'content',
   *     labelKey: 'navigation.content',
   *     icon: 'FileText',
   *     order: 1,
   *     items: [
   *       { id: 'posts', labelKey: 'navigation.posts', href: '/dashboard/posts', icon: 'Newspaper' },
   *     ],
   *   },
   * ]
   * ```
   */
  describe('SEL_DASH_003: Navigation Sections', { tags: '@SEL_DASH_003' }, () => {
    it.skip('should find section by ID (requires customSidebarSections in app.config.ts)', () => {
      // cy.get(dashboard.selectors.navSection('content')).should('exist')
    })

    it.skip('should find section label (requires customSidebarSections in app.config.ts)', () => {
      // cy.get(dashboard.selectors.navSectionLabel('content')).should('exist')
    })

    it.skip('should find section item (requires customSidebarSections in app.config.ts)', () => {
      // cy.get(dashboard.selectors.navSectionItem('content', 'posts')).should('exist')
    })
  })
})
