/**
 * Patterns in Pages - Functional E2E Tests
 *
 * Tests the integration of the patterns system with the page builder:
 * - Patterns tab visibility and functionality
 * - Pattern insertion into pages
 * - Pattern reference rendering and interaction
 * - Pattern nesting prevention (patterns tab hidden when editing patterns)
 *
 * Sample Patterns in DB (team-nextspark-001):
 * - Newsletter CTA (slug: newsletter-cta, status: published)
 * - Footer Links (slug: footer-links, status: published)
 * - Hero Header (slug: hero-header, status: draft)
 *
 * Re-execution:
 *   pnpm tags @patterns               # Run all patterns tests
 *   pnpm tags @TC_PAT_001             # Run specific test
 *   pnpm cy:run --spec "cypress/e2e/patterns/patterns-in-pages.cy.ts"
 */

import { PageBuilderPOM } from '../../src/features/PageBuilderPOM'
import { loginAsDefaultDeveloper } from '../../src/session-helpers'

const DEVELOPER_TEAM_ID = 'team-nextspark-001'

describe('Patterns in Pages - Functional Tests', {
  tags: ['@patterns', '@block-editor', '@functional']
}, () => {
  const pom = PageBuilderPOM.create()

  beforeEach(() => {
    loginAsDefaultDeveloper()
    cy.window().then((win) => {
      win.localStorage.setItem('activeTeamId', DEVELOPER_TEAM_ID)
    })
  })

  // ===========================================================================
  // TC_PAT_001: Can switch to Patterns tab in block picker
  // ===========================================================================
  describe('TC_PAT_001: Switch to Patterns Tab', { tags: '@TC_PAT_001' }, () => {
    it('should display patterns tab when editing pages', { tags: '@TC_PAT_001_01' }, () => {
      pom.visitCreate()
      pom.waitForEditor()

      // Patterns tab should be visible
      cy.get('[data-cy="block-picker-tab-patterns"]')
        .should('exist')
        .and('be.visible')
    })

    it('should switch to patterns tab on click', { tags: '@TC_PAT_001_02' }, () => {
      pom.visitCreate()
      pom.waitForEditor()

      // Click patterns tab
      cy.get('[data-cy="block-picker-tab-patterns"]').click()

      // Patterns search and list should appear
      cy.get('[data-cy="block-picker-patterns-search"]').should('be.visible')
      cy.get('[data-cy="block-picker-patterns-list"]').should('be.visible')
    })

    it('should switch back to blocks tab', { tags: '@TC_PAT_001_03' }, () => {
      pom.visitCreate()
      pom.waitForEditor()

      // Switch to patterns
      cy.get('[data-cy="block-picker-tab-patterns"]').click()
      cy.get('[data-cy="block-picker-patterns-list"]').should('be.visible')

      // Switch back to blocks
      cy.get('[data-cy="block-picker-tab-blocks"]').click()
      cy.get('[data-cy="block-picker-list"]').should('be.visible')
    })
  })

  // ===========================================================================
  // TC_PAT_002: Patterns tab shows sample patterns
  // ===========================================================================
  describe('TC_PAT_002: Display Sample Patterns', { tags: '@TC_PAT_002' }, () => {
    beforeEach(() => {
      pom.visitCreate()
      pom.waitForEditor()
      cy.get('[data-cy="block-picker-tab-patterns"]').click()
      cy.wait(500) // Wait for patterns to load
    })

    it('should display at least one published pattern', { tags: '@TC_PAT_002_01' }, () => {
      // Check that at least one pattern card exists
      cy.get('[data-cy^="block-picker-pattern-card-"]')
        .should('have.length.at.least', 1)
    })

    it('should display pattern card with all elements', { tags: '@TC_PAT_002_02' }, () => {
      // Get first pattern card
      cy.get('[data-cy^="block-picker-pattern-card-"]').first().within(() => {
        // Check for icon, title, description, insert button
        cy.get('[data-cy^="block-picker-pattern-icon-"]').should('exist')
        cy.get('[data-cy^="block-picker-pattern-title-"]').should('exist').and('not.be.empty')
        cy.get('[data-cy^="block-picker-pattern-desc-"]').should('exist')
        cy.get('[data-cy^="block-picker-pattern-insert-"]').should('exist').and('be.visible')
      })
    })

    it('should filter patterns using search', { tags: '@TC_PAT_002_03' }, () => {
      // Get initial count
      cy.get('[data-cy^="block-picker-pattern-card-"]').then(($cards) => {
        const initialCount = $cards.length

        // Type search term
        cy.get('[data-cy="block-picker-patterns-search"]').type('Newsletter')
        cy.wait(300)

        // Pattern list should be filtered
        cy.get('[data-cy^="block-picker-pattern-card-"]').then(($filtered) => {
          // Should have fewer or equal patterns after filtering
          expect($filtered.length).to.be.at.most(initialCount)

          // If newsletter pattern exists, it should be visible
          if ($filtered.length > 0) {
            cy.get('[data-cy^="block-picker-pattern-title-"]')
              .first()
              .should('contain.text', 'Newsletter')
          }
        })
      })
    })

    it('should clear search filter', { tags: '@TC_PAT_002_04' }, () => {
      // Search for something
      cy.get('[data-cy="block-picker-patterns-search"]').type('Footer')
      cy.wait(300)

      // Clear search
      cy.get('[data-cy="block-picker-patterns-search"]').clear()
      cy.wait(300)

      // All published patterns should be visible again
      cy.get('[data-cy^="block-picker-pattern-card-"]')
        .should('have.length.at.least', 1)
    })
  })

  // ===========================================================================
  // TC_PAT_003: Can insert a pattern into a page
  // ===========================================================================
  describe('TC_PAT_003: Insert Pattern into Page', { tags: '@TC_PAT_003' }, () => {
    it('should insert pattern when clicking insert button', { tags: '@TC_PAT_003_01' }, () => {
      pom.visitCreate()
      pom.waitForEditor()
      pom.switchToLayoutMode()

      // Switch to patterns tab
      cy.get('[data-cy="block-picker-tab-patterns"]').click()
      cy.wait(500)

      // Click insert on first pattern
      cy.get('[data-cy^="block-picker-pattern-insert-"]').first().click()

      // Pattern reference should appear in layout canvas
      cy.wait(1000)
      cy.get('[data-cy^="sortable-block-"]').should('have.length.at.least', 1)
    })

    it('should show pattern reference in sortable blocks list', { tags: '@TC_PAT_003_02' }, () => {
      pom.visitCreate()
      pom.waitForEditor()
      pom.switchToLayoutMode()

      // Insert pattern
      cy.get('[data-cy="block-picker-tab-patterns"]').click()
      cy.wait(500)
      cy.get('[data-cy^="block-picker-pattern-insert-"]').first().click()
      cy.wait(1000)

      // Should see pattern reference block in layout canvas
      // Pattern reference should have a distinct appearance (badge, etc.)
      cy.get(pom.editorSelectors.sortableBlockGeneric)
        .should('have.length.at.least', 1)
    })

    it('should allow inserting multiple patterns', { tags: '@TC_PAT_003_03' }, () => {
      pom.visitCreate()
      pom.waitForEditor()
      pom.switchToLayoutMode()

      cy.get('[data-cy="block-picker-tab-patterns"]').click()
      cy.wait(500)

      // Get count of available patterns
      cy.get('[data-cy^="block-picker-pattern-insert-"]').then(($buttons) => {
        const patternCount = Math.min($buttons.length, 2) // Insert max 2 patterns

        // Insert first pattern
        cy.get('[data-cy^="block-picker-pattern-insert-"]').eq(0).click()
        cy.wait(500)

        if (patternCount > 1) {
          // Insert second pattern if available
          cy.get('[data-cy^="block-picker-pattern-insert-"]').eq(1).click()
          cy.wait(500)

          // Should have 2 blocks
          cy.get(pom.editorSelectors.sortableBlockGeneric)
            .should('have.length.at.least', 2)
        }
      })
    })
  })

  // ===========================================================================
  // TC_PAT_004: Pattern reference displays correctly in preview
  // ===========================================================================
  describe('TC_PAT_004: Pattern Reference in Preview', { tags: '@TC_PAT_004' }, () => {
    beforeEach(() => {
      pom.visitCreate()
      pom.waitForEditor()
      pom.switchToLayoutMode()

      // Insert a pattern
      cy.get('[data-cy="block-picker-tab-patterns"]').click()
      cy.wait(500)
      cy.get('[data-cy^="block-picker-pattern-insert-"]').first().click()
      cy.wait(1000)

      // Switch to preview mode
      pom.switchToPreviewMode()
      cy.wait(500)
    })

    it('should render pattern reference container in preview', { tags: '@TC_PAT_004_01' }, () => {
      // Pattern reference should be visible
      cy.get('[data-cy^="pattern-reference-"]')
        .should('exist')
        .and('be.visible')
    })

    it('should display pattern reference badge', { tags: '@TC_PAT_004_02' }, () => {
      // Badge should indicate this is a pattern reference
      cy.get('[data-cy^="pattern-reference-badge-"]')
        .should('exist')
    })

    it('should show pattern reference edit link', { tags: '@TC_PAT_004_03' }, () => {
      // Edit link should allow navigating to pattern editor
      cy.get('[data-cy^="pattern-reference-edit-link-"]')
        .should('exist')
        .and('be.visible')
    })

    it('should show remove button for pattern reference', { tags: '@TC_PAT_004_04' }, () => {
      cy.get('[data-cy^="pattern-reference-remove-"]')
        .should('exist')
    })

    it('should show locked state when pattern reference is selected', { tags: '@TC_PAT_004_05' }, () => {
      // Click on pattern reference
      cy.get('[data-cy^="pattern-reference-"]').first().click()
      cy.wait(500)

      // Locked indicator should appear
      cy.get('[data-cy^="pattern-reference-locked-"]')
        .should('exist')
    })
  })

  // ===========================================================================
  // TC_PAT_005: Can remove pattern reference from page
  // ===========================================================================
  describe('TC_PAT_005: Remove Pattern Reference', { tags: '@TC_PAT_005' }, () => {
    it('should remove pattern reference when clicking remove button', { tags: '@TC_PAT_005_01' }, () => {
      pom.visitCreate()
      pom.waitForEditor()
      pom.switchToLayoutMode()

      // Insert pattern
      cy.get('[data-cy="block-picker-tab-patterns"]').click()
      cy.wait(500)
      cy.get('[data-cy^="block-picker-pattern-insert-"]').first().click()
      cy.wait(1000)

      // Get initial count
      cy.get(pom.editorSelectors.sortableBlockGeneric).then(($blocks) => {
        const initialCount = $blocks.length

        // Switch to preview to access remove button
        pom.switchToPreviewMode()
        cy.wait(500)

        // Click remove button
        cy.get('[data-cy^="pattern-reference-remove-"]').first().click()
        cy.wait(500)

        // Switch back to layout mode to verify
        pom.switchToLayoutMode()
        cy.wait(500)

        // Block count should decrease
        cy.get(pom.editorSelectors.sortableBlockGeneric).should('have.length', initialCount - 1)
      })
    })

    it('should remove pattern reference from layout mode', { tags: '@TC_PAT_005_02' }, () => {
      pom.visitCreate()
      pom.waitForEditor()
      pom.switchToLayoutMode()

      // Insert pattern
      cy.get('[data-cy="block-picker-tab-patterns"]').click()
      cy.wait(500)
      cy.get('[data-cy^="block-picker-pattern-insert-"]').first().click()
      cy.wait(1000)

      // In layout mode, use standard block remove button
      cy.get(pom.editorSelectors.sortableBlockGeneric).first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          const blockId = dataCy?.replace('sortable-block-', '') || ''
          cy.get(pom.editorSelectors.removeBlock(blockId)).click()
          cy.wait(500)

          // Block should be removed
          cy.get(pom.editorSelectors.sortableBlockGeneric).should('have.length', 0)
        })
    })
  })

  // ===========================================================================
  // TC_PAT_006: Patterns tab is NOT shown when editing patterns entity
  // ===========================================================================
  describe('TC_PAT_006: Prevent Pattern Nesting', { tags: '@TC_PAT_006' }, () => {
    it('should NOT show patterns tab when editing a pattern', { tags: '@TC_PAT_006_01' }, () => {
      // Visit the patterns entity create page
      cy.visit('/dashboard/patterns/create')
      cy.wait(1000)

      // Wait for editor to load
      cy.get(pom.editorSelectors.container, { timeout: 15000 }).should('be.visible')

      // Patterns tab should NOT exist (to prevent nesting patterns inside patterns)
      cy.get('[data-cy="block-picker-tab-patterns"]').should('not.exist')
    })

    it('should only show blocks and config tabs when editing patterns', { tags: '@TC_PAT_006_02' }, () => {
      cy.visit('/dashboard/patterns/create')
      cy.wait(1000)
      cy.get(pom.editorSelectors.container, { timeout: 15000 }).should('be.visible')

      // Only Blocks and Config tabs should be visible
      cy.get('[data-cy="block-picker-tab-blocks"]').should('exist').and('be.visible')
      cy.get('[data-cy="block-picker-tab-config"]').should('exist').and('be.visible')
      cy.get('[data-cy="block-picker-tab-patterns"]').should('not.exist')
    })

    it('should show patterns tab when editing pages (control test)', { tags: '@TC_PAT_006_03' }, () => {
      // Visit pages create (should show patterns tab)
      pom.visitCreate()
      pom.waitForEditor()

      // All three tabs should be visible
      cy.get('[data-cy="block-picker-tab-blocks"]').should('exist').and('be.visible')
      cy.get('[data-cy="block-picker-tab-patterns"]').should('exist').and('be.visible')
      cy.get('[data-cy="block-picker-tab-config"]').should('exist').and('be.visible')
    })
  })
})
