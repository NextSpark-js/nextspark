/**
 * `sel` bound to the `public` domain only: `import { sel } from '@nextsparkjs/core/selectors/public'`.
 * Same paths and values as the barrel's `sel('public.…')`, without shipping the other domains to the page.
 */

import { createSelectorHelpers } from '../selector-factory'
import { PUBLIC_SELECTORS } from '../domains/public.selectors'

export { PUBLIC_SELECTORS }
export const { sel, s, selDev, cySelector } = createSelectorHelpers({ public: PUBLIC_SELECTORS })
