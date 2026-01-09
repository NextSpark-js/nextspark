/**
 * UI Selectors Validation: Tasks Entity
 *
 * This test validates that Tasks entity selectors exist in the DOM.
 * Uses POM architecture with dynamic selectors for entity CRUD operations.
 *
 * Purpose:
 * - Validate selectors from DashboardEntityPOM work correctly
 * - Ensure dynamic selector generation produces valid CSS selectors
 * - Run as Phase 12 sub-gate before functional tests
 *
 * Scope:
 * - Navigate to tasks pages (requires login)
 * - Assert elements exist in DOM (no full CRUD operations)
 * - Fast execution (< 30 seconds per describe block)
 *
 * Test IDs:
 * - SEL_TASK_001: List Page Selectors
 * - SEL_TASK_002: Filter Selectors
 * - SEL_TASK_003: Row Dynamic Selectors
 * - SEL_TASK_004: Create Page Selectors
 * - SEL_TASK_005: Detail Page Selectors
 * - SEL_TASK_006: Bulk Actions Selectors
 * - SEL_TASK_007: Delete Dialog Selectors
 *
 * STARTER THEME NOTES:
 * =====================
 * This file contains tests adapted for the starter theme which has:
 * - NO sample data (no pre-existing tasks)
 * - Only developer and superadmin users
 *
 * Tests marked with .skip require sample data to run.
 * To enable them:
 * 1. Run sample data migration: pnpm db:seed
 * 2. Or create tasks manually via the UI
 * 3. Remove .skip from the tests
 *
 * Tests that work without sample data:
 * - SEL_TASK_001 (partial): Empty state selectors (table container, add button, search)
 * - SEL_TASK_002: Filter triggers (render even with empty list)
 * - SEL_TASK_004: Create form selectors (no existing data needed)
 */

import { TasksPOM } from '../../src/entities/TasksPOM'
import { loginAsDefaultSuperadmin } from '../../src/session-helpers'

describe('Tasks Entity Selectors Validation', { tags: ['@ui-selectors', '@tasks'] }, () => {
  const tasks = TasksPOM.create()

  beforeEach(() => {
    // NOTE: Using superadmin for starter theme as it has global access
    // Tasks is team-based, and developer user doesn't have team context by default
    loginAsDefaultSuperadmin()
  })

  // ============================================
  // SEL_TASK_001: LIST PAGE SELECTORS
  // ============================================
  describe('SEL_TASK_001: List Page Selectors', { tags: '@SEL_TASK_001' }, () => {
    beforeEach(() => {
      tasks.visitList()
      // Note: waitForList might timeout if no data - use direct selector check
      cy.get(tasks.selectors.tableContainer, { timeout: 15000 }).should('exist')
    })

    // ✅ These work without sample data (empty state)
    it('should find table container element', () => {
      cy.get(tasks.selectors.tableContainer).should('exist')
    })

    it('should find add button', () => {
      cy.get(tasks.selectors.addButton).should('exist')
    })

    it('should find search input', () => {
      cy.get(tasks.selectors.search).should('exist')
    })

    it('should find search container', () => {
      cy.get(tasks.selectors.searchContainer).should('exist')
    })

    it('should find select all checkbox', () => {
      cy.get(tasks.selectors.selectAll).should('exist')
    })

    it('should find pagination container', () => {
      cy.get(tasks.selectors.pagination).should('exist')
    })

    it('should find pagination controls', () => {
      cy.get(tasks.selectors.pageFirst).should('exist')
      cy.get(tasks.selectors.pagePrev).should('exist')
      cy.get(tasks.selectors.pageNext).should('exist')
      cy.get(tasks.selectors.pageLast).should('exist')
    })

    it('should find page size selector', () => {
      cy.get(tasks.selectors.pageSize).should('exist')
    })

    it('should find page info', () => {
      cy.get(tasks.selectors.pageInfo).should('exist')
    })

    // ❌ REQUIRES SAMPLE DATA: Needs at least one task row
    it.skip('should find at least one row with dynamic selector (requires sample data)', () => {
      cy.get(tasks.selectors.rowGeneric).should('have.length.at.least', 1)
    })
  })

  // ============================================
  // SEL_TASK_002: FILTER SELECTORS
  // ============================================
  describe('SEL_TASK_002: Filter Selectors', { tags: '@SEL_TASK_002' }, () => {
    beforeEach(() => {
      tasks.visitList()
      cy.get(tasks.selectors.tableContainer, { timeout: 15000 }).should('exist')
    })

    // ✅ Filter triggers render even with empty list
    it('should find status filter trigger', () => {
      cy.get(tasks.selectors.filterTrigger('status')).should('exist')
    })

    it('should find priority filter trigger', () => {
      cy.get(tasks.selectors.filterTrigger('priority')).should('exist')
    })

    it('should find filter options when opened', () => {
      tasks.openFilter('status')
      cy.get(tasks.selectors.filterContent('status')).should('be.visible')
    })
  })

  // ============================================
  // SEL_TASK_003: ROW DYNAMIC SELECTORS
  // ============================================
  describe('SEL_TASK_003: Row Dynamic Selectors', { tags: '@SEL_TASK_003' }, () => {
    // ❌ REQUIRES SAMPLE DATA: All tests need existing task rows
    // Enable after running: pnpm db:seed or creating tasks manually

    it.skip('should find row elements with dynamic ID (requires sample data)', () => {
      tasks.visitList()
      tasks.waitForList()

      // Get any row and extract its ID to test dynamic selectors
      cy.get(tasks.selectors.rowGeneric)
        .first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          // Extract ID from data-cy="tasks-row-{id}"
          const id = dataCy?.replace('tasks-row-', '') || ''
          expect(id).to.not.be.empty

          // Test dynamic selector functions work
          cy.get(tasks.selectors.row(id)).should('exist')
          cy.get(tasks.selectors.rowSelect(id)).should('exist')
          cy.get(tasks.selectors.rowMenu(id)).should('exist')
        })
    })
  })

  // ============================================
  // SEL_TASK_004: CREATE PAGE SELECTORS
  // ============================================
  describe('SEL_TASK_004: Create Page Selectors', { tags: '@SEL_TASK_004' }, () => {
    beforeEach(() => {
      tasks.visitCreate()
      tasks.waitForForm()
    })

    // ✅ All create form tests work without sample data
    it('should find form container', () => {
      cy.get(tasks.selectors.form).should('exist')
    })

    it('should find submit button', () => {
      cy.get(tasks.selectors.submitButton).should('exist')
    })

    it('should find create header', () => {
      cy.get(tasks.selectors.createHeader).should('exist')
    })

    it('should find back button', () => {
      cy.get(tasks.selectors.backButton).should('exist')
    })

    it('should find title field', () => {
      cy.get(tasks.selectors.field('title')).should('exist')
    })

    it('should find description field', () => {
      cy.get(tasks.selectors.field('description')).should('exist')
    })

    it('should find status field', () => {
      cy.get(tasks.selectors.field('status')).should('exist')
    })

    it('should find priority field', () => {
      cy.get(tasks.selectors.field('priority')).should('exist')
    })
  })

  // ============================================
  // SEL_TASK_005: DETAIL PAGE SELECTORS
  // ============================================
  describe('SEL_TASK_005: Detail Page Selectors', { tags: '@SEL_TASK_005' }, () => {
    // ❌ REQUIRES SAMPLE DATA: Needs existing task to navigate to detail page
    // Enable after running: pnpm db:seed or creating tasks manually

    it.skip('should find detail page elements after navigating to a task (requires sample data)', () => {
      // First get a task ID from the list
      tasks.visitList()
      tasks.waitForList()

      cy.get(tasks.selectors.rowGeneric)
        .first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          const id = dataCy?.replace('tasks-row-', '') || ''

          // Navigate to detail page
          tasks.visitDetail(id)
          tasks.waitForDetail()

          // Validate detail page selectors
          cy.get(tasks.selectors.viewHeader).should('exist')
          cy.get(tasks.selectors.editButton).should('exist')
          cy.get(tasks.selectors.deleteButton).should('exist')
          cy.get(tasks.selectors.backButton).should('exist')
        })
    })
  })

  // ============================================
  // SEL_TASK_006: BULK ACTIONS SELECTORS
  // ============================================
  describe('SEL_TASK_006: Bulk Actions Selectors', { tags: '@SEL_TASK_006' }, () => {
    // ❌ REQUIRES SAMPLE DATA: Needs rows to select for bulk actions
    // Enable after running: pnpm db:seed or creating tasks manually

    it.skip('should show bulk bar after selecting rows (requires sample data)', () => {
      tasks.visitList()
      tasks.waitForList()

      // Select first row
      cy.get(tasks.selectors.rowGeneric)
        .first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          const id = dataCy?.replace('tasks-row-', '') || ''
          cy.get(tasks.selectors.rowSelect(id)).click()

          // Bulk bar should appear
          cy.get(tasks.selectors.bulkBar).should('be.visible')
          cy.get(tasks.selectors.bulkCount).should('exist')
          cy.get(tasks.selectors.bulkDelete).should('exist')
          cy.get(tasks.selectors.bulkClear).should('exist')
        })
    })
  })

  // ============================================
  // SEL_TASK_007: DELETE DIALOG SELECTORS
  // ============================================
  describe('SEL_TASK_007: Delete Dialog Selectors', { tags: '@SEL_TASK_007' }, () => {
    // ❌ REQUIRES SAMPLE DATA: Needs existing task to test delete dialog
    // Enable after running: pnpm db:seed or creating tasks manually

    it.skip('should find delete dialog elements (requires sample data)', () => {
      // Navigate to a task detail
      tasks.visitList()
      tasks.waitForList()

      cy.get(tasks.selectors.rowGeneric)
        .first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          const id = dataCy?.replace('tasks-row-', '') || ''

          tasks.visitDetail(id)
          tasks.waitForDetail()

          // Click delete to open dialog
          tasks.clickDelete()

          // Validate dialog selectors
          cy.get(tasks.selectors.deleteDialog).should('be.visible')
          cy.get(tasks.selectors.deleteConfirm).should('exist')
          cy.get(tasks.selectors.deleteCancel).should('exist')

          // Close without deleting
          tasks.cancelDelete()
        })
    })
  })
})
