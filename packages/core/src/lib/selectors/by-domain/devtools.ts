/**
 * `sel` bound to the `devtools` domain only: `import { sel } from '@nextsparkjs/core/selectors/devtools'`.
 * Same paths and values as the barrel's `sel('devtools.…')`, without shipping the other domains to the page.
 */

import { createSelectorHelpers } from '../selector-factory'
import { DEVTOOLS_SELECTORS } from '../domains/devtools.selectors'

export { DEVTOOLS_SELECTORS }
export const { sel, s, selDev, cySelector } = createSelectorHelpers({ devtools: DEVTOOLS_SELECTORS })
