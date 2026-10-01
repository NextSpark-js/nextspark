/**
 * `sel` for the auth pages, bound to the `auth` domain only (same values as `sel('auth.…')` of ./selectors).
 *
 * `sel` resolves a path at runtime, so the module that binds it to CORE_SELECTORS ships every domain (superadmin,
 * devtools, block editor, entities...) to each page that imports it. The auth forms only read `auth.*` paths.
 */

import { createSelectorHelpers } from './selector-factory'
import { AUTH_SELECTORS } from './domains/auth.selectors'

export const { sel } = createSelectorHelpers({ auth: AUTH_SELECTORS })
