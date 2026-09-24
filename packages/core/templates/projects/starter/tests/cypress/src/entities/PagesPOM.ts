/**
 * PagesPOM - Page Object Model for Pages entity (List operations)
 *
 * Extends DashboardEntityPOM for list page operations.
 * For editing pages with the block editor, use PageBuilderPOM from features/.
 *
 * @example
 * // List operations
 * PagesPOM.create()
 *   .visitList()
 *   .waitForList()
 *   .search('About Us')
 *   .selectFilter('status', 'published')
 *
 * // For editing pages, use PageBuilderPOM
 * import { PageBuilderPOM } from '../features/PageBuilderPOM'
 * PageBuilderPOM.create().visitEdit(pageId).setTitle('New Title').save()
 */

import { DashboardEntityPOM } from '../core/DashboardEntityPOM'
import entitiesConfig from '../../fixtures/entities.json'

export interface PageListFilters {
  status?: 'draft' | 'published' | 'archived'
  locale?: 'en' | 'es'
}

export class PagesPOM extends DashboardEntityPOM {
  constructor() {
    super(entitiesConfig.entities.pages.slug)
  }

  // ============================================
  // FACTORY METHOD
  // ============================================

  static create(): PagesPOM {
    return new PagesPOM()
  }

  // ============================================
  // PAGE-SPECIFIC LIST METHODS
  // ============================================

  /**
   * Filter pages by status
   */
  filterByStatus(status: 'draft' | 'published' | 'archived') {
    return this.selectFilter('status', status)
  }

  /**
   * Apply multiple filters at once
   */
  applyFilters(filters: PageListFilters) {
    if (filters.status) {
      this.filterByStatus(filters.status)
    }
    if (filters.locale) {
      this.selectFilter('locale', filters.locale)
    }
    return this
  }

  // ============================================
  // WORKFLOW METHODS
  // ============================================

  /**
   * Navigate to create page
   * Note: Pages use block editor, so this redirects to the editor
   */
  navigateToCreate() {
    this.clickAdd()
    return this
  }

  /**
   * Navigate to edit page for a page
   * Note: Pages use block editor, so this redirects to the editor
   */
  navigateToEdit(id: string) {
    this.clickRowAction('edit', id)
    return this
  }

  /**
   * Delete page from list with API waits
   */
  deletePageWithApiWait(id: string) {
    this.visitDetailWithApiWait(id)
    this.clickDelete()
    this.confirmDelete()
    this.api.waitForDelete()
    return this
  }

  /**
   * Delete page by finding it in the list by title
   */
  deletePageByTitleWithApiWait(title: string) {
    this.clickRowByText(title)
    this.waitForDetail()
    this.clickDelete()
    this.confirmDelete()
    this.api.waitForDelete()
    return this
  }

  // ============================================
  // ENTITY-SPECIFIC ASSERTIONS
  // ============================================

  /**
   * Assert page appears in list
   */
  assertPageInList(title: string) {
    return this.assertInList(title)
  }

  /**
   * Assert page does not appear in list
   */
  assertPageNotInList(title: string) {
    return this.assertNotInList(title)
  }

  /**
   * Assert page has specific status badge
   */
  assertPageStatus(id: string, status: string) {
    cy.get(this.selectors.row(id)).should('contain.text', status)
    return this
  }
}

export default PagesPOM
