/**
 * `sel` bound to the `entities` domain only: `import { sel } from '@nextsparkjs/core/selectors/entities'`.
 * Same paths and values as the barrel's `sel('entities.…')`, without shipping the other domains to the page.
 */

import { createSelectorHelpers } from '../selector-factory'
import { ENTITIES_SELECTORS } from '../domains/entities.selectors'

export { ENTITIES_SELECTORS }
export const { sel, s, selDev, cySelector } = createSelectorHelpers({ entities: ENTITIES_SELECTORS })
