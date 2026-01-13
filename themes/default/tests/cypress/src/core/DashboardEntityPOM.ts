/**
 * DashboardEntityPOM - Theme-specific base class for entity Page Object Models
 *
 * Extends DashboardEntityPOMCore from @nextsparkjs/testing and implements
 * the abstract cySelector method with theme-specific selectors.
 *
 * Adds theme-specific functionality:
 * - Entity config validation from fixtures
 * - Convenience aliases (goToList, goToCreate, etc.)
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

export abstract class DashboardEntityPOM extends DashboardEntityPOMCore {
  /**
   * Implement abstract method from BasePOMCore
   * Uses theme-specific selectors (THEME_SELECTORS)
   */
  protected cySelector(path: string, replacements?: Replacements): string {
    return cySelector(path, replacements)
  }
}

export default DashboardEntityPOM

// Re-export EntityConfig for convenience
export type { EntityConfig }
