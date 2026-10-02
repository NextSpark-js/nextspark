/**
 * `sel` bound to the `superadmin` domain only: `import { sel } from '@nextsparkjs/core/selectors/superadmin'`.
 * Same paths and values as the barrel's `sel('superadmin.…')`, without shipping the other domains to the page.
 */

import { createSelectorHelpers } from '../selector-factory'
import { SUPERADMIN_SELECTORS } from '../domains/superadmin.selectors'

export { SUPERADMIN_SELECTORS }
export const { sel, s, selDev, cySelector } = createSelectorHelpers({ superadmin: SUPERADMIN_SELECTORS })
