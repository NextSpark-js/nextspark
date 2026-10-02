/**
 * `sel` bound to the `taxonomies` domain only: `import { sel } from '@nextsparkjs/core/selectors/taxonomies'`.
 * Same paths and values as the barrel's `sel('taxonomies.…')`, without shipping the other domains to the page.
 */

import { createSelectorHelpers } from '../selector-factory'
import { TAXONOMIES_SELECTORS } from '../domains/taxonomies.selectors'

export { TAXONOMIES_SELECTORS }
export const { sel, s, selDev, cySelector } = createSelectorHelpers({ taxonomies: TAXONOMIES_SELECTORS })
