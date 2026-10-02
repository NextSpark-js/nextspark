/**
 * `sel` bound to the `settings` domain only: `import { sel } from '@nextsparkjs/core/selectors/settings'`.
 * Same paths and values as the barrel's `sel('settings.…')`, without shipping the other domains to the page.
 */

import { createSelectorHelpers } from '../selector-factory'
import { SETTINGS_SELECTORS } from '../domains/settings.selectors'

export { SETTINGS_SELECTORS }
export const { sel, s, selDev, cySelector } = createSelectorHelpers({ settings: SETTINGS_SELECTORS })
