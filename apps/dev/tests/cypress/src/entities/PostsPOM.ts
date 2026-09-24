/**
 * PostsPOM - Page Object Model for Posts entity (List operations)
 *
 * Extends DashboardEntityPOM for list page operations.
 * For editing posts with the block editor, use PostEditorPOM from features/.
 *
 * @example
 * // List operations
 * PostsPOM.create()
 *   .visitList()
 *   .waitForList()
 *   .search('My Post')
 *   .selectFilter('status', 'published')
 *
 * // For editing posts, use PostEditorPOM
 * import { PostEditorPOM } from '../features/PostEditorPOM'
 * PostEditorPOM.create().visitEdit(postId).setTitle('New Title').save()
 */

import { DashboardEntityPOM } from '../core/DashboardEntityPOM'
import entitiesConfig from '../../fixtures/entities.json'

export interface PostListFilters {
  status?: 'draft' | 'published' | 'archived'
  categoryId?: string
}

export class PostsPOM extends DashboardEntityPOM {
  constructor() {
    super(entitiesConfig.entities.posts.slug)
  }

  // ============================================
  // FACTORY METHOD
  // ============================================

  static create(): PostsPOM {
    return new PostsPOM()
  }

  // ============================================
  // POST-SPECIFIC LIST METHODS
  // ============================================

  /**
   * Filter posts by status
   */
  filterByStatus(status: 'draft' | 'published' | 'archived') {
    return this.selectFilter('status', status)
  }

  /**
   * Apply multiple filters at once
   */
  applyFilters(filters: PostListFilters) {
    if (filters.status) {
      this.filterByStatus(filters.status)
    }
    if (filters.categoryId) {
      this.selectFilter('categoryId', filters.categoryId)
    }
    return this
  }

  // ============================================
  // WORKFLOW METHODS
  // ============================================

  /**
   * Navigate to create page
   * Note: Posts use block editor, so this redirects to the editor
   */
  navigateToCreate() {
    this.clickAdd()
    return this
  }

  /**
   * Navigate to edit page for a post
   * Note: Posts use block editor, so this redirects to the editor
   */
  navigateToEdit(id: string) {
    this.clickRowAction('edit', id)
    return this
  }

  /**
   * Delete post from list with API waits
   */
  deletePostWithApiWait(id: string) {
    this.visitDetailWithApiWait(id)
    this.clickDelete()
    this.confirmDelete()
    this.api.waitForDelete()
    return this
  }

  /**
   * Delete post by finding it in the list by title
   */
  deletePostByTitleWithApiWait(title: string) {
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
   * Assert post appears in list
   */
  assertPostInList(title: string) {
    return this.assertInList(title)
  }

  /**
   * Assert post does not appear in list
   */
  assertPostNotInList(title: string) {
    return this.assertNotInList(title)
  }

  /**
   * Assert post has specific status badge
   */
  assertPostStatus(id: string, status: string) {
    cy.get(this.selectors.row(id)).should('contain.text', status)
    return this
  }
}

export default PostsPOM
