/**
 * `sel` bound to the `media` domain only: `import { sel } from '@nextsparkjs/core/selectors/media'`.
 * Same paths and values as the barrel's `sel('media.…')`, without shipping the other domains to the page.
 */

import { createSelectorHelpers } from '../selector-factory'
import { MEDIA_SELECTORS } from '../domains/media.selectors'

export { MEDIA_SELECTORS }
export const { sel, s, selDev, cySelector } = createSelectorHelpers({ media: MEDIA_SELECTORS })
