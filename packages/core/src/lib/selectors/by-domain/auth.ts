/**
 * `sel` bound to the `auth` domain only: `import { sel } from '@nextsparkjs/core/selectors/auth'`.
 * Same paths and values as the barrel's `sel('auth.…')`, without shipping the other domains to the page.
 */

import { createSelectorHelpers } from '../selector-factory'
import { AUTH_SELECTORS } from '../domains/auth.selectors'

export { AUTH_SELECTORS }
export const { sel, s, selDev, cySelector } = createSelectorHelpers({ auth: AUTH_SELECTORS })
