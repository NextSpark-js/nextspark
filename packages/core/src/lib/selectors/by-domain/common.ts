/**
 * `sel` bound to the `common` domain only: `import { sel } from '@nextsparkjs/core/selectors/common'`.
 * Same paths and values as the barrel's `sel('common.…')`, without shipping the other domains to the page.
 */

import { createSelectorHelpers } from '../selector-factory'
import { COMMON_SELECTORS } from '../domains/common.selectors'

export { COMMON_SELECTORS }
export const { sel, s, selDev, cySelector } = createSelectorHelpers({ common: COMMON_SELECTORS })
