/**
 * `sel` bound to the `globalSearch` domain only: `import { sel } from '@nextsparkjs/core/selectors/global-search'`.
 * Same paths and values as the barrel's `sel('globalSearch.…')`, without shipping the other domains to the page.
 */

import { createSelectorHelpers } from '../selector-factory'
import { GLOBAL_SEARCH_SELECTORS } from '../domains/global-search.selectors'

export { GLOBAL_SEARCH_SELECTORS }
export const { sel, s, selDev, cySelector } = createSelectorHelpers({ globalSearch: GLOBAL_SEARCH_SELECTORS })
