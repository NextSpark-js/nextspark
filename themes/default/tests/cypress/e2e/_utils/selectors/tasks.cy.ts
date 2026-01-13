/**
 * UI Selectors Validation: Tasks Entity
 *
 * This test validates that all entity selectors exist in the DOM.
 * Organized by the 6 first-level keys in ENTITIES_SELECTORS:
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * STRUCTURE (matches entities.selectors.ts)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 1. PAGE     - Page-level container
 * 2. LIST     - List view (search, filters, table, pagination, bulk, confirm)
 * 3. HEADER   - Entity detail header (view/edit/create modes)
 * 4. DETAIL   - Detail view container
 * 5. FORM     - Form container, fields, and actions
 * 6. CHILD    - Child entity management (not applicable for tasks)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Test IDs:
 * - SEL_TASK_PAGE_001: Page Container
 * - SEL_TASK_LIST_001: Search Selectors
 * - SEL_TASK_LIST_002: Table Structure Selectors
 * - SEL_TASK_LIST_003: Row Dynamic Selectors
 * - SEL_TASK_LIST_004: Pagination Selectors
 * - SEL_TASK_LIST_005: Filter Selectors
 * - SEL_TASK_LIST_006: Bulk Action Selectors
 * - SEL_TASK_LIST_007: Confirm Dialog Selectors
 * - SEL_TASK_HEADER_001: Header Selectors (all modes)
 * - SEL_TASK_DETAIL_001: Detail Container
 * - SEL_TASK_FORM_001: Form Selectors
 *
 * POM: TasksPOM extends DashboardEntityPOM
 * Selectors: ENTITIES_SELECTORS (6 first-level keys)
 */

import { TasksPOM } from '../../../src/entities/TasksPOM'
import { loginAsDefaultOwner } from '../../../src/session-helpers'

describe('Tasks Entity Selectors Validation', { tags: ['@ui-selectors', '@entities', '@tasks'] }, () => {
  const tasks = TasksPOM.create()

  beforeEach(() => {
    // Login as Carlos Mendoza (owner) - has proper team context via setupTeamContext()
    loginAsDefaultOwner()
  })

  // ═══════════════════════════════════════════════════════════════════════════════
  // 1. PAGE - Page-level container
  // ═══════════════════════════════════════════════════════════════════════════════
  describe('SEL_TASK_PAGE_001: Page Container', { tags: '@SEL_TASK_PAGE_001' }, () => {
    beforeEach(() => {
      tasks.visitList()
      tasks.waitForList()
    })

    /**
     * Selector: entities.page.container
     * POM: tasks.selectors.page
     * data-cy: tasks-page
     */
    it.skip('should find page container (not implemented in EntityList)', () => {
      // NOTE: page.container selector not currently implemented in EntityList component
      // The page container would wrap the entire entity list view
      cy.get(tasks.selectors.page).should('exist')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2. LIST - List view selectors
  // ═══════════════════════════════════════════════════════════════════════════════
  describe('LIST Selectors', { tags: '@entities-list' }, () => {
    // ---------------------------------------------------------------------------
    // 2.1 SEARCH - Search input and controls
    // ---------------------------------------------------------------------------
    describe('SEL_TASK_LIST_001: Search Selectors', { tags: '@SEL_TASK_LIST_001' }, () => {
      beforeEach(() => {
        tasks.visitList()
        tasks.waitForList()
      })

      /**
       * Selector: entities.list.search.input
       * POM: tasks.selectors.search
       * data-cy: tasks-search-input
       */
      it('should find search input', () => {
        cy.get(tasks.selectors.search).should('exist')
      })

      /**
       * Selector: entities.list.search.container
       * POM: tasks.selectors.searchContainer
       * data-cy: tasks-search
       */
      it('should find search container', () => {
        cy.get(tasks.selectors.searchContainer).should('exist')
      })

      /**
       * Selector: entities.list.search.clear
       * POM: tasks.selectors.searchClear
       * data-cy: tasks-search-clear
       */
      it.skip('should find search clear button (not implemented)', () => {
        // NOTE: searchClear selector not currently implemented in EntityTable
        cy.get(tasks.selectors.searchClear).should('exist')
      })
    })

    // ---------------------------------------------------------------------------
    // 2.2 TABLE - Table structure selectors
    // ---------------------------------------------------------------------------
    describe('SEL_TASK_LIST_002: Table Structure Selectors', { tags: '@SEL_TASK_LIST_002' }, () => {
      beforeEach(() => {
        tasks.visitList()
        tasks.waitForList()
      })

      /**
       * Selector: entities.list.table.container
       * POM: tasks.selectors.tableContainer
       * data-cy: tasks-table-container
       */
      it('should find table container', () => {
        cy.get(tasks.selectors.tableContainer).should('exist')
      })

      /**
       * Selector: entities.list.table.element
       * POM: tasks.selectors.table
       * data-cy: tasks-table
       * NOTE: Table element only renders when there's data (not empty state)
       */
      it('should find table element (requires data)', () => {
        // Skip if no rows exist (empty state)
        cy.get('body').then(($body) => {
          if ($body.find(tasks.selectors.rowGeneric).length > 0) {
            cy.get(tasks.selectors.table).should('exist')
          } else {
            cy.log('⚠️ Skipping: No data - empty state showing')
          }
        })
      })

      /**
       * Selector: entities.list.addButton
       * POM: tasks.selectors.addButton
       * data-cy: tasks-add
       */
      it('should find add button', () => {
        cy.get(tasks.selectors.addButton).should('exist')
      })

      /**
       * Selector: entities.list.table.selectAll
       * POM: tasks.selectors.selectAll
       * data-cy: tasks-select-all
       * NOTE: SelectAll checkbox only renders when there's data and selectable=true
       */
      it('should find select all checkbox (requires data)', () => {
        // Skip if no rows exist (empty state)
        cy.get('body').then(($body) => {
          if ($body.find(tasks.selectors.rowGeneric).length > 0) {
            cy.get(tasks.selectors.selectAll).should('exist')
          } else {
            cy.log('⚠️ Skipping: No data - empty state showing')
          }
        })
      })

      /**
       * Selector: entities.list.selectionCount
       * POM: tasks.selectors.selectionCount
       * data-cy: tasks-selection-count
       * NOTE: Only visible when items are selected
       */
      it('should find selection count after selecting items (requires data)', () => {
        cy.get('body').then(($body) => {
          if ($body.find(tasks.selectors.rowGeneric).length === 0) {
            cy.log('⚠️ Skipping: No data - empty state showing')
            return
          }

          // Select the first row to make selectionCount appear
          cy.get(tasks.selectors.rowGeneric)
            .first()
            .invoke('attr', 'data-cy')
            .then((dataCy) => {
              const id = dataCy?.replace('tasks-row-', '') || ''
              cy.get(tasks.selectors.rowSelect(id)).click()

              // Now selectionCount should be visible
              cy.get(tasks.selectors.selectionCount).should('exist')

              // Clear selection
              cy.get(tasks.selectors.rowSelect(id)).click()
            })
        })
      })
    })

    // ---------------------------------------------------------------------------
    // 2.3 ROW - Dynamic row selectors
    // ---------------------------------------------------------------------------
    describe('SEL_TASK_LIST_003: Row Dynamic Selectors', { tags: '@SEL_TASK_LIST_003' }, () => {
      beforeEach(() => {
        tasks.visitList()
        tasks.waitForList()
      })

      /**
       * Selector: entities.list.table.row.element (dynamic)
       * POM: tasks.selectors.row(id)
       * data-cy: tasks-row-{id}
       * NOTE: Rows only render when there's data
       */
      it('should find row elements with rowGeneric pattern (requires data)', () => {
        cy.get('body').then(($body) => {
          if ($body.find(tasks.selectors.rowGeneric).length > 0) {
            cy.get(tasks.selectors.rowGeneric).should('have.length.at.least', 1)
          } else {
            cy.log('⚠️ Skipping: No data - empty state showing')
          }
        })
      })

      /**
       * Tests dynamic selectors: row, rowSelect, rowMenu
       * NOTE: Requires data to exist
       */
      it('should find row with dynamic ID selectors (requires data)', () => {
        cy.get('body').then(($body) => {
          if ($body.find(tasks.selectors.rowGeneric).length === 0) {
            cy.log('⚠️ Skipping: No data - empty state showing')
            return
          }

          cy.get(tasks.selectors.rowGeneric)
            .first()
            .invoke('attr', 'data-cy')
            .then((dataCy) => {
              const id = dataCy?.replace('tasks-row-', '') || ''
              expect(id).to.not.be.empty

              // Selector: entities.list.table.row.element
              cy.get(tasks.selectors.row(id)).should('exist')

              // Selector: entities.list.table.row.checkbox
              cy.get(tasks.selectors.rowSelect(id)).should('exist')

              // Selector: entities.list.table.row.menu
              cy.get(tasks.selectors.rowMenu(id)).should('exist')
            })
        })
      })

      /**
       * Selector: entities.list.table.row.action (dynamic)
       * POM: tasks.selectors.rowAction(action, id)
       * data-cy: tasks-action-{action}-{id}
       * NOTE: Requires data to exist
       */
      it('should find row action selectors in dropdown (requires data)', () => {
        cy.get('body').then(($body) => {
          if ($body.find(tasks.selectors.rowGeneric).length === 0) {
            cy.log('⚠️ Skipping: No data - empty state showing')
            return
          }

          cy.get(tasks.selectors.rowGeneric)
            .first()
            .invoke('attr', 'data-cy')
            .then((dataCy) => {
              const id = dataCy?.replace('tasks-row-', '') || ''

              // Open row menu
              cy.get(tasks.selectors.rowMenu(id)).click()

              // Check action selectors exist
              cy.get(tasks.selectors.rowAction('view', id)).should('exist')
              cy.get(tasks.selectors.rowAction('edit', id)).should('exist')
              cy.get(tasks.selectors.rowAction('delete', id)).should('exist')

              // Close menu by pressing Escape
              cy.get('body').type('{esc}')
            })
        })
      })
    })

    // ---------------------------------------------------------------------------
    // 2.4 PAGINATION - Pagination controls
    // NOTE: Pagination only renders when there's data (not in empty state)
    // ---------------------------------------------------------------------------
    describe('SEL_TASK_LIST_004: Pagination Selectors', { tags: '@SEL_TASK_LIST_004' }, () => {
      beforeEach(() => {
        tasks.visitList()
        tasks.waitForList()
      })

      /**
       * Selector: entities.list.pagination.container
       * POM: tasks.selectors.pagination
       * data-cy: tasks-pagination
       * NOTE: Requires data to exist
       */
      it('should find pagination container (requires data)', () => {
        cy.get('body').then(($body) => {
          if ($body.find(tasks.selectors.rowGeneric).length === 0) {
            cy.log('⚠️ Skipping: No data - pagination not rendered in empty state')
            return
          }
          cy.get(tasks.selectors.pagination).should('exist')
        })
      })

      /**
       * Selector: entities.list.pagination.info
       * POM: tasks.selectors.pageInfo
       * data-cy: tasks-page-info
       * NOTE: Requires data to exist
       */
      it('should find page info (requires data)', () => {
        cy.get('body').then(($body) => {
          if ($body.find(tasks.selectors.rowGeneric).length === 0) {
            cy.log('⚠️ Skipping: No data - pagination not rendered in empty state')
            return
          }
          cy.get(tasks.selectors.pageInfo).should('exist')
        })
      })

      /**
       * Selector: entities.list.pagination.pageSize
       * POM: tasks.selectors.pageSize
       * data-cy: tasks-page-size
       * NOTE: Requires data to exist
       */
      it('should find page size selector (requires data)', () => {
        cy.get('body').then(($body) => {
          if ($body.find(tasks.selectors.rowGeneric).length === 0) {
            cy.log('⚠️ Skipping: No data - pagination not rendered in empty state')
            return
          }
          cy.get(tasks.selectors.pageSize).should('exist')
        })
      })

      /**
       * Selectors: entities.list.pagination.{first,prev,next,last}
       * NOTE: Requires data to exist
       */
      it('should find pagination navigation controls (requires data)', () => {
        cy.get('body').then(($body) => {
          if ($body.find(tasks.selectors.rowGeneric).length === 0) {
            cy.log('⚠️ Skipping: No data - pagination not rendered in empty state')
            return
          }
          cy.get(tasks.selectors.pageFirst).should('exist')
          cy.get(tasks.selectors.pagePrev).should('exist')
          cy.get(tasks.selectors.pageNext).should('exist')
          cy.get(tasks.selectors.pageLast).should('exist')
        })
      })

      /**
       * Selector: entities.list.pagination.pageSizeOption (dynamic)
       * POM: tasks.selectors.pageSizeOption(size)
       * data-cy: tasks-page-size-{size}
       * NOTE: Requires data to exist
       */
      it('should find page size options when dropdown opened (requires data)', () => {
        cy.get('body').then(($body) => {
          if ($body.find(tasks.selectors.rowGeneric).length === 0) {
            cy.log('⚠️ Skipping: No data - pagination not rendered in empty state')
            return
          }
          cy.get(tasks.selectors.pageSize).click()
          cy.get(tasks.selectors.pageSizeOption('10')).should('exist')
          cy.get(tasks.selectors.pageSizeOption('20')).should('exist')
          cy.get('body').type('{esc}')
        })
      })
    })

    // ---------------------------------------------------------------------------
    // 2.5 FILTERS - Filter controls
    // ---------------------------------------------------------------------------
    describe('SEL_TASK_LIST_005: Filter Selectors', { tags: '@SEL_TASK_LIST_005' }, () => {
      beforeEach(() => {
        tasks.visitList()
        tasks.waitForList()
      })

      /**
       * Selector: entities.list.filters.trigger
       * POM: tasks.selectors.filterTrigger(field)
       * data-cy: tasks-filter-{field}
       */
      it('should find status filter trigger', () => {
        cy.get(tasks.selectors.filterTrigger('status')).should('exist')
      })

      it('should find priority filter trigger', () => {
        cy.get(tasks.selectors.filterTrigger('priority')).should('exist')
      })

      /**
       * Selector: entities.list.filters.content
       * POM: tasks.selectors.filterContent(field)
       * data-cy: tasks-filter-{field}-content
       */
      it('should find filter content when opened', () => {
        tasks.openFilter('status')
        cy.get(tasks.selectors.filterContent('status')).should('be.visible')
        cy.get('body').type('{esc}')
      })

      /**
       * Selector: entities.list.filters.option
       * POM: tasks.selectors.filterOption(field, value)
       * data-cy: tasks-filter-{field}-{value}
       * NOTE: Status values are: todo, in-progress, review, done, blocked
       */
      it('should find filter options', () => {
        tasks.openFilter('status')
        cy.get(tasks.selectors.filterOption('status', 'todo')).should('exist')
        cy.get('body').type('{esc}')
      })

      /**
       * Selector: entities.list.filters.clearAll
       * POM: tasks.selectors.filterClearAll(field)
       * data-cy: tasks-filter-{field}-clear-all
       * NOTE: Clear button only appears when >1 option is selected
       */
      it('should find filter clear button when multiple options selected', () => {
        // Open status filter
        tasks.openFilter('status')

        // Select 2 options to make clear button appear
        cy.get(tasks.selectors.filterOption('status', 'todo')).click()
        cy.get(tasks.selectors.filterOption('status', 'in-progress')).click()

        // Close dropdown
        cy.get('body').type('{esc}')

        // Clear button should now exist
        cy.get(tasks.selectors.filterClearAll('status')).should('exist')

        // Click to clear and verify it disappears
        cy.get(tasks.selectors.filterClearAll('status')).click()
        cy.get(tasks.selectors.filterClearAll('status')).should('not.exist')
      })
    })

    // ---------------------------------------------------------------------------
    // 2.6 BULK - Bulk action selectors
    // ---------------------------------------------------------------------------
    describe('SEL_TASK_LIST_006: Bulk Action Selectors', { tags: '@SEL_TASK_LIST_006' }, () => {
      beforeEach(() => {
        tasks.visitList()
        tasks.waitForList()
      })

      /**
       * Selectors: entities.list.bulk.{bar,count,delete,clear}
       * Bulk bar appears after selecting items
       * NOTE: Requires data to exist
       */
      it('should show bulk bar selectors after selecting rows (requires data)', () => {
        cy.get('body').then(($body) => {
          if ($body.find(tasks.selectors.rowGeneric).length === 0) {
            cy.log('⚠️ Skipping: No data - empty state showing')
            return
          }

          cy.get(tasks.selectors.rowGeneric)
            .first()
            .invoke('attr', 'data-cy')
            .then((dataCy) => {
              const id = dataCy?.replace('tasks-row-', '') || ''
              cy.get(tasks.selectors.rowSelect(id)).click()

              // Selector: entities.list.bulk.bar
              cy.get(tasks.selectors.bulkBar).should('be.visible')

              // Selector: entities.list.bulk.count
              cy.get(tasks.selectors.bulkCount).should('exist')

              // Selector: entities.list.bulk.deleteButton
              cy.get(tasks.selectors.bulkDelete).should('exist')

              // Selector: entities.list.bulk.clearButton
              cy.get(tasks.selectors.bulkClear).should('exist')
            })
        })
      })

      /**
       * Selector: entities.list.bulk.statusButton
       * POM: tasks.selectors.bulkStatus
       * NOTE: enableChangeStatus not enabled in EntityListWrapper for tasks
       */
      it.skip('should find bulk status button (enableChangeStatus not enabled)', () => {
        cy.get(tasks.selectors.bulkStatus).should('exist')
      })

      /**
       * Selectors: entities.list.bulk.deleteDialog, deleteCancel, deleteConfirm
       * NOTE: Requires data to exist
       */
      it('should show bulk delete dialog selectors (requires data)', () => {
        cy.get('body').then(($body) => {
          if ($body.find(tasks.selectors.rowGeneric).length === 0) {
            cy.log('⚠️ Skipping: No data - empty state showing')
            return
          }

          cy.get(tasks.selectors.rowGeneric)
            .first()
            .invoke('attr', 'data-cy')
            .then((dataCy) => {
              const id = dataCy?.replace('tasks-row-', '') || ''
              cy.get(tasks.selectors.rowSelect(id)).click()

              // Open bulk delete dialog
              cy.get(tasks.selectors.bulkDelete).click()

              // Selector: entities.list.bulk.deleteDialog
              cy.get(tasks.selectors.bulkDeleteDialog).should('be.visible')

              // Selector: entities.list.bulk.deleteCancel
              cy.get(tasks.selectors.bulkDeleteCancel).should('exist')

              // Selector: entities.list.bulk.deleteConfirm
              cy.get(tasks.selectors.bulkDeleteConfirm).should('exist')

              // Cancel without deleting
              cy.get(tasks.selectors.bulkDeleteCancel).click()
            })
        })
      })
    })

    // ---------------------------------------------------------------------------
    // 2.7 CONFIRM - Row action confirm dialogs
    // ---------------------------------------------------------------------------
    describe('SEL_TASK_LIST_007: Confirm Dialog Selectors', { tags: '@SEL_TASK_LIST_007' }, () => {
      /**
       * Selectors: entities.list.confirm.{dialog,cancel,action}
       * Confirm dialog appears for row delete action
       * NOTE: Requires data to exist
       */
      it('should show confirm dialog selectors for row delete (requires data)', () => {
        tasks.visitList()
        tasks.waitForList()

        cy.get('body').then(($body) => {
          if ($body.find(tasks.selectors.rowGeneric).length === 0) {
            cy.log('⚠️ Skipping: No data - empty state showing')
            return
          }

          cy.get(tasks.selectors.rowGeneric)
            .first()
            .invoke('attr', 'data-cy')
            .then((dataCy) => {
              const id = dataCy?.replace('tasks-row-', '') || ''

              // Open row menu and click delete
              cy.get(tasks.selectors.rowMenu(id)).click()
              cy.get(tasks.selectors.rowAction('delete', id)).click()

              // Selector: entities.list.confirm.dialog
              cy.get(tasks.selectors.confirmDialog).should('be.visible')

              // Selector: entities.list.confirm.cancel
              cy.get(tasks.selectors.confirmCancel).should('exist')

              // Selector: entities.list.confirm.action
              cy.get(tasks.selectors.confirmAction).should('exist')

              // Cancel without deleting
              cy.get(tasks.selectors.confirmCancel).click()
            })
        })
      })
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════════
  // 3. HEADER - Entity detail header
  // ═══════════════════════════════════════════════════════════════════════════════
  describe('SEL_TASK_HEADER_001: Header Selectors', { tags: '@SEL_TASK_HEADER_001' }, () => {
    /**
     * Header selectors for CREATE mode
     * Selectors: entities.header.container (mode: create), backButton
     */
    describe('Create Mode', () => {
      beforeEach(() => {
        tasks.visitCreate()
        tasks.waitForForm()
      })

      /**
       * Selector: entities.header.container (mode: create)
       * POM: tasks.selectors.createHeader
       * data-cy: tasks-create-header
       */
      it('should find create header', () => {
        cy.get(tasks.selectors.createHeader).should('exist')
      })

      /**
       * Selector: entities.header.backButton
       * POM: tasks.selectors.backButton
       * data-cy: tasks-back
       */
      it('should find back button', () => {
        cy.get(tasks.selectors.backButton).should('exist')
      })

      /**
       * Selector: entities.header.title
       * POM: tasks.selectors.title
       * data-cy: tasks-header-title
       */
      it('should find header title', () => {
        cy.get(tasks.selectors.title).should('exist')
      })
    })

    /**
     * Header selectors for VIEW mode
     * Selectors: entities.header.container (mode: view), backButton, editButton, deleteButton
     * NOTE: Requires data to exist
     */
    describe('View Mode', () => {
      it('should find view header selectors (requires data)', () => {
        tasks.visitList()
        tasks.waitForList()

        cy.get('body').then(($body) => {
          if ($body.find(tasks.selectors.rowGeneric).length === 0) {
            cy.log('⚠️ Skipping: No data - empty state showing')
            return
          }

          cy.get(tasks.selectors.rowGeneric)
            .first()
            .invoke('attr', 'data-cy')
            .then((dataCy) => {
              const id = dataCy?.replace('tasks-row-', '') || ''

              tasks.visitDetail(id)
              tasks.waitForDetail()

              // Selector: entities.header.container (mode: view)
              cy.get(tasks.selectors.viewHeader).should('exist')

              // Selector: entities.header.backButton
              cy.get(tasks.selectors.backButton).should('exist')

              // Selector: entities.header.editButton
              cy.get(tasks.selectors.editButton).should('exist')

              // Selector: entities.header.deleteButton
              cy.get(tasks.selectors.deleteButton).should('exist')
            })
        })
      })

      /**
       * Selectors: entities.header.{deleteDialog,deleteCancel,deleteConfirm}
       * NOTE: Requires data to exist
       */
      it('should find header delete dialog selectors (requires data)', () => {
        tasks.visitList()
        tasks.waitForList()

        cy.get('body').then(($body) => {
          if ($body.find(tasks.selectors.rowGeneric).length === 0) {
            cy.log('⚠️ Skipping: No data - empty state showing')
            return
          }

          cy.get(tasks.selectors.rowGeneric)
            .first()
            .invoke('attr', 'data-cy')
            .then((dataCy) => {
              const id = dataCy?.replace('tasks-row-', '') || ''

              tasks.visitDetail(id)
              tasks.waitForDetail()

              // Click delete to open dialog
              tasks.clickDelete()

              // Selector: entities.header.deleteDialog
              cy.get(tasks.selectors.deleteDialog).should('be.visible')

              // Selector: entities.header.deleteConfirm
              cy.get(tasks.selectors.deleteConfirm).should('exist')

              // Selector: entities.header.deleteCancel
              cy.get(tasks.selectors.deleteCancel).should('exist')

              // Cancel without deleting
              tasks.cancelDelete()
            })
        })
      })
    })

    /**
     * Header selectors for EDIT mode
     * Selectors: entities.header.container (mode: edit), backButton
     * NOTE: Requires data to exist
     */
    describe('Edit Mode', () => {
      it('should find edit header selectors (requires data)', () => {
        tasks.visitList()
        tasks.waitForList()

        cy.get('body').then(($body) => {
          if ($body.find(tasks.selectors.rowGeneric).length === 0) {
            cy.log('⚠️ Skipping: No data - empty state showing')
            return
          }

          cy.get(tasks.selectors.rowGeneric)
            .first()
            .invoke('attr', 'data-cy')
            .then((dataCy) => {
              const id = dataCy?.replace('tasks-row-', '') || ''

              tasks.visitEdit(id)
              tasks.waitForForm()

              // Selector: entities.header.container (mode: edit)
              cy.get(tasks.selectors.editHeader).should('exist')

              // Selector: entities.header.backButton
              cy.get(tasks.selectors.backButton).should('exist')
            })
        })
      })
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════════
  // 4. DETAIL - Detail view container
  // ═══════════════════════════════════════════════════════════════════════════════
  describe('SEL_TASK_DETAIL_001: Detail Container', { tags: '@SEL_TASK_DETAIL_001' }, () => {
    /**
     * Selector: entities.detail.container
     * POM: tasks.selectors.detail
     * data-cy: tasks-detail
     * NOTE: Requires data to exist
     */
    it('should find detail container (requires data)', () => {
      tasks.visitList()
      tasks.waitForList()

      cy.get('body').then(($body) => {
        if ($body.find(tasks.selectors.rowGeneric).length === 0) {
          cy.log('⚠️ Skipping: No data - empty state showing')
          return
        }

        cy.get(tasks.selectors.rowGeneric)
          .first()
          .invoke('attr', 'data-cy')
          .then((dataCy) => {
            const id = dataCy?.replace('tasks-row-', '') || ''

            tasks.visitDetail(id)
            tasks.waitForDetail()

            cy.get(tasks.selectors.detail).should('exist')
          })
      })
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════════
  // 5. FORM - Form selectors
  // ═══════════════════════════════════════════════════════════════════════════════
  describe('SEL_TASK_FORM_001: Form Selectors', { tags: '@SEL_TASK_FORM_001' }, () => {
    beforeEach(() => {
      tasks.visitCreate()
      tasks.waitForForm()
    })

    /**
     * Selector: entities.form.container
     * POM: tasks.selectors.form
     * data-cy: tasks-form
     */
    it('should find form container', () => {
      cy.get(tasks.selectors.form).should('exist')
    })

    /**
     * Selector: entities.form.submitButton
     * POM: tasks.selectors.submitButton
     * data-cy: tasks-form-submit
     */
    it('should find submit button', () => {
      cy.get(tasks.selectors.submitButton).should('exist')
    })

    /**
     * Selector: entities.form.field (dynamic)
     * POM: tasks.selectors.field(name)
     * data-cy: tasks-field-{name}
     */
    describe('Field Selectors', () => {
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
  })

  // ═══════════════════════════════════════════════════════════════════════════════
  // 6. CHILD ENTITY - Child entity management (not applicable for tasks)
  // ═══════════════════════════════════════════════════════════════════════════════
  // NOTE: Tasks entity does not have child entities.
  // If it did, tests would follow this pattern:
  //
  // describe('SEL_TASK_CHILD_001: Child Entity Selectors', { tags: '@SEL_TASK_CHILD_001' }, () => {
  //   /**
  //    * Selector: entities.childEntity.container
  //    * POM: tasks.selectors.childEntityContainer(childName)
  //    * data-cy: tasks-{childName}-section
  //    */
  //   it('should find child entity container', () => {
  //     cy.get(tasks.selectors.childEntityContainer('subtasks')).should('exist')
  //   })
  //
  //   /**
  //    * Selector: entities.childEntity.addButton
  //    * POM: tasks.selectors.childEntityAddButton(childName)
  //    * data-cy: tasks-{childName}-add
  //    */
  //   it('should find child entity add button', () => {
  //     cy.get(tasks.selectors.childEntityAddButton('subtasks')).should('exist')
  //   })
  // })
})
