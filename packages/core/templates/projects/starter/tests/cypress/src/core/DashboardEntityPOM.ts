/**
 * DashboardEntityPOM - Theme-specific base class for entity Page Object Models
 *
 * Extends DashboardEntityPOMCore from @nextsparkjs/testing and implements
 * the abstract cySelector method with theme-specific selectors.
 *
 * Adds theme-specific functionality:
 * - Entity config validation (optional)
 * - Convenience aliases (goToList, goToCreate, etc.)
 * - CRUD helper methods (create, edit, delete)
 * - Additional assertions
 *
 * @example
 * class TasksPOM extends DashboardEntityPOM {
 *   constructor() {
 *     super('tasks')
 *   }
 *
 *   fillTaskForm(data: TaskFormData) {
 *     // Entity-specific form handling
 *   }
 * }
 */

import { DashboardEntityPOMCore, type EntityConfig } from '@nextsparkjs/testing/pom'
import { type Replacements } from '@nextsparkjs/core/selectors'
import { cySelector } from '../selectors'

// Optional: Import entities config for validation
// import entitiesConfig from '../../fixtures/entities.json'

export abstract class DashboardEntityPOM extends DashboardEntityPOMCore {
  /**
   * Implement abstract method from BasePOMCore
   * Uses theme-specific selectors (THEME_SELECTORS)
   */
  protected cySelector(path: string, replacements?: Replacements): string {
    return cySelector(path, replacements)
  }

  // ============================================
  // CONVENIENCE NAVIGATION ALIASES
  // ============================================

  /**
   * Alias for visitList
   */
  goToList() {
    return this.visitList()
  }

  /**
   * Alias for visitCreate
   */
  goToCreate() {
    return this.visitCreate()
  }

  /**
   * Alias for visitEdit
   */
  goToEdit(id: string) {
    return this.visitEdit(id)
  }

  // ============================================
  // CRUD HELPER METHODS
  // ============================================

  /**
   * Create entity with data
   * Override in subclass to fill form with specific fields
   */
  create(data: Record<string, unknown>) {
    this.visitCreate()
    this.waitForForm()
    // Override in subclass to fill form
    this.submitForm()
    return this
  }

  /**
   * Edit entity with data
   * Override in subclass to fill form with specific fields
   */
  edit(id: string, data: Record<string, unknown>) {
    this.visitEdit(id)
    this.waitForForm()
    // Override in subclass to fill form
    this.submitForm()
    return this
  }

  /**
   * Delete entity by ID
   */
  delete(id: string) {
    this.visitDetail(id)
    this.waitForDetail()
    this.clickDelete()
    this.confirmDelete()
    return this
  }

  // ============================================
  // ADDITIONAL ASSERTIONS
  // ============================================

  /**
   * Assert item exists by data (checks title or name)
   */
  assertItemExists(data: { title?: string; name?: string }) {
    const text = data.title || data.name || ''
    return this.assertInList(text)
  }

  /**
   * Assert item does not exist by data
   */
  assertItemNotExists(data: { title?: string; name?: string }) {
    const text = data.title || data.name || ''
    return this.assertNotInList(text)
  }
}

export default DashboardEntityPOM

// Re-export EntityConfig for convenience
export type { EntityConfig }
