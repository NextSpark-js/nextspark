/**
 * Page Object Model Core Classes
 *
 * These are the CORE versions that themes extend.
 * Themes must implement the abstract `cySelector` method.
 *
 * @example Theme usage:
 * ```ts
 * // theme/tests/cypress/src/core/BasePOM.ts
 * import { BasePOMCore } from '@nextsparkjs/testing/pom'
 * import { cySelector } from '../selectors'
 *
 * export abstract class BasePOM extends BasePOMCore {
 *   protected cySelector(path: string, replacements?: Record<string, string>): string {
 *     return cySelector(path, replacements)
 *   }
 * }
 * ```
 */

export { BasePOMCore } from './BasePOMCore'
export { DashboardEntityPOMCore, type EntityConfig } from './DashboardEntityPOMCore'
