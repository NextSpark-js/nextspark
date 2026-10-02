/**
 * `sel` bound to the `patterns` domain only: `import { sel } from '@nextsparkjs/core/selectors/patterns'`.
 * Same paths and values as the barrel's `sel('patterns.…')`, without shipping the other domains to the page.
 */

import { createSelectorHelpers } from '../selector-factory'
import { PATTERNS_SELECTORS } from '../domains/patterns.selectors'

export { PATTERNS_SELECTORS }
export const { sel, s, selDev, cySelector } = createSelectorHelpers({ patterns: PATTERNS_SELECTORS })
