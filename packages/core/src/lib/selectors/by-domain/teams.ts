/**
 * `sel` bound to the `teams` domain only: `import { sel } from '@nextsparkjs/core/selectors/teams'`.
 * Same paths and values as the barrel's `sel('teams.…')`, without shipping the other domains to the page.
 */

import { createSelectorHelpers } from '../selector-factory'
import { TEAMS_SELECTORS } from '../domains/teams.selectors'

export { TEAMS_SELECTORS }
export const { sel, s, selDev, cySelector } = createSelectorHelpers({ teams: TEAMS_SELECTORS })
