/**
 * `sel` bound to the `dashboard` domain only: `import { sel } from '@nextsparkjs/core/selectors/dashboard'`.
 * Same paths and values as the barrel's `sel('dashboard.…')`, without shipping the other domains to the page.
 */

import { createSelectorHelpers } from '../selector-factory'
import { DASHBOARD_SELECTORS } from '../domains/dashboard.selectors'

export { DASHBOARD_SELECTORS }
export const { sel, s, selDev, cySelector } = createSelectorHelpers({ dashboard: DASHBOARD_SELECTORS })
