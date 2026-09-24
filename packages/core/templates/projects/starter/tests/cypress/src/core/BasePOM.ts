/**
 * BasePOM - Theme-specific base class for Page Object Models
 *
 * Extends BasePOMCore from @nextsparkjs/testing and implements
 * the abstract cySelector method with theme-specific selectors.
 *
 * @example Usage in feature POMs:
 * ```ts
 * import { BasePOM } from './BasePOM'
 *
 * class MyFeaturePOM extends BasePOM {
 *   get elements() {
 *     return {
 *       button: this.cy('myFeature.button'),
 *     }
 *   }
 * }
 * ```
 */
import { BasePOMCore, type Replacements } from '@nextsparkjs/testing/pom'
import { cySelector } from '../selectors'

export abstract class BasePOM extends BasePOMCore {
  /**
   * Implement abstract method from BasePOMCore
   * Uses theme-specific selectors (THEME_SELECTORS)
   */
  protected cySelector(path: string, replacements?: Replacements): string {
    return cySelector(path, replacements)
  }
}

export default BasePOM
