/**
 * Theme Selectors for Cypress Tests
 *
 * This file re-exports from the main selectors in lib/.
 * The lib/selectors.ts is the source of truth, placed there so
 * block components can import it (tests/ is excluded from TypeScript).
 *
 * Architecture:
 * - Core selectors: `core/lib/test/core-selectors.ts`
 * - Theme selectors (source): `lib/selectors.ts`
 * - Theme selectors (tests): This file (re-exports)
 *
 * @example POM usage:
 * ```typescript
 * import { cySelector, sel, SELECTORS } from '../selectors'
 *
 * class MyPOM extends BasePOM {
 *   get elements() {
 *     return {
 *       loginForm: cySelector('auth.login.form'),
 *       submitButton: cySelector('auth.login.submit'),
 *       postsList: cySelector('entities.posts.list'),
 *     }
 *   }
 * }
 * ```
 */

// Re-export everything from the lib selectors
export {
  BLOCK_SELECTORS,
  ENTITY_SELECTORS,
  BLOG_SELECTORS,
  THEME_SELECTORS,
  SELECTORS,
  sel,
  s,
  selDev,
  cySelector,
  entitySelectors,
  CORE_SELECTORS,
} from '../../../lib/selectors'

export type {
  ThemeSelectorsType,
  BlockSelectorsType,
  EntitySelectorsType,
  Replacements,
} from '../../../lib/selectors'
